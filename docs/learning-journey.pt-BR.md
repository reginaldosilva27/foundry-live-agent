# Trilha de aprendizado — observar antes de estender

[English](learning-journey.md) · [Arquitetura](architecture.md) ·
[Comparação medida](harness-comparison.md) · [Referências de APIs/evidências](REFERENCES.md)

Este projeto é uma referência educacional, não uma receita de implantação em produção. Conheça a
stack GenAI do Azure acompanhando uma pergunta pelas fronteiras: modelo, runtime do agente, tools,
harness, aplicação, telemetria e voz. Copilot pode ajudar a navegar pelo código e propor testes;
esta trilha não entrega uma integração com serviço Copilot nem escolhe seu produto.

## Drift em execução sem revelar conteúdo (#39, spec 057)

[Diagnósticos de streaming](how-it-works/streaming-events.md#mapping-coverage-versus-runtime-diagnostics-spec-057-39)
separa evidência offline de mapeamento em `GET /config` dos tipos desconhecidos encontrados em
um turno prompt/hosted. Tipos conhecidos de ciclo de vida/parciais são ignorados de propósito,
não são drift. Logs do servidor emitem um resumo limitado por turno: 16 aliases opacos locais
ao turno, contador `invalid_type` e **ocorrências omitidas**, não tipos distintos omitidos.
Nomes internos têm limite de 96 caracteres ASCII e nunca entram nos logs; contadores saturam
em 1.000.000 com flags explícitas. Aliases não identificam um tipo entre turnos. Investigar a
forma real exige gravações revisadas separadamente; estes logs não contêm payload, prompt,
argumentos, resultados, identificadores ou nomes brutos. Testes usam limites claramente
sintéticos e gravações históricas intactas, não uma nova medição do serviço. Não foi adicionado
evento do navegador, endpoint ou comportamento de voz.

## Evidências e pré-requisitos

**Este é um roteiro baseado em código/specs/gravações, não um workshop live concluído.** A baseline
#32 está integrada: commit original `1d23b7a9b9a43c96854c48a995ccd7957cc2ee37`, cherry-pick local
`082cac5e7098bcbf911bc9ad6f3c3d8fa3fc1a82`. Siga primeiro o [setup do README](../README.pt-BR.md)
e execute os exercícios a partir da raiz com a venv correspondente ativada. Os exemplos não
instalam dependências. Gates locais e checks HTTP do replay estão registrados abaixo; capturas no
navegador e exercícios live tarifados continuam pendentes. Um teste de replay passando não é uma
nova medição do Foundry.

| Estado | Evidência e limite |
|---|---|
| Implementado | Existem adapters prompt/hosted, funções compartilhadas, Learn MCP, busca lexical, comparação, inspetor e código de voz. Veja os módulos abaixo. |
| Integrado à UI | Rotas e testes de componentes cobrem essas superfícies; este incremento não abriu um navegador nem verificou seu layout. |
| Verificado live historicamente | [Corpus gravado](../ai/tests/fixtures/recorded/README.md), com datas/proveniência. AC16 da spec 020 fechou em 2026-09-20: três probes, um turno prompt e um hosted por probe. Não é benchmark. |
| Replay | [Spec 050](../specs/050-demo-mode/) usa gravações reais por um entrypoint separado. A resposta não depende da nova pergunta; seu demo não oferece replay hosted. |
| Adiado/não verificado | Execução/capturas atuais do workshop; continuidade hosted multi-turn; conversa completa de voz hosted; visualização de interrupção; lookup de spans hosted por response-id; provisionamento Foundry IQ; futura integração Copilot. |

Replay exige dependências locais, mas não credenciais Azure. Exercícios live exigem recursos
provisionados pelo operador e acesso Entra; [infra](../infra/README.md) descreve a fronteira manual.
Build/deploy hosted tem etapas adicionais de Docker, identidade e Key Vault no
[guia hosted](../ai/harness/langgraph/README.md). Modelos/tools/sessões de container live geram custos.
`search_web` usa a exceção documentada de terceiro `TAVILY_API_KEY`; nunca a coloque no navegador,
imagem ou transcrição. A aplicação não tem uma fronteira de login de produção: mantenha controles
pagos desligados salvo autorização deliberada do operador. Leia [SECURITY](../SECURITY.md).

## 1. Replay — entender o que a aplicação desenha

**Objetivo:** distinguir evidência gravada de resposta nova e localizar a fronteira do harness.

- **Comandos candidatos:** `just demo`; em outro terminal,
  `cd ai && pytest -q tests/test_recorded_turn.py tests/test_hosted_recorded_turn.py`.
- **Código/evidência:** [spec demo](../specs/050-demo-mode/),
  [contrato](../ai/harness/_shared/contract.py), [gravações](../ai/tests/fixtures/recorded/README.md),
  [mapa de rotas](../frontend/src/state/route.ts).
- **Observação esperada:** banner de replay que não pode ser dispensado; perguntas diferentes não
  criam respostas diferentes do modelo. Os testes de fixtures exercitam o contrato sem chamar Azure.
  Testes hosted são evidência mesmo que o demo local não ofereça replay hosted.
- **Exercício:** mude a pergunta duas vezes e explique o que é entrada nova do navegador e o que é a
  mesma gravação. Encontre o validador do contrato em vez de adicionar eventos exclusivos do demo.
- **Limite:** replay prova renderização/protocolo contra esse corpus, não qualidade live,
  latência, disponibilidade atual do serviço ou resultados recentes de tools.

## 2. Function calling — seleção não é execução

**Objetivo:** separar a escolha de tool pelo modelo da resposta do BFF a uma função solicitada.

- **Comando candidato:** `cd ai && pytest -q tests/test_tools.py tests/test_prompt_adapter.py`.
  Após setup live validado: `just backend` e `just frontend` em terminais separados.
- **Código/evidência:** [registry](../ai/harness/_shared/tools/registry.py),
  [adapter prompt](../ai/harness/prompt_agent/adapter.py),
  [executor](../backend/app/tool_executor.py),
  [round trip](how-it-works/function-call-round-trip.md).
- **Observação esperada:** `get_current_datetime`, `lookup_knowledge` e `search_web` têm uma
  implementação compartilhada cada. Chamadas prompt levam `executor: "app"`; o BFF as executa e
  envia outputs na mesma conversa Foundry. Um round trip tem dois completions upstream; um turno
  pode ter mais legs. O adapter limita rodadas de protocolo e não seleciona tools.
- **Exercício:** pergunte a hora atual em São Paulo, inspecione argumentos/output e identifique
  `call_id` nos dois lados. Compare com `/tools`, onde uma pessoa escolhe uma função fora da conversa.
- **Limite:** a escolha é do agente, não consequência garantida da formulação. Não acrescente loop
  de planejamento/retry na aplicação. Controles pagos do playground ficam desligados por padrão e
  exigem consentimento do operador.

## 3. Microsoft Learn MCP — quem mantém a sessão?

**Objetivo:** entender um servidor MCP remoto sem confundir suas chamadas com funções locais.

- **Comando candidato:** `cd ai && pytest -q tests/test_events.py tests/test_hosted_recorded_turn.py`.
- **Código/evidência:** [declaração compartilhada](../ai/harness/_shared/agent_core.yaml),
  [normalizador prompt](../ai/harness/prompt_agent/events.py),
  [grafo hosted](../ai/harness/langgraph/agent/graph.py),
  [comparação](harness-comparison.md).
- **Observação esperada:** runtime prompt é o cliente MCP do Learn e emite `mcp_call`; este
  container hosted é o cliente MCP e relata `microsoft_docs_search`/`microsoft_docs_fetch` como
  pares comuns de `tool_call`/`tool_result`. Mesmo corpus, superfície de execução diferente.
- **Exercício:** faça uma pergunta de documentação Learn e localize o payload da fonte, não somente
  a citação em prosa. Compare gravações datadas antes de tentar uma repetição live com custos.
- **Limite:** ausência de `mcp_call` neste caminho hosted não é falha de consulta. Formatos gravados
  são evidência, não promessa de imutabilidade de versões futuras do serviço/servidor.

## 4. Recuperação local — lexical não é Foundry IQ

**Objetivo:** enxergar retrieval como tool e distinguir o algoritmo implementado de um serviço futuro.

- **Comando candidato:** `cd ai && pytest -q tests/test_tools.py`.
- **Código/evidência:** [knowledge tool](../ai/harness/_shared/tools/knowledge_tool.py),
  [corpus local](../ai/harness/_shared/tools/knowledge/),
  [spec Foundry IQ](../specs/049-foundry-iq-knowledge/).
- **Observação esperada:** seções Markdown são ranqueadas por correspondência lexical de tokens,
  frequência, tamanho e bônus de título. Resultados trazem caminhos do repositório, não URLs
  externas; sem correspondência, passages vazias. Não há embeddings, índice vetorial ou chamada IQ.
- **Exercício:** compare um termo exato com uma paráfrase sem palavras-chave comuns. Explique a
  ausência de match sem inventar score semântico; localize a extensão `KnowledgeSource`.
- **Limite:** tokenização e corpus pequeno restringem recall, inclusive entre idiomas.
  Foundry IQ aguarda provisionamento; este módulo não escolhe endpoint novo nem provisiona Search.

## 5. Prompt versus hosted — onde roda o loop do agente

**Objetivo:** distinguir adapter BFF intercambiável de runtime de agente autorado e implantado no Foundry.

- **Comando candidato:** `cd ai && pytest -q tests/test_harness_parity.py tests/test_hosted_graph.py`.
  Após provisionamento live validado, abra `/compare`; não faça deploy apenas para concluir o roteiro.
- **Código/evidência:** [definição prompt](../ai/harness/prompt_agent/agent.yaml),
  [core compartilhado](../ai/harness/_shared/agent_core.yaml),
  [grafo hosted](../ai/harness/langgraph/agent/graph.py),
  [factory](../backend/app/harness_factory.py),
  [resumo da comparação](../ai/tests/fixtures/recorded/compare-summary-20260920.json).
- **Observação esperada:** definições compartilham `gpt-5.5`, instruções e tools; reasoning prompt
  tem configuração própria `detailed`. Foundry roda o loop decisório prompt; o grafo hosted cicla
  modelo → tools → modelo no container. Chamadas hosted levam `executor: "foundry"`. `/compare`
  faz dois posts normais com pointers independentes, não uma API nova de orquestração.
- **Exercício:** desenhe ambos os caminhos e identifique quem seleciona, executa e renderiza cada
  chamada. Recalcule primeira resposta textual/duração total das seis linhas, rotulando amostras datadas.
- **Limite:** definições compartilhadas reduzem drift, não confundidores de latência. Não se provou
  benchmark/causa de cold start. O grafo não tem checkpointer; enviar pointer Foundry não certifica
  continuidade hosted multi-turn. O navegador guarda um desenho; Foundry possui o estado da conversa.

## 6. Eventos e traces — ausência é informação

**Objetivo:** distinguir eventos no wire, contabilização de tokens, resumos de reasoning e spans.

- **Comandos candidatos:** `cd ai && pytest -q tests/test_contract.py tests/test_conformance.py`;
  `cd backend && pytest -q tests/test_traces.py tests/test_trace_injection.py`.
- **Código/evidência:** [streaming](how-it-works/streaming-events.md),
  [tracing](how-it-works/tracing-and-gateway.md), [lookup de trace](../backend/app/traces.py),
  [estado do turno](../frontend/src/state/turn.ts).
- **Observação esperada:** inspetor retém payloads SSE normalizados do BFF, não frames upstream
  brutos. Usage prompt soma legs; reasoning faz parte de output e cache faz parte de input. Streams
  hosted atuais não relatam usage/resumo/MCP event; não invente dinheiro nem deduza falha dessas ausências.
- **Exercício:** siga um `response_id` prompt até os spans e explique por que spans hosted com
  `microsoft.session.id` não são encontrados pelo drawer atual. Localize validação de URL antes do KQL.
- **Limite:** resumo é opcional, não reasoning interno completo. Logs do gateway não são spans de
  tools. `unmapped_types()` é análise offline, não diagnóstico live (#39). Traces/exports com
  conteúdo precisam de revisão/redação antes da publicação.

## 7. Voz — um agente, outro transporte

**Objetivo:** acompanhar controle, áudio e dados separadamente sem entregar chave Azure ao navegador.

- **Comando candidato:** `cd ai && pytest -q tests/test_voice_events.py`.
  Após setup live validado, inicie uma chamada na UI e encerre explicitamente.
- **Código/evidência:** [ciclo de vida](how-it-works/voice-live-lifecycle.md),
  [conexão](../backend/app/voice_connect.py), [sessão](../backend/app/voice_session.py),
  [hook do navegador](../frontend/src/hooks/useVoiceSession.ts),
  [evidência de voz](../ai/tests/fixtures/recorded/README.md).
- **Observação esperada:** BFF mantém WebSocket de controle autenticado; WebRTC do navegador leva
  áudio/dados direto ao Voice Live, sem BFF/gateway. Attach usa `agent_name` e `agent_project_name`.
  Um item estático de contexto falado é a exceção limitada da constituição, não um segundo prompt
  específico da sessão. A UI distingue elapsed observado de duração relatada.
- **Exercício:** desenhe os três canais e localize função solicitada nos eventos de controle e sua
  transcrição no data channel. Compare citações escritas com o par gravado de contexto falado.
- **Limite:** fixture hosted de voz tem um frame `session.created`: somente attachment. Fala
  hosted completa e visualização de interrupção seguem não verificadas; não deduza barge-in do silêncio.
  Permissões de microfone/navegador e custos live são separados do replay.

## Registro de verificação local — 2026-10-09

São execuções nesta worktree documental após o cherry-pick da baseline, não resultados inferidos
da #32. Dependências foram restauradas com Python 3.12 em **duas venvs separadas**, `backend/.venv`
e `ai/.venv`, instalando `backend[dev]` mais `ai` na primeira e `ai[dev]` na segunda;
`npm ci` restaurou o frontend. Não foi usado pytest global nem comando Azure live.

```bash
(cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/pytest -q)
(cd ai && .venv/bin/ruff check . && .venv/bin/pytest -q)
(cd frontend && npm run lint && npm test -- --run && npm run build)
just gate-infra
```

**Resultados:** lint/format backend passaram, **299 testes passaram**; lint AI passou, **233 passaram /
5 skips**; lint/test/build frontend passaram, **1037 testes**; infra pulou pelo guard de Bicep
ausente. O lint frontend reportou três avisos existentes de acesso a refs e o build reportou chunks
grandes; nenhum falhou seu gate. A instalação reportou oito achados npm audit (2 low, 6 high);
este incremento documental não mudou dependências nem corrigiu esses achados.

Os comandos de teste dos módulos foram cobertos nestas seleções combinadas (não são sete execuções
separadas de workshop):

```bash
(cd ai && .venv/bin/pytest -q -rs tests/test_recorded_turn.py tests/test_hosted_recorded_turn.py tests/test_tools.py tests/test_prompt_adapter.py tests/test_events.py tests/test_harness_parity.py tests/test_hosted_graph.py tests/test_contract.py tests/test_conformance.py tests/test_voice_events.py)
(cd backend && .venv/bin/pytest -q tests/test_traces.py tests/test_trace_injection.py)
```

**Resultados:** AI **188 passaram / 1 skip**, backend **32 passaram**. Dependências do grafo hosted
estão ausentes: seu teste pulou explicitamente; contratos gravados passando não provam um grafo
recém-executado nem um agente hosted implantado.

Com `backend/.venv/bin` no PATH, a receita de replay foi verificada em portas livres porque a
sondagem inicial de disponibilidade em 8001/5173 encontrou porta ocupada e não iniciou servidor:

```bash
BACKEND_PORT=55976 FRONTEND_PORT=55977 VITE_BFF_URL=http://localhost:55976 just demo
just down
```

**Resultados:** `/health` do demo, HTML da UI e `/config` responderam HTTP 200; `demo` estava no config.
SIGINT equivalente a Ctrl+C saiu com código 130 e liberou ambas as portas dos servidores iniciados.
Foi um **check HTTP e de ciclo de processos**, não um teste de navegador/CORS ou layout nessa origem
alternativa da UI. `just down` imprimiu orientação de exclusão manual e saiu com código **1**, como
esperado; não excluiu nada. Nenhum recurso Azure foi provisionado ou removido, e nenhuma captura ou
medição live nova foi produzida.

## Checklist de publicação e conclusão

- [x] Integrar setup limpo da #32 e reconciliar README raiz EN/PT; repetir gates locais isolados e
  verificar prontidão HTTP/shutdown do replay. Veja o registro de verificação abaixo.
- [ ] Executar os comandos live restantes com consentimento do operador e registrar resultados;
  testes/checks HTTP locais não validam provisionamento Azure, interação no navegador ou exercícios tarifados.
- [ ] Após integrar mudanças de telas/preferências/mobile, capturar banner real de replay, chat/linha
  de função, payload Learn/fonte, retrieval local, comparação, inspetor/trace e overlay de voz.
  Confirmar nomes acessíveis/layout nas larguras suportadas; são propostas, não screenshots existentes.
- [ ] Separar replay/live em cada legenda; marcar amostras de 2026-09-20 como históricas, um
  turno/harness/probe. Não alegar benchmark, latência nova, continuidade hosted ou voz hosted completa.
- [ ] Revisar screenshots, transcrições, exports JSON e traces para identificadores de tenant/projeto/
  recurso, prompts, argumentos/output e segredos. Redigir sem fabricar comportamento; registrar remoções.
  Redação automática de identificadores não torna o conteúdo seguro por si só.
- [ ] Obter consentimento antes de exercícios pagos; explicar custos de inferência, busca e container.
  Usage/preços ausentes significam custo não relatado, não gratuito. Parar stream não cancela o run.
- [ ] Encerrar sessões de voz, parar somente processos locais iniciados por você e revisar/excluir
  recursos Azure e dependências gateway/hosted separadas manualmente conforme propriedade do operador.
  Parar a aplicação não limpa Azure; não há teardown raiz automatizado verificado.
- [ ] Alinhar ambos os idiomas e links de evidência. Estender para IQ/Copilot só com nova spec e
  evidência atual de API/produto registrada; este roteiro inicial não seleciona essas integrações.
