import { Wifi, WifiOff, Volume2 } from "lucide-react";

interface StatusBarProps {
  confidence: number;
  callDuration: string;
  isOnline: boolean;
}

export function StatusBar({ confidence, callDuration, isOnline }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
      <div className="flex items-center gap-2">
        <Volume2 className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs tabular-nums text-muted-foreground">{callDuration}</span>
      </div>

      <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        HE → RU · Субтитры
      </span>

      <div className="flex items-center gap-2">
        {isOnline ? (
          <Wifi className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-destructive" />
        )}
        <div className="flex items-center gap-1">
          <div
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: `${Math.max(20, confidence * 0.4)}px`,
              backgroundColor: confidence > 70
                ? `hsl(var(--accent-russian))`
                : confidence > 40
                ? `hsl(var(--accent-hebrew))`
                : `hsl(var(--destructive))`,
            }}
          />
          <span className="text-[10px] tabular-nums text-muted-foreground">{confidence}%</span>
        </div>
      </div>
    </div>
  );
}
