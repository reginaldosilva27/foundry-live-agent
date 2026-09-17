# Plan: Addressable — the app gets URLs

> The HOW. Written after `spec.md` is `clarified`.

## Approach

**Hand-rolled, not a dependency.** The scheme is four routes with one parameter each and no nesting,
no loaders, no layouts. `react-router` is ~20 kB for a `switch` statement, and the spec's §8
requirement — that the URL stays a projection and never becomes a way to load data — is easier to
hold when there is no loader API inviting the opposite. The whole router is a parse function, a build
function and a hook over `popstate`.

```
Route =
  | { view: 'chat' }                                 /
  | { view: 'agents' }                               /agents
  | { view: 'chat'; conversationId: string }         /c/<id>
  | { view: 'trace'; responseId: string }            /trace/<response_id>
```

`/compare` is reserved: it parses to a route the app does not yet render, and renders as the chat.
It is a one-line entry so spec 020 does not have to redesign the scheme.

**The direction of flow is the design decision.** Today `App` holds `view`, `activeId`, `tracesOpen`
and `trace.turnId` as state. Making the URL a *second* home for those would be exactly the
duplication §4 is about. So:

- The route is **parsed into** the app's existing state on load and on `popstate`. It is an input.
- Navigating — choosing an agent, opening a conversation, opening the trace panel — calls
  `navigate(route)`, which pushes the address. It is an output.
- Nothing reads the URL to make a decision during a render. `conversation_id` still comes from this
  browser's record, the selected agent still comes from the agents state (AC8).

**The trace route is the interesting one**, because it must work for a reader who does not have the
conversation. Today `useTrace` is fed `shownTurn.turn.trace?.responseId` — a response id derived from
a message in memory. The route supplies a response id with no message behind it. `TraceDrawer`
already takes `turn?: Turn` as optional, so the panel renders its identifiers and its spans and
simply has no calls to list. The app adds one line of state: a response id that came from the URL,
used when no turn matches it, and the screen says the conversation is not stored here (AC6).

**An unresolvable `/c/<id>`** renders the chat with a notice (AC7). It does not redirect, because
redirecting would rewrite the reader's address bar and lose the evidence of what they opened.

**Deployment.** History API needs the host to serve `index.html` for unknown paths. Vite's dev
server already does. There is no production host in this repository — `infra/` is a stub with no
`main.bicep` and the `justfile` has no frontend deploy — so under §5 the requirement is written down
as a manual step rather than shipped as unverified IaC: `infra/README.md` gains it.

**Rejected:** a router dependency (above); hash routing (spec's clarified decisions); putting the
trace panel's turn index in the URL (same); a route that carries the agent or the conversation id as
a query parameter, which would make a link a way to configure someone else's app (spec non-goal).

## Affected files

- `frontend/src/state/route.ts` — **new.** `parseRoute(pathname)`, `buildPath(route)`, the `Route`
  union. Pure, and the single source of truth for the scheme (§4).
- `frontend/src/hooks/useRoute.ts` — **new.** Current route + `navigate`; subscribes to `popstate`.
- `frontend/src/App.tsx` — derives `view` / `activeId` / trace target from the route; calls
  `navigate` where it currently only sets state; holds the response id that came from the URL.
- `frontend/src/panes/TraceDrawer.tsx` — renders for a response id with no turn behind it, and says
  the conversation is not on this machine.
- `frontend/src/panes/Conversation.tsx` — the "conversation not found" notice for AC7.
- `frontend/src/i18n/strings.ts` — the two new strings below.
- `frontend/src/hooks/useTrace.ts` — accepts a response id from either source (no logic change
  expected; confirmed by test).
- `infra/README.md` — the SPA rewrite requirement for whoever builds the deployment.
- `docs/architecture.md` — the route table.

## Contract / data model changes (constitution §4)

**No BFF change.** No endpoint, no request field, no event (§9).

**The URL scheme is new public surface.** `state/route.ts` owns it. Every link in the app is built
through `buildPath` — no component concatenates a path — so the scheme has one definition and one
place to change. A test asserts the round trip `parseRoute(buildPath(r)) === r` for every variant,
which is what keeps the two halves from drifting.

**§8 guard.** A test asserts that `POST /chat`'s body is still exactly `message · conversation_id ·
agent` after navigation (spec 021's existing test, extended to run after a route change), and that
no route value reaches the request.

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `route.conversationMissing` | This browser does not have that conversation. | Este navegador não tem essa conversa. |
| `trace.conversationElsewhere` | The spans are here; the conversation is not stored in this browser. | Os spans estão aqui; a conversa não está guardada neste navegador. |

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | each address parses, and the app renders that view at it | `state/route.test.ts` (new), `App.routing.test.tsx` (new) |
| AC2 | navigating pushes the address without a reload | `App.routing.test.tsx` |
| AC3 | `popstate` returns to the previous view | `App.routing.test.tsx` |
| AC4 | `/c/<id>` restores messages, `conversation_id` and agent, identical to the rail | `App.routing.test.tsx` |
| AC5 | `/trace/<response_id>` opens the panel on that response | `App.routing.test.tsx` |
| AC6 | a response id with no stored turn still opens and requests spans; the notice renders | `App.routing.test.tsx`, `panes/TraceDrawer.test.tsx` |
| AC7 | an unknown `/c/<id>` renders chat + notice, does not redirect, creates nothing | `App.routing.test.tsx` |
| AC8 | after navigation `POST /chat` still carries exactly three fields | `App.test.tsx` (existing, extended) |
| AC9 | en + pt for the new keys | `i18n/strings.test.ts` (existing) |
| — (plan) | `parseRoute(buildPath(r))` round-trips every variant, `/compare` included | `state/route.test.ts` |
| — (plan) | no component builds a path by concatenation | `state/route.test.ts` (source scan, like `brand.test.ts`) |

## Risks / trade-offs

- **Deep links 404 on a host that does not rewrite.** Unavoidable with History API, and the
  deployment does not exist yet. Documented in `infra/README.md` rather than guessed at in Bicep
  (§5).
- **`App.tsx` grows.** It already coordinates seven pieces of state; a route makes eight. If the
  component becomes unreadable the extraction is a separate, behaviour-preserving change — not
  smuggled into this one.
- **jsdom and History.** `pushState` and `popstate` work in jsdom, but `popstate` is not fired by
  `pushState` itself; tests must dispatch it, which is the real browser's behaviour too.
- **A trace link is only as shareable as the workspace.** Someone without access to Application
  Insights gets the panel and an unavailable trace. That is correct and worth stating: the link
  carries an identifier, not a grant.
