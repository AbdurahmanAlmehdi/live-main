# git push through Live Main, provenance and approvals

Two features, both on the one API (`packages/api`) and both runtimes (local Node and the
Worker). Decisions (Oct 3, 2026): HTTPS pushes authenticate with personal git tokens; a push
onto an older main follows the same promotion rule as an agent; protected paths need a human
approval; people are identified by their Cloudflare Access email (deployed) or the configured
local user.

## G. The push gateway

`https://<host>/git/<owner>/<name>.git` is a smart-HTTP git remote in front of the repo's real
host (Artifacts, or the local git server).

- **Fetch and clone** (`info/refs?service=git-upload-pack`, `git-upload-pack`) proxy to the
  host with a read credential. Ref advertisement for pushes is proxied too.
- **Push** (`git-receive-pack`): the gateway parses the ref commands. Updates to branches other
  than `main` pass through unchanged. An update of `main` is rewritten to
  `refs/heads/push/<id>`, so the pack lands in the host without moving main; then the pushed
  commit is **promoted** like an agent's overlay:
  - its base is the client's old `main` sha (a Live Main version, else "fetch first");
  - changed files are computed from the host (base tree to pushed tree);
  - the coordinator applies the promotion rule against the base version: additive changes
    merge onto newer main automatically, conflicting ones are refused with the paths; impact
    tests run before landing; a failing impact test refuses the push with the failures;
  - on landing, agents that read or wrote the changed paths get notices, exactly as for an
    agent landing; `git push -o change-order` makes it a change order (interrupts readers).
  - the client gets a normal report-status, with `remote:` progress lines on side-band
    ("Live Main: landed as v23 · merged registry.ts · 2 agents notified").
- **Auth:** HTTP Basic with a personal git token (`lm_…`, shown once, stored as a SHA-256
  hash, per person, revocable) from Settings → Git tokens. On the deployed Worker `/git/*` is
  a separate Cloudflare Access application with a Bypass policy, and the Worker checks the
  token itself. Locally, tokens are checked the same way.
- The repo's clone URL becomes the gateway URL.

**SSH** is not possible on Workers directly (they accept only HTTP and WebSocket). It needs a
client-side helper as `ProxyCommand` that tunnels SSH over a WebSocket to an SSH endpoint in a
container; deferred until HTTPS pushes are done.

Limits: text files only in pushed changes (binary files refuse the push with a message);
history of a multi-commit push lands as one landing titled from the last commit.

## P. Provenance and approvals

- **Identity.** The Worker passes the verified Access email to the API (an internal header the
  Worker sets and strips from client requests); locally, the configured user.
- **Provenance** on every landing: the agent, its worker (provider/model), its swarm, the
  person who dispatched it (`delegatedBy`), and the policy applied (e.g. "protected path
  `src/core/**`, approved by lina@…"). Person pushes show the person and "via git push".
- **Policy:** per repo, a list of protected path globs (Settings tab).
- **Approvals:** an agent promotion touching a protected path does not land; it creates a
  pending approval and the agent waits (`awaiting-approval`). The web app shows an Approvals
  queue (task, agent, files, diff against main) with Approve and Reject; the decision is
  recorded with the person and time. Approve re-runs the promotion (still subject to the
  promotion rule and impact tests); Reject returns the reason to the agent. People's pushes
  are not held (they are the approvers).

## Order

1. G: coordinator promotion without an overlay; changed files from the host; gateway handler
   (pkt-lines, rewrite, report-status, side-band); tokens; Worker and local routes; web
   (tokens page, clone URL, person landings). Verify locally, then on the deployment.
2. P: identity header; provenance fields; policy and approvals in the coordinator and agent
   session; Approvals UI; landing provenance UI.

## Status (Oct 3, 2026)

**G done, verified locally with real git; deployed.** `packages/api/src/git-gateway.ts` (pkt-line
parsing, ref rewrite, report-status with side-band progress), `RepoService.git` and
`promotePush`, `Coordinator.promoteChange`, git tokens in `OrgService`, routes in both
runtimes (`/git/*` runs before Access on the Worker), Settings → Git tokens in the web app.
Two refinements found while testing:

- *No "fetch first".* git refuses a push when the remote `main` is a commit the client does not
  have, before Live Main ever sees it. The gateway advertises `main` to each person at the
  version they last fetched (recorded per person on every fetch), so a push made on an older
  main goes through and is merged by the promotion rule; without a record, main is omitted and
  the base is the newest main version in the pushed history.
- *Your commit lands as itself.* When nothing on main needs merging, the integrator lands the
  pushed commit (same tree, parent = head; `IntegrateRequest.prefer`), so the pusher's clone
  matches main. Otherwise main is a new commit with the change merged and the push output says
  to `git pull --rebase`.

Verified: clone through the gateway; push onto current main lands as the pushed commit; a push
that breaks a landed test is refused before landing with the failing assertion; a push based on
v28 while agents landed v29–v32 lands as v33 after 30 impact test files pass.

**P done, verified locally; deployed.** Approvals live in the coordinator (`approvals` table,
`approvalGate` before promotion, `decide`); agents wait up to 4 minutes per submit, re-checking
every 3 s, then report "not landed yet"; a rejection reaches the agent with the reviewer's note.
Policy is per repo (`settings` table, Settings → Protected paths). Provenance: swarms record
who dispatched them, agent landings carry `delegatedBy`, and approved landings carry the
approval. Web: an Approvals tab (diff of the protected files, approve or reject with a note),
provenance on landing and swarm pages. Verified with three agents on a protected
`src/core/registry.ts`: approve → landed as v46 with "approved by …"; reject → the agent gave
up with the note; the third waited until approved.

Not yet: notices to agents from a push are covered by tests but not seen live with scripted
agents (they publish read sets just before submitting, so the window is short); SSH.
