/**
 * Every user-facing string, in English and Portuguese (constitution §7).
 *
 * Two rules, both enforced by `strings.test.ts`:
 *
 * - A key that exists in `en` exists in `pt`. No half-translated release.
 * - A key whose two languages are *identical* must be declared in
 *   `INTENTIONALLY_IDENTICAL`. Proper nouns and technical tokens legitimately do not translate;
 *   an untranslated sentence is a bug, and without that list the two look the same.
 *
 * No component contains prose. That is also a test.
 */

export const LANGS = ['en', 'pt'] as const
export type Lang = (typeof LANGS)[number]

type Entry = Record<Lang, string>

export const strings = {
  'app.name': { en: 'Foundry Live Agent', pt: 'Foundry Live Agent' },

  // --- Sidebar -------------------------------------------------------------
  'sidebar.newSession': { en: 'New session', pt: 'Nova sessão' },
  'sidebar.sessionsTitle': { en: 'Session', pt: 'Sessão' },
  'sidebar.currentSession': { en: 'Current session', pt: 'Sessão atual' },
  'sidebar.noHistory': {
    en: 'Nothing is stored. This release has nowhere to persist a conversation to.',
    pt: 'Nada é armazenado. Esta versão não tem onde persistir uma conversa.',
  },
  'sidebar.modelLabel': { en: 'model', pt: 'modelo' },
  'sidebar.transport': { en: 'streaming over SSE', pt: 'streaming via SSE' },
  'sidebar.gatewayOn': { en: 'through the AI Gateway', pt: 'através do AI Gateway' },
  'sidebar.gatewayOff': { en: 'bypassing the AI Gateway', pt: 'sem passar pelo AI Gateway' },
  'sidebar.language': { en: 'Language', pt: 'Idioma' },

  // --- Header --------------------------------------------------------------
  'header.foundryPill': { en: 'Microsoft Foundry', pt: 'Microsoft Foundry' },
  'header.harnessLabel': { en: 'harness', pt: 'harness' },
  'header.voice': { en: 'Voice', pt: 'Voz' },
  'header.voiceUnavailable': {
    en: 'Voice is not configured on this server.',
    pt: 'A voz não está configurada neste servidor.',
  },
  'header.speak': { en: 'Speak', pt: 'Falar' },
  'header.speakUnavailable': {
    en: 'Speech is not configured on this server.',
    pt: 'A fala não está configurada neste servidor.',
  },
  'speech.stop': { en: 'Stop speaking', pt: 'Parar de falar' },
  'header.traces': { en: 'Traces', pt: 'Rastros' },
  'header.status': { en: 'Ready', pt: 'Pronto' },
  'header.statusStreaming': { en: 'Streaming', pt: 'Transmitindo' },

  // --- Voice (spec 006) ----------------------------------------------------
  'voice.title': { en: 'Voice session', pt: 'Sessão de voz' },
  'voice.start': { en: 'Start voice', pt: 'Iniciar voz' },
  'voice.connecting': { en: 'Connecting', pt: 'Conectando' },
  'voice.listening': { en: 'listening', pt: 'ouvindo' },
  'voice.muted': { en: 'muted', pt: 'silenciado' },
  'voice.mute': { en: 'Mute', pt: 'Silenciar' },
  'voice.unmute': { en: 'Unmute', pt: 'Reativar' },
  'voice.end': { en: 'End session', pt: 'Encerrar sessão' },
  'voice.transcriptEmpty': { en: 'Say something to begin.', pt: 'Fale algo para começar.' },
  'voice.toolRunning': { en: 'Agent activity', pt: 'Atividade do agente' },
  'voice.errorMicDenied': {
    en: 'Microphone permission was denied. Allow it in your browser and try again.',
    pt: 'A permissão do microfone foi negada. Libere no navegador e tente de novo.',
  },
  'voice.errorUnsupported': {
    en: 'This browser cannot open a WebRTC audio session.',
    pt: 'Este navegador não consegue abrir uma sessão de áudio por WebRTC.',
  },
  'voice.errorDisabled': {
    en: 'Voice is not configured on this server.',
    pt: 'A voz não está configurada neste servidor.',
  },
  'voice.errorAudioBlocked': {
    en: 'The browser blocked the agent\u2019s audio. Allow sound for this site and start again.',
    pt: 'O navegador bloqueou o áudio do agente. Libere o som para este site e comece de novo.',
  },
  'voice.errorFailed': {
    en: 'The voice session could not be established. Try again.',
    pt: 'Não foi possível estabelecer a sessão de voz. Tente de novo.',
  },
  'voice.dismissError': { en: 'Dismiss', pt: 'Dispensar' },

  // --- Empty state ---------------------------------------------------------
  'empty.headlineLight': { en: 'Talk to your agent.', pt: 'Converse com o seu agente.' },
  'empty.headlineStrong': { en: 'See everything.', pt: 'Veja tudo.' },
  'empty.subtitle': {
    en: 'Every reasoning fragment, every tool call and every token, as the agent produces them.',
    pt: 'Cada fragmento de raciocínio, cada chamada de ferramenta e cada token, conforme o agente os produz.',
  },
  'empty.suggestion1': {
    en: 'What time is it in Sao Paulo right now?',
    pt: 'Que horas são em São Paulo agora?',
  },
  'empty.suggestion2': {
    en: 'How does this project talk to Microsoft Foundry?',
    pt: 'Como este projeto conversa com o Microsoft Foundry?',
  },
  'empty.suggestion3': {
    en: 'What is a hosted agent, and how is it different from a prompt agent?',
    pt: 'O que é um agente hospedado, e como ele difere de um prompt agent?',
  },

  // --- Composer ------------------------------------------------------------
  'composer.placeholder': { en: 'Ask the agent something', pt: 'Pergunte algo ao agente' },
  'composer.send': { en: 'Send', pt: 'Enviar' },
  'composer.voiceInput': { en: 'Voice input', pt: 'Entrada por voz' },

  // --- Conversation --------------------------------------------------------
  'turn.you': { en: 'You', pt: 'Você' },
  'turn.agent': { en: 'Agent', pt: 'Agente' },
  'turn.activityTitle': { en: 'Agent activity', pt: 'Atividade do agente' },
  'turn.pending': { en: 'The agent is working', pt: 'O agente está trabalhando' },
  'turn.thinking': { en: 'Thinking', pt: 'Pensando' },
  'turn.calling': { en: 'Calling', pt: 'Chamando' },

  // --- Reasoning card ------------------------------------------------------
  'reasoning.title': { en: 'Reasoning', pt: 'Raciocínio' },
  'reasoning.streaming': { en: 'thinking', pt: 'pensando' },
  'reasoning.toggle': { en: 'Show or hide the reasoning summary', pt: 'Mostrar ou ocultar o resumo do raciocínio' },
  'reasoning.absentTitle': { en: 'No reasoning summary', pt: 'Sem resumo de raciocínio' },
  'reasoning.absentBody': {
    en: 'This model emits none. Point the deployment at a reasoning model to see this card fill in.',
    pt: 'Este modelo não emite nenhum. Aponte a implantação para um modelo de raciocínio para ver este cartão preencher.',
  },

  // --- Tool cards ----------------------------------------------------------
  'tool.executedHere': { en: 'executed here, by the BFF', pt: 'executado aqui, pelo BFF' },
  'tool.executedInFoundry': { en: 'executed inside Foundry', pt: 'executado dentro do Foundry' },
  'tool.mcpServer': { en: 'MCP server', pt: 'servidor MCP' },
  'tool.running': { en: 'running', pt: 'executando' },
  'tool.arguments': { en: 'Arguments', pt: 'Argumentos' },
  'tool.result': { en: 'Result', pt: 'Resultado' },
  'tool.failed': { en: 'failed', pt: 'falhou' },
  'tool.noDuration': {
    en: 'Foundry reports this call already finished, so it carries no duration.',
    pt: 'O Foundry informa esta chamada já concluída, então ela não carrega duração.',
  },
  'tool.openInTrace': {
    en: 'Show this call in the trace panel',
    pt: 'Mostrar esta chamada no painel de rastros',
  },

  // --- Call reader (spec 010) ----------------------------------------------
  'log.title': { en: 'Call detail', pt: 'Detalhe da chamada' },
  'log.close': { en: 'Close the reader', pt: 'Fechar o leitor' },
  'log.empty': { en: 'This call returned nothing.', pt: 'Esta chamada não retornou nada.' },

  // --- Meta line -----------------------------------------------------------
  'meta.tokens': { en: 'tokens', pt: 'tokens' },
  'meta.reasoningTokens': { en: 'reasoning', pt: 'raciocínio' },
  'meta.latency': { en: 'latency', pt: 'latência' },
  'meta.viewTrace': { en: 'view trace', pt: 'ver rastro' },

  // --- Errors --------------------------------------------------------------
  'error.title': { en: 'The turn failed', pt: 'O turno falhou' },
  'error.hint': {
    en: 'The stream ended with an error event rather than going quiet. That is the contract working.',
    pt: 'O stream terminou com um evento de erro em vez de simplesmente parar. Isso é o contrato funcionando.',
  },

  // --- Trace panel ---------------------------------------------------------
  'trace.title': { en: 'Trace', pt: 'Rastro' },
  'trace.close': { en: 'Close the trace panel', pt: 'Fechar o painel de rastros' },
  'trace.responseId': { en: 'response id', pt: 'response id' },
  'trace.conversationId': { en: 'conversation id', pt: 'conversation id' },
  'trace.spansTitle': { en: 'Spans', pt: 'Spans' },
  'trace.activityEmpty': {
    en: 'This turn called no tools.',
    pt: 'Este turno não chamou nenhuma ferramenta.',
  },
  'trace.spansEmpty': {
    en: 'Span data arrives with the tracing spec. Nothing is drawn here that has not been queried.',
    pt: 'Os dados de spans chegam com a spec de rastreamento. Nada é desenhado aqui sem ter sido consultado.',
  },
  'trace.noTurn': {
    en: 'Send a message to see the identifiers this run produced.',
    pt: 'Envie uma mensagem para ver os identificadores que esta execução produziu.',
  },
  'trace.turnPosition': { en: 'turn {n} of {total}', pt: 'turno {n} de {total}' },
  'trace.previousTurn': { en: 'Previous turn', pt: 'Turno anterior' },
  'trace.nextTurn': { en: 'Next turn', pt: 'Próximo turno' },
  'trace.copy': { en: 'Copy', pt: 'Copiar' },
  'trace.copied': { en: 'copied', pt: 'copiado' },
  'trace.copyFailed': { en: 'could not copy', pt: 'não foi possível copiar' },
  'trace.otelTraceId': { en: 'otel trace id', pt: 'otel trace id' },
  'trace.gatewayRequestId': { en: 'gateway request id', pt: 'gateway request id' },
  'trace.pendingTracing': {
    en: 'arrives with the tracing spec',
    pt: 'chega com a spec de tracing',
  },
  'trace.numbersTitle': { en: 'Run', pt: 'Execução' },
  'trace.spansFooter': {
    en: 'Spans come from Application Insights, which the tracing spec adds.',
    pt: 'Spans vêm do Application Insights, que a spec de tracing adiciona.',
  },
  'trace.openPortal': { en: 'Open in the Foundry portal', pt: 'Abrir no portal do Foundry' },

  // --- Configuration -------------------------------------------------------
  'config.loading': { en: 'reading configuration', pt: 'lendo configuração' },
  'config.unavailable': { en: 'the BFF is not answering', pt: 'o BFF não está respondendo' },
  'config.mappingUnverified': {
    en: 'raw Foundry event names still inferred rather than observed',
    pt: 'nomes de eventos do Foundry ainda inferidos, não observados',
  },
} satisfies Record<string, Entry>

export type StringKey = keyof typeof strings

/**
 * Keys whose two languages are deliberately the same: brand names, and the wire-level tokens a
 * reader will grep for. Translating `response id` would make the panel harder to match against
 * the API, not easier.
 */
export const INTENTIONALLY_IDENTICAL: readonly StringKey[] = [
  'app.name',
  'header.foundryPill',
  'header.harnessLabel',
  'meta.tokens',
  'trace.responseId',
  'trace.conversationId',
  'trace.spansTitle',
  'trace.otelTraceId',
  'trace.gatewayRequestId',
]

export function t(key: StringKey, lang: Lang): string {
  return strings[key][lang]
}

/** First language tag that names one we ship. Browsers hand us a preference list. */
export function detectLang(candidates: readonly string[]): Lang {
  for (const tag of candidates) {
    const base = tag.toLowerCase().split('-')[0]
    const match = LANGS.find((lang) => lang === base)
    if (match) return match
  }
  return 'en'
}
