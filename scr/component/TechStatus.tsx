import { Mic, Ear, Languages, CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import type { PipelineStage } from "@/services/stt/types";

interface TechStatusProps {
  stage: PipelineStage;
  isRunning: boolean;
}

const stages = [
  { key: "mic_ready", label: "Микрофон активен", icon: Mic },
  { key: "listening", label: "Слушает громкую связь", icon: Ear },
  { key: "speech_detected", label: "Иврит распознан", icon: Languages },
  { key: "translated", label: "Перевод готов", icon: CheckCircle2 },
] as const;

const stageOrder: Record<string, number> = {
  idle: 0,
  requesting_permission: 0.5,
  mic_ready: 1,
  listening: 2,
  speech_detected: 3,
  translating: 3,
  translated: 4,
  error: -1,
};

export function TechStatus({ stage, isRunning }: TechStatusProps) {
  const currentOrder = stageOrder[stage] ?? 0;

  if (!isRunning) {
    return (
      <div className="mx-4 mt-3 rounded-lg bg-card px-4 py-3 shadow-card">
        <p className="text-xs text-muted-foreground text-center">
          Нажмите «Старт» и включите громкую связь на телефоне
        </p>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="mx-4 mt-3 rounded-lg bg-destructive/10 px-4 py-3 shadow-card">
        <div className="flex items-center justify-center gap-2 text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs font-medium">Ошибка в пайплайне</span>
        </div>
      </div>
    );
  }

  if (stage === "requesting_permission") {
    return (
      <div className="mx-4 mt-3 rounded-lg bg-card px-4 py-3 shadow-card">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Запрос доступа к микрофону…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-3 rounded-lg bg-card px-4 py-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        {stages.map((s) => {
          const order = stageOrder[s.key];
          const isActive = currentOrder >= order;
          const isCurrent = currentOrder === order;
          const Icon = s.icon;

          return (
            <div key={s.key} className="flex flex-col items-center gap-1 flex-1">
              <div className={`transition-colors ${isActive ? "text-primary" : "text-muted-foreground/30"}`}>
                {isCurrent && currentOrder > 0 && currentOrder < 4 ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isActive ? (
                  <Icon className="w-4 h-4" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </div>
              <span className={`text-[9px] text-center leading-tight ${
                isActive ? "text-foreground" : "text-muted-foreground/40"
              }`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
