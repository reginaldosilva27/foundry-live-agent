/**
 * The replay banner (spec 050, AC5).
 *
 * Two of these assertions are about absence, and they are the important ones. There is **no
 * control that dismisses it**: a banner a reader can close is a banner that is not there in the
 * screenshot somebody posts, and the one thing this build must never do is let a recording pass
 * for a live agent. And it says out loud that the answer does not depend on the question, rather
 * than letting the reader discover that by typing twice (AC7).
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DemoBanner } from './DemoBanner'
import { LangContext } from '../i18n/context'
import { t, type Lang } from '../i18n/strings'
import type { DemoState } from '../state/demo'

const DEMO: DemoState = {
  recordedAt: '2026-09-15',
  current: 'round-trip',
  recordings: [
    { id: 'round-trip', recorded_at: '2026-09-15' },
    { id: 'no-reasoning', recorded_at: '2026-09-15' },
    { id: 'preamble', recorded_at: '2026-09-16' },
  ],
  choose: () => {},
}

function show(demo: Partial<DemoState> = {}, lang: Lang = 'en') {
  const choose = vi.fn()
  const view = render(
    <LangContext.Provider value={lang}>
      <DemoBanner demo={{ ...DEMO, choose, ...demo }} />
    </LangContext.Provider>,
  )
  return { ...view, choose }
}

describe('the replay banner', () => {
  it('says the build is a replay and when it was recorded', () => {
    const { container } = show()

    expect(screen.getByTestId('demo-banner')).toBeInTheDocument()
    expect(container.textContent).toContain('2026-09-15')
  })

  it('says the answer does not depend on what you type (AC7)', () => {
    show()
    // The sentence itself, from the table — not a paraphrase, so a rewrite that quietly drops the
    // claim fails here.
    expect(screen.getByText(t('demo.body', 'en').replace('{date}', '2026-09-15'))).toBeInTheDocument()
  })

  it('offers no way to dismiss itself', () => {
    show()

    // `queryAll`, because the assertion IS the empty list. The picker is a combobox; a button here
    // could only be a close control, and a closable banner is one that is missing from the
    // screenshot somebody posts.
    expect(screen.queryAllByRole('button', { hidden: true })).toEqual([])
  })

  it('lists every recording by what it demonstrates, and replays the one chosen (AC6)', async () => {
    const { choose } = show()
    const picker = screen.getByRole('combobox', { name: t('demo.pick', 'en') })

    expect([...picker.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      t('demo.recording.round-trip', 'en'),
      t('demo.recording.no-reasoning', 'en'),
      t('demo.recording.preamble', 'en'),
    ])

    await userEvent.selectOptions(picker, 'preamble')
    expect(choose).toHaveBeenCalledWith('preamble')
  })

  it('names a recording this build does not know by its id rather than inventing a sentence', () => {
    // A BFF ahead of this frontend is the normal direction of drift. An unlabelled option is
    // honest; a made-up description of a recording nobody here has seen is not (§5).
    show({ recordings: [{ id: 'something-new', recorded_at: '2027-01-01' }], current: 'something-new' })

    expect(screen.getByRole('option', { name: 'something-new' })).toBeInTheDocument()
  })

  it('speaks Portuguese too (AC14)', () => {
    show({}, 'pt')

    expect(screen.getByText(t('demo.title', 'pt'))).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: t('demo.recording.round-trip', 'pt') }),
    ).toBeInTheDocument()
  })
})
