"""Parse NDOW "<year> <Species> Harvest by Unit Group" reports (pdftotext -layout).
Reads $HF_WORK/raw/nv_*.txt, writes $HF_WORK/nv_harvest_raw.json keyed by the draw-odds hunt id
in data/nv.json. Resident and nonresident rows of the same hunt are added together."""
import re, json, os, glob
WORK = os.environ.get('HF_WORK', 'harvest-work'); RAW = os.path.join(WORK, 'raw')
REPO = os.environ.get('HF_REPO', '.')
MON = r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{2}'

def sp_of(t):
    t = t.lower()
    for k in ['desert', 'nelson', 'california', 'rocky', 'goat', 'bear', 'moose', 'elk', 'antelope', 'deer']:
        if k in t: return 'desert' if k == 'nelson' else k
    return None

def kind(t):
    t = t.lower()
    for k in ['antlerless', 'antlered', 'spike', 'longer', 'shorter', 'ewe', 'ram', 'either']:
        if k in t: return k
    return 'antlered' if 'deer' in t else ''

def weap(w, junior):
    w = w.lower()
    if w in ('alw', 'any legal weapon'): return 'alw'
    if w in ('ar', 'archery'): return 'ar'
    if w in ('m', 'mz', 'muzzleloader'): return 'm'
    if 'prmtve' in w or 'primitive' in w: return 'prim'
    if 'shotgun' in w or w in ('sbo', 'wr'): return 'sbo'
    if w in ('swr', 'classic'): return 'classic'
    return w

def units(t):
    out = set()
    for a, b in re.findall(r'\b(\d{3})(?:\s*-\s*(\d{3}))?\b', t):
        out.update(range(int(a), int(b or a) + 1))
    return ','.join(map(str, sorted(out)))

def key(name, w, u, start):
    n = name.lower()
    return (sp_of(name), kind(name), 'jr' if 'junior' in n else '', 'g' if 'guided' in n else '', weap(w, 'junior' in n), units(u), start)

ROW = re.compile(r'^\s*(?P<hunt>\S.*?)\s{2,}(?P<res>NR|R)\s{2,}(?P<sp>\S.*?)\s{2,}(?P<w>\S+)\s{2,}(?P<u>\S.*?)\s{2,}(?P<start>' + MON + r') - ' + MON + r'\s+(?P<nums>.*)$')
acc = {}
for p in sorted(glob.glob(os.path.join(RAW, 'nv_*.txt'))):
    for ln in open(p, encoding='utf-8', errors='ignore'):
        m = ROW.match(ln)
        if not m: continue
        nums = m.group('nums').split()
        # demand, apps, quota, tags issued, hunters afield, successful, draw rate, survey rate, success, ...
        ints = [t for t in nums if re.fullmatch(r'[\d,]+', t)]
        pcts = [t for t in nums if t.endswith('%')]
        if len(ints) < 3: continue
        afield, succ = int(ints[-2].replace(',', '')), int(ints[-1].replace(',', ''))
        hunt = m.group('hunt') + ' ' + (m.group('sp') if sp_of(m.group('hunt')) is None else '')
        k = key(hunt, m.group('w'), m.group('u'), m.group('start'))
        a = acc.setdefault(k, [0, 0]); a[0] += afield; a[1] += succ

draw = json.load(open(os.path.join(REPO, 'data', 'nv.json')))
WN = r'(ALW|Archery|Muzzleloader|Classic|Primitive|Shotgun or Bow Only)'
out, miss = {}, []
for h in draw['hunts']:
    m = re.match(r'^(?P<name>.*?) ' + WN + r' (?P<u>.*) \((?P<start>' + MON + r')\)$', h['id'])
    if not m: miss.append(h['id']); continue
    k = key(m.group('name'), m.group(2), m.group('u'), m.group('start'))
    a = acc.get(k)
    if not a or a[0] <= 0: miss.append(h['id']); continue
    e = {'s': round(100 * a[1] / a[0], 1), 'h': a[0], 'k': a[1]}
    if a[0] < 10: e['few'] = 1
    out[h['id']] = e
json.dump(out, open(os.path.join(WORK, 'nv_harvest_raw.json'), 'w'))
print(len(out), 'NV hunts matched;', len(miss), 'not matched, e.g.', miss[:12])
