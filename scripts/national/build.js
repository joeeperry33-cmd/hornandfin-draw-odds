#!/usr/bin/env node
// Build data/national/<species>.json for the national "Compare hunts" page.
// The odds math is taken straight from tool/hfo.js (the draw odds tool), so both
// pages always agree. For every hunt in every state it stores the odds of drawing
// at a set of point levels, for residents and nonresidents, plus hunter success.
// Usage: node scripts/national/build.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const REPO = process.env.HF_REPO || '.';
const LEVELS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30];

const src = fs.readFileSync(path.join(REPO, 'tool/hfo.js'), 'utf8');
function between(a, b) { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('hfo.js layout changed: ' + a); return src.slice(i, j); }
const head = ['var RESPOOLS=', 'var S='].map(k => { const i = src.indexOf(k); return src.slice(i, src.indexOf('\n', i)); }).join('\n');
const math = between('// ---------- odds math ----------', '// ---------- render ----------');
const weapon = between('function weaponOf(', '\n');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(head + '\n' + math + '\n' + weapon + '\nthis.api={S:S,poolsFor:poolsFor,rowsFor:rowsFor,oddsAt:oddsAt,fullAt:fullAt,lowestDrew:lowestDrew,gains:gains,weaponOf:weaponOf};', ctx);
const A = ctx.api;

const skip = new Set(['rules.json', 'lotteries.json']);
const rules = JSON.parse(fs.readFileSync(path.join(REPO, 'data/rules.json'), 'utf8'));
const bySp = {};
// license fees: data/fees/<st>.json. Cost to hunt = required licenses/stamps + the tag for that hunt.
const fees = {}; const feeDir = path.join(REPO, 'data/fees');
if (fs.existsSync(feeDir)) for (const fn of fs.readdirSync(feeDir)) if (fn.endsWith('.json')) fees[fn.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(feeDir, fn), 'utf8'));
function costOf(st, sp, name) {
  const f = fees[st]; if (!f || !f.species || !f.species[sp]) return null;
  const e = f.species[sp]; let t = e;
  for (const r of e.rules || []) if (new RegExp(r.m, 'i').test(name || '')) { t = r; break; }
  const out = {};
  for (const k of ['res', 'nr']) {
    if (t[k] == null) { out[k] = null; continue; }
    let c = t[k]; for (const b of f.base || []) c += b[k] || 0;
    out[k] = Math.round(c);
  }
  return out;
}
for (const fn of fs.readdirSync(path.join(REPO, 'data')).sort()) {
  if (!fn.endsWith('.json') || skip.has(fn)) continue;
  const st = fn.slice(0, -5);
  const data = JSON.parse(fs.readFileSync(path.join(REPO, 'data', fn), 'utf8'));
  let harv = null; const hp = path.join(REPO, 'data/harvest', fn);
  if (fs.existsSync(hp)) harv = JSON.parse(fs.readFileSync(hp, 'utf8'));
  for (const h of data.hunts || []) {
    const row = { st, id: h.id, n: h.name || '', w: A.weaponOf(h.name)[0], g: A.gains(data, h) ? 1 : 0 };
    let any = false;
    for (const res of ['res', 'nr']) {
      A.S.res = res;
      const ks = A.poolsFor(h, data); if (!ks.length) continue;
      const k = ks[0], rows = A.rowsFor(h, k, data);
      const apps = rows.reduce((s, r) => s + (r[1] || 0), 0);
      if (!apps) continue;
      const o = LEVELS.map(p => { const v = A.oddsAt(h, k, data, p); return v == null ? null : Math.round(v * 1000) / 10; });
      if (o.every(v => v == null)) continue;
      row[res] = { o: o.every(v => v === o[0]) ? o[0] : o, a: apps, f: A.fullAt(rows), l: A.lowestDrew(rows) };
      const q = h.q || {}; const t = q[res] != null ? q[res] : q.all; if (t != null) row[res].t = t;
      any = true;
    }
    if (!any) continue;
    const x = harv && harv.hunts && harv.hunts[h.id];
    if (x && x.s != null) { row.s = x.s; row.h = x.h; if (x.few) row.few = 1; }
    if (/private land/i.test(h.name || '')) row.pl = 1;
    const c = costOf(st, h.sp, h.name); if (c) row.c = [c.res, c.nr];
    (bySp[h.sp] = bySp[h.sp] || []).push(row);
  }
}
const outDir = path.join(REPO, 'data/national'); fs.mkdirSync(outDir, { recursive: true });
const index = { levels: LEVELS, species: {} };
for (const [sp, hunts] of Object.entries(bySp)) {
  const out = { species: sp, levels: LEVELS, hunts };
  const file = path.join(outDir, sp + '.json'), txt = JSON.stringify(out);
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== txt) { fs.writeFileSync(file, txt); console.log('wrote', file, hunts.length, 'hunts', (txt.length / 1024).toFixed(0) + ' KB'); }
  index.species[sp] = { hunts: hunts.length, states: [...new Set(hunts.map(h => h.st))].sort() };
}
// draw years per state, for the footnote
index.years = {};
for (const fn of fs.readdirSync(path.join(REPO, 'data'))) {
  if (!fn.endsWith('.json') || skip.has(fn)) continue;
  const d = JSON.parse(fs.readFileSync(path.join(REPO, 'data', fn), 'utf8')); index.years[fn.slice(0, -5)] = d.year;
}
index.fees = {};
for (const [st, f] of Object.entries(fees)) index.fees[st] = { year: f.year, checked: f.checked, sources: f.sources, note: f.note || '', base: (f.base || []).map(b => b.label) };
const itxt = JSON.stringify(index);
const ifile = path.join(outDir, 'index.json');
if (!fs.existsSync(ifile) || fs.readFileSync(ifile, 'utf8') !== itxt) { fs.writeFileSync(ifile, itxt); console.log('wrote', ifile); }
