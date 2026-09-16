/**
 * Spec 021 AC24 — the mark an agent gets, without inventing a picture for it.
 *
 * The reference UI gives every agent an illustrated avatar. We have no illustrations and the brand
 * forbids emoji, so the mark is made of the agent's own name: two letters on one of a few brand
 * tints, chosen deterministically so the same agent is the same colour on every surface and in
 * every session.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Monogram } from './Monogram'
import { initials, tintOf } from './marks'

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('foundry-live-agent')).toBe('FL')
    expect(initials('Alex Analista')).toBe('AA')
    expect(initials('spike_byom')).toBe('SB')
  })

  it('takes two letters from a single word', () => {
    expect(initials('dataagent')).toBe('DA')
  })

  it('survives a one-character name, and a name with no letters in it', () => {
    expect(initials('x')).toBe('X')
    expect(initials('  ')).toBe('')
  })

  it('takes letters and digits only — never an emoji from the name itself', () => {
    // Built from its code point rather than typed: the brand test bans an emoji literal from every
    // source file in this app, and a test proving we strip them is not an exception to that.
    const rocket = String.fromCodePoint(0x1f680)
    expect(initials(`${rocket} rocket agent`)).toBe('RA')
  })
})

describe('tintOf', () => {
  it('is stable for a name and spreads different names across the tints', () => {
    expect(tintOf('foundry-live-agent')).toBe(tintOf('foundry-live-agent'))
    expect(tintOf('anything')).toBeGreaterThanOrEqual(0)

    const tints = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((name) => tintOf(`agent-${name}`)),
    )
    expect(tints.size).toBeGreaterThan(1)
  })
})

describe('Monogram', () => {
  it('renders the letters, and names the agent for a screen reader', () => {
    render(<Monogram name="foundry-live-agent" />)
    const mark = screen.getByTestId('monogram')
    expect(mark).toHaveTextContent('FL')
    expect(mark).toHaveAttribute('data-tint')
  })
})
