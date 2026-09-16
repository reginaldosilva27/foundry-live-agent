/**
 * Following the stream without taking the scroll away from the reader.
 *
 * jsdom lays nothing out, so the scroll geometry is defined on the element — which is enough,
 * because what is under test is the *rule*: stick to the bottom while the reader is there, and
 * leave them alone once they have scrolled up.
 */
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Conversation } from './Conversation'
import { emptyTurn, type Turn } from '../state/turn'
import type { Message } from '../hooks/useAgentStream'
import { t } from '../i18n/strings'

function agentTurn(id: string, text: string, status: Turn['status'] = 'streaming'): Message {
  return { role: 'agent', id, turn: { ...emptyTurn(), text, status }, startedAt: 0 }
}

/** Give the scroll container a size and a content taller than it. */
function measure(container: HTMLElement, { scrollTop }: { scrollTop: number }) {
  const conversation = container.querySelector('.conversation') as HTMLElement
  Object.defineProperty(conversation, 'clientHeight', { value: 500, configurable: true })
  Object.defineProperty(conversation, 'scrollHeight', { value: 2000, configurable: true })
  conversation.scrollTop = scrollTop
  return conversation
}

const props = {
  model: 'conn/gpt-4o',
  onSuggestion: () => {},
  onOpenTrace: () => {},
}

describe('the conversation column', () => {
  it('follows the stream while the reader is at the bottom', () => {
    const { container, rerender } = render(
      <Conversation {...props} messages={[agentTurn('t1', 'one')]} />,
    )
    const conversation = measure(container, { scrollTop: 1500 }) // 2000 - 500: at the bottom

    rerender(<Conversation {...props} messages={[agentTurn('t1', 'one two')]} />)

    expect(conversation.scrollTop).toBe(2000)
  })

  it('leaves the scroll alone once the reader has moved up', () => {
    // The whole complaint: an answer arrives, you scroll up to read the beginning, and every
    // token yanks you back down.
    const { container, rerender } = render(
      <Conversation {...props} messages={[agentTurn('t1', 'one')]} />,
    )
    const conversation = measure(container, { scrollTop: 200 })

    rerender(<Conversation {...props} messages={[agentTurn('t1', 'one two')]} />)

    expect(conversation.scrollTop).toBe(200)
  })

  it('names the tool while a call is in flight, and goes quiet when the answer starts (spec 011)', () => {
    const calling: Message = {
      role: 'agent',
      id: 't1',
      startedAt: 0,
      turn: {
        ...emptyTurn(),
        reasoning: 'Considering the question.',
        activities: [
          {
            kind: 'tool',
            step: 1,
            executor: 'app',
            callId: 'call_1',
            name: 'lookup_knowledge',
            arguments: '{}',
            status: 'running',
          },
        ],
      },
    }
    const { container, rerender } = render(<Conversation {...props} messages={[calling]} />)

    const line = container.querySelector('[data-testid="turn-pending"]')!
    expect(line).toHaveTextContent(/calling|chamando/i)
    expect(line).toHaveTextContent('lookup_knowledge')

    rerender(<Conversation {...props} messages={[agentTurn('t1', 'It is 13:53')]} />)
    expect(container.querySelector('[data-testid="turn-pending"]')).toBeNull()
  })

  it('says it is thinking once the reasoning has started (spec 011)', () => {
    const thinking: Message = {
      role: 'agent',
      id: 't1',
      startedAt: 0,
      turn: { ...emptyTurn(), reasoning: 'Considering.' },
    }
    const { container } = render(<Conversation {...props} messages={[thinking]} />)

    expect(container.querySelector('[data-testid="turn-pending"]')).toHaveTextContent(
      /thinking|pensando/i,
    )
  })

  it('shows a live indicator while the turn has produced nothing, and drops it at the first token', () => {
    const { container, rerender } = render(
      <Conversation {...props} messages={[agentTurn('t1', '')]} />,
    )
    const pending = container.querySelector('[data-testid="turn-pending"]')
    expect(pending).not.toBeNull()
    // Animated, not a line of static text: the complaint was that it read as frozen.
    expect(pending!.querySelectorAll('.turn__pending-dot')).toHaveLength(3)

    rerender(<Conversation {...props} messages={[agentTurn('t1', 'first token')]} />)
    expect(container.querySelector('[data-testid="turn-pending"]')).toBeNull()
  })

  it('never scrolls anything but itself', () => {
    // `scrollIntoView` walks every scrollable ancestor, including the document, and the document
    // cannot be scrolled back by hand here.
    const { container, rerender } = render(
      <Conversation {...props} messages={[agentTurn('t1', 'one')]} />,
    )
    let calls = 0
    container.querySelectorAll('*').forEach((node) => {
      ;(node as HTMLElement).scrollIntoView = () => {
        calls += 1
      }
    })
    measure(container, { scrollTop: 1500 })

    rerender(<Conversation {...props} messages={[agentTurn('t1', 'one two')]} />)

    expect(calls).toBe(0)
  })
})

