import type { Page } from '@playwright/test';
import { BasePage } from './base.page';

/** Employee home screen, reached after login. */
export class HomePage extends BasePage {
  readonly ulbLabel = this.page.locator('.digit-topbar-ulb');

  constructor(page: Page) {
    super(page);
  }

  async isDisplayed(): Promise<boolean> {
    await this.ulbLabel.waitFor();
    return this.ulbLabel.isVisible();
  }
}
