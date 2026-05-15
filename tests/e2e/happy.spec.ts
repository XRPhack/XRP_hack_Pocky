import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mkdir, readdir, rm } from 'node:fs/promises';

const evidenceDir = '.sisyphus/evidence/happy';
const apiBaseUrl = 'http://127.0.0.1:8787';
const expectedEvidenceFiles = [
  '01-login.png',
  '02-onboarding-resident.png',
  '03-onboarding-housing.png',
  '04-onboarding-trust.png',
  '05-wizard-did.png',
  '06-wizard-documents.png',
  '07-wizard-credentials.png',
  '08-dashboard.png',
  '09-toss-unlock.png',
  '10-share-panel.png',
  '11-verify-result.png',
  '12-landlord-confirmation.png'
] as const;

type LocalStorageSnapshot = Record<string, string | null>;
type ApiLogPayload = {
  ok: boolean;
  events: Array<{
    type: string;
    status: string;
    details?: {
      reportId?: string;
      status?: string;
      action?: string;
    };
  }>;
};

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

async function expectNoSensitiveValues(page: Page): Promise<void> {
  const bodyText = await page.locator('body').textContent();

  expect(bodyText ?? '').not.toMatch(/\bs[a-km-zA-HJ-NP-Z1-9]{25,}\b|private key|password/i);
}

async function closeContext(context: BrowserContext): Promise<void> {
  await context.close();
}

test.beforeAll(async () => {
  await rm(evidenceDir, { recursive: true, force: true });
  await mkdir(evidenceDir, { recursive: true });
});

