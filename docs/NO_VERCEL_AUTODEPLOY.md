# ACT OF STATE — No Vercel deployment without express user authorization

## Instruction from the project owner

Verified as of 2026-10-26: project `act-of-state` accepted the Vercel
plugin update `previewDeploymentsDisabled=true` and
`commandForIgnoringBuildStep='exit 0'`. The repository's
`vercel.json` now includes `git.deploymentEnabled:false`. A subsequent
Vercel deployment-list check showed no builds resulting from new GitHub
commits. Note that the ignored-build hook alone can still count canceled
attempts against Vercel's Hobby quotas, so `git.deploymentEnabled:false`
is the primary protection. Deliberate releases should use separately
authorized deployment mechanics after an explicit full acceptance gate.

The owner has explicitly rejected repeated Vercel deployments following
build-rate-limit failures. **Do not run any Vercel deployment, alias change,
redeploy, or production/preview publication without a separate explicit
authorization.** Do not assume that an ordinary request to continue game
development authorizes publication.

GitHub writes must remain on isolated development branches. Avoid merging
into `main`, opening pull requests, or pushing releases where Vercel's
Git integration might automatically publish a production or preview build.

A passing build is not permission to publish. Existing read-only Vercel
status checks do not create a deployment but are not a prerequisite to
ordinary development.

## Safe development and verification

- Implement changes in `aos/050-national-reforms-campaign` or its successor.
- Run unit/Node tests, TypeScript, disposable PostgreSQL 17, local
  GoTrue/PostgREST, and headless browser acceptance independently of Vercel.
- If available, explicitly trigger GitHub Actions on the development branch
  through `workflow_dispatch` without creating a pull request; **verify**
  this triggers no deployment before using any automatic workflow.
- If a runner or dependency is unavailable, record it as an actual blocker,
  rather than bypassing deployment protection or stating tests passed.
- Never apply schema migrations to the production Supabase project before
  the corresponding frontend release is approved; schema and UI versions
  must remain compatible.
- After CI passes, hand over the branch, test receipts, known limitations
  and release steps. **Do not merge or publish until the user separately
  authorizes doing so.**

This policy is an operational constraint on agent actions, not a promise
that external Git provider integration cannot autonomously deploy a pushed
branch; verify that behavior before changing Git-related workflows.
