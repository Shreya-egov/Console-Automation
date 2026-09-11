import { test, expect } from '../src/fixtures/test';

test.describe('Mobile app configuration', () => {
  test('configures every module', { tag: ['@sanity'] }, async ({ flow }) => {
    const appConfig = await flow.toAppConfiguration();

    await appConfig.clickSetUpMobileApp();
    await appConfig.configureAllModules();

    expect(
      await appConfig.isModuleListVisible(),
      'Module list should be back on screen once every module has been saved',
    ).toBe(true);

    await appConfig.clickGoBack();
  });

  test(
    'saves the registration module with fields toggled off',
    { tag: ['@sanity'] },
    async ({ flow }) => {
      const appConfig = await flow.toAppConfiguration();

      await appConfig.clickSetUpMobileApp();
      await appConfig.openRegistrationAndDelivery();

      // Each call re-resolves "first switch still on", so this walks down the list.
      for (let i = 0; i < 4; i++) {
        await appConfig.toggleFirstFieldOff();
      }

      await appConfig.clickSaveConfiguration();

      expect(
        await appConfig.isModuleListVisible(),
        'Saving the module should return to the module list',
      ).toBe(true);
    },
  );
});
