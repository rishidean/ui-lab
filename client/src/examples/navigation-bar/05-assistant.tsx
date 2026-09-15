/**
 * 05 — Assistant. The AI utility morphs the bar into a chat input; you
 * own the transcript, so it survives close and reopen.
 */
import { useState } from "react";
import { Home, ArrowDownToLine, Sparkles } from "lucide-react";
import {
  NavigationBar,
  type Tab,
  type Action,
  type UtilityAction,
  type AssistantMessage,
} from "@/components/navigation-bar";

const tabs: Tab[] = [{ id: "home", label: "Home", Icon: Home }];
const actions: Record<string, Action[]> = {
  home: [{ Icon: ArrowDownToLine, label: "Deposit", showIcon: false }],
};
const ai: UtilityAction = { Icon: Sparkles, label: "AI" };

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  return (
    <div style={{ minHeight: "100vh", paddingBottom: "9rem" }}>
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
          activeTab="home"
          utilityAction={ai}
          onUtilityClick={() => setOpen(true)}
          isAssistantOpen={open}
          onAssistantClose={() => setOpen(false)}
          assistantMessages={messages}
          onAssistantSubmit={text =>
            setMessages(m => [
              ...m,
              { id: `u${m.length}`, role: "user", text },
              {
                id: `a${m.length}`,
                role: "assistant",
                text: `You said: ${text}`,
              },
            ])
          }
          assistantPlaceholder="Ask anything…"
        />
      </div>
    </div>
  );
}
