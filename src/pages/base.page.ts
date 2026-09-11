import type { Locator, Page } from '@playwright/test';

/**
 * Settle delays inherited from the Java suite.
 *
 * Playwright auto-waits for an element to be actionable, which covers most of
 * what an explicit sleep would. These remain because the console re-renders a
 * screen after its data arrives: the element is actionable, gets clicked, and the
 * click is then thrown away by the re-render. The values were derived empirically
 * against hcm-demo — lower them only alongside a full run.
 */
export const SETTLE = {
  /** After a click that only reveals an option list. */
  short: 1_000,
  /** Between wizard steps. */
  step: 3_000,
  /** Around the mobile-app module screens, which are a save-and-return round trip. */
  module: 6_000,
} as const;

/**
 * Shared behaviour for every page object: the header controls, the popup overlay
 * and the few generic waits the screens need.
 */
export abstract class BasePage {
  protected readonly homeButton: Locator;
  protected readonly backButton: Locator;

  constructor(protected readonly page: Page) {
    this.homeButton = page.locator('.digit-topbar-home');
    this.backButton = page.locator('.digit-back-btn');
  }

  // ==================== NAVIGATION ====================

  async goBack(): Promise<void> {
    await this.page.goBack();
  }

  /** Clicks the in-app back button, falling back to browser history. */
  async clickBackButton(): Promise<void> {
    if (await this.backButton.isVisible()) {
      await this.backButton.click();
    } else {
      await this.goBack();
    }
  }

  async goToHome(): Promise<void> {
    if (await this.homeButton.isVisible()) {
      await this.homeButton.click();
    } else {
      await this.goBack();
    }
  }

  // ==================== WAITS ====================

  protected async settle(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  /**
   * Waits for the DIGIT popup overlay to go away before anything underneath it is
   * touched. Bounded and non-fatal: some screens never render an overlay at all,
   * and a missing one is not a failure by itself.
   */
  protected async waitForOverlayToHide(timeout = 10_000): Promise<void> {
    try {
      await this.page.locator('.digit-popup-overlay').waitFor({ state: 'hidden', timeout });
    } catch {
      // No overlay was shown — nothing to wait for.
    }
  }

  // ==================== VERIFICATION ====================

  url(): string {
    return this.page.url();
  }

  isOnPage(urlPart: string): boolean {
    return this.page.url().includes(urlPart);
  }

  async title(): Promise<string> {
    return this.page.title();
  }
}
