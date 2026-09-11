import type { Locator, Page } from '@playwright/test';
import { BasePage, SETTLE } from './base.page';
import { config } from '../config/env';
import { displayName, type CampaignType } from '../config/campaign';
import { addDays, addMonths, addWeeks, today } from '../utils/dates';
import { selectDate } from '../utils/datepicker';

/**
 * The draft-campaign wizard: campaign type, name, dates, boundary hierarchy.
 *
 * Every step reuses the same "Next" button, and the last step's button is
 * "Submit" only on the hierarchy screen — so the two are kept as separate
 * locators even though Next covers most of the flow.
 */
export class DraftCampaignPage extends BasePage {
  /**
   * Characters the campaign-name field accepts. Enforced by the app's keystroke
   * handler, not by an HTML maxlength (the input reports maxLength -1).
   */
  static readonly NAME_MAX_LENGTH = 30;

  private readonly campaignTypeDropdown = this.page.getByRole('button', {
    name: 'Select an option',
  });
  private readonly nextButton = this.page.getByRole('button', { name: 'Next' });
  private readonly campaignNameInput = this.page.locator(
    "input[placeholder='CampaignName_Month_Year']",
  );
  private readonly campaignNameError = this.page.getByText(
    'Please add valid campaign name as per the guidelines.',
  );
  private readonly startDateInput = this.page.getByPlaceholder('Start date');
  private readonly endDateInput = this.page.getByPlaceholder('End date');
  private readonly dateToastError = this.page
    .locator(".digit-toast-error, [class*='toast'][class*='error'], [role='alert']")
    .first();

  private readonly hierarchySearchInput = this.page
    .locator(".select-hierarchy-search-bar input, input[placeholder='Search by hierarchy name']")
    .first();
  private readonly hierarchySubmitButton = this.page.getByRole('button', {
    name: 'Submit',
    exact: true,
  });

  private selectedHierarchyName?: string;

  constructor(
    page: Page,
    private readonly campaignType: CampaignType,
  ) {
    super(page);
  }

  get campaignDisplayName(): string {
    return displayName(this.campaignType);
  }

  // ==================== CAMPAIGN TYPE ====================

  async clickCampaignTypeDropdown(): Promise<void> {
    await this.campaignTypeDropdown.waitFor();
    await this.settle(SETTLE.step);
    await this.campaignTypeDropdown.click();
  }

  private campaignTypeOption(): Locator {
    return this.page.getByRole('button', { name: this.campaignDisplayName, exact: true });
  }

  async selectCampaignType(): Promise<void> {
    const option = this.campaignTypeOption();
    await option.waitFor();
    await this.settle(SETTLE.step);
    await option.click();
  }

  async isCampaignTypeVisible(): Promise<boolean> {
    return this.campaignTypeOption().isVisible();
  }

  // ==================== WIZARD CONTROLS ====================

  async clickNext(): Promise<void> {
    await this.nextButton.waitFor();
    await this.settle(SETTLE.step);
    await this.nextButton.click();
  }

  /** The dates step's action is the same "Next" control; named for readability. */
  async clickSubmit(): Promise<void> {
    await this.clickNext();
  }

  // ==================== CAMPAIGN NAME ====================

  /**
   * Fills a unique, valid campaign name.
   *
   * The name has to stay inside NAME_MAX_LENGTH, and the type prefix plus a
   * 9-digit timestamp is what fits: the prefix is truncated to 21 characters so
   * prefix + HHmmssSSS never exceeds the cap. A longer display-name-based prefix
   * silently overflows and the field ends up empty.
   */
  async enterUniqueCampaignName(): Promise<string> {
    const now = new Date();
    const stamp =
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0') +
      String(now.getMilliseconds()).padStart(3, '0');
    const prefix = this.campaignType.replace(/ /g, '').slice(0, 21);
    const name = `${prefix}${stamp}`;

    await this.enterCampaignName(name);
    return name;
  }

  async enterCampaignName(name: string): Promise<void> {
    await this.campaignNameInput.waitFor();
    await this.settle(SETTLE.step);
    await this.campaignNameInput.clear();
    await this.campaignNameInput.fill(name);
    await this.campaignNameInput.press('Tab');
  }

