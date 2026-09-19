/**
 * Proposing a change to the agent (spec 041).
 *
 * Two assertions carry this file. **The wording**: nothing in the feature may say saved, updated or
 * applied, because nothing was — a reader who leaves this screen believing the agent changed is
 * the §5 failure the whole spec exists to avoid. And **the request**: the only thing it issues is
 * a proposal, which writes nothing.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentDefinition, type Definition } from './AgentDefinition'
import { LangContext } from '../i18n/context'
import { LANGS, strings, t, type StringKey } from '../i18n/strings'

const DEFINITION: Definition = {
  path: 'ai/harness/_shared/agent_core.yaml',
  yaml: '# core\ninstructions: |\n  Be useful.\n',
  instructions: 'Be useful.',
  served_instructions: 'Be useful.',
  drifted: false,
  shared_with: ['foundry-live-agent', 'foundry-live-agent-hosted'],
}

function show(over: Partial<Definition> = {}, lang: 'en' | 'pt' = 'en') {
  const fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({ ok: true, diff: '--- a/agent_core.yaml\n+  Be brief.', yaml: '# core\n', error: '' }),
        { status: 200 },
      ),
  )
  vi.stubGlobal('fetch', fetchMock)
  const view = render(
    <LangContext.Provider value={lang}>
      <AgentDefinition
        agent="foundry-live-agent"
        definition={{ ...DEFINITION, ...over }}
        bffUrl="http://bff"
      />
    </LangContext.Provider>,
  )
  return { ...view, fetchMock }
}

afterEach(() => vi.unstubAllGlobals())

describe('what it says before anything is edited (AC2, AC12)', () => {
  it('labels the definition as this build’s, not the repository’s', () => {
    show()
    // In a container the files are whatever was baked into the image, which may be neither `main`
    // nor what is deployed. Calling it what it is removes a whole class of quiet lie.
    expect(screen.getByText(t('propose.fromThisBuild', 'en'))).toBeInTheDocument()
    expect(screen.getByText(DEFINITION.path)).toBeInTheDocument()
  })

  it('warns that the instructions are shared by both agents', () => {
    show()
    // Spec 018's design working as intended, and a surprise to anyone who does not know it.
    expect(screen.getByTestId('propose-shared')).toHaveTextContent('foundry-live-agent-hosted')
  })

  it('states a drift before any editing', () => {
    show({ drifted: true, served_instructions: 'something else' })
    expect(screen.getByTestId('propose-drift')).toHaveTextContent(t('propose.drift', 'en'))
  })

  it('states agreement when there is none', () => {
    show()
    expect(screen.getByTestId('propose-drift')).toHaveTextContent(t('propose.noDrift', 'en'))
  })

  it('says nothing about drift when there was nothing to compare', () => {
    show({ served_instructions: null })
    expect(screen.queryByTestId('propose-drift')).not.toBeInTheDocument()
  })
})

describe('what it edits (AC11)', () => {
  it('offers the instructions and nothing else', () => {
    const { container } = show()

    expect(screen.getByRole('textbox')).toHaveValue('Be useful.')
    // Tools are where a bad edit breaks a harness silently; the model's shape decides gateway
    // routing. Neither is offered.
    expect(container.querySelectorAll('textarea, input, select')).toHaveLength(1)
  })

  it('will not produce a diff of no change', () => {
    show()
    expect(screen.getByRole('button', { name: t('propose.produce', 'en') })).toBeDisabled()
  })
})

describe('the output (AC3, AC4)', () => {
  it('asks the BFF for a proposal and renders the diff', async () => {
    const { fetchMock } = show()

    await userEvent.type(screen.getByRole('textbox'), ' Be brief.')
    await userEvent.click(screen.getByRole('button', { name: t('propose.produce', 'en') }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String((fetchMock.mock.calls[0] as unknown as unknown[])[0])).toBe(
      'http://bff/agents/foundry-live-agent/definition/proposal',
    )
    expect(await screen.findByTestId('propose-diff')).toHaveTextContent('agent_core.yaml')
  })

  it('offers the file and the patch', async () => {
    show()
    await userEvent.type(screen.getByRole('textbox'), ' x')
    await userEvent.click(screen.getByRole('button', { name: t('propose.produce', 'en') }))

    expect(await screen.findByRole('link', { name: t('propose.download', 'en') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('propose.copyPatch', 'en') })).toBeInTheDocument()
  })
})

describe('the §4/§8 guard (AC5, AC6)', () => {
  it('issues exactly one request, and it is the proposal', async () => {
    const { fetchMock } = show()

    await userEvent.type(screen.getByRole('textbox'), ' x')
    await userEvent.click(screen.getByRole('button', { name: t('propose.produce', 'en') }))

    const urls = fetchMock.mock.calls.map((call) => String((call as unknown as unknown[])[0]))
    expect(urls).toEqual(['http://bff/agents/foundry-live-agent/definition/proposal'])
    // Nothing that writes to Foundry: no promote, no version, no agents write of any kind.
    for (const url of urls) expect(url).not.toMatch(/promote|versions|\/chat/)
  })

  it('tells the reader what still has to happen', async () => {
    show()
    await userEvent.type(screen.getByRole('textbox'), ' x')
    await userEvent.click(screen.getByRole('button', { name: t('propose.produce', 'en') }))

    expect(await screen.findByTestId('propose-remaining')).toHaveTextContent(
      t('propose.remaining', 'en'),
    )
  })

  it('never says saved, updated or applied — in either language', () => {
    // The wording IS the feature. A reader must not leave this screen believing the agent changed.
    const forbidden = {
      en: [/\bsaved\b/i, /\bupdated\b/i, /\bapplied\b/i, /\bchanged the agent\b/i],
      pt: [/\bsalvo\b/i, /\bsalva\b/i, /\batualizado\b/i, /\baplicado\b/i],
    }
    const keys = Object.keys(strings).filter((key) => key.startsWith('propose.')) as StringKey[]

    expect(keys.length).toBeGreaterThan(5)
    for (const key of keys) {
      for (const lang of LANGS) {
        for (const pattern of forbidden[lang]) {
          expect(t(key, lang), `${key} (${lang}) claims something happened`).not.toMatch(pattern)
        }
      }
    }
  })

  it('reports a proposal that would not validate, and offers nothing to take', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: false, error: 'model must be a string', diff: '', yaml: '' }), {
            status: 200,
          }),
      ),
    )
    render(
      <LangContext.Provider value="en">
        <AgentDefinition agent="foundry-live-agent" definition={DEFINITION} bffUrl="http://bff" />
      </LangContext.Provider>,
    )

    await userEvent.type(screen.getByRole('textbox'), ' x')
    await userEvent.click(screen.getByRole('button', { name: t('propose.produce', 'en') }))

    expect(await screen.findByRole('alert')).toHaveTextContent('model must be a string')
    expect(screen.queryByTestId('propose-diff')).not.toBeInTheDocument()
  })
})
