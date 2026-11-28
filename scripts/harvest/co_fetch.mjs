// Download CPW harvest report PDFs from their widencollective share links.
// The share page is a JavaScript viewer, so we open it in headless Chromium and
// catch the signed PDF URL it loads. Usage: node co_fetch.mjs out_dir name=url [name=url ...]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const [out, ...pairs] = process.argv.slice(2);
const browser = await chromium.launch();
let failed = 0;
for (const pair of pairs) {
  const i = pair.indexOf('='); const name = pair.slice(0, i), url = pair.slice(i + 1);
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const seen = [];
  page.on('response', r => {
    const u = r.url(), ct = (r.headers()['content-type'] || '');
    if (ct.includes('pdf') || /widencdn\.net\/.*\.pdf/i.test(u)) seen.push(u);
  });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    for (let t = 0; t < 30 && !seen.length; t++) {
      // the viewer can sit inside an iframe; also look at resource timing entries
      for (const f of page.frames()) {
        try {
          const es = await f.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(n => /\.pdf(\?|$)/i.test(n)));
          seen.push(...es);
        } catch {}
      }
      if (!seen.length) await page.waitForTimeout(1000);
    }
    if (!seen.length) throw new Error('no PDF URL found');
    const r = await ctx.request.get(seen[0], { timeout: 120000 });
    const b = await r.body();
    if (b.slice(0, 4).toString() !== '%PDF') throw new Error('not a PDF (' + r.status() + ')');
    fs.writeFileSync(path.join(out, name + '.pdf'), b);
    console.log('ok', name, b.length, 'bytes');
  } catch (e) { console.log('ERROR', name, url, e.message); failed++; }
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
