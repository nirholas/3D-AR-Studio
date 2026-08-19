// End-to-end check in a real browser.
//
// The unit suite covers the pure logic; this covers the half that only a browser
// can answer: does the bundle boot, does a WebGL context come up, does the tray
// load a live catalogue, and does a real GLB actually make it into the scene.
// It is deliberately not part of `npm test`, because it needs Playwright and a
// downloaded browser, which no consumer of this package should have to install.
//
//   npm i -D playwright && npx playwright install chromium
//   node scripts/smoke-browser.mjs
//
// Exits non-zero on any console error, any page error, or any failed step.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4173);

let chromium;
try {
	({ chromium } = await import('playwright'));
} catch {
	console.error('This check needs Playwright:\n  npm i -D playwright && npx playwright install chromium\n');
	process.exit(2);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.map': 'application/json' };
const server = createServer(async (req, res) => {
	const path = String(req.url).split('?')[0];
	const file = resolve(ROOT, 'docs', `.${path === '/' ? '/index.html' : path}`);
	try {
		res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
		res.end(await readFile(file));
	} catch {
		res.writeHead(404).end('not found');
	}
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

const steps = [];
const step = (name, ok, detail = '') => {
	steps.push({ name, ok, detail });
	console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? `: ${detail}` : ''}`);
};

try {
	await page.goto(`http://localhost:${PORT}/studio.html`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(1500);

	const boot = await page.evaluate(() => {
		const canvas = document.querySelector('.ars-canvas');
		return {
			mounted: !!document.querySelector('.ars-root'),
			pixels: canvas ? canvas.width * canvas.height : 0,
			tabs: [...document.querySelectorAll('.ars-tab')].map((b) => b.textContent),
			empty: !document.querySelector('.ars-empty')?.hidden,
			webgl: !!document.querySelector('ar-studio')?.studio?.renderer?.getContext(),
		};
	});
	step('the studio mounts', boot.mounted);
	step('a WebGL context is live', boot.webgl);
	step('the canvas has real pixels', boot.pixels > 100000, `${boot.pixels} px`);
	step('the empty state is shown before anything is placed', boot.empty);
	step('source tabs render', boot.tabs.length >= 2, boot.tabs.join(', '));

	await page.click('button[aria-label="Add a model to the scene"]');
	await page.click('.ars-tab[data-tab="objects"]');
	await page.waitForSelector('.ars-item-add', { timeout: 30000 });
	const items = await page.evaluate(() => document.querySelectorAll('.ars-item-add').length);
	step('the live catalogue loads', items > 0, `${items} models listed`);

	await page.click('.ars-item-add');
	await page.waitForFunction(() => document.querySelector('ar-studio').studio.placements.length > 0, { timeout: 45000 });
	const placed = await page.evaluate(() => {
		const s = document.querySelector('ar-studio').studio;
		return { count: s.placements.length, share: s.shareUrl(), title: s.placements[0].title };
	});
	step('a real GLB loads into the scene', placed.count === 1, placed.title);
	step('the scene has a shareable link', placed.share.includes('#s='));

	const restored = await page.evaluate(async () => {
		const s = document.querySelector('ar-studio').studio;
		const before = s.getScene();
		await s.setScene(before);
		return JSON.stringify(s.getScene()) === JSON.stringify(before);
	});
	step('the arrangement round-trips through setScene', restored);

	await page.evaluate(() => document.querySelector('ar-studio').studio.clear());
	const cleared = await page.evaluate(() => document.querySelector('ar-studio').studio.placements.length);
	step('clearing empties the scene', cleared === 0);

	await page.screenshot({ path: resolve(ROOT, 'smoke.png') });
} catch (err) {
	step('run completed', false, err.message);
}

step('no console or page errors', problems.length === 0, problems.join(' | '));

await browser.close();
server.close();

const failed = steps.filter((s) => !s.ok);
console.log(`\n${steps.length - failed.length}/${steps.length} checks passed`);
process.exit(failed.length ? 1 : 0);
