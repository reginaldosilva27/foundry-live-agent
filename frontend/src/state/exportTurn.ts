/**
 * A finished turn, as a Markdown document (spec 021).
 *
 * The whole turn, not just its last paragraph: the question, the answer, every call and who ran it,
 * and the numbers underneath. An export that kept only the prose would drop the one distinction
 * this repository exists to make visible — that a tool the BFF ran and a tool Foundry ran are not
 * the same event (design note M6).
 *
 * Pure, and translated through the caller's `s`: the file is prose a person reads, so it ships in
 * the language the app is in (§7).
 */
import { formatMs, modelName } from '../components/format'
import type { StringKey } from '../i18n/strings'
import type { Turn } from './turn'

export interface ExportInput {
  question: string
  turn: Turn
  agent?: string
  model?: string
  latencyMs?: number
  at?: number
}

type Translate = (key: StringKey) => string

export function turnToMarkdown(input: ExportInput, s: Translate): string {
  const { question, turn, agent, model, latencyMs, at } = input
  const lines: string[] = [`# ${question.replace(/\s+/g, ' ').trim() || s('app.name')}`, '']

  const heading = [agent, at ? new Date(at).toISOString() : undefined].filter(Boolean)
  if (heading.length > 0) lines.push(`*${heading.join(' · ')}*`, '')

  lines.push(`## ${s('export.question')}`, '', question, '')
  lines.push(`## ${s('export.answer')}`, '', turn.text.trim() || s('export.noAnswer'), '')

  lines.push(`## ${s('export.calls')}`, '')
  if (turn.activities.length === 0) {
    lines.push(s('export.noCalls'), '')
  } else {
    for (const activity of turn.activities) {
      const by = activity.kind === 'tool' ? activity.executor : activity.serverLabel
      const duration =
        activity.kind === 'tool' && activity.durationMs !== undefined
          ? ` · ${formatMs(activity.durationMs)}`
          : ''
      lines.push(`${activity.step}. \`${activity.name}\` — ${by} · ${activity.status}${duration}`)
      lines.push('', '   ```json', `   ${activity.arguments}`, '   ```', '')
    }
  }

  const meta = [
    modelName(model),
    turn.usage && `${turn.usage.inputTokens + turn.usage.outputTokens} ${s('meta.tokens')}`,
    turn.usage?.reasoningTokens !== undefined &&
      `${turn.usage.reasoningTokens} ${s('meta.reasoningTokens')}`,
    latencyMs !== undefined && formatMs(latencyMs),
    turn.trace?.responseId,
  ].filter(Boolean)

  if (meta.length > 0) lines.push('---', '', meta.join(' · '), '')

  return lines.join('\n')
}

/** A filename a file manager will accept, named after what the turn was about. */
export function exportFilename(title: string, at: Date): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '')
  const day = at.toISOString().slice(0, 10)
  return ['foundry-live-agent', slug, day].filter(Boolean).join('-') + '.md'
}
