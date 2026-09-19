# Tasks: Attachments on a question

**Blocked.** No task here can be started honestly, and the first one is not a coding task.

- [ ] **T0 — read the doc**: does the Responses API accept file input beside a message, and how?
      Record it in `docs/REFERENCES.md` (§10). *Every task below is blocked on this one.*
- [ ] **T1 — decide**: which of the three designs the answer implies, and rewrite `spec.md` as that
      one rather than keeping all three.
- [ ] **T2 — settle retention** with whoever owns the deployment; write it into `SECURITY.md`
      before any upload endpoint exists.
- [ ] **T3 — spec the contract change**: `POST /chat` gains a field, which is §9/§4 work with
      fixtures and every consumer moved — the test pinning the three keys changes deliberately.
- [ ] **T4 — prove both harnesses agree**, in the adapter-parameterised suite.
- [ ] **T5 — then, and only then**: the composer, the limits, the transcript.

## Definition of done

- [ ] T0 answered from a doc, not from memory
- [ ] Every acceptance criterion maps to a passing test
- [ ] Lint clean · Tests green · `verify-gates` green
