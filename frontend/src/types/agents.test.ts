/**
 * The mirror of `GET /agents` and its backend source of truth move together (spec 019, §4).
 *
 * Reads the Python rather than a copy of it, like `contract-parity.test.ts` does: the same fact,
 * checkable in CI with no server standing up, failing on the commit that introduces the drift.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AgentContainer, AgentDetail, AgentRow, AgentTool, AgentVersion } from './agents'

const AGENTS = join(import.meta.dirname, '../../../backend/app/agents.py')

/** The keys a dataclass's `as_dict` actually emits — the response shape, not the dataclass's. */
function pythonKeys(source: string, className = 'AgentSummary'): string[] {
  const after = source.split(`class ${className}:`)[1] ?? ''
  const body = after.split('def as_dict(')[1]?.split('\n\n')[0] ?? ''
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

  it('covers exactly the fields the detail sends, including the row it extends (spec 030)', () => {
    const mirrored: Record<keyof AgentDetail, true> = {
      name: true,
      kind: true,
      version: true,
      version_status: true,
      model: true,
      harness: true,
      selectable: true,
      reason: true,
      instructions: true,
      tools: true,
      reasoning: true,
      container: true,
      served_version: true,
      latest_version: true,
      pinned: true,
      versions: true,
    }
    // `AgentDetail.as_dict` spreads the summary's, so the expected set is both.
    const expected = [...pythonKeys(source, 'AgentDetail'), ...pythonKeys(source)]
    expect(Object.keys(mirrored).sort()).toEqual(expected.sort())
  })

  it('covers exactly the fields a tool sends', () => {
    const mirrored: Record<keyof AgentTool, true> = {
      kind: true,
      name: true,
      executor: true,
      description: true,
      parameters: true,
      server_label: true,
      server_url: true,
      require_approval: true,
    }
    expect(Object.keys(mirrored).sort()).toEqual(pythonKeys(source, 'ToolInfo').sort())
  })

  it('covers exactly the fields a container sends, and no environment (AC11)', () => {
    const mirrored: Record<keyof AgentContainer, true> = {
      image: true,
      cpu: true,
      memory: true,
      protocols: true,
    }
    const keys = pythonKeys(source, 'ContainerInfo')

    expect(Object.keys(mirrored).sort()).toEqual(keys.sort())
    expect(keys).not.toContain('environment_variables')
  })

  it('covers exactly the fields a version sends (spec 031)', () => {
    const mirrored: Record<keyof AgentVersion, true> = {
      version: true,
      status: true,
      created_at: true,
      model: true,
      served: true,
      promotable: true,
      promote_reason: true,
    }
    expect(Object.keys(mirrored).sort()).toEqual(pythonKeys(source, 'AgentVersion').sort())
  })

  it('translates every reason code the backend can put on a row', () => {
    // AC5 names three, and a row dimmed with no reason is what it forbids. If the backend grows a
    // fourth, this fails here rather than rendering an unexplained disabled row.
    //
    // Scoped to `_reason` since spec 031: `_promote_code` also returns codes at this indentation,
    // and they belong to a different vocabulary — a failed write, not an unselectable row.
    const reason = source.split('def _reason(')[1]?.split('\ndef ')[0] ?? ''
    const codes = [...reason.matchAll(/^ {8}return "([a-z_]+)"$/gm)].map((m) => m[1])
    expect(codes.sort()).toEqual(['disabled', 'no_harness', 'version_not_active'])
  })

  it('translates every promote code the backend can put on a version (spec 031)', () => {
    // The same guard for the new vocabulary: a version that cannot be promoted must say why, and
    // a code the UI has no string for would render as an unexplained missing control.
    const source031 = readFileSync(AGENTS, 'utf8')
    const block = source031.split('def versions_of(')[1]?.split('\ndef ')[0] ?? ''
    const codes = new Set([...block.matchAll(/"(not_owned|served)"/g)].map((m) => m[1]))
    expect([...codes].sort()).toEqual(['not_owned', 'served'])
  })
})
