# Accounts, orgs and agent identities

Decided: sign in with GitHub or an email link; personal accounts plus orgs with roles; one
implementation for both runtimes (local mode signs you in automatically through the same code).

Framing: Live Main is meant to replace GitHub in a world where AI agents write and maintain
most software. So the account model has two kinds of actors from day one: **people** and
**agents**. Agents are not users borrowing a person's token. Every landing records which agent
made it, on whose authority (the person or automation that dispatched it), under which
policy, and on whose budget.

## 1. Model

| Entity | Notes |
|---|---|
| **User** | a person: name, avatar, verified emails |
| **Identity** | a way to sign in: GitHub (user id) or email; a user can have several |
| **Org** | owns repos, keys, budgets and policies. Every user gets a personal org (`/lina`); teams create more (`/acme`) |
| **Membership** | user × org × role: owner, admin, member, viewer |
| **Agent identity** | `agent:<swarm>/<slot>`, minted per agent run, acting under a **delegation** from the dispatcher; can only read the repo and land through the promotion rule |
| **Automation** | a named non-human principal for schedules, CI and external agents (Claude Code over MCP); has its own scoped tokens, never a person's |
| **Token** | personal access tokens, automation tokens, CLI device-flow tokens: random, shown once, stored as SHA-256 hashes, with scopes, expiry and last-used |
| **Session** | browser sessions: hashed id, rotated at sign-in, idle 14 days, absolute 30 days, listable and revocable |
| **Policy** | per org/repo: who may dispatch, per-member spend caps, paths or change orders that need human approval |
| **Audit log** | sign-ins, tokens, members, keys, policies, dispatches, landings |

Landings gain provenance: `{ agent, delegatedBy, policy, swarm, worker (provider/model) }`,
shown on the landing page and returned by the API.

## 2. Sign-in flows

- **GitHub**: a GitHub App with user authorization (the same App later imports and mirrors
  repos). OAuth with PKCE and a signed state cookie; on callback, read the user and their
  verified emails, then sign in, link, or create.
- **Email link**: enter an email → a single-use 15-minute token (hashed at rest) is mailed.
  The link opens a confirm page that POSTs, so email security scanners that prefetch links
  cannot spend it. Responses never reveal whether an account exists. Rate-limited by email and IP.
- **Linking**: identities with the same *verified* email link automatically; otherwise from
  Settings while signed in.
- **CLI (`lm auth login`)**: device authorization flow: the CLI shows a code, the person
  approves it in the browser, the CLI receives a scoped token and keeps it in the OS keychain.
- **git over HTTPS**: `lm auth git-credential` as a git credential helper; pushes go through
  the push gateway (`docs/cloudflare-port.md` §6) under the pusher's identity.
- **External agents (MCP)**: OAuth 2.1 for remote MCP (Claude Code, claude.ai connectors):
  the person authorizes an *automation* for one org with chosen scopes; the agent never holds
  a personal token.

## 3. Authorization

One middleware resolves the principal (session cookie or bearer token), the org from the
route, the role from the membership, and checks the route's permission and the token's
scopes. Every service call receives this context, and the service only trusts that.

| Permission | viewer | member | admin | owner |
|---|---|---|---|---|
| read repos, landings, swarms, agents | ✓ | ✓ | ✓ | ✓ |
| create tasks, dispatch within own spend cap, stop own swarms | | ✓ | ✓ | ✓ |
| create/delete repos, keys, budgets, policies, stop any swarm | | | ✓ | ✓ |
| members, billing, delete or transfer the org | | | | ✓ |

Token scopes narrow further: `repo:read`, `repo:write`, `swarm:dispatch`, `keys:write`,
`org:admin`. Agent identities get `repo:read` plus land-through-promotion on one repo only.
Repositories are private at launch.

Model keys and budgets move from the installation to the org: each org has its own data key,
sealed by the platform key-encryption key, and a monthly spend cap above per-swarm caps.

## 4. Storage

- **Cloudflare**: D1 for the directory (users, identities, sessions, tokens, orgs,
  memberships, invites), which needs global lookups by email, token and slug; `OrgDO` for
  org-scoped data (keys, budgets, policies, audit log). Session lookups are cached in the
  Worker for a few seconds.
- **Local**: the same schema in SQLite. The account store is an async interface (D1 is
  async), with both implementations under one test suite.

## 5. Security details

`__Host-` cookies (HttpOnly, Secure, SameSite=Lax); state-changing requests from cookies
need a matching `Origin`; bearer tokens are exempt. Tokens and email codes are compared as
hashes; sign-in endpoints are rate-limited; new sign-ins rotate the session; "sign out
everywhere" revokes all sessions and tokens; account deletion and data export exist from the
first release.

## 6. Interface

Sign-in page (GitHub button, email field); an org switcher in the global bar; per org:
Members (invite by GitHub login or email, roles), Tokens and Automations, Policies and
budgets; per user: Sessions, Identities, Personal tokens. Landing and agent pages show
provenance (agent, on whose authority, policy). The design system covers all the parts;
these screens get a short design brief first.

## 7. Phases

| Phase | Work | Gate | Size |
|---|---|---|---|
| A1 | Principal + org context through every API call; local auto-principal; repos, keys and budgets scoped to orgs | all tests pass with two orgs isolated from each other | M |
| A2 | Users, identities, sessions, email link, GitHub sign-in; sign-in UI; org switcher | a second person signs in with email, sees nothing of the first person's org until invited | M |
| A3 | Memberships, invites, roles, permission middleware, audit log | permission matrix covered by tests; every write appears in the audit log | M |
| A4 | Tokens: PATs, device flow, git credential helper, automations, MCP OAuth | `lm` signs in by device flow; Claude Code connects as an automation with repo scope only | M |
| A5 | Agent identities and delegation, provenance on landings, policies (approval-required paths, per-member caps) | a landing shows agent, dispatcher and policy; a protected path waits for a human approval | M |

A1 and C1 of the Cloudflare port (splitting the service into org and repo parts) both reshape
the API around orgs; do them together, locally, before any Cloudflare work.

## 8. Open decisions

1. Email sender: Cloudflare Email Service or a provider such as Resend.
2. Approval policies at launch: optional per path, or required for change orders by default.
3. Plans and billing: container-minute quotas and seats per org (schema slot reserved, no UI).
