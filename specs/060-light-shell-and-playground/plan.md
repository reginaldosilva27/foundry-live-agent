# Plan: A light shell, a theme switch, and one Playground

## Approach

Four slices, each red → green on its own, all in `frontend/`. The backend diff is empty.

**A — Removals.** The command palette goes whole: `CommandPalette`, `state/palette.ts`, the
`openPalette` binding and command, the rail button, its strings and tests. The History screen goes
with the export/import functions only it used (`toExportFile`, `parseExportFile`, `mergeImported`,
`RECORD_VERSION`). The stored shape and `load`/`useHistory` stay — the rail reads them.
`state/exportTurn.ts` is the per-turn Markdown download (spec 021) and **stays**.

**B — One Playground.** A route `{ name: 'playground', tab: 'agent' | 'tools' }` at `/playground`
and `/playground/tools`. `/compare`, `/tools` and `/history` still *parse*, to the Playground and to
Chat; they are no longer *formatted*, so the address bar settles on the canonical form.
The pane `Compare` becomes `PlaygroundAgent`: the definition panel on the left, then the existing
columns. The tool runner (`panes/Playground.tsx`) is renamed `ToolRunner` to free the name. The
definition panel reuses the blocks `AgentDetailScreen` already renders (instructions, tools,
reasoning, container — hosted agents included) by extracting them into one exported
`AgentDefinitionBlocks`; a second rendering would drift (§4).
`useComparison.send` learns a single-agent path: with no second agent it asks the left column
only. The second column appears only once a second agent is chosen.

**C — Light rail and the switch.** Rail tokens (`--bg-rail`, `--bg-rail-hover`, `--bg-rail-current`,
`--fg-rail`, `--fg-rail-muted`, `--border-rail`) declared light in the base `:root` and dark in
both dark blocks; `.sidebar` and its descendants name those instead of `--ds-ink` and
`--fg-on-inverse`. The `.sidebar *:focus-visible` override moves into the dark blocks. The default
theme becomes `light` in `DEFAULTS` and in the pre-paint script (`system` stored → no attribute).
A `ThemeToggle` in the rail footer calls the same `setPrefs` Preferences uses; from `system` it
resolves the current scheme through `matchMedia` (guarded for jsdom).

**D — The greeting.** `EmptyState` gains the agent chip, a time-of-day greeting from an injectable
clock, and the existing example cards restyled as a grid. Then the general visual pass (canvas,
composer elevation, pill primary), docs, and the browser check with `just demo`.

Alternatives refused: a second navigation for the Playground (two ways to compare would drift); a
form to edit instructions in the Playground (Foundry refuses per-request parameters beside an agent
reference; §4 refuses a saved copy).

## Affected files

- `src/state/route.ts` (+test) — `playground` route; legacy parses.
- `src/state/keys.ts` (+test), `src/hooks/useKeys.test.tsx`, `src/App.keyboard.test.tsx` — palette chord gone.
- `src/state/palette.ts`, `src/panes/CommandPalette.tsx` (+tests) — deleted.
- `src/panes/HistoryScreen.tsx` (+test) — deleted; `src/state/history.ts` (+test) loses export/import.
- `src/panes/Sidebar.tsx` (+test) — three screens, theme toggle, no palette/history/tools entries.
- `src/panes/Compare.tsx` → `src/panes/PlaygroundAgent.tsx`; `src/panes/Playground.tsx` → `ToolRunner.tsx`;
  new `src/panes/PlaygroundScreen.tsx` (tabs).
- `src/panes/AgentDetail.tsx` — extract `AgentDefinitionBlocks`.
- `src/hooks/useComparison.ts` (+test) — single-agent send.
- `src/panes/EmptyState.tsx` (+test) — chip, greeting, cards.
- `src/state/preferences.ts` (+test), `index.html` — light default.
- `src/components/Icon.tsx` — `SunIcon`, `MoonIcon`.
- `src/styles/app.css`, `src/styles/contrast.test.ts`, `src/styles/layout.test.ts` — rail tokens, visual pass.
- `src/i18n/strings.ts` — new keys, removed keys.
- `src/App.tsx` and the `App.*.test.tsx` / `a11y.test.tsx` suites that name removed screens.
- `CLAUDE.md`, `AGENTS.md`, `.claude`/`.codex` workflow mirrors, `specs/README.md`, README screenshot note.

