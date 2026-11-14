/** Spec 066 — the flow view: what it says, how it steps, and what it refuses to claim. */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TurnFlow } from './TurnFlow'
import { t } from '../i18n/strings'
import { buildFlow, FLOW_PACE_MS, type Flow, type FlowInput } from '../state/flow'
import { emptyTurn, reduceTurn, type Turn } from '../state/turn'
import { twoToolTurn } from '../test/fixtures'
import type { AgentEvent } from '../types/events'

function turnOf(events: AgentEvent[]): Turn {
  return events.reduce<Turn>((turn, event) => reduceTurn(turn, event), emptyTurn())
}

function flowOf(over: Partial<FlowInput> = {}): Flow {
  return buildFlow({
    turn: turnOf(twoToolTurn),
    spoken: false,
    harness: 'prompt',
    gateway: 'off',
    model: 'gpt-5.5',
    ...over,
  })
}

function show(flow: Flow | undefined, extra: Partial<Parameters<typeof TurnFlow>[0]> = {}) {
  return render(<TurnFlow flow={flow} orientation="horizontal" onClose={() => {}} {...extra} />)
}

const items = () => within(screen.getByTestId('flow-steps')).getAllByRole('listitem')
const fill = (key: Parameters<typeof t>[0], values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [k, v]) => text.replace(`{${k}}`, String(v)), t(key, 'en'))

afterEach(() => vi.useRealTimers())

describe('the flow view', () => {
  it('lists every hop, in the order the flow gives them (AC16)', () => {
    const flow = flowOf()
    show(flow)

    expect(items()).toHaveLength(flow.hops.length)
    expect(items()[0].textContent).toContain(t('flow.hop.request', 'en'))
    expect(items()[4].textContent).toContain(fill('flow.hop.appCall', { name: 'get_current_datetime' }))
  })

  it('opens on the whole path, with no hop singled out (AC11)', () => {
    const flow = flowOf()
    show(flow)

    expect(screen.getByText(fill('flow.allShown', { total: flow.hops.length }))).toBeTruthy()
    expect(items().some((item) => item.getAttribute('aria-current') === 'step')).toBe(false)
  })

  it('steps one hop at a time, and never past either end (AC11)', () => {
    const flow = flowOf()
    show(flow)
    const next = screen.getByRole('button', { name: t('flow.next', 'en') })
    const previous = screen.getByRole('button', { name: t('flow.previous', 'en') })

    fireEvent.click(next)
    expect(items()[0].getAttribute('aria-current')).toBe('step')
    fireEvent.click(next)
    expect(items()[1].getAttribute('aria-current')).toBe('step')
    expect(screen.getByTestId('flow-caption').textContent).toContain(t('flow.hop.forward', 'en'))
    fireEvent.click(previous)
    fireEvent.click(previous)
    expect(items()[0].getAttribute('aria-current')).toBe('step')
    expect((previous as HTMLButtonElement).disabled).toBe(true)

    for (let i = 0; i < flow.hops.length + 3; i++) fireEvent.click(next)
    expect(items().at(-1)?.getAttribute('aria-current')).toBe('step')
    expect((next as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: t('flow.showAll', 'en') }))
    expect(items().some((item) => item.getAttribute('aria-current') === 'step')).toBe(false)
  })

  it('plays at a fixed pace whatever the durations, stops at the last hop, and pauses (AC11)', () => {
    vi.useFakeTimers()
    const measured = flowOf()
    const huge = { ...measured, hops: measured.hops.map((hop) => ({ ...hop, durationMs: 60_000 })) }
    show(huge)

    fireEvent.click(screen.getByRole('button', { name: t('flow.play', 'en') }))
    act(() => vi.advanceTimersByTime(FLOW_PACE_MS))
    expect(items()[0].getAttribute('aria-current')).toBe('step')
    act(() => vi.advanceTimersByTime(FLOW_PACE_MS))
    expect(items()[1].getAttribute('aria-current')).toBe('step')

    fireEvent.click(screen.getByRole('button', { name: t('flow.pause', 'en') }))
    act(() => vi.advanceTimersByTime(FLOW_PACE_MS * 3))
    expect(items()[1].getAttribute('aria-current')).toBe('step')

    fireEvent.click(screen.getByRole('button', { name: t('flow.play', 'en') }))
    act(() => vi.advanceTimersByTime(FLOW_PACE_MS * (huge.hops.length + 5)))
    expect(items().at(-1)?.getAttribute('aria-current')).toBe('step')
    expect(screen.getByRole('button', { name: t('flow.play', 'en') })).toBeTruthy()
  })

  it('announces a manual step, and nothing while playing (AC16)', () => {
    vi.useFakeTimers()
    show(flowOf())
    const live = screen.getByTestId('flow-live')

    expect(live.getAttribute('aria-live')).toBe('polite')
    fireEvent.click(screen.getByRole('button', { name: t('flow.next', 'en') }))
    expect(live.textContent).toContain(t('flow.hop.request', 'en'))

    fireEvent.click(screen.getByRole('button', { name: t('flow.play', 'en') }))
    act(() => vi.advanceTimersByTime(FLOW_PACE_MS * 2))
    expect(live.textContent).toContain(t('flow.hop.request', 'en'))
    expect(live.textContent).not.toContain(t('flow.hop.askModel', 'en').replace('{model}', 'gpt-5.5'))
  })

  it('opens a call in the log reader from its hop (AC14)', () => {
    const onOpenCall = vi.fn()
    show(flowOf(), { onOpenCall })

    fireEvent.click(screen.getAllByRole('button', { name: fill('flow.openCall', { name: 'get_current_datetime' }) })[0])
    expect(onOpenCall).toHaveBeenCalledWith('call_1')
  })

  it('shows a measured duration where there is one, and none elsewhere (AC6, AC7)', () => {
    show(flowOf())
    const appResult = items()[5]
    expect(appResult.textContent).toContain('3 ms')
    expect(items()[0].textContent).not.toMatch(/\d+ ms/)
  })
})

