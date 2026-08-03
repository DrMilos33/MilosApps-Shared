import { expect, test } from '@playwright/test';

test('keeps React inside the app slot and preserves strict CSP', async ({ page }) => {
  const externalRequests: string[] = [];
  const consoleErrors: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4321') externalRequests.push(request.url());
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
  await expect(page.locator('[data-milos-app-loading]')).toBeHidden();
  await expect(page.locator('main[slot="main"] > [data-milos-react-root]')).toHaveCount(1);
  await expect(page.locator('[data-milos-react-root] milos-app-shell')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ein kleiner, klar begrenzter React-Root');
  await page.getByRole('button', { name: 'Beispiel ausführen' }).click();
  await expect(page.getByText('Ausgeführt: 1')).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('milosapps:localechange', { detail: { locale: 'en' } }));
  });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('One small, explicitly bounded React root');
  expect(externalRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

for (const profile of [
  { name: 'mobile', width: 390, height: 844, scale: '100%' },
  { name: 'reflow-200', width: 360, height: 800, scale: '200%' },
]) {
  test(`has no horizontal overflow at ${profile.name}`, async ({ page }) => {
    await page.setViewportSize({ width: profile.width, height: profile.height });
    await page.goto('/');
    await page.evaluate((scale) => {
      document.documentElement.style.fontSize = scale;
    }, profile.scale);
    await expect(page.locator('[data-milos-app-loading]')).toBeHidden();
    const geometry = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      button: document.querySelector('button')?.getBoundingClientRect().height ?? 0,
    }));
    expect(geometry.scroll).toBe(geometry.client);
    expect(geometry.button).toBeGreaterThanOrEqual(44);
  });
}
