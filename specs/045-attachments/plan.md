# Plan: Attachments on a question

> **There is no plan yet, on purpose.** `spec.md` reached `clarified — blocked` on 2026-09-19.
>
> Its own first open question governs: *does the Responses API accept file input alongside a
> message, and how — until this is answered from a doc, nothing else in this spec can be planned.*
> It has not been answered, and §10 forbids writing the rest from memory.

Writing an approach now would mean choosing between three designs that wear the same name — content
inlined in the message, a file uploaded to Foundry, or storage the agent reads — with nothing to
choose on. The one that is wrong would not fail until it met the service.

Two blockers are not documentation questions and do not go away when that one is answered:

- **The request shape.** `POST /chat` is `message · conversation_id · agent`, pinned by a test that
  exists to keep this browser's record out of Foundry's state (spec 021). A fourth field is a
  §9/§4 change with its own spec, fixtures and consumers — not something to slip in.
- **Retention.** What is stored, for how long, and who can read it is the operator's decision and
  must precede an upload endpoint existing.

## What to do when it unblocks

1. Read the file-input documentation for `api-version=v1`; record it in `docs/REFERENCES.md` (§10).
2. Decide which of the three designs the answer implies. **Rewrite this spec** to be that one — not
   all three behind a flag.
3. Settle retention with whoever owns the deployment, and write it into `SECURITY.md` before any
   endpoint exists.
4. Only then: the contract change, its fixtures, and the adapter-parameterised suite proving both
   harnesses agree.

## What already covers most of the want

The composer is a multi-line `textarea` (spec 023). A log, a Bicep file or a CSV pastes today and
travels as the `message` it is — no contract change, no upload, no retention question. A screenshot
is the case that genuinely needs the answer, and it is the case to build for.
