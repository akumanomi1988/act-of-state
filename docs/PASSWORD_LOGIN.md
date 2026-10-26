# AOS-051 — Email/password login without repeated email delivery

## Existing players

The first sign-in can still use the original verified magic link. Once in a
government or multiplayer assembly, expand **Configurar contraseña de acceso**
and save a password of at least 12 characters twice. The password is set
by Supabase Auth's `updateUser({password})` while the original identity is
already authenticated; no new account or ID is created, so governments,
parliamentary mandates and party membership remain intact.

Next time, use **Entrar con contraseña** in either lobby or solo. GoTrue's
`signInWithPassword` signs into the same account without issuing an email
for each visit. The existing Supabase browser client already has session
persistence and automatic refresh enabled.

If password enrollment fails because the identity is not recently verified
(or the hosted project's secure-password policy requires reauthentication),
sign in once with a new email link and try again. The UI displays the
server-policy error without bypassing it. No service-role key or direct Auth
database manipulation is involved.

## Recovery and email fallback

The original `signInWithOtp` remains available and the invitation
redirect preserves its match code. The **He olvidado mi contraseña** action
uses `resetPasswordForEmail` only when the player requests it; it gives
the same generic response regardless of whether the email is registered.
An email may still be required for initial enrollment, account recovery,
suspicious sessions and security-sensitive password changes. These are
not routine logins.

No frontend stores, logs, hashes or serializes user passwords. Both form
password values are erased after every request. HTTPS and the actual
password complexity and rate-limit policy remain Supabase responsibilities.
The UI checks a 12-character minimum and confirmation but is not an
alternative to server password validation.

## Verification

- Two original local pure password-policy tests passed.
- Vitest/React checks cover password login through GoTrue's SDK
  integration, generic errors, opting into recovery, enrollment with the
  same account and mismatched-password rejection.
- An extended local GoTrue/Mailpit real-browser flow adds a password to
  the original guest of a two-party match, logs them out, signs back in
  via password, checks the **unchanged Supabase UID**, retained seat and
  reload, and asserts that no OTP endpoint is called again.
- No hosted user credentials are read or modified, and no external
  emails are sent in these tests. These checks are pending integrated CI
  execution on the development branch.

## Release policy

AOS-051 is developed on `aos/050-national-reforms-campaign`. No Vercel
automatic deployment is allowed. Vercel's preview toggle, ignored build
rule, and committed `vercel.json` `git.deploymentEnabled:false` now
provide layered deployment protection. Only a separately authorized,
large validated release may replace production.

See also `docs/NO_VERCEL_AUTODEPLOY.md`.
