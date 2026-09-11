import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

/** Employee home screen — the launch point for every other flow. */
export class HomePage extends BasePage {
  readonly ulbLabel = this.page.locator('.digit-topbar-ulb');
  readonly createComplaintButton = this.actionCard('Create Complaint');
  readonly searchComplaintButton = this.actionCard('Search Complaint');
  readonly createUserButton = this.actionCard('Create User');
  readonly searchUserButton = this.actionCard('Search User');

  constructor(page: Page) {
    super(page);
  }

  private actionCard(label: string): Locator {
    return this.page.locator(`h2.digit-button-label:has-text('${label}')`);
  }

  async isDisplayed(): Promise<boolean> {
    await this.ulbLabel.waitFor();
    return this.ulbLabel.isVisible();
  }

  async goToCreateComplaint(): Promise<void> {
    await this.createComplaintButton.click();
    await this.page.waitForLoadState();
  }

  async goToSearchComplaint(): Promise<void> {
    await this.searchComplaintButton.click();
    await this.page.waitForLoadState();
  }

  async goToCreateUser(): Promise<void> {
    await this.createUserButton.click();
    await this.page.waitForLoadState();
  }

  async goToSearchUser(): Promise<void> {
    await this.searchUserButton.click();
    await this.page.waitForLoadState();
  }
}
