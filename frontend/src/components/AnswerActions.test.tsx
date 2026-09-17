/**
 * Spec 021 AC10 — what a reader can do with an answer once it is finished.
 *
 * Copy and download are the two ways the turn leaves the browser, and both go through code tested
 * elsewhere: the clipboard through `useCopy`, the document through `turnToMarkdown`. What this file
 * tests is the wiring and the feedback — that the right text reaches each of them, and that a
 * reader who clicks Copy is told whether it worked.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnswerActions } from './AnswerActions'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'
import { reduceEvents } from '../state/turn'

const turn = reduceEvents([
  { type: 'text_delta', text: 'It is 19:00 in Sao Paulo.' },
  { type: 'usage', input_tokens: 10, output_tokens: 5 },
  { type: 'trace_ids', response_id: 'resp_1' },
  { type: 'done' },
])

function show(overrides: Record<string, unknown> = {}) {
  return render(
    <LangContext.Provider value="en">
      <AnswerActions
        turn={turn}
        question="what time is it"
        agent="foundry-live-agent"
        model="gpt-5.5"
        latencyMs={1200}
        onOpenTrace={() => {}}
        onRepeat={() => {}}
        {...overrides}
      />
    </LangContext.Provider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('the answer actions', () => {
  it('copies the answer, and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    show()

    await userEvent.click(screen.getByRole('button', { name: t('answer.copy', 'en') }))

    expect(writeText).toHaveBeenCalledWith('It is 19:00 in Sao Paulo.')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(t('copy.copied', 'en')))
  })

  it('says when the clipboard refused rather than looking like it worked', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    show()

    await userEvent.click(screen.getByRole('button', { name: t('answer.copy', 'en') }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(t('copy.failed', 'en')))
  })

  it('hands a Markdown document to the browser to save', async () => {
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
    show()

    await userEvent.click(screen.getByRole('button', { name: t('answer.download', 'en') }))

    expect(click).toHaveBeenCalled()
    expect(blobs).toHaveLength(1)
    expect(blobs[0].type).toContain('markdown')
    const text = await blobs[0].text()
    expect(text).toContain('what time is it')
    expect(text).toContain('It is 19:00 in Sao Paulo.')
    click.mockRestore()
  })

  it('opens the trace for this turn', async () => {
    const onOpenTrace = vi.fn()
    show({ onOpenTrace })

    await userEvent.click(screen.getByRole('button', { name: t('answer.trace', 'en') }))

    expect(onOpenTrace).toHaveBeenCalled()
  })
})

/**
 * Spec 026 AC1, AC7, AC8, AC10 — asking the same question again.
 *
 * Repeat is offered wherever asking again is a reasonable next move, which includes the two states
 * where there is nothing to copy: a turn that failed, and a turn the reader stopped (spec 023).
 */
describe('repeat', () => {
  it('is offered on a finished turn, with an accessible name (AC1)', () => {
    show()

    expect(screen.getByLabelText(t('answer.repeat', 'en'))).toBeInTheDocument()
  })

  it('asks the same question again when pressed (AC2)', async () => {
    const onRepeat = vi.fn()
    show({ onRepeat })

    await userEvent.click(screen.getByLabelText(t('answer.repeat', 'en')))

    expect(onRepeat).toHaveBeenCalled()
  })

  it('is offered on a turn that failed, where there is nothing to copy (AC7)', () => {
    show({ turn: { ...turn, text: '', status: 'error', error: { message: 'the model was not found' } } })

    expect(screen.getByLabelText(t('answer.repeat', 'en'))).toBeInTheDocument()
    expect(screen.queryByLabelText(t('answer.copy', 'en'))).not.toBeInTheDocument()
  })

  it('is offered on a turn the reader stopped (AC7)', () => {
    show({ turn: { ...turn, text: 'It is 19:0', status: 'stopped' } })

    expect(screen.getByLabelText(t('answer.repeat', 'en'))).toBeInTheDocument()
  })

  it('is unavailable when the conversation cannot be continued, carrying that reason (AC8)', () => {
    show({ blocked: 'That agent is no longer available.' })

    const repeat = screen.getByLabelText(t('answer.repeat', 'en'))
    expect(repeat).toBeDisabled()
    expect(repeat).toHaveAccessibleDescription('That agent is no longer available.')
  })

  it('sends nothing when it is unavailable and pressed anyway (AC8)', async () => {
    const onRepeat = vi.fn()
    show({ blocked: 'blocked', onRepeat })

    await userEvent.click(screen.getByLabelText(t('answer.repeat', 'en')))

    expect(onRepeat).not.toHaveBeenCalled()
  })
})
