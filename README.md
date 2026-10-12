# console-automation

Playwright + TypeScript UI automation for the **DIGIT HCM campaign console** —
the create-campaign wizard, from "create from scratch" through to a created
campaign.

Ported from the Java/TestNG suite in `Web-Automation`, keeping its locators and
its hard-won workarounds. Only the campaign creation flow is covered here.

## Setup

```bash
cd console-automation
npm install
npm run browsers          # installs Chromium and its system deps
cp .env.template .env     # then edit .env: set USERNAME and PASSWORD (BASE_URL defaults to hcm-demo)
```

`.env` is git-ignored. Everything in it can also come from the process
environment, which is how CI supplies it.

| Variable | Purpose |
| --- | --- |
| `BASE_URL` | login page of the environment under test |
| `USERNAME`, `PASSWORD` | a user with campaign-manager rights there |
| `BROWSER` | `chromium` (bundled) or `chrome` (installed channel) |
| `HEADLESS` | `true` / `false` |
| `HIERARCHY_NAME` | boundary hierarchy the flow selects, default `CHAD - ITN` |
| `WORKERS`, `RETRIES` | optional run tuning |

## Running

```bash
# Check it compiles and lists the tests
npm run typecheck
npx playwright test --list

# Run the campaign creation flow
npm test                     # both campaign types
npm run test:bednet          # BEDNET only
npm run test:mrdn            # MR-DN only
npm run test:headed          # watch the browser drive it
npm run test:ui              # Playwright UI mode, step through for debugging

# One type, headed, one worker
npx playwright test --project=bednet --headed --workers=1

# Credentials without a .env
USERNAME=... PASSWORD=... npm run test:bednet

# Results
npm run report                                           # HTML report
npx playwright show-trace test-results/<dir>/trace.zip   # trace from a failed run
npm run allure:generate && npm run allure:open           # needs the allure CLI installed
```

The downloaded and filled microplan templates are kept in `templates/` for
inspection. A full run can take up to 30 minutes, mostly the mobile-app setup
and the upload validation.

### Scope

The suite is one end-to-end test, `tests/create-campaign.spec.ts`: it starts a
campaign from scratch and drives every wizard step through to a created campaign.
Each step is a `test.step` with its own check, so a failure is reported against
the step it happened in.

The per-step negative/validation cases, and the HRMS and PGR-complaint suites,
are not part of this project. They still run from the Java suite in
`Web-Automation`.

### Campaign types are projects, not duplicated tests

The campaign type is a project-level option, so the flow is written once and runs
under both:

```
[bednet] › create-campaign.spec.ts › Campaign creation › creates a campaign from scratch
[mrdn]   › create-campaign.spec.ts › Campaign creation › creates a campaign from scratch
```

Where the types genuinely differ (MR-DN has a cycle-date screen and a referral
module, BEDNET has neither), the page objects check `src/config/campaign.ts`
rather than the test branching.

## Layout

```
playwright.config.ts     projects, timeouts, reporters
src/config/env.ts        .env / process env, with required-key validation
src/config/campaign.ts   campaign types and what differs between them
src/pages/               one page object per console screen
src/flows/campaign.flow.ts  the wizard, one method per step
src/fixtures/test.ts     logged-in `home`, wizard `flow`, `campaignType` option
src/utils/               date picker, date maths, microplan template filler
tests/create-campaign.spec.ts  the end-to-end campaign creation test
```

`CampaignFlow`'s steps must run in order: the console has no deep links into a
half-built campaign, and each step is only reachable from the campaign-details
page of a campaign that the earlier steps created.

## Things worth knowing before changing this

- **Locators.** Prefer the DIGIT id or `aria-label` over a role+name: the visible
  text is localised. Where an id flips between states, both are listed —
  `#campaign-details-page-button-delivery-strategy` becomes
  `…-button-edit-delivery-strategy` once the step has been filled in once.
- **`nth()` is scoped, never page-wide.** Boundary options are indexed within the
  open dropdown panel and by the option class, because an open dropdown also
  renders a "Select All" row plus two unclassed checkboxes — so
  `getByRole('checkbox').nth(n)` means different things on level 1 and level 2.
- **The settle delays in `src/pages/base.page.ts`** are not laziness. Playwright
  waits for actionability, but the console re-renders a screen once its data
  arrives and throws away a click that landed just before. The values came from
  runs against hcm-demo; lower them alongside a full run, not on their own.
- **The date picker's month is read, not assumed.** A field that already holds a
  value opens on that value's month, so counting clicks from today lands
  somewhere else and the failure looks like a missing day cell.
- **Campaign names must fit 30 characters** and the cap is enforced per
  keystroke: a `fill()` longer than the cap leaves the field *empty*, with no
  message. `enterUniqueCampaignName()` keeps the generated name inside it.
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

`.github/workflows/run-tests.yml` runs the flow on push to `main` and on a
weekday schedule, and takes environment and campaign-type inputs on manual
dispatch. It needs `BASE_URL`, `USERNAME` and `PASSWORD` as environment secrets,
and optionally `BROWSER`, `HIERARCHY_NAME`, `WORKERS`, `RETRIES` as variables.

## Status

Typechecks clean and the one flow test is discovered under both projects. The
template filler matches `MicroplanTemplateFiller` on the `DEMO` branch of
`Web-Automation` (targets, facility activation, one distributor plus one
warehouse manager per boundary level, hidden sheets preserved).
