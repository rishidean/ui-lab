# NavigationBar Assistant Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AI utility's bottom sheet with an in-bar assistant mode: the bar morphs into a chat input exactly like search, then stretches upward into a conversation card as messages accumulate.

**Architecture:** Assistant mode becomes the second bar-internal mode alongside search inside `NavigationBar.tsx` — the consumer owns `isAssistantOpen` and the `assistantMessages` array; the component owns the morph, the transcript, and the height choreography. The demo stage swaps its `openUtilitySheet("assistant")` routing for the new flags and fakes replies with a timer. Spec: `docs/superpowers/specs/2026-08-08-assistant-in-bar-design.md`.

**Tech Stack:** React 18, TypeScript, motion/react (framer), Tailwind classes + `theme/theme.css` tokens, Playwright a11y scripts (`scripts/a11y/*.mjs`), pnpm.

## Global Constraints

- No test framework exists; the verification loop is `pnpm check` (tsc), `pnpm build`, and the Playwright a11y suites run against a production build on port 4999 (`PORT=4999 node dist/index.js`, then `pnpm test:a11y`).
- All new animation timing must run through the existing `dur()`/`del()` helpers (× `TEMPO`, 0 under reduced motion) and use the existing `EASE` / `EASE_OUT` / `EASE_IN` constants. Ease-out for reveals, ease-in for collapses.
- Height animations are real `height` animations, never `scaleY` (spec: text must not distort).
- The transcript height cap is **62% of viewport height** (`0.62`), re-clamped on window resize.
- The assistant input reuses the `nav-search-input` and `nav-search-control` theme classes (same `data-kbd` focus-ring machinery); new transcript styles are `nav-assistant-*` classes in `client/src/theme/theme.css` with `.dark` variants and a `prefers-reduced-motion` guard on the shimmer.
- Default placeholder copy: `"Ask anything…"`. Input `aria-label`: `"Ask the assistant"`. Transcript: `role="log"` + `aria-live="polite"` + `aria-label="Assistant conversation"`.
- Comment style: match the file's existing voice (constraints and why-nots, no narration of the obvious).
- Commit after each task; message style follows the repo log (`feat:`, `fix:`, `docs:`).

---

### Task 1: Assistant input mode in NavigationBar (open/close morph, no transcript yet)

**Files:**
- Modify: `client/src/components/navigation-bar/NavigationBar.tsx`
- Modify: `client/src/components/navigation-bar/index.ts`

**Interfaces:**
- Consumes: existing search-mode machinery (`lastInputWasKeyboard`, `dur`/`del`, `TEMPO`, pill `AnimatePresence`).
- Produces (later tasks rely on these exact names): props `isAssistantOpen`, `onAssistantClose`, `onAssistantSubmit`, `assistantMessages`, `assistantPlaceholder`; exported type `AssistantMessage`; internal derived flag `isBarInputMode`; internal refs/state `assistantInputRef`, `assistantDraft`, `assistantFocusRing`.

- [ ] **Step 1: Add the `AssistantMessage` type and new props**

In `NavigationBar.tsx`, next to the other exported types (after `FilterOption`, ~line 123):

```ts
/** One transcript entry for assistant mode. The consumer owns the array;
 *  a `pending` entry renders the shimmer bubble and stays aria-hidden
 *  until its text lands. */
export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
};
```

In `NavigationBarProps` (after `onSearchSubmit`, ~line 312):

```ts
/** Assistant mode: the bar morphs into a chat input with the exact
 *  search grammar, then stretches upward into a conversation card as
 *  messages accumulate. Controlled by the consumer, like search. */
isAssistantOpen?: boolean;
onAssistantClose?: () => void;
/** Fired with the trimmed draft on Enter/submit; empty drafts are
 *  swallowed. The consumer appends the message (and its reply). */
onAssistantSubmit?: (text: string) => void;
/** The conversation. Persistence across close/reopen falls out of the
 *  consumer owning this array. */
assistantMessages?: AssistantMessage[];
assistantPlaceholder?: string;
```

Destructure with defaults in the component signature (after `onSearchSubmit`):

```ts
isAssistantOpen = false,
onAssistantClose,
onAssistantSubmit,
assistantMessages = [],
assistantPlaceholder = "Ask anything…",
```

- [ ] **Step 2: Add the Sparkles import and the shared input-mode flag**

Extend the lucide import (line 32):

```ts
import { ChevronDown, Search as SearchGlyph, Sparkles, X } from "lucide-react";
```

Directly after the `prefersReducedMotion`/`dur`/`del` block (~line 382), add:

