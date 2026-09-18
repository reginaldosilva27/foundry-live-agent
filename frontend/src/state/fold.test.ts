/** Spec 027 — the one matching rule, shared by the palette and by history search (§4). */
import { describe, expect, it } from 'vitest'
import { fold } from './fold'

describe('fold', () => {
  it('ignores case', () => {
    expect(fold('Agentes')).toBe('agentes')
  })

  it('ignores accents, which is the whole point in a pt interface', () => {
    expect(fold('Conversação')).toBe('conversacao')
    expect(fold('agentés')).toBe('agentes')
  })

  it('trims, so a trailing space does not make a query miss', () => {
    expect(fold('  search_web  ')).toBe('search_web')
  })

  it('leaves a folded string alone', () => {
    expect(fold(fold('Índice'))).toBe(fold('Índice'))
  })
})
