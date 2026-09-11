# console-automation

Playwright + TypeScript UI automation for the **DIGIT HCM campaign console** —
the create-campaign wizard, from "create from scratch" through to a created
campaign.

Ported from the Java/TestNG suite in `Web-Automation`, keeping its locators and
its hard-won workarounds. The HRMS and PGR-complaint suites were not ported and
still run from there.

## Setup

```bash
npm install
npm run browsers          # playwright install --with-deps chromium
cp .env.template .env     # then fill in USERNAME / PASSWORD
```

`.env` is git-ignored. Everything in it can also come from the process
environment, which is how CI supplies it.

| Variable | Purpose |
| --- | --- |
| `BASE_URL` | login page of the environment under test (also selects the test-data block: uat / demo / qa) |
| `USERNAME`, `PASSWORD` | a user with campaign-manager rights there |
| `BROWSER` | `chromium` (bundled) or `chrome` (installed channel) |
| `HEADLESS` | `true` / `false` |
| `HIERARCHY_NAME` | boundary hierarchy the flow selects, default `CHAD - ITN` |
| `WORKERS`, `RETRIES` | optional run tuning |

## Running

```bash
npm test                     # everything, both campaign types
npm run test:sanity          # happy paths only
npm run test:negative        # validation cases only
npm run test:smoke           # the one full flow through to a created campaign
npm run test:bednet          # one campaign type
npm run test:headed          # watch it drive
npm run test:ui              # Playwright UI mode, for debugging a single spec
npm run report               # open the last HTML report
npm run typecheck
```

Narrow to one case with the usual Playwright flags:

```bash
npx playwright test tests/boundary-selection.spec.ts --project=bednet
npx playwright test --grep "rejects a workbook"
```

### Campaign types are projects, not duplicated tests

The Java suite had a `_BEDNET` and an `_MR_DN` copy of nearly every test. Here
the type is a project-level option, so each spec is written once and runs under
both:

```
[bednet] › draft-campaign.spec.ts › fills the draft form end to end
[mrdn]   › draft-campaign.spec.ts › fills the draft form end to end
```

Where the types genuinely differ, a test declares it rather than being
duplicated — `test.skip(!hasCycles(campaignType), ...)` for the cycle-date cases,
which only a multi-cycle type has. The differences themselves live in one place,
`src/config/campaign.ts`.

## Layout

```
playwright.config.ts     projects, timeouts, reporters
src/config/env.ts        .env / process env, with required-key validation
src/config/campaign.ts   campaign types and what differs between them
src/config/testdata.ts   environment-scoped test data (was testdata.properties)
src/pages/               one page object per console screen
src/flows/campaign.flow.ts  walks the wizard to a given step
src/fixtures/test.ts     logged-in `home`, wizard `flow`, `campaignType` option
src/utils/               date picker, date maths, microplan template filler
tests/                   one spec per step
resources/               fixtures for the upload negative cases
```

`CampaignFlow.to*()` exists because the console has no deep links into a
half-built campaign: each step is only reachable from the campaign-details page
of a campaign that the earlier steps created. A test for the upload step
therefore drives every step before it, which is what `toUploadFile()` does.

## Things worth knowing before changing this

- **Locators.** Prefer the DIGIT id or `aria-label` over a role+name: the visible
  text is localised. Where an id flips between states, both are listed —
  `#campaign-details-page-button-delivery-strategy` becomes
  `…-button-edit-delivery-strategy` once the step has been filled in once.
- **`nth()` is scoped, never page-wide.** Boundary options are indexed within the
  open dropdown panel and by the option class, because an open dropdown also
  renders a "Select All" row plus two unclassed checkboxes — so
  `getByRole('checkbox').nth(n)` means different things on level 1 and level 2.
  Delivery-condition values are indexed within `.attribute-container` for the
  same reason.
- **The settle delays in `src/pages/base.page.ts`** are not laziness. Playwright
  waits for actionability, but the console re-renders a screen once its data
  arrives and throws away a click that landed just before. The values came from
  runs against hcm-demo; lower them alongside a full run, not on their own.
- **The date picker's month is read, not assumed.** A field that already holds a
  value opens on that value's month, so counting clicks from today lands
  somewhere else and the failure looks like a missing day cell.
- **Campaign names must fit 30 characters** and the cap is enforced per
  keystroke: a `fill()` longer than the cap leaves the field *empty*, with no
  message. `typeCampaignNameAndGetValue()` types for that reason.
- **The upload template is per-campaign.** It carries the campaign's own
  boundaries and a uuid in a hidden sheet, so the happy path downloads it, fills
  it (`src/utils/microplan-template.ts`) and uploads it back. A committed
  template fails validation.
- **Result waits are bounded** and assert on the persistent card plus its state
  class, not on toast text. An unbounded wait on a toast turns a failed upload
  into a hung suite instead of a reported failure.

## Reporting

`list` on the console, an HTML report in `playwright-report/`, JUnit XML for CI,
and Allure results in `allure-results/` (`npm run allure:generate`, then
`allure:open`) so the existing Allure/GitHub Pages history keeps working.

Failure screenshots, videos and traces land in `test-results/` automatically —
there is no screenshot helper to call. Open a trace with
`npx playwright show-trace test-results/<dir>/trace.zip`.

## CI

`.github/workflows/run-tests.yml` runs the sanity tag on push to `main` and on a
weekday schedule, and takes environment / campaign type / tag inputs on manual
dispatch. It needs `BASE_URL`, `USERNAME` and `PASSWORD` as environment secrets,
and optionally `BROWSER`, `HIERARCHY_NAME`, `WORKERS`, `RETRIES` as variables.

## Status

Typechecks clean, all 76 tests are discovered across the two projects, and the
template filler is verified against a synthetic workbook (targets, facility
activation, one distributor plus one warehouse manager per boundary level, hidden
sheets preserved).

Not yet done: a run against a live environment. That needs credentials, so the
locators are inherited from the passing Java suite rather than re-proven here —
expect the first real run to need a pass of locator fixes, especially on the
checklist screen, whose confirm and back-to-home buttons share one class.

`npm audit` reports two moderate advisories, both the same transitive `uuid`
buffer-bounds issue inside `exceljs`. It is not on any path this suite uses, and
the fix is a breaking `exceljs` major.
