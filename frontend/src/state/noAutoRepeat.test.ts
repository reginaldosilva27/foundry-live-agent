/**
 * Spec 026 AC9 — the app never asks again on its own.
 *
 * Repeat looks like the thing constitution §8 forbids and is not: §8 is about the *app* deciding —
 * re-prompting, looping on model output, choosing what to send next. A person pressing **repeat**
 * is a person asking again, and the app carries the message it is given.
 *
 * The line that must not be crossed is automatic retry: the app deciding, on its own, that an answer
 * was bad enough to ask again. That is a permanent non-goal, so it gets a permanent test.
 *
 * **What this proves and what it does not.** It cannot establish the absence of automatic sending in
 * general. It fails loudly when someone adds the obvious version of it — a send reached from a
 * turn's completion, its failure, or its emptiness — which is the one regression this spec must not
 * allow. A green run here is not a proof; it is a tripwire, and it is written down as one (§5).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Places a send would be wired to if somebody built retry-on-failure. */
const AUTOMATIC = [
  /\berror\b[^\n]{0,80}\bsend\s*\(/i,
  /\bfail(ed|ure)?\b[^\n]{0,80}\bsend\s*\(/i,
  /\bstatus\s*===\s*'(done|error|stopped)'[^\n]{0,80}\bsend\s*\(/,
  /\bretry\w*\s*\([^)]*\)\s*(=>|\{)[^\n]{0,80}\bsend\s*\(/i,
  /useEffect\([^\n]*\n?[^\n]{0,40}\bsend\s*\(/,
]

describe('nothing asks again on its own (§8)', () => {
  const files = sources()

  it('has sources to scan, so a passing run means something', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('reaches no send from a turn ending, failing, or coming back empty', () => {
    const offenders = files.flatMap(([path, text]) =>
      AUTOMATIC.filter((pattern) => pattern.test(text)).map(
        (pattern) => `${path} matched ${pattern}`,
      ),
    )

    expect(offenders).toEqual([])
  })

  /**
   * A closed list, rather than a regex pretending to do reachability analysis.
   *
   * The first attempt matched `return send(` inside `sendToSelected` — the composer's own handler,
   * which is exactly what is supposed to call it. A guard that false-positives on correct code gets
   * weakened by the next person who trips it, which makes it worse than no guard. This one names
   * the files allowed to start a turn: adding a `send` anywhere else fails, and adding one *here*
   * is a change a reviewer sees.
   */
  it('starts a turn from nowhere but the composer, the palette and the repeat control', () => {
    const allowed = [
      'App.tsx',
      'hooks/useAgentStream.ts',
      // Spec 020. Both are a person's send, carried: `Compare` hands the composer's text to
      // `useComparison`, which posts it to the two agents a person chose. Neither reads an answer,
      // and in particular neither compares the two — which is the §8 line this feature sits
      // closest to, and why the pair is named here rather than the guard being loosened.
      'hooks/useComparison.ts',
      'panes/Compare.tsx',
    ]
    const callers = files
      .filter(([, text]) => /\bsend\s*\(/.test(text))
      .map(([path]) => path)
      .filter((path) => !allowed.includes(path))

    expect(callers).toEqual([])
  })
})

function sources(): [string, string][] {
  const root = join(import.meta.dirname, '..')
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry)
      return statSync(path).isDirectory() ? walk(path) : [path]
    })

  return walk(root)
    .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
    .map((path) => [path.slice(root.length + 1), readFileSync(path, 'utf8')])
}
