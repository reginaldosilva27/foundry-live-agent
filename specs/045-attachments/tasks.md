# Tasks: Attachments on a question

**Still blocked — but no longer on a doc.** T0 is answered; T1 and T2 are decisions, and T2 is not
this repository's to make.

- [x] **T0 — read the doc**: does the Responses API accept file input beside a message, and how?
      **Answered 2026-09-20** and recorded in `docs/REFERENCES.md` (§10). Yes: as `input_image` /
      `input_file` content parts on the message item, carrying an `https://` URL, a `data:` base64
      URI, or a `file_id` from `POST /openai/v1/files` (`purpose=assistants`). Limits: ≤ 50 files
      per request, < 50 MB each and combined.
- [ ] **T1 — decide**: which of the three designs to build. The doc did not narrow it — **all
      three are supported**, which is why the spec could not pick one from memory. This follows T2:
      a `file_id` means Foundry keeps the file, and a `data:` URI means it does not.
- [ ] **T2 — settle retention** with whoever owns the deployment; write it into `SECURITY.md`
      before any upload endpoint exists.
- [ ] **T3 — spec the contract change**: `POST /chat` gains a field, which is §9/§4 work with
      fixtures and every consumer moved — the test pinning the three keys changes deliberately.
- [ ] **T4 — prove both harnesses agree**, in the adapter-parameterised suite.
- [ ] **T5 — then, and only then**: the composer, the limits, the transcript.

## Definition of done

- [x] T0 answered from a doc, not from memory
- [ ] Every acceptance criterion maps to a passing test
- [ ] Lint clean · Tests green · `verify-gates` green
