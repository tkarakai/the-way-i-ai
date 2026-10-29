import { test, expect } from '@playwright/test';

const home = 'http://127.0.0.1:4193/';
test('the optimized site loads only local assets, keeps prose early, and fetches search once on demand', async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(home);
  const html = await response!.text();
  expect(Buffer.byteLength(html)).toBeLessThan(40_000);
  expect(html.indexOf('<main')).toBeLessThan(15_000);
  expect(html).not.toContain('data:image');
  expect(html).not.toContain('collection-search-data');
  await page.evaluate(() => document.fonts.ready);
  expect(requests.every(url => url.startsWith(home))).toBe(true);
  expect(requests.filter(url => /search-[a-f0-9]+\.json/.test(url))).toHaveLength(0);
  await page.locator('[data-open-search]').click();
  await expect(page.locator('.search-results a').first()).toBeVisible();
  await page.locator('#collection-search').fill('worktree');
  await expect(page.locator('.search-results a').first()).toContainText(/worktree/i);
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-dialog')).not.toBeVisible();
  await page.locator('[data-open-search]').click();
  await expect(page.locator('.search-results a').first()).toBeVisible();
  expect(requests.filter(url => /search-[a-f0-9]+\.json/.test(url))).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('the CSP permits the intended theme script but blocks injected inline JavaScript', async ({ page }) => {
  await page.goto(home);
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/);
  const policy=await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(policy).toContain("default-src 'none'");
  expect(policy).toMatch(/script-src 'self' 'sha256-[^']+'/);
  expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  const executed=await page.evaluate(async () => {
    const violation=new Promise<void>(resolve=>document.addEventListener('securitypolicyviolation',()=>resolve(),{once:true}));
    const script=document.createElement('script');script.textContent='document.body.dataset.injected = "yes"';document.body.append(script);
    await violation;
    return document.body.dataset.injected;
  });
  expect(executed).toBeUndefined();
});

test('search recovers on the next open after a failed request without a retry loop', async ({ page }) => {
  let attempts=0;
  await page.route('**/search-*.json',route=> ++attempts===1 ? route.fulfill({status:503,body:'Unavailable'}) : route.continue());
  await page.goto(home);
  await page.keyboard.press('Control+k');
  await expect(page.locator('.search-result-status')).toContainText('could not load');
  expect(attempts).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-dialog')).not.toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.locator('.search-results a').first()).toBeVisible();
  expect(attempts).toBe(2);
});

test('agent editions, full-text feed, security contact and build provenance are served as real files', async ({ request, page }) => {
  for(const path of ['llms.txt','llms-full.txt','topics/worktrees/index.md','.well-known/security.txt','version.json','feed.xml']) {
    const response=await request.get(home+path); expect(response.ok()).toBe(true);
    const body=await response.text(); expect(body.length).toBeGreaterThan(100); expect(body).not.toContain('<h1 id="page-title">Nothing here');
    if(path.endsWith('index.md')) {expect(body).toContain('# Git Worktrees');expect(body).toContain('# AI-Aided Development Workflow');expect(body).not.toMatch(/^category:/m);}
    if(path==='feed.xml') expect(body).toContain('<content:encoded>');
  }
  await page.goto(home+'topics/worktrees/');
  await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute('href','index.md');
  const version=await (await request.get(home+'version.json')).json() as {version:string;built:string};
  await expect(page.locator('.edition')).toHaveText(`Edition ${version.version}`);
  expect(version.version).toMatch(/^\d{4}\.\d{2}\.\d{2}\.\d{4}\+/);
  expect(Number.isFinite(Date.parse(version.built))).toBe(true);
});
