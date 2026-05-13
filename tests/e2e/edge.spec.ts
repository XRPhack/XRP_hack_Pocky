import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mkdir, readdir, rm } from 'node:fs/promises';

const evidenceDir = '.sisyphus/evidence/edge';
const expectedEvidenceFiles = [
  '01-login.png',
  '02-edge-fixture-selected.png',
  '03-credential-failure.png',
  '04-renewal-guide.png'
] as const;

type LocalStorageSnapshot = Record<string, string | null>;

async function saveEvidence(page: Page, fileName: (typeof expectedEvidenceFiles)[number]): Promise<void> {
  await page.screenshot({ path: `${evidenceDir}/${fileName}`, fullPage: true });
}

async function expectTenantSessionStorage(page: Page): Promise<void> {
  const storage = await page.evaluate(() =>
    Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)]))
  ) as LocalStorageSnapshot;

  expect(Object.keys(storage)).toEqual(['nomokdon.session']);
  expect(storage['nomokdon.session']).toMatch(/^sess_/);
}

async function closeContext(context: BrowserContext): Promise<void> {
  await context.close();
}

test.beforeAll(async () => {
  await rm(evidenceDir, { recursive: true, force: true });
  await mkdir(evidenceDir, { recursive: true });
});

test('expired visa fixture stops credential issuance with renewal guide', async ({ browser }) => {
  const tenantContext = await browser.newContext({ locale: 'en-US' });
  const page = await tenantContext.newPage();

  try {
    await page.goto('/tenant/');
    await expect(page.getByRole('heading', { name: 'Find housing in Korea with trust first.', level: 1 })).toBeVisible();
    await saveEvidence(page, '01-login.png');

    await page.getByRole('button', { name: 'Continue with Toss mock login' }).click();
    await expect(page.getByRole('heading', { name: 'Keep foreign-resident context safe' })).toBeVisible();
    await expectTenantSessionStorage(page);

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Explain readiness while finding a home' })).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Trust through reasons, not scores' })).toBeVisible();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('heading', { name: 'No trust pass yet', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Start creating a trust pass' }).click();

    await expect(page.getByRole('heading', { name: '3-step trust pass wizard', level: 1 })).toBeVisible();
    await page.locator('input[name="tenant-wizard-fixture"][value="edge"]').check();
    await expect(page.getByText('Expired visa fallback set')).toBeVisible();
    await expect(page.getByText('Expired visa', { exact: true })).toBeVisible();
    await saveEvidence(page, '02-edge-fixture-selected.png');

    await page.getByRole('button', { name: 'Confirm DID' }).click();
    await expect(page.getByRole('link', { name: /DIDSet/ })).toBeVisible();
    await expect(page.locator('input[name="tenant-wizard-fixture"][value="edge"]')).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Issue credentials' })).toBeVisible();

    await page.getByRole('button', { name: 'Confirm credentials' }).click();
    await expect(page.getByRole('heading', { name: 'Pass cannot be created' })).toBeVisible();
    await expect(page.getByText(/expired on Feb 1, 2024/)).toBeVisible();
    await expect(page.getByText(/Credential issuance is stopped/)).toBeVisible();
    await expect(page.locator('.tenant-wizard-card--active').getByRole('heading', { name: 'Issue credentials' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm escrow' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Visa CredentialCreate/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Ready to show your landlord', level: 1 })).toHaveCount(0);
    await expect(page.locator('code.tenant-dashboard-share__url')).toHaveCount(0);
    await saveEvidence(page, '03-credential-failure.png');

    await expect(page.getByRole('heading', { name: 'Renew visa evidence before retrying' })).toBeVisible();
    await expect(page.getByText('Retry only after the updated fixture verifies successfully; this edge path never force-issues credentials.')).toBeVisible();
    await saveEvidence(page, '04-renewal-guide.png');

    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('heading', { name: 'Pass cannot be created' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ready to show your landlord', level: 1 })).toHaveCount(0);
    await expect(page.locator('code.tenant-dashboard-share__url')).toHaveCount(0);

    const evidenceFiles = await readdir(evidenceDir);
    expect(evidenceFiles.sort()).toEqual([...expectedEvidenceFiles].sort());
  } finally {
    await closeContext(tenantContext);
  }
});
