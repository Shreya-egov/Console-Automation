import * as fs from 'fs';
import { test, expect } from '../src/fixtures/test';

/**
 * Creates a campaign end to end, from "create from scratch" to a created
 * campaign. Runs once per campaign-type project.
 *
 * Each wizard step is a test.step, so a failure is reported against the step it
 * happened in, and each step checks it landed where the next one starts.
 */
test.describe('Campaign creation', () => {
  test('creates a campaign from scratch', async ({ flow }) => {
    await test.step('start from scratch', async () => {
      await flow.startFromScratch();
    });

    // Selecting the type waits for the project's type to be offered, so a type
    // missing from the dropdown fails here rather than further on.
    await test.step('draft: type, name, dates, hierarchy', async () => {
      const name = await flow.createDraft();
      console.log(`[Flow] Campaign name: ${name}`);
      expect(
        await flow.draft.isHierarchyShownOnCampaignDetails(),
        'Selected boundary hierarchy should be reflected on the campaign-details page',
      ).toBe(true);
    });

    await test.step('boundary selection', async () => {
      await flow.selectBoundaries();
      expect(
        await flow.delivery.isConfigureDeliveryButtonVisible(),
        'Should land on the delivery-rules step after boundary selection',
      ).toBe(true);
    });

    await test.step('delivery rules', async () => {
      await flow.configureDeliveryRules();
      expect(
        await flow.delivery.isConfigureDeliveryButtonVisible(),
        'Should return to the campaign-details page after submitting the delivery strategy',
      ).toBe(true);
    });

    await test.step('mobile app configuration', async () => {
      await flow.configureMobileApp();
      expect(
        await flow.appConfig.isModuleListVisible(),
        'Module list should be back on screen once every module has been saved',
      ).toBe(true);
    });

    await test.step('upload campaign data', async () => {
      const filled = await flow.uploadData();
      expect(fs.existsSync(filled), `Filled template should have been written to ${filled}`).toBe(
        true,
      );
    });

    await test.step('checklist', async () => {
      await flow.configureChecklist();
      expect(
        await flow.checklist.isCreateCampaignButtonVisible(),
        'Final "Create Campaign" action should be available once the checklist is configured',
      ).toBe(true);
    });

    await test.step('create campaign', async () => {
      await flow.createCampaign();
      expect(
        await flow.landing.isDisplayed(),
        'Should land back on My Campaigns once the campaign is created',
      ).toBe(true);
    });
  });
});
