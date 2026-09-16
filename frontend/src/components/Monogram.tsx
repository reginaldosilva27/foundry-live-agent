/**
 * An agent's mark, made from its own name (spec 021).
 *
 * The reference UI this shell borrows its structure from gives every agent an illustrated avatar.
 * We have none to give, and the Dataside brand rules out emoji and decorative glyphs — so the mark
 * is two letters on one of four brand tints, picked by hashing the name. Deterministic on purpose:
 * the same agent is the same colour in the rail, on the agents screen and in the composer, which is
 * the only thing a mark like this is actually for.
 *
 * It is decoration. The name is always beside it in text, so this carries no accessible name.
 */
import { initials, tintOf } from './marks'

interface Props {
  name: string
  /** Box size in px. The type scales with it. */
  size?: number
}

export function Monogram({ name, size = 28 }: Props) {
  return (
    <span
      className="monogram"
      data-testid="monogram"
      data-tint={tintOf(name)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}
