import type { Locator, Page } from '@playwright/test';
import { BasePage, SETTLE } from './base.page';
import { displayName, hasReferralModule, type CampaignType } from '../config/campaign';

/**
 * "Set up mobile application": a list of module cards, each of which opens its own
 * configuration screen and returns to the list once saved.
 *
 * Module cards are addressed by their DIGIT id (setup-mobile-app-card-<MODULE>)
 * rather than by their visible description, which is localised and changes
 * between builds.
 */
const MODULES = {
  registration: 'REGISTRATION',
  closeHousehold: 'CLOSEHOUSEHOLD',
  referral: 'REFERRAL',
  complaints: 'COMPLAINTS',
  inventory: 'INVENTORY',
  stockReconciliation: 'STOCKRECONCILIATION',
  reports: 'STOCKREPORTS',
  permissionHandler: 'PERMISSIONHANDLER',
} as const;

export class AppConfigurationPage extends BasePage {
  // Set-vs-Edit: the id flips once the step has been filled in before.
  private readonly setUpMobileAppButton = this.page
    .locator(
      '#campaign-details-page-button-setup-mobile-app, ' +
        '#campaign-details-page-button-edit-mobile-app',
    )
    .first();

  private readonly deliveryTypeDropdown = this.page.getByRole('button', {
    name: 'Select an option',
  });
  private readonly saveConfigurationButton = this.page.getByRole('button', {
    name: 'Save Configuration',
  });
  private readonly goBackButton = this.page.getByRole('button', { name: 'Go Back' });
  private readonly firstToggleSwitchOn = this.page
    .getByRole('switch', { name: 'Toggle switch on' })
    .first();
  private readonly noFlowConfigError = this.page.getByText('No flow configuration found');

  constructor(
    page: Page,
    private readonly campaignType: CampaignType,
  ) {
    super(page);
  }

  private moduleCard(moduleId: string): Locator {
    return this.page.locator(`button[id='setup-mobile-app-card-${moduleId}']`);
  }

  /**
   * The referral card's id is absent on some builds, so its accessible
   * description is kept as a fallback for that one module.
   */
  private referralCard(): Locator {
    return this.moduleCard(MODULES.referral)
      .or(
        this.page
          .getByRole('button', { name: 'Record and manage referrals' })
          .getByLabel('Configure'),
      )
      .first();
  }

  async clickSetUpMobileApp(): Promise<void> {
    await this.setUpMobileAppButton.waitFor();
    await this.settle(SETTLE.module);
    await this.setUpMobileAppButton.click();
  }

  async selectDeliveryType(): Promise<void> {
    await this.deliveryTypeDropdown.click();
    await this.page
      .getByRole('button', { name: displayName(this.campaignType), exact: true })
      .click();
  }

  /**
   * Saves the module currently open and waits for the module list to come back.
   *
   * The config screen intermittently renders "No flow configuration found", which
   * a reload fixes, so both that and a Submit that never becomes ready are
   * retried rather than failing the whole chain.
   */
  async clickSaveConfiguration(): Promise<void> {
    const submit = this.saveConfigurationButton.last();

    for (let attempt = 1; attempt <= 3; attempt++) {
      if (await this.noFlowConfigError.isVisible()) {
        console.log(
          `[AppConfig] 'No flow configuration found' shown — refreshing (attempt ${attempt})`,
        );
        await this.page.reload();
        await this.settle(SETTLE.module);
      }
      try {
        await submit.waitFor({ timeout: 15_000 });
        await submit.click();
        await this.waitForModuleListToReturn();
        return;
      } catch {
        console.log(`[AppConfig] Submit not ready — refreshing (attempt ${attempt})`);
        await this.page.reload();
        await this.settle(SETTLE.module);
      }
    }
    await submit.click();
  }

  /**
   * Waits for the module list to come back after a module has been saved.
   *
   * Saving navigates config screen -> app-config-save -> module list, and the
   * click alone does not wait for that round trip. Without this, the next
   * configure* call starts waiting for its module card while the browser is still
   * mid-transition, and only succeeds because the transition usually finishes
   * inside that wait.
   *
   * That made the chain quietly dependent on unrelated timing: the referral module
   * is skipped for single-cycle types, so those lost the settle time the
   * multi-cycle types got from that extra save cycle, and their module waits timed
   * out while the others' did not. Waiting here makes the sequence deterministic
   * for every campaign type.
   */
  private async waitForModuleListToReturn(): Promise<void> {
    try {
      await this.page
        .locator("div[id^='setup-mobile-app-card-']")
        .first()
        .waitFor({ timeout: 60_000 });
    } catch {
      // Let the next module's own wait report the failure, with its own name.
      console.log('[AppConfig] module list did not return after save');
    }
  }

  /** Opens a module, then saves it straight back — the default per-module pass. */
  private async configureModule(moduleId: string): Promise<void> {
    const card = this.moduleCard(moduleId);
    await card.waitFor();
    await this.settle(SETTLE.module);
    await card.click();
    await this.settle(SETTLE.module);
    await this.clickSaveConfiguration();
  }

  async configureRegistrationAndDelivery(): Promise<void> {
    await this.configureModule(MODULES.registration);
  }

  async configureCloseHousehold(): Promise<void> {
    await this.configureModule(MODULES.closeHousehold);
  }

  /** No-op for campaign types whose mobile-app setup has no referral module. */
  async configureReferral(): Promise<void> {
    if (!hasReferralModule(this.campaignType)) return;
    const card = this.referralCard();
    await card.waitFor();
    await this.settle(SETTLE.module);
    await card.click();
    await this.settle(SETTLE.module);
    await this.clickSaveConfiguration();
  }

  async configureComplaints(): Promise<void> {
    await this.configureModule(MODULES.complaints);
  }

  async configureInventory(): Promise<void> {
    await this.configureModule(MODULES.inventory);
  }

  async configureStockReconciliation(): Promise<void> {
    await this.configureModule(MODULES.stockReconciliation);
  }

  async configureReports(): Promise<void> {
    await this.configureModule(MODULES.reports);
  }

  async configurePermissionHandler(): Promise<void> {
    await this.configureModule(MODULES.permissionHandler);
  }

  /** Every module in the order the console expects them to be configured. */
  async configureAllModules(): Promise<void> {
    await this.configureRegistrationAndDelivery();
    await this.configureCloseHousehold();
    await this.configureReferral();
    await this.configureComplaints();
    await this.configureInventory();
    await this.configureStockReconciliation();
    await this.configureReports();
    await this.configurePermissionHandler();
  }

  /** Opens the registration module without saving it, for toggle-level cases. */
  async openRegistrationAndDelivery(): Promise<void> {
    const card = this.moduleCard(MODULES.registration);
    await card.waitFor();
    await this.settle(SETTLE.module);
    await card.click();
    await this.settle(SETTLE.module);
  }

  /**
   * Turns off whichever field toggle is currently the first one still on.
   *
   * "First switch that is on" is re-resolved on every call by design: switching
   * one off removes it from that set, so repeated calls walk down the list.
   */
  async toggleFirstFieldOff(): Promise<void> {
    await this.firstToggleSwitchOn.click();
    await this.settle(SETTLE.module);
  }

  async isModuleListVisible(): Promise<boolean> {
    const card = this.moduleCard(MODULES.registration);
    await card.waitFor({ timeout: 60_000 });
    return card.isVisible();
  }

  async clickGoBack(): Promise<void> {
    await this.goBackButton.click();
  }
}
