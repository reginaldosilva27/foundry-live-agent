/**
 * The first screen's suggestions (spec 037).
 *
 * The assertions that matter are the refusals. This component renders what it is handed and
 * derives nothing — not from the agent's tools, not from its name, not from its kind — and it
 * never asks a model what to ask it. When it is handed nothing it shows nothing, because we do not
 * know what somebody else's agent is for and a question it cannot answer is worse than silence.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState, type Suggestion } from './EmptyState'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'

const THREE: Suggestion[] = [
  { en: 'What time is it in Sao Paulo right now?', pt: 'Que horas são em São Paulo agora?' },
  { en: 'How does this project talk to Microsoft Foundry?', pt: 'Como este projeto conversa com o Microsoft Foundry?' },
  { en: 'What is a hosted agent?', pt: 'O que é um agente hospedado?' },
]

function show(suggestions?: Suggestion[], lang: 'en' | 'pt' = 'en') {
  const onSuggestion = vi.fn()
  const view = render(
    <LangContext.Provider value={lang}>
      <EmptyState suggestions={suggestions} onSuggestion={onSuggestion} />
    </LangContext.Provider>,
  )
  return { ...view, onSuggestion }
}

describe('what the agent offers (AC1, AC4)', () => {
  it('renders the agent’s own examples', () => {
    show(THREE)
    for (const one of THREE) expect(screen.getByText(one.en)).toBeInTheDocument()
  })

  it('renders them in Portuguese from the definition’s own value', () => {
    show(THREE, 'pt')

    expect(screen.getByText(THREE[0].pt)).toBeInTheDocument()
    expect(screen.queryByText(THREE[0].en)).not.toBeInTheDocument()
  })

  it('sends exactly the text, as typing it would (AC5)', async () => {
    const { onSuggestion } = show(THREE)

    await userEvent.click(screen.getByRole('button', { name: THREE[1].en }))

    expect(onSuggestion).toHaveBeenCalledWith(THREE[1].en)
  })

  it('sends the Portuguese text when the app is in Portuguese', async () => {
    const { onSuggestion } = show(THREE, 'pt')

    await userEvent.click(screen.getByRole('button', { name: THREE[1].pt }))

    expect(onSuggestion).toHaveBeenCalledWith(THREE[1].pt)
  })

  it('updates when the answering agent changes (AC3)', () => {
    const { rerender } = show(THREE)
    const other: Suggestion[] = [{ en: 'Something else entirely', pt: 'Outra coisa' }]

    rerender(
      <LangContext.Provider value="en">
        <EmptyState suggestions={other} onSuggestion={() => {}} />
      </LangContext.Provider>,
    )

    expect(screen.getByText('Something else entirely')).toBeInTheDocument()
    expect(screen.queryByText(THREE[0].en)).not.toBeInTheDocument()
  })
})

describe('an agent we know nothing about (AC2, AC8)', () => {
  it('renders no list at all, and keeps the headline and subtitle', () => {
    const { container } = show([])

    expect(container.querySelector('.empty__suggestions')).toBeNull()
    expect(screen.getByText(t('empty.subtitle', 'en'))).toBeInTheDocument()
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })

  it('says nothing apologetic — an absent list is a fact, not an error', () => {
    const { container } = show([])
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('renders nothing when the listing never answered', () => {
    const { container } = show(undefined)
    expect(container.querySelector('.empty__suggestions')).toBeNull()
  })
})

describe('the guards (AC6, AC7)', () => {
  const source = readFileSync(join(import.meta.dirname, 'EmptyState.tsx'), 'utf8')
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  it('derives nothing from the agent’s tools, name or kind', () => {
    for (const field of ['tools', 'kind', 'harness', 'model']) {
      expect(code, `EmptyState must not read agent.${field}`).not.toMatch(
        new RegExp(`\\b${field}\\b`),
      )
    }
  })

  it('keeps no list of its own — the definition is the source of truth (§4)', () => {
    // The three questions used to live in `strings.ts`. A copy here would be the same drift in a
    // new file.
    expect(code).not.toMatch(/empty\.suggestion/)
    expect(t).toBeDefined()
    expect(() => t('empty.suggestion1' as never, 'en')).toBeDefined()
  })

  it('issues no request — nothing generates a suggestion (AC7)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { onSuggestion } = show(THREE)

    await userEvent.click(screen.getByRole('button', { name: THREE[0].en }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(onSuggestion).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
