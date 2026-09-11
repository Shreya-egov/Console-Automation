import type { Locator, Page } from '@playwright/test';
import { monthIndex } from './dates';

/**
 * Drives the react-datepicker the campaign screens use.
 *
 * The month the picker opens on is read from its header rather than assumed to be
 * the current month: a field that already holds a value opens on that value's
 * month, and a picker opened after another field was filled can open elsewhere
 * again. Counting clicks from "today" instead lands on the wrong month whenever
 * that happens, and the failure looks like a missing day cell.
 */
const CURRENT_MONTH = '.react-datepicker__current-month';
const NEXT_MONTH = '.react-datepicker__navigation--next';
const PREV_MONTH = '.react-datepicker__navigation--previous';

/** Day cells of the displayed month, excluding the greyed-out spill-over days. */
const DAY_CELL = '.react-datepicker__day:not(.react-datepicker__day--outside-month)';

export async function selectDate(page: Page, input: Locator, date: Date): Promise<void> {
  await input.waitFor({ state: 'visible', timeout: 15_000 });
  await input.click();

  const header = page.locator(CURRENT_MONTH);
  await header.waitFor({ timeout: 10_000 });

  const [monthName, year] = (await header.innerText()).trim().split(/\s+/);
  const displayed = Number(year) * 12 + monthIndex(monthName);
  const target = date.getFullYear() * 12 + date.getMonth();

  const steps = target - displayed;
  const navigation = page.locator(steps >= 0 ? NEXT_MONTH : PREV_MONTH);
  for (let i = 0; i < Math.abs(steps); i++) {
    await navigation.click();
  }

  // Matched on the cell's own exact text: chaining a text locator under the day
  // class would look for a descendant, and the day number is the cell's own text.
  await page
    .locator(DAY_CELL)
    .filter({ hasText: new RegExp(`^${date.getDate()}$`) })
    .first()
    .click();
}
