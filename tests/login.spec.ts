import { test, expect } from '../src/fixtures/test';

/**
 * Login itself happens in the `home` fixture, so these verify the state it left
 * the browser in rather than driving the login form again.
 */
test.describe('Login', () => {
  test('lands on the employee home page', { tag: ['@sanity'] }, async ({ home }) => {
    expect(await home.isDisplayed(), 'Home page should be displayed after login').toBe(true);
  });

  test('home page offers the expected actions', { tag: ['@sanity'] }, async ({ home }) => {
    await expect(home.createComplaintButton).toBeVisible();
    await expect(home.searchComplaintButton).toBeVisible();
  });

  test('navigates away from home and back', async ({ home }) => {
    await home.goToCreateComplaint();
    await home.goToHome();
    expect(await home.isDisplayed(), 'Should be back on the home page').toBe(true);
  });
});
