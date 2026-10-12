import type { Page } from '@playwright/test';
import type { CampaignType } from '../config/campaign';
import { CampaignLandingPage } from '../pages/campaign-landing.page';
import { DraftCampaignPage } from '../pages/draft-campaign.page';
import { BoundarySelectionPage } from '../pages/boundary-selection.page';
import { DeliveryRulesPage } from '../pages/delivery-rules.page';
import { AppConfigurationPage } from '../pages/app-configuration.page';
import { UploadFilePage } from '../pages/upload-file.page';
import { ChecklistPage } from '../pages/checklist.page';

/**
 * The campaign-creation wizard, one method per step, from "create from scratch"
 * through to a created campaign.
 *
 * The console has no deep links into a half-built campaign: a campaign only
 * exists once the draft step has been submitted, and each later step is reachable
 * only from that campaign's details page. So the steps must run in the order they
 * are declared here, each starting where the previous one left off.
 */
export class CampaignFlow {
  readonly landing: CampaignLandingPage;
  readonly draft: DraftCampaignPage;
  readonly boundaries: BoundarySelectionPage;
  readonly delivery: DeliveryRulesPage;
  readonly appConfig: AppConfigurationPage;
  readonly upload: UploadFilePage;
  readonly checklist: ChecklistPage;

  constructor(
    readonly page: Page,
    readonly campaignType: CampaignType,
  ) {
    this.landing = new CampaignLandingPage(page);
    this.draft = new DraftCampaignPage(page, campaignType);
    this.boundaries = new BoundarySelectionPage(page);
    this.delivery = new DeliveryRulesPage(page, campaignType);
    this.appConfig = new AppConfigurationPage(page, campaignType);
    this.upload = new UploadFilePage(page);
    this.checklist = new ChecklistPage(page);
  }

  /** Landing -> "create from scratch" -> the campaign-type step. */
  async startFromScratch(): Promise<void> {
    await this.landing.clickCreateCampaign();
    await this.landing.clickScratchCard();
    await this.landing.clickContinue();
  }

  /**
   * Type, name, dates and boundary hierarchy. Submitting the hierarchy creates the
   * draft and lands on its campaign-details page.
   *
   * @returns the generated campaign name.
   */
  async createDraft(): Promise<string> {
    await this.draft.clickCampaignTypeDropdown();
    await this.draft.selectCampaignType();
    await this.draft.clickNext();

    const name = await this.draft.enterUniqueCampaignName();
    await this.draft.clickNext();

    await this.draft.fillStartAndEndDates();
    await this.draft.clickNext();

    await this.draft.searchAndSelectHierarchy();
    await this.draft.clickHierarchySubmit();
    return name;
  }

  /** Boundary selection, back on the campaign-details page. */
  async selectBoundaries(): Promise<void> {
    await this.boundaries.clickDefineTarget();
    await this.boundaries.selectLevels();
    await this.boundaries.clickNext();
    await this.boundaries.clickSubmit();
  }

  /**
   * Delivery rules, back on the campaign-details page.
   *
   * Delivery config opens on a cycles / deliveries / observation-strategy screen.
   * Whether a cycle-date screen follows it depends on the campaign type — as of
   * the 2026-09-09 hcm-demo build BEDNET has none and goes straight to the
   * delivery conditions — so the date step is only taken when it is present.
   */
  async configureDeliveryRules(): Promise<void> {
    await this.delivery.clickConfigureDelivery();
    await this.delivery.clickNext();
    await this.delivery.fillDatesAndNextIfPresent();
    // Delivery conditions -> summary -> submit.
    await this.delivery.clickNext();
    await this.delivery.clickSubmit();
  }

  /** Every mobile-app module, leaving the module list on screen. */
  async configureMobileApp(): Promise<void> {
    await this.appConfig.clickSetUpMobileApp();
    await this.appConfig.configureAllModules();
  }

  /**
   * Back from the module list, then the data upload, waiting for server-side
   * validation to pass.
   *
   * The template is generated per campaign, so it is downloaded, filled and
   * uploaded here rather than read from a committed fixture.
   *
   * @returns the filled workbook, kept under templates/ for inspection.
   */
  async uploadData(): Promise<string> {
    await this.appConfig.clickGoBack();
    await this.upload.clickUploadData();
    await this.upload.closePopup();
    const filled = await this.upload.downloadFillAndUploadTemplate();
    await this.upload.expectUploadSucceeded();
    await this.upload.clickSubmit();
    return filled;
  }

  /** The checklist, back on the campaign summary with "Create Campaign" on offer. */
  async configureChecklist(): Promise<void> {
    await this.checklist.clickCreateChecklist();
    await this.checklist.clickConfigureList();
    await this.checklist.clickConfigureChecklist();
    await this.checklist.clickConfirmChecklist();
    await this.checklist.clickBackToHomepage();
  }

  /** The final "Create Campaign" action, returning to My Campaigns. */
  async createCampaign(): Promise<void> {
    await this.checklist.clickCreateCampaign();
  }
}