```ts
// Search and assistant are the two bar-internal input modes: both recede
// the circles and hand the full row to the pill. Layout conditionals key
// off this; mode-specific behavior (focus, submit) stays per-mode.
const isBarInputMode = isSearchOpen || isAssistantOpen;
```

Then replace `isSearchOpen` with `isBarInputMode` in exactly these layout spots (leave every other `isSearchOpen` alone):
- Left-circle container `pointerEvents` (~line 1249) and `width`/`opacity` animate values (~lines 1254, 1260).
- Right utility container `pointerEvents` (~line 1908), `width` (~line 1919), `scale` (~line 1923), `opacity` (~line 1936).

- [ ] **Step 3: Add assistant open/close effects mirroring search**

After the search-close focus-return effect (~line 482), add:

```ts
const assistantInputRef = useRef<HTMLInputElement | null>(null);
const [assistantDraft, setAssistantDraft] = useState("");
const [assistantFocusRing, setAssistantFocusRing] = useState(false);

// Assistant open mirrors search open: exclusive with menu/filter, draft
// reset, focus deferred until the field has mostly widened.
useEffect(() => {
  if (isAssistantOpen) {
    setIsNavigationMenuOpen(false);
    setIsFilterExpanded(false);
    setAssistantDraft("");
    const t = setTimeout(
      () => assistantInputRef.current?.focus({ preventScroll: true }),
      prefersReducedMotion ? 0 : 220 * TEMPO
    );
    return () => clearTimeout(t);
  }
}, [isAssistantOpen, prefersReducedMotion]);

// Close returns focus to the utility button, same as search.
const prevAssistantOpenRef = useRef(isAssistantOpen);
useEffect(() => {
  const was = prevAssistantOpenRef.current;
  prevAssistantOpenRef.current = isAssistantOpen;
  if (was && !isAssistantOpen) {
    utilityButtonRef?.current?.focus({ preventScroll: true });
  }
}, [isAssistantOpen, utilityButtonRef]);

const handleAssistantSubmit = () => {
  const text = assistantDraft.trim();
  if (!text) return;
  setAssistantDraft("");
  onAssistantSubmit?.(text);
};
```

