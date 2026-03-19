import { useState } from "react";
import { ChevronDown, ChevronUp, Bug } from "lucide-react";

export interface DebugEvent {
  time: string;
  event: string;
  detail?: string;
}

interface DebugPanelProps {
  activeProvider: "mock" | "web-speech";
  onProviderChange: (provider: "mock" | "web-speech") => void;
  events: DebugEvent[];
  disabled?: boolean;
}

export function DebugPanel({
  activeProvider,
  onProviderChange,
  events,
  disabled = false,
}: DebugPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-border bg-muted/30">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Bug className="w-3 h-3" />
          Debug &middot; {"\u041f\u0440\u043e\u0432\u0430\u0439\u0434\u0435\u0440: "}
          <span className="font-semibold text-foreground">
            {activeProvider === "mock" ? "MockSTT" : "WebSpeech"}
          </span>
        </span>
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {/* Provider switch */}
          <div className="flex gap-2 py-1">
            <button
              onClick={() => { if (!disabled) onProviderChange("mock"); }}
              disabled={disabled}
              className={`px-3 py-1 rounded text-xs border transition-colors ${
                activeProvider === "mock"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:bg-muted"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Mock
            </button>
            <button
              onClick={() => { if (!disabled) onProviderChange("web-speech"); }}
              disabled={disabled}
              className={`px-3 py-1 rounded text-xs border transition-colors ${
                activeProvider === "web-speech"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:bg-muted"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              WebSpeech
            </button>
          </div>

          {disabled && (
            <p className="text-[10px] text-destructive">
              {"\u041e\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u0435 \u0441\u0435\u0441\u0441\u0438\u044e \u043f\u0435\u0440\u0435\u0434 \u0441\u043c\u0435\u043d\u043e\u0439 \u043f\u0440\u043e\u0432\u0430\u0439\u0434\u0435\u0440\u0430"}
            </p>
          )}

          {/* Event log */}
          <div className="rounded-md border border-border bg-background p-2 max-h-36 overflow-y-auto">
            <p className="text-[10px] text-muted-foreground mb-1 font-semibold">
              STT Events ({events.length})
            </p>
            {events.length === 0 && (
              <p className="text-[10px] text-muted-foreground/50">{"\u041d\u0435\u0442 \u0441\u043e\u0431\u044b\u0442\u0438\u0439"}</p>
            )}
            {events.map((e, i) => (
              <div key={i} className="flex gap-2 text-[10px] leading-relaxed font-mono">
                <span className="text-muted-foreground/60 shrink-0">{e.time}</span>
                <span className="text-foreground">&nbsp;</span>
                <span className="text-primary">{e.event}</span>
                {e.detail && (
                  <span className="text-muted-foreground truncate">{e.detail}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
