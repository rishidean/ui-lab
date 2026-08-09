# Accessibility regression suites

Headless Playwright suites covering the 2026-08-04 accessibility pass
(spec: `docs/superpowers/specs/2026-08-04-accessibility-pass-design.md`):
inert containment, initial dialog focus, APG menu roving, filter
radiogroup, focus return on every surface, and `:focus-visible` rings.
`a11y-contrast.mjs` adds a permanent WCAG contrast check for the theme
presets from the 2026-08-09 theme-consistency pass (spec:
`.superpowers/sdd/2026-08-09-theme-consistency/`).

Each script prints `PASS`/`FAIL` per assertion and exits non-zero on any
failure.

## Running

From the repo root, against a production build on :4999 (the house
verification loop):

```bash
pnpm build
PORT=4999 node dist/index.js &
pnpm test:a11y
```

Or run one suite: `node scripts/a11y/a11y-menu.mjs`.

Run from the repo root — `a11y-focus-rings.mjs` writes zoomed ring
screenshots to `scripts/a11y/shots/` (gitignored) for visual reading.

| Suite                          | Covers                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `a11y-sheet.mjs`               | Workflow BottomSheet: initial focus, inert, Tab containment, Escape restore                                                         |
| `a11y-modal.mjs`               | Scan UtilityModal: same contract + focus return to the utility button                                                               |
| `a11y-menu.mjs`                | APG menu: roving arrows/Home/End, Enter select, Tab/Escape close + focus return                                                     |
| `a11y-filter.mjs`              | Filter radiogroup: roving without selecting, Enter select, chip focus return                                                        |
| `a11y-triggers.mjs`            | aria-haspopup/expanded on triggers, role=search, chip + button focus return                                                         |
| `a11y-assistant.mjs`           | Assistant mode: input focus on open, role=log/aria-live transcript, pending aria-hidden, Escape + focus return, session persistence |
| `a11y-focus-rings.mjs`         | :focus-visible rings on keyboard, none on pointer (reads screenshots)                                                               |
| `a11y-utility-modal-stage.mjs` | /utility-modal stage: focus return via focusWhenClear                                                                               |
| `a11y-bottom-sheet-stage.mjs`  | /bottom-sheet stage: focus return via focusWhenClear                                                                                |
| `a11y-contrast.mjs`            | WCAG contrast for the Bench light/dark presets: text scale + surface-overlay + select pill + accent-ink, both `:root` and `.dark`   |