Also extend the sheet-exclusivity effect (~line 487): opening a sheet must not leave assistant mode dangling — no change needed there (sheets can't open while the utility button is unmounted), but ADD `isAssistantOpen` awareness to the search-open effect's sibling: in the `isSearchOpen` open effect (~line 459) nothing changes (search and assistant are different tabs' utilities; both being open is impossible from the demo, and `isBarInputMode` handles layout either way).

- [ ] **Step 4: Add the assistant branch to the pill's AnimatePresence**

In the center pill's `<AnimatePresence mode="wait" …>` (~line 1568), add a new first branch ABOVE the `isSearchOpen` ternary. Same clipPath wipe, but a column so Task 2 can slot the transcript above the input row:

```tsx
{isAssistantOpen ? (
  <motion.div
    key="assistant"
    initial={{ clipPath: "inset(0 0 0 100%)" }}
    animate={{ clipPath: "inset(0 0 0 0%)" }}
    exit={{ clipPath: "inset(0 0 0 100%)", opacity: 0 }}
    transition={{ duration: dur(0.24), ease: EASE, delay: del(0.06) }}
    className="flex flex-col w-full h-full"
    onKeyDown={e => {
      // Escape closes from anywhere inside the pill (menu/filter
      // pattern) — the transcript is focusable-scrollable in Task 2.
      if (e.key === "Escape") onAssistantClose?.();
    }}
  >
    <div className="flex items-center gap-2 w-full h-12 shrink-0 px-2">
      <Sparkles
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        strokeWidth={2}
        style={{ color: "var(--text-tertiary)" }}
      />
      <input
        ref={assistantInputRef}
        type="text"
        aria-label="Ask the assistant"
        value={assistantDraft}
        placeholder={assistantPlaceholder}
        onChange={e => setAssistantDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") handleAssistantSubmit();
        }}
        onFocus={() => setAssistantFocusRing(lastInputWasKeyboard.current)}
        data-kbd={assistantFocusRing ? "true" : undefined}
        className="nav-search-input min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-[color:var(--text-quaternary)]"
        style={{ color: "var(--text-primary)" }}
      />
      {assistantDraft && (
        <button
          type="button"
          onClick={() => {
            setAssistantDraft("");
            assistantInputRef.current?.focus({ preventScroll: true });
          }}
          aria-label="Clear message"
          className="nav-search-control shrink-0 rounded-full p-1.5 transition-colors hover:bg-[var(--action-ghost-bg-hover)]"
        >
          <X
            className="h-4 w-4"
            strokeWidth={2.25}
            style={{ color: "var(--text-secondary)" }}
          />
        </button>
      )}
      <button
        type="button"
        onClick={onAssistantClose}
        className="nav-search-control shrink-0 rounded-full px-2.5 py-1.5 text-[13px] font-semibold transition-colors hover:bg-[var(--action-ghost-bg-hover)]"
        style={{ color: "var(--select-fg)" }}
      >
        Cancel
      </button>
    </div>
  </motion.div>
) : isSearchOpen ? (
  /* …existing search branch unchanged… */
```

Note the input row is `h-12` + `shrink-0` — in Task 2 the transcript takes the space above it. The pill still has its fixed `h-12` class in this task, so the row fills it exactly.

- [ ] **Step 5: Export the new type from the barrel**

In `client/src/components/navigation-bar/index.ts`, add `AssistantMessage` to the type exports:

```ts
export type {
  Action,
  AssistantMessage,
  FilterOption,
  NavigationBarProps,
  NavTabId,
  Tab,
  UtilityAction,
} from "./NavigationBar";
```

- [ ] **Step 6: Typecheck**

Run: `pnpm check`
Expected: clean exit (the stage doesn't use the new props yet — that's fine, they're optional).

- [ ] **Step 7: Commit**

```bash
git add client/src/components/navigation-bar/
git commit -m "feat: assistant input mode on NavigationBar (search-identical morph)"
```

---

### Task 2: Transcript rendering and the stretch choreography

**Files:**
- Modify: `client/src/components/navigation-bar/NavigationBar.tsx`
- Modify: `client/src/theme/theme.css`

**Interfaces:**
- Consumes: Task 1's `isAssistantOpen`, `assistantMessages`, assistant branch markup, `isBarInputMode`.
- Produces: pill height driven by `assistantHeight` (number, px); theme classes `nav-assistant-bubble`, `nav-assistant-bubble--user`, `nav-assistant-bubble--assistant`, `nav-assistant-shimmer`.

- [ ] **Step 1: Add transcript styles to theme.css**

After the `.nav-search-input[data-kbd="true"]:focus-visible` rule (~line 252) in `client/src/theme/theme.css`:

```css
/* ── NavigationBar assistant mode ─────────────────────────────────────
   Transcript bubbles inside the stretched pill. The pending shimmer is
   visual-only (the bubble is aria-hidden until its text lands). */
.nav-assistant-bubble {
  max-width: 82%;
  padding: 8px 12px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.45;
  color: var(--text-primary);
}
.nav-assistant-bubble--assistant {
  align-self: flex-start;
  border-bottom-left-radius: 6px;
  background: color-mix(in oklab, var(--aurora-lilac) 14%, transparent);
  border: 1px solid var(--border-subtle);
}
.nav-assistant-bubble--user {
  align-self: flex-end;
  border-bottom-right-radius: 6px;
  background: var(--select-bg);
  border: 1px solid var(--select-border);
  color: var(--select-fg);
}
.nav-assistant-shimmer {
  display: block;
  width: 72px;
  height: 14px;
  border-radius: 7px;
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--aurora-lilac) 30%, transparent),
    color-mix(in oklab, var(--aurora-lilac) 10%, transparent),
    color-mix(in oklab, var(--aurora-lilac) 30%, transparent)
  );
  background-size: 200% 100%;
  animation: nav-assistant-shimmer 1.2s ease-in-out infinite;
}
@keyframes nav-assistant-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .nav-assistant-shimmer { animation: none; }
}
.dark .nav-assistant-bubble--assistant {
  background: color-mix(in oklab, var(--aurora-lilac) 20%, transparent);
}
```

(Check the `.dark` token values render legibly during the browser pass; `--select-bg`/`--select-fg` already have dark definitions.)

- [ ] **Step 2: Add measurement, cap, and two-beat state to NavigationBar**

After the Task 1 assistant effects block:

```ts
// ── Assistant stretch ──────────────────────────────────────────────
// The pill's height is a real height animation (never scaleY — text
// must not distort): input row + measured transcript, capped at 62% of
// the viewport, re-clamped on resize. Reopen-with-history runs two
// beats: the open morph lands the plain input first, then the card
// stretches to fit (assistantSurfaceReady gates the second beat).
const ASSISTANT_INPUT_ROW_PX = 48;
const ASSISTANT_HEIGHT_CAP = 0.62;

const [assistantContentH, setAssistantContentH] = useState(0);
const [viewportH, setViewportH] = useState(() =>
  typeof window === "undefined" ? 800 : window.innerHeight
);
useEffect(() => {
  const onResize = () => setViewportH(window.innerHeight);
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);

const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
const transcriptObserver = useRef<ResizeObserver | null>(null);
const setTranscriptContentRef = useCallback((el: HTMLDivElement | null) => {
  transcriptObserver.current?.disconnect();
  if (el && typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() =>
      setAssistantContentH(el.offsetHeight)
    );
    ro.observe(el);
    transcriptObserver.current = ro;
    setAssistantContentH(el.offsetHeight);
  }
}, []);
useEffect(() => () => transcriptObserver.current?.disconnect(), []);

const [assistantSurfaceReady, setAssistantSurfaceReady] = useState(false);
useEffect(() => {
  if (!isAssistantOpen) {
    setAssistantSurfaceReady(false);
    return;
  }
  // Open morph is 0.24 + 0.06 delay; the stretch waits one extra beat.
  const t = setTimeout(
    () => setAssistantSurfaceReady(true),
    prefersReducedMotion ? 0 : Math.round((0.24 + 0.06 + 0.1) * TEMPO * 1000)
  );
  return () => clearTimeout(t);
}, [isAssistantOpen, prefersReducedMotion]);

const hasTranscript = assistantMessages.length > 0;
const assistantStretched =
  isAssistantOpen && assistantSurfaceReady && hasTranscript;
// +12 breathing room so the last bubble's shadow isn't clipped.
const assistantHeight = assistantStretched
  ? Math.min(
      ASSISTANT_INPUT_ROW_PX + assistantContentH + 12,
      Math.round(viewportH * ASSISTANT_HEIGHT_CAP)
    )
  : 48;

// Ease selection follows the grammar: ease-out growing, ease-in
// shrinking. Track the previous target to know the direction.
const prevAssistantHeightRef = useRef(48);
const assistantGrowing = assistantHeight >= prevAssistantHeightRef.current;
useEffect(() => {
  prevAssistantHeightRef.current = assistantHeight;
}, [assistantHeight]);

// Falling edge for close choreography (transcript fades, card
// contracts, THEN the wipe + circles return).
const prevAssistantOpenForCloseRef = useRef(isAssistantOpen);
useEffect(() => {
  prevAssistantOpenForCloseRef.current = isAssistantOpen;
}, [isAssistantOpen]);
const assistantClosing =
  !isAssistantOpen && prevAssistantOpenForCloseRef.current;

// Transcript pins to the newest message through growth and reflow.
useEffect(() => {
  const el = transcriptScrollRef.current;
  if (el) el.scrollTop = el.scrollHeight;
}, [assistantMessages, assistantHeight]);
```

- [ ] **Step 3: Animate the pill's height and fix its border-radius**

On the center pill `motion.div` (~line 1523):

1. Remove `h-12` and `rounded-full` from its `className`, and add an explicit radius to `style` — `rounded-full` (9999px) would turn a tall card into a lozenge; 24px is identical at the resting 48px height and gives card corners when stretched:

```tsx
className={cn(
  "relative flex-1 overflow-hidden pointer-events-auto z-10 min-w-0",
  "glass-nav",
  "px-2.5 py-[5px]"
),
style={{
  borderRadius: 24,
  pointerEvents: /* …existing expression unchanged… */,
}}
```

2. Add `height: assistantHeight` to the `animate` object (alongside `opacity`, `scaleX`, `originX`).

3. In `centerPillTransition`, add a `height` entry:

```ts
height: {
  duration: dur(0.3),
  ease: assistantGrowing ? EASE_OUT : EASE_IN,
},
```

4. The pill's inner rows currently rely on the pill being 48px tall. Confirm the actions row and filter row keep `h-full` behavior: they render only when `assistantHeight === 48`, so nothing changes for them.

- [ ] **Step 4: Render the transcript above the input row**

Inside the assistant branch from Task 1, above the input-row div:

```tsx
{hasTranscript && (
  <div
    ref={transcriptScrollRef}
    role="log"
    aria-live="polite"
    aria-label="Assistant conversation"
    tabIndex={-1}
    className="flex-1 min-h-0 overflow-y-auto px-2 pt-3"
    style={{ overscrollBehaviorY: "contain" }}
  >
    <div
      ref={setTranscriptContentRef}
      className="flex flex-col gap-2 pb-1"
    >
      {assistantMessages.map(m => (
        <motion.div
          key={m.id}
          aria-hidden={m.pending || undefined}
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur(DUR.direct), ease: EASE_OUT }}
          className={cn(
            "nav-assistant-bubble",
            m.role === "user"
              ? "nav-assistant-bubble--user"
              : "nav-assistant-bubble--assistant"
          )}
        >
          {m.pending ? (
            <span className="nav-assistant-shimmer" aria-hidden="true" />
          ) : (
            m.text
          )}
        </motion.div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 5: Serial-beat the close**

Two adjustments so closing reads transcript-fade → contract → wipe/circles:

1. The assistant branch's `exit` (Task 1) becomes a delayed wipe so the contraction (height → 48, starts immediately on the flag flip) lands first:

```tsx
exit={{
  clipPath: "inset(0 0 0 100%)",
  opacity: 0,
  transition: {
    clipPath: { duration: dur(0.2), ease: EASE_IN, delay: del(0.22) },
    opacity: { duration: dur(0.2), ease: EASE_IN, delay: del(0.22) },
  },
}}
```

2. The transcript fades ahead of the geometry: wrap the transcript block's outer div in a `motion.div` with `animate={{ opacity: isAssistantOpen ? 1 : 0 }}` is unavailable inside an exiting subtree — instead give the transcript div its own exit-speed by making it a `motion.div` with `exit={{ opacity: 0, transition: { duration: dur(0.12), ease: EASE_IN } }}`. Child exits run concurrently with the parent's delayed wipe, so the transcript is gone before the wipe starts.

3. Circles return late when closing from assistant: in the left-circle container's `transition` ternary (~line 1263) and the utility container's `opacity`/`scale` transitions, add an `assistantClosing` case ahead of the default:

```ts
: assistantClosing
  ? { duration: dur(0.25), ease: EASE, delay: del(0.3) }
```

(Left circle: add to the existing `isActionSheetOpen ? … : isUtilitySheetOpen ? … : utilitySheetClosing ? … :` chain. Utility button: same delay via `rightDotIn(0.3)` in the `scale`/`opacity` chains' final default position, guarded by `assistantClosing`.)

- [ ] **Step 6: Typecheck and visual smoke**

Run: `pnpm check` — expected clean.
Then start the dev preview (launch.json `dev` entry / `pnpm dev`) and on `/navigation-bar` temporarily verify nothing regressed in search/filter/menu (assistant isn't reachable from the stage yet — that's Task 3).

- [ ] **Step 7: Commit**

```bash
git add client/src/components/navigation-bar/NavigationBar.tsx client/src/theme/theme.css
git commit -m "feat: assistant transcript + stretch choreography (height morph, 62vh cap)"
```

---

### Task 3: Demo stage swap — assistant flags, fake replies, delete the assistant sheet

**Files:**
- Modify: `client/src/stages/NavigationBarStage.tsx`
- Modify: `client/src/stages/NavigationBarStage.css`
- Modify: `client/src/demos/navigationBarDemo.ts`

**Interfaces:**
- Consumes: `isAssistantOpen` / `onAssistantClose` / `onAssistantSubmit` / `assistantMessages` props and the `AssistantMessage` type from Task 1.
- Produces: the demo behavior the a11y suite in Task 4 drives (canned replies arrive ~1.4s after submit; instantly-ish under reduced motion).

- [ ] **Step 1: Demo config — AI is no longer a dialog**

In `client/src/demos/navigationBarDemo.ts` (~line 75), assistant mode is an in-bar morph like Search, not a dialog surface:

```ts
home: { Icon: Sparkles, label: "AI" },
```

(Remove `opensDialog: true` from `home` only; Scan and Export keep theirs.)

- [ ] **Step 2: Stage state and fake-reply engine**

In `NavigationBarStage.tsx`, import the type (extend the existing import from `@/components/navigation-bar`):

```ts
import {
  NavigationBar,
  ACTION_SHEET_CLEAROUT_MS,
  UTILITY_CLEAROUT_MS,
  type AssistantMessage,
} from "@/components/navigation-bar";
```

Add state after `const [isSearchOpen, setIsSearchOpen] = useState(false);` (~line 127):

```ts
// ── Assistant mode (in-bar chat) ──
// The stage owns the transcript so it survives close/reopen; replies
// are canned with a delay long enough that pending → reply → stretch
// reads as three beats.
const [isAssistantOpen, setIsAssistantOpen] = useState(false);
const [assistantMessages, setAssistantMessages] = useState<
  AssistantMessage[]
>([]);
const assistantReplyTimer = useRef<ReturnType<typeof setTimeout> | null>(
  null
);
const assistantReplyCount = useRef(0);
useEffect(
  () => () => {
    if (assistantReplyTimer.current)
      clearTimeout(assistantReplyTimer.current);
  },
  []
);

const handleAssistantSubmit = useCallback(
  (text: string) => {
    const stamp = Date.now();
    setAssistantMessages(prev => [
      ...prev,
      { id: `u-${stamp}`, role: "user", text },
      { id: `a-${stamp}`, role: "assistant", text: "", pending: true },
    ]);
    setLastAction(`Asked assistant: ${text}`);
    if (assistantReplyTimer.current)
      clearTimeout(assistantReplyTimer.current);
    assistantReplyTimer.current = setTimeout(
      () => {
        const reply =
          ASSISTANT_REPLIES[
            assistantReplyCount.current % ASSISTANT_REPLIES.length
          ];
        assistantReplyCount.current += 1;
        // Resolve every pending bubble — rapid submits share one reply
        // beat rather than stranding earlier shimmers.
        setAssistantMessages(prev =>
          prev.map(m =>
            m.pending ? { ...m, text: reply, pending: false } : m
          )
        );
      },
      prefersReducedMotion ? 400 : 1400
    );
  },
  [prefersReducedMotion]
);
```

And the canned replies as a module constant next to `ghostCards` (~line 36):

```ts
const ASSISTANT_REPLIES = [
  "You spent $342 on dining this month — 18% under your usual pace.",
  "Your portfolio is up 2.4% this week, led by the index funds.",
  "Done — I drafted that transfer. Review it on the Spend tab.",
];
```

- [ ] **Step 3: Route the AI utility press and wire the props**

In `onUtilityClick` (~line 452), replace the AI branch:

```ts
if (label === "AI") {
  // Assistant is an in-bar mode like Search — no clear-out, no sheet.
  if (utilSheet || utilSheetPrep || utility || utilityClosing) return;
  setIsAssistantOpen(true);
  return;
}
if (label === "Search") {
  setIsSearchOpen(true);
  return;
}
if (label === "Scan") {
  openUtility("scan");
  return;
}
openUtilitySheet("export");
```

On the `<NavigationBar />` element, add after the search props:

```tsx
isAssistantOpen={isAssistantOpen}
onAssistantClose={() => setIsAssistantOpen(false)}
onAssistantSubmit={handleAssistantSubmit}
assistantMessages={assistantMessages}
```

In `onTabChange`, add `setIsAssistantOpen(false);` next to `setIsSearchOpen(false);`.
In `setCollapsed` (~line 265), add `setIsAssistantOpen(false);` inside the `if (next)` branch.
In the `overlayOpenRef` effect (~line 246), add `isAssistantOpen ||` to the disjunction and to the dependency array.

- [ ] **Step 4: Delete the assistant sheet path**

- Narrow the sheet state (~line 157): `useState<"export" | null>(null)` and `openUtilitySheet` param type to `kind: "export"`.
- Delete the entire `{utilSheet === "assistant" && …}` BottomSheet block (~lines 528–553).
- Remove `Sparkles` from the lucide import (line 32) — only the deleted title used it.
- Update the stage's header comment (~line 13) and the utility-surfaces comment block (~lines 51–57, 456–460): AI is now "in-bar chat morph (search grammar + upward stretch)", and the bottom-sheet examples are Export only.

- [ ] **Step 5: Delete orphaned CSS**

In `NavigationBarStage.css`, delete the rules that only the assistant sheet used (verify each has no other references first with a grep over `client/src`):
- `.navigation-demo__sheet-bubble` (~line 184) and its variants `--user` (~192), `--short` (~200), `--loading` (in the ~240 animation block and ~254 reduced-motion block)
- `.navigation-demo__sheet-input` (~line 204)
- `.navigation-demo__sheet--assistant .navigation-demo__sheet-body` (~line 226)
- `.dark .navigation-demo__sheet-bubble`, `.dark .navigation-demo__sheet-bubble--user`, `.dark .navigation-demo__sheet-input` (~lines 408–420)

Keep every `sheet-row` / `sheet-body` rule — Export and the workflow sheets still use them.

- [ ] **Step 6: Typecheck**

Run: `pnpm check`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add client/src/stages/NavigationBarStage.tsx client/src/stages/NavigationBarStage.css client/src/demos/navigationBarDemo.ts
git commit -m "feat: swap AI utility to in-bar assistant mode; delete assistant sheet"
```

---

### Task 4: A11y suites — update triggers, add assistant coverage

**Files:**
- Modify: `scripts/a11y/a11y-triggers.mjs`
- Create: `scripts/a11y/a11y-assistant.mjs`
- Modify: `scripts/a11y/README.md`
- Modify: `package.json` (no change needed — `test:a11y` globs `a11y-*.mjs`)

**Interfaces:**
- Consumes: the running production build on `http://localhost:4999/navigation-bar`; demo behavior from Task 3 (reply ~1.4s after submit).
- Produces: PASS/FAIL lines, non-zero exit on failure (harness convention).

- [ ] **Step 1: Update a11y-triggers.mjs for the AI button's new semantics**

Read the whole file first. The opening assertion expects `aria-haspopup="dialog"` / `aria-expanded="false"` on the AI button — under assistant mode the button carries neither (like Search). Replace that assertion pair with:

```js
// 1. On load (Home): the AI utility opens an in-bar mode (like Search),
//    so it carries NO aria-haspopup and NO aria-expanded.
let ai = await page.evaluate(() => {
  const btn = document.querySelector('button[aria-label="AI"]');
  return {
    haspopup: btn?.getAttribute("aria-haspopup"),
    expanded: btn?.getAttribute("aria-expanded"),
  };
});
results.push(
  ["Home utility button has no aria-haspopup", ai.haspopup === null, ai],
  ["Home utility button has no aria-expanded", ai.expanded === null, ai]
);
```

Scan the rest of the file for any other AI/assistant-sheet assertions (e.g. opening the AI sheet and checking dialog focus) and rewrite or drop them — the sheet no longer exists. If a dialog-focused assertion needs a subject, point it at Export (Transactions tab) instead.

- [ ] **Step 2: Write a11y-assistant.mjs**

New suite following the harness style (plain script, `results` array, PASS/FAIL print, exit non-zero on failure — copy the print/exit tail from `a11y-triggers.mjs` verbatim):

```js
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/navigation-bar");
await page.waitForTimeout(1500);

const results = [];

// 1. Open: click AI → the assistant input receives focus.
await page.locator('button[aria-label="AI"]').click();
await page.waitForTimeout(900);
let focused = await page.evaluate(
  () => document.activeElement?.getAttribute("aria-label")
);
results.push(["Assistant input focused on open", focused === "Ask the assistant", focused]);

// 2. Submit: transcript appears as role=log aria-live=polite; the
//    pending bubble is aria-hidden.
await page.keyboard.type("What did I spend this month?");
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
let log = await page.evaluate(() => {
  const el = document.querySelector('[role="log"]');
  return {
    exists: !!el,
    live: el?.getAttribute("aria-live"),
    pendingHidden: !!el?.querySelector('[aria-hidden="true"].nav-assistant-bubble, .nav-assistant-bubble[aria-hidden="true"]'),
  };
});
results.push(
  ["Transcript is role=log", log.exists, log],
  ["Transcript aria-live=polite", log.live === "polite", log],
  ["Pending bubble aria-hidden", log.pendingHidden, log]
);

// 3. Reply lands: pending clears, bubble has text.
await page.waitForTimeout(2000);
let replied = await page.evaluate(() => {
  const bubbles = [...document.querySelectorAll(".nav-assistant-bubble")];
  const last = bubbles[bubbles.length - 1];
  return {
    count: bubbles.length,
    lastHasText: (last?.textContent ?? "").length > 0,
    lastHidden: last?.getAttribute("aria-hidden"),
  };
});
results.push(
  ["Two bubbles after reply", replied.count === 2, replied],
  ["Reply bubble has text", replied.lastHasText, replied],
  ["Reply bubble not aria-hidden", replied.lastHidden === null, replied]
);

// 4. Escape closes; focus returns to the AI utility button.
await page.keyboard.press("Escape");
await page.waitForTimeout(1200);
let returned = await page.evaluate(
  () => document.activeElement?.getAttribute("aria-label")
);
results.push(["Focus returns to AI button on Escape", returned === "AI", returned]);

// 5. Reopen: transcript is preserved (session persistence).
await page.locator('button[aria-label="AI"]').click();
await page.waitForTimeout(1400);
let preserved = await page.evaluate(
  () => document.querySelectorAll(".nav-assistant-bubble").length
);
results.push(["Transcript preserved on reopen", preserved === 2, preserved]);

// (print/exit tail copied from a11y-triggers.mjs)
let failed = false;
for (const [name, pass, detail] of results) {
  console.log(`${pass ? "PASS" : "FAIL"}: ${name}${pass ? "" : ` — ${JSON.stringify(detail)}`}`);
  if (!pass) failed = true;
}
await browser.close();
process.exit(failed ? 1 : 0);
```

(Before finalizing, diff the real print/exit tail in `a11y-triggers.mjs` and match it exactly.)

- [ ] **Step 3: Add the suite to the README table**

In `scripts/a11y/README.md`, add a row:

```
| `a11y-assistant.mjs` | Assistant mode: input focus on open, role=log/aria-live transcript, pending aria-hidden, Escape + focus return, session persistence |
```

- [ ] **Step 4: Run the full a11y loop against a production build**

```bash
pnpm build
PORT=4999 node dist/index.js &
pnpm test:a11y
```

Expected: every suite PASS. Kill the server afterward. If `a11y-triggers.mjs` fails on assertions beyond the one updated, fix them per Step 1's guidance and re-run.

- [ ] **Step 5: Commit**

```bash
git add scripts/a11y/
git commit -m "test: a11y coverage for assistant mode; retire AI-sheet trigger assertions"
```

---

### Task 5: Browser verification pass and docs sync

**Files:**
- Modify: `NavigationBarOverview.md` (lines 18, 60, 224, 244, 283 mention the assistant-as-sheet)
- Modify: `client/src/lab/registry.tsx` (sample-code comments describe the utility routing)
- Modify: `HANDOFF.md` (session wrap convention)

**Interfaces:**
- Consumes: everything shipped in Tasks 1–4.
- Produces: docs consistent with shipped behavior; verified demo.

- [ ] **Step 1: Full browser choreography pass on the dev server**

Open the preview on `/navigation-bar` and verify, fixing any issue at the source before moving on:

1. Home tab → AI press: circles recede, input wipes in — side-by-side feel identical to Trade tab → Search.
2. Type + Enter: input clears, pill stretches upward (~0.3s), user bubble right-aligned, shimmer bubble left; reply lands ~1.4s, shimmer becomes text, height grows to fit.
3. Multiple exchanges: growth per exchange; at 62% viewport it stops and the transcript scrolls, pinned to the newest message.
4. Cancel: transcript fades, card contracts to the bar, wipe-out, circles return.
5. Reopen: input lands first, then the card stretches to the transcript (two beats).
6. Escape from the input and from a scrolled transcript both close.
7. Tab change while open closes it; returning to Home and reopening restores the transcript.
8. Dark mode: bubbles and shimmer legible (toggle via the site's theme switch).
9. Reduced motion (emulate via devtools): open, stretch, and close are instant; shimmer static.
10. Search, filter, menu, Export, Scan, workflow sheets, scroll collapse: all unchanged.

- [ ] **Step 2: Sync NavigationBarOverview.md**

Update every assistant mention to the new model (bar-internal mode, search grammar, upward stretch, 62% cap, session persistence): line 18's utility list, line 60's surface list ("AI assistant (bottom sheet)" → "AI assistant (in-bar chat morph)"), line 224's staying-attached rationale, line 244's two-stop model reference (the Assistant no longer uses the sheet's 62% stop — the 62% figure survives as the assistant card's height cap), line 283's open-states list. Add the new props to whatever API table the doc keeps.

- [ ] **Step 3: Sync registry.tsx sample code**

Update the utility-routing comments (~lines 89–120): AI on Home now flips `isAssistantOpen` (in-bar mode, no dialog), and `opensDialog` examples should reference Scan/Export.

- [ ] **Step 4: Typecheck, then update HANDOFF.md and commit**

Run `pnpm check` one last time, then record the session's landing in `HANDOFF.md` per its existing format (assistant mode shipped; sheet deleted; a11y suite added).

```bash
git add NavigationBarOverview.md client/src/lab/registry.tsx HANDOFF.md
git commit -m "docs: sync Overview, registry sample, and handoff with assistant mode"
```

---

## Self-Review Notes

- **Spec coverage:** API (Task 1), open morph (Task 1), stretch/cap/pinning/two-beat/close beats (Task 2), demo swap + persistence + fake replies + deletion (Task 3), a11y semantics (Tasks 1–2 implement, Task 4 verifies), verification (Tasks 4–5), docs (Task 5). The spec's "no test suite" line was written before discovering the Playwright a11y harness; Task 4 supersedes it.
- **Type consistency:** `AssistantMessage` defined once in Task 1 and imported by name in Task 3; prop names identical across Tasks 1/3; `nav-assistant-*` class names identical across Tasks 2/4.
- **Known judgment calls for the implementer:** exact `delay` values in the close serial-beats (Step 5 of Task 2) may need ±0.05 tuning by eye on device; the +12px breathing room in `assistantHeight` likewise. Tune by feel, keep the beat ORDER fixed.
