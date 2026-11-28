#!/usr/bin/env python3
"""Generate the HTML for the 50 state hub pages on hornandfin.com.

Inputs (all in this repo):
  data/shapes/states.json    state outlines (SVG paths, from us-atlas / Census, public domain)
  data/shapes/facts.json     motto, state animal, bird and fish
  data/shapes/agencies.json  state wildlife agency name and homepage
  data/flags/<st>.webp       state flags (public domain, Wikimedia Commons via region-flags)
  scripts/hub/guides.json    existing Horn & Fin guide pages for each state
  scripts/hub/counts.json    listing counts per state (optional)
  data/<st>.json, data/hub/<st>.json   draw odds and hunter success, when the state has them

Output: hub-pages/<st>.html (the page body for WordPress, one Custom HTML block).
Usage: python3 scripts/hub/make_pages.py [st ...]
"""
import html, json, os, re, sys

REPO = os.environ.get('HF_REPO', '.')
OUT = os.environ.get('HF_HUB_OUT', os.path.join(REPO, 'hub-pages'))
CDN = 'https://cdn.jsdelivr.net/gh/joeeperry33-cmd/hornandfin-draw-odds@main/'
SPN = {'elk': 'elk', 'deer': 'deer', 'antelope': 'pronghorn', 'moose': 'moose', 'sheep': 'bighorn sheep',
       'goat': 'mountain goat', 'bison': 'bison', 'bear': 'black bear', 'brown_bear': 'brown bear',
       'caribou': 'caribou', 'turkey': 'turkey', 'crane': 'sandhill crane', 'swan': 'tundra swan',
       'sage_grouse': 'sage-grouse', 'sharptail': 'sharp-tailed grouse', 'alligator': 'alligator',
       'paddlefish': 'paddlefish', 'sturgeon': 'lake sturgeon'}
ORDER = list(SPN)


def load(p, default=None):
    p = os.path.join(REPO, p)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else default


def e(s):
    return html.escape(str(s), quote=True)


def slug(name):
    return name.lower().replace(' ', '-')


def join(words):
    words = list(words)
    if len(words) <= 1:
        return ''.join(words)
    return ', '.join(words[:-1]) + ' and ' + words[-1]


def short(title):
    return re.sub(r'\s*\((?:and |Step|[^)]*Explained)[^)]*\)\s*$', '', title).strip()


