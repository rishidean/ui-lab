/**
 * 02 — Collapse on scroll. useCollapseOnScroll owns the hysteresis; you
 * feed it your scroll container's onScroll and pass isCollapsed through.
 */
import { useState } from "react";
import { Home, CreditCard, ArrowDownToLine, Send } from "lucide-react";
import {
  NavigationBar,
  useCollapseOnScroll,
  type Tab,
  type Action,
} from "@/components/navigation-bar";

const tabs: Tab[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "spend", label: "Spend", Icon: CreditCard },
];
const actions: Record<string, Action[]> = {
  home: [{ Icon: ArrowDownToLine, label: "Deposit", showIcon: false }],
  spend: [{ Icon: Send, label: "Pay", showIcon: false }],
};

export default function CollapseOnScroll() {
  const [tab, setTab] = useState("home");
  // overlayOpen: true while any sheet/search/assistant is up — none here.
  const { isCollapsed, onScroll, expand } = useCollapseOnScroll({
    overlayOpen: false,
  });
  return (
    <div
      data-example-scroll
      onScroll={onScroll}
      style={{ height: "100vh", overflowY: "auto" }}
    >
      <div style={{ height: "220vh", padding: "1rem" }}>Scroll me.</div>
      <div
        style={{
          position: "fixed",
          insetInline: 0,
          bottom: "env(safe-area-inset-bottom, 0)",
          pointerEvents: "none",
        }}
      >
        <NavigationBar
          tabs={tabs}
          contextualActions={actions}
          activeTab={tab}
          onTabChange={setTab}
          isCollapsed={isCollapsed}
          onCollapsedClick={expand}
          showUtilityButton={false}
        />
      </div>
    </div>
  );
}
