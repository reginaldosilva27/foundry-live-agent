/**
 * Spec 027 AC6, AC7, AC8, AC11, AC12, AC13 — where the record is managed.
 *
 * The rail searches; this screen is where the record leaves, comes back, and can be destroyed. The
 * three destructive-adjacent things live here rather than in 248px of rail for one reason the tests
 * below make concrete: clearing has to say what it costs, and that sentence does not fit in a rail.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HistoryScreen } from './HistoryScreen'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'
import { RECORD_VERSION, toExportFile, type HistoryState, type StoredConversation } from '../state/history'

const NOW = new Date('2026-09-16T15:00:00Z').getTime()

function conversation(over: Partial<StoredConversation> = {}): StoredConversation {
  return {
    id: 'c1',
    conversationId: 'conv_1',
    agent: 'foundry-live-agent',
    title: 'What time is it in Sao Paulo?',
    updatedAt: NOW,
    messages: [
      { role: 'user', id: 'u1', text: 'What time is it in Sao Paulo?' },
      {
        role: 'agent',
        id: 'a1',
        startedAt: 0,
        turn: {
          reasoning: '',
          activities: [],
          text: 'It is noon.',
          status: 'done',
          unknownEvents: {},
        },
      },
    ],
    ...over,
  }
}

function historyState(over: Partial<HistoryState> = {}): HistoryState {
  return {
    conversations: [conversation()],
    storing: true,
    save: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    importFile: vi.fn(() => ({ kept: 0, dropped: 0 })),
    ...over,
  }
}

function show(history: HistoryState = historyState(), onOpen = vi.fn()) {
  render(
    <LangContext.Provider value="en">
      <HistoryScreen history={history} onOpen={onOpen} now={NOW} />
    </LangContext.Provider>,
  )
  return { history, onOpen }
}

/** Capture what the page hands the browser to save. */
function captureDownloads() {
  const blobs: Blob[] = []
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn((blob: Blob) => {
      blobs.push(blob)
      return 'blob:fake'
    }),
    revokeObjectURL: vi.fn(),
  })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return { blobs, click }
}

afterEach(() => vi.unstubAllGlobals())

