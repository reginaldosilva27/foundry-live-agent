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

  // --- Side by side (spec 020) -------------------------------------------
  // The screen says what it is and, once, that it is not judging. Nothing else here describes an
  // answer: the app draws two columns and the reader does the comparing.
  'compare.with': { en: 'Compare with…', pt: 'Comparar com…' },
  'compare.pick': { en: 'No comparison', pt: 'Sem comparação' },
  'compare.column': { en: 'Answers from {agent}', pt: 'Respostas de {agent}' },
  'compare.voiceUnavailable': {
    en: 'Voice is unavailable while comparing.',
    pt: 'A voz não está disponível durante a comparação.',
  },

  // --- Sidebar -------------------------------------------------------------
  'sidebar.newSession': { en: 'New session', pt: 'Nova sessão' },
  'sidebar.modelLabel': { en: 'model', pt: 'modelo' },
  'sidebar.transport': { en: 'streaming over SSE', pt: 'streaming via SSE' },
  'sidebar.gatewayOn': { en: 'through the AI Gateway', pt: 'através do AI Gateway' },
  'sidebar.gatewayOff': { en: 'bypassing the AI Gateway', pt: 'sem passar pelo AI Gateway' },
  'sidebar.language': { en: 'Language', pt: 'Idioma' },

  // --- Agents (spec 019) ---------------------------------------------------
  // The screen reads the Foundry project. Agent names, version numbers and model ids are DATA and
  // are rendered verbatim (§7's proper-noun rule); everything the app says *about* them is here.
  'agents.title': { en: 'Agents', pt: 'Agentes' },
  'agents.loading': { en: 'Reading the project\u2026', pt: 'Lendo o projeto\u2026' },
  'agents.answering': { en: 'answering', pt: 'respondendo' },
  'agents.kind.prompt': { en: 'prompt', pt: 'prompt' },
  'agents.kind.hosted': { en: 'hosted', pt: 'hospedado' },
  'agents.kind.workflow': { en: 'workflow', pt: 'workflow' },
  'agents.kind.unknown': { en: 'unknown kind', pt: 'tipo desconhecido' },
  'agents.version': { en: 'v{version} \u00b7 {status}', pt: 'v{version} \u00b7 {status}' },
  'agents.status.active': { en: 'active', pt: 'ativo' },
  'agents.status.creating': { en: 'creating', pt: 'criando' },
  'agents.status.failed': { en: 'failed', pt: 'falhou' },
  'agents.status.deleting': { en: 'deleting', pt: 'excluindo' },
  'agents.status.unknown': { en: 'unknown', pt: 'desconhecido' },
  // The three reasons a row cannot be chosen, distinguished (AC5). The BFF sends the code.
  // --- Images in an answer (spec 044) --------------------------------------
  // `image.noDescription` is a statement, not an apology: an image the answer did not describe has
  // no description, and saying so is more useful to a screen-reader user than a generated guess.
  'image.noDescription': { en: 'Image with no description', pt: 'Imagem sem descri\u00e7\u00e3o' },
  'image.failed': { en: 'This image could not be loaded:', pt: 'N\u00e3o foi poss\u00edvel carregar esta imagem:' },
  'image.close': { en: 'Close', pt: 'Fechar' },

  // --- Choosing the voice on the screen (spec 043) -------------------------
  // The voice IDENTIFIERS are never translated and never described: no "natural", no "expressive",
  // because nobody measured them. The identifier carries the locale and the tier, which is what a
  // reader comparing two of them actually uses.
  'voice.choose': { en: 'Voice', pt: 'Voz' },
  'voice.chooseLocal': {
    en: 'Kept in this browser. It does not change the deployment.',
    pt: 'Guardado neste navegador. N\u00e3o altera a implanta\u00e7\u00e3o.',
  },

  // --- The tool playground (spec 042) --------------------------------------
  // The framing is the safety argument, so it is the headline and not a disclaimer in small type:
  // this is not a conversation, no agent chose anything, and nothing was sent to a model.
  'tools.title': { en: 'Run a tool', pt: 'Executar uma ferramenta' },
  'tools.loading': { en: 'Loading tools…', pt: 'Carregando ferramentas…' },
  'tools.listFailed': { en: 'The tools could not be loaded.', pt: 'Não foi possível carregar as ferramentas.' },
  'tools.empty': { en: 'This build lists no tools.', pt: 'Esta build não lista ferramentas.' },
  'tools.lead': {
    en: 'Not a conversation. No agent chose this, nothing was sent to a model, and nothing here appears in the chat.',
    pt: 'N\u00e3o \u00e9 uma conversa. Nenhum agente escolheu isto, nada foi enviado a um modelo, e nada aqui aparece no chat.',
  },
  'tools.schema': { en: 'The schema Foundry is given', pt: 'O schema que o Foundry recebe' },
  'tools.arguments': {
    en: 'Arguments \u2014 the JSON a function call carries',
    pt: 'Argumentos \u2014 o JSON que uma chamada de fun\u00e7\u00e3o carrega',
  },
  'tools.run': { en: 'Run', pt: 'Executar' },
  'tools.running': { en: 'Running\u2026', pt: 'Executando\u2026' },
  'tools.output': { en: 'Output', pt: 'Sa\u00edda' },
  'tools.duration': { en: '{ms} ms', pt: '{ms} ms' },
  'tools.copyOutput': { en: 'Copy the output', pt: 'Copiar a sa\u00edda' },
  'tools.invalid': { en: 'These arguments were refused: {error}', pt: 'Estes argumentos foram recusados: {error}' },
  'tools.unavailable': { en: 'The tool could not be run', pt: 'N\u00e3o foi poss\u00edvel executar a ferramenta' },
  'sidebar.tools': { en: 'Run a tool', pt: 'Executar uma ferramenta' },

  // --- Proposing a change to the agent (spec 041) --------------------------
  //
  // THE WORDING IS THE FEATURE. Nothing here may say saved, updated or applied, because nothing
  // was: the output is a diff somebody still has to review, merge and apply. `propose.test.tsx`
  // asserts that over these strings, in both languages \u2014 a screen that let a reader leave
  // believing the agent changed would be the \u00a75 failure this whole spec is built to avoid.
  'propose.title': { en: 'Propose a change', pt: 'Propor uma altera\u00e7\u00e3o' },
  'propose.loading': { en: 'Reading this build’s definition…', pt: 'Lendo a definição desta build…' },
  'propose.unavailable': { en: 'This build’s definition could not be read.', pt: 'Não foi possível ler a definição desta build.' },
  'propose.fromThisBuild': {
    en: 'The definition this build was made from \u2014 not a branch, and not necessarily what is deployed.',
    pt: 'A defini\u00e7\u00e3o a partir da qual esta build foi feita \u2014 n\u00e3o um branch, e n\u00e3o necessariamente o que est\u00e1 implantado.',
  },
  'propose.sharedWith': {
    en: 'These instructions are shared by: {agents}. A change here changes all of them.',
    pt: 'Estas instru\u00e7\u00f5es s\u00e3o compartilhadas por: {agents}. Uma altera\u00e7\u00e3o aqui muda todos.',
  },
  'propose.drift': {
    en: 'What is being served differs from this file. It came from somewhere other than this build.',
    pt: 'O que est\u00e1 sendo servido difere deste arquivo. Veio de outro lugar, n\u00e3o desta build.',
  },
  'propose.noDrift': {
    en: 'What is being served matches this file.',
    pt: 'O que est\u00e1 sendo servido corresponde a este arquivo.',
  },
  'propose.instructions': { en: 'Instructions', pt: 'Instru\u00e7\u00f5es' },
  'propose.produce': { en: 'Produce the diff', pt: 'Gerar o diff' },
  'propose.diff': { en: 'The change', pt: 'A altera\u00e7\u00e3o' },
  'propose.download': { en: 'Download the file', pt: 'Baixar o arquivo' },
  'propose.copyPatch': { en: 'Copy as a patch', pt: 'Copiar como patch' },
  'propose.remaining': {
    en: 'Nothing has changed yet. Review this diff, merge it, then run the apply step.',
    pt: 'Nada mudou ainda. Revise este diff, fa\u00e7a o merge e ent\u00e3o rode a etapa de apply.',
  },
  'propose.invalid': { en: 'This would not validate: {error}', pt: 'Isto n\u00e3o validaria: {error}' },
  'propose.unchanged': { en: 'Nothing is different yet.', pt: 'Nada est\u00e1 diferente ainda.' },

  // --- The keyboard and screen-reader pass (spec 040) ----------------------
  // `a11y.answerReady` is deliberately short. The turn's shape \u2014 three tools, twelve seconds \u2014 is
  // already on screen; reading it into the announcement queue would turn the one moment that
  // needed a word into a paragraph.
  'a11y.skipToConversation': { en: 'Skip to the conversation', pt: 'Ir para a conversa' },
  'a11y.answerReady': { en: 'The answer is ready', pt: 'A resposta est\u00e1 pronta' },
  'a11y.announcements': { en: 'Announcements', pt: 'Avisos' },

  // --- What the voice session is doing (spec 039) --------------------------
  'voice.elapsed': { en: '{seconds}s', pt: '{seconds}s' },

  // --- The event inspector (spec 038) --------------------------------------
  // Event TYPE names are never translated: they are contract identifiers, and a reader has
  // `contract.py` open beside the screen.
  'events.title': { en: 'Events', pt: 'Eventos' },
  'events.close': { en: 'Close', pt: 'Fechar' },
  'events.all': { en: 'all', pt: 'todos' },
  'events.empty': { en: 'No events captured yet for this turn.', pt: 'Nenhum evento capturado ainda neste turno.' },
  'events.unretained': { en: 'Events were not retained for this turn. Restored and voice turns may have no event capture.', pt: 'Os eventos não foram retidos neste turno. Turnos restaurados e de voz podem não ter captura de eventos.' },
  'events.filteredEmpty': { en: 'No captured events match this filter. Choose All to see the capture.', pt: 'Nenhum evento capturado corresponde a este filtro. Escolha Todos para ver a captura.' },
  'events.noTurn': { en: 'No turn selected. Send a question or open a conversation to inspect its retained events.', pt: 'Nenhum turno selecionado. Envie uma pergunta ou abra uma conversa para inspecionar seus eventos retidos.' },
  'events.context': { en: 'Turn {turn} of {total} · Agent: {agent}', pt: 'Turno {turn} de {total} · Agente: {agent}' },
  'events.unknownAgent': { en: 'not recorded', pt: 'não registrado' },
  'events.previous': { en: 'Previous turn', pt: 'Turno anterior' },
  'events.next': { en: 'Next turn', pt: 'Próximo turno' },
  'compare.independent': { en: 'Each column has its own context and conversation pointer. Changing one agent clears only that column; their contexts may differ. A pointer does not guarantee that a hosted agent retains earlier turns.', pt: 'Cada coluna tem seu próprio contexto e ponteiro de conversa. Trocar um agente limpa apenas aquela coluna; os contextos podem diferir. Um ponteiro não garante que um agente hospedado retenha turnos anteriores.' },
  'compare.reset': { en: 'Restart both columns', pt: 'Reiniciar as duas colunas' },
  'compare.resetScope': { en: 'Restart clears both columns and their pointers in this browser, keeping the chosen agents. It does not delete service conversations or change chat and browser history.', pt: 'Reiniciar limpa as duas colunas e seus ponteiros neste navegador, mantendo os agentes escolhidos. Não exclui conversas no serviço nem altera o chat e o histórico do navegador.' },
  'compare.locked': { en: 'Agent changes and restart are unavailable while either column is streaming. Stop listening to both columns first, or wait.', pt: 'Trocar agentes e reiniciar ficam indisponíveis enquanto uma coluna transmite. Pare de ouvir as duas colunas primeiro ou aguarde.' },
  'events.runOf': { en: '\u00d7{count}', pt: '\u00d7{count}' },
  'events.verified': {
    en: '{verified} of {total} Foundry event names verified against a recorded run',
    pt: '{verified} de {total} nomes de eventos do Foundry verificados em uma execu\u00e7\u00e3o gravada',
  },
  'events.truncated': {
    en: 'This turn produced more events than are kept; the rest are not shown.',
    pt: 'Este turno produziu mais eventos do que s\u00e3o guardados; o restante n\u00e3o \u00e9 exibido.',
  },
  'events.copy': { en: 'Copy this payload', pt: 'Copiar este payload' },
  'keys.toggleEvents': { en: 'Show the events', pt: 'Mostrar os eventos' },

  // --- Preferences, and a second theme (spec 036) --------------------------
  // The lead is the load-bearing one: it says these are THIS BROWSER's, which is the distinction
  // between this screen and /about, where the deployment's facts are read-only.
  'prefs.title': { en: 'Preferences', pt: 'Prefer\u00eancias' },
  'prefs.lead': {
    en: 'Kept in this browser only. Nothing here is sent anywhere, and nothing here changes what the agent does.',
    pt: 'Guardado apenas neste navegador. Nada aqui \u00e9 enviado, e nada aqui muda o que o agente faz.',
  },
  'prefs.notStored': {
    en: 'This browser will not store preferences, so these last until you close the tab.',
    pt: 'Este navegador n\u00e3o guarda prefer\u00eancias, ent\u00e3o estas valem at\u00e9 fechar a aba.',
  },
  'prefs.theme': { en: 'Theme', pt: 'Tema' },
  'prefs.theme.system': { en: 'Follow the system', pt: 'Seguir o sistema' },
  'prefs.theme.light': { en: 'Light', pt: 'Claro' },
  'prefs.theme.dark': { en: 'Dark', pt: 'Escuro' },
  'prefs.language': { en: 'Language', pt: 'Idioma' },
  'prefs.behaviour': { en: 'Behaviour', pt: 'Comportamento' },
  'prefs.speakAnswers': { en: 'Speak answers aloud', pt: 'Ler as respostas em voz alta' },
  'prefs.reasoningOpen': { en: 'Start the reasoning card open', pt: 'Abrir o card de racioc\u00ednio' },
  'prefs.activityOpen': { en: 'Start the activity panel expanded', pt: 'Abrir o painel de atividade' },
  'sidebar.preferences': { en: 'Preferences', pt: 'Prefer\u00eancias' },

  // --- Tables and code you can take (spec 035) -----------------------------
  // `copy.copied` / `copy.failed` are reused rather than restated: one clipboard behaviour means
  // one set of words for whether it worked (\u00a74).
  'code.copy': { en: 'Copy this code', pt: 'Copiar este c\u00f3digo' },
  'table.copy': { en: 'Copy this table', pt: 'Copiar esta tabela' },

  // --- Where an answer came from (spec 034) --------------------------------
  //
  // The wording has to stay on the right side of one line: we know what the agent CONSULTED, not
  // what it used. "Sources" and "from" say that; anything like "according to" would claim the app
  // knows which source supports which sentence, which it does not (\u00a75).
  'sources.title': { en: 'Sources', pt: 'Fontes' },
  'sources.from': { en: 'from {tool}', pt: 'de {tool}' },
  'sources.knowledgeBase': {
    en: 'project knowledge base',
    pt: 'base de conhecimento do projeto',
  },
  'sources.failed': { en: 'this lookup failed', pt: 'esta consulta falhou' },
  'sources.openCall': {
    en: 'Open the call that produced this',
    pt: 'Abrir a chamada que produziu isto',
  },
  'export.sources': { en: 'Sources', pt: 'Fontes' },

  // --- Charts and diagrams in an answer (spec 033) -------------------------
  //
  // The reason codes are deliberately specific. Someone whose block did not draw is debugging
  // their agent's INSTRUCTIONS, and "invalid" would make the failure unteachable \u2014 which is the
  // whole argument for rendering the block instead of hiding it.
  'chart.described': { en: 'Chart: {what}', pt: 'Gr\u00e1fico: {what}' },
  'chart.couldNotDraw': {
    en: 'This block could not be drawn as a chart',
    pt: 'N\u00e3o foi poss\u00edvel desenhar este bloco como gr\u00e1fico',
  },
  'chart.reason.bad_json': { en: 'it is not valid JSON', pt: 'n\u00e3o \u00e9 JSON v\u00e1lido' },
  'chart.reason.unknown_type': {
    en: 'that chart type is not supported \u2014 use bar or line',
    pt: 'esse tipo de gr\u00e1fico n\u00e3o \u00e9 suportado \u2014 use bar ou line',
  },
  'chart.reason.no_categories': {
    en: 'it declares no categories',
    pt: 'n\u00e3o declara categorias',
  },
  'chart.reason.no_series': { en: 'it declares no series', pt: 'n\u00e3o declara s\u00e9ries' },
  'chart.reason.too_many_series': {
    en: 'it has more than four series',
    pt: 'tem mais de quatro s\u00e9ries',
  },
  'chart.reason.length_mismatch': {
    en: 'a series has a different number of values than there are categories',
    pt: 'uma s\u00e9rie tem um n\u00famero de valores diferente do n\u00famero de categorias',
  },
  'chart.reason.bad_value': { en: 'a value is not a number', pt: 'um valor n\u00e3o \u00e9 um n\u00famero' },
  'chart.reason.missing_label': {
    en: 'a series has no label',
    pt: 'uma s\u00e9rie est\u00e1 sem r\u00f3tulo',
  },
  'diagram.described': { en: 'Diagram', pt: 'Diagrama' },
  'diagram.couldNotDraw': {
    en: 'This block could not be drawn as a diagram',
    pt: 'N\u00e3o foi poss\u00edvel desenhar este bloco como diagrama',
  },

  // --- What this build is talking to (spec 032) ----------------------------
  //
  // The panel renders `GET /config` and nothing else. Every field needs a name in both languages,
  // which is most of what this block is; the interesting strings are the three that carry judgement
  // \u2014 the lead (nothing here is editable), the note (what "unverified" means, standing in for a link
  // this app cannot honestly provide), and `notReported`, which must never read like "no".
  'about.title': { en: 'What this build is', pt: 'O que \u00e9 esta build' },
  'about.lead': {
    en: 'Facts about this deployment, decided by its configuration. Nothing here can be changed from the browser.',
    pt: 'Fatos sobre esta implanta\u00e7\u00e3o, definidos pela sua configura\u00e7\u00e3o. Nada aqui pode ser alterado pelo navegador.',
  },
  'about.loading': { en: 'Reading the configuration\u2026', pt: 'Lendo a configura\u00e7\u00e3o\u2026' },
  'about.failed': {
    en: 'The configuration could not be read',
    pt: 'N\u00e3o foi poss\u00edvel ler a configura\u00e7\u00e3o',
  },
  'about.notReported': { en: 'not reported', pt: 'n\u00e3o informado' },
  'about.yes': { en: 'yes', pt: 'sim' },
  'about.no': { en: 'no', pt: 'n\u00e3o' },

  'about.whoAnswers': { en: 'Who answers', pt: 'Quem responde' },
  'about.routing': { en: 'How inference routes', pt: 'Como a infer\u00eancia \u00e9 roteada' },
  'about.observable': { en: 'What is observable', pt: 'O que \u00e9 observ\u00e1vel' },
  'about.voice': { en: 'What voice can do', pt: 'O que a voz pode fazer' },
  'about.contract': { en: 'The event contract', pt: 'O contrato de eventos' },
  'about.mayChange': { en: 'What this build may change', pt: 'O que esta build pode alterar' },

  'about.field.project': { en: 'Foundry project', pt: 'Projeto Foundry' },
  'about.field.agent': { en: 'Agent', pt: 'Agente' },
  'about.field.agentVersion': { en: 'Version', pt: 'Vers\u00e3o' },
  'about.field.harness': { en: 'Harness', pt: 'Harness' },
  'about.field.model': { en: 'Model', pt: 'Modelo' },
  'about.field.usesGateway': { en: 'Through the AI Gateway', pt: 'Atrav\u00e9s do AI Gateway' },
  'about.field.tracing': { en: 'Tracing enabled', pt: 'Tracing habilitado' },
  'about.field.gatewayLogged': {
    en: 'Gateway writes spans',
    pt: 'O gateway grava spans',
  },
  'about.field.speech': { en: 'Spoken answers', pt: 'Respostas faladas' },
  'about.field.voiceEnabled': { en: 'Voice Live available', pt: 'Voice Live dispon\u00edvel' },
  'about.field.webrtcApiVersion': { en: 'WebRTC api-version', pt: 'api-version do WebRTC' },
  'about.field.pricing': { en: 'Rate table configured', pt: 'Tabela de pre\u00e7os configurada' },
  'about.field.pricingRecorded': { en: 'Rates read on', pt: 'Pre\u00e7os lidos em' },
  'about.field.canPropose': {
    en: 'Can propose a change to an agent',
    pt: 'Pode propor uma altera\u00e7\u00e3o num agente',
  },
  'about.field.playground': {
    en: 'Tool playground enabled',
    pt: 'Playground de ferramentas habilitado',
  },
  // --- Demo mode (spec 050) -------------------------------------------------
  // The banner is the one thing standing between a recorded answer and a reader who takes it for a
  // live one, so its wording is load-bearing: it names the replay, dates it, and says the answer
  // does not depend on the question — the fact a reader would otherwise discover by typing twice.
  'about.field.demo': { en: 'Replaying a recording', pt: 'Reproduzindo uma gravação' },
  'about.field.demoRecorded': { en: 'Recorded on', pt: 'Gravado em' },
  'demo.title': { en: 'Replay', pt: 'Reprodução' },
  'demo.body': {
    en: 'This build is replaying a conversation recorded against a real Foundry project on {date}. Nothing is being sent anywhere, and the answer does not depend on what you type.',
    pt: 'Esta build está reproduzindo uma conversa gravada em um projeto Foundry real em {date}. Nada está sendo enviado a lugar nenhum, e a resposta não depende do que você digitar.',
  },
  'demo.pick': { en: 'Recorded turn', pt: 'Turno gravado' },
  'demo.recording.round-trip': {
    en: 'Function-call round trip, with Microsoft Learn',
    pt: 'Ida e volta de function call, com o Microsoft Learn',
  },
  'demo.recording.no-reasoning': {
    en: 'The same turn, with no reasoning summaries',
    pt: 'O mesmo turno, sem resumos de raciocínio',
  },
  'demo.recording.preamble': {
    en: 'The agent says what it is about to look up',
    pt: 'O agente diz o que vai consultar',
  },
  'about.field.canPromote': {
    en: 'Can roll an agent back to an earlier version',
    pt: 'Pode reverter um agente para uma vers\u00e3o anterior',
  },

  'about.events.types': { en: 'Event types', pt: 'Tipos de evento' },
  'about.events.count': {
    en: '{verified} of {total} Foundry event names verified against a recorded run',
    pt: '{verified} de {total} nomes de eventos do Foundry verificados em uma execu\u00e7\u00e3o gravada',
  },
  'about.events.unverified': {
    en: 'Not yet seen in a recorded run',
    pt: 'Ainda n\u00e3o vistos em uma execu\u00e7\u00e3o gravada',
  },
  'about.events.allVerified': {
    en: 'Every event name has been seen in a recorded run',
    pt: 'Todos os nomes de eventos j\u00e1 foram vistos em uma execu\u00e7\u00e3o gravada',
  },
  'about.events.note': {
    en: 'These are mapped from documented payload shapes and have not been observed. See docs/REFERENCES.md in the repository.',
    pt: 'Estes s\u00e3o mapeados a partir de formatos documentados e ainda n\u00e3o foram observados. Veja docs/REFERENCES.md no reposit\u00f3rio.',
  },

  'sidebar.about': { en: 'What this build is', pt: 'O que \u00e9 esta build' },

  // --- Versions, and going back to one (spec 031) --------------------------
  //
  // The confirmation's body is the load-bearing string in this file. Every other persistent thing
  // in this app is local to one browser; this one changes what the project serves for everybody,
  // and a reader who has only seen the local ones has no reason to expect that.
  'versions.title': { en: 'Versions', pt: 'Vers\u00f5es' },
  'versions.loading': { en: 'Reading the versions\u2026', pt: 'Lendo as vers\u00f5es\u2026' },
  'versions.none': {
    en: "This agent's versions were not reported",
    pt: 'As vers\u00f5es deste agente n\u00e3o foram informadas',
  },
  'versions.served': { en: 'serving', pt: 'em uso' },
  'versions.latest': { en: 'latest', pt: 'mais recente' },
  'versions.pinned': {
    en: 'This project is pinned to v{version}; the newest is v{latest}',
    pt: 'Este projeto est\u00e1 fixado na v{version}; a mais recente \u00e9 a v{latest}',
  },
  'versions.created': { en: 'created {when}', pt: 'criada em {when}' },
  'versions.notReported': { en: 'not reported', pt: 'n\u00e3o informado' },
  'versions.promote': { en: 'Use this version', pt: 'Usar esta vers\u00e3o' },
  'versions.promoting': { en: 'Switching\u2026', pt: 'Trocando\u2026' },
  'versions.confirm.title': {
    en: 'Serve version {version}?',
    pt: 'Servir a vers\u00e3o {version}?',
  },
  'versions.confirm.body': {
    en: 'This changes which version answers for everyone using this project, not only in this browser. It applies from the next turn.',
    pt: 'Isto muda qual vers\u00e3o responde para todos que usam este projeto, n\u00e3o apenas neste navegador. Vale a partir do pr\u00f3ximo turno.',
  },
  'versions.confirm.ok': { en: 'Serve this version', pt: 'Servir esta vers\u00e3o' },
  'versions.confirm.cancel': { en: 'Cancel', pt: 'Cancelar' },
  'versions.reason.served': {
    en: 'This is the version being served',
    pt: 'Esta \u00e9 a vers\u00e3o em uso',
  },
  'versions.reason.not_owned': {
    en: 'This agent was not created by this repository',
    pt: 'Este agente n\u00e3o foi criado por este reposit\u00f3rio',
  },
  'versions.error.write_disabled': {
    en: 'Changing versions is turned off in this deployment',
    pt: 'A troca de vers\u00f5es est\u00e1 desligada nesta implanta\u00e7\u00e3o',
  },
  'versions.error.not_owned': {
    en: 'This agent was not created by this repository',
    pt: 'Este agente n\u00e3o foi criado por este reposit\u00f3rio',
  },
  'versions.error.forbidden': {
    en: 'This build is not allowed to change the project',
    pt: 'Esta build n\u00e3o tem permiss\u00e3o para alterar o projeto',
  },
  'versions.error.unknown_version': {
    en: 'That version no longer exists',
    pt: 'Essa vers\u00e3o n\u00e3o existe mais',
  },
  'versions.error.unavailable': {
    en: 'The project could not be reached',
    pt: 'N\u00e3o foi poss\u00edvel acessar o projeto',
  },

  'agents.reason.no_harness': {
    en: 'This build has no harness for this kind of agent',
    pt: 'Esta build n\u00e3o tem harness para este tipo de agente',
  },
  'agents.reason.disabled': {
    en: 'This agent is disabled in the project',
    pt: 'Este agente est\u00e1 desabilitado no projeto',
  },
  'agents.reason.version_not_active': {
    en: 'Its served version is not active yet',
    pt: 'A vers\u00e3o publicada ainda n\u00e3o est\u00e1 ativa',
  },
  // Spec 050. A different fact from `no_harness`: this build HAS the harness, and the demo has no
  // recording to replay through it. Saying the first would be a lie about the build (\u00a75).
  'agents.reason.demo_not_recorded': {
    en: 'This demo has no recording for this agent',
    pt: 'Esta demonstra\u00e7\u00e3o n\u00e3o tem grava\u00e7\u00e3o para este agente',
  },
  // Not in the plan's table, and added for a reason AC5 forces: a dimmed row with no explanation
  // is exactly what AC5 forbids, and the BFF's reason codes can grow. `types/agents.test.ts` fails
  // the moment the backend adds a fourth code, so this is a floor, not a place to hide one.
  'agents.reason.unknown': {
    en: 'This agent cannot be selected',
    pt: 'Este agente n\u00e3o pode ser selecionado',
  },
  'agents.switched': {
    en: 'New conversation started with {name}',
    pt: 'Nova conversa iniciada com {name}',
  },
  'agents.error.unavailable': {
    en: 'The project\u2019s agents could not be listed',
    pt: 'N\u00e3o foi poss\u00edvel listar os agentes do projeto',
  },
  'agents.error.unconfigured': {
    en: 'No Foundry project is configured',
    pt: 'Nenhum projeto Foundry configurado',
  },
  'agents.error.forbidden': {
    en: 'This identity cannot list the project\u2019s agents',
    pt: 'Esta identidade n\u00e3o pode listar os agentes do projeto',
  },
  'agents.fallback': {
    en: 'Showing the configured agent only',
    pt: 'Mostrando apenas o agente configurado',
  },
  // --- Agents screen (spec 021) --------------------------------------------
  'agents.searchLabel': { en: 'Search agents', pt: 'Buscar agentes' },
  'agents.noMatches': { en: 'No agent matches that.', pt: 'Nenhum agente corresponde.' },
  'agents.count': { en: '{n} in this project', pt: '{n} neste projeto' },
  'agents.model': { en: 'model', pt: 'modelo' },
  'agents.answeringCard': { en: 'Answering', pt: 'Respondendo' },
  // Favourites (spec 022). A mark this browser keeps — nothing is written to the project.
  'agents.favourite': {
    en: 'Add {name} to favourites',
    pt: 'Adicionar {name} aos favoritos',
  },
  'agents.unfavourite': {
    en: 'Remove {name} from favourites',
    pt: 'Remover {name} dos favoritos',
  },
  'favourites.title': { en: 'Favourites', pt: 'Favoritos' },
  // A conversation restored from this browser whose agent the project no longer offers. It stays
  // readable; it does not quietly get answered by somebody else (AC18).
  'agents.blocked': {
    en: 'The agent that held this conversation is not available. Start a new session to keep going.',
    pt: 'O agente que conduziu esta conversa não está disponível. Inicie uma nova sessão para continuar.',
  },

  // --- Navigation and history (spec 021) -----------------------------------
  // The rail has two views and a collapse. Everything it says about a conversation it stored is
  // said here: the browser keeps a render cache, and the note under the list admits exactly that.
  'nav.chat': { en: 'Chat', pt: 'Conversa' },
  'nav.agents': { en: 'Agents', pt: 'Agentes' },
  'nav.playground': { en: 'Playground', pt: 'Playground' },
  // The Playground (spec 060): one agent beside its definition, a second to compare with, and the
  // tool runner (spec 042) as its own tab.
  'playground.title': { en: 'Playground', pt: 'Playground' },
  'playground.lead': {
    en: 'Try an agent, see its definition beside the answers, and compare it with another.',
    pt: 'Experimente um agente, veja a definição dele ao lado das respostas e compare com outro.',
  },
  'playground.tab.agent': { en: 'Agent', pt: 'Agente' },
  'playground.tab.tools': { en: 'Tools', pt: 'Ferramentas' },
  'playground.toolsOff': {
    en: 'The tool runner is off in this deployment.',
    pt: 'O executor de ferramentas está desligado nesta implantação.',
  },
  'playground.definition': { en: 'Definition', pt: 'Definição' },
  'playground.readOnly': {
    en: 'Read-only — this is what Foundry reports.',
    pt: 'Somente leitura — é o que o Foundry informa.',
  },
  'playground.openDetail': { en: 'Open agent details', pt: 'Abrir detalhes do agente' },
  'playground.noAgent': { en: 'No agent is answering yet.', pt: 'Nenhum agente está respondendo ainda.' },
  // The theme switch in the rail footer (spec 060). Named for what pressing it DOES.
  'theme.toDark': { en: 'Switch to dark theme', pt: 'Mudar para tema escuro' },
  'theme.toLight': { en: 'Switch to light theme', pt: 'Mudar para tema claro' },
  // The empty chat (spec 060). By the browser's clock; the app knows nobody's name.
  'greeting.morning': { en: 'Good morning.', pt: 'Bom dia.' },
  'greeting.afternoon': { en: 'Good afternoon.', pt: 'Boa tarde.' },
  'greeting.evening': { en: 'Good evening.', pt: 'Boa noite.' },
  'greeting.lead': {
    en: 'Ask the agent. It answers in Foundry, and this app shows how it got there.',
    pt: 'Pergunte ao agente. Ele responde no Foundry, e este app mostra como chegou lá.',
  },
  'history.conversations': { en: 'Conversations', pt: 'Conversas' },
  // Spec 047: below the narrow breakpoint the rail is an overlay, and this opens it.
  'nav.openMenu': { en: 'Open the menu', pt: 'Abrir o menu' },
  'nav.closeMenu': { en: 'Close the menu', pt: 'Fechar o menu' },
  'nav.collapse': { en: 'Collapse sidebar', pt: 'Recolher barra lateral' },
  'nav.expand': { en: 'Expand sidebar', pt: 'Expandir barra lateral' },
  'history.today': { en: 'Today', pt: 'Hoje' },
  'history.week': { en: 'Last 7 days', pt: 'Últimos 7 dias' },
  'history.older': { en: 'Older', pt: 'Mais antigas' },
  'history.empty': {
    en: 'Conversations you have will show up here.',
    pt: 'As conversas que você tiver aparecem aqui.',
  },
  // The honest half (§5). This is a drawing this browser kept, not Foundry's conversation store —
  // and the reader is told which one they are looking at.
  'history.local': {
    en: 'Kept in this browser only — not the Foundry conversation store.',
    pt: 'Guardado só neste navegador — não é o armazenamento de conversas do Foundry.',
  },
  'history.unavailable': {
    en: 'This browser is not storing history.',
    pt: 'Este navegador não está guardando histórico.',
  },
  'history.rename': { en: 'Rename', pt: 'Renomear' },
  'history.delete': { en: 'Delete', pt: 'Excluir' },
  'history.untitled': { en: 'Untitled conversation', pt: 'Conversa sem título' },
  'history.open': { en: 'Open conversation', pt: 'Abrir conversa' },

  // Spec 027 — searching the record, and taking it out of this browser.
  'history.search': { en: 'Search conversations', pt: 'Buscar conversas' },
  'history.searchEmpty': {
    en: 'No conversation matches',
    pt: 'Nenhuma conversa corresponde',
  },
  'history.matchTool': { en: 'tool', pt: 'ferramenta' },
  'history.matchServer': { en: 'MCP server', pt: 'servidor MCP' },

  // --- Header --------------------------------------------------------------
  'header.foundryPill': { en: 'Microsoft Foundry', pt: 'Microsoft Foundry' },
  'header.harnessLabel': { en: 'harness', pt: 'harness' },
  'buildInfo.title': { en: 'Build information', pt: 'Informações desta versão' },
  'buildInfo.close': { en: 'Close build information', pt: 'Fechar informações desta versão' },
  'header.voice': { en: 'Voice', pt: 'Voz' },
  'header.voiceUnavailable': {
    en: 'Voice is not configured on this server.',
    pt: 'A voz não está configurada neste servidor.',
  },
  'header.traces': { en: 'Traces', pt: 'Rastros' },
  'header.status': { en: 'Idle', pt: 'Ocioso' },
  'header.statusLoading': { en: 'Loading configuration', pt: 'Carregando configuração' },
  'header.statusUnavailable': { en: 'Information unavailable', pt: 'Informações indisponíveis' },
  'header.readUnavailable': { en: 'Configuration or agent information could not be loaded. Reload to read it again, or inspect the connection details. This is not a service health check.', pt: 'Não foi possível carregar a configuração ou as informações dos agentes. Recarregue para ler novamente ou inspecione os detalhes da conexão. Isto não é uma verificação de saúde do serviço.' },
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
  // The three example questions that used to live here now live in the agent's own definition
  // (`ai/harness/_shared/agent_core.yaml`, spec 037). What an agent is worth being asked is a
  // property of the agent, and a copy in TypeScript was free to drift from the one that ships.

  // --- Composer ------------------------------------------------------------
  'composer.placeholder': { en: 'Ask the agent something', pt: 'Pergunte algo ao agente' },
  // --- Asking again (spec 026) ----------------------------------------------
  // A person pressing repeat is a person asking again. The mark exists because both turns stay on
  // screen, and without it the second reads as a second question.
  'answer.repeat': { en: 'Ask again', pt: 'Perguntar de novo' },
  'question.edit': { en: 'Edit this question', pt: 'Editar esta pergunta' },
  'turn.repeatOf': { en: 'Asked again \u00b7 {agent}', pt: 'Perguntado de novo \u00b7 {agent}' },

  // --- The keyboard and the palette (spec 025) ------------------------------
  // Every action's label lives here and is named by `state/keys.ts`, so the palette entry, the
  // tooltip and the binding all say the same thing (§4).

  'keys.focusComposer': { en: 'Write a question', pt: 'Escrever uma pergunta' },
  'keys.newConversation': { en: 'New conversation', pt: 'Nova conversa' },
  'keys.toggleTraces': { en: 'Traces', pt: 'Traces' },
  'keys.toggleRail': { en: 'Collapse the rail', pt: 'Recolher a barra' },
  'keys.previousTurn': { en: 'Previous turn', pt: 'Turn anterior' },
  'keys.nextTurn': { en: 'Next turn', pt: 'Próximo turn' },

  // Spec 028 — what a turn cost. Every one of these is written so the figure cannot be read as
  // measured: it is an estimate from token counts and declared rates, and it says so.
  'cost.estimate': { en: 'est.', pt: 'est.' },
  'cost.turn': { en: 'Estimated cost', pt: 'Custo estimado' },
  'cost.conversation': { en: 'This conversation so far', pt: 'Esta conversa até agora' },
  'cost.partial': {
    en: 'Partial — {count} turns could not be priced',
    pt: 'Parcial — {count} turns não puderam ser precificados',
  },
  'cost.ratesTitle': { en: 'Rates recorded {date}', pt: 'Taxas anotadas em {date}' },
  'cost.rateInput': { en: 'input / 1M', pt: 'entrada / 1M' },
  'cost.rateCachedInput': { en: 'cached input / 1M', pt: 'entrada em cache / 1M' },
  'cost.rateOutput': { en: 'output / 1M', pt: 'saída / 1M' },
  'cost.excludesContainer': {
    en: 'Inference only — the hosted harness also bills container compute, which this figure excludes.',
    pt: 'Somente inferência — o harness hosted também cobra compute de container, que esta figura não inclui.',
  },
  'meta.cachedInput': { en: 'cached input', pt: 'entrada em cache' },

  // Spec 029 — the shape of a turn. Every string here is about what the picture IS and is not:
  // one leg, measured from spans, with the app's own tool time necessarily missing.
  // Spec 030 — the agent, inspected. `reasoning`, `cpu` and `container` are the service's own
  // vocabulary: a reader matching this screen against the portal wants the same word.
  'agent.back': { en: 'All agents', pt: 'Todos os agentes' },
  'agent.choose': { en: 'Talk to this agent', pt: 'Falar com este agente' },
  'agent.inspect': { en: 'Inspect this agent', pt: 'Inspecionar este agente' },
  'agent.instructions': { en: 'Instructions', pt: 'Instruções' },
  'agent.tools': { en: 'Tools', pt: 'Ferramentas' },
  'agent.reasoning': { en: 'Reasoning', pt: 'Reasoning' },
  'agent.container': { en: 'Container', pt: 'Container' },
  'agent.image': { en: 'image', pt: 'imagem' },
  'agent.cpu': { en: 'cpu', pt: 'cpu' },
  'agent.memory': { en: 'memory', pt: 'memória' },
  'agent.protocols': { en: 'protocols', pt: 'protocolos' },
  'agent.notReported': {
    en: 'not reported by the service',
    pt: 'não reportado pelo serviço',
  },
  'agent.executedByApp': { en: 'executed by this app', pt: 'executada por este app' },
  'agent.executedByFoundry': { en: 'executed by Foundry', pt: 'executada pelo Foundry' },
  'agent.schema': { en: 'parameters', pt: 'parâmetros' },
  'agent.approval': { en: 'approval', pt: 'aprovação' },
  'agent.notFound': {
    en: 'This project has no agent by that name.',
    pt: 'Este projeto não tem um agente com esse nome.',
  },

  'timeline.title': { en: 'Where the time went', pt: 'Onde o tempo foi' },
  'timeline.axisNote': {
    en: 'Measured from the spans of this leg',
    pt: 'Medido a partir dos spans desta perna',
  },
  'timeline.legendRun': { en: 'the run', pt: 'a execução' },
  'timeline.legendModel': { en: 'model', pt: 'modelo' },
  'timeline.legendTool': { en: 'executed by Foundry', pt: 'executado pelo Foundry' },
  'timeline.legendGap': { en: 'unattributed', pt: 'não atribuído' },
  'timeline.otherLeg': {
    en: 'This turn had a tool round trip. The earlier leg is a separate trace and is not drawn.',
    pt: 'Este turno teve um round trip de tool. A perna anterior é outro trace e não está desenhada.',
  },

  // --- Addresses (spec 024) ------------------------------------------------
  // An address naming a conversation this browser never had is a normal thing to open — a link
  // from another machine. It is stated, not redirected away from.
  'route.conversationMissing': {
    en: 'This browser does not have that conversation.',
    pt: 'Este navegador não tem essa conversa.',
  },
  'trace.conversationElsewhere': {
    en: 'The spans are here; the conversation is not stored in this browser.',
    pt: 'Os spans estão aqui; a conversa não está guardada neste navegador.',
  },

  // --- Stopping a turn (spec 023) ------------------------------------------
  // The line a stopped turn carries says two things we can verify: we interrupted, and we did not
  // cancel anything in Foundry. Nothing about tokens or cost — that was never measured (§5).
  'composer.stop': { en: 'Stop', pt: 'Parar' },
  'composer.newline': {
    en: 'Shift + Enter for a new line',
    pt: 'Shift + Enter para nova linha',
  },
  'turn.stopped': {
    en: 'Interrupted here. The run may still be finishing in Foundry.',
    pt: 'Interrompido aqui. O run pode continuar no Foundry.',
  },
  'turn.stoppedShort': { en: 'interrupted', pt: 'interrompido' },

  'composer.send': { en: 'Send', pt: 'Enviar' },
  'composer.voiceInput': { en: 'Voice input', pt: 'Entrada por voz' },
  // The chip names who is about to answer, where the question is being typed (spec 021).
  'composer.answeringWith': { en: 'Answering with {name}', pt: 'Respondendo com {name}' },
  'composer.chooseAgent': {
    en: 'Choose which agent answers',
    pt: 'Escolher qual agente responde',
  },
  'composer.allAgents': { en: 'See all agents', pt: 'Ver todos os agentes' },

  // --- Conversation --------------------------------------------------------
  'turn.you': { en: 'You', pt: 'Você' },
  'turn.agent': { en: 'Agent', pt: 'Agente' },
  'turn.activityTitle': { en: 'Agent activity', pt: 'Atividade do agente' },
  'turn.pending': { en: 'The agent is working', pt: 'O agente está trabalhando' },
  'turn.thinking': { en: 'Thinking', pt: 'Pensando' },
  'turn.calling': { en: 'Calling', pt: 'Chamando' },
  'turn.step': { en: 'Step', pt: 'Passo' },

  // --- Reasoning card ------------------------------------------------------
  'reasoning.title': { en: 'Reasoning', pt: 'Raciocínio' },
  'reasoning.streaming': { en: 'thinking', pt: 'pensando' },
  'reasoning.toggle': { en: 'Show or hide the reasoning summary', pt: 'Mostrar ou ocultar o resumo do raciocínio' },
  // The turn, and only the turn. The copy this replaced told the reader their deployment had no
  // reasoning model — which the live service contradicted: `gpt-5.5` with `reasoning.summary` set
  // spent reasoning tokens and simply declined to summarise that turn (spec 015).
  'reasoning.absentBody': {
    en: 'No reasoning summary this turn.',
    pt: 'Sem resumo de raciocínio neste turno.',
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
  // Spec 020: the browser's clock, like the latency beside it. Two agents given the same
  // question usually differ far more in how long they sit silent than in the total.
  'meta.firstToken': { en: 'to first token', pt: 'até o primeiro token' },
  'meta.cachedTokens': { en: 'cached', pt: 'cache' },
  'meta.agentVersion': { en: 'version', pt: 'versão' },
  'meta.viewTrace': { en: 'view trace', pt: 'ver rastro' },

  // --- Answer actions and the Markdown export (spec 021) -------------------
  'answer.copy': { en: 'Copy answer', pt: 'Copiar resposta' },
  'answer.download': { en: 'Download as Markdown', pt: 'Baixar em Markdown' },
  'answer.trace': { en: 'Open trace', pt: 'Abrir rastro' },
  'export.question': { en: 'Question', pt: 'Pergunta' },
  'export.answer': { en: 'Answer', pt: 'Resposta' },
  'export.calls': { en: 'Calls', pt: 'Chamadas' },
  'export.noCalls': { en: 'This turn made no calls.', pt: 'Este turno não fez chamadas.' },
  'export.noAnswer': { en: '(no answer text)', pt: '(sem texto de resposta)' },

  // --- Errors --------------------------------------------------------------
  'error.title': { en: 'The turn failed', pt: 'O turno falhou' },
  'error.next': { en: 'Inspect the retained Events and reported error. You can send a new question manually; it may fail again. Restarting comparison is only a local reset, not a service repair.', pt: 'Inspecione os Eventos retidos e o erro informado. Você pode enviar uma nova pergunta manualmente; ela pode falhar novamente. Reiniciar a comparação é apenas um reset local, não um reparo do serviço.' },
  'error.hint': {
    en: 'These are the error details reported for this turn, not a diagnosis of the service.',
    pt: 'Estes são os detalhes do erro informado neste turno, não um diagnóstico do serviço.',
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
  // Copying is one behaviour with two callers — the trace panel's identifiers and the answer's
  // action row — so the words live outside either of them (§4, spec 021).
  'copy.label': { en: 'Copy', pt: 'Copiar' },
  'copy.copied': { en: 'copied', pt: 'copiado' },
  'copy.failed': { en: 'could not copy', pt: 'não foi possível copiar' },
  'trace.numbersTitle': { en: 'Run', pt: 'Execução' },
  'trace.otelTraceId': { en: 'otel trace id', pt: 'otel trace id' },
  'trace.spansPending': {
    en: 'Spans have not arrived yet.',
    pt: 'Os spans ainda não chegaram.',
  },
  'trace.spansRetry': { en: 'Check again', pt: 'Verificar de novo' },
  'trace.spansUnavailable': {
    en: 'Tracing is not configured on this deployment.',
    pt: 'O tracing não está configurado neste ambiente.',
  },
  'trace.spansDenied': {
    en: 'No permission to read the workspace. Log Analytics Reader is required.',
    pt: 'Sem permissão para ler o workspace. É necessário Log Analytics Reader.',
  },
  'trace.spansFailed': { en: 'The trace query failed.', pt: 'A consulta do rastro falhou.' },
  'trace.spansLoading': { en: 'Reading the spans…', pt: 'Lendo os spans…' },
  'trace.clientSideNote': {
    en: 'Foundry traces what Foundry runs. Tools this app executes leave no span.',
    pt: 'O Foundry rastreia o que o Foundry executa. Ferramentas que este app executa não deixam span.',
  },
  'trace.gatewayTitle': { en: 'gateway', pt: 'gateway' },
  'trace.gatewayCarried': {
    en: 'This run went through the gateway, which does not record requests. Enabling GatewayLogs would correlate them.',
    pt: 'Esta execução passou pelo gateway, que não registra requisições. Habilitar GatewayLogs permitiria correlacioná-las.',
  },
  'trace.gatewayNone': {
    en: 'This run did not go through a gateway.',
    pt: 'Esta execução não passou por um gateway.',
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
  // The Foundry portal's own name for the screen (spec 060); Portuguese-language Azure docs keep it.
  'nav.playground',
  'playground.title',
  // This repository's own word for a swappable adapter, used as a proper noun throughout the docs,
  // the code and `GET /config`'s `harness` field. "Arn\u00eas" would be a translation of the metaphor
  // rather than of the term, and a reader comparing the panel with the endpoint would lose the
  // thread (spec 032).
  'about.field.harness',
  // A count, not a word: \u00d7{count} reads the same in both languages (spec 038).
  'events.runOf',
  // A number and a unit symbol, identical in both languages (spec 039).
  'voice.elapsed',
  // A number and a unit symbol (spec 042).
  'tools.duration',
  // Foundry's own vocabulary. `prompt` and `workflow` are the literal `definition.kind` values the
  // service returns, and translating them would stop the screen matching the portal a reader has
  // open beside it. `hosted` DOES translate, because "hospedado" is an ordinary Portuguese word
  // that says the same thing.
  'agents.kind.prompt',
  'agents.kind.workflow',
  'agents.version',
  'header.foundryPill',
  'header.harnessLabel',
  'meta.tokens',
  'trace.responseId',
  'trace.conversationId',
  'trace.spansTitle',
  'trace.otelTraceId',
  'trace.gatewayTitle',
  // The panel is called "Traces" in both languages for the same reason `trace.spansTitle` is: it is
  // the word the portal and the docs use, and a reader matching the screen against either wants it
  // to be the same word (spec 025).
  'keys.toggleTraces',
  // `est.` is the abbreviation in both languages, and the whole job of this string is to be short
  // enough to sit inside the figure rather than under it (spec 028).
  'cost.estimate',
  // The service's own words. A reader comparing this screen with the portal wants them unchanged
  // (spec 030), the same reason `agents.kind.prompt` is on this list.
  'agent.reasoning',
  'agent.container',
  'agent.cpu',
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
