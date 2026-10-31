# AOS-050/AOS-059 — Password-first access (development branch; not yet released)

## User-facing contract

ACT OF STATE uses one account across solo government, multiplayer assemblies and the
editorial role-gated console. On all three surfaces, email + password is the primary
sign-in method. It does not send a login email. Mobile and desktop
login now show only password access and account creation as primary options;
legacy email links and reset are found under expandable help. Creating an account may require
**one** email confirmation according to the Supabase Auth provider configuration.
Existing email-link users sign in once via the optional "Acceder por correo" path
and set a password from "Seguridad de la cuenta · Contraseña". Email links never
silently create new accounts.

A forgotten password requests a one-use recovery email and then supports an
authenticated password update. All form errors are returned by Auth and do not
grant access or modify a persistent game without a valid server session.
The same verified user ID retains existing governments, parliamentary seats,
votes, signed decisions and editorial permissions after password changes.

Passwords must be at least 12 characters for creation/update (existing passwords
are still accepted on login), with matching confirmation and native password
autocomplete. The UI never stores passwords outside transient React component
state; only Supabase manages the credentials and standard auth session.
Login errors do not distinguish nonexistent accounts from wrong passwords.
Recovery messages are account-enumeration neutral.

## Backend contract and safety boundaries

- Uses Supabase Auth `signInWithPassword`, `signUp`,
  `signInWithOtp({ options: { shouldCreateUser:false }})`,
  `resetPasswordForEmail` and authenticated `updateUser({ password })`.
- No custom credential table, password hash, Auth SQL, `service_role` key,
  RLS bypass, migration or privileged OAuth relay was introduced.
- Production SMTP is still required for signup confirmation, password reset
  and optional legacy links. Password login itself needs no email.
- Recovery redirects must be allowlisted for each official site/route in Auth
  URL Configuration (government root, /multiplayer, /editorial, approved invite
  callbacks); otherwise return to the permitted origin and navigate manually.
- Supabase may enforce secure password changes or reauthentication, depending
  on hosted security settings. The UI reports the provider's rejection rather
  than claiming success. Provider-side leaked-password protection, Auth rate
  limits and SMTP deliverability require separate operator review.

## Repeatable isolated validation

- `src/AuthGateway.test.tsx`: password login, registration confirmation and
  strength, magic-link fallback, recovery and errors.
- `src/AccountSecurity.test.tsx`: password migration, mismatches and provider
  failures, with no persistence of password form data.
- `tests/real-auth-acceptance.mjs`: creates real local GoTrue users; a fresh
  Chromium profile signs in through the actual password form, reloads its
  multiplayer game, changes the password, signs out and signs back in with
  the rotated password, retaining the original authoritative match.
- `tests/magic-link-acceptance.mjs`: registers accounts using the app form
  first, then runs genuine local Mailpit one-use email-link verification,
  invitation preservation, session isolation and accessibility tests.

GitHub quality and disposable real-auth workflows provide review gating.
These tests must pass before merge; they are not evidence of production
SMTP, external first-time signup, hosted password policy, live user journey
or production release parity. No production deployment is required to run
the isolated CI. Do not merge until signed-off and large enough to justify
one controlled release.