describe('the history screen', () => {
  it('says how many conversations are here and where the real ones live', () => {
    show()
    expect(screen.getByText(/Foundry/)).toBeInTheDocument()
    expect(screen.getByText(/1 conversations/)).toBeInTheDocument()
  })

  it('lists a conversation with its agent and how many turns it holds', () => {
    show()
    expect(screen.getByText('What time is it in Sao Paulo?')).toBeInTheDocument()
    expect(screen.getByText('foundry-live-agent')).toBeInTheDocument()
    expect(screen.getByText(`1 ${t('history.turns', 'en')}`)).toBeInTheDocument()
  })

  it('opens a conversation from the row', async () => {
    const { onOpen } = show()
    await userEvent.click(screen.getByRole('button', { name: /What time is it/ }))
    expect(onOpen).toHaveBeenCalledWith('c1')
  })

  it('searches the record here too (AC1)', async () => {
    show(historyState({ conversations: [conversation(), conversation({ id: 'c2', title: 'Delta Lake vacuum' })] }))

    await userEvent.type(screen.getByLabelText(t('history.search', 'en')), 'vacuum')

    expect(screen.getByText('Delta Lake vacuum')).toBeInTheDocument()
    expect(screen.queryByText('What time is it in Sao Paulo?')).toBeNull()
  })

  it('exports one conversation as Markdown, with its pointer (AC7)', async () => {
    const { blobs, click } = captureDownloads()
    show()

    await userEvent.click(screen.getByRole('button', { name: t('history.exportOne', 'en') }))

    expect(click).toHaveBeenCalled()
    expect(blobs[0].type).toContain('markdown')
    const text = await blobs[0].text()
    expect(text).toContain('What time is it in Sao Paulo?')
    expect(text).toContain('It is noon.')
    expect(text).toContain('conv_1')
    click.mockRestore()
  })

  it('exports the whole record as one versioned JSON file (AC8)', async () => {
    const { blobs, click } = captureDownloads()
    show()

    await userEvent.click(screen.getByRole('button', { name: t('history.exportAll', 'en') }))

    expect(blobs[0].type).toContain('json')
    const parsed = JSON.parse(await blobs[0].text())
    expect(parsed.version).toBe(RECORD_VERSION)
    expect(parsed.conversations).toHaveLength(1)
    expect(parsed.conversations[0].conversationId).toBe('conv_1')
    click.mockRestore()
  })

  it('imports a file and reports what it kept (AC11)', async () => {
    const importFile = vi.fn(() => ({ kept: 2, dropped: 0 }))
    show(historyState({ importFile }))

    const file = new File([JSON.stringify(toExportFile([conversation({ id: 'c9' })], 0))], 'record.json', {
      type: 'application/json',
    })
    await userEvent.upload(screen.getByLabelText(t('history.import', 'en')), file)

    await waitFor(() => expect(importFile).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        t('history.imported', 'en').replace('{kept}', '2'),
      ),
    )
  })

  it('says how many it could not keep, rather than dropping them in silence (AC11)', async () => {
    show(historyState({ importFile: vi.fn(() => ({ kept: 24, dropped: 3 })) }))

    const file = new File(['{}'], 'record.json', { type: 'application/json' })
    await userEvent.upload(screen.getByLabelText(t('history.import', 'en')), file)

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/24/))
    expect(screen.getByRole('status')).toHaveTextContent(/3/)
  })

  it('refuses a file that is not a record and leaves it untouched (AC12)', async () => {
    show(historyState({ importFile: vi.fn(() => null) }))

    // A JSON file that is not a record — what a person actually picks by mistake.
    const file = new File(['{"some":"other json"}'], 'notes.json', { type: 'application/json' })
    await userEvent.upload(screen.getByLabelText(t('history.import', 'en')), file)

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(t('history.importInvalid', 'en')),
    )
    expect(screen.getByText('What time is it in Sao Paulo?')).toBeInTheDocument()
  })
})

/** AC13 — the one irreversible thing on the screen. */
describe('clearing the record', () => {
  it('asks first, naming the count and stating that Foundry is not touched', async () => {
    const { history } = show()

    await userEvent.click(screen.getByRole('button', { name: t('history.clear', 'en') }))

    expect(
      screen.getByText(t('history.clearConfirmTitle', 'en').replace('{count}', '1')),
    ).toBeInTheDocument()
    expect(screen.getByText(t('history.clearConfirmBody', 'en'))).toBeInTheDocument()
    expect(history.clear).not.toHaveBeenCalled()
  })

  it('changes nothing when the question is declined', async () => {
    const { history } = show()

    await userEvent.click(screen.getByRole('button', { name: t('history.clear', 'en') }))
    await userEvent.click(screen.getByRole('button', { name: t('history.clearCancel', 'en') }))

    expect(history.clear).not.toHaveBeenCalled()
    expect(screen.queryByText(t('history.clearConfirmBody', 'en'))).toBeNull()
  })

  it('empties the record once it is confirmed', async () => {
    const { history } = show()

    await userEvent.click(screen.getByRole('button', { name: t('history.clear', 'en') }))
    await userEvent.click(screen.getByRole('button', { name: t('history.clearConfirm', 'en') }))

    expect(history.clear).toHaveBeenCalled()
  })

  it('offers nothing to export or clear when the record is empty', () => {
    show(historyState({ conversations: [] }))
    expect(screen.queryByRole('button', { name: t('history.clear', 'en') })).toBeNull()
    expect(screen.queryByRole('button', { name: t('history.exportAll', 'en') })).toBeNull()
    expect(screen.getByLabelText(t('history.import', 'en'))).toBeInTheDocument()
  })
})
