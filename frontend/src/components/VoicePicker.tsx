/**
 * Which voice this session speaks in (spec 043).
 *
 * Spec 012 declared "no per-session choice in the UI" and was right to; the record of what followed
 * is the argument for revisiting it. The default voice changed three times in two days, each time
 * after somebody listened to it, and each change needed an environment variable and a restart. For
 * a repository whose Brazilian audience will have opinions about which Portuguese voice sounds
 * least like a robot, not being able to compare them in the product is a gap.
 *
 * **Only the voice moved to the screen.** Turn detection and noise suppression stay deployment
 * configuration, because a reader cannot evaluate them in one session. Nothing here says anything
 * to the model: §8's single bounded exception (spec 017) is spent and stays spent.
 *
 * **The names are the identifiers.** No adjectives — not "natural", not "expressive" — because
 * nobody has measured them (§5). The identifier carries the locale and the tier, which is what a
 * reader comparing two of them actually uses.
 */
import { useT } from '../i18n/context'

interface Props {
  /** What the deployment offers, default first. One entry renders nothing at all. */
  voices: string[]
  /** The chosen voice, or `undefined` for the deployment's default. */
  value?: string
  onChange: (voice: string) => void
}

export function VoicePicker({ voices, value, onChange }: Props) {
  const s = useT()
  // Every deployment that has not opted in, which is spec 012's behaviour unchanged (AC2).
  if (voices.length < 2) return null

  const selected = value && voices.includes(value) ? value : voices[0]

  return (
    <div className="voice-picker" data-testid="voice-picker">
      <p className="voice-picker__label" id="voice-picker-label">
        {s('voice.choose')}
      </p>
      <div className="voice-picker__options" role="group" aria-labelledby="voice-picker-label">
        {voices.map((voice) => (
          <button
            key={voice}
            type="button"
            aria-pressed={voice === selected}
            onClick={() => onChange(voice)}
          >
            {voice}
          </button>
        ))}
      </div>
      {/* The same honesty history and favourites carry: this is one browser's copy. */}
      <p className="voice-picker__note">{s('voice.chooseLocal')}</p>
    </div>
  )
}
