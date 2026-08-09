# Sheet Morph Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every sheet surface (workflow sheets, Export) launches from the full bar via the search-style recede — one clear-out grammar replaces two, and the inward sweep is deleted.

**Architecture:** `NavigationBar` gets a single `isSheetOpen` clear-out (circles recede as in search/assistant, pill labels fade, glass stays). The stage measures the pill AFTER the recede and mounts `BottomSheet` with that full-width origin; `BottomSheet` gains a derived skip-widen check so a full-width origin goes straight to the vertical stretch. Scan keeps its circle-reveal takeover but rides the same recede clear-out (the old sweep no longer exists). Spec: `docs/superpowers/specs/2026-08-09-sheet-morph-unification-design.md`.

**Tech Stack:** React 18, TypeScript, motion/react, Tailwind + theme.css tokens, Playwright a11y scripts, pnpm.

## Global Constraints

- Verification loop per task: `pnpm check` clean AND `npx prettier --check` clean on every touched file. Full a11y harness (`pnpm build`, `PORT=4999 node dist/index.js`, `pnpm test:a11y`) runs in Tasks 4–5.
- All bar-side timing through the existing `dur()`/`del()` helpers (× `TEMPO`, 0 under reduced motion) and `EASE`/`EASE_OUT`/`EASE_IN`. Ease-out for reveals, ease-in for collapses.
- Breaking renames are in scope: `isSheetOpen` replaces `isActionSheetOpen`/`isUtilitySheetOpen`; `SHEET_CLEAROUT_MS` replaces `ACTION_SHEET_CLEAROUT_MS`/`UTILITY_CLEAROUT_MS`. The demo stage is the only consumer.
- BottomSheet's public contract is unchanged — the skip-widen is a derived internal check, NO new prop.
- Execution happens in an isolated worktree (SDD setup). NOTE: the main checkout carries uncommitted picker edits to `client/src/lab/registry.tsx` — the worktree keeps them out of these commits; never run this plan directly in the main checkout.
- Comment style: match each file's voice. The motion comment-tables in NavigationBar.tsx are documentation — Task 5 rewrites them to exactly three grammars (bar-internal morph / sheet launch / takeover).
- Line numbers below are from commit `0aa694e`; anchor on code, not numbers.

---

### Task 1: NavigationBar — unified sheet clear-out, inward sweep deleted

**Files:**
- Modify: `client/src/components/navigation-bar/NavigationBar.tsx`
- Modify: `client/src/components/navigation-bar/index.ts`

**Interfaces:**
- Consumes: existing `isBarInputMode` predicate, `dur`/`del`, circle transition chains.
- Produces (later tasks rely on these exact names): prop `isSheetOpen?: boolean`; export `SHEET_CLEAROUT_MS: number`; internal `sheetClosing` falling-edge flag; internal `SHEET_DELAYS` table.

- [ ] **Step 1: Replace the delay tables and clear-out constants**

Delete the `UTILITY_SHEET_DELAYS` block (~line 229) and the two clear-out constants (~lines 245–261, including their comment block). In their place:

```ts
// ── Sheet launch — ONE clear-out for every sheet surface (workflow
//    sheets and Export) and for the Scan takeover, replacing the old
//    fade-in-place and sweep-into-the-button grammars:
//    1. pressed feedback on the control,
//    2. both circles recede exactly as search/assistant open them,
//       while the pill's labels fade — the full-width glass stays put
//       as the seed the surface grows out of,
//    3. the consumer waits SHEET_CLEAROUT_MS, measures the pill (its
//       rect now spans the full row), and mounts the surface.
//    Close reverses: the surface contracts onto the bar, labels fade
//    back, then the circles dot the ends (search-close's return).
const SHEET_DELAYS = {
  labelFade: 0.05, // labels leave just after the recede begins
  closeLabelsFadeIn: 0.0, // surface has landed; labels return first
  closeCirclesIn: 0.18, // then the circles dot the ends
};

// Consumers flip isSheetOpen, wait this window, then measure the bar
// and mount their surface. Derived from the recede band (0.25) + a
// breath, × TEMPO — retuning the bar keeps launch timing in sync.
export const SHEET_CLEAROUT_MS = Math.round((0.25 + 0.06) * TEMPO * 1000);
```

- [ ] **Step 2: Replace the props**

In `NavigationBarProps` (~lines 344–356) delete `isActionSheetOpen` and `isUtilitySheetOpen` (and their comments); add:

