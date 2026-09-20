/**
 * Which fields of `GET /config` the panel renders (spec 032, AC1).
 *
 * Its own module so that `About.tsx` exports components and nothing else, and so the drift test can
 * import this without pulling React in.
 *
 * **This is AC1's machinery.** "The panel renders every field the config returns" is the kind of
 * criterion that rots silently: spec 031 added `agents.can_promote` three days before this panel
 * was written, and had the order been reversed the field would simply not have appeared, with no
 * test to say so. `About.coverage.test.ts` reads `backend/app/routers/config.py` and asserts this
 * list matches it — the same arrangement that keeps the agents mirror honest (§4).
 *
 * The granularity is **top-level keys**: that is where a reader adds a field, and it is what a
 * regex over Python can read without pretending to be a parser.
 */
export const COVERED_CONFIG_KEYS = [
  'harness',
  'agent_name',
  'agent_version',
  'model',
  'uses_gateway',
  'project_name',
  'tracing',
  'speech',
  'voice',
  'agents',
  'playground',
  // Spec 050. Absent on every build but the replay — and `Flag` keeps absent apart from false.
  'demo',
  'pricing',
  'event_types',
  'event_mapping',
] as const

export type CoveredConfigKey = (typeof COVERED_CONFIG_KEYS)[number]
