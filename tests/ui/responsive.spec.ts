import { test, expect } from '@playwright/test';

test('navigation and controls fit narrow, tablet and desktop screens', async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['search', 'crm', 'settings']) {
      await page.goto(`./#/${route}`);
      const main = page.locator('.main-content');
      await expect(main).toBeVisible();
      await expect.poll(() => main.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBeTruthy();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
      if (route === 'search') {
        await expect(page.getByRole('button', { name: '🚀 Найти клиентов' })).toBeVisible();
        await page.getByRole('button', { name: 'Демо', exact: true }).click();
        await expect(page.locator('.candidate-card-v2').first()).toBeVisible();
        await expect.poll(() => main.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBeTruthy();
        await page.getByRole('button', { name: 'Закрыть демо', exact: true }).click();
      }
      if (route === 'settings') await expect(page.getByRole('button', { name: 'Сохранить все настройки', exact: true })).toBeVisible();
    }
  }
});
