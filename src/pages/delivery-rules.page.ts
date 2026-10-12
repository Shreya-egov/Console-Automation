import type { Page } from '@playwright/test';
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
