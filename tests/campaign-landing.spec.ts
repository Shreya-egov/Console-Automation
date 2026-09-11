import { test, expect } from '../src/fixtures/test';

test.describe('Campaign landing', () => {
  test(
    'starts a new campaign from scratch',
    { tag: ['@sanity'] },
    async ({ flow }) => {
      const draft = await flow.toDraft();

      await draft.clickCampaignTypeDropdown();
      expect(
        await draft.isCampaignTypeVisible(),
        `${draft.campaignDisplayName} should be offered on the campaign-type step`,
      ).toBe(true);
    },
  );
});
