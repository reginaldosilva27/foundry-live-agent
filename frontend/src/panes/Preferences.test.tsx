/**
 * What this browser keeps (spec 036).
 *
 * The assertion this screen exists to defend is the negative one: nothing from `GET /config`
 * appears here. `/about` is what the deployment decided and is read-only; this is what one browser
 * prefers and every control writes. A deployment fact rendered beside a toggle would teach a reader
 * that they can change it.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PreferencesScreen } from './Preferences'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'
import { DEFAULTS, type PreferencesState } from '../state/preferences'

function show(over: Partial<PreferencesState> = {}) {
  const set = vi.fn()
  const prefs: PreferencesState = { ...DEFAULTS, set, stored: true, ...over }
  const view = render(
    <LangContext.Provider value="en">
      <PreferencesScreen prefs={prefs} />
    </LangContext.Provider>,
  )
  return { ...view, set }
}

describe('what it says (AC8)', () => {
  it('states that these are kept in this browser only', () => {
    show()
    expect(screen.getByText(t('prefs.lead', 'en'))).toBeInTheDocument()
  })

  it('says so when the browser will not store them (AC7)', () => {
    show({ stored: false })
    expect(screen.getByText(t('prefs.notStored', 'en'))).toBeInTheDocument()
  })

  it('does not say so when it will', () => {
    show({ stored: true })
    expect(screen.queryByText(t('prefs.notStored', 'en'))).not.toBeInTheDocument()
  })
})

describe('the controls (AC1, AC5)', () => {
  it('offers three theme states and marks the current one', () => {
    show({ theme: 'dark' })

    expect(screen.getByRole('button', { name: t('prefs.theme.system', 'en') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('prefs.theme.light', 'en') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('prefs.theme.dark', 'en') })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('sets the theme that was chosen', async () => {
    const { set } = show()

    await userEvent.click(screen.getByRole('button', { name: t('prefs.theme.dark', 'en') }))

    expect(set).toHaveBeenCalledWith('theme', 'dark')
  })

  it('sets a behaviour preference', async () => {
    const { set } = show()

    await userEvent.click(screen.getByRole('checkbox', { name: t('prefs.speakAnswers', 'en') }))

    expect(set).toHaveBeenCalledWith('speakAnswers', true)
  })

  it('marks no language until one was chosen', () => {
    show()
    for (const lang of ['en', 'pt']) {
      expect(screen.getByRole('button', { name: lang })).toHaveAttribute('aria-pressed', 'false')
    }
  })
})

describe('it is not the deployment (AC9)', () => {
  it('renders nothing that GET /config reports', () => {
    const { container } = show()
    const text = container.textContent ?? ''

    // The facts `/about` renders. None of them belongs beside a control that writes.
    for (const fact of ['prompt-agent', 'gpt-5.5', 'Gateway', 'api-version', 'event']) {
      expect(text).not.toContain(fact)
    }
  })

  it('issues no request', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    show()

    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
