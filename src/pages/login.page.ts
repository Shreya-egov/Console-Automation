import type { Page } from '@playwright/test';
import { BasePage, SETTLE } from './base.page';
import { HomePage } from './home.page';

/**
 * Login screen.
 *
 * The tenant dropdown only appears for users mapped to more than one tenant, so
 * it is selected when present rather than unconditionally.
 */
export class LoginPage extends BasePage {
  private readonly usernameInput = this.page.locator("input[name='username']");
  private readonly passwordInput = this.page.locator("input[name='password']");
  private readonly tenantDropdown = this.page.getByRole('button', { name: 'Select an option' });
  private readonly tenantOption = this.page.locator('.main-option');
  private readonly privacyCheckbox = this.page.locator('#privacy-component-check');
  private readonly loginButton = this.page.locator('#formcomposer-submit-action');

  constructor(page: Page) {
    super(page);
  }

  /**
   * Logs in and returns the home page.
   *
   * @param tenantName pick a specific tenant; omit to take the first one offered.
   */
  async login(username: string, password: string, tenantName?: string): Promise<HomePage> {
    await this.enterUsername(username);
    await this.enterPassword(password);

    if (await this.tenantDropdown.isVisible()) {
      await (tenantName ? this.selectTenant(tenantName) : this.selectFirstTenant());
    }

    await this.acceptPrivacyPolicy();
    await this.clickLogin();
    await this.page.waitForLoadState();
    return new HomePage(this.page);
  }

  async enterUsername(username: string): Promise<void> {
    await this.usernameInput.click();
    await this.usernameInput.fill(username);
  }

  async enterPassword(password: string): Promise<void> {
    await this.passwordInput.click();
    await this.passwordInput.fill(password);
  }

  async selectFirstTenant(): Promise<void> {
    await this.tenantDropdown.click();
    await this.settle(SETTLE.short);
    await this.tenantOption.first().click();
  }

  async selectTenant(tenantName: string): Promise<void> {
    await this.tenantDropdown.click();
    await this.settle(SETTLE.short);
    await this.page.getByRole('button', { name: tenantName }).click();
  }

  async acceptPrivacyPolicy(): Promise<void> {
    await this.privacyCheckbox.click();
  }

  async clickLogin(): Promise<void> {
    await this.loginButton.click();
  }

  async isLoginPageDisplayed(): Promise<boolean> {
    return this.loginButton.isVisible();
  }
}
