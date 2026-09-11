import { test as base, expect } from '@playwright/test';
import { config, describeRun } from '../config/env';
import type { CampaignType } from '../config/campaign';
import { LoginPage } from '../pages/login.page';
import { HomePage } from '../pages/home.page';
import { CampaignFlow } from '../flows/campaign.flow';

/** Options set per project in playwright.config.ts. */
export type TestOptions = {
  /**
   * Campaign type under test. Each project pins one, so a spec written once runs
   * for every type instead of being duplicated per type.
   */
  campaignType: CampaignType;
};

export type TestFixtures = {
  /** Home page, reached by a real login. Depend on it to be logged in. */
  home: HomePage;
  /** Campaign-creation wizard driver, pinned to the project's campaign type. */
  flow: CampaignFlow;
};

let bannerPrinted = false;

export const test = base.extend<TestOptions & TestFixtures>({
  campaignType: ['BEDNET', { option: true }],

  /**
   * Logs in for every test.
   *
   * A shared storageState would be faster, but each test here creates its own
   * campaign and the console's session carries tenant and role context that the
   * campaign screens read on load — so a real login per test is what keeps the
   * tests independent of each other's state.
   */
  home: async ({ page }, use) => {
    if (!bannerPrinted) {
      console.log(`=== Test run ===\n${describeRun()}`);
      bannerPrinted = true;
    }

    await page.goto(config.baseUrl, { timeout: 120_000 });
    await page.waitForLoadState('networkidle');

    const login = new LoginPage(page);
    const home = await login.login(config.username, config.password);

    await use(home);
  },

  flow: async ({ page, campaignType, home }, use) => {
    // `home` is depended on for its side effect: the login must have happened
    // before any campaign screen is driven.
    void home;
    await use(new CampaignFlow(page, campaignType));
  },
});

export { expect };
