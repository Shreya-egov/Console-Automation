import type { Page } from '@playwright/test';
import { BasePage, SETTLE } from './base.page';

/**
 * The checklist step and the final "Create Campaign" action that closes the flow.
 *
 * The confirm and back-to-homepage controls share one class — the screen only ever
 * shows one large primary button at a time, and they are different buttons on
 * consecutive screens, so they are kept as separately named methods.
 */
export class ChecklistPage extends BasePage {
  private readonly createChecklistButton = this.page.locator(
    '#campaign-details-page-button-checklist',
  );
  private readonly configureButton = this.page
    .getByRole('button', { name: 'Configure', exact: true })
    .first();
  private readonly configureChecklistField = this.page.locator(
    '#campaign-checklist-create-standalone-form-field-primary',
  );
  private readonly primaryLargeButton = this.page.locator('.digit-button-primary.large');
  private readonly createCampaignButton = this.page.locator(
    '#campaign-details-page-final-save-campaign',
  );
  private readonly myCampaignsButton = this.page.locator("button[aria-label*='My Campaigns']");

  constructor(page: Page) {
    super(page);
  }

  async clickCreateChecklist(): Promise<void> {
    await this.createChecklistButton.click();
  }

  async clickConfigureList(): Promise<void> {
    await this.configureButton.click();
  }

  async clickConfigureChecklist(): Promise<void> {
    await this.configureChecklistField.click();
  }

  async clickConfirmChecklist(): Promise<void> {
    await this.primaryLargeButton.click();
  }

  async clickBackToHomepage(): Promise<void> {
    await this.primaryLargeButton.click();
  }

  /**
   * Submits the campaign and returns to My Campaigns.
   *
   * The final action sits below the fold on the summary screen, hence the scroll
   * before the click.
   */
  async clickCreateCampaign(): Promise<void> {
    await this.page.mouse.wheel(0, 500);
    await this.createCampaignButton.click();
    await this.settle(SETTLE.step);
    await this.myCampaignsButton.click();
    await this.settle(SETTLE.short);
  }

  async isCreateCampaignButtonVisible(): Promise<boolean> {
    await this.createCampaignButton.waitFor({ timeout: 60_000 });
    return this.createCampaignButton.isVisible();
  }
}
