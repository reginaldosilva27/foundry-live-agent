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
import type { SearchHit, StoredConversation } from '../state/history'

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

/** The list takes search results now (spec 027); with no query every conversation is one. */
const hit = (over: Partial<StoredConversation> = {}): SearchHit => ({ conversation: conversation(over) })

const props = {
  results: [hit()],
  searching: false,
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
      results: [
        hit({ id: 'c1', title: 'today one' }),
        hit({ id: 'c2', title: 'older one', updatedAt: NOW - 90 * DAY }),
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
    show({ results: [] })
    expect(screen.getByText(t('history.empty', 'en'))).toBeInTheDocument()
  })

  it('does not explain where an empty history is kept — there is nothing kept yet', () => {
    // Two grey paragraphs under an empty heading read as a warning about nothing.
    show({ results: [] })
    expect(screen.queryByText(t('history.local', 'en'))).toBeNull()
  })

  it('still says a browser is refusing storage, even with nothing in the list', () => {
    show({ results: [], storing: false })
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

/** Spec 027 AC2 — a result says *why* it matched, not only that it did. */
describe('a search result', () => {
  it('renders a fragment of the matched message under the title', () => {
    show({
      results: [
        {
          conversation: conversation({ title: 'Deploying' }),
          match: { field: 'message', fragment: '…how do I deploy to Container Apps?…' },
        },
      ],
    })

    expect(screen.getByText('Deploying')).toBeInTheDocument()
    expect(screen.getByText('…how do I deploy to Container Apps?…')).toBeInTheDocument()
  })

  it('labels a call match, so `search_web` is not read as something a person typed', () => {
    show({
      results: [
        {
          conversation: conversation({ title: 'A conversation' }),
          match: { field: 'tool', fragment: 'search_web' },
        },
      ],
    })

    expect(screen.getByText(/search_web/)).toHaveTextContent(t('history.matchTool', 'en'))
  })

  it('does not repeat the title as a fragment when the title is what matched', () => {
    show({
      results: [
        {
          conversation: conversation({ title: 'Deploying' }),
          match: { field: 'title', fragment: 'Deploying' },
        },
      ],
    })

    expect(screen.getAllByText('Deploying')).toHaveLength(1)
  })

  it('says so when a query matches nothing at all', () => {
    show({ results: [], searching: true })
    expect(screen.getByText(t('history.searchEmpty', 'en'))).toBeInTheDocument()
  })
})
