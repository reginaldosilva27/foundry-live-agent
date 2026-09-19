/** Durations, formatted the same way everywhere. Locale-independent: it is a number, not prose. */
export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

/** mm:ss — mono, like every other number on this screen. Locale-independent for the same reason. */
export function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * The model half of a `<connection>/<model>` deployment name; a plain name is returned as is.
 *
 * A BYOM deployment is named after the connection it routes through, and the connection is usually
 * the project again — so the raw name is the project id twice over, which wraps to four lines in a
 * 320px column and tells a reader nothing. Whether the connection routes through the gateway is the
 * part worth showing, and the sidebar says that in words.
 */
export function modelName(model?: string): string {
  if (!model) return ''
  return model.slice(model.lastIndexOf('/') + 1)
}

/**
 * What a call asked for, in one value — the part that distinguishes two calls to the same tool.
 *
 * The rule is generic on purpose: parse the arguments and take the first string. It covers every
 * tool we have (`query`, `timezone`, `url`) and the one nobody has written yet, and it keeps the
 * frontend from growing a second opinion about the tools, whose definitions live in
 * `ai/harness/_shared/tools/` (§4).
 *
 * It never throws. Arguments arrive as a raw JSON *string* that is still being assembled while the
 * call streams, so half an object is a normal thing to be handed, not an error — and a row with an
 * empty cell is worth more than a turn that fails to render.
 */
export function callSubject(args: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(args)
  } catch {
    return ''
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return ''
  for (const value of Object.values(parsed)) {
    if (typeof value === 'string' && value) return value
  }
  return ''
}

/** Below this, two decimals would render a real charge as nothing at all. */
const SUB_CENT = 0.01

/**
 * An amount of money, in the currency whoever declared the rates declared (spec 028).
 *
 * Locale-dependent, unlike every other formatter here, because this one *is* prose: `US$ 12,50` and
 * `$12.50` are the same number written for two readers (§7). Nothing is ever converted — the
 * currency is rendered as declared.
 *
 * The sub-cent branch is a §5 rule, not a nicety. A turn that cost four hundredths of a cent really
 * did cost something, and `$0.00` says it was free. An **exact** zero still renders as zero, because
 * that is what it is.
 */
export function formatMoney(amount: number, currency: string, lang: string): string {
  const small = amount > 0 && amount < SUB_CENT
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: small ? 4 : 2,
    maximumFractionDigits: small ? 6 : 2,
  }

  try {
    return new Intl.NumberFormat(lang, options).format(amount)
  } catch {
    // An unknown currency code throws rather than falling back, and a code comes from an operator's
    // environment — a typo there must not take the panel down with it.
    return `${amount.toFixed(small ? 4 : 2)} ${currency}`
  }
}
