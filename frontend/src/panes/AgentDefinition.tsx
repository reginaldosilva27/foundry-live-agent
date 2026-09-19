/**
 * Propose a change to the agent (spec 041).
 *
 * The obvious feature is the one this project cannot have. Editing the instructions and saving
 * would be permitted by §8 — a person configuring an agent is configuring — and is refused by §4:
 * `agent_core.yaml` is the single source of truth for what the agent is, and it exists *because*
 * two copies of those instructions drifting a sentence at a time would make the repository's
 * central claim unfalsifiable.
 *
 * So the file stays the truth and this is a better editor **of the file**. You edit; you get a
 * diff. **Nothing here says saved**, because nothing was — a test asserts that over the strings.
 *
 * Instructions only. Tools are where a bad edit breaks a harness silently, and the model's shape
 * decides whether inference routes through the gateway.
 */
import { useState } from 'react'
import { useT } from '../i18n/context'
import { BFF_URL } from '../config'

export interface Definition {
  path: string
  yaml: string
  instructions: string
  served_instructions: string | null
  drifted: boolean
  shared_with: string[]
}

interface Props {
  agent: string
  definition: Definition
  /** Injected so the test can assert exactly what was requested, and that nothing else was. */
  bffUrl?: string
}

export function AgentDefinition({ agent, definition, bffUrl = BFF_URL }: Props) {
  const s = useT()
  const [instructions, setInstructions] = useState(definition.instructions)
  const [result, setResult] = useState<{ ok: boolean; diff: string; yaml: string; error: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const changed = instructions.trim() !== definition.instructions.trim()

  async function produce() {
    setBusy(true)
    try {
      // A proposal, and the route's name says so. It validates and answers a diff; it writes
      // neither the file nor Foundry.
      const response = await fetch(
        `${bffUrl}/agents/${encodeURIComponent(agent)}/definition/proposal`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instructions }),
        },
      )
      setResult(await response.json())
    } catch {
      setResult({ ok: false, diff: '', yaml: '', error: 'unavailable' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="propose" data-testid="propose">
      <h3 className="propose__title">{s('propose.title')}</h3>

      {/* Not "the repository" and not `main`: in a container the files are whatever was baked in. */}
      <p className="propose__note">{s('propose.fromThisBuild')}</p>
      <p className="propose__path">{definition.path}</p>

      {definition.shared_with.length > 1 && (
        <p className="propose__shared" data-testid="propose-shared">
          {s('propose.sharedWith').replace('{agents}', definition.shared_with.join(', '))}
        </p>
      )}

      {/* Arguably the most useful thing on the screen, and it is said before any editing. */}
      {definition.served_instructions !== null && (
        <p className={definition.drifted ? 'propose__drift' : 'propose__ok'} data-testid="propose-drift">
          {s(definition.drifted ? 'propose.drift' : 'propose.noDrift')}
        </p>
      )}

      <label className="propose__field">
        <span>{s('propose.instructions')}</span>
        <textarea
          value={instructions}
          rows={16}
          onChange={(event) => setInstructions(event.target.value)}
        />
      </label>

      <button type="button" className="propose__produce" disabled={!changed || busy} onClick={produce}>
        {s('propose.produce')}
      </button>
      {!changed && <p className="propose__note">{s('propose.unchanged')}</p>}

      {result && !result.ok && (
        <p className="propose__invalid" role="alert">
          {s('propose.invalid').replace('{error}', result.error)}
        </p>
      )}

      {result?.ok && (
        <div className="propose__result">
          <h4>{s('propose.diff')}</h4>
          <pre data-testid="propose-diff">{result.diff}</pre>
          {/* The wording a reader leaves with. Nothing changed; here is what still has to. */}
          <p className="propose__remaining" data-testid="propose-remaining">
            {s('propose.remaining')}
          </p>
          <p className="propose__actions">
            <a
              className="propose__download"
              download={definition.path.split('/').pop()}
              href={`data:text/yaml;charset=utf-8,${encodeURIComponent(result.yaml)}`}
            >
              {s('propose.download')}
            </a>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(result.diff)}
            >
              {s('propose.copyPatch')}
            </button>
          </p>
        </div>
      )}
    </section>
  )
}
