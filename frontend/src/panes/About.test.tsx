/**
 * Spec 032 — what this build is talking to.
 *
 * The panel exists because `GET /config` reports more than the app has ever shown, including the
 * one number that is constitution §10 in numeric form: *this many Foundry event names verified
 * against a recorded run, these ones not*.
 *
 * Two kinds of assertion carry the weight here. The **negative** ones — no control, no request, no
 * link — are what make "read-only" a property rather than a promise. And the **absent-versus-false**
 * ones: a deployment with tracing turned off and a deployment whose BFF never mentioned tracing are
 * different facts, and rendering them the same way is the §5 failure this repository keeps naming.
 */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AboutScreen } from './About'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'
import type { BffConfig } from '../config'

const CONFIG: BffConfig = {
  harness: 'prompt-agent',
  agent_name: 'foundry-live-agent',
  agent_version: '8',
  model: 'gpt-5.5',
  uses_gateway: true,
  project_name: 'foundry-live',
  tracing: { enabled: true, gateway_logged: false },
  speech: { enabled: true },
  voice: { enabled: true, webrtc_api_version: '2026-01-01-preview' },
  agents: { can_promote: false },
  event_types: [
    'done',
    'error',
    'mcp_call',
    'reasoning_summary',
    'text_delta',
    'tool_call',
    'tool_result',
    'trace_ids',
    'usage',
  ],
  event_mapping: {
    total: 25,
    verified: 21,
    unverified: ['response.mcp_call.failed', 'response.refusal.done'],
    note: '',
  },
}

function show(props: Partial<React.ComponentProps<typeof AboutScreen>> = {}, lang: 'en' | 'pt' = 'en') {
  return render(
    <LangContext.Provider value={lang}>
      <AboutScreen config={CONFIG} failed={false} {...props} />
    </LangContext.Provider>,
  )
}

describe('the states before there is anything to show (AC6)', () => {
  it('says it is loading while the config has not answered', () => {
    show({ config: null, failed: false })

    expect(screen.getByText(t('about.loading', 'en'))).toBeInTheDocument()
    expect(screen.queryByText(t('about.failed', 'en'))).not.toBeInTheDocument()
  })

  it('says it failed when the config could not be read', () => {
    show({ config: null, failed: true })

    expect(screen.getByText(t('about.failed', 'en'))).toBeInTheDocument()
    expect(screen.queryByText(t('about.loading', 'en'))).not.toBeInTheDocument()
  })

  it('does not render a deployment with everything off in place of either', () => {
    // The failure mode worth guarding: a panel that renders its own skeleton with every flag false
    // teaches the reader something specific and wrong.
    show({ config: null, failed: true })
    expect(screen.queryByTestId('about-who')).not.toBeInTheDocument()
  })
})

describe('who answers (AC1)', () => {
  it('names the project, the agent, its version, the harness and the model', () => {
    show()
    const section = screen.getByTestId('about-who')

    expect(section).toHaveTextContent('foundry-live')
    expect(section).toHaveTextContent('foundry-live-agent')
    expect(section).toHaveTextContent('8')
    expect(section).toHaveTextContent('prompt-agent')
    expect(section).toHaveTextContent('gpt-5.5')
  })

  it('never renders the project endpoint, which the config does not carry anyway', () => {
    show()
    expect(screen.queryByText(/services\.ai\.azure\.com/)).not.toBeInTheDocument()
  })
})

describe('absent is not the same as false (AC5)', () => {
  /** The rendered VALUE of a row, compared exactly — "not reported" contains "no" as a substring. */
  function valueOf(field: string): string {
    return screen.getByTestId(`about-field-${field}`).querySelector('dd')!.textContent
  }

  it('renders a flag the config reports as false as "no"', () => {
    show({ config: { ...CONFIG, tracing: { enabled: false, gateway_logged: false } } })
    expect(valueOf('tracing')).toBe(t('about.no', 'en'))
  })

  it('renders a field the config never sent as not reported', () => {
    // A BFF older than the spec that added `tracing` sends nothing at all. That must not read as a
    // deployment that switched tracing off — these two assertions are the whole of AC5.
    const { tracing: _omitted, ...older } = CONFIG
    show({ config: older as BffConfig })

    expect(valueOf('tracing')).toBe(t('about.notReported', 'en'))
    expect(valueOf('tracing')).not.toBe(t('about.no', 'en'))
  })

  it('keeps the two strings different, or the distinction is decorative', () => {
    expect(t('about.no', 'en')).not.toBe(t('about.notReported', 'en'))
    expect(t('about.no', 'pt')).not.toBe(t('about.notReported', 'pt'))
  })
})