CSS = """<style>
.hf-guide .hf-hub-hero{display:flex;align-items:center;gap:26px;background:#1A2312;border-radius:16px;padding:26px 30px;margin:0 0 14px;color:#fff;overflow:hidden}
.hf-guide .hf-hub-map{flex:0 0 190px;width:190px;height:auto;max-height:190px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.35))}
.hf-guide .hf-hub-hero p{margin:0}
.hf-guide .hf-hub-eyebrow{font:700 14px "Barlow Condensed",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#E8641B}
.hf-guide .hf-hub-title{font:800 64px/.95 "Barlow Condensed",sans-serif;text-transform:uppercase;color:#fff;margin:4px 0 8px!important}
.hf-guide .hf-hub-sub{font-size:17px;line-height:1.45;color:#E9E2D3;max-width:460px}
.hf-guide .hf-hub-facts{display:grid;grid-template-columns:120px repeat(4,minmax(0,1fr));gap:0;background:#fff;border:1px solid #E3D9C6;border-radius:14px;margin:0 0 1.6em;overflow:hidden}
.hf-guide .hf-hub-flag{display:flex;align-items:center;justify-content:center;padding:14px;background:#FBF8F2;border-right:1px solid #F0E9DB}
.hf-guide .hf-hub-flag img{width:100%;height:auto;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.18)}
.hf-guide .hf-hub-fact{padding:14px 16px;border-right:1px solid #F0E9DB}
.hf-guide .hf-hub-fact:last-child{border-right:0}
.hf-guide .hf-hub-fact b{display:block;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#8A7F6A;margin:0 0 4px}
.hf-guide .hf-hub-fact span{display:block;font-size:15px;line-height:1.35;color:#1A2312;font-weight:600}
.hf-guide .hf-hub-fact i{display:block;font-size:13px;color:#6B6252;font-weight:400;margin-top:2px}
.hf-guide .hf-hub-jump{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 1.6em;padding:0;list-style:none}
.hf-guide .hf-hub-jump li{margin:0}
.hf-guide .hf-hub-jump a{display:inline-block;padding:7px 14px;border:1px solid #E3D9C6;border-radius:999px;background:#fff;color:#1A2312;text-decoration:none;font:700 14px "Barlow Condensed",sans-serif;letter-spacing:.06em;text-transform:uppercase}
.hf-guide .hf-hub-jump a:hover{border-color:#E8641B;color:#E8641B}
.hf-guide .hf-sg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:0 0 1.6em}
.hf-guide .hf-sg-card{background:#fff;border:1px solid #E3D9C6;border-radius:14px;padding:18px 20px}
.hf-guide .hf-sg-card h3{margin:0 0 8px;font:800 26px/1.05 "Barlow Condensed",sans-serif;text-transform:uppercase;color:#1A2312}
.hf-guide .hf-sg-card ul{list-style:none;margin:0 0 10px;padding:0}
.hf-guide .hf-sg-card li{margin:0;padding:7px 0;border-top:1px solid #F0E9DB}
.hf-guide .hf-sg-card li:first-child{border-top:0}
.hf-guide .hf-sg-card li a{text-decoration:none;color:#1A2312;font-weight:600}
.hf-guide .hf-sg-card li a::after{content:" \\203A";color:#E8641B}
.hf-guide .hf-sg-card li a:hover{color:#E8641B}
.hf-guide .hf-sg-card p{margin:0 0 10px;font-size:15px;color:#4A4336}
.hf-guide a.hf-sg-out{font:700 14px "Barlow Condensed",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#C4561A;text-decoration:none}
.hf-guide h2[id]{scroll-margin-top:90px}
body:has(.hf-hub-hero) .page-header{display:none}
@media (max-width:760px){.hf-guide .hf-hub-facts{grid-template-columns:1fr 1fr!important}.hf-guide .hf-hub-flag{grid-column:1/-1;border-right:0;border-bottom:1px solid #F0E9DB}.hf-guide .hf-hub-flag img{max-width:160px}.hf-guide .hf-hub-fact{border-bottom:1px solid #F0E9DB}}
@media (max-width:640px){.hf-guide .hf-sg-grid{grid-template-columns:1fr}.hf-guide .hf-hub-hero{flex-direction:column;align-items:flex-start;gap:14px;padding:20px}.hf-guide .hf-hub-map{width:130px;flex-basis:auto}.hf-guide .hf-hub-title{font-size:48px}}
</style>"""


def hero(st, name, shape, sub):
    d, vb = shape['d'], shape['vb']
    cid = 'hfst-clip-' + st
    pid = 'hfst-topo-' + st
    return (f'<div class="hf-hub-hero"><svg class="hf-hub-map" viewBox="{vb}" role="img" aria-label="Outline of {e(name)}">'
            f'<defs><clipPath id="{cid}"><path d="{d}"/></clipPath><pattern id="{pid}" width="40" height="22" patternUnits="userSpaceOnUse">'
            f'<path d="M0 11 Q10 3 20 11 T40 11" fill="none" stroke="#E8641B" stroke-opacity=".28" stroke-width="1.2"/></pattern></defs>'
            f'<path d="{d}" fill="#24301A"/><rect x="-50" y="-50" width="300" height="300" fill="url(#{pid})" clip-path="url(#{cid})"/>'
            f'<path d="{d}" fill="none" stroke="#E8641B" stroke-width="2.5" stroke-linejoin="round"/></svg>'
            f'<div><p class="hf-hub-eyebrow">State hub</p><p class="hf-hub-title">{e(name)}</p><p class="hf-hub-sub">{e(sub)}</p></div></div>')


