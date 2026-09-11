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
 * Walks the campaign-creation wizard to a given step.
 *
 * The console has no deep links into a half-built campaign: a campaign only
 * exists once the draft step has been submitted, and each later step is reachable
 * only from the campaign-details page of that campaign. So a test that exercises,
 * say, the upload step has to drive every step before it — which is what these
 * to* methods do, each building on the one before it.
 *
 * Every method leaves the browser on the step it is named for and returns that
 * step's page object.
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
  async toDraft(): Promise<DraftCampaignPage> {
    await this.landing.clickCreateCampaign();
    await this.landing.clickScratchCard();
    await this.landing.clickContinue();
    return this.draft;
  }

  /** ...through the campaign-type step, onto the name step. */
  async toCampaignNameStep(): Promise<DraftCampaignPage> {
    const draft = await this.toDraft();
    await draft.clickCampaignTypeDropdown();
    await draft.selectCampaignType();
    await draft.clickNext();
    return draft;
  }

  /** ...through the name step, onto the dates step. */
  async toCampaignDateStep(): Promise<DraftCampaignPage> {
    const draft = await this.toCampaignNameStep();
    await draft.enterUniqueCampaignName();
    await draft.clickNext();
    return draft;
  }

  /**
   * ...through the dates step and the hierarchy step, which submits the draft and
   * lands on the campaign-details page.
   */
  async toBoundaryHierarchy(): Promise<DraftCampaignPage> {
    const draft = await this.toCampaignDateStep();
    await draft.fillStartAndEndDates();
    await draft.clickNext();
    await draft.searchAndSelectHierarchy();
    await draft.clickHierarchySubmit();
    return draft;
  }

  /** ...into the boundary-selection step. */
  async toBoundarySelection(): Promise<BoundarySelectionPage> {
    await this.toBoundaryHierarchy();
    await this.boundaries.clickDefineTarget();
    return this.boundaries;
  }

  /** ...through boundary selection, back on the campaign-details page. */
  async toDeliveryRules(): Promise<DeliveryRulesPage> {
    const boundaries = await this.toBoundarySelection();
    await boundaries.selectLevels();
    await boundaries.clickNext();
    await boundaries.clickSubmit();
    return this.delivery;
  }

  /**
   * ...into the delivery-conditions screen (attributes, operators, values and
   * resources).
   *
   * Delivery config opens on a cycles / deliveries / observation-strategy screen.
   * Whether a cycle-date screen follows it depends on the campaign type — as of
   * the 2026-09-09 hcm-demo build BEDNET has none and goes straight to the
   * delivery conditions — so the date step is only taken when it is present.
   */
  async toDeliveryConditions(): Promise<DeliveryRulesPage> {
    const delivery = await this.toDeliveryRules();
    await delivery.clickConfigureDelivery();
    await delivery.clickNext();
    await delivery.fillDatesAndNextIfPresent();
    return delivery;
  }

  /** ...through the conditions and summary screens, back on campaign details. */
  async toAppConfiguration(): Promise<AppConfigurationPage> {
    const delivery = await this.toDeliveryConditions();
    await delivery.clickNext();
    await delivery.clickSubmit();
    return this.appConfig;
  }

  /** ...through every mobile-app module, back on campaign details. */
  async toUploadFile(): Promise<UploadFilePage> {
    const appConfig = await this.toAppConfiguration();
    await appConfig.clickSetUpMobileApp();
    await appConfig.configureAllModules();
    await appConfig.clickGoBack();
    return this.upload;
  }

  /**
   * ...through the data upload, onto the checklist step.
   *
   * The template is generated per campaign, so it is downloaded, filled and
   * uploaded here rather than read from a committed fixture.
   */
  async toChecklist(): Promise<ChecklistPage> {
    const upload = await this.toUploadFile();
    await upload.clickUploadData();
    await upload.closePopup();
    await upload.downloadFillAndUploadTemplate();
    await upload.expectUploadSucceeded();
    await upload.clickSubmit();
    return this.checklist;
  }
}
