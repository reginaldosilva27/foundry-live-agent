/**
 * The sources strip (spec 034).
 *
 * The assertions that matter are the ones about what it does NOT do: it issues no request, it
 * renders nothing at all for a turn that consulted nothing, and it never turns a repository path
 * into a link.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Sources } from './Sources'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'
import type { Source } from '../state/sources'

const activity = {
  kind: 'tool',
  step: 1,
  executor: 'bff',
  callId: 'call_1',
  name: 'search_web',
  arguments: '{}',
  status: 'ok',
} as unknown as Source['activity']

const LINK: Source = {
  kind: 'link',
  id: 'https://learn.microsoft.com/en-us/azure/foundry',
  label: 'learn.microsoft.com/en-us/azure/foundry',
  url: 'https://learn.microsoft.com/en-us/azure/foundry',
  from: 'microsoft_learn',
  activity,
  callKey: 'mcp_0',
}

const PASSAGE: Source = {
  kind: 'passage',
  id: 'lookup_knowledge:docs/architecture.md',
  label: 'docs/architecture.md',
  from: 'lookup_knowledge',
  activity,
  callKey: 'call_1',
}

function show(sources: Source[], onOpenCall = vi.fn()) {
  const view = render(
    <LangContext.Provider value="en">
      <Sources sources={sources} onOpenCall={onOpenCall} />
    </LangContext.Provider>,
  )
  return { ...view, onOpenCall }
}

describe('the strip', () => {
  it('lists a source with where it came from (AC1, AC2)', () => {
    show([LINK])

    expect(screen.getByText(LINK.label)).toBeInTheDocument()
    expect(screen.getByText(/microsoft_learn/)).toBeInTheDocument()
  })

  it('renders nothing at all when there are none — no heading over nothing (AC4)', () => {
    const { container } = show([])

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText(t('sources.title', 'en'))).not.toBeInTheDocument()
  })

  it('opens the producing call when a source is selected (AC3)', async () => {
    const { onOpenCall } = show([LINK])

    await userEvent.click(screen.getByRole('button', { name: /learn\.microsoft\.com/ }))

    expect(onOpenCall).toHaveBeenCalledWith('mcp_0')
  })

  it('names the knowledge base rather than the tool, and renders no link (AC11)', () => {
    const { container } = show([PASSAGE])

    expect(screen.getByText('docs/architecture.md')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(t('sources.knowledgeBase', 'en')))).toBeInTheDocument()
    // A path is not a URL. Rendering it as an anchor would invite a click that goes nowhere.
    expect(container.querySelectorAll('a')).toHaveLength(0)
  })

  it('says a lookup failed rather than listing nothing (AC5)', () => {
    show([{ ...LINK, failed: true, label: 'search_web', url: undefined }])
    expect(screen.getByText(t('sources.failed', 'en'))).toBeInTheDocument()
  })

  /**
   * A duplicate React key does not throw — it warns, and "children may be duplicated and/or
   * omitted". This strip keyed its rows on `callKey:label`, and two sources can legitimately share
   * a label while being different sources, so a row could vanish with nothing but a console
   * message to say so. `id` is what `sourcesOf` already uses to decide that two sources are the
   * same one, so it is what addresses a row (§4).
   */
  it('renders every source it is given, even two that share a label', () => {
    show([
      LINK,
      { ...LINK, id: `${LINK.url}#later`, url: `${LINK.url}#later`, callKey: 'mcp_1' },
    ])

    expect(screen.getAllByRole('button', { name: LINK.label })).toHaveLength(2)
  })

  it('issues no request of its own (AC7)', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    show([LINK, PASSAGE])

    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
