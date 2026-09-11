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

  /**
   * Submit with nothing uploaded: there is no file row for a result card to sit
   * under, so this one reports through a toast.
   */
  private readonly noFileToast = this.page
    .locator("[class*='digit-toast'], [role='alert'], .Toastify__toast, .validation-alert-card")
    .filter({ hasText: 'Please upload a file' });

  private readonly validationCard = this.page.locator('.validation-alert-card').first();
  private readonly validationCardMessage = this.validationCard
    .locator('.digit-infobanner-header')
    .first();

  /**
   * A rejected upload renders the same card without the success state class, so
   * failure is detected structurally rather than by message text.
   */
  private readonly validationErrorCard = this.page
    .locator('.validation-alert-card:not(.success)')
    .first();

  /**
   * A wrong file *type* is rejected client-side before any server validation and
   * reports through a toast only — no result card is rendered for it. Verified on
   * hcm-demo 2026-09-09: div.digit-toast-success.digit-error, "Please upload valid
   * excel file as per template only."
   */
  private readonly fileRejectedToast = this.page
    .locator("[class*='digit-toast'][class*='digit-error']")
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
    // Kept short on purpose: a rejection toast is transient, and a longer sleep
    // here outlived it. Waiting for validation to finish is the job of
    // expectUploadSucceeded()/isValidationErrorCardVisible(), not of this method.
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

  async isNoFileToastVisible(): Promise<boolean> {
    await this.noFileToast.waitFor({ timeout: 15_000 });
    return this.noFileToast.isVisible();
  }

  /**
   * Whether the app rejected the file outright with an error toast.
   *
   * This is the wrong-file-type surface: the rejection happens client-side, so no
   * result card is ever rendered and asserting on the card would simply time out.
   * Content and structure problems report through the card instead — see
   * isValidationErrorCardVisible().
   */
  async isFileRejectedToastVisible(): Promise<boolean> {
    await this.fileRejectedToast.waitFor({ timeout: 30_000 });
    const visible = await this.fileRejectedToast.isVisible();
    if (visible) {
      console.log(`[Upload] file rejected: ${(await this.fileRejectedToast.innerText()).trim()}`);
    }
    return visible;
  }

  /**
   * Whether the validation result card reports a failure.
   *
   * A rejected upload reports through the same card as a successful one, below the
   * uploaded file, distinguished only by the absence of the success state class —
   * so this must not be asserted via toast text.
   *
   * The wait is longer than a toast's would be because a file that is structurally
   * valid but has bad content is only rejected after the server validates it.
   */
  async isValidationErrorCardVisible(timeout = 120_000): Promise<boolean> {
    await this.validationErrorCard.waitFor({ timeout });
    const visible = await this.validationErrorCard.isVisible();
    if (visible) {
      console.log(`[Upload] validation error card: ${await this.validationMessage()}`);
    }
    return visible;
  }
}
