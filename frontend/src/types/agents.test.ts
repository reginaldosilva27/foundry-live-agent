/**
 * The mirror of `GET /agents` and its backend source of truth move together (spec 019, §4).
 *
 * Reads the Python rather than a copy of it, like `contract-parity.test.ts` does: the same fact,
 * checkable in CI with no server standing up, failing on the commit that introduces the drift.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AgentRow } from './agents'

const AGENTS = join(import.meta.dirname, '../../../backend/app/agents.py')

/** The keys `AgentSummary.as_dict` actually emits — the response shape, not the dataclass's. */
function pythonKeys(source: string): string[] {
  const body = source.split('def as_dict(')[1]?.split('\n\n')[0] ?? ''
  return [...body.matchAll(/"([a-z_]+)":/g)].map((m) => m[1])
}

describe('the TypeScript mirror of the agents listing', () => {
  const source = readFileSync(AGENTS, 'utf8')

  it('covers exactly the fields the BFF sends', () => {
    const mirrored: Record<keyof AgentRow, true> = {
      name: true,
      kind: true,
      version: true,
      version_status: true,
      model: true,
      harness: true,
      selectable: true,
      reason: true,
    }
    expect(Object.keys(mirrored).sort()).toEqual(pythonKeys(source).sort())
  })

  it('translates every reason code the backend can put on a row', () => {
    // AC5 names three, and a row dimmed with no reason is what it forbids. If the backend grows a
    // fourth, this fails here rather than rendering an unexplained disabled row.
    const codes = [...source.matchAll(/^ {8}return "([a-z_]+)"$/gm)].map((m) => m[1])
    expect(codes.sort()).toEqual(['disabled', 'no_harness', 'version_not_active'])
  })
})
