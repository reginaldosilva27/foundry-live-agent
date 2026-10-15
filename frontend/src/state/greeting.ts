/**
 * Which greeting the empty chat shows (spec 060): by this browser's local hour, and naming nobody.
 *
 * Morning 05–11, afternoon 12–17, evening otherwise.
 */
import type { StringKey } from '../i18n/strings'

export function greetingKey(hour: number): StringKey {
  if (hour >= 5 && hour < 12) return 'greeting.morning'
  if (hour >= 12 && hour < 18) return 'greeting.afternoon'
  return 'greeting.evening'
}
