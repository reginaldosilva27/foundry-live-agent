/**
 * Spec 032, AC1 — the panel renders **every** field `GET /config` returns.
 *
 * That is the kind of criterion that rots silently. Spec 031 added `agents.can_promote` to the
 * config three days before this panel was written, and nothing would have noticed if the order had
 * been the other way round: the field would simply not have appeared, and no test would have said so.
 *
 * So the panel declares what it covers and this reads the BFF's own response shape, the same way
 * `types/agents.test.ts` keeps the agents mirror honest (§4). Adding a key to `GET /config` now
 * fails **here**, naming the field.
 *
 * Scope is deliberately the **top-level keys**. That is the granularity a reader adds a field at,
 * and it is what a regex over Python can read without pretending to be a parser.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COVERED_CONFIG_KEYS } from './aboutFields'

const CONFIG_PY = join(import.meta.dirname, '../../../backend/app/routers/config.py')

/**
 * The keys the route actually puts in its response.
 *
 * `body = {...}` holds the unconditional ones; the conditional ones are assigned as
 * `body["name"] = ...` further down, which is how `pricing` arrives.
 */
function configKeys(source: string): string[] {
  const literal = source.split('body = {')[1]?.split('\n    }')[0] ?? ''
  const inLiteral = [...literal.matchAll(/^\s{8}"([a-z_]+)":/gm)].map((m) => m[1])
  const assigned = [...source.matchAll(/^\s+body\["([a-z_]+)"\]\s*=/gm)].map((m) => m[1])
  return [...new Set([...inLiteral, ...assigned])]
}

describe('the panel covers what the BFF sends (AC1)', () => {
  const keys = configKeys(readFileSync(CONFIG_PY, 'utf8'))

  it('found the response shape at all, so a rewrite of the route cannot silently pass', () => {
    expect(keys.length).toBeGreaterThan(8)
    expect(keys).toContain('event_mapping')
    // The field spec 031 added, and the reason this test exists.
    expect(keys).toContain('agents')
  })

  it('renders every field the config returns', () => {
    const missing = keys.filter((key) => !COVERED_CONFIG_KEYS.includes(key as never))
    expect(missing, `GET /config sends these and the panel does not render them: ${missing}`).toEqual(
      [],
    )
  })

  it('claims to cover nothing the config does not send', () => {
    const invented = COVERED_CONFIG_KEYS.filter((key) => !keys.includes(key))
    expect(invented, `the panel lists fields GET /config never sends: ${invented}`).toEqual([])
  })
})
