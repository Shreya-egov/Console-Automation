import type { Locator, Page } from '@playwright/test';
import { BasePage, SETTLE } from './base.page';

/**
 * "Select the boundaries where you want to run the campaign" step.
 *
 * Two things about this screen drive the locator choices below:
 *
 * 1. The level fields are multi-select dropdowns whose inputs carry no name, id
 *    or placeholder. They are scoped by the wrapper class so a bare
 *    getByRole('textbox').nth(n) cannot drift onto some other textbox the screen
 *    grows later.
 *
 * 2. Only one dropdown is open at a time, and an open dropdown renders extra
 *    checkboxes that are NOT boundary options: level 2 and below prepend a
 *    "Select All" row plus two unclassed checkboxes. A plain
 *    getByRole('checkbox').nth(n) therefore means a different thing on level 1
 *    (no Select All) than on levels 2-6. Real options carry the
 *    digit-multi-select-dropdown-menuitem class, so that is used to index them.
 */
const LEVEL_DROPDOWN = '.selecting-boundaries-dropdown';
const OPEN_PANEL = '.digit-multiselectdropdown-server';
const OPTION_CHECKBOX = 'input.digit-multi-select-dropdown-menuitem';

export class BoundarySelectionPage extends BasePage {
  // Set-vs-Edit: the id flips once the step has been filled in before.
  private readonly defineTargetButton = this.page
    .locator(
      '#campaign-details-page-button-selecting-boundaries, ' +
        '#campaign-details-page-button-edit-selecting-boundaries',
    )
    .first();

  /** Clicking the heading is how an open dropdown is dismissed. */
  private readonly heading = this.page.getByText(
    'Select the boundaries where you want to run the campaign',
  );
  private readonly nextButton = this.page.getByRole('button', { name: 'Next' });
  private readonly submitButton = this.page.getByRole('button', { name: 'Submit' });
  private readonly mandatoryFieldsToast = this.page.getByText(
    'Please fill all the mandatory fields.',
  );

  constructor(page: Page) {
    super(page);
  }

  private levelInput(index: number): Locator {
    return this.page.locator(`${LEVEL_DROPDOWN} input`).nth(index);
  }

  private option(index: number): Locator {
    return this.page.locator(`${OPEN_PANEL} ${OPTION_CHECKBOX}`).nth(index);
  }

  async clickDefineTarget(): Promise<void> {
    await this.defineTargetButton.waitFor();
    await this.settle(SETTLE.step);
    await this.defineTargetButton.click();
  }

  /**
   * Opens the level at `levelIndex` (0-based), ticks the option at `optionIndex`
   * (0-based, "Select All" excluded), then closes the dropdown.
   */
  async selectLevelOption(levelIndex: number, optionIndex = 0): Promise<void> {
    const input = this.levelInput(levelIndex);
    await input.waitFor();
    await this.settle(SETTLE.step);
    await input.click();

    const option = this.option(optionIndex);
    await option.waitFor();
    await this.settle(SETTLE.short);
    await option.check();

    await this.heading.click();
    await this.settle(SETTLE.short);
  }

  /** Ticks the first option of each of the first `levels` levels, top down. */
  async selectLevels(levels = 6): Promise<void> {
    for (let level = 0; level < levels; level++) {
      await this.selectLevelOption(level);
    }
  }

  /**
   * Picks the LAST option of the second level instead of the first.
   *
   * Used by the missing-lowest-level case: a boundary chosen here has no
   * descendants selected below it, so the deeper levels stay empty and the
   * mandatory-field validation is what the test then asserts on.
   */
  async selectSecondLevelWithoutDescendants(): Promise<void> {
    const input = this.levelInput(1);
    await input.waitFor();
    await this.settle(SETTLE.step);
    await input.click();

    const last = this.page.locator(`${OPEN_PANEL} ${OPTION_CHECKBOX}`).last();
    await last.waitFor();
    await this.settle(SETTLE.short);
    await last.check();

    await this.heading.click();
    await this.settle(SETTLE.short);
  }

  async clickNext(): Promise<void> {
    await this.nextButton.waitFor();
    await this.settle(SETTLE.step);
    await this.nextButton.click();
  }

  async clickSubmit(): Promise<void> {
    await this.submitButton.waitFor();
    await this.settle(SETTLE.step);
    await this.submitButton.click();
  }

  async isMandatoryFieldsToastVisible(): Promise<boolean> {
    await this.mandatoryFieldsToast.waitFor({ timeout: 15_000 });
    return this.mandatoryFieldsToast.isVisible();
  }
}
