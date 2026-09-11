import type { Page } from '@playwright/test';
import { BasePage, SETTLE } from './base.page';

/** "My Campaigns" landing screen, where a new campaign is started. */
export class CampaignLandingPage extends BasePage {
  private readonly createCampaignLink = this.page.getByRole('button', {
    name: 'Create campaign',
  });

  private readonly scratchCard = this.page
    .locator('.digit-campaign-home-card')
    .filter({ hasText: 'Create a new campaign from scratch' });

  // The id is the stable handle; the aria-label fallback covers builds where the
  // standalone id has not landed yet.
  private readonly continueButton = this.page
    .locator(
      "#campaign-campaign-home-standalone-create-new-campaign-from-scratch-btn, button[aria-label='Continue']",
    )
    .first();

  constructor(page: Page) {
    super(page);
  }

  /** Whether the My Campaigns landing screen is on show. */
  async isDisplayed(): Promise<boolean> {
    await this.createCampaignLink.waitFor({ timeout: 60_000 });
    return this.createCampaignLink.isVisible();
  }

  async clickCreateCampaign(): Promise<void> {
    await this.createCampaignLink.waitFor();
    await this.createCampaignLink.click();
  }

  async clickScratchCard(): Promise<void> {
    await this.scratchCard.waitFor();
    await this.settle(SETTLE.short);
    await this.scratchCard.click();
  }

  async clickContinue(): Promise<void> {
    await this.continueButton.waitFor();
    await this.settle(SETTLE.short);
    await this.continueButton.click();
    await this.waitForOverlayToHide();
  }
}
