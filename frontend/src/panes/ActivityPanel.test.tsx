/**
 * Spec 061 AC10–AC12 — many calls fold into one line, a few do not.
 *
 * The label is derived from the events only: how many calls, and which tools, in the order they
 * were first used. Folded from the start, so nothing collapses under a reader when the turn settles.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ActivityPanel } from './ActivityPanel'
import { emptyTurn, type Activity, type Turn } from '../state/turn'
import { t } from '../i18n/strings'

function call(step: number, name: string): Activity {
  return {
    kind: 'tool',
    step,
    executor: 'app',
    callId: `call_${step}`,
    name,
    arguments: '{}',
    status: 'ok',
    durationMs: 2,
  }
}

function turnWith(names: string[]): Turn {
  return { ...emptyTurn(), status: 'done', activities: names.map((n, i) => call(i + 1, n)) }
}

const toggleName = () => /tool calls/i

describe('folding many tool calls (spec 061)', () => {
  it('folds three or more calls into one line naming the count and the tools (AC10)', () => {
    render(
      <ActivityPanel
        turn={turnWith(['lookup_knowledge', 'search_web', 'lookup_knowledge'])}
        onOpenCall={() => {}}
      />,
    )
    const toggle = screen.getByRole('button', { name: toggleName() })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveTextContent(t('tools.group', 'en').replace('{n}', '3'))
    expect(toggle).toHaveTextContent('lookup_knowledge, search_web')
    expect(screen.queryAllByTestId('tool-row')).toHaveLength(0)
  })

  it('unfolds on a click and folds again on the next (AC11)', async () => {
    render(
      <ActivityPanel
        turn={turnWith(['a', 'b', 'c', 'd'])}
        onOpenCall={() => {}}
      />,
    )
    const toggle = screen.getByRole('button', { name: toggleName() })
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByTestId('tool-row')).toHaveLength(4)

    await userEvent.click(toggle)
    expect(screen.queryAllByTestId('tool-row')).toHaveLength(0)
  })

  it('leaves two calls or fewer as they were (AC12)', () => {
    render(<ActivityPanel turn={turnWith(['a', 'b'])} onOpenCall={() => {}} />)
    expect(screen.getAllByTestId('tool-row')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: toggleName() })).toBeNull()
  })
})
