/**
 * The one way this app compares a query to a label (spec 027).
 *
 * It was born inside `palette.ts` and moved here the moment history search needed the same rule:
 * two foldings that disagreed would be a bug nobody could explain — a conversation the palette
 * finds and the rail does not.
 *
 * Accent folding is not a nicety in a `pt` interface: a reader typing `conversacao` must find
 * `Conversação`, and typing `agentés` must find `Agentes`. `normalize('NFD')` plus stripping the
 * combining marks is the right tool for Portuguese specifically — it is not general collation, and
 * `Intl.Collator` would be the answer if this ever needed to sort rather than match.
 */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}
