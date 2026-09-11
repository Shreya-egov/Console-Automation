import { test } from '../src/fixtures/test';

/**
 * HRMS (create / search / deactivate employee) is not part of the campaign
 * console and has not been ported — it still runs from the Java suite in
 * Web-Automation (`tests.HRMSTest`).
 *
 * Left as a marked placeholder so the gap is visible in the report rather than
 * silently absent. Port order when it is picked up: HRMSPage locators, then the
 * create flow, then the deactivate/reactivate cases (which need the
 * HRMS_DEACTIVATION_REASON test data already ported in src/config/testdata.ts).
 */
test.describe.fixme('HRMS — not yet ported', () => {
  test('creates an employee', async () => {});
  test('searches for an employee', async () => {});
  test('deactivates and reactivates an employee', async () => {});
});
