/**
 * 01 — Minimal. Tabs, per-tab actions, and a click handler. No utilities,
 * no sheets, no scroll wiring. This is the whole required surface.
 */
import { useState } from "react";
import {
  Home,
  CreditCard,
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
} from "lucide-react";
import {
  NavigationBar,
  type Tab,
  type Action,
} from "@/components/navigation-bar";

const tabs: Tab[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "spend", label: "Spend", Icon: CreditCard },
];
// Actions are text-only by design (showIcon: false); the Icon still
// feeds accessibility.
const actions: Record<string, Action[]> = {
  home: [
    { Icon: ArrowDownToLine, label: "Deposit", showIcon: false },
    { Icon: ArrowUpFromLine, label: "Withdraw", showIcon: false },
  ],
  spend: [{ Icon: Send, label: "Pay", showIcon: false }],
};

export default function Minimal() {
  const [tab, setTab] = useState("home");
  const [last, setLast] = useState("nothing yet");
  return (
    <div style={{ minHeight: "100vh", paddingBottom: "9rem" }}>
      <p data-example-log style={{ padding: "1rem" }}>
        Last action: {last}
      </p>
      {/* You own the fixed shell: bottom edge + safe-area inset. */}
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
          onActionClick={(label, onTab) => setLast(`${label} on ${onTab}`)}
          showUtilityButton={false}
        />
      </div>
    </div>
  );
}
