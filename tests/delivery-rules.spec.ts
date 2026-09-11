import { test, expect } from '../src/fixtures/test';
import { hasCycles } from '../src/config/campaign';

test.describe('Configure delivery rules', () => {
  test('configures and submits the delivery strategy', { tag: ['@sanity'] }, async ({ flow }) => {
    const delivery = await flow.toDeliveryRules();

    await delivery.clickConfigureDelivery();

    // Opens on the cycles / deliveries / observation-strategy screen.
    await delivery.clickNext();

    // Cycle dates are only a step for campaign types that have them.
    await delivery.fillDatesAndNextIfPresent();

    // Delivery conditions -> summary.
    await delivery.clickNext();
    await delivery.clickSubmit();

    expect(
      await delivery.isConfigureDeliveryButtonVisible(),
      'Should return to the campaign-details page after submitting the delivery strategy',
    ).toBe(true);
  });

  // ==================== Cycle dates ====================

  /**
   * Cycle-date cases only apply to multi-cycle types: as of the 2026-09-09
   * hcm-demo build a single-cycle type such as BEDNET has no cycle-date screen at
   * all, so there is no "fill the cycle dates" validation to assert for it.
   *
   * The skip sits on the group so it is decided from the project's campaign type
   * before any fixture runs — a skip inside the test body would log in first.
   */
  test.describe('Cycle dates', () => {
    test.skip(
      ({ campaignType }) => !hasCycles(campaignType),
      'This campaign type has no cycle-date screen',
    );

    test(
      'blocks the cycle step when no cycle date is filled',
      { tag: ['@negative'] },
      async ({ flow }) => {
        const delivery = await flow.toDeliveryRules();

        await delivery.clickConfigureDelivery();
        // Past the cycles / deliveries screen onto the cycle-date screen, then
        // try to leave it with nothing filled.
        await delivery.clickNext();
        await delivery.clickNext();

        expect(
          await delivery.isCycleDateToastVisible(),
          "Toast 'Please fill the cycle dates to move ahead.' should appear when no dates are filled",
        ).toBe(true);
      },
    );

    test(
      'blocks the cycle step when only the first start date is filled',
      { tag: ['@negative'] },
      async ({ flow }) => {
        const delivery = await flow.toDeliveryRules();

        await delivery.clickConfigureDelivery();
        await delivery.clickNext();
        await delivery.fillStartDate();
        await delivery.clickNext();

        expect(
          await delivery.isCycleDateToastVisible(),
          "Toast 'Please fill the cycle dates to move ahead.' should appear when only the start date is filled",
        ).toBe(true);
      },
    );
  });

  // ==================== Delivery conditions ====================

  test(
    'refuses a non-numeric delivery condition value',
    { tag: ['@negative'] },
    async ({ flow }) => {
      const delivery = await flow.toDeliveryConditions();

      // The value field is numeric-only and refuses letters as they are typed, so
      // a non-numeric entry leaves it empty rather than showing a message.
      const kept = await delivery.typeConditionValueAndGetValue(0, 'abc');
      expect(kept, 'Delivery condition value should refuse non-numeric input').toBe('');

      await delivery.clickNext();

      expect(
        await delivery.isOnDeliveryConditionsStep(),
        'Should not advance past the delivery conditions with a non-numeric value',
      ).toBe(true);
    },
  );

  test(
    'refuses an empty delivery condition value',
    { tag: ['@negative'] },
    async ({ flow }) => {
      const delivery = await flow.toDeliveryConditions();

      await delivery.typeConditionValueAndGetValue(0, '');
      await delivery.clickNext();

      expect(
        await delivery.isOnDeliveryConditionsStep(),
        'Should not advance past the delivery conditions with an empty value',
      ).toBe(true);
    },
  );

  /**
   * BEDNET only. Its first condition is a count ("Number of individuals per bed
   * net"), so 0 is meaningless and refused. MR-DN's conditions are age ranges
   * ("Age (in months) in between 3 and 11"), where 0 is legitimate and is
   * accepted — so there is no MR-DN counterpart to this case.
   */
  test.describe('Zero condition value', () => {
    test.skip(
      ({ campaignType }) => campaignType !== 'BEDNET',
      'Zero is a legitimate value for this campaign type',
    );

    test('refuses a zero delivery condition value', { tag: ['@negative'] }, async ({ flow }) => {
      const delivery = await flow.toDeliveryConditions();

      await delivery.typeConditionValueAndGetValue(0, '0');
      await delivery.clickNext();

      // Rejection is silent — Next simply does not advance.
      expect(
        await delivery.isOnDeliveryConditionsStep(),
        'Should not advance past the delivery conditions with a value of 0',
      ).toBe(true);
    });
  });
});
