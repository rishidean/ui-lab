/**
 * Dstil source-stage reminder: the uploaded NavigationBar is the focal object.
 * The restrained ghost content exists only to provide real scrolling for its
 * built-in collapse choreography; it must never compete with the bottom bar.
 */
import { NavigationBar } from "@/components/navigation-bar";
import {
  navigationActions,
  navigationFilters,
  navigationRightButton,
  navigationTabs,
} from "@/demos/navigationBarDemo";
import { type UIEvent, useCallback, useRef, useState } from "react";
import "./NavigationBarStage.css";

const ghostCards = [72, 48, 84, 60, 94, 56, 78, 66];

export default function NavigationBarStage() {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const lastScrollDecisionRef = useRef(0);
  const [activeTab, setActiveTab] = useState("home");
  const [activeFilter, setActiveFilter] = useState("today");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [lastAction, setLastAction] = useState("Navigation Bar ready");

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const scrollTop = event.currentTarget.scrollTop;

    if (scrollTop < 20) {
      setIsCollapsed(false);
      lastScrollDecisionRef.current = scrollTop;
      return;
    }

    const delta = scrollTop - lastScrollDecisionRef.current;
    if (Math.abs(delta) < 18) {
      return;
    }

    setIsCollapsed(delta > 0);
    lastScrollDecisionRef.current = scrollTop;
  }, []);

  const expandFromLogo = useCallback(() => {
    setIsCollapsed(false);
    scrollAreaRef.current?.scrollBy({ top: -140, behavior: "smooth" });
  }, []);

  return (
    <main className="navigation-demo">
      <div
        ref={scrollAreaRef}
        className="navigation-demo__scroll-area"
        aria-label="Scrollable Navigation Bar demonstration canvas"
        onScroll={handleScroll}
      >
        <div className="navigation-demo__content" aria-hidden="true">
          <div className="navigation-demo__feature-card">
            <div className="navigation-demo__feature-orb" />
            <div className="navigation-demo__feature-lines">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="navigation-demo__card-grid">
            {ghostCards.map((width, index) => (
              <div
                className="navigation-demo__ghost-card"
                key={`${width}-${index}`}
              >
                <span className="navigation-demo__ghost-icon" />
                <div className="navigation-demo__ghost-lines">
                  <span style={{ width: `${width}%` }} />
                  <span style={{ width: `${Math.max(32, width - 22)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="navigation-demo__nav-shell">
        <NavigationBar
          isCollapsed={isCollapsed}
          activeTab={activeTab}
          activeFilter={activeFilter}
          tabs={navigationTabs}
          tabActions={navigationActions}
          filterOptions={navigationFilters}
          rightButton={navigationRightButton}
          onLogoClick={expandFromLogo}
          onTabChange={tab => {
            setActiveTab(tab);
            setLastAction(`${tab} tab selected`);
          }}
          onFilterChange={filter => {
            setActiveFilter(filter);
            setLastAction(`${filter} filter selected`);
          }}
          onActionClick={(label, tab) =>
            setLastAction(`${label} selected in ${tab}`)
          }
          onRightButtonClick={() => setLastAction("Ask Dstil selected")}
        />
      </div>

      <p className="sr-only" aria-live="polite">
        {lastAction}
      </p>
    </main>
  );
}
