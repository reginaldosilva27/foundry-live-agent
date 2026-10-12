# Caminhos de aprendizado Copilot — escolher o cliente antes de conectar

[English](copilot-learning-paths.md) · [Trilha de aprendizado](learning-journey.pt-BR.md) ·
[Registro de fontes oficiais](REFERENCES.md#copilot-learning-paths--sources-read-2026-10-09)

**Documentação consultada: 2026-10-09. Nenhuma integração foi executada.** Esta é a fase de pesquisa da
[issue #37](https://github.com/reginaldosilva27/foundry-live-agent/issues/37), não uma escolha de produto
nem um workshop concluído. Os IDs de fontes abaixo apontam para o registro datado. Disponibilidade e
acesso precisam ser reconfirmados para conta, versão do cliente, região e política do tenant escolhidos.

## 1. Produtos diferentes, responsáveis diferentes

“Copilot” não identifica um único runtime, licença ou protocolo. MCP expõe capacidades;
um agente decide quando usá-las; um harness governa a execução desse agente. Um pacote de plugin
referencia capacidades, mas não necessariamente as hospeda. O **standard harness** do Studio é um
termo do produto, não uma implementação do contrato `AgentHarness` deste repositório.

| Superfície candidata | Capacidades documentadas | Onde executa | Relação com este projeto |
|---|---|---|---|
| GitHub Copilot no VS Code | Tools do agente, MCP tools/resources/prompts e MCP Apps; customizações [C01] | Copilot fornece inferência; o editor executa tools locais configuradas ou chama servidores remotos. Desenvolvimento remoto muda onde processos locais executam. | Pode consultar o mesmo Learn MCP público sem chamar o BFF. É um cliente de desenvolvimento, não um terceiro harness Foundry. |
| GitHub Copilot CLI | Agente de terminal, agentes customizados, instruções, skills, hooks e tools MCP configuráveis [C02, C03] | Uma sessão local comum executa na máquina do usuário; execução cloud explícita é outro modo. Controlar remotamente uma sessão local não a transfere. | Pode inspecionar/testar a aplicação; Learn documenta uma opção de plugin CLI. Este incremento não instala plugin CLI. |
| GitHub Copilot cloud agent / code review | MCP configurado no repositório: **somente tools**, sem resources/prompts; OAuth remoto não suportado nessas superfícies [C04] | Cloud agent trabalha em ambiente cloud efêmero de desenvolvimento; review é outro fluxo. Servidores MCP remotos permanecem com seus operadores. | Útil para automação de contribuição, mas permissões mais amplas e chamadas autônomas tornam este um primeiro exercício menos mínimo. |
| Copilot Studio | Agentes standard-harness com orquestração generativa usam MCP **tools e resources**; agentes conectados e conectores são superfícies distintas [C06, C07, C09] | Studio orquestra; servidor MCP remoto ou agente conectado executa seu próprio trabalho. | Pode reutilizar Learn público. Conexão direta com agente Foundry é **public preview**, exige endpoint Activity e não é a rota SSE desta aplicação [C10]. |
| Microsoft 365 Copilot | Agentes declarativos usam o orquestrador Copilot; custom-engine trazem sua própria orquestração. Plugins MCP expõem actions com descoberta dinâmica/tools fixadas e MCP Apps [C11, C12] | Orquestração declarativa fica no M365; engine customizado e tools remotas executam na própria hospedagem. Um pacote não hospeda o servidor. | Foundry documenta publicação de endpoint estável no M365/Teams. Isso não publica React/FastAPI nem valida seu round trip de funções client-side [C14]. |

Os documentos M365 consultados alertam que recursos do protocolo MCP, descoberta e governança
variam por host [C13]. Não transfira suporte a resources/prompts do VS Code para toda experiência
M365. Work IQ MCP é **outra direção**: um agente externo acessa dados M365 ou invoca Copilot.
Suas tools documentadas incluem leituras **e escritas/exclusões**, com Entra OAuth e política do
tenant [C15]. Não é o servidor Learn público nem faz parte da aula proposta.

## 2. Acesso, credenciais e confiança fazem parte da aula

| Superfície | Acesso / licenciamento a confirmar | Fronteira de credenciais e aprovação |
|---|---|---|
| Superfícies de desenvolvimento GitHub | Planos atuais incluem CLI/app com limites diferentes; acesso a agentes no Free é limitado. Confirme recurso escolhido, GitHub AI Credits e política da organização, não quotas antigas de premium requests de memória [C05]. | Login GitHub é separado da autenticação de cada servidor MCP. VS Code pede confiança no servidor; aprovação de chamada depende da configuração. Servidores locais podem executar código arbitrário. Permissões CLI podem ser amplas: não use aprovação automática irrestrita [C01, C02]. |
| GitHub cloud agent / review | Administrador do repositório configura MCP; acesso da conta e políticas organizacionais continuam necessários [C04, C05]. | Chamadas sem aprovação por invocação. Prefira allowlists read-only explícitas; review exige `readOnlyHint`. Secrets/variáveis do repositório podem entrar na configuração. Não copie essa configuração para a aplicação nem presuma OAuth remoto [C04]. |
| Copilot Studio | Conta corporativa/escolar e acesso tenant/admin. Trial permite criar/testar, mas **não publicar**. Standalone e subconjunto Teams têm capacidades diferentes; o subconjunto Teams consultado não tem orquestração generativa, portanto não equivale a este exercício MCP. Confirme Copilot Credits/capacidade [C08]. | Onboarding MCP permite sem autenticação, API key ou OAuth. Permissões delegadas do usuário e políticas de conectores/dados importam. Transporte Streamable é suportado; MCP SSE legado não é o caminho suportado de onboarding [C07]. |
| Microsoft 365 Copilot | Assinatura-base elegível e caminho Copilot Chat/add-on escolhido; dados compartilhados do tenant podem consumir Copilot Credits. Agentes custom-engine no Copilot Chat não exigem add-on Copilot **adicional**, o que não torna qualquer conta elegível nem hospedagem Azure gratuita [C16]. | Desenvolvimento Toolkit exige upload de apps customizados e acesso Copilot habilitados. Plugins MCP têm opções documentadas de autenticação; scopes/consentimento exatos dependem do servidor. Aprovação de catálogo, aquisição e autorização do serviço são gates distintos [C12, C13]. |
| Conexões Foundry | Recursos Azure existentes e identidades autorizadas; custos de modelo/container/Bot Service são independentes do acesso Copilot [C14, C17]. | Docs MCP Foundry nomeiam Foundry User para projeto e Foundry Project Manager para conexões do projeto. Publicação exige também permissões Bot Service; acesso ao projeto não basta [C14, C17]. |

O servidor público Microsoft Learn usa Streamable HTTP em `https://learn.microsoft.com/api/mcp`,
**não exige autenticação** e **não cobra pelo uso do servidor** [C18]. Cliente/modelo ainda podem
consumir quota ou créditos pagos próprios. Até pedidos públicos saem da máquina e seguem os termos
Learn. Nunca inclua código privado, conteúdo do tenant, credenciais ou transcrições.

## 3. O que pode conectar — e o que ainda não foi provado

- **Confirmado nas docs oficiais:** Learn atende clientes compatíveis GitHub Copilot, Studio e
  Foundry [C18, C19]. Confirma superfície documentada, não um teste neste tenant.
- **Confirmado nas evidências do repositório:** a
  [definição compartilhada](../ai/harness/_shared/agent_core.yaml) referencia Learn; o
  [caminho prompt](how-it-works/function-call-round-trip.md) delega MCP ao Foundry, enquanto o
  [grafo hosted](../ai/harness/langgraph/agent/graph.py) é cliente MCP dentro do container Foundry.
  Veja [gravações datadas](../ai/tests/fixtures/recorded/README.md) e
  [comparação medida](harness-comparison.md), não um benchmark atual inferido.
- **Não são MCP:** `/chat` SSE, `/tools/{name}/run` HTTP e as
  [funções Python compartilhadas](../ai/harness/_shared/tools/registry.py). Usar HTTP ou o nome
  “tool” não implementa descoberta, transporte, autorização ou semântica MCP. Expô-las seria
  design/código novo, não uma etapa de configuração.
- **Studio → Foundry:** conexão preview exige Activity habilitado e agentes do novo portal Foundry
  [C10]. Responses/A2A não bastam. Habilitação de endpoint, identidade da conexão e versões
  prompt/hosted deste projeto não foram testadas. Nenhum código SDK/API de habilitação é fornecido.
- **Foundry → M365/Teams:** publicação configura endpoint estável, autorização Activity,
  Azure Bot Service e canal/pacote [C14]. Publicação pessoal/compartilhada e tenant têm caminhos
  diferentes de autorização/aprovação. O BFF responde funções client-side; existir mecanismo
  equivalente de output no canal Activity escolhido é um **bloqueio explícito**. Tools hosted
  evitam essa dependência específica da aplicação, mas compatibilidade de canal segue não verificada.
  Esta pesquisa não declara compatibilidade de nenhum harness.
- **Work IQ → clientes Foundry/Copilot:** acesso documentado a tools M365 não autoriza ler tenant.
  Licenças, scopes, política admin, consentimento de dados/gastos e fluxo suportado exato precisam
  ser resolvidos antes de qualquer chamada [C15, C16]. Não é atalho para esta fase.

## 4. Aula mínima recomendada — proposta, não autorização

**“Um servidor Learn público, três responsáveis pela execução.”** Preferir **GitHub Copilot no
VS Code + Learn MCP público**, contrastado com gravações prompt/hosted existentes. Não acrescenta
deploy Azure, bridge da aplicação, secret, conector ou terceiro harness. Ensina a fronteira antes
de introduzir dados tenant M365 ou publicação preview. CLI é alternativa se escolhido explicitamente;
Studio/M365 são aulas posteriores, não produtos substituídos silenciosamente.

### Sequência proposta após escolha

1. Siga [setup local](../README.pt-BR.md) e módulos Learn/comparação da trilha. Faça replay com
   `cd ai && pytest -q tests/test_events.py tests/test_hosted_recorded_turn.py`.
   Rotule output como **evidência histórica**, incluindo data e limites hosted.
2. Após confirmar conta/política/quota e autorizar este exercício exclusivamente público, siga o
   [guia oficial Learn][learn-start] na versão VS Code escolhida. Inspecione URL e metadados
   descobertos; habilite somente tools de busca/fetch de documentação para o exercício, preserve
   aprovações e use workspace educacional vazio, sem arquivos privados. Não instale MCP de
   gerenciamento Azure nem aprove automaticamente tools de shell/escrita.
3. Prompt candidato: **“Usando somente Microsoft Learn, explique a diferença entre prompt agents
   e hosted agents quanto à execução de orquestração e tools. Cite páginas consultadas. Não faça
   deploy, não modifique arquivos nem acesse dados de tenant.”** Prompt sozinho não é fronteira de
   segurança: restrinja tools/contexto e inspecione chamadas propostas antes de aprovar.
4. Capture nomes reais de tools, argumentos públicos, resultados/URLs e cliente/versão/data.
   Compare com eventos Foundry gravados. Invocação Copilot não vira `AgentEvent` automaticamente;
   `mcp_call` prompt e `tool_call` hosted são evidência normalizada da aplicação, não telemetria
   Copilot. Não sintetize fixtures nem compare latência/qualidade entre amostras datadas diferentes.
5. O aluno identifica: quem escolheu a tool, quem mantém cliente/sessão MCP, onde servidor executa,
   quais dados cruzaram a fronteira e onde uma falha apareceria. Recusa, tool ausente ou quota
   esgotada viram bloqueios registrados, não citações em prosa apresentadas como prova de chamada.

**Critério de sucesso da futura aula:** uma chamada pública Learn observada no cliente Copilot
escolhido, contrastada com chamadas prompt/hosted com proveniência, e explicação correta dos três
responsáveis. **Este incremento não tem chamada live nova nem captura de workshop.** Testes locais
não provam compatibilidade Copilot/tenant M365. O primeiro passo proposto não precisa de Foundry
live; comparação nova exigiria consentimento separado para gastos Azure.

### Decisão ainda necessária do usuário

Escolher **produto Copilot e superfície cliente**, conta/licença/tenant e política admin disponíveis;
confirmar dados exclusivamente públicos, restrições de credenciais e consentimento de quota/gastos.
Só depois esclarecer uma spec para novo conector, schema/configuração ou comportamento de harness,
com passos/testes reproduzíveis e evidência real necessária. Até a validação live desta aula sem
conector espera escolha/aprovação. Recomendação não é autorização. Issue #37 segue **parcial**:
pesquisa/recomendação atendem AC1–2; escolha/spec e execução validada (AC3–4) seguem abertas.
A fronteira existente e o contrato de eventos (AC5) não mudam.

[learn-start]: https://learn.microsoft.com/en-us/training/support/mcp-get-started
