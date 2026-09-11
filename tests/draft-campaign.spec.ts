import { test, expect } from '../src/fixtures/test';
import { DraftCampaignPage } from '../src/pages/draft-campaign.page';

test.describe('Draft campaign', () => {
  test('fills the draft form end to end', { tag: ['@sanity'] }, async ({ flow, page }) => {
    const draft = await flow.toDraft();

    await draft.clickCampaignTypeDropdown();
    expect(
      await draft.isCampaignTypeVisible(),
      `${draft.campaignDisplayName} option should be visible after opening the campaign type dropdown`,
    ).toBe(true);

    await draft.selectCampaignType();
    await draft.clickNext();
    expect(page.url()).toContain('create-campaign');

    await draft.enterUniqueCampaignName();
    await draft.clickNext();

    await draft.fillStartDate();
    expect(await draft.startDateValue(), 'Start date should not be empty after filling').not.toBe('');

    await draft.fillEndDate();
    expect(await draft.endDateValue(), 'End date should not be empty after filling').not.toBe('');

    await draft.clickSubmit();
    expect(page.url()).toContain('create-campaign');
  });

  test(
    'reflects the selected boundary hierarchy',
    { tag: ['@sanity'] },
    async ({ flow }) => {
      // toBoundaryHierarchy() selects and submits the configured hierarchy.
      const draft = await flow.toBoundaryHierarchy();

      expect(
        await draft.isHierarchyShownOnCampaignDetails(),
        'Selected boundary hierarchy should be reflected after submitting',
      ).toBe(true);
    },
  );

  // ==================== Campaign name ====================

  test(
    'stops accepting campaign-name input at the length cap',
    { tag: ['@negative'] },
    async ({ flow }) => {
      const draft = await flow.toCampaignNameStep();

      // The field stops accepting input at the cap instead of taking a long name
      // and rejecting it, so there is no guideline message to assert — the guard
      // is that an over-length name cannot be entered at all.
      const kept = await draft.typeCampaignNameAndGetValue('ThisCampaignNameIsWayTooLong123456789');

      expect(
        kept.length,
        `Campaign name field should stop accepting input at ${DraftCampaignPage.NAME_MAX_LENGTH} characters`,
      ).toBe(DraftCampaignPage.NAME_MAX_LENGTH);
    },
  );

  const invalidNames = [
    { name: '_Campaign', reason: 'starts with an underscore' },
    { name: 'Camp🎉ign1', reason: 'contains an emoji' },
    { name: 'Camp__aign', reason: 'has consecutive underscores' },
  ];

  for (const { name, reason } of invalidNames) {
    test(`rejects a campaign name that ${reason}`, { tag: ['@negative'] }, async ({ flow }) => {
      const draft = await flow.toCampaignNameStep();
      await draft.enterCampaignName(name);
      await draft.clickNext();

      expect(
        await draft.isCampaignNameErrorVisible(),
        `Guideline error should be shown for a name that ${reason}`,
      ).toBe(true);
    });
  }

  // ==================== Dates ====================

  const dateCases = [
    { label: 'no date is filled', fill: async () => {} },
    { label: 'only the start date is filled', fill: async (d: DraftCampaignPage) => d.fillStartDate() },
    { label: 'only the end date is filled', fill: async (d: DraftCampaignPage) => d.fillEndDate() },
  ];

  for (const { label, fill } of dateCases) {
    test(`refuses to submit the draft when ${label}`, { tag: ['@negative'] }, async ({ flow }) => {
      const draft = await flow.toCampaignDateStep();
      await fill(draft);
      await draft.clickSubmit();

      expect(
        await draft.isDateToastErrorVisible(),
        `Toast error should appear when submitting with ${label}`,
      ).toBe(true);
    });
  }
});
