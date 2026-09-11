import { test, expect } from '../src/fixtures/test';

/**
 * The one test that takes the wizard all the way to a created campaign: every
 * earlier step is exercised on the way through, so this is the suite's smoke
 * test for the whole console flow.
 */
test.describe('Checklist and campaign creation', () => {
  test(
    'creates the campaign after configuring the checklist',
    { tag: ['@sanity', '@smoke'] },
    async ({ flow }) => {
      const checklist = await flow.toChecklist();

      await checklist.clickCreateChecklist();
      await checklist.clickConfigureList();
      await checklist.clickConfigureChecklist();
      await checklist.clickConfirmChecklist();
      await checklist.clickBackToHomepage();

      expect(
        await checklist.isCreateCampaignButtonVisible(),
        'Final "Create Campaign" action should be available once the checklist is configured',
      ).toBe(true);

      await checklist.clickCreateCampaign();

      expect(
        await flow.landing.isDisplayed(),
        'Should land back on My Campaigns once the campaign is created',
      ).toBe(true);
    },
  );
});
