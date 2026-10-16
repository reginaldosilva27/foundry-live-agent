# Plan: 062-request-limits

## Approach

- `backend/app/limits.py` holds `MESSAGE_CHARS = 64_000` and `INSTRUCTIONS_CHARS = 32_000` — the
  single source of truth (§4).
- `ChatRequest.message: Field(min_length=1, max_length=MESSAGE_CHARS)`; Pydantic refuses before the
  handler runs, so the stream factory cannot be reached (AC1/AC2).
- `Proposal.instructions: Field(max_length=INSTRUCTIONS_CHARS)` (AC3).
- `GET /config` adds `limits` read from the same module (AC4).
- Frontend: `types` for the config gain optional `limits`; `aboutFields.ts` covers the key (AC5);
  the composer receives `messageChars?: number`, computes `over = text.length > messageChars`,
  disables Send and shows `composer.tooLong` (AC6/AC7).

## Affected files

backend/app/limits.py (new) · backend/app/routers/chat.py · backend/app/routers/agents.py ·
backend/app/routers/config.py · frontend config types · frontend/src/panes/aboutFields.ts and the
About rendering · the composer component · frontend/src/i18n/strings.ts · SECURITY.md

## Test strategy

| AC | Test |
|---|---|
| AC1, AC2 | `backend/tests/test_request_limits.py` — over/at the bound, factory spy never called |
| AC3 | same file — proposal over the bound → 422, validator spy never called |
| AC4 | same file — `/config` `limits.message_chars == MESSAGE_CHARS` |
| AC5 | `About.coverage.test.ts` (existing drift test) + an About render assertion |
| AC6, AC7 | composer test — over the bound in `en` and `pt`, Send disabled, Enter inert; absent limits → no notice |
