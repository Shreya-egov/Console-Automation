import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '../src/fixtures/test';

const fixture = (name: string): string => path.resolve(__dirname, '../resources', name);

test.describe('Upload campaign data', () => {
  test('uploads the campaign’s own filled template', { tag: ['@sanity'] }, async ({ flow }) => {
    const upload = await flow.toUploadFile();

    await upload.clickUploadData();
    await upload.closePopup();

    // Round-trips the campaign's own generated template: download, fill the
    // mandatory target/user data, upload. A committed template cannot be used
    // because the workbook is campaign-specific.
    const filled = await upload.downloadFillAndUploadTemplate();
    expect(fs.existsSync(filled), `Filled template should have been written to ${filled}`).toBe(true);

    await upload.expectUploadSucceeded();
    await upload.clickSubmit();
  });

  test('rejects a submit with no file', { tag: ['@negative'] }, async ({ flow }) => {
    const upload = await flow.toUploadFile();

    await upload.clickUploadData();
    await upload.closePopup();
    await upload.clickSubmit();

    expect(
      await upload.isNoFileToastVisible(),
      "Toast 'Please upload a file' should appear when Submit is clicked with nothing uploaded",
    ).toBe(true);
  });

  test('rejects a file of the wrong type', { tag: ['@negative'] }, async ({ flow }) => {
    const upload = await flow.toUploadFile();

    await upload.clickUploadData();
    await upload.closePopup();
    await upload.uploadFile(fixture('complaint.pdf'));
    await upload.clickSubmit();

    // Wrong type is refused client-side, so it reports through a toast and no
    // result card is ever rendered.
    expect(
      await upload.isFileRejectedToastVisible(),
      'Rejection toast should appear when a PDF is uploaded',
    ).toBe(true);
  });

  const badWorkbooks = [
    { file: 'InvalidFile.xlsx', reason: 'is not the microplan template' },
    { file: 'InvalidInputFile.xlsx', reason: 'has the right shape but invalid content' },
  ];

  for (const { file, reason } of badWorkbooks) {
    test(`rejects a workbook that ${reason}`, { tag: ['@negative'] }, async ({ flow }) => {
      const upload = await flow.toUploadFile();

      await upload.clickUploadData();
      await upload.closePopup();
      await upload.uploadFile(fixture(file));
      await upload.clickSubmit();

      // These get as far as validation, which reports on the result card rather
      // than in a toast.
      expect(
        await upload.isValidationErrorCardVisible(),
        `Validation error card should appear for a workbook that ${reason}`,
      ).toBe(true);
    });
  }
});
