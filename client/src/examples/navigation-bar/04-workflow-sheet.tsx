/**
 * 04 — Workflow sheet. Tapping an action clears the bar out (isSheetOpen),
 * you wait sheetClearoutMs(), measure the bar (actionBarRef), and mount a
 * BottomSheet from that rect. On close it contracts back into the bar and
 * you drop the clear-out in onExitComplete.
 */
import { useCallback, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence } from "motion/react";
import { Home, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import {
  NavigationBar,
  sheetClearoutMs,
  type Tab,
  type Action,
} from "@/components/navigation-bar";
import { BottomSheet, type SheetOrigin } from "@/components/bottom-sheet";

type Sheet = { title: string; origin: SheetOrigin };
const tabs: Tab[] = [{ id: "home", label: "Home", Icon: Home }];
const actions: Record<string, Action[]> = {
  home: [
    { Icon: ArrowDownToLine, label: "Deposit", showIcon: false },
    { Icon: ArrowUpFromLine, label: "Withdraw", showIcon: false },
  ],
};
// You own the fixed shell: bottom edge + safe-area inset.
const shell: CSSProperties = {
  position: "fixed",
  insetInline: 0,
  bottom: "env(safe-area-inset-bottom, 0)",
  pointerEvents: "none",
  zIndex: 50,
};

export default function WorkflowSheet() {
  const barRef = useRef<HTMLDivElement | null>(null);
  // One state drives both the engaged chip and the bar's clear-out.
  const [active, setActive] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const launch = useCallback((label: string) => {
    setActive(label);
    window.setTimeout(() => {
      const r = barRef.current?.getBoundingClientRect();
      if (!r) return;
      const { top, left, width, height, bottom } = r; // SheetOrigin's five
      setSheet({ title: label, origin: { top, left, width, height, bottom } });
    }, sheetClearoutMs());
  }, []);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: "9rem" }}>
      <div style={shell}>
        <NavigationBar
          tabs={tabs}
          contextualActions={actions}
          activeTab="home"
          activeAction={active}
          actionBarRef={barRef}
          isSheetOpen={active !== null}
          onActionClick={launch}
          showUtilityButton={false}
        />
      </div>
      <AnimatePresence onExitComplete={() => setActive(null)}>
        {sheet && (
          <BottomSheet
            key={sheet.title}
            origin={sheet.origin}
            title={sheet.title}
            ariaLabel={`${sheet.title} workflow`}
            onClose={() => setSheet(null)}
          >
            <p style={{ padding: "1rem 0" }}>Your {sheet.title} form here.</p>
          </BottomSheet>
        )}
      </AnimatePresence>
    </div>
  );
}