```ts
/** Sheet clear-out: both circles recede (search-style) and the pill's
 *  labels fade, leaving the full-width glass as the surface a sheet or
 *  takeover grows out of. Flip this, wait SHEET_CLEAROUT_MS, then
 *  measure the bar and mount the surface. */
isSheetOpen?: boolean;
```

Update the destructuring (~lines 389–390): `isSheetOpen = false,` replaces both defaults.

- [ ] **Step 3: Rewire every conditional**

Work through each anchor; the rule is mechanical — recede like search, no sweep:

1. ~line 685 (assistant absorb-clamp): `!isUtilitySheetOpen && !isActionSheetOpen` → `!isSheetOpen`.
2. ~line 731 (exclusivity effect): condition and deps become `isSheetOpen`.
3. ~lines 749–757 (action-chip focus return): falling edge tracks `isSheetOpen`.
4. ~lines 759–764: DELETE the `utilitySheetClosing` machinery; add in its place:

```ts
const prevSheetOpenRef = useRef(isSheetOpen);
useEffect(() => {
  prevSheetOpenRef.current = isSheetOpen;
}, [isSheetOpen]);
const sheetClosing = !isSheetOpen && prevSheetOpenRef.current;
```

5. `centerPillTransition` (~lines 1267–1296): DELETE the `isUtilitySheetOpen`/`utilitySheetClosing` branches from `scaleX`, the `originX` hold, and the `opacity` chain — the pill no longer changes shape for sheets. The pill's `animate` (~lines 1812–1822): remove `isUtilitySheetOpen` from the `opacity`/`scaleX` conditions and delete `originX: isUtilitySheetOpen ? 1 : 0` (originX is only flipped by menu/scroll absorbs now — keep the `originX: 0` base).
6. Utility-button transitions (~lines 1430–1447): replace the `isActionSheetOpen`/`isUtilitySheetOpen`/`utilitySheetClosing` opacity cases with recede/return: receding uses the same treatment as `isBarInputMode` (it's now IN `isBarInputMode`-style width/scale/opacity conditions — see step 7), returning uses `rightDotIn(SHEET_DELAYS.closeCirclesIn)` gated on `sheetClosing`.
7. Circle layout conditions: everywhere the left/right containers key on `isBarInputMode` for `width`/`scale`/`opacity`/`pointerEvents` (~lines 1506, 1517, 1803–1816, 2359–2390), the predicate becomes `isBarInputMode || isSheetOpen`. Define once, near `isBarInputMode`:

```ts
// Sheets and takeovers borrow the input modes' recede: circles leave,
// the pill hands its full width to the incoming surface.
const isBarSurrendered = isBarInputMode || isSheetOpen;
```

and use `isBarSurrendered` at those sites. Left-circle transition (~lines 1524–1538): delete the `isActionSheetOpen`/`isUtilitySheetOpen`/`utilitySheetClosing` cases; receding takes the default 0.25 band; returning gets a `sheetClosing` case `{ duration: dur(0.25), ease: EASE, delay: del(SHEET_DELAYS.closeCirclesIn) }`.
8. Action-chip + divider fades (~lines 2257–2299): `isActionSheetOpen` → `isSheetOpen`, delay `del(isSheetOpen ? SHEET_DELAYS.labelFade : sheetClosing ? SHEET_DELAYS.closeLabelsFadeIn : 0)`.
9. aria-expanded (~line 2407): `utilityAction.opensDialog ? isSheetOpen : undefined`.
10. Grep for any straggler: `grep -n "isActionSheetOpen\|isUtilitySheetOpen\|utilitySheetClosing\|UTILITY_SHEET_DELAYS" NavigationBar.tsx` must return zero hits.

- [ ] **Step 4: Update the barrel**

`index.ts`: export `SHEET_CLEAROUT_MS`, remove the two old constants.

- [ ] **Step 5: Verify and commit**

`pnpm check` will FAIL in the stage (old prop names) — that's Task 3's job. To keep this task independently verifiable, Task 1 and Task 3 land as ONE commit series in the same dispatch is NOT allowed; instead: make the stage compile minimally in THIS task by renaming its usages mechanically (`isActionSheetOpen={sheetPrep}` + `isUtilitySheetOpen={utilSheetPrep}` → `isSheetOpen={sheetPrep || utilSheetPrep}`, and the two imported constants → `SHEET_CLEAROUT_MS`). The stage's real convergence (single helper, mount-time measuring) is still Task 3. After: `pnpm check` clean, prettier clean on touched files.

```bash
git add client/src/components/navigation-bar/ client/src/stages/NavigationBarStage.tsx
git commit -m "feat: one sheet clear-out — circles recede, inward sweep deleted"
```

---

### Task 2: BottomSheet — skip-widen for full-width origins

**Files:**
- Modify: `client/src/components/bottom-sheet/BottomSheet.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: no API change; entrance behavior derived from `origin.width`.

- [ ] **Step 1: Add the derived check and entrance transition split**

The entrance currently runs `left/width/borderRadius` on the WIDEN beat and `bottom/height` at `STRETCH_AT` (read the `animate` transition block below ~line 240 for the exact per-property table). Add after `finalWidth`/`finalLeft` (~line 107):

```ts
// A full-width origin (the NavigationBar's receded pill) has nothing
// to widen — the widen beat would be a ~240ms no-op delaying the
// stretch. Skip straight to the vertical growth; small origins
// (buttons, chips) keep the two-beat entrance.
const originFullWidth = origin.width >= finalWidth - 8;
const stretchAt = originFullWidth ? 0.06 : STRETCH_AT;
const settleDur = originFullWidth ? 0.18 : WIDEN;
```

In the entrance transition table: `left`/`width` use `duration: settleDur` (delay 0); `borderRadius`/`boxShadow` likewise; `bottom`/`height` start at `stretchAt`. Title beat: `titleAt = stretchAt + STRETCH` replaces `TITLE_AT`; body beat `bodyAt = titleAt + 0.14 + 0.06` replaces `BODY_AT` — compute both next to `stretchAt` and use them in the header/body reveal transitions. The scrim's `delay` (~line 184) becomes `stretchAt`.

- [ ] **Step 2: Verify the standalone page is unaffected**

`/bottom-sheet` stage origins are buttons (width « finalWidth), so `originFullWidth` is false there — confirm by reading `client/src/stages/BottomSheetStage.tsx`'s origin capture, not by assumption. `pnpm check` + prettier clean.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/bottom-sheet/BottomSheet.tsx
git commit -m "feat: BottomSheet skips the widen beat for full-width origins"
```

---

### Task 3: Stage convergence — one openSheet path, mount-time measuring

**Files:**
- Modify: `client/src/stages/NavigationBarStage.tsx`

**Interfaces:**
- Consumes: `isSheetOpen` / `SHEET_CLEAROUT_MS` (Task 1), skip-widen behavior (Task 2).
- Produces: the demo behavior Tasks 4–5 verify.

- [ ] **Step 1: Merge the prep flags and converge the launch paths**

Replace `sheetPrep` + `utilSheetPrep` with one `sheetPrep` boolean driving `isSheetOpen={sheetPrep}`. Replace the action-press mount logic (~lines 490–520), `openUtilitySheet` (~231), and Scan's `openUtility` (~278) clear-out phase with one helper:

```ts
// One launch for every bar surface: flip the clear-out, wait for the
// recede, THEN measure the pill — its rect now spans the full row —
// and mount. (Press-time measuring would bake in the narrower
// pre-recede rect.)
const launchFromBar = useCallback(
  (mount: () => void) => {
    setSheetPrep(true);
    if (prepTimer.current) clearTimeout(prepTimer.current);
    prepTimer.current = setTimeout(
      mount,
      prefersReducedMotion ? 0 : SHEET_CLEAROUT_MS
    );
  },
  [prefersReducedMotion]
);
```

- Workflow action press: guards as today, `setActiveAction(label)`, then `launchFromBar(() => { setSheetOrigin(measureBar()); setOpenSheet(label); })`.
- Export: guards, `launchFromBar(() => { setUtilSheetOrigin(measureBar()); setUtilSheet("export"); })`.
- Scan: guards, capture the utility button's CENTER at press time (the reveal origin — the button is gone post-recede), then `launchFromBar(() => setUtility("scan"))`.

`measureBar()` reads `actionBarRef.current?.getBoundingClientRect()` with the existing fallback literal, converted to `SheetOrigin`.

- [ ] **Step 2: Close paths and cleanup**

Every `onExitComplete` that set the old prep flags false now sets the single `sheetPrep` false. `overlayOpenRef` disjunction: one `sheetPrep` term. Delete `utilPrepTimer` (one timer suffices — surfaces are exclusive). Update the stage's header comment and the `onUtilityClick` routing comment to the three-grammar model.

- [ ] **Step 3: Verify, commit**

`pnpm check` + prettier clean. Manual smoke via `pnpm build && PORT=4999 node dist/index.js` + a quick headless script (Playwright, throwaway in the SDD workspace): click Deposit → sheet appears; Done → bar restores; Export and Scan likewise.

```bash
git add client/src/stages/NavigationBarStage.tsx
git commit -m "feat: stage launches every surface from the receded bar"
```

---

### Task 4: A11y harness — full run, retune waits, choreography assertions

**Files:**
- Modify: `scripts/a11y/a11y-sheet.mjs`, `scripts/a11y/a11y-triggers.mjs`, `scripts/a11y/a11y-bottom-sheet-stage.mjs` (only if failing)
- Throwaway: geometry script in the SDD workspace (not committed)

- [ ] **Step 1: Full harness against a production build**

`pnpm build`, `PORT=4999 node dist/index.js &`, `pnpm test:a11y`. The clear-out SHORTENED (~390ms vs ~680ms), so existing generous waits (1500–1600ms) should still pass. Fix any failure at its cause: timing waits may come DOWN, assertions must not be weakened. `a11y-triggers.mjs` asserts Export/Scan `aria-expanded` — now driven by `isSheetOpen`; semantics unchanged, so no assertion edits expected.

- [ ] **Step 2: Throwaway choreography checks (spec's verification list)**

Headless script asserting: (a) post-recede origin ≈ pill row width (mount a sheet, read its rect at first frame vs. the bar's row width); (b) stretch starts immediately for bar launches (sheet height grows within 2 frames of mount); (c) close order — sheet lands on the bar rect before the circles reach full opacity. Print PASS/FAIL; keep in `.superpowers/sdd/`, do not commit.

- [ ] **Step 3: Commit any suite retunes**

```bash
git add scripts/a11y/
git commit -m "test: retune a11y waits for the shorter sheet clear-out"
```

---

### Task 5: Docs — three-grammar comment tables, Overview, registry sample

**Files:**
- Modify: `client/src/components/navigation-bar/NavigationBar.tsx` (comment tables only)
- Modify: `NavigationBarOverview.md`
- Modify: `client/src/lab/registry.tsx` (navigation sample-code block only — the file carries unrelated picker regions; touch nothing outside the navigation sample)

- [ ] **Step 1: Rewrite the motion comment-tables**

The bar's grammar comments (the block above the delay tables, and the utility-surfaces comments) describe exactly three grammars: bar-internal morph (Search, Assistant — the pill itself is the surface), sheet launch (workflow sheets, Export, and Scan's clear-out — recede, then the surface grows from the bar), takeover reveal (Scan's UtilityModal — circle-reveal from the pressed button's center). Delete every stale reference to the sweep or the two-flag model.

- [ ] **Step 2: Overview + registry sync**

`NavigationBarOverview.md`: the Utility surfaces and choreography sections describe the unified launch; every `ACTION_SHEET_CLEAROUT_MS`/`UTILITY_CLEAROUT_MS` mention becomes `SHEET_CLEAROUT_MS`; the "bar sweeps into the button" narrative is replaced by the recede. `registry.tsx` navigation sample: the imported-constants comment (~line 43) and the utility routing comments reflect `isSheetOpen`/`SHEET_CLEAROUT_MS`.

- [ ] **Step 3: Final verify, commit**

`pnpm check`, prettier on touched files, one last `pnpm test:a11y` run green.

```bash
git add client/src/components/navigation-bar/NavigationBar.tsx NavigationBarOverview.md client/src/lab/registry.tsx
git commit -m "docs: three-grammar motion tables; Overview + registry sync"
```

---

## Self-Review Notes

- **Spec coverage:** API replacement (T1), recede grammar + delete sweep (T1), skip-widen contingency (T2), mount-time origin + openSheet convergence (T3), Scan-on-the-recede resolution (T3, resolving the spec's "Scan stays as-is" against the sweep deletion — the REVEAL is what stays), a11y + choreography verification (T4), three-grammar docs (T5).
- **Type consistency:** `isSheetOpen`/`SHEET_CLEAROUT_MS`/`sheetClosing`/`SHEET_DELAYS`/`isBarSurrendered` named identically across tasks; `launchFromBar`/`measureBar` are Task 3-local.
- **Judgment calls for implementers:** exact `SHEET_DELAYS` values and the skip-widen `settleDur` may need ±0.05 tuning by eye; beat ORDER is fixed. Task 1's temporary stage shim is deliberately mechanical — Task 3 owns the real convergence.
