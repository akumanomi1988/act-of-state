# ACT OF STATE — Electoral lifecycle (AOS-021)

## MVP rules

The versioned model is electoral-cohorts-v1, implemented in migration 021. It is a deterministic game model, not a statistically calibrated real electorate.

- One real UTC date equals one game date.
- First election: 90 calendar days after the match begins.
- Following elections: 90 calendar days after the preceding certification.
- Parties may edit their declared policy (0–100) until seven days before an election. The final week is frozen.
- Supabase Cron automatically certifies due elections after pending Parliament votes close. A match member may also request certification as a fallback. Both paths share one match-locked, unique-act transaction.
- An open Parliamentary bill blocks certification; it must be closed first.
- Winner: most national mandates, then highest vote share, then lowest original party seat number.
- Exactly 100 mandates are distributed using D'Hondt. A party without mandates remains in the match but cannot cast a legislative ballot.

## Mathematical model

For each cohort c and party p:

- Affinity score = max(1, 100 - 2 * abs(cohort ideal policy - party declared policy) + incumbency adjustment).
- Incumbency adjustment = round(0.30 * (cohort support - 50) + 0.20 * (cohort trust - 50)) for the current governing party; zero otherwise.
- Cohort party share = party score / total score for all parties in that cohort.
- National vote share = sum(cohort population weight * cohort party share) / total cohort population weight.
- D'Hondt ranks 100 quotients per party (national vote share / 1..100) and awards the highest 100 quotients. Equal quotients favor the lower original party number.

The immutable election act records the model version, cohort state, programs, vote shares, seat counts, incumbent, winner, due date and certification date.

## Security and transfer of power

All election calculations run in PostgreSQL. Authenticated clients cannot directly read or write the election table. Match-scoped RPCs authorize access.

- get_election_state: member-only forecast, dates and election history.
- set_party_manifesto: member may change only their program while the campaign is open.
- certify_match_election: member-only, due date enforced, exclusive match lock and atomic certification.
- submit_decision: the current elected leader can govern the shared nation. A solo government remains owned by its creator.

Cabinet decisions hold a shared match row lock until commit; election certification takes an exclusive match lock. This prevents a former leader from signing a policy across the handover.

Parliamentary votes use the elected seat count as immutable ballot weight. A national decision still requires an approved mandate.

## Verification boundaries

- supabase/tests/elections.sql exercises a ten-party election, outsider isolation, campaign freeze, 100 seats, early/duplicate certification refusal, alternation of government, old-leader denial, weighted Parliament and a decision signed by the new government.
- The SQL test is rolled back; it is not ten independent live browsers.
- src/ElectionPanel.test.tsx covers forecasting, program editing and certification UI.
- Existing government, Parliament, capacity/concurrency and deployment gates remain mandatory.

## Not yet complete

Multidimensional ideologies, turnout, campaigning/persuasion, geographic electorate, richer households, real-user load tests, ten operated source-verified Monday dossiers and a full macroeconomic model (beyond the immutable Friday ledger). Basic automated certification/Friday closure were delivered in AOS-023; voluntary coalition agreements and constructive confidence motions were added in AOS-025.

## Autonomous calendar integration (AOS-023)

The `aos-calendar-v1` Supabase Cron job runs every 15 minutes. It finalizes expired 24-hour parliamentary bills before attempting due elections. An unfinished, not-yet-expired bill delays certification rather than being bypassed. Certification remains idempotent and the authoritative outcome cannot be selected by a client. See `docs/CALENDAR_OPERATIONS.md` for monitoring and recovery.

## Government accountability (AOS-025)
A constructive confidence vote may transfer executive authority between ordinary elections, requiring an absolute majority of mandate-weighted seats. An open confidence motion blocks election certification and is settled by the existing Cron job before the electoral calculation. Each leadership change invalidates former cabinet coalition support. See docs/GOVERNANCE_RULES.md.
