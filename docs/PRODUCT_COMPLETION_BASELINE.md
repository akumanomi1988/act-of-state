# ACT OF STATE — Weighted whole-product completion baseline v1

Established 2026-10-26. This first weighted snapshot is not retrospective
progress. The canonical baseline is product-completion.json; original
scope and weights are frozen at 100 points covering eighteen final gates.

* Core feature gates MVP-F001–F008: 62 weighted points.
* Engineering gates MVP-T001–T006: 28 weighted points.
* External launch acceptance gates REL-001–004: 10 weighted points.

Only MVP-T001 (transactional persistence) and MVP-T003 (deterministic
outcomes) are historically accepted. **Weighted score: 10/100 = 10%.**
This is not comparable to the previous 2/18 = 11.1% unweighted
legacy figure: both identify the same two accepted final criteria.

Partial criteria earn zero until evidence satisfies their full acceptance
boundary; code, automated CI, hosted deployment and human release
readiness are independently reported. REL requires staffed fact-checking,
consenting human ten-party weekly playtests, human UX/a11y review and
sustained production recovery. Historical implementation progress remains
visible in MVP_TRACKER.md.

Run: node --test tests/product-completion.test.mjs.
AOS-053 fictional political funding improves gameplay implementation
but does not autonomously close any original full-product gate.



## Versioned technical acceptance event — AOS-057, 2026-10-26

The 100 total weight points and all 18 requirements are unchanged.
Previously accepted T001/T003 remain accepted (10 points).
Three independently automated TECHNICAL gates have now been reviewed
against the successful, immutable AOS-056 GitHub CI evidence:
T002 (authenticated account isolation), T004 (idempotency/concurrent
operations), T005 (full automated quality tooling). Their weights are 5,
4 and 4. These contribute **13 new accepted points**, for **23/100 = 23%**
binary whole-project acceptance. These are technical gates, NOT social,
editorial, production, external email or human player acceptance.
See TECHNICAL_ACCEPTANCE_AOS_057.md. No partially complete gameplay
requirements have received points, and REL remains 0/10.