test('login to landlord confirmation happy path', async ({ browser }) => {
  const tenantContext = await browser.newContext({
    locale: 'en-US',
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await tenantContext.newPage();

  try {
    await page.goto('/tenant/');
    await expect(page.getByRole('heading', { name: 'Find housing in Korea with trust first.', level: 1 })).toBeVisible();
    await expect(page.getByText('No official Toss logo or real OAuth connection')).toBeVisible();
    await saveEvidence(page, '01-login.png');

    await page.getByRole('button', { name: 'Continue with Toss mock login' }).click();
    await expect(page.getByRole('heading', { name: 'Keep foreign-resident context safe' })).toBeVisible();
    await expectTenantSessionStorage(page);
    await expectNoSensitiveValues(page);
    await saveEvidence(page, '02-onboarding-resident.png');

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Explain readiness while finding a home' })).toBeVisible();
    await saveEvidence(page, '03-onboarding-housing.png');

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Trust through reasons, not scores' })).toBeVisible();
    await saveEvidence(page, '04-onboarding-trust.png');

    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('heading', { name: 'No trust pass yet', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Start creating a trust pass' }).click();

    await expect(page.getByRole('heading', { name: 'Create trust pass', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create DID' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm DID' }).click();
    await expect(page.getByRole('link', { name: /DIDSet/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Verify documents' })).toBeVisible();
    await expect(page.getByText('Demo fixture will be used')).toHaveCount(2);
    await saveEvidence(page, '05-wizard-did.png');

    await page.getByRole('button', { name: 'Verify documents' }).click();
    await expect(page.locator('.tenant-wizard-card').filter({ hasText: 'Verify documents' }).getByText('Success')).toBeVisible();
    await expect(page.getByText('Authenticity check ready')).toHaveCount(2);
    await expect(page.getByRole('heading', { name: 'Issue credentials' })).toBeVisible();
    await saveEvidence(page, '06-wizard-documents.png');

    await page.getByRole('button', { name: 'Confirm credentials' }).click();
    await expect(page.getByRole('link', { name: /Visa CredentialCreate/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Rent reputation CredentialAccept/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lock escrow' })).toBeVisible();
    await saveEvidence(page, '07-wizard-credentials.png');

    await page.getByRole('button', { name: 'Confirm escrow' }).click();
    await expect(page.getByRole('heading', { name: 'Ready to show your landlord', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Six verification badges' })).toBeVisible();
    await expect(page.locator('.tenant-dashboard-badge-grid .ui-badge')).toHaveCount(6);

    const dashboardGrade = (await page.locator('.tenant-dashboard-grade__mark').textContent())?.trim();
    expect(dashboardGrade).toMatch(/^[ABCD]$/);
    await expectTenantSessionStorage(page);
    await expectNoSensitiveValues(page);
    await saveEvidence(page, '08-dashboard.png');

    await page.getByRole('button', { name: 'Open the Toss app-in-app mock unlock screen' }).click();
    await expect(page.getByRole('heading', { name: 'Foreigner loan limit unlock', level: 1 })).toBeVisible();
    await expect(page.getByText('+KRW 5M unlocked')).toBeVisible();
    await expect(page.getByText('No API calls')).toBeVisible();
    await saveEvidence(page, '09-toss-unlock.png');

    await page.getByRole('button', { name: 'Return to the trust pass dashboard' }).click();
    await expect(page.getByRole('heading', { name: 'Ready to show your landlord', level: 1 })).toBeVisible();

    const reportLink = page.getByRole('link', { name: 'Open verification report' });
    const reportHref = await reportLink.getAttribute('href');
    expect(reportHref).not.toBeNull();
    const verifyPath = new URL(reportHref ?? '', page.url()).pathname;
    expect(verifyPath).toMatch(/^\/verify\/report_/);
    await expect(page.locator('a.tenant-dashboard-qr')).toHaveAttribute('href', new URL(verifyPath, page.url()).toString());
    await page.getByRole('button', { name: 'Copy verification report link' }).click();
    await expect(page.getByText(/Link copied to your clipboard\.|Clipboard is unavailable\./)).toBeVisible();
    await saveEvidence(page, '10-share-panel.png');

    const landlordContext = await browser.newContext({ locale: 'en-US' });
    const landlordPage = await landlordContext.newPage();

    try {
      await landlordPage.goto(verifyPath);
      await expect(landlordPage.getByRole('heading', { name: 'Automatically verify the public trust report', level: 1 })).toBeVisible();
      await expect(landlordPage.getByText(verifyPath.replace('/verify/', ''))).toBeVisible();
      await expect(landlordPage.getByText(`Trust Grade ${dashboardGrade}`)).toBeVisible();
      await expect(landlordPage.getByRole('heading', { name: '2 authenticity checks' })).toBeVisible();
      await expect(landlordPage.locator('.verify-authenticity-item')).toHaveCount(2);
      await expect(landlordPage.locator('.verify-badge-item')).toHaveCount(6);
      await expect(landlordPage.getByRole('link', { name: /DIDSet/ })).toBeVisible();
      await expect(landlordPage.evaluate(() => localStorage.getItem('nomokdon.session'))).resolves.toBeNull();
      await expectNoSensitiveValues(landlordPage);
      await saveEvidence(landlordPage, '11-verify-result.png');

      await landlordPage.getByRole('button', { name: 'I have confirmed' }).click();
      await expect(landlordPage.getByText('Confirmation recorded')).toBeVisible();
      await expect(landlordPage.getByRole('button', { name: 'I have confirmed' })).toBeDisabled();
      await saveEvidence(landlordPage, '12-landlord-confirmation.png');

      const logsResponse = await landlordPage.request.get(`${apiBaseUrl}/api/logs`);
      expect(logsResponse.ok()).toBe(true);
      const logs = await logsResponse.json() as ApiLogPayload;
      expect(logs.events.some((event) =>
        event.type === 'landlord.verify-confirmed'
        && event.status === 'confirmed'
        && event.details?.reportId === verifyPath.replace('/verify/', '')
        && event.details.action === 'landlord-confirmed-report'
      )).toBe(true);
    } finally {
      await closeContext(landlordContext);
    }

    const screenshots = await readdir(evidenceDir);
    expect(screenshots.filter((fileName) => fileName.endsWith('.png')).sort()).toEqual([...expectedEvidenceFiles].sort());
  } finally {
    await closeContext(tenantContext);
  }
});
