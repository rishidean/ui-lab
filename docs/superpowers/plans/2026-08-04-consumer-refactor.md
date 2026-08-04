# Consumer Refactor Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Spec:
> `docs/superpowers/specs/2026-08-04-consumer-refactor-design.md` — the
> rename table and token contract there are normative; this plan
> sequences the work.

**Goal:** Decouple NavigationBar + BottomSheet from the lab app: canonical naming, generic attributed comments, theme.css token contract with Aurora/Ink presets, minimal shell toggle, four adoption fixes.

**Global constraints:** PressAndSlidePicker untouched. App changes only in service of decoupling. Frame-verify in both themes. `pnpm format` before each commit; Claude trailer on commits. Server loop per HANDOFF.

### Task 1: theme.css + component tokenization

- Create `client/src/theme/theme.css`: full commented token contract;
  `:root` = Aurora (current values, moved verbatim from index.css);
  `.dark` = Ink preset (new); `glass-nav`/`glass-overlay` move here;
  new component tokens for currently-hardcoded literals:
  `--nav-circle-bg`, `--nav-circle-border`, `--nav-circle-shadow`,
  `--utility-circle-bg`, `--utility-circle-border`, `--sheet-bg`,
  `--sheet-border`, `--sheet-grabber`, `--sheet-shadow-resting`,
  `--sheet-shadow-raised`, `--scrim`, `--scrim-light`, `--dock-wash`.
- Import in `main.tsx` (before index.css); delete moved blocks from
  index.css.
- Replace inline literals in NavigationBar.tsx (circle gradients,
  borders, shadows, dock wash, filter scrim) and BottomSheet.css
  (sheet glass, grabber, scrim, shadows) with the tokens (fallbacks kept
  in BottomSheet.css).
- Verify: `pnpm check && pnpm build`; capture Aurora baseline — pixel
  match with current look. Commit.

### Task 2: Naming sweep + comments + adoption fixes

- Renames per spec table (component, index.ts, demo data, stage,
  registry usage/tryIt, Overview headings), including
  `onCollapsedClick`, `navigationContextualActions`,
  `navigationUtilityActions`.
- Prune `isUtilityOpen` prop + branches; drop `label === "Filter"` in
  favor of `Action.isFilter`; export `ACTION_SHEET_CLEAROUT_MS` and
  `UTILITY_CLEAROUT_MS` from NavigationBar and use them in the stage.
- Strip dStil/WAJOR comments (6 files), attribution headers on the two
  components + two stages.
- Verify: check/build; grep gates
  (`dStil|WAJOR|Dstil|rightButton|tabActions|isUtilityOpen|label === "Filter"|onLogoClick`
  → zero in client/src); Aurora choreography regression captures
  (menu select, filter, workflow sheet, utility sheet). Commit.

### Task 3: Shell toggle + stage tokenization (Ink visible)

- ThemeContext: `switchable` in the shell; sun/moon toggle button in the
  LabShell header (persisted, existing localStorage path).
- Tokenize NavigationBarStage.css + BottomSheetStage.css canvases
  (#f5f5f5, white cards, glass literals → tokens); `.bs-demo` →
  `.sheet-demo`.
- Verify: full capture pass in Ink (stages, menu, filter, sheets,
  toggle button itself) + Aurora spot-check. Commit.

### Task 4: Docs + push

- HANDOFF.md: record the refactor (naming table pointer, theme system,
  clear-out constants); Overview terminology already updated in Task 2.
- `pnpm format && pnpm check`, commit, `git push origin main`.
