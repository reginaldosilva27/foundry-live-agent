"""The bounds on the two free-text inputs this BFF accepts (spec 062).

One place, read by the request models that enforce them and by `GET /config` that publishes them,
so the composer can say "too long" before sending instead of after (§4).

They are **this app's** bounds, not claims about Foundry's: a pasted log or Bicep file fits (spec
045's workaround for attachments), a book does not. Characters, not tokens — the composer can count
characters; it cannot count tokens without a tokenizer, and a model's context window is a §10
question nobody here has read a document for.
"""

MESSAGE_CHARS = 64_000
INSTRUCTIONS_CHARS = 32_000