## Contract / data model changes (constitution §4)

No wire change. `route.ts` remains the single definition of addresses; `preferences.ts` the single
owner of the theme; `app.css` the single token mapping; the vendored palette is untouched.
Existing browsers keep their stored history (shape unchanged); a stored theme is honoured as before.

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `nav.playground` | Playground | Playground |
| `playground.title` | Playground | Playground |
| `playground.lead` | Try an agent, see its definition beside the answers, and compare it with another. | Experimente um agente, veja a definição dele ao lado das respostas e compare com outro. |
| `playground.tab.agent` | Agent | Agente |
| `playground.tab.tools` | Tools | Ferramentas |
| `playground.toolsOff` | The tool runner is off in this deployment. | O executor de ferramentas está desligado nesta implantação. |
| `playground.definition` | Definition | Definição |
| `playground.readOnly` | Read-only — this is what Foundry reports. | Somente leitura — é o que o Foundry informa. |
| `playground.openDetail` | Open agent details | Abrir detalhes do agente |
| `compare.with` (reworded) | Compare with… | Comparar com… |
| `compare.pick` (reworded) | No comparison | Sem comparação |
| `theme.toDark` | Switch to dark theme | Mudar para tema escuro |
| `theme.toLight` | Switch to light theme | Mudar para tema claro |
| `greeting.morning` | Good morning. | Bom dia. |
| `greeting.afternoon` | Good afternoon. | Boa tarde. |
| `greeting.evening` | Good evening. | Boa noite. |
| `greeting.lead` | Ask the agent. It answers in Foundry, and this app shows how it got there. | Pergunte ao agente. Ele responde no Foundry, e este app mostra como chegou lá. |
| `history.conversations` | Conversations | Conversas |

Removed: `palette.*`, `keys.openPalette`, `nav.history`, `nav.compare`, `nav.tools`, `history.screen.*`, `compare.needsSecond`.

## Test strategy (constitution §2 — TDD)

| AC | Test | File |
|---|---|---|
| AC1 | rail tokens mapped per theme; rail pairs ≥ 4.5:1 in both palettes | `styles/layout.test.ts`, `styles/contrast.test.ts` |
| AC2 | toggle name/flip/persist; `system` resolves via matchMedia; default light + pre-paint | `panes/Sidebar.test.tsx`, `state/preferences.test.ts`, `brand.test.ts`/pre-paint test |
| AC3 | no Commands control; ⌘K does nothing | `App.keyboard.test.tsx`, `state/keys.test.ts` |
| AC4 | no History nav/screen; rail search/reopen unchanged | `panes/Sidebar.test.tsx`, `App.history.test.tsx` |
| AC5 | nav = Chat, Agents, Playground with aria-current | `panes/Sidebar.test.tsx` |
| AC6 | tablist, Tools renders runner, off state | `panes/PlaygroundScreen.test.tsx` |
| AC7 | read-only definition, no request, null vs "" | `panes/PlaygroundAgent.test.tsx` |
| AC8 | one post with three keys, separate conversation, no history write | `App.routing.test.tsx`, `hooks/useComparison.test.tsx` |
| AC9 | two posts, two conversations, no ranking | `hooks/useComparison.test.tsx`, `panes/PlaygroundAgent.test.tsx` |
| AC10 | legacy addresses parse to new routes | `state/route.test.ts` |
| AC11 | greeting by hour/lang, chip, cards send, none when empty | `panes/EmptyState.test.tsx` |
| AC12 | strings parity; a11y; layout; browser check recorded in tasks | `i18n` parity test, `a11y.test.tsx`, `layout.test.ts`, manual |

## Risks / trade-offs

- Removing export/import loses a capability some reader may use; recorded as deferred in the spec.
- The rail restyle touches many selectors; the contrast test on new rail pairs is the guard.
- Light default changes what an existing dark-OS reader with no stored choice sees — intended.