  /**
   * Types a name one keystroke at a time and returns what the field kept.
   *
   * Typing is required to observe the cap: the handler truncates keystrokes at
   * NAME_MAX_LENGTH, but rejects a value that arrives all at once — a fill()
   * longer than the cap leaves the field EMPTY rather than truncated, and shows
   * no validation message. Verified on hcm-demo 2026-09-09.
   */
  async typeCampaignNameAndGetValue(name: string): Promise<string> {
    await this.campaignNameInput.waitFor();
    await this.settle(SETTLE.step);
    await this.campaignNameInput.click();
    await this.campaignNameInput.fill('');
    await this.campaignNameInput.pressSequentially(name);
    await this.settle(SETTLE.short);
    return this.campaignNameInput.inputValue();
  }

  async isCampaignNameErrorVisible(): Promise<boolean> {
    await this.campaignNameError.waitFor({ timeout: 5_000 });
    return this.campaignNameError.isVisible();
  }

  async campaignNameErrorText(): Promise<string> {
    return (await this.campaignNameError.textContent()) ?? '';
  }

  // ==================== DATES ====================

  async fillStartDate(): Promise<void> {
    await selectDate(this.page, this.startDateInput, addDays(today(), 1));
  }

  async fillEndDate(): Promise<void> {
    // MR-DN needs 3 cycles x 1 week each with 1-week gaps = 36 days from tomorrow.
    const end =
      this.campaignType === 'MR-DN' ? addWeeks(today(), 6) : addMonths(today(), 1);
    await selectDate(this.page, this.endDateInput, end);
  }

  async fillStartAndEndDates(): Promise<void> {
    await this.fillStartDate();
    await this.fillEndDate();
  }

  async startDateValue(): Promise<string> {
    return this.startDateInput.inputValue();
  }

  async endDateValue(): Promise<string> {
    return this.endDateInput.inputValue();
  }

  async isDateToastErrorVisible(): Promise<boolean> {
    await this.dateToastError.waitFor({ timeout: 5_000 });
    return this.dateToastError.isVisible();
  }

  // ==================== BOUNDARY HIERARCHY ====================

  /**
   * Types a hierarchy name into the "Search by Hierarchy Name" bar and selects
   * the matching card. Defaults to the configured hierarchy so callers carry no
   * hierarchy data.
   */
  async searchAndSelectHierarchy(hierarchyName = config.hierarchyName): Promise<void> {
    await this.hierarchySearchInput.waitFor();
    await this.settle(SETTLE.step);
    await this.hierarchySearchInput.click();
    await this.hierarchySearchInput.fill(hierarchyName);
    await this.settle(SETTLE.step);

    const card = this.hierarchyCard(hierarchyName);
    await card.waitFor();
    await card.click();
    this.selectedHierarchyName = hierarchyName;
    await this.settle(SETTLE.short);
  }

  /**
   * Submits the hierarchy step.
   *
   * The card's click does not always commit before Submit is pressed, and a
   * Submit with nothing selected leaves the step on screen with no message. So
   * the selection is re-asserted and the step is retried until the button goes
   * away, which is the only signal that the flow advanced.
   */
  async clickHierarchySubmit(): Promise<void> {
    await this.hierarchySubmitButton.waitFor();
    await this.settle(SETTLE.step);

    for (let attempt = 1; attempt <= 3; attempt++) {
      if (this.selectedHierarchyName && !(await this.isHierarchySelected(this.selectedHierarchyName))) {
        await this.hierarchyCard(this.selectedHierarchyName).click();
        await this.settle(SETTLE.short);
      }
      await this.hierarchySubmitButton.click();
      try {
        await this.hierarchySubmitButton.waitFor({ state: 'hidden', timeout: 30_000 });
        return;
      } catch {
        console.log(`[DraftCampaign] Hierarchy submit did not advance — retry ${attempt}`);
      }
    }
  }

  async isHierarchyShownOnCampaignDetails(
    hierarchyName = config.hierarchyName,
  ): Promise<boolean> {
    const label = this.page.getByText(hierarchyName).first();
    await label.waitFor({ timeout: 30_000 });
    return label.isVisible();
  }

  private hierarchyCard(hierarchyName: string): Locator {
    return this.page
      .locator('.select-hierarchy-campaign-selection-card')
      .filter({
        has: this.page.locator('.select-hierarchy-campaign-selection-card-name', {
          hasText: hierarchyName,
        }),
      })
      .first();
  }

  /** The step marks the chosen card with a "selected" class once the click commits. */
  private async isHierarchySelected(hierarchyName: string): Promise<boolean> {
    const classes = await this.hierarchyCard(hierarchyName).getAttribute('class');
    return classes?.includes('selected') ?? false;
  }
}
