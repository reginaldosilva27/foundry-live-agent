/**
 * The agent's instructions and this renderer describe the same schema (spec 033, AC10).
 *
 * `ai/harness/_shared/agent_core.yaml` is where the agent is told how to write a chart block, and
 * it is shared by both harnesses — that file exists precisely so the two cannot drift (spec 018).
 * This closes the other half of the loop: the **examples in those instructions are the fixtures**,
 * parsed here by the renderer's own parser. An instruction edited to describe a field the parser
 * does not accept fails in CI, on the commit that introduces it.
 *
 * What this does NOT prove is that the model then follows them. That needs a credential this
 * machine does not have, and §5 forbids hand-writing a recording to stand in for one — it is an
 * open item in `docs/REFERENCES.md`, closed by one real turn.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHART_TYPES, MAX_SERIES, parseChart } from './chart'

const AGENT_CORE = join(
  import.meta.dirname,
  '../../../ai/harness/_shared/agent_core.yaml',
)
const source = readFileSync(AGENT_CORE, 'utf8')

/** Every `foundry-chart` fence in the instructions, with the YAML block indent stripped. */
function examples(yaml: string): string[] {
  const found: string[] = []
  const lines = yaml.split('\n')
  let body: string[] | null = null
  let indent = 0

  for (const line of lines) {
    const open = line.match(/^(\s*)```foundry-chart\s*$/)
    if (open && body === null) {
      indent = open[1].length
      body = []
      continue
    }
    if (body !== null && /^\s*```\s*$/.test(line)) {
      found.push(body.join('\n'))
      body = null
      continue
    }
    if (body !== null) body.push(line.slice(indent))
  }
  return found
}

describe('the instructions and the parser agree', () => {
  const blocks = examples(source)

  it('the instructions carry worked examples at all', () => {
    // Without this, every assertion below would pass over an empty list and prove nothing.
    expect(blocks.length).toBeGreaterThanOrEqual(2)
  })

  it('every example parses', () => {
    for (const block of blocks) {
      const result = parseChart(block)
      expect(result.ok, `this example in agent_core.yaml does not parse: ${block}`).toBe(true)
    }
  })

  it('the examples cover every type in the closed set', () => {
    const types = blocks.flatMap((block) => {
      const result = parseChart(block)
      return result.ok ? [result.spec.type] : []
    })
    expect([...new Set(types)].sort()).toEqual([...CHART_TYPES].sort())
  })

  it('the instructions name the fence the renderer actually listens for', () => {
    expect(source).toContain('foundry-chart')
  })

  it('the instructions state the series cap the parser enforces', () => {
    // The cap is not arbitrary — the palette was validated for four. An agent told a different
    // number would write blocks that cannot draw, and would have no way to know why.
    expect(source).toMatch(new RegExp(`\\b${MAX_SERIES}\\b`))
  })

  it('the instructions do not promise a chart type the parser refuses', () => {
    // `pie` is the one a model reaches for unprompted, so the instructions must not encourage it.
    const instructions = source.split('instructions: |')[1]?.split('\ntools:')[0] ?? ''
    expect(instructions).not.toMatch(/"type":\s*"pie"/)
  })
})
