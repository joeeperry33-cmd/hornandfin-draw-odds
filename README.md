# hornandfin-draw-odds

Data behind the [Draw Odds tool](https://hornandfin.com/hunting-guides/draw-odds/) on Horn & Fin.

- `data/<state>.json` — last year's official elk and deer draw results (applicants and tags drawn by point level, residents and nonresidents), normalized from each state wildlife agency's published draw reports. Each file lists its sources.
- `data/rules.json` — how each state's point system works (used for the explainer panel).
- `wp/` — page content used to publish the guides on hornandfin.com.

Numbers are copied from public agency reports; where an agency doesn't publish who drew at each point level, the file says the figures are estimates. Always confirm in the current regulations.

## Harvest success (`data/harvest/<state>.json`)

Hunter success from each state's own post-season harvest survey, keyed by the same hunt ids as `data/<state>.json` so the tool can show "Hunter success" beside draw odds. `s` = percent success, `h` = hunters, `k` = animals taken (see each file's `about`). Parsers live in `scripts/harvest/` (they read the agency PDFs after `pdftotext -layout`).

- Wyoming: 2025 WGFD harvest reports (elk, deer, pronghorn, moose, sheep, goat, bison), matched by hunt area + license type.
- New Mexico: NMDGF hunter harvest reports by hunt code (elk, deer, pronghorn, bighorn sheep); public and private land rows of one hunt code are added together.
- Arizona: AZGFD hunt harvest summaries (elk, deer, pronghorn, bighorn sheep). The PDF links are listed in data/harvest/az_sources.json because azgfd.com blocks automated page checks; the PDFs are read from Arizona's file server. Hunt numbers carry over between years; a match needs the same units too, and a nearby number in the same block is used when a hunt was renumbered.
- Nevada: NDOW "Harvest by Unit Group" reports, matched to draw hunts by species, hunt type, weapon, units and season start; resident and nonresident rows added together.
- Colorado: 2025 CPW harvest reports, which since 2025 are published by hunt code (elk, deer, pronghorn, moose, sheep, goat, bear). Includes over-the-counter codes.
- Utah: 2025 preliminary big game harvest (all hunts by hunt number) plus 2025 bighorn sheep records.
- Idaho: 2025 controlled hunt harvest statistics from the IDFG Hunt Planner (HTML tables).
- Oregon: 2025 ODFW harvest summaries; rows for one hunt across several units are summed. Eastside deer hunts were renumbered for 2026, so few deer hunts match.

### Keeping it current

`scripts/harvest/refresh.py` finds the newest harvest report for Wyoming, Utah, Idaho, Oregon, New Mexico and Nevada, rebuilds the file, checks it (no impossible values, row count close to last time, never an older year) and only then writes it. GitHub Actions runs it weekly from February to June and monthly the rest of the year (`.github/workflows/harvest-refresh.yml`), commits any change and clears the jsDelivr cache. Colorado is included too: its report links are on the CPW species statistics pages, and the PDFs open in a JavaScript viewer, so the job opens each one in headless Chromium (`scripts/harvest/co_fetch.mjs`) to download it. No paid scraper is needed. CO only moves to a new year once all eight reports for that year are out.

## State hub summaries

`data/hub/<st>.json` holds, per species, the limited-draw hunts with the best hunter success last season
(at least 25 hunters) and, where the state publishes the points it took to draw, the best ones that took
2 points or fewer. `scripts/hub/build.py` builds them from `data/<st>.json` and `data/harvest/<st>.json`.
The `hub-build.yml` workflow rebuilds them on every push that changes draw or harvest data, and the
harvest refresh rebuilds them too. `tool/hub.js` renders the lists on the state hub pages:

```html
<div class="hf-hub-best" data-state="co" data-species="elk,deer,antelope,bear"></div>
<script src="https://cdn.jsdelivr.net/gh/joeeperry33-cmd/hornandfin-draw-odds@main/tool/hub.js" defer></script>
```

## National Compare hunts page

`data/national/<species>.json` lists every hunt in every state with the odds of drawing at point levels
0 to 30 (residents and nonresidents), applicants, tags, hunter success and flags (weapon, private land).
`scripts/national/build.js` builds it using the odds math copied at build time from `tool/hfo.js`, so the
compare page and the draw odds tool always agree. `tool/compare.js` renders the page (`<div id="hf-compare">`).
Both summaries are rebuilt by `hub-build.yml` and by the harvest refresh.

## License fees (data/fees)

`data/fees/<st>.json` holds each state's hunting license, required stamps and tag prices for residents and nonresidents, with links to the official fee pages. Each species has a default tag price and optional `rules` (a regex on the hunt name, first match wins) for antlerless, premium or multiseason tags. A `null` price means that group can't buy the tag (for example New Mexico antlerless elk for nonresidents).

The national build adds `c: [resident, nonresident]` (license + stamps + tag, whole dollars, no application or point fees) to each hunt, and the hub build adds it to the hub lists. The Compare hunts page uses it for the "Cheapest" sort and the "License + tag" column. Fees change about once a year: update the JSON and push; hub-build.yml rebuilds everything.

States with fees so far: AZ, CA, CO, ID, MT, NM, NV, OR, UT, WY (checked Nov 28 2026).
