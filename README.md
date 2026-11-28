# hornandfin-draw-odds

Data behind the [Draw Odds tool](https://hornandfin.com/hunting-guides/draw-odds/) on Horn & Fin.

- `data/<state>.json` — last year's official elk and deer draw results (applicants and tags drawn by point level, residents and nonresidents), normalized from each state wildlife agency's published draw reports. Each file lists its sources.
- `data/rules.json` — how each state's point system works (used for the explainer panel).
- `wp/` — page content used to publish the guides on hornandfin.com.

Numbers are copied from public agency reports; where an agency doesn't publish who drew at each point level, the file says the figures are estimates. Always confirm in the current regulations.

## Harvest success (`data/harvest/<state>.json`)

Hunter success from each state's own post-season harvest survey, keyed by the same hunt ids as `data/<state>.json` so the tool can show "Hunter success" beside draw odds. `s` = percent success, `h` = hunters, `k` = animals taken (see each file's `about`). Parsers live in `scripts/harvest/` (they read the agency PDFs after `pdftotext -layout`).

- Wyoming: 2025 WGFD harvest reports (elk, deer, pronghorn, moose, sheep, goat, bison), matched by hunt area + license type.
- Colorado: 2025 CPW harvest reports, which since 2025 are published by hunt code (elk, deer, pronghorn, moose, sheep, goat, bear). Includes over-the-counter codes.
- Utah: 2025 preliminary big game harvest (all hunts by hunt number) plus 2025 bighorn sheep records.
- Idaho: 2025 controlled hunt harvest statistics from the IDFG Hunt Planner (HTML tables).
- Oregon: 2025 ODFW harvest summaries; rows for one hunt across several units are summed. Eastside deer hunts were renumbered for 2026, so few deer hunts match.
