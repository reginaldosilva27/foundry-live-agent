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
import type { StoredConversation } from './history'
import type { Turn } from './turn'

export interface ExportInput {
  question: string
  turn: Turn
  agent?: string
  model?: string
  latencyMs?: number
  at?: number
  /** Set when this turn re-asked an earlier question (spec 026). */
  repeatOf?: { turnId: string; agent?: string }
}

type Translate = (key: StringKey) => string

export function turnToMarkdown(input: ExportInput, s: Translate): string {
  const { question, agent, at } = input
  const lines: string[] = [`# ${question.replace(/\s+/g, ' ').trim() || s('app.name')}`, '']

  const heading = [agent, at ? new Date(at).toISOString() : undefined].filter(Boolean)
  if (heading.length > 0) lines.push(`*${heading.join(' · ')}*`, '')

  lines.push(...turnSection(input, s))

  return lines.join('\n')
}

/**
 * One turn, from its question to the numbers underneath (spec 027).
 *
 * Lifted out of `turnToMarkdown` so a conversation is the same renderer repeated rather than a
 * second one that drifts (§4). `turnToMarkdown`'s own tests are what prove the lift changed nothing.
 */
function turnSection(input: ExportInput, s: Translate): string[] {
  const { question, turn, agent, model, latencyMs, repeatOf } = input
  const lines: string[] = []

  // An export that omits "this was asked twice" describes a conversation that did not happen
  // (spec 026).
  if (repeatOf) {
    lines.push(`*${s('turn.repeatOf').replace('{agent}', repeatOf.agent ?? agent ?? '')}*`, '')
  }

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

  return lines
}

/**
 * A whole stored conversation, as one document (spec 027 AC7).
 *
 * Every turn through `turnSection`, in the order they happened, under one heading that names the
 * conversation and carries the pointer Foundry gave it. The pointer is in the document on purpose:
 * a transcript that cannot be tied back to the conversation it came from is a screenshot.
 *
 * What it renders is **what this browser drew** — it reads the stored record and asks Foundry
 * nothing, which is the same rule reopening a conversation already follows (spec 021).
 */
export function conversationToMarkdown(conversation: StoredConversation, s: Translate): string {
  const { title, agent, conversationId, updatedAt, messages } = conversation

  const lines: string[] = [`# ${title}`, '']
  const heading = [agent, conversationId, new Date(updatedAt).toISOString()].filter(Boolean)
  lines.push(`*${heading.join(' · ')}*`, '')

  // A question belongs to the answer that followed it, so the pairing is made here rather than by
  // storing it on the turn: the record keeps a flat list of messages, and that is the honest shape.
  let question = ''
  let turns = 0
  for (const message of messages) {
    if (message.role === 'user') {
      question = message.text
      continue
    }
    if (message.role !== 'agent') continue

    turns += 1
    lines.push('---', '')
    lines.push(
      ...turnSection(
        {
          question: question || title,
          turn: message.turn,
          agent: agent ?? undefined,
          latencyMs:
            message.endedAt === undefined ? undefined : message.endedAt - message.startedAt,
          repeatOf: message.repeatOf,
        },
        s,
      ),
    )
    question = ''
  }

  if (turns === 0) lines.push(s('export.noAnswer'), '')

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
