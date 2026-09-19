/**
 * A table, as tab-separated text (spec 035).
 *
 * Tab-separated because this goes on the **clipboard**: a spreadsheet pastes TSV straight into
 * cells, while CSV lands in a single column or opens an import dialog. CSV would be the right
 * answer to "download a file", which nobody asked for.
 *
 * The escaping is CSV's rule with a tab delimiter — quote the field, double the inner quotes — and
 * it exists for one failure worth naming: a single cell containing a line break silently shifts
 * every column after it. The table then looks fine until somebody checks a number, which is the
 * kind of wrongness this repository is least willing to ship (§5).
 */

/** Characters that would otherwise end a field or a row. */
const NEEDS_QUOTING = /["\t\n\r]/

export function toTsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeCell).join('\t')).join('\n')
}

function escapeCell(cell: string): string {
  if (!NEEDS_QUOTING.test(cell)) return cell
  return `"${cell.replace(/"/g, '""')}"`
}
