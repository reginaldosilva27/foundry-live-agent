/**
 * Spec 004, "Contract / data impact" — this mirror and `ai/harness/_shared/contract.py` move
 * together (§9).
 *
 * The Python module is the source of truth, so the test reads it rather than a copy of it. Reading
 * the file instead of calling `GET /config` is deliberate: the same fact, checkable in CI without
 * standing a server up, and it fails on the commit that introduces the drift rather than on the
 * next deployment.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EVENT_TYPES } from './events'

const CONTRACT = join(import.meta.dirname, '../../../ai/harness/_shared/contract.py')

function pythonSchemaKeys(source: string): string[] {
  const schema = source.split('_SCHEMA: dict[')[1]?.split('\nEVENT_TYPES')[0] ?? ''
  return [...schema.matchAll(/^ {4}"([a-z_]+)":/gm)].map((m) => m[1])
}

describe('the TypeScript mirror of the harness contract', () => {
  const source = readFileSync(CONTRACT, 'utf8')

  it('covers exactly the event types the contract defines', () => {
    expect([...EVENT_TYPES].sort()).toEqual(pythonSchemaKeys(source).sort())
  })

  it('covers exactly the executors the contract allows', () => {
    const allowed = source
      .split('_ENUMS: dict[')[1]
      .split('\n\n')[0]
      .match(/frozenset\(\{([^}]*)\}\)/)![1]
      .match(/"([a-z]+)"/g)!
      .map((s) => s.replaceAll('"', ''))
    expect(allowed.sort()).toEqual(['app', 'foundry'])
  })
})
