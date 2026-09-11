import { test } from '../src/fixtures/test';

/**
 * PGR complaints (create / search / assign / reject) are not part of the campaign
 * console and have not been ported — they still run from the Java suite in
 * Web-Automation (`tests.ComplaintTest`).
 *
 * Left as a marked placeholder so the gap is visible in the report rather than
 * silently absent. The COMPLAINT_TYPES / REJECTION_REASON / ASSIGN_EMPLOYEE test
 * data these need is already ported in src/config/testdata.ts.
 */
test.describe.fixme('PGR complaints — not yet ported', () => {
  test('creates a complaint', async () => {});
  test('searches for a complaint', async () => {});
  test('assigns a complaint', async () => {});
  test('rejects a complaint', async () => {});
});
