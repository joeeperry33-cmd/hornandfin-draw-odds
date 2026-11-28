"""Parse Arizona Game and Fish "<year> Harvest Summary" PDFs (pdftotext -layout) for elk,
deer, pronghorn and bighorn sheep. Reads $HF_WORK/raw/az_<species>.txt and writes
$HF_WORK/az_harvest_raw.json keyed by hunt number. Arizona keeps hunt numbers from year to
year, so a row is kept only when its unit also matches the draw hunt's unit."""
import re, json, os
WORK = os.environ.get('HF_WORK', 'harvest-work'); RAW = os.path.join(WORK, 'raw')
REPO = os.environ.get('HF_REPO', '.')
ROW = re.compile(r'^\s*(?P<unit>\S.*?)\s+(?P<no>\d{4})\s+(?P<rest>\d.*)$')
HUNTERS_COL = {'elk': 3, 'deer': 3, 'pronghorn': 3, 'sheep': 2}

def norm_units(t):
    t = t.upper().replace(' AND ', ',').replace('/', ',').replace(';', ',')
    t = re.sub(r'(\d+[A-Z]?)\s+(NORTH|SOUTH|EAST|WEST)\b', lambda m: m.group(1) + m.group(2)[0], t)
    return {u.lstrip('0') for u in re.findall(r'\b\d{1,2}[A-Z]{0,2}\b', t)}

rows = {}
for sp, col in HUNTERS_COL.items():
    p = os.path.join(RAW, f'az_{sp}.txt')
    if not os.path.exists(p): continue
    for ln in open(p, encoding='utf-8', errors='ignore'):
        m = ROW.match(ln)
        if not m or re.search(r'total|\d{5}', m.group('unit'), re.I) or m.group('no') in rows: continue
        tok = m.group('rest').split()
        pi = next((i for i, t in enumerate(tok) if t.endswith('%') or (t == '-' and i > col)), None)
        if pi is None or pi <= col: continue
        try:
            hunters = int(tok[col].replace(',', ''))
            harvest = 0 if tok[pi - 1] == '-' else int(tok[pi - 1].replace(',', ''))
            succ = 0.0 if tok[pi] == '-' else float(tok[pi].rstrip('%'))
        except ValueError:
            continue
        if hunters <= 0: continue
        rows[m.group('no')] = {'unit': m.group('unit'), 's': succ, 'h': hunters, 'k': harvest}

def draw_units(name):
    m = re.match(r'^(?:Units?\s+)?(.*?),\s*(?:Bull|Antlerless|Any|Cow|Desert|Rocky|Pronghorn|Buck|Doe|Spike|Bison|Youth)', name)
    return norm_units(m.group(1) if m else name.split(', ')[0])

def area(name):
    m = re.match(r'^(.*?Hunt Areas?)', name)
    return re.sub(r'\s+', ' ', m.group(1).lower().replace('hunt areas', 'hunt area')) if m else ''

def same(du, ru, name='', runit=''):
    if du and ru: return du == ru
    if not name: return True            # draw file has no description (tribal hunts): trust the number
    a = area(name)
    return bool(a) and a.split(' hunt area')[0].split(' and ')[0] in runit.lower()

draw = json.load(open(os.path.join(REPO, 'data', 'az.json')))
out, skipped, used = {}, [], set()
todo = []
for h in draw['hunts']:
    r = rows.get(h['id'])
    if r and same(draw_units(h['name']), norm_units(r['unit']), h['name'], r['unit']):
        used.add(h['id']); out[h['id']] = r
    else:
        todo.append(h)
# hunt numbers sometimes shift by a few within a block: take the nearest unused number with the same units
for h in todo:
    du = draw_units(h['name']); n = int(h['id'])
    cands = [(abs(int(no) - n), no) for no, r in rows.items() if no not in used and no[:2] == h['id'][:2]
             and abs(int(no) - n) <= 15 and h['name'] and same(du, norm_units(r['unit']), h['name'], r['unit'])]
    if not cands:
        skipped.append((h['id'], h['name'][:50])); continue
    no = min(cands)[1]; used.add(no); out[h['id']] = rows[no]
for hid, r in list(out.items()):
    e = {'s': r['s'], 'h': r['h'], 'k': r['k']}
    if r['h'] < 10: e['few'] = 1
    out[hid] = e
json.dump(out, open(os.path.join(WORK, 'az_harvest_raw.json'), 'w'))
print(len(rows), 'AZ rows,', len(out), 'matched to draw hunts;', len(skipped), 'draw hunts with no match', skipped[:8])
