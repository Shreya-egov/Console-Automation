# Specs

One file per console step. Each spec runs under both campaign-type projects
(`bednet`, `mrdn`) — the type comes from the `campaignType` fixture, so a case
that only applies to one type calls `test.skip()` with the reason instead of
being duplicated.

Tags: `@sanity` (the happy paths), `@negative` (validation), `@smoke`
(`checklist.spec.ts`, the full flow to a created campaign).

Not ported from the Java suite: the HRMS and PGR-complaint suites. They are
unrelated to the campaign console and still live in `Web-Automation`.
