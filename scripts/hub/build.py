#!/usr/bin/env python3
"""Build small per-state summary files for the state hub pages on hornandfin.com.

Reads data/<st>.json (draw results) and data/harvest/<st>.json (hunter success)
and writes data/hub/<st>.json with the limited-draw hunts that had the best hunter
success last season, per species. The hub pages load these small files instead of
the full draw data, so they stay fast and update whenever the data changes.

Usage: python3 scripts/hub/build.py   (all states that have harvest data)
"""
import json, os, re, sys

REPO = os.environ.get('HF_REPO', '.')
MIN_HUNTERS = 25
TOP = 8


def pts_needed(v):
    """'3 Pref Points' -> 3, 'Choice 2' or 'Leftover' -> 0, unknown -> None."""
    if not v:
        return None
    v = str(v).strip()
    if v[:1].isdigit():
        return int(v.split()[0])
    if v.lower().startswith(('choice', 'leftover')):
        return 0
    return None


def easy_draw(r):
    """Drawable by residents or nonresidents with 2 points or fewer last year."""
    p = r.get('pts') or {}
    vals = [pts_needed(p.get('res')), pts_needed(p.get('nr'))]
    return any(v is not None and v <= 2 for v in vals)


def load_fees(st):
    p = os.path.join(REPO, 'data', 'fees', st + '.json')
    return json.load(open(p)) if os.path.exists(p) else None


def cost_of(fees, sp, name):
    """License + required stamps + tag, as [resident, nonresident] whole dollars (None if not sold)."""
    if not fees or sp not in fees.get('species', {}):
        return None
    e = fees['species'][sp]
    t = next((r for r in e.get('rules', []) if re.search(r['m'], name or '', re.I)), e)
    out = []
    for k in ('res', 'nr'):
        if t.get(k) is None:
            out.append(None)
            continue
        out.append(round(t[k] + sum(b.get(k) or 0 for b in fees.get('base', []))))
    return out


def main():
    hdir = os.path.join(REPO, 'data', 'harvest')
    out_dir = os.path.join(REPO, 'data', 'hub')
    os.makedirs(out_dir, exist_ok=True)
    for fn in sorted(os.listdir(hdir)):
        if not fn.endswith('.json'):
            continue
        st = fn[:-5]
        dpath = os.path.join(REPO, 'data', st + '.json')
        if not os.path.exists(dpath):
            continue
        harv = json.load(open(os.path.join(hdir, fn)))
        draw = json.load(open(dpath))
        hv = harv.get('hunts', {})
        fees = load_fees(st)
        by_sp = {}
        for h in draw.get('hunts', []):
            x = hv.get(h['id'])
            if not x or x.get('s') is None or (x.get('h') or 0) < MIN_HUNTERS or x.get('few'):
                continue
            row = {'id': h['id'], 'name': h.get('name', ''), 's': x['s'], 'h': x['h'], 'k': x.get('k')}
            if h.get('drawn_out'):
                row['pts'] = h['drawn_out']
            c = cost_of(fees, h.get('sp'), h.get('name'))
            if c:
                row['c'] = c
            by_sp.setdefault(h.get('sp', 'other'), []).append(row)
        species = {}
        for sp, rows in by_sp.items():
            rows.sort(key=lambda r: (-r['s'], -r['h']))
            entry = {'hunts_with_success': len(rows), 'top': rows[:TOP]}
            easy = [r for r in rows if easy_draw(r)]
            if easy:
                entry['easy'] = easy[:TOP]
            species[sp] = entry
        out = {
            'state': st,
            'harvest_year': harv.get('year'),
            'survey': harv.get('survey'),
            'draw_year': draw.get('year'),
            'min_hunters': MIN_HUNTERS,
            'species': species,
        }
        if fees:
            out['fees'] = {'year': fees.get('year'), 'sources': fees.get('sources'), 'note': fees.get('note', '')}
        path = os.path.join(out_dir, st + '.json')
        new = json.dumps(out, separators=(',', ':'), ensure_ascii=False)
        old = open(path).read() if os.path.exists(path) else None
        if new != old:
            open(path, 'w').write(new)
            print('wrote', path, {k: len(v['top']) for k, v in species.items()})
        else:
            print('unchanged', path)


if __name__ == '__main__':
    sys.exit(main())
