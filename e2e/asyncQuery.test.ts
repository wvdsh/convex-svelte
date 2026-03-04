import { expect, test } from '@playwright/test';

test.describe('Async Query with boundary', () => {
	test('shows pending then resolves with data', async ({ page }) => {
		await page.goto('/tests/async-query');
		await expect(page.locator('h1')).toBeVisible();

		// Should show pending or data (pending may be very brief)
		// Wait for data to appear
		await expect(page.getByTestId('data')).toBeVisible({ timeout: 10000 });
		await expect(page.getByTestId('pending')).not.toBeVisible();
	});

	test('skip resolves boundary without data', async ({ page }) => {
		await page.goto('/tests/async-query');

		// Wait for initial data load
		await expect(page.getByTestId('data')).toBeVisible({ timeout: 10000 });

		// Enable skip
		await page.getByTestId('skip-checkbox').check();

		// The boundary should still be resolved (not pending), but show no-data
		await expect(page.getByTestId('no-data')).toBeVisible({ timeout: 5000 });
		await expect(page.getByTestId('pending')).not.toBeVisible();
	});

	test('skip then unskip resumes data', async ({ page }) => {
		await page.goto('/tests/async-query');

		// Wait for initial data load
		await expect(page.getByTestId('data')).toBeVisible({ timeout: 10000 });

		// Skip and unskip
		await page.getByTestId('skip-checkbox').check();
		await expect(page.getByTestId('no-data')).toBeVisible({ timeout: 5000 });

		await page.getByTestId('skip-checkbox').uncheck();
		await expect(page.getByTestId('data')).toBeVisible({ timeout: 10000 });
	});
});

test.describe('Async Query Error Handling', () => {
	test('boundary shows error on query failure', async ({ page }) => {
		await page.goto('/tests/async-query-error');
		await expect(page.locator('h1')).toBeVisible();

		// The query always errors, so boundary should show the failed snippet
		await expect(page.getByTestId('error')).toBeVisible({ timeout: 10000 });
		await expect(page.getByTestId('pending')).not.toBeVisible();
	});
});

test.describe('Async Query with SSR Initial Data', () => {
	test('initial data is displayed without pending state', async ({ page }) => {
		await page.goto('/tests/async-query-ssr');
		await expect(page.locator('h1')).toBeVisible();

		// Initial data from SSR should show data count
		await expect(page.getByTestId('initial-data-info')).toContainText('Initial data count:');

		// Data should be visible (from initialData), not pending
		await expect(page.getByTestId('data')).toBeVisible({ timeout: 10000 });
	});
});
