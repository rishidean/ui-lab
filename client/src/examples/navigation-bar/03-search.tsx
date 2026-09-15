/**
 * 03 — Search. The bar itself morphs into the field; no extra component.
 * The utility button on this tab is Search; onUtilityClick opens it.
 */
import { useState } from "react";
import { TrendingUp, ArrowDownLeft, Search } from "lucide-react";
import {
  NavigationBar,
  type Tab,
  type Action,
  type UtilityAction,
} from "@/components/navigation-bar";

const tabs: Tab[] = [{ id: "trade", label: "Trade", Icon: TrendingUp }];
const actions: Record<string, Action[]> = {
  trade: [{ Icon: ArrowDownLeft, label: "Buy", showIcon: false }],
};
const search: UtilityAction = { Icon: Search, label: "Search" };

export default function SearchExample() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  return (
    <div style={{ minHeight: "100vh", paddingBottom: "9rem" }}>
      <p data-example-log style={{ padding: "1rem" }}>
        typing: {query} · submitted: {submitted}
      </p>
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
          activeTab="trade"
          utilityAction={search}
          onUtilityClick={() => setOpen(true)}
          isSearchOpen={open}
          onSearchChange={setQuery}
          onSearchSubmit={q => {
            setSubmitted(q);
            setOpen(false);
          }}
          onSearchClose={() => setOpen(false)}
          searchPlaceholder="Search markets…"
        />
      </div>
    </div>
  );
}
