// Command workcell runs one of three roles: workcell (agent workspaces),
// integrator (workspaces + /integrate, /ci, /seed), or gitserver (serve-git).
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"livemain/workcell/internal/api"
	"livemain/workcell/internal/gitserver"
	"livemain/workcell/internal/gitstore"
	"livemain/workcell/internal/integrator"
	"livemain/workcell/internal/livefs"
	"livemain/workcell/internal/merge"
	"livemain/workcell/internal/sigdiff"
	"livemain/workcell/internal/testrun"
	"livemain/workcell/internal/workspace"
)

func usage() {
	fmt.Fprintf(os.Stderr, `usage:
  workcell serve [--listen :8080] [--role workcell|integrator]
  workcell serve-git [--listen :8090] [--root /srv/git] [--public-url http://gitserver:8090]

environment:
  LIVEMAIN_ROLE      default --role for serve (workcell | integrator)
  LIVEMAIN_ISOLATE=0 run every workspace's tests as root instead of a per-workspace uid
  LIVEMAIN_DATA      data root (default /var/livemain)
  LIVEMAIN_DEPS      node_modules dir (default /deps/node_modules)
  LIVEMAIN_SIGDIFF   sigdiff CLI (default /opt/livemain/sigdiff.cjs)
  LIVEMAIN_MERGIRAF  mergiraf binary (default "mergiraf" on PATH)
  LIVEMAIN_FUSE_DEBUG=1     log every FUSE request
  LIVEMAIN_FUSE_TIMEOUT     kernel entry/attr TTL (Go duration, default 1s)
  LIVEMAIN_FUSE_DIRECTIO=1  disable the kernel page cache for file handles
`)
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	args := os.Args[1:]
	// Some runtimes append a configured entrypoint to the image ENTRYPOINT ("workcell");
	// accept a repeated program name so both conventions work.
	if args[0] == "workcell" {
		args = args[1:]
		if len(args) == 0 {
			args = []string{"serve"}
		}
	}
	var err error
	switch args[0] {
	case "serve":
		err = serve(args[1:])
	case "serve-git":
		err = serveGit(args[1:])
	case "-h", "--help", "help":
		usage()
		return
	default:
		usage()
		os.Exit(2)
	}
	if err != nil {
		log.Fatal(err)
	}
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func serve(args []string) error {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	listen := fs.String("listen", ":8080", "listen address")
	defaultRole := api.RoleWorkcell
	if r := os.Getenv("LIVEMAIN_ROLE"); r != "" {
		defaultRole = r
	}
	role := fs.String("role", defaultRole, "workcell | integrator (default from $LIVEMAIN_ROLE)")
	_ = fs.Parse(args)
	if *role != api.RoleWorkcell && *role != api.RoleIntegrator {
		return fmt.Errorf("unknown role %q", *role)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	dataDir := env("LIVEMAIN_DATA", "/var/livemain")
	depsDir := env("LIVEMAIN_DEPS", "/deps/node_modules")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return err
	}
	mirror, err := gitstore.OpenMirror(ctx, filepath.Join(dataDir, "mirror.git"))
	if err != nil {
		return fmt.Errorf("open mirror: %w", err)
	}
	defer mirror.Close()
	merger := merge.NewMerger(os.Getenv("LIVEMAIN_MERGIRAF"))
	sd := sigdiff.New(env("LIVEMAIN_SIGDIFF", "/opt/livemain/sigdiff.cjs"))
	defer sd.Close()
	// Tests run as a per-workspace uid unless LIVEMAIN_ISOLATE=0.
	tests := &testrun.Runner{DepsDir: depsDir, Isolate: os.Getenv("LIVEMAIN_ISOLATE") != "0"}
	if err := tests.Check(); err != nil {
		log.Printf("warning: %v (%s)", err, depsDir)
	}
	if !sd.Available() {
		log.Printf("warning: sigdiff not found at %s; read-write severity falls back to review", sd.Script)
	}
	log.Printf("mergiraf: %v", merger.HasMergiraf())

	manager := workspace.NewManager(workspace.Config{
		DataDir: dataDir,
		DepsDir: depsDir,
		Mirror:  mirror,
		Merger:  merger,
		Sigdiff: sd,
		Tests:   tests,
		Fuse:    fuseOptions(),
	})
	srv := &api.Server{Role: *role, Workspaces: manager, Merger: merger}
	if *role == api.RoleIntegrator {
		srv.Integrator = integrator.New(integrator.Config{
			DataDir: dataDir, DepsDir: depsDir, Mirror: mirror, Merger: merger, Sigdiff: sd, Tests: tests,
		})
	}
	err = listenAndServe(ctx, *listen, srv.Handler())
	// Unmount everything on the way out.
	for _, info := range manager.List(context.Background()) {
		_ = manager.Delete(context.Background(), info.ID)
	}
	return err
}

func fuseOptions() livefs.MountOptions {
	o := livemainFuseDefaults
	o.Debug = os.Getenv("LIVEMAIN_FUSE_DEBUG") == "1"
	o.DirectIO = os.Getenv("LIVEMAIN_FUSE_DIRECTIO") == "1"
	if s := os.Getenv("LIVEMAIN_FUSE_TIMEOUT"); s != "" {
		if d, err := time.ParseDuration(s); err == nil {
			o.KernelTimeout = d
		} else {
			log.Printf("ignoring LIVEMAIN_FUSE_TIMEOUT=%q: %v", s, err)
		}
	}
	return o
}

var livemainFuseDefaults = livefs.MountOptions{}

func serveGit(args []string) error {
	fs := flag.NewFlagSet("serve-git", flag.ExitOnError)
	listen := fs.String("listen", ":8090", "listen address")
	root := fs.String("root", "/srv/git", "repository root")
	publicURL := fs.String("public-url", "http://gitserver:8090", "base URL used in returned remotes")
	_ = fs.Parse(args)
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	gs, err := gitserver.New(*root, *publicURL)
	if err != nil {
		return err
	}
	return listenAndServe(ctx, *listen, api.Wrap(gs.Handler()))
}

func listenAndServe(ctx context.Context, addr string, h http.Handler) error {
	server := &http.Server{Addr: addr, Handler: h, ReadHeaderTimeout: 10 * time.Second}
	errc := make(chan error, 1)
	go func() {
		log.Printf("listening on %s", addr)
		errc <- server.ListenAndServe()
	}()
	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	}
}
