import * as path from 'path';
import type { Page } from '@playwright/test';
import { BasePage, SETTLE } from './base.page';
import { config } from '../config/env';
import { fillMicroplanTemplate } from '../utils/microplan-template';

/** How long a server-side validation of an accepted file may take. */
const VALIDATION_TIMEOUT = 10 * 60 * 1000;

export class UploadFilePage extends BasePage {
  private readonly uploadDataButton = this.page
    .locator('#campaign-details-page-button-unified-console-data-upload')
    .or(this.page.getByRole('button', { name: 'Upload Data' }))
    .first();

  private readonly downloadTemplateButton = this.page.locator('#file-download-template');
  private readonly fileInput = this.page.locator("input#file[type='file']");
  private readonly submitButton = this.page.getByRole('button', { name: 'Submit' });
  private readonly cancelIcon = this.page.locator("button[aria-label='Cancel']");

  private readonly validationCard = this.page.locator('.validation-alert-card').first();
  private readonly validationCardMessage = this.validationCard
    .locator('.digit-infobanner-header')
    .first();

  constructor(page: Page) {
    super(page);
  }

  async clickUploadData(): Promise<void> {
    await this.uploadDataButton.click();
    await this.settle(SETTLE.short);
  }

  async closePopup(): Promise<void> {
    await this.cancelIcon.click();
    await this.page.locator('.digit-popup-overlay').waitFor({ state: 'hidden' });
  }

  async uploadFile(filePath: string): Promise<void> {
    await this.settle(SETTLE.short);
    await this.fileInput.setInputFiles(filePath);
    // Waiting for validation to finish is expectUploadSucceeded()'s job, not this method's.
    await this.settle(SETTLE.short);
  }

  async clickSubmit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Downloads the template this campaign generated, fills it, and uploads it.
   *
   * The template must be round-tripped rather than taken from a committed
   * fixture: it is generated per campaign, carrying that campaign's own
   * boundaries in "Boundary List" and a campaign uuid in a hidden sheet. A file
   * built for another hierarchy fails validation, which — combined with an
   * unbounded wait on the success toast — used to hang the test rather than fail
   * it.
   *
   * @returns the filled workbook, kept under templates/ for inspection.
   */
  async downloadFillAndUploadTemplate(): Promise<string> {
    const download = await Promise.all([
      this.page.waitForEvent('download'),
      this.downloadTemplateButton.click(),
    ]).then(([event]) => event);

    const name = download.suggestedFilename();
    const raw = path.join(config.templateDir, name);
    await download.saveAs(raw);
    console.log(`[Upload] Downloaded template -> ${raw}`);

    const filled = await fillMicroplanTemplate(raw, path.join(config.templateDir, `filled-${name}`));

    await this.uploadFile(filled);
    return filled;
  }

  /**
   * Waits for the validation result card below the uploaded file, and throws if
   * that card is not the success one.
   *
   * Waiting for whichever card appears (rather than for the success card alone)
   * means a rejected upload reports the card's own message instead of timing out
   * with nothing to go on. Bounded deliberately: an unbounded wait turns a failed
   * upload into a hung suite instead of a reported failure.
   */
  async expectUploadSucceeded(timeout = VALIDATION_TIMEOUT): Promise<void> {
    await this.validationCard.waitFor({ timeout });
    const classes = await this.validationCard.getAttribute('class');
    if (!classes?.includes('success')) {
      throw new Error(
        `Upload validation did not succeed. The result card said: ` +
          `"${await this.validationMessage()}" (card classes: ${classes})`,
      );
    }
    console.log(`[Upload] ${await this.validationMessage()}`);
  }

  /** Message shown on the validation result card. */
  async validationMessage(): Promise<string> {
    return (await this.validationCardMessage.innerText()).trim();
  }
}
