import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://www.blippd.app';
const DIR = './screenshots-audit2';
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

const RESULTS = {
  consoleErrors: [],
  networkErrors: [],
  brokenLinks: [],
  uiIssues: [],
  pageLoadTimes: [],
  observations: [],
};

async function shot(page, name, fullPage = true) {
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage });
}

async function checkPage(page, url, name) {
  const errors = [];
  const netFails = [];
  const onConsole = msg => { if (msg.type() === 'error') errors.push({ page: name, message: msg.text() }); };
  const onFail = req => { netFails.push({ page: name, url: req.url(), error: req.failure()?.errorText }); };
  page.on('console', onConsole);
  page.on('requestfailed', onFail);

  const start = Date.now();
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const loadTime = Date.now() - start;
    RESULTS.pageLoadTimes.push({ page: name, url, loadTime, status: resp?.status() });
    if (resp?.status() >= 400) RESULTS.brokenLinks.push({ page: name, url, status: resp.status() });
    await shot(page, name);
  } catch (e) {
    RESULTS.networkErrors.push({ page: name, url, error: e.message });
  }

  if (errors.length) RESULTS.consoleErrors.push(...errors);
  if (netFails.length) RESULTS.networkErrors.push(...netFails);
  page.removeAllListeners('console');
  page.removeAllListeners('requestfailed');
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Mobile context
  const mCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  const m = await mCtx.newPage();

  // Desktop context
  const dCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await dCtx.newPage();

  // ===== PHASE 1: All pages =====
  console.log('=== PHASE 1: All pages ===');
  const pages = [
    ['/', 'root'],
    ['/home', 'home'],
    ['/sales', 'sales'],
    ['/upcoming', 'upcoming'],
    ['/alerts', 'alerts'],
    ['/login', 'login'],
    ['/onboarding', 'onboarding'],
    ['/settings', 'settings'],
    ['/privacy', 'privacy'],
    ['/terms', 'terms'],
  ];

  for (const [p, name] of pages) {
    console.log(`  ${name} (mobile)...`);
    await checkPage(m, `${BASE_URL}${p}`, `${name}-m`);
  }
  for (const [p, name] of pages) {
    console.log(`  ${name} (desktop)...`);
    await checkPage(d, `${BASE_URL}${p}`, `${name}-d`);
  }

  // ===== PHASE 2: Game detail pages =====
  console.log('\n=== PHASE 2: Game detail pages ===');
  await m.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 30000 });
  const gameLinks = await m.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/game/"]'))
      .slice(0, 5)
      .map(a => ({ href: a.getAttribute('href'), text: a.textContent?.trim().substring(0, 50) }));
  });
  for (const link of gameLinks) {
    const slug = link.href.split('/').pop();
    console.log(`  game: ${slug}`);
    await checkPage(m, `${BASE_URL}${link.href}`, `game-${slug}-m`);
    await checkPage(d, `${BASE_URL}${link.href}`, `game-${slug}-d`);
  }

  // ===== PHASE 3: Franchise pages =====
  console.log('\n=== PHASE 3: Franchise pages ===');
  await m.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 30000 });
  // Get franchise links from a game detail page
  if (gameLinks.length > 0) {
    await m.goto(`${BASE_URL}${gameLinks[0].href}`, { waitUntil: 'networkidle', timeout: 30000 });
    const franchiseLinks = await m.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/franchise/"]'))
        .slice(0, 3)
        .map(a => ({ href: a.getAttribute('href'), text: a.textContent?.trim() }));
    });
    for (const link of franchiseLinks) {
      console.log(`  franchise: ${link.text}`);
      await checkPage(m, `${BASE_URL}${link.href}`, `franchise-${encodeURIComponent(link.text)}-m`);
    }
  }

  // ===== PHASE 4: Interactive testing =====
  console.log('\n=== PHASE 4: Interactive testing ===');

  // Search
  console.log('  Testing search...');
  await m.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 30000 });
  const searchBtn = await m.$('button[aria-label="Search games"]');
  if (searchBtn) {
    await searchBtn.click();
    await m.waitForTimeout(500);
    await shot(m, 'search-opened', false);
    const input = await m.$('input[type="text"]');
    if (input) {
      await input.fill('Zelda');
      await m.waitForTimeout(2000);
      await shot(m, 'search-zelda', false);
      RESULTS.observations.push('Search: input found, tested with "Zelda"');

      // Check search results
      const resultCount = await m.evaluate(() => {
        const p = document.querySelector('p.text-xs');
        return p?.textContent || 'unknown';
      });
      RESULTS.observations.push(`Search results: ${resultCount}`);

      // Clear search
      const clearBtn = await m.$('button svg'); // X button
      await input.fill('xyznonexistent12345');
      await m.waitForTimeout(2000);
      await shot(m, 'search-no-results', false);
    }
  } else {
    RESULTS.uiIssues.push({ page: 'home', issue: 'Search button not found' });
  }

  // Tab switching
  console.log('  Testing tab switching...');
  await m.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 30000 });
  const myGamesTab = await m.$('button:has-text("My Games")');
  if (myGamesTab) {
    await myGamesTab.click();
    await m.waitForTimeout(500);
    await shot(m, 'tab-mygames', false);
  }
  const myFranchisesTab = await m.$('button:has-text("My Franchises")');
  if (myFranchisesTab) {
    await myFranchisesTab.click();
    await m.waitForTimeout(500);
    await shot(m, 'tab-myfranchises', false);
  }

  // Sales page filters
  console.log('  Testing sales filters...');
  await m.goto(`${BASE_URL}/sales`, { waitUntil: 'networkidle', timeout: 30000 });
  const lowestPrice = await m.$('button:has-text("Lowest Price")');
  if (lowestPrice) {
    await lowestPrice.click();
    await m.waitForTimeout(1000);
    await shot(m, 'sales-lowest-price', false);
  }
  const endingSoon = await m.$('button:has-text("Ending Soon")');
  if (endingSoon) {
    await endingSoon.click();
    await m.waitForTimeout(1000);
    await shot(m, 'sales-ending-soon', false);
  }

  // Upcoming page tabs
  console.log('  Testing upcoming tabs...');
  await m.goto(`${BASE_URL}/upcoming`, { waitUntil: 'networkidle', timeout: 30000 });
  const comingSoon = await m.$('button:has-text("Coming Soon")');
  if (comingSoon) {
    await comingSoon.click();
    await m.waitForTimeout(1000);
    await shot(m, 'upcoming-coming-soon', false);
  }

  // Platform filter
  const switch2Only = await m.$('button:has-text("Switch 2 Only")');
  if (switch2Only) {
    await switch2Only.click();
    await m.waitForTimeout(1000);
    await shot(m, 'upcoming-switch2-only', false);
  }

  // Login page interaction
  console.log('  Testing login...');
  await m.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  const emailInput = await m.$('input[type="email"]');
  if (emailInput) {
    // Test empty submit
    const submitBtn = await m.$('button:has-text("Send Magic Link")');
    if (submitBtn) {
      await submitBtn.click();
      await m.waitForTimeout(500);
      await shot(m, 'login-empty-submit', false);
    }
    // Test invalid email
    await emailInput.fill('notanemail');
    if (submitBtn) {
      await submitBtn.click();
      await m.waitForTimeout(500);
      await shot(m, 'login-invalid-email', false);
    }
    // Test valid email format
    await emailInput.fill('test@example.com');
    await shot(m, 'login-valid-email', false);
  }

  // ===== PHASE 5: Per-page UI analysis =====
  console.log('\n=== PHASE 5: UI analysis ===');

  for (const [p, name] of pages) {
    if (name === 'root') continue;
    await m.goto(`${BASE_URL}${p}`, { waitUntil: 'networkidle', timeout: 30000 });

    // Horizontal overflow
    const hOverflow = await m.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    if (hOverflow) RESULTS.uiIssues.push({ page: name, issue: 'Horizontal scroll overflow' });

    // Text overflow in cards
    const textOverflow = await m.evaluate(() => {
      const els = document.querySelectorAll('*');
      const bad = [];
      for (const el of els) {
        if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && el.children.length === 0) {
          const style = window.getComputedStyle(el);
          if (style.overflow !== 'hidden' && style.overflowX !== 'hidden' &&
              style.textOverflow !== 'ellipsis' && !style.display.includes('flex')) {
            bad.push({
              tag: el.tagName, text: el.textContent?.substring(0, 40),
              sw: el.scrollWidth, cw: el.clientWidth,
              class: el.className?.toString().substring(0, 60)
            });
          }
        }
      }
      return bad.slice(0, 5);
    });
    if (textOverflow.length) RESULTS.uiIssues.push({ page: name, issue: 'Text overflow', details: textOverflow });

    // Missing images
    const brokenImgs = await m.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .filter(img => !img.complete || img.naturalWidth === 0)
        .map(img => ({ src: img.src?.substring(0, 100), alt: img.alt }));
    });
    if (brokenImgs.length) RESULTS.uiIssues.push({ page: name, issue: 'Broken images', details: brokenImgs });

    // Z-index / overlap issues (bottom nav overlapping content)
    const bottomNavOverlap = await m.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return null;
      const navRect = nav.getBoundingClientRect();
      // Check if last visible element is hidden behind nav
      const main = document.querySelector('main');
      if (!main) return null;
      const mainRect = main.getBoundingClientRect();
      return { navTop: navRect.top, mainBottom: mainRect.bottom, overlap: mainRect.bottom > navRect.top };
    });
    if (bottomNavOverlap?.overlap) {
      RESULTS.uiIssues.push({ page: name, issue: 'Content may be hidden behind bottom nav', details: bottomNavOverlap });
    }
  }

  // ===== PHASE 6: Accessibility =====
  console.log('\n=== PHASE 6: Accessibility ===');
  await m.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 30000 });

  // Missing alt text
  const noAlts = await m.evaluate(() => {
    return Array.from(document.querySelectorAll('img:not([alt]), img[alt=""]'))
      .map(img => ({ src: img.src?.substring(0, 80) }));
  });
  if (noAlts.length) RESULTS.uiIssues.push({ page: 'home', issue: `${noAlts.length} images missing alt text`, details: noAlts.slice(0, 5) });

  // Buttons/links without accessible names
  const noNames = await m.evaluate(() => {
    const issues = [];
    document.querySelectorAll('button').forEach(btn => {
      if (!btn.textContent?.trim() && !btn.getAttribute('aria-label') && !btn.getAttribute('title')) {
        issues.push({ element: 'button', html: btn.outerHTML.substring(0, 120) });
      }
    });
    document.querySelectorAll('a').forEach(a => {
      if (!a.textContent?.trim() && !a.getAttribute('aria-label') && !a.getAttribute('title')) {
        issues.push({ element: 'link', href: a.href?.substring(0, 80) });
      }
    });
    return issues;
  });
  if (noNames.length) RESULTS.uiIssues.push({ page: 'home', issue: 'Elements without accessible names', details: noNames });

  // Focus indicator check
  const focusCheck = await m.evaluate(() => {
    const btn = document.querySelector('button');
    if (!btn) return 'no buttons';
    btn.focus();
    const style = window.getComputedStyle(btn);
    return { outline: style.outline, outlineOffset: style.outlineOffset, boxShadow: style.boxShadow?.substring(0, 50) };
  });
  RESULTS.observations.push(`Focus indicator: ${JSON.stringify(focusCheck)}`);

  // ===== PHASE 7: Navigation flow =====
  console.log('\n=== PHASE 7: Navigation flow ===');

  // Test all bottom nav links
  const navTargets = ['/home', '/sales', '/upcoming', '/alerts'];
  for (const target of navTargets) {
    await m.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 30000 });
    const navLink = await m.$(`nav a[href="${target}"]`);
    if (navLink) {
      await navLink.click();
      await m.waitForTimeout(1500);
      const currentUrl = m.url();
      if (!currentUrl.includes(target)) {
        RESULTS.uiIssues.push({ page: 'nav', issue: `Nav link ${target} navigated to ${currentUrl}` });
      }
    } else {
      RESULTS.uiIssues.push({ page: 'nav', issue: `Nav link ${target} not found` });
    }
  }

  // Test game card navigation
  console.log('  Testing game card click...');
  await m.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 30000 });
  const firstCard = await m.$('a[href*="/game/"]');
  if (firstCard) {
    await firstCard.click();
    await m.waitForTimeout(2000);
    const url = m.url();
    RESULTS.observations.push(`Game card click navigated to: ${url}`);
    if (!url.includes('/game/')) {
      RESULTS.uiIssues.push({ page: 'home', issue: 'Game card click did not navigate to game page' });
    }
    await shot(m, 'game-from-click', false);

    // Test back button on game page
    const backBtn = await m.$('button');
    if (backBtn) {
      const backText = await backBtn.textContent();
      RESULTS.observations.push(`First button on game page: "${backText}"`);
    }
  }

  // ===== PHASE 8: Scroll behavior =====
  console.log('\n=== PHASE 8: Scroll behavior ===');
  await m.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 30000 });

  // Scroll down and check if bottom nav stays fixed
  await m.evaluate(() => window.scrollTo(0, 2000));
  await m.waitForTimeout(500);
  const navStillVisible = await m.evaluate(() => {
    const nav = document.querySelector('nav');
    if (!nav) return false;
    const rect = nav.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  });
  RESULTS.observations.push(`Bottom nav visible after scroll: ${navStillVisible}`);
  await shot(m, 'home-scrolled', false);

  // Check if last card is visible (not hidden behind nav)
  await m.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 30000 });
  await m.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await m.waitForTimeout(500);
  await shot(m, 'home-bottom', false);

  // ===== PHASE 9: Error states =====
  console.log('\n=== PHASE 9: Error states ===');
  await checkPage(m, `${BASE_URL}/game/nonexistent-game-12345`, 'game-404-m');
  await checkPage(m, `${BASE_URL}/franchise/NonexistentFranchise12345`, 'franchise-404-m');

  // ===== PHASE 10: Desktop-specific =====
  console.log('\n=== PHASE 10: Desktop checks ===');
  await d.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 30000 });
  await shot(d, 'home-desktop-full', false);

  // Check if content is centered and not stretched weirdly
  const desktopLayout = await d.evaluate(() => {
    const container = document.querySelector('.max-w-\\[430px\\]');
    if (!container) return { found: false };
    const rect = container.getBoundingClientRect();
    return {
      found: true,
      width: rect.width,
      left: rect.left,
      right: rect.right,
      windowWidth: window.innerWidth,
      centered: Math.abs((rect.left + rect.right) / 2 - window.innerWidth / 2) < 5
    };
  });
  RESULTS.observations.push(`Desktop layout: ${JSON.stringify(desktopLayout)}`);

  // Check game detail on desktop
  if (gameLinks.length > 0) {
    await d.goto(`${BASE_URL}${gameLinks[0].href}`, { waitUntil: 'networkidle', timeout: 30000 });
    await shot(d, 'game-detail-desktop', false);
  }

  // ===== WRAP UP =====
  await browser.close();

  console.log('\n========================================');
  console.log('       BLIPPD AUDIT #2 RESULTS');
  console.log('========================================\n');

  console.log(`--- CONSOLE ERRORS (${RESULTS.consoleErrors.length}) ---`);
  const uniqueErrors = [...new Set(RESULTS.consoleErrors.map(e => e.message))];
  uniqueErrors.forEach(e => console.log(`  ${e.substring(0, 200)}`));

  console.log(`\n--- NETWORK ERRORS (${RESULTS.networkErrors.length}) ---`);
  // Only show non-RSC aborted errors (those are normal prefetch cancellations)
  const realNetErrors = RESULTS.networkErrors.filter(e => !e.url?.includes('_rsc='));
  realNetErrors.forEach(e => console.log(`  [${e.page}] ${e.url?.substring(0, 100)} - ${e.error}`));

  console.log(`\n--- BROKEN LINKS (${RESULTS.brokenLinks.length}) ---`);
  RESULTS.brokenLinks.forEach(l => console.log(`  [${l.page}] ${l.url} -> ${l.status}`));

  console.log(`\n--- UI ISSUES (${RESULTS.uiIssues.length}) ---`);
  RESULTS.uiIssues.forEach(i => {
    console.log(`  [${i.page}] ${i.issue}`);
    if (i.details) console.log(`    ${JSON.stringify(i.details).substring(0, 300)}`);
  });

  console.log(`\n--- PAGE LOAD TIMES ---`);
  RESULTS.pageLoadTimes.forEach(p => console.log(`  ${p.page}: ${p.loadTime}ms (${p.status})`));

  console.log(`\n--- OBSERVATIONS ---`);
  RESULTS.observations.forEach(o => console.log(`  ${o}`));

  fs.writeFileSync('./audit2-report.json', JSON.stringify(RESULTS, null, 2));
  console.log('\nFull report: audit2-report.json');
}

main().catch(console.error);