describe('what the view says about measurement (AC5, AC8)', () => {
  it('counts the model calls of the leg, and says the earlier leg is not counted', () => {
    show(
      flowOf({
        trace: {
          status: 'ok',
          spans: [{ name: 'chat gpt-5.5-2026-04-24', span_id: 'm', parent_id: 'r', duration_ms: 174, start_ms: 0, kind: 'model' }],
        },
      }),
    )

    const notes = screen.getByTestId('flow-notes')
    expect(notes.closest('[aria-hidden="true"]')).toBeNull()
    expect(within(notes).getByTestId('flow-fact-model').textContent).toContain(fill('flow.modelCalls', { n: 1 }))
    expect(within(notes).getByTestId('flow-fact-model').textContent).toContain('174 ms')
    expect(within(notes).getByText(t('timeline.otherLeg', 'en'))).toBeTruthy()
  })

  it('says the model was not measured when the spans were not read', () => {
    show(flowOf({ trace: { status: 'pending', spans: [] } }))
    expect(screen.getByTestId('flow-fact-model').textContent).toContain(t('flow.notMeasured', 'en'))
  })

  it('names a pending read and offers to look again', () => {
    const onRetryTrace = vi.fn()
    show(flowOf({ trace: { status: 'pending', spans: [] } }), { onRetryTrace })

    expect(screen.getByText(t('trace.spansPending', 'en'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: t('trace.spansRetry', 'en') }))
    expect(onRetryTrace).toHaveBeenCalled()
  })

  it('names a refused read, with nothing to retry', () => {
    show(flowOf({ trace: { status: 'denied', spans: [] } }))

    expect(screen.getByText(t('trace.spansDenied', 'en'))).toBeTruthy()
    expect(screen.queryByRole('button', { name: t('trace.spansRetry', 'en') })).toBeNull()
  })

  it('says a turn with no response id has no address and no id to read spans by', () => {
    const typed = { ...turnOf([{ type: 'text_delta', text: 'partial' }]), status: 'stopped' as const }
    show(flowOf({ turn: typed }))

    expect(screen.getByText(t('flow.noId', 'en'))).toBeTruthy()
    expect(screen.queryByText(t('flow.noIdSpoken', 'en'))).toBeNull()
  })

  it('says why a spoken turn has none, without claiming nothing measured it', () => {
    const spoken = { ...turnOf(twoToolTurn), trace: undefined, status: 'done' as const }
    show(flowOf({ turn: spoken, spoken: true }))

    expect(screen.getByText(t('flow.noId', 'en'))).toBeTruthy()
    expect(screen.getByText(t('flow.noIdSpoken', 'en'))).toBeTruthy()
    expect(screen.getByTestId('flow-fact-bff').textContent).toContain(t('flow.sub.offAudio', 'en'))
    expect(screen.getByTestId('flow-fact-bff').closest('[aria-hidden="true"]')).toBeNull()
  })
})

