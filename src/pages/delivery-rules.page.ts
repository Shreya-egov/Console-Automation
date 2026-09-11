import type { Locator, Page } from '@playwright/test';
import { BasePage, SETTLE } from './base.page';
import { hasCycles, type CampaignType } from '../config/campaign';
import { addDays, addMonths, addWeeks, today } from '../utils/dates';
import { selectDate } from '../utils/datepicker';

/**
 * "Configure delivery rules": cycles and deliveries, then cycle dates for the
 * types that have them, then the delivery conditions, then a summary.
 */
export class DeliveryRulesPage extends BasePage {
  // Set-vs-Edit: the id flips once the step has been filled in before.
  private readonly configureDeliveryButton = this.page
    .locator(
      '#campaign-details-page-button-delivery-strategy, ' +
        '#campaign-details-page-button-edit-delivery-strategy',
    )
    .first();

  private readonly startDateTextbox = this.page.getByRole('textbox', { name: 'Start date' });
  private readonly endDateTextbox = this.page.getByRole('textbox', { name: 'End date' });
  private readonly nextButton = this.page.getByRole('button', { name: 'Next' });
  private readonly submitButton = this.page.getByRole('button', { name: 'Submit' });
  private readonly cycleDateToast = this.page.getByText(
    'Please fill the cycle dates to move ahead.',
  );

  constructor(
    page: Page,
    private readonly campaignType: CampaignType,
  ) {
    super(page);
  }

  async clickConfigureDelivery(): Promise<void> {
    await this.configureDeliveryButton.waitFor();
    await this.settle(SETTLE.step);
    await this.configureDeliveryButton.click();
  }

  async isConfigureDeliveryButtonVisible(): Promise<boolean> {
    await this.configureDeliveryButton.waitFor({ timeout: 30_000 });
    return this.configureDeliveryButton.isVisible();
  }

  // ==================== CYCLE DATES ====================

  async fillStartDate(): Promise<void> {
    await selectDate(this.page, this.startDateTextbox.first(), addDays(today(), 1));
  }

  async fillEndDate(): Promise<void> {
    await selectDate(this.page, this.endDateTextbox.first(), addMonths(today(), 1));
  }

  /** Three weekly cycles a week apart, which is what MR-DN's schedule requires. */
  async fillCycleDates(): Promise<void> {
    let cycleStart = addDays(today(), 1);

    for (let cycle = 0; cycle < 3; cycle++) {
      const cycleEnd = addWeeks(cycleStart, 1);
      await selectDate(this.page, this.startDateTextbox.nth(cycle), cycleStart);
      await selectDate(this.page, this.endDateTextbox.nth(cycle), cycleEnd);
      cycleStart = addWeeks(cycleEnd, 1);
    }
  }

  async fillDates(): Promise<void> {
    if (hasCycles(this.campaignType)) {
      await this.fillCycleDates();
    } else {
      await this.fillStartDate();
      await this.fillEndDate();
    }
  }

  /**
   * Whether the screen currently shown is the cycle-date screen.
   *
   * A single-cycle campaign type (e.g. BEDNET) goes straight from the cycles /
   * deliveries screen to the delivery-conditions screen with no cycle-date screen
   * in between, so callers walking the flow must not assume it is there.
   */
  async hasCycleDateStep(): Promise<boolean> {
    try {
      await this.startDateTextbox.first().waitFor({ timeout: 8_000 });
      return this.startDateTextbox.first().isVisible();
    } catch {
      return false;
    }
  }

  /**
   * Fills the cycle dates and advances, but only when the cycle-date screen is
   * actually part of this campaign type's flow.
   *
   * @returns whether it advanced.
   */
  async fillDatesAndNextIfPresent(): Promise<boolean> {
    if (!(await this.hasCycleDateStep())) {
      console.log('[DeliveryRules] No cycle-date step in this flow — skipping');
      return false;
    }
    await this.fillDates();
    await this.clickNext();
    return true;
  }

  async isCycleDateToastVisible(): Promise<boolean> {
    await this.cycleDateToast.waitFor({ timeout: 15_000 });
    return this.cycleDateToast.isVisible();
  }

  // ==================== DELIVERY CONDITIONS ====================

  /**
   * Value input of the Nth delivery condition, 0-based.
   *
   * Each condition renders as an .attribute-container holding an attribute
   * dropdown, an operator dropdown and this value input. Scoping to the container
   * is what makes the index mean the same thing for every campaign type — a
   * page-wide getByRole('textbox').nth(n) does not, because the number and order
   * of conditions differs per type, so index 3 was an attribute dropdown for
   * BEDNET rather than a value field.
   */
  private conditionValue(index: number): Locator {
    return this.page.locator('.attribute-container .digit-employeeCard-input').nth(index);
  }

  /**
   * Types into a delivery condition's value field and returns what the field kept.
   *
   * Typing rather than filling is deliberate: the field refuses non-numeric
   * characters per keystroke (so "abc" is kept as ""), and strips a leading
   * minus. Verified on hcm-demo 2026-09-09.
   */
  async typeConditionValueAndGetValue(index: number, value: string): Promise<string> {
    const input = this.conditionValue(index);
    await input.waitFor();
    await this.settle(SETTLE.short);
    await input.click();
    await input.fill('');
    if (value !== '') {
      await input.pressSequentially(value);
    }
    await this.settle(SETTLE.short);
    return input.inputValue();
  }

  /**
   * Whether the delivery-conditions step is still displayed.
   *
   * An unacceptable condition value is refused silently — Next simply does not
   * advance, with no toast, card or inline message — so "was it rejected?" can
   * only be answered by whether this step is still on screen. The summary step
   * that follows renders no condition rows.
   */
  async isOnDeliveryConditionsStep(): Promise<boolean> {
    await this.settle(SETTLE.short);
    return (await this.page.locator('.attribute-container').count()) > 0;
  }

  async removeResource(resourceName: string): Promise<void> {
    const removeButton = this.page.getByRole('button', { name: `Remove ${resourceName}` });
    await removeButton.waitFor();
    await removeButton.click();
  }

  // ==================== WIZARD CONTROLS ====================

  async clickNext(): Promise<void> {
    await this.nextButton.waitFor();
    await this.settle(SETTLE.step);
    await this.nextButton.click();
  }

  async clickSubmit(): Promise<void> {
    await this.submitButton.waitFor();
    await this.settle(SETTLE.step);
    await this.submitButton.click();
  }
}
