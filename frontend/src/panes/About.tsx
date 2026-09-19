/**
 * What this build is talking to (spec 032).
 *
 * `GET /config` has always reported more than the app showed. This renders the rest of it: which
 * project and agent, through the gateway or not, with tracing or not, what voice can do, and — the
 * reason this screen is worth having — **the event-mapping report**, which is the app's own account
 * of what constitution §10 has and has not verified against a real run.
 *
 * **Read-only by construction, not by discipline.** There is no control here, no form, and no
 * request: the config was already read for the rail's footer and this screen is handed the result.
 * A test asserts all of that, because "nothing here is editable" is a claim that decays quietly.
 * The browser's own preferences (spec 036) deliberately live somewhere else — one is what the
 * deployment decided, the other is what this browser keeps, and a toggle beside a fact would blur
 * the distinction spec 021 built the history feature around.
 *
 * **Absent is not false.** `tracing`, `pricing` and `agents` are optional on the wire: a BFF that
 * never mentioned tracing and a deployment with tracing switched off are different facts, and
 * `Flag` keeps them apart. Collapsing them is the §5 failure this repository keeps naming.
 *
 * **No link out.** The unverified event names are named and explained in a sentence. A hardcoded
 * repository URL would point every fork at somebody else's documentation, and this app holds no
 * source of truth for its own address.
 */
import { useT } from '../i18n/context'
import type { BffConfig } from '../config'

interface Props {
  /** `null` until `GET /config` answers. */
  config: BffConfig | null
  /** Whether that read failed — a different fact from "not answered yet" (AC6). */
  failed: boolean
}


export function AboutScreen({ config, failed }: Props) {
  const s = useT()

  // Neither state renders the panel's own skeleton with every flag false: a reader would take that
  // for a deployment with nothing configured, which is a specific and wrong thing to learn (AC6).
  if (!config) {
    return (
      <section className="about" aria-label={s('about.title')}>
        <h2 className="about__title">{s('about.title')}</h2>
        <p className="about__state">{s(failed ? 'about.failed' : 'about.loading')}</p>
      </section>
    )
  }

  return (
    <section className="about" aria-label={s('about.title')}>
      <h2 className="about__title">{s('about.title')}</h2>
      <p className="about__lead">{s('about.lead')}</p>

      <Group title={s('about.whoAnswers')} testId="about-who">
        <Text label={s('about.field.project')} value={config.project_name} field="project" />
        <Text label={s('about.field.agent')} value={config.agent_name} field="agent" />
        <Text label={s('about.field.agentVersion')} value={config.agent_version} field="agentVersion" />
        <Text label={s('about.field.harness')} value={config.harness} field="harness" />
        <Text label={s('about.field.model')} value={config.model} field="model" />
      </Group>

      <Group title={s('about.routing')} testId="about-routing">
        <Flag label={s('about.field.usesGateway')} value={config.uses_gateway} field="usesGateway" />
      </Group>

      <Group title={s('about.observable')} testId="about-observable">
        {/* Where a reader learns why the trace panel is empty, before concluding the app is broken. */}
        <Flag label={s('about.field.tracing')} value={config.tracing?.enabled} field="tracing" />
        <Flag label={s('about.field.gatewayLogged')} value={config.tracing?.gateway_logged} field="gatewayLogged" />
        {/* That a rate table exists and when it was read — a fact about this deployment. The
            numbers belong to spec 028, and a second place that formatted them would be the §4
            drift AC1 is about. */}
        <Flag label={s('about.field.pricing')} value={config.pricing ? true : undefined} field="pricing" />
        <Text label={s('about.field.pricingRecorded')} value={config.pricing?.recorded_at} field="pricingRecorded" />
      </Group>

      <Group title={s('about.voice')} testId="about-voice">
        <Flag label={s('about.field.voiceEnabled')} value={config.voice?.enabled} field="voiceEnabled" />
        <Text label={s('about.field.webrtcApiVersion')} value={config.voice?.webrtc_api_version} field="webrtcApiVersion" />
        <Flag label={s('about.field.speech')} value={config.speech?.enabled} field="speech" />
      </Group>

      <Group title={s('about.mayChange')} testId="about-may-change">
        {/* The app's only write, and off by default (spec 031). Stated here so a reader who never
            sees the control learns it is configuration rather than a missing feature. */}
        <Flag label={s('about.field.canPromote')} value={config.agents?.can_promote} field="canPromote" />
      </Group>

      <Contract config={config} />
    </section>
  )
}

/**
 * The event contract, and the app's account of its own honesty.
 *
 * The nine types are rendered **from the array the config sends**, never from a list kept here: the
 * vocabulary belongs to `ai/harness/_shared/contract.py` and a copy in the frontend would be a
 * second definition of §9's boundary.
 */
function Contract({ config }: { config: BffConfig }) {
  const s = useT()
  const mapping = config.event_mapping
  const unverified = mapping?.unverified ?? []

  return (
    <Group title={s('about.contract')} testId="about-contract">
      <div className="about__row">
        <dt>{s('about.events.types')}</dt>
        <dd>
          <ul className="about__events">
            {(config.event_types ?? []).map((type) => (
              <li key={type} className="about__event">
                {type}
              </li>
            ))}
          </ul>
        </dd>
      </div>

      <div className="about__row">
        <dt>{s('about.events.count').replace('{verified}', String(mapping?.verified ?? 0)).replace('{total}', String(mapping?.total ?? 0))}</dt>
        <dd>
          {unverified.length === 0 ? (
            <p className="about__all-verified">{s('about.events.allVerified')}</p>
          ) : (
            <>
              <p className="about__unverified-title">{s('about.events.unverified')}</p>
              <ul className="about__events" data-testid="about-unverified">
                {unverified.map((name) => (
                  <li key={name} className="about__event">
                    {name}
                  </li>
                ))}
              </ul>
            </>
          )}
          {/* Stands in for a link this app cannot honestly provide — see the module docstring. */}
          <p className="about__note">{s('about.events.note')}</p>
        </dd>
      </div>
    </Group>
  )
}

function Group({
  title,
  testId,
  children,
}: {
  title: string
  testId: string
  children: React.ReactNode
}) {
  return (
    <section className="about__group" data-testid={testId}>
      <h3 className="about__subtitle">{title}</h3>
      <dl className="about__pairs">{children}</dl>
    </section>
  )
}

/** A string the service reported. Empty and absent both read as not reported — neither is a value. */
function Text({
  label,
  value,
  field,
}: {
  label: string
  value: string | null | undefined
  field: string
}) {
  return (
    <div className="about__row" data-testid={`about-field-${field}`}>
      <dt>{label}</dt>
      <dd>{value ? value : <Absent />}</dd>
    </div>
  )
}

/**
 * A boolean the service reported, or did not.
 *
 * `undefined` is **not reported**; `false` is **no**. Three fields on this panel are optional on
 * the wire, and a BFF older than the spec that added one sends nothing at all — which must not read
 * as the deployment having switched it off (AC5).
 */
function Flag({
  label,
  value,
  field,
}: {
  label: string
  value: boolean | undefined
  field: string
}) {
  const s = useT()
  return (
    <div className="about__row" data-testid={`about-field-${field}`}>
      <dt>{label}</dt>
      <dd>{value === undefined ? <Absent /> : s(value ? 'about.yes' : 'about.no')}</dd>
    </div>
  )
}

function Absent() {
  const s = useT()
  return <span className="about__absent">{s('about.notReported')}</span>
}
