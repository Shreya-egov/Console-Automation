import { test, expect } from '../src/fixtures/test';

test.describe('Boundary selection', () => {
  test(
    'selecting every level advances to the delivery step',
    { tag: ['@sanity'] },
    async ({ flow }) => {
      const boundaries = await flow.toBoundarySelection();

      await boundaries.selectLevels();
      await boundaries.clickNext();
      await boundaries.clickSubmit();

      expect(
        await flow.delivery.isConfigureDeliveryButtonVisible(),
        'Should land on the delivery-rules step after completing boundary selection',
      ).toBe(true);
    },
  );

  test(
    'blocks a partial selection',
    { tag: ['@negative'] },
    async ({ flow }) => {
      const boundaries = await flow.toBoundarySelection();

      await boundaries.selectLevelOption(0);
      await boundaries.selectLevelOption(1);
      await boundaries.clickNext();

      expect(
        await boundaries.isMandatoryFieldsToastVisible(),
        'Mandatory-fields toast should appear when the deeper levels are left unselected',
      ).toBe(true);
    },
  );

  test('blocks an empty selection', { tag: ['@negative'] }, async ({ flow }) => {
    const boundaries = await flow.toBoundarySelection();

    await boundaries.clickNext();

    expect(
      await boundaries.isMandatoryFieldsToastVisible(),
      'Mandatory-fields toast should appear when no boundary is selected',
    ).toBe(true);
  });

  test(
    'blocks a selection missing the lowest level',
    { tag: ['@negative'] },
    async ({ flow }) => {
      const boundaries = await flow.toBoundarySelection();

      await boundaries.selectLevelOption(0);
      // A second-level boundary with no descendants selected below it, so the
      // deeper levels stay empty however many of them are filled in.
      await boundaries.selectSecondLevelWithoutDescendants();
      await boundaries.selectLevelOption(2);
      await boundaries.selectLevelOption(3);
      await boundaries.clickNext();

      expect(
        await boundaries.isMandatoryFieldsToastVisible(),
        'Mandatory-fields toast should appear when the lowest boundary level is not selected',
      ).toBe(true);
    },
  );
});