def facts_strip(st, name, f):
    cells = []
    if f.get('motto'):
        m = f'<span>{e(f["motto"])}</span>' + (f'<i>{e(f["motto_en"])}</i>' if f.get('motto_en') else '')
        cells.append(('State motto', m))
    for k, lab in (('animal', 'State animal'), ('bird', 'State bird'), ('fish', 'State fish')):
        if f.get(k):
            cells.append((lab, f'<span>{e(f[k])}</span>'))
    cells = cells[:4]
    h = f'<div class="hf-hub-facts" style="grid-template-columns:120px repeat({len(cells)},minmax(0,1fr))"><div class="hf-hub-flag"><img src="{CDN}data/flags/{st}.webp" alt="Flag of {e(name)}" width="300" height="200" loading="lazy"></div>'
    for lab, v in cells:
        h += f'<div class="hf-hub-fact"><b>{lab}</b>{v}</div>'
    return h + '</div>'


def search_hunt(name, extra=''):
    return f'https://hornandfin.com/adv-search-page/search-results/?query=all&amp;jr_statehunting={slug(name)}{extra}&amp;dir=1&amp;criteria=11&amp;order=featured'


def search_dir(name, d):
    return f'https://hornandfin.com/adv-search-page/search-results/?query=all&amp;jr_state={slug(name)}&amp;dir={d}'


