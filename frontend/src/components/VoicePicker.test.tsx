/**
 * Choosing the voice (spec 043).
 *
 * Spec 012's non-goal revisited for the voice and nothing else. The assertions that matter are the
 * boundaries: a deployment that declared nothing shows no chooser, the browser cannot name a voice
 * the deployment did not offer, and the choice is this browser's — not a change to the deployment.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { VoicePicker } from './VoicePicker'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'

const THALITA = 'pt-BR-Thalita:DragonHDLatestNeural'
const LUANA = 'pt-BR-LuanaNeural'

function show(voices: string[], value?: string) {
  const onChange = vi.fn()
  const view = render(
    <LangContext.Provider value="en">
      <VoicePicker voices={voices} value={value} onChange={onChange} />
    </LangContext.Provider>,
  )
  return { ...view, onChange }
}

describe('when there is nothing to choose (AC2)', () => {
  it('renders nothing for a deployment that declared one voice', () => {
    // Every deployment that has not opted in — so the default experience is spec 012's, unchanged.
    const { container } = show([THALITA])
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the config has not answered yet', () => {
    const { container } = show([])
    expect(container).toBeEmptyDOMElement()
  })
})

describe('when the deployment offers a choice (AC1, AC4)', () => {
  it('offers each voice by its identifier', () => {
    show([THALITA, LUANA])
    const group = screen.getByRole('group')

    // No adjectives: nobody measured whether one sounds more "natural" than another (§5).
    expect(within(group).getByRole('button', { name: THALITA })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: LUANA })).toBeInTheDocument()
  })

  it('preselects the deployment’s default when nothing was chosen', () => {
    show([THALITA, LUANA])
    expect(screen.getByRole('button', { name: THALITA })).toHaveAttribute('aria-pressed', 'true')
  })

  it('preselects what this browser chose last time', () => {
    show([THALITA, LUANA], LUANA)
    expect(screen.getByRole('button', { name: LUANA })).toHaveAttribute('aria-pressed', 'true')
  })

  it('falls back to the default when the stored choice is no longer offered', () => {
    // A voice the deployment stopped declaring: the stored name outlived the list, and the screen
    // must not show a selection that will not be honoured.
    show([THALITA, LUANA], 'pt-BR-Retired')
    expect(screen.getByRole('button', { name: THALITA })).toHaveAttribute('aria-pressed', 'true')
  })

  it('reports the choice', async () => {
    const { onChange } = show([THALITA, LUANA])

    await userEvent.click(screen.getByRole('button', { name: LUANA }))

    expect(onChange).toHaveBeenCalledWith(LUANA)
  })
})

describe('what it says it is (AC9)', () => {
  it('states the choice is this browser’s, not the deployment’s', () => {
    show([THALITA, LUANA])
    expect(screen.getByText(t('voice.chooseLocal', 'en'))).toBeInTheDocument()
  })
})

describe('what it does not offer (AC8)', () => {
  it('offers no turn detection, noise suppression or free text', () => {
    const { container } = show([THALITA, LUANA])

    // Only the voice moved to the screen: a reader cannot evaluate VAD in one session, and a
    // free-text field would let the browser ask the service for anything.
    expect(container.querySelectorAll('input, select, textarea')).toHaveLength(0)
    expect(container.textContent).not.toMatch(/vad|noise|detection/i)
  })
})
