import { test, expect } from '@playwright/test';
const result = (name: string, id: number, state = 'Osaka Prefecture') => ({
  geometry: { coordinates: [135.5, 34.7] }, properties: { name, state, country: 'Japan', countrycode: 'JP',
    osm_type: 'R', osm_id: id, osm_key: 'place', osm_value: 'city' },
});
async function start(page: import('@playwright/test').Page) {
  await page.goto('/travel-planner/');
  const local = page.getByRole('button', { name: '使用本機模式', exact: true });
  if (await local.isVisible()) await local.click();
  await page.getByRole('button', { name: '新增旅程', exact: true }).click();
  await page.getByLabel('旅程名稱', { exact: true }).fill('大阪新建合成');
  await page.getByLabel('開始日期', { exact: true }).fill('2030-02-01');
  await page.getByLabel('結束日期', { exact: true }).fill('2030-02-03');
  await page.getByLabel('城市', { exact: true }).fill('大阪');
}
test('city result selection saves city identity/timezone and survives reload without seeded trip data', async ({ page }) => {
  await page.route('https://photon.komoot.io/api/**', route => route.fulfill({ json: { features: [result('Osaka', 123)] } }));
  await start(page);
  await page.getByRole('button', { name: /Osaka Osaka Prefecture/ }).click();
  await expect(page.getByText(/已確認 Osaka · Japan · Asia\/Tokyo/)).toBeVisible();
  await page.getByRole('button', { name: '儲存旅程', exact: true }).click();
  await expect(page.getByText('目前 2030-02-01 · Osaka · Asia/Tokyo')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '大阪新建合成', exact: true })).toBeVisible();
  await expect(page.getByText('目前 2030-02-01 · Osaka · Asia/Tokyo')).toBeVisible();
});
test('offline city search keeps the typed city and permits saving; retry presents explicit choices', async ({ page }) => {
  let failed = true;
  await page.route('https://photon.komoot.io/api/**', route => failed ? route.abort('internetdisconnected') :
    route.fulfill({ json: { features: [result('Osaka', 123), result('Osaka alternative', 124, 'Other region')] } }));
  await start(page);
  await expect(page.getByRole('button', { name: '重試搜尋' })).toBeVisible();
  await expect(page.getByLabel('城市', { exact: true })).toHaveValue('大阪');
  failed = false;
  await page.getByRole('button', { name: '重試搜尋' }).click();
  await expect(page.getByRole('button', { name: /Osaka alternative/ })).toBeVisible();
  // Do not choose for the user; text-only save is allowed and remains unlocated.
  await page.getByRole('button', { name: '儲存旅程', exact: true }).click();
  await expect(page.getByText('目前 2030-02-01 · 大阪 · Asia/Tokyo')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '大阪新建合成', exact: true })).toBeVisible();
});
