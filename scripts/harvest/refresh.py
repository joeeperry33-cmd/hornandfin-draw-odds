"""Refresh hunter-success files in data/harvest/ from official state harvest reports.

Run from the repo root:  python3 scripts/harvest/refresh.py [wy ut id or]
For each state it finds the newest published report, downloads it, runs that
state's parser, checks the result, and rewrites data/harvest/<st>.json only when
the numbers changed and the checks pass. Colorado's PDFs sit behind a JavaScript
viewer, so CO uses headless Chromium (scripts/harvest/co_fetch.mjs, needs Node + Playwright).
"""
import os, re, sys, json, subprocess, urllib.request, urllib.parse, html, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.setdefault('HF_REPO', os.path.abspath(os.path.join(HERE, '..', '..')))
WORK = os.environ.setdefault('HF_WORK', os.path.join(REPO, 'harvest-work'))
RAW = os.path.join(WORK, 'raw'); os.makedirs(RAW, exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (compatible; HornAndFinDataBot/1.0)'}
THIS_YEAR = datetime.date.today().year

def get(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        b = r.read()
    return b if binary else b.decode('utf-8', 'ignore')

def save_pdf(url, name):
    b = get(url, True)
    if not b.startswith(b'%PDF'):
        raise RuntimeError(f'not a PDF: {url}')
    p = os.path.join(RAW, name + '.pdf'); open(p, 'wb').write(b)
    subprocess.run(['pdftotext', '-layout', p, os.path.join(RAW, name + '.txt')], check=True)

def links(page_html, base):
    for m in re.finditer(r'<a\s([^>]*?)href="([^"]+)"([^>]*)>(.*?)</a>', page_html, re.S):
        attrs = m.group(1) + m.group(3)
        t = re.search(r'title="([^"]*)"', attrs)
        text = html.unescape(re.sub(r'<[^>]+>|\s+', ' ', (t.group(1) + ' ' if t else '') + m.group(4))).strip()
        yield urllib.parse.urljoin(base, html.unescape(m.group(2))), text

def run(script):
    r = subprocess.run([sys.executable, os.path.join(HERE, script)], capture_output=True, text=True)
    print(r.stdout[-600:]); 
    if r.returncode: raise RuntimeError(r.stderr[-1500:])

# ---------- discovery + download per state ----------
def wy():
    idx = 'https://wgfd.wyo.gov/hunting-trapping/harvest-reports-surveys'
    page = get(idx)
    want = {'elk': r'Elk Harvest Report', 'deer': r'(Mule Deer|Deer) .*Harvest Report|Deer Harvest Report',
            'pronghorn': r'Antelope Harvest Report', 'moose': r'Moose Harvest Report', 'sheep': r'Bighorn Sheep Harvest Report',
            'goat': r'Mountain Goat Harvest Report', 'bison': r'Bison Harvest Report'}
    found = {}
    for u, t in links(page, idx):
        m = re.match(r'(\d{4})\s', t)
        if not m or '/media/' not in u: continue
        for k, pat in want.items():
            if re.search(pat, t, re.I) and (k not in found or int(m.group(1)) > found[k][0]):
                found[k] = (int(m.group(1)), u.split('?')[0], t)
    year = max(v[0] for v in found.values())
    for k, (y, u, t) in found.items():
        if y == year: save_pdf(u, 'wy_' + k)
    run('wy_build.py')
    labels = {'elk': 'Elk', 'deer': 'Mule Deer and White-Tailed Deer', 'pronghorn': 'Antelope', 'moose': 'Moose', 'sheep': 'Bighorn Sheep', 'goat': 'Mountain Goat', 'bison': 'Wild Bison'}
    src = [{'label': f'WGFD {year} {labels[k]} Harvest Report', 'url': u} for k, (y, u, t) in found.items() if y == year]
    src.append({'label': 'WGFD harvest reports index', 'url': idx})
    raw = json.load(open(os.path.join(WORK, 'wy_harvest_raw.json')))
    draw = {h['id'] for h in json.load(open(os.path.join(REPO, 'data', 'wy.json')))['hunts']}
    H = {}
    for k, v in raw.items():
        if k not in draw: continue
        e = {'s': v['success'], 'h': int(v['hunters'] or 0), 'k': int(v['harvest'] or 0)}
        if v.get('days') and v.get('harvest'): e['d'] = round(v['days'] / v['harvest'], 1)
        if v.get('res') is not None: e['r'] = v['res']
        if v.get('nr') is not None: e['n'] = v['nr']
        if 'area' in v: e['a'] = v['area']['success']; e['ar'] = v['area']['res']; e['an'] = v['area']['nr']
        H[k] = e
    return year, f'{year} hunting season harvest survey (Wyoming Game and Fish)', src, H

def ut():
    idx = 'https://wildlife.utah.gov/biggame/reports'
    page = get(idx)
    cands = {}
    for u, t in links(page, idx):
        m = re.search(r'/pdf/bg/(\d{4})/[^/]+\.pdf$', u)
        if m: cands.setdefault(int(m.group(1)), []).append(u)
    year = max(cands)
    best = None
    for u in cands[year]:
        try:
            save_pdf(u, 'ut_try')
        except Exception as e:
            print('skip', u, e); continue
        n = sum(1 for ln in open(os.path.join(RAW, 'ut_try.txt')) if re.match(r'^\s*[A-Z]{2}\d{4}\s', ln))
        if not best or n > best[0]: best = (n, u)
    save_pdf(best[1], 'ut_2025_gs_buck_deer_hr-preliminary')  # parser reads this name
    sheep = f'https://wildlife.utah.gov/pdf/sheep/{year}_sheep/{year}-harvest-data.pdf'
    try:
        save_pdf(sheep, 'ut_sheep_2025')
    except Exception as e:
        print('no sheep file', e); open(os.path.join(RAW, 'ut_sheep_2025.txt'), 'w').write('')
    run('ut_build.py')
    raw = json.load(open(os.path.join(WORK, 'ut_harvest_raw.json')))
    H = {k: {'s': v['s'], 'h': v['h'], 'k': v['k'], **({'days': v['dd']} if v.get('dd') else {})} for k, v in raw.items()}
    pre = 'preliminary' in best[1]
    src = [{'label': f'Utah DWR {year} big game harvest' + (' (preliminary)' if pre else ''), 'url': best[1]},
           {'label': f'Utah DWR {year} bighorn sheep harvest records', 'url': sheep},
           {'label': 'Utah DWR big game reports', 'url': idx}]
    return year, f'{year} Utah big game harvest (Utah Division of Wildlife Resources' + (', preliminary)' if pre else ')'), src, H

def id_():
    year = None
    for y in (THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2):
        p = get(f'https://idfg.idaho.gov/ifwis/huntplanner/stats/?season=controlled&game=elk&yr={y}')
        if p.count('<tr') > 20 and f'>{y}<' in p: year = y; break
    for g in ['deer', 'elk', 'pronghorn', 'moose', 'goat', 'bear', 'sheep']:
        open(os.path.join(RAW, f'id_{g}.html'), 'w').write(get(f'https://idfg.idaho.gov/ifwis/huntplanner/stats/?season=controlled&game={g}&yr={year}'))
    run('id_build.py')
    raw = json.load(open(os.path.join(WORK, 'id_harvest_raw.json')))
    H = {k: {'s': v['s'], 'h': v['h'], 'k': v['k'], **({'d': round(v['days_total'] / v['k'], 1)} if v.get('days_total') and v['k'] else {})} for k, v in raw.items()}
    src = [{'label': f'IDFG Hunt Planner {year} controlled hunt harvest statistics', 'url': f'https://idfg.idaho.gov/ifwis/huntplanner/stats/?season=controlled&game=elk&yr={year}'}]
    return year, f'{year} controlled hunt harvest statistics (Idaho Fish and Game)', src, H

def or_():
    idx = 'https://myodfw.com/articles/big-game-hunting-harvest-statistics'
    page = get(idx)
    best = {}
    for u, t in links(page, idx):
        m = re.match(r'(\d{4}) (.*Harvest)$', t)
        if not m or not u.endswith('.pdf') or 'Public vs Private' in t or 'Cougar' in t or 'Damage' in t: continue
        y, name = int(m.group(1)), m.group(2)
        if name not in best or y > best[name][0]: best[name] = (y, u)
    year = max(y for y, u in best.values())
    for f in os.listdir(RAW):
        if f.startswith('or_'): os.remove(os.path.join(RAW, f))
    for i, (name, (y, u)) in enumerate(sorted(best.items())):
        if y == year: save_pdf(u, f'or_{i:02d}')
    run('or_build.py')
    H = json.load(open(os.path.join(WORK, 'or_harvest_raw.json')))
    return year, f'{year} harvest summaries (Oregon Department of Fish and Wildlife, mandatory harvest reporting)', [{'label': f'ODFW big game harvest statistics ({year})', 'url': idx}], H

def nm():
    idx = 'https://wildlife.dgf.nm.gov/hunting/harvest-reporting-information/'
    page = get(idx)
    want = {'elk': 'Elk', 'deer': 'Deer', 'pronghorn': 'Pronghorn', 'bighorn': 'Bighorn Sheep'}
    found = {}
    for u, t in links(page, idx):
        m = re.match(r'(\d{4})[-_ ]\d{4} (Elk|Deer|Pronghorn|Bighorn Sheep) Harvest Report$', t, re.I)
        if not m or '/download/' not in u: continue
        k = [k for k, v in want.items() if v.lower() == m.group(2).lower()][0]
        y = int(m.group(1))
        if k not in found or y > found[k][0]: found[k] = (y, u)
    year = max(y for y, u in found.values())
    for k, (y, u) in found.items():
        if y == year: save_pdf(u, 'nm_' + k)
        elif os.path.exists(os.path.join(RAW, f'nm_{k}.txt')): os.remove(os.path.join(RAW, f'nm_{k}.txt'))
    run('nm_build.py')
    H = json.load(open(os.path.join(WORK, 'nm_harvest_raw.json')))
    src = [{'label': f'NMDGF {y}-{y + 1} {want[k]} Harvest Report', 'url': u} for k, (y, u) in found.items() if y == year]
    src.append({'label': 'NMDGF harvest reporting information', 'url': idx})
    return year, f'{year} New Mexico hunter harvest reports (New Mexico Department of Game and Fish), by hunt code', src, H

def nv():
    api = 'https://www.ndow.org/wp-json/wp/v2/media?search=harvest%20by%20unit%20group&per_page=100&_fields=source_url'
    files = {}
    for x in json.loads(get(api)):
        u = x['source_url']; m = re.search(r'/(\d{4})-([A-Za-z-]+)-Harvest-by-Unit-Group\.pdf$', u)
        if m: files.setdefault(int(m.group(1)), {})[m.group(2)] = u
    year = max(y for y, f in files.items() if len(f) >= 5)
    for f in os.listdir(RAW):
        if f.startswith('nv_'): os.remove(os.path.join(RAW, f))
    for name, u in sorted(files[year].items()):
        save_pdf(u, 'nv_' + name)
    run('nv_build.py')
    H = json.load(open(os.path.join(WORK, 'nv_harvest_raw.json')))
    src = [{'label': f'NDOW {year} {n.replace("-", " ")} Harvest by Unit Group', 'url': u} for n, u in sorted(files[year].items())]
    return year, f'{year} big game hunt statistics (Nevada Department of Wildlife)', src, H

def az():
    cfg = json.load(open(os.path.join(REPO, 'data', 'harvest', 'az_sources.json')))
    for f in os.listdir(RAW):
        if f.startswith('az_'): os.remove(os.path.join(RAW, f))
    for sp, u in cfg['files'].items():
        save_pdf(u, 'az_' + sp)
    run('az_build.py')
    H = json.load(open(os.path.join(WORK, 'az_harvest_raw.json')))
    y = cfg['year']
    names = {'elk': 'Elk', 'deer': 'Deer', 'pronghorn': 'Pronghorn', 'sheep': 'Bighorn Sheep'}
    src = [{'label': f'AZGFD {y} {names[sp]} Harvest Summary', 'url': u.replace('https://azgfd-live-portal-wordpress-pantheon.s3.us-west-2.amazonaws.com', 'https://www.azgfd.com')} for sp, u in cfg['files'].items()]
    return y, f'{y} hunt harvest summaries (Arizona Game and Fish Department)', src, H

CO_PAGES = [  # (species stats page, [file names in co_build.py, in page order])
    ('hunting-elk/elk-statistics', ['co_elk']),
    ('hunting-deer/deer-statistics', ['co_deer']),
    ('hunting-pronghorn/pronghorn-statistics', ['co_pronghorn']),
    ('hunting-moose/moose-statistics', ['co_moose']),
    ('hunting-bighorn-sheep/bighorn-sheep-statistics', ['co_sheep', 'co_dsheep']),  # Rocky Mountain first, then desert
    ('hunting-mountain-goat/mountain-goat-statistics', ['co_goat']),
    ('hunting-bear/bear-statistics', ['co_bear']),
]
CO_LABEL = {'co_elk': 'Elk', 'co_deer': 'Deer', 'co_pronghorn': 'Pronghorn', 'co_moose': 'Moose', 'co_sheep': 'Rocky Mountain Bighorn Sheep',
            'co_dsheep': 'Desert Bighorn Sheep', 'co_goat': 'Mountain Goat', 'co_bear': 'Bear'}

def co():
    found = {}
    for slug, names in CO_PAGES:
        idx = 'https://cpw.state.co.us/activities/hunting/big-game/' + slug
        hits = []
        for u, t in links(get(idx), idx):
            m = re.match(r'(\d{4}) Harvest Report$', re.sub(r'\s+', ' ', t).strip())
            if m and 'widencollective.com/assets/share' in u: hits.append((int(m.group(1)), u))
        if not hits: raise RuntimeError('no harvest report links on ' + idx)
        y = max(h[0] for h in hits)
        newest = [u for yy, u in hits if yy == y]
        if len(newest) < len(names): raise RuntimeError(f'{idx}: expected {len(names)} {y} reports, found {len(newest)}')
        for n, u in zip(names, newest): found[n] = (y, u)
    year = max(y for y, u in found.values())
    stale = [n for n, (y, u) in found.items() if y != year]
    if stale:
        print(f'co: {year} reports not out yet for {stale}; keeping the published year until all are out'); return None
    r = subprocess.run(['node', os.path.join(HERE, 'co_fetch.mjs'), RAW] + [f'{n}={u}' for n, (y, u) in found.items()], capture_output=True, text=True)
    print(r.stdout[-6000:])
    if r.returncode: raise RuntimeError('download failed: ' + (r.stdout + r.stderr)[-800:])
    for n in found:
        subprocess.run(['pdftotext', '-layout', os.path.join(RAW, n + '.pdf'), os.path.join(RAW, n + '.txt')], check=True)
    run('co_build.py')
    H = json.load(open(os.path.join(WORK, 'co_harvest_raw.json')))
    src = [{'label': f'CPW {year} {CO_LABEL[n]} Harvest Report', 'url': u} for n, (y, u) in found.items()]
    return year, f'{year} Big Game Harvest Survey (Colorado Parks and Wildlife), by hunt code', src, H

STATES = {'wy': wy, 'ut': ut, 'id': id_, 'or': or_, 'co': co, 'nm': nm, 'nv': nv, 'az': az}

# ---------- checks + write ----------
def check_and_write(st, year, survey, sources, H):
    path = os.path.join(REPO, 'data', 'harvest', st + '.json')
    old = json.load(open(path)) if os.path.exists(path) else None
    problems = []
    if not H: problems.append('no rows parsed')
    bad = [k for k, v in H.items() if v.get('s') is None or not 0 <= v['s'] <= 100 or v.get('h', 0) < 0]
    if bad: problems.append(f'{len(bad)} rows with impossible values, e.g. {bad[:3]}')
    if old:
        if year < old['year']: problems.append(f'found {year}, older than published {old["year"]}')
        if year == old['year'] and len(H) < 0.8 * len(old['hunts']): problems.append(f'only {len(H)} rows vs {len(old["hunts"])} published')
        if year > old['year'] and len(H) < 0.5 * len(old['hunts']): problems.append(f'new year has only {len(H)} rows vs {len(old["hunts"])}')
    if problems:
        print(f'{st}: NOT updated: ' + '; '.join(problems)); return False
    new = dict(old or {}); new.update({'state': st.upper(), 'year': year, 'survey': survey, 'sources': sources, 'hunts': H})
    new.setdefault('about', 's = percent success, h = hunters, k = animals harvested.')
    if old and old.get('hunts') == H and old.get('year') == year:
        print(f'{st}: no change'); return False
    new['checked'] = datetime.date.today().isoformat()
    json.dump(new, open(path, 'w'), separators=(',', ':'))
    print(f'{st}: updated to {year}, {len(H)} hunts'); return True

if __name__ == '__main__':
    todo = sys.argv[1:] or list(STATES)
    failed = []
    for st in todo:
        try:
            res = STATES[st]()
            if res: check_and_write(st, *res)
        except Exception as e:
            print(f'{st}: ERROR {e}'); failed.append(st)
    if failed: print('FAILED:', failed); sys.exit(1)
