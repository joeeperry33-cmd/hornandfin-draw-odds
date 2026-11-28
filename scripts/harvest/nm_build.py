"""Parse New Mexico DGF hunter harvest reports (pdftotext -layout) into hunt-code rows.
Reads $HF_WORK/raw/nm_{elk,deer,pronghorn,bighorn}.txt, writes $HF_WORK/nm_harvest_raw.json.
Rows that share a hunt code (public and private land lines) are added together."""
import re, json, os
WORK = os.environ.get('HF_WORK', 'harvest-work'); RAW = os.path.join(WORK, 'raw')
CODE = re.compile(r'\b(ELK|DER|ANT|BHS)[- ](\d)-(\d{3})\b')
def num(t):
    t = t.replace(',', '').replace('%', '')
    try: return float(t)
    except ValueError: return 0.0 if t == '.' else None
acc = {}
for name in ['elk', 'deer', 'pronghorn', 'bighorn']:
    p = os.path.join(RAW, f'nm_{name}.txt')
    if not os.path.exists(p): continue
    for ln in open(p, encoding='utf-8', errors='ignore'):
        m = CODE.search(ln)
        if not m: continue
        tok = ln[m.end():].split()
        pc = [i for i, t in enumerate(tok) if t.endswith('%')]
        if len(pc) < 2 or pc[0] < 2 or len(tok) - pc[1] < 3: continue
        i, j = pc[0], pc[1]
        sold, rep = num(tok[i - 2]), num(tok[i - 1])
        est = num(tok[i + 1]) if j == i + 2 else None
        succ = num(tok[j]); harv = [num(t) for t in tok[j + 1:-2]]
        if None in (sold, rep, succ) or None in harv or not harv: continue
        hunters = est if est is not None else sold
        hid = f'{m.group(1)}-{m.group(2)}-{m.group(3)}'
        a = acc.setdefault(hid, {'h': 0, 'k': 0, 'sh': 0, 'rep': 0})
        a['h'] += hunters; a['k'] += sum(harv); a['sh'] += succ * hunters; a['rep'] += rep
out = {}
for hid, a in acc.items():
    if a['h'] <= 0: continue
    e = {'s': round(a['sh'] / a['h'], 1), 'h': int(round(a['h'])), 'k': int(round(a['k']))}
    if a['rep'] < 10: e['few'] = 1
    out[hid] = e
json.dump(out, open(os.path.join(WORK, 'nm_harvest_raw.json'), 'w'))
print(len(out), 'NM hunt codes')
