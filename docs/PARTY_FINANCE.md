# AOS-053 — Equal-rule fictional party finance

## Complete gameplay loop

Every party in an active ten-player legislature receives the same fictional
public campaign-credit entitlement: 12 credits on entering the first campaign
week, and another 4 credits each following Monday (UTC). Accrual is derived
from the persisted match start time; it cannot be farmed by reloads, browser
clock changes, account relogins or duplicate RPCs. It requires no scheduled job.

Campaign strategies cost 4 credits for dialogue, 7 for a field visit and 10
for a policy forum. Parties can save credits across weeks. No purchases,
premium mechanics, paid campaigning or political donations exist.

When a campaign is submitted, the *existing* authoritative launch_campaign
operation serializes the match, validates membership, the election freeze,
the weekly quota, the target cohort, and current funding. It atomically
writes the original influence record and exactly one immutable expense
receipt. Failed operations roll back both. Exact retries return the original
campaign event without deducting credits twice. A missing receipt is treated
as unconfirmed by the browser.

## Privacy and access

get_party_finances is an authenticated member-scoped read; it returns only
the caller's own funding totals and 20 latest receipts. There are no direct
client table privileges, no anon RPC permission and RLS is enabled.
Party players cannot forge amounts, pass prices, edit another balance or
modify finance receipts. The 12/4 weekly grants are deterministic entitlements
rather than mutable ledger deposits; the expense receipts are persisted.

## Player experience

The campaign screen shows total public credits earned, spent and available,
strategy costs, the personal spending history and affordability. Expensive
choices are blocked in the UI for clarity, but the server is the authority
against stale state and parallel devices. The funding system works for
government and opposition parties equally and does not alter historical
electoral certifications or prior campaign snapshots.

## Validation & release constraints

Vitest tests cover malformed finance responses, privacy-facing consistency,
spend confirmation and unaffordable action gating. SQL rollback fixtures
cover calendar-week funding, real match membership, separate players,
idempotency, persistence, quotas and absence of direct table writes.
Real-GoTrue integration exercises budget before and after an actual campaign,
including a second party. Chromium tests cover the financial UI.
No remote Supabase migration or Vercel deployment is authorized in this
development macro-iteration. The public game remains on the last approved
production release; these changes exist only on the isolated branch.

