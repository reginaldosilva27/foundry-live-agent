/**
 * Spec 021 AC19 — the conversations this browser drew, grouped and editable.
 *
 * The list is the one place in the app that admits what it is: a drawing this browser kept, not
 * Foundry's conversation store. Everything else here is ordinary list behaviour — open, rename,
 * delete — and the only interesting case is the empty one, which says so rather than showing
 * three headings with nothing under them.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HistoryList } from './HistoryList'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'
import type { StoredConversation } from '../state/history'

const NOW = new Date('2026-09-16T15:00:00Z').getTime()
const DAY = 24 * 60 * 60 * 1000

function conversation(over: Partial<StoredConversation> = {}): StoredConversation {
  return {
    id: 'c1',
    conversationId: 'conv_1',
    agent: 'foundry-live-agent',
    title: 'What time is it in Sao Paulo?',
    updatedAt: NOW,
    messages: [],
    ...over,
  }
}

const props = {
  conversations: [conversation()],
  storing: true,
  activeId: null as string | null,
  now: NOW,
  onOpen: () => {},
  onRename: () => {},
  onRemove: () => {},
}

function show(overrides: Partial<typeof props> = {}) {
  return render(
    <LangContext.Provider value="en">
      <HistoryList {...props} {...overrides} />
    </LangContext.Provider>,
  )
}

describe('the history list', () => {
  it('groups conversations by age, with no heading over an empty group', () => {
    show({
      conversations: [
        conversation({ id: 'c1', title: 'today one' }),
        conversation({ id: 'c2', title: 'older one', updatedAt: NOW - 90 * DAY }),
      ],
    })

    expect(screen.getByText(t('history.today', 'en'))).toBeInTheDocument()
    expect(screen.getByText(t('history.older', 'en'))).toBeInTheDocument()
    expect(screen.queryByText(t('history.week', 'en'))).toBeNull()
  })

  it('says where these conversations live, because it is not where the reader assumes', () => {
    show()
    expect(screen.getByText(t('history.local', 'en'))).toBeInTheDocument()
  })

  it('says a browser that refuses storage is not keeping any of this', () => {
    show({ storing: false })
    expect(screen.getByText(t('history.unavailable', 'en'))).toBeInTheDocument()
  })

  it('invites the first conversation rather than showing an empty frame', () => {
    show({ conversations: [] })
    expect(screen.getByText(t('history.empty', 'en'))).toBeInTheDocument()
  })

  it('does not explain where an empty history is kept — there is nothing kept yet', () => {
    // Two grey paragraphs under an empty heading read as a warning about nothing.
    show({ conversations: [] })
    expect(screen.queryByText(t('history.local', 'en'))).toBeNull()
  })

  it('still says a browser is refusing storage, even with nothing in the list', () => {
    show({ conversations: [], storing: false })
    expect(screen.getByText(t('history.unavailable', 'en'))).toBeInTheDocument()
  })

  it('opens the conversation that was clicked', async () => {
    const onOpen = vi.fn()
    show({ onOpen })

    await userEvent.click(screen.getByRole('button', { name: /What time is it/ }))

    expect(onOpen).toHaveBeenCalledWith('c1')
  })

  it('marks the conversation currently on screen', () => {
    show({ activeId: 'c1' })
    expect(screen.getByRole('button', { name: /What time is it/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('renames one in place, and keeps the old title when the edit is abandoned', async () => {
    const onRename = vi.fn()
    show({ onRename })

    await userEvent.click(screen.getByRole('button', { name: t('history.rename', 'en') }))
    const field = screen.getByRole('textbox')
    await userEvent.clear(field)
    await userEvent.type(field, 'Clock question{Enter}')

    expect(onRename).toHaveBeenCalledWith('c1', 'Clock question')

    await userEvent.click(screen.getByRole('button', { name: t('history.rename', 'en') }))
    await userEvent.keyboard('{Escape}')
    expect(onRename).toHaveBeenCalledTimes(1)
  })

  it('deletes one', async () => {
    const onRemove = vi.fn()
    show({ onRemove })

    await userEvent.click(screen.getByRole('button', { name: t('history.delete', 'en') }))

    expect(onRemove).toHaveBeenCalledWith('c1')
  })
})
