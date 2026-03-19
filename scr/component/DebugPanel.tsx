import { useState } from "react";
import { ChevronDown, ChevronUp, Bug } from "lucide-react";
import { Switch } from "@/components/ui/switch";

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

  const isMock = activeProvider === "mock";

  return (
    <div className="border-t border-border bg-muted/30">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Bug className="w-3 h-3" />
          Debug · Провайдер:{" "}
          <span className="font-semibold text-foreground">
            {isMock ? "MockSTT" : "WebSpeech"}
          </span>
        </span>
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {/* Provider switch */}
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">
              {isMock ? "Mock (без микрофона)" : "WebSpeech (реальный микрофон)"}
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] ${isMock ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                Mock
              </span>
              <Switch
                checked={!isMock}
                onCheckedChange={(checked) =>
                  onProviderChange(checked ? "web-speech" : "mock")
                }
                disabled={disabled}
              />
              <span className={`text-[10px] ${!isMock ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                WebSpeech
              </span>
            </div>
          </div>

          {disabled && (
            <p className="text-[10px] text-destructive">
              Остановите сессию перед сменой провайдера
            </p>
          )}

          {/* Event log */}
          <div className="rounded-md border border-border bg-background p-2 max-h-36 overflow-y-auto">
            <p className="text-[10px] text-muted-foreground mb-1 font-semibold">
              STT Events ({events.length})
            </p>
            {events.length === 0 && (
              <p className="text-[10px] text-muted-foreground/50">Нет событий</p>
            )}
            {events.map((e, i) => (
              <div key={i} className="flex gap-2 text-[10px] leading-relaxed font-mono">
                <span className="text-muted-foreground/60 shrink-0">{e.time}</span>
                <span
                  className={
                    e.event.includes("error")
                      ? "text-destructive"
                      : e.event.includes("result")
                      ? "text-primary"
                      : "text-foreground"
                  }
                >
                  {e.event}
                </span>
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
