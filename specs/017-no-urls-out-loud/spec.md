# Spec: A spoken answer does not read URLs out loud

| | |
|---|---|
| **ID** | 017-no-urls-out-loud |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

The citation rule that makes the written answer trustworthy makes the spoken one unusable.

Observed 2026-09-16, in a voice session after spec 016 landed: asked about Corinthians' next match,
the agent answered correctly and then read this aloud —

> Fontes: https://todopoderosotimao.com.br/proximos_jogos.php
> https://www.espn.com.br/futebol/time/calendario/\_/id/874/corinthians
> https://www.mat.ufmg.br/futebol/classificacao-geral\_seriea

Three problems in one sentence, and none of them is the voice's fault:

1. **It is long** — the citation block outlasted the answer.
2. **It is unspeakable** — a text-to-speech voice reads a URL slash by slash, and the listener
   cannot write any of it down.
3. **It is not what was asked for.** Mid-session the user said *"Não traga a referência, só o
   resultado"* and the agent complied — proof that the model can follow this rule when told, and
   that it should not have to be told every time.

The instruction responsible stays: *"Always cite the URLs it returns; never present a search result
as your own knowledge."* Without it a web search becomes indistinguishable from the model's own
memory, which is exactly what spec 013 exists to prevent. The rule is not removed — it is made
conditional on the modality.

**Why the voice cannot fix it.** The Voice Live doc's own row for GPT-5 models reads *"audio input
through Azure speech to text + audio output through Azure text to speech voices"*. The words are
`gpt-5.5`'s; the voice is Azure Speech reading them. No voice makes a URL pleasant to hear.

## The finding that reshaped this spec

The first design put the conditional rule in the agent definition — the same lever spec 016 used.
It was applied as agent version 7, and **it did not work**: the spoken answer read the URL anyway.

Asked directly, over **real audio in and real audio out** — *"nesta conversa você está me ouvindo
por voz, ou trocando texto escrito comigo?"* — the agent answered:

> **"Estou trocando texto escrito com você."**

**The model cannot perceive the modality.** Voice Live transcribes before the model and synthesizes
after it, so nothing in its input says "you are being listened to". A rule conditioned on the
modality is conditioned on nothing, and no wording fixes that.

That leaves exactly one place that knows: **the session**. Verified the same day — one
`conversation.item.create` with `role: system`, sent when the session opens, and the spoken answer
ends at the answer. The A/B is committed as two fixtures: same agent version, same spoken question,
the item present in one and absent in the other.

**This required amending the constitution**, which §8 forbade in its own words ("rewrites
instructions at request time"). The amendment is narrow and recorded in `.specify/constitution.md`:
one static sentence about the **transport**, sent once at session open, naming no tool and reading
nothing the model said. §8's own test — *"would this still be true if the harness were swapped?"* —
answers yes: any harness attached to Voice Live is being listened to.

## Goals

- A spoken answer gives the answer and stops. No URL, no "Fontes:" block, in speech.
- A written answer is **unchanged** — same citations, same rule, same trustworthiness.
- The one fact the agent cannot observe is stated by the only component that knows it.

## Non-goals

- **The BFF does not strip URLs from the agent's output.** Editing what the agent said is a
  different thing from telling it where it is, and it would corrupt an answer that is *about* a URL.
- No second agent and no second definition. One agent, two modalities (spec 006).
- No change to `search_web`, its schema, or its output.
- No attempt to make URLs speakable (spelling, shortening, domain-only).
- No general "the app may prompt the agent" licence. The amendment is one item, one fact, one
  sentence, and the tests assert it stays that way.

## User-facing behavior

**Spoken.** *"O último jogo do Corinthians que encontrei foi contra a Chapecoense, em 6 de setembro
de 2026, pelo Brasileirão."* Then silence — that is the whole answer.

**Written.** Unchanged: the answer, then the sources, with links.

**The consequence, stated rather than hidden:** a voice turn lands in the chat afterwards (spec 007)
carrying the words that were spoken, so its links are not in the transcript either. Accepted; the
user can ask for a source out loud and the agent names it without the address.

**i18n (§7).** No new UI string. The session item is English prose sent to the model, not to a user;
the agent answers in the user's language, as it already did.

## Acceptance criteria

1. **AC1** — Given a voice session, when it opens, then it sends exactly one
   `conversation.item.create` with `role: system` stating that the conversation is spoken and that
   URLs are not to be said out loud, and it sends it before any answer can be produced.
2. **AC2** — Given that item, then it names no tool, carries no conversation state, and stays short
   (§8's boundary, asserted rather than trusted).
3. **AC3** — Given a **live voice turn** driven by real audio that calls `search_web`, when
   recorded, then no URL appears in what the agent spoke, and the recording is committed (§5, §10).
4. **AC4** — Given a **live text turn** with the same question, when recorded, then the written
   answer **does** cite URLs — the rule is conditional, not a deletion.
5. **AC5** — Given the spoken turn, then the answer is still there: the transcript is substantial
   and contains what was asked about.
6. **AC6** — Given spec 016's behavior, then the preamble still precedes the tool call in the same
   recording.
7. **AC7** — Given the same agent version and the same spoken question **without** the session item,
   when recorded, then the URL comes back — a negative control committed alongside, so AC3 is a
   claim about this change and not about the model's mood that afternoon.

## Contract / data impact

- **`AgentEvent` (§9): unchanged.**
- **`.specify/constitution.md` §8 is amended** in this change, with the rationale and the limits.
  `CLAUDE.md` and `AGENTS.md` move with it (§6).
- **`ai/harness/_shared/voice_events.py` owns the item** — one source of truth, next to
  `voice_session_config`, shared by every harness, so a second harness inherits it (§4).
- **The agent definition is unchanged** by this spec in the end: version 7's conditional rule was
  removed again in version 8, because it was unreachable. Applied version: **8**.

## Open questions (clarify before planning)

- [x] Voice only, or everywhere? → **Voice only** (user, 2026-09-16).
- [x] May it name a source without the URL? → **Yes, when asked** — not volunteered.
- [x] Can `gpt-5.5` tell that the conversation is spoken? → **No.** Answered by the live service,
      twice, with audio: *"Estou trocando texto escrito com você."* This is why the design moved
      from the agent definition to the session.
- [x] Is telling it allowed under §8? → **Not as written** — the constitution said "rewrites
      instructions at request time". Amended deliberately, narrowly, in the same change, with the
      user's decision recorded (2026-09-16).

## Out of scope / deferred

- Showing a voice turn's links in the chat transcript afterwards — a real idea and a different
  spec, since the URLs never reach the voice path.
- Making the session item configurable, or per-deployment. One sentence, one behavior.
- **Verifying this on the WebRTC control channel.** Every recording here was taken over the
  WebSocket channel, which is where a fixture can be captured without a browser. The BFF sends the
  item on the same `negotiate()` path the WebRTC session uses, and the unit tests cover that path —
  but the live proof is a spoken turn in the app, which is one click for the maintainer and not
  something this spec claims to have done (§5).
