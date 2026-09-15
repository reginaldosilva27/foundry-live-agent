/**
 * Spec 014 AC1 — an identifier you can take with you.
 *
 * The clipboard is the one browser API in this app that is routinely *absent*: jsdom ships no
 * `navigator.clipboard`, and neither does any insecure origin that is not localhost. A row that
 * throws there would break the panel for exactly the people most likely to be running the project
 * from a LAN address, so all three outcomes are pinned here.
 */
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CopyRow } from './CopyRow'

/** Install a clipboard that behaves as told, and hand back the spy. */
function withClipboard(write?: () => Promise<void>) {
  const writeText = vi.fn(write ?? (() => Promise.resolve()))
  Object.defineProperty(navigator, 'clipboard', {
    value: write === null ? undefined : { writeText },
    configurable: true,
  })
  return writeText
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('a copyable identifier', () => {
  it('shows the label and the value', () => {
    withClipboard()
    render(<CopyRow label="response id" value="resp_abc123" />)

    expect(screen.getByTestId('copy-row')).toHaveTextContent('response id')
    expect(screen.getByTestId('copy-row')).toHaveTextContent('resp_abc123')
  })

  it('copies the value and says so (AC1)', async () => {
    const writeText = withClipboard()
    render(<CopyRow label="response id" value="resp_abc123" />)

    screen.getByRole('button').click()

    expect(writeText).toHaveBeenCalledWith('resp_abc123')
    expect(await screen.findByText(/copied|copiado/i)).toBeInTheDocument()
  })

  it('says it failed rather than going quiet when the clipboard rejects', async () => {
    withClipboard(() => Promise.reject(new Error('denied')))
    render(<CopyRow label="response id" value="resp_abc123" />)

    screen.getByRole('button').click()

    expect(await screen.findByText(/could not copy|não foi possível copiar/i)).toBeInTheDocument()
  })

  it('does not throw where there is no clipboard at all', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    render(<CopyRow label="response id" value="resp_abc123" />)

    expect(() => screen.getByRole('button').click()).not.toThrow()
    expect(await screen.findByText(/could not copy|não foi possível copiar/i)).toBeInTheDocument()
  })

  it('renders a value it does not have as pending, with nothing to press (AC8)', () => {
    withClipboard()
    render(<CopyRow label="otel trace id" pending="arrives with the tracing spec" />)

    expect(screen.getByTestId('copy-row')).toHaveTextContent(/arrives with the tracing spec/i)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
