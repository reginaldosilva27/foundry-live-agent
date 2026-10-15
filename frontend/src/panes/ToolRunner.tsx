/**
 * Run one function tool, on purpose (spec 042).
 *
 * The three function tools are where this project's central lesson lives: Foundry emits a function
 * call and **our BFF executes it**. Until now the only way to see one was to phrase a question that
 * persuaded the model to call it, and hope — a bad way to learn a tool and a worse way to debug one.
 *
 * **The §8 argument is about who chose.** §8 forbids the *app* choosing which tool to call. A person
 * typing arguments and pressing run has chosen, exactly as a person choosing which agent answers is
 * configuration and not a loop (spec 019). What makes it safe is that it is visibly outside the
 * conversation, which is why that is the first sentence on the screen rather than a disclaimer.
 *
 * **Arguments are a raw JSON field, not a generated form.** A form would be a second description of
 * the schema (§4) and would hide the shape of the thing being taught: `arguments` arrives as a
 * string, and that is part of what a function call *is*.
 */
import { useState } from 'react'
import { useT } from '../i18n/context'
import { BFF_URL } from '../config'

export interface ToolSpec {
  name: string
  description: string
  schema: Record<string, unknown>
}

export interface RunResult {
  output: string
  duration_ms: number
  error: string
}

interface Props {
  tools: ToolSpec[]
  status?: 'loading' | 'ready' | 'failed'
  bffUrl?: string
}

export function ToolRunner({ tools, status = 'ready', bffUrl = BFF_URL }: Props) {
  const s = useT()
  const [selected, setSelected] = useState(tools[0]?.name ?? '')
  const [args, setArgs] = useState('{}')
  const [result, setResult] = useState<RunResult | null>(null)
  const [busy, setBusy] = useState(false)

  const tool = tools.find((candidate) => candidate.name === selected) ?? tools[0]
  if (tool && tool.name !== selected) setSelected(tool.name)

  async function run() {
    if (!tool) return
    setBusy(true)
    setResult(null)
    try {
      const response = await fetch(`${bffUrl}/tools/${encodeURIComponent(tool.name)}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arguments: args }),
      })
      setResult((await response.json()) as RunResult)
    } catch {
      setResult({ output: '', duration_ms: 0, error: 'unavailable' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="playground" aria-label={s('tools.title')}>
      <h2 className="playground__title">{s('tools.title')}</h2>
      {/* The framing, not a footnote: this is what makes the screen legal under §8. */}
      <p className="playground__lead">{s('tools.lead')}</p>

      {status === 'loading' && <p role="status">{s('tools.loading')}</p>}
      {status === 'failed' && <p role="alert">{s('tools.listFailed')}</p>}
      {status === 'ready' && tools.length === 0 && <p>{s('tools.empty')}</p>}

      {status === 'ready' && <div className="playground__tools" role="group">
        {tools.map((candidate) => (
          <button
            key={candidate.name}
            type="button"
            aria-pressed={candidate.name === selected}
            onClick={() => {
              setSelected(candidate.name)
              setResult(null)
            }}
          >
            {candidate.name}
          </button>
        ))}
      </div>}

      {status === 'ready' && tool && (
        <>
          <p className="playground__description">{tool.description}</p>

          <div className="playground__panes">
            <div>
              <h3 className="playground__subtitle">{s('tools.schema')}</h3>
              {/* The same document Foundry is given at `create_version` time. */}
              <pre data-testid="tool-schema">{JSON.stringify(tool.schema, null, 2)}</pre>
            </div>
            <label className="playground__field">
              <span className="playground__subtitle">{s('tools.arguments')}</span>
              <textarea
                value={args}
                rows={10}
                spellCheck={false}
                onChange={(event) => setArgs(event.target.value)}
              />
            </label>
          </div>

          <button type="button" className="playground__run" disabled={busy} onClick={run}>
            {busy ? s('tools.running') : s('tools.run')}
          </button>
        </>
      )}

      {result && (
        <section className="playground__result">
          <h3 className="playground__subtitle">
            {s('tools.output')}
            <span className="playground__duration">
              {s('tools.duration').replace('{ms}', String(result.duration_ms))}
            </span>
          </h3>
          {/* A tool that answered `search_unavailable` did not fail — that is its documented
              answer, and the most instructive case this screen has. Only a refusal or a transport
              failure is an error here. */}
          {result.error ? (
            <p className="playground__invalid" role="alert">
              {s(result.error === 'unavailable' ? 'tools.unavailable' : 'tools.invalid').replace(
                '{error}',
                result.error,
              )}
            </p>
          ) : (
            <>
              <pre data-testid="tool-output">{result.output}</pre>
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(result.output)}
              >
                {s('tools.copyOutput')}
              </button>
            </>
          )}
        </section>
      )}
    </section>
  )
}
