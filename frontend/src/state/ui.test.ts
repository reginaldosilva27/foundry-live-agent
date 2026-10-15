/** Spec 061 — the rail and the agents screen share `fla.ui.v1`, and neither erases the other. */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { UI_KEY, useCollapsed } from './ui'

describe('the UI chrome key (spec 061)', () => {
  beforeEach(() => localStorage.clear())

  it('keeps the agents view when the rail is collapsed', () => {
    localStorage.setItem(UI_KEY, JSON.stringify({ agentsView: 'list' }))
    const { result } = renderHook(() => useCollapsed())
    act(() => result.current[1]())
    expect(JSON.parse(localStorage.getItem(UI_KEY)!)).toEqual({
      agentsView: 'list',
      collapsed: true,
    })
  })
})