describe('a deployment with nothing switched on (AC8)', () => {
  const bare: BffConfig = {
    ...CONFIG,
    uses_gateway: false,
    tracing: { enabled: false, gateway_logged: false },
    speech: { enabled: false },
    voice: { enabled: false, webrtc_api_version: '' },
    agents: { can_promote: false },
  }

  it('states every line rather than omitting the ones that are off', () => {
    show({ config: bare })

    for (const id of ['about-who', 'about-routing', 'about-observable', 'about-voice']) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }
    expect(screen.getByTestId('about-routing')).toHaveTextContent(t('about.field.usesGateway', 'en'))
    expect(screen.getByTestId('about-voice')).toHaveTextContent(t('about.field.voiceEnabled', 'en'))
  })

  it('still says what this build may change, which is the point of saying it (AC1)', () => {
    show({ config: bare })
    expect(screen.getByTestId('about-may-change')).toHaveTextContent(t('about.no', 'en'))
  })
})

describe('the event contract (AC3, AC4, AC12)', () => {
  it('renders the nine event types the config reports, and keeps no list of its own', () => {
    show()
    const section = screen.getByTestId('about-contract')

    for (const type of CONFIG.event_types) {
      expect(section).toHaveTextContent(type)
    }
  })

  it('renders the verified count and the total (AC3)', () => {
    show()

    expect(screen.getByTestId('about-contract')).toHaveTextContent(
      t('about.events.count', 'en').replace('{verified}', '21').replace('{total}', '25'),
    )
  })

  it('names each unverified event individually, rather than counting them (AC3)', () => {
    show()
    const unverified = screen.getByTestId('about-unverified')

    expect(within(unverified).getByText('response.mcp_call.failed')).toBeInTheDocument()
    expect(within(unverified).getByText('response.refusal.done')).toBeInTheDocument()
  })

  it('says so rather than rendering an empty list when nothing is unverified (AC4)', () => {
    show({ config: { ...CONFIG, event_mapping: { ...CONFIG.event_mapping, unverified: [] } } })

    expect(screen.getByTestId('about-contract')).toHaveTextContent(
      t('about.events.allVerified', 'en'),
    )
    expect(screen.queryByTestId('about-unverified')).not.toBeInTheDocument()
  })

  it('carries the sentence that says what unverified means (AC12)', () => {
    show()
    expect(screen.getByTestId('about-contract')).toHaveTextContent(t('about.events.note', 'en'))
  })
})

describe('read-only, by construction (AC2, AC11, AC12)', () => {
  it('renders no control that could change anything', () => {
    const { container } = show()

    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(container.querySelectorAll('input')).toHaveLength(0)
    expect(container.querySelectorAll('select')).toHaveLength(0)
    expect(container.querySelectorAll('textarea')).toHaveLength(0)
  })

  it('issues no request of its own — the config was already read for it', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    show()

    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('contains no link out, so no fork points at somebody else’s docs (AC12)', () => {
    const { container } = show()
    expect(container.querySelectorAll('a')).toHaveLength(0)
  })
})

describe('both languages (AC9)', () => {
  it('renders the lead sentence in Portuguese', () => {
    show({}, 'pt')
    expect(screen.getByText(t('about.lead', 'pt'))).toBeInTheDocument()
  })
})

describe('the bounds the BFF enforces (spec 062, AC5)', () => {
  it('renders both, read from the config rather than kept here', () => {
    show({ config: { ...CONFIG, limits: { message_chars: 1234, instructions_chars: 567 } } })

    expect(screen.getByTestId('about-field-messageChars')).toHaveTextContent('1234')
    expect(screen.getByTestId('about-field-instructionsChars')).toHaveTextContent('567')
  })

  it('says not reported for a BFF older than the spec', () => {
    show()

    expect(screen.getByTestId('about-field-messageChars')).toHaveTextContent(
      t('about.notReported', 'en'),
    )
  })
})
