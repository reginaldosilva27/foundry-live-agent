/**
 * Spec 023 AC1–AC4, AC9 — writing a real question, and stopping the answer to it.
 *
 * The field was a one-line `<input>` until this spec, which made every question with a snippet in
 * it a smear the author could not re-read before sending. And the send control had no second job,
 * so a turn that had started could not be stopped.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Composer } from './Composer'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'

function show(props: Partial<React.ComponentProps<typeof Composer>> = {}) {
  const onSend = vi.fn()
  const onStop = vi.fn()
  render(
    <LangContext.Provider value="en">
      <Composer
        streaming={false}
        voiceEnabled={false}
        onSend={onSend}
        onStop={onStop}
        onVoice={() => {}}
        {...props}
      />
    </LangContext.Provider>,
  )
  return { onSend, onStop, field: screen.getByLabelText(t('composer.placeholder', 'en')) }
}

describe('the composer field', () => {
  it('sends on Enter', async () => {
    const { onSend, field } = show()
    await userEvent.type(field, 'what time is it{Enter}')

    expect(onSend).toHaveBeenCalledWith('what time is it')
  })

  it('breaks a line on Shift+Enter, and sends nothing', async () => {
    const { onSend, field } = show()
    await userEvent.type(field, 'first{Shift>}{Enter}{/Shift}second')

    expect(onSend).not.toHaveBeenCalled()
    expect(field).toHaveValue('first\nsecond')
  })

  it('sends the multi-line question it was given', async () => {
    const { onSend, field } = show()
    await userEvent.type(field, 'line one{Shift>}{Enter}{/Shift}line two{Enter}')

    expect(onSend).toHaveBeenCalledWith('line one\nline two')
  })

  it('empties itself after sending', async () => {
    const { field } = show()
    await userEvent.type(field, 'what time is it{Enter}')

    expect(field).toHaveValue('')
  })

  it('does not send an empty question', async () => {
    const { onSend, field } = show()
    await userEvent.type(field, '   {Enter}')

    expect(onSend).not.toHaveBeenCalled()
  })

  it('carries the cap that stops it taking the column (AC2)', () => {
    const { field } = show()
    // jsdom lays nothing out, so `scrollHeight` is always 0 and a rendered height cannot be
    // asserted here. What is assertable is the mechanism, in two halves: the field is a textarea
    // that carries its own ceiling, and the height is written from the content on every change.
    expect(field.tagName).toBe('TEXTAREA')
    expect(field.style.maxHeight).not.toBe('')
  })

  it('writes its height from its content, so it grows as lines are added (AC2)', async () => {
    const { field } = show()
    expect(field.style.height).not.toBe('')

    await userEvent.type(field, 'one{Shift>}{Enter}{/Shift}two')
    expect(field.style.height).not.toBe('')
  })
})

describe('the send and stop controls', () => {
  it('offers send while nothing is streaming', () => {
    show()
    expect(screen.getByLabelText(t('composer.send', 'en'))).toBeInTheDocument()
    expect(screen.queryByLabelText(t('composer.stop', 'en'))).not.toBeInTheDocument()
  })

  it('offers stop while a turn is streaming, under its own name', () => {
    show({ streaming: true })
    expect(screen.getByLabelText(t('composer.stop', 'en'))).toBeInTheDocument()
    expect(screen.queryByLabelText(t('composer.send', 'en'))).not.toBeInTheDocument()
  })

  it('stops the turn when pressed', async () => {
    const { onStop } = show({ streaming: true })
    await userEvent.click(screen.getByLabelText(t('composer.stop', 'en')))

    expect(onStop).toHaveBeenCalled()
  })

  it('never sends while stopping', async () => {
    const { onSend } = show({ streaming: true })
    await userEvent.click(screen.getByLabelText(t('composer.stop', 'en')))

    expect(onSend).not.toHaveBeenCalled()
  })
})

describe('Escape', () => {
  it('does not clear what is being typed', async () => {
    const { field } = show()
    await userEvent.type(field, 'half a question')
    await userEvent.keyboard('{Escape}')

    expect(field).toHaveValue('half a question')
  })

  it('does not stop a running turn — the control is the only way (AC9)', async () => {
    const { onStop } = show({ streaming: true })
    screen.getByLabelText(t('composer.stop', 'en')).focus()
    await userEvent.keyboard('{Escape}')

    expect(onStop).not.toHaveBeenCalled()
  })
})

/**
 * Spec 062 AC6, AC7 — the bound the BFF publishes, said before sending rather than after.
 *
 * The number is whatever the caller passes: the composer keeps none of its own (§4).
 */
describe('a question longer than the deployment accepts', () => {
  it('says so, names the bound, and does not send (AC6)', async () => {
    const { onSend, field } = show({ maxChars: 10 })
    await userEvent.type(field, 'eleven chars{Enter}')

    expect(onSend).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: t('composer.send', 'en') })).toBeDisabled()
    expect(screen.getByTestId('composer-too-long')).toHaveTextContent('10')
  })

  it('says it in Portuguese too (AC6)', async () => {
    render(
      <LangContext.Provider value="pt">
        <Composer
          streaming={false}
          voiceEnabled={false}
          maxChars={5}
          onSend={() => {}}
          onStop={() => {}}
          onVoice={() => {}}
        />
      </LangContext.Provider>,
    )
    await userEvent.type(screen.getByLabelText(t('composer.placeholder', 'pt')), 'too long')

    expect(screen.getByTestId('composer-too-long')).toHaveTextContent(
      t('composer.tooLong', 'pt').replace('{n}', '5'),
    )
  })

  it('sends a question exactly at the bound', async () => {
    const { onSend, field } = show({ maxChars: 5 })
    await userEvent.type(field, 'hello{Enter}')

    expect(onSend).toHaveBeenCalledWith('hello')
    expect(screen.queryByTestId('composer-too-long')).not.toBeInTheDocument()
  })

  it('neither warns nor blocks when the deployment published no bound (AC7)', async () => {
    const { onSend, field } = show()
    await userEvent.type(field, 'a'.repeat(200) + '{Enter}')

    expect(onSend).toHaveBeenCalled()
    expect(screen.queryByTestId('composer-too-long')).not.toBeInTheDocument()
  })
})
