/**
 * The tool runner (spec 042), now the Playground's Tools tab (spec 060).
 *
 * What is asserted here is mostly what the screen is *not*: not a conversation, not a generated
 * form, and not a place where a failure gets smoothed into an error box. The framing is the safety
 * argument under §8, so it is tested like a feature rather than trusted like a comment.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToolRunner, type ToolSpec } from './ToolRunner'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'

const TOOLS: ToolSpec[] = [
  {
    name: 'get_current_datetime',
    description: 'Get the current date and time in a given IANA timezone.',
    schema: { type: 'object', properties: { timezone: { type: 'string' } }, required: ['timezone'] },
  },
  {
    name: 'search_web',
    description: 'Search the live internet.',
    schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
]

function show(answer: unknown = { output: '{"iso":"2026-09-19"}', duration_ms: 4, error: '' }) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(answer), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const view = render(
    <LangContext.Provider value="en">
      <ToolRunner tools={TOOLS} bffUrl="http://bff" />
    </LangContext.Provider>,
  )
  return { ...view, fetchMock }
}

afterEach(() => vi.unstubAllGlobals())

describe('what the screen says it is (AC10)', () => {
  it('states that no agent and no model were involved', () => {
    // The framing IS the §8 argument: a person chose, and this is outside the conversation.
    show()
    expect(screen.getByText(t('tools.lead', 'en'))).toBeInTheDocument()
  })
})

describe('the tools and their schemas (AC1, AC2)', () => {
  it('lists exactly what it was given', () => {
    show()
    for (const tool of TOOLS) {
      expect(screen.getByRole('button', { name: tool.name })).toBeInTheDocument()
    }
  })

  it('renders the schema Foundry is given', () => {
    show()
    expect(screen.getByTestId('tool-schema')).toHaveTextContent('timezone')
  })

  it('offers a raw arguments field rather than a generated form', () => {
    const { container } = show()

    // A form would be a second description of the schema (§4), and would hide the shape of the
    // thing being taught: `arguments` arrives as a string.
    expect(container.querySelectorAll('textarea')).toHaveLength(1)
    expect(container.querySelectorAll('input')).toHaveLength(0)
    expect(screen.getByRole('textbox')).toHaveValue('{}')
  })

  it('switches schema when another tool is chosen', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'search_web' }))

    expect(screen.getByTestId('tool-schema')).toHaveTextContent('query')
  })
})

describe('running one (AC3, AC4)', () => {
  it('posts the arguments as the JSON string a function call carries', async () => {
    const { fetchMock } = show()

    await userEvent.clear(screen.getByRole('textbox'))
    await userEvent.type(screen.getByRole('textbox'), '{{"timezone":"UTC"}')
    await userEvent.click(screen.getByRole('button', { name: t('tools.run', 'en') }))

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://bff/tools/get_current_datetime/run')
    expect(JSON.parse(String(init.body))).toEqual({ arguments: '{"timezone":"UTC"}' })
  })

  it('renders the raw output and its duration', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: t('tools.run', 'en') }))

    expect(await screen.findByTestId('tool-output')).toHaveTextContent('2026-09-19')
    expect(screen.getByText(t('tools.duration', 'en').replace('{ms}', '4'))).toBeInTheDocument()
  })

  it('offers the output copyable', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: t('tools.run', 'en') }))

    expect(
      await screen.findByRole('button', { name: t('tools.copyOutput', 'en') }),
    ).toBeInTheDocument()
  })
})

describe('a failure is the failure it was (AC5)', () => {
  it('renders search_unavailable verbatim, not as an error box', async () => {
    // The tool's documented answer when no key is configured — the state most forks are in, and
    // the most instructive case this screen has.
    show({ output: '{"error":"search_unavailable","results":[]}', duration_ms: 2, error: '' })

    await userEvent.click(screen.getByRole('button', { name: t('tools.run', 'en') }))

    expect(await screen.findByTestId('tool-output')).toHaveTextContent('search_unavailable')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders a refusal as a refusal', async () => {
    show({ output: '', duration_ms: 0, error: "123 is not of type 'string'" })

    await userEvent.click(screen.getByRole('button', { name: t('tools.run', 'en') }))

    expect(await screen.findByRole('alert')).toHaveTextContent("not of type 'string'")
    expect(screen.queryByTestId('tool-output')).not.toBeInTheDocument()
  })
})

describe('outside the conversation (AC6, AC7)', () => {
  it('sends no conversation id and nothing else besides the run', async () => {
    const { fetchMock } = show()
    await userEvent.click(screen.getByRole('button', { name: t('tools.run', 'en') }))

    const calls = fetchMock.mock.calls.map((call) => String((call as unknown as unknown[])[0]))
    expect(calls).toEqual(['http://bff/tools/get_current_datetime/run'])
    for (const call of fetchMock.mock.calls) {
      expect(String((call as unknown as [string, RequestInit])[1]?.body)).not.toContain(
        'conversation',
      )
    }
  })

  it('writes nothing to this browser’s record', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    show()
    await userEvent.click(screen.getByRole('button', { name: t('tools.run', 'en') }))
    await screen.findByTestId('tool-output')

    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })
})