/** Spec 015 — a seven-leg turn has to look like progress, not like a frozen screen. */
describe('the live line while a turn works (spec 015)', () => {
  afterEach(() => vi.useRealTimers())

  function calling(step: number, name: string): Message {
    return {
      role: 'agent',
      id: 't1',
      startedAt: 0,
      turn: {
        ...emptyTurn(),
        activities: [
          {
            kind: 'tool',
            step,
            executor: 'app',
            callId: `call_${step}`,
            name,
            arguments: '{"query":"the BFF"}',
            status: 'running',
          },
        ],
      },
    }
  }

  it('says which step is running, and how long it has been (AC10)', () => {
    vi.useFakeTimers()
    const { container } = render(<Conversation {...props} messages={[calling(3, 'lookup_knowledge')]} />)

    const line = container.querySelector('[data-testid="turn-pending"]')!
    expect(line).toHaveTextContent('3')
    expect(line).toHaveTextContent('lookup_knowledge')

    act(() => void vi.advanceTimersByTime(7000))
    expect(container.querySelector('[data-testid="turn-pending"]')).toHaveTextContent('7s')
  })

  // The turn that prompted the spec spent its seconds between the calls, not inside them: every
  // call came back in a millisecond. If the clock ran only during calls it would read 0s for
  // precisely the wait that looks broken.
  it('times the thinking too, and starts over when the state changes (AC11)', () => {
    vi.useFakeTimers()
    const thinking: Message = {
      role: 'agent',
      id: 't1',
      startedAt: 0,
      turn: { ...emptyTurn(), reasoning: 'Considering.' },
    }
    const { container, rerender } = render(<Conversation {...props} messages={[thinking]} />)

    act(() => void vi.advanceTimersByTime(12_000))
    const line = container.querySelector('[data-testid="turn-pending"]')!
    expect(line).toHaveTextContent(/thinking|pensando/i)
    expect(line).toHaveTextContent('12s')

    rerender(<Conversation {...props} messages={[calling(1, 'lookup_knowledge')]} />)
    expect(container.querySelector('[data-testid="turn-pending"]')).not.toHaveTextContent('12s')
  })
})

/**
 * Spec 021 AC9 · AC12 · AC13 — the action row under a finished turn.
 *
 * The row is the difference between an answer you can read and one you can use. It appears when the
 * turn settles, never while it streams: three controls flickering into place beside a caret would
 * be noise, and two of them would have nothing to act on yet.
 */
describe('the answer actions (spec 021)', () => {
  const question: Message = { role: 'user', id: 't1_user', text: 'what time is it' }

  it('shows nothing to act on while the turn is still streaming', () => {
    render(<Conversation {...props} messages={[question, agentTurn('t1', 'It is')]} />)

    expect(screen.queryByTestId('answer-actions')).toBeNull()
  })

  it('offers copy, download and trace once the turn is done', () => {
    render(
      <Conversation {...props} messages={[question, agentTurn('t1', 'It is 19:00.', 'done')]} />,
    )

    const actions = screen.getByTestId('answer-actions')
    expect(within(actions).getAllByRole('button')).toHaveLength(3)
  })

  it('opens the trace panel on that turn', async () => {
    const onOpenTrace = vi.fn()
    render(
      <Conversation
        {...props}
        onOpenTrace={onOpenTrace}
        messages={[question, agentTurn('t1', 'It is 19:00.', 'done')]}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: t('answer.trace', 'en') }))

    expect(onOpenTrace).toHaveBeenCalledWith('t1')
  })

  it('leaves a failed turn with its trace and nothing to copy', () => {
    const failed: Message = {
      role: 'agent',
      id: 't1',
      startedAt: 0,
      turn: { ...emptyTurn(), status: 'error', error: { message: 'no deployment' } },
    }
    render(<Conversation {...props} messages={[question, failed]} />)

    const actions = screen.getByTestId('answer-actions')
    expect(within(actions).getAllByRole('button')).toHaveLength(1)
    expect(within(actions).getByRole('button', { name: t('answer.trace', 'en') })).toBeInTheDocument()
  })

  it('exports the question that caused the turn, not the one before it', async () => {
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

    render(
      <Conversation
        {...props}
        messages={[
          { role: 'user', id: 't0_user', text: 'an earlier question' },
          agentTurn('t0', 'an earlier answer', 'done'),
          question,
          agentTurn('t1', 'It is 19:00.', 'done'),
        ]}
      />,
    )

    await userEvent.click(screen.getAllByRole('button', { name: t('answer.download', 'en') })[1])

    const text = await blobs[0].text()
    expect(text).toContain('what time is it')
    expect(text).not.toContain('an earlier question')
    click.mockRestore()
    vi.unstubAllGlobals()
  })
})