def build(st, A, F, S, G, C):
    ag = A[st]
    name = ag['state']
    draw = load(f'data/{st}.json')
    hubd = load(f'data/hub/{st}.json')
    guides = (G.get(st) or {}).get('guides', [])
    points = (G.get(st) or {}).get('points')
    cnt = C.get(st, {})
    sps = []
    if draw:
        for h in draw.get('hunts', []):
            if h['sp'] not in sps:
                sps.append(h['sp'])
        sps.sort(key=lambda s: ORDER.index(s) if s in ORDER else 99)
    game = [SPN.get(s, s) for s in sps][:4]
    if game:
        sub = f'{join([g.capitalize() if i == 0 else g for i, g in enumerate(game)])} draw odds, fishing, and the guides and outfitters who work in {name}.'
    else:
        sub = f'Hunting, fishing, and the guides and outfitters who work in {name}.'

    parts = ['<!-- wp:html -->', '<div class="wp-block-group hf-guide is-layout-constrained wp-block-group-is-layout-constrained">', CSS]
    parts.append(hero(st, name, S[st], sub))
    parts.append(facts_strip(st, name, F.get(st, {})))

    have = []
    intro = [f'Everything Horn &amp; Fin has on {e(name)} in one place']
    if guides:
        have.append('our hunting guides')
    if draw:
        have.append("last season's draw odds" + (' and hunter success' if hubd else ''))
    have.append('fishing links')
    have.append('the guides and outfitters who work here')
    parts.append(f'<p>{intro[0]}: {join(have)}.</p>')

    jump = []
    if guides:
        jump.append(('hunting', 'Hunting guides'))
    if draw:
        jump.append(('draw', 'Draw odds' + (' &amp; success' if hubd else '')))
    jump += [('fishing', 'Fishing'), ('outfitters', 'Find a guide'), ('official', 'Official links')]
    parts.append('<ul class="hf-hub-jump">' + ''.join(f'<li><a href="#{a}">{b}</a></li>' for a, b in jump) + '</ul>')

    if guides:
        parts.append(f'<h2 id="hunting">{e(name)} hunting guides</h2><div class="hf-sg-grid">')
        for g in guides:
            label = {'elk': 'Elk', 'deer': 'Mule deer' if 'mule' in g['url'] else 'Deer', 'all': 'Big game'}.get(g['sp'], g['sp'].title())
            extra = {'elk': '&amp;jr_biggamespecies=elk&amp;usematch=1', 'deer': ''}.get(g['sp'], '')
            li = f'<li><a href="{g["url"]}">{e(short(g["title"]))}</a></li>' + ''.join(
                f'<li><a href="{c["url"]}">{e(short(c["title"]))}</a></li>' for c in g['children'])
            parts.append(f'<div class="hf-sg-card"><h3>{label}</h3><ul>{li}</ul>'
                         f'<a class="hf-sg-out" href="{search_hunt(name, extra)}">{e(name)} {label.lower()} outfitters →</a></div>')
        parts.append('</div>')

    if draw:
        parts.append(f'<h2 id="draw">Draw odds{" and hunter success" if hubd else ""}</h2>')
        if hubd:
            hs = [s for s in ORDER if s in hubd['species'] and len(hubd['species'][s]['top']) >= 3][:4]
            parts.append(f'<p>Last season\'s limited hunts in {e(name)} with the best hunter success'
                         + (', and the best ones that took 2 points or fewer to draw' if any('easy' in hubd['species'][s] for s in hs) else '')
                         + '. Tap any hunt to see the full draw results for its unit.</p>')
            parts.append(f'<div class="hf-hub-best" data-state="{st}" data-species="{",".join(hs)}"></div>')
        pts = f' New to the draw here? Read <a href="{points["url"]}">{e(short(points["title"]))}</a>.' if points else ''
        parts.append(f'<div class="hf-cta"><p class="hf-cta-eyebrow">Draw odds tool</p><p class="hf-cta-title">What are your odds in {e(name)}?</p>'
                     f'<p class="hf-cta-text">Every {e(name)} {e(join(game))} hunt in our draw odds tool, with last year\'s official results for residents and nonresidents.{pts}</p>'
                     f'<p class="hf-cta-btn-wrap"><a class="hf-cta-btn" href="/hunting-guides/draw-odds/?state={st}&amp;species={sps[0]}">Open {e(name)} draw odds</a></p></div>')
        parts.append('<p>Want to compare states? <a href="/hunting-guides/compare-hunts/">Compare hunts across the country</a> by draw odds and hunter success.</p>')

    fish_n = cnt.get('fish')
    parts.append(f'<h2 id="fishing">Fishing in {e(name)}</h2><div class="hf-sg-grid">'
                 f'<div class="hf-sg-card"><h3>Where the fish are</h3><ul><li><a href="{e(ag["url"])}" target="_blank" rel="noopener">{e(ag["name"])}: fishing, licenses and stocking</a></li>'
                 f'<li><a href="/ultimate-hunting-fishing-resource/">Field Kit: stocking alerts and trip tools</a></li></ul></div>'
                 f'<div class="hf-sg-card"><h3>Fishing guides</h3><p>{(str(fish_n) + " fishing guides and charters listed in " + e(name) + ".") if fish_n else "Fishing guides and charters in " + e(name) + "."}</p>'
                 f'<a class="hf-sg-out" href="{search_dir(name, 2)}">{e(name)} fishing guides →</a></div></div>')

    hunt_n = cnt.get('hunt')
    parts.append(f'<h2 id="outfitters">Find a guide in {e(name)}</h2><div class="hf-sg-grid">'
                 f'<div class="hf-sg-card"><h3>Hunting outfitters</h3><p>{(str(hunt_n) + " hunting guides and outfitters listed in " + e(name) + ".") if hunt_n else "Hunting guides and outfitters in " + e(name) + "."}</p>'
                 f'<a class="hf-sg-out" href="{search_hunt(name)}">All {e(name)} outfitters →</a></div>'
                 f'<div class="hf-sg-card"><h3>Taxidermy</h3><p>Taxidermists near where you hunt and fish.</p>'
                 f'<a class="hf-sg-out" href="{search_dir(name, 3)}">{e(name)} taxidermists →</a></div></div>')

    parts.append(f'<h2 id="official">Official {e(name)} links</h2><ul><li><a href="{e(ag["url"])}" target="_blank" rel="noopener">{e(ag["name"])}</a></li></ul>')
    if draw:
        parts.append(f'<p style="font-size:14px;color:#6B6252">Draw results{" and hunter success" if hubd else ""} come from the {e(ag["name"])} and update automatically when new numbers are published.</p>')
    parts.append('</div>')
    if hubd:
        parts.append(f'<script src="{CDN}tool/hub.js" defer></script>')
    parts.append('<!-- /wp:html -->')
    return '\n'.join(parts) + '\n'


def main(argv):
    A = load('data/shapes/agencies.json')
    F = load('data/shapes/facts.json', {})
    S = load('data/shapes/states.json')
    G = load('scripts/hub/guides.json', {})
    C = load('scripts/hub/counts.json', {})
    os.makedirs(OUT, exist_ok=True)
    sts = argv or sorted(A)
    for st in sts:
        open(os.path.join(OUT, st + '.html'), 'w', encoding='utf-8').write(build(st, A, F, S, G, C))
    print('wrote', len(sts), 'pages to', OUT)


if __name__ == '__main__':
    main(sys.argv[1:])