describe('what the picture names (AC4, AC9, AC10)', () => {
  it('labels the agent by who runs the loop', () => {
    const { unmount } = show(flowOf({ harness: 'prompt' }))
    expect(screen.getByTestId('flow-fact-agent').textContent).toContain(t('flow.sub.promptRuntime', 'en'))
    unmount()

    show(flowOf({ harness: 'hosted' }))
    expect(screen.getByTestId('flow-fact-agent').textContent).toContain(t('flow.node.container', 'en'))
    expect(screen.getByTestId('flow-fact-agent').closest('[aria-hidden="true"]')).toBeNull()
  })

  it('says why the gateway is or is not on the path', () => {
    const cases = [
      [{ gateway: 'on' as const }, 'flow.gateway.on'],
      [{ gateway: 'off' as const }, 'flow.gateway.off'],
      [{ gateway: 'unknown' as const }, 'flow.gateway.unknown'],
      [{ gateway: 'unknown' as const, harness: 'hosted' as const }, 'flow.gateway.unknownHosted'],
      [{ gateway: 'off' as const, spoken: true, turn: { ...turnOf(twoToolTurn), trace: undefined } }, 'flow.gateway.voice'],
    ] as const
    for (const [over, key] of cases) {
      const { unmount } = show(flowOf(over))
      expect(screen.getByTestId('flow-gateway').textContent).toContain(t(key, 'en'))
      unmount()
    }
  })

  it('marks a failed turn and a stopped one differently', () => {
    const failed = turnOf([{ type: 'error', message: 'PermissionDeniedError', code: 'harness_error' }])
    const { unmount } = show(flowOf({ turn: failed }))
    expect(items().at(-1)?.getAttribute('data-mark')).toBe('failed')
    expect(items().at(-1)?.textContent).toContain(fill('flow.hop.failed', { code: 'harness_error' }))
    unmount()

    const stopped = { ...turnOf([twoToolTurn[2]]), status: 'stopped' as const }
    show(flowOf({ turn: stopped }))
    expect(items().at(-1)?.getAttribute('data-mark')).toBe('stopped')
    expect(items().at(-1)?.textContent).toContain(t('flow.mark.stopped', 'en'))
  })
})

describe('around the flow (AC13, AC15)', () => {
  it('says a turn this browser does not hold cannot be drawn, and draws nothing', () => {
    show(undefined)

    expect(screen.getByText(t('flow.notInBrowser', 'en'))).toBeTruthy()
    expect(screen.queryByTestId('flow-diagram')).toBeNull()
    expect(screen.queryByTestId('flow-steps')).toBeNull()
  })

  it('moves between turns and closes', () => {
    const onStep = vi.fn()
    const onClose = vi.fn()
    show(flowOf(), { onStep, onClose, position: { index: 1, total: 3 } })

    fireEvent.click(screen.getByRole('button', { name: t('trace.previousTurn', 'en') }))
    fireEvent.click(screen.getByRole('button', { name: t('trace.nextTurn', 'en') }))
    fireEvent.click(screen.getByRole('button', { name: t('flow.close', 'en') }))
    expect(onStep.mock.calls).toEqual([[-1], [1]])
    expect(onClose).toHaveBeenCalled()
  })
})
