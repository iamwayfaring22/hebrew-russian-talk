import { motion } from "framer-motion";

export interface Message {
  id: string;
  original: string;
  translated: string;
  speaker: "remote" | "local";
  timestamp: string;
  isFinal?: boolean;
}

interface TranscriptMessageProps {
  message: Message;
}

export function TranscriptMessage({ message }: TranscriptMessageProps) {
  const isRemote = message.speaker === "remote";
  const isPartial = message.isFinal === false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isPartial ? 0.7 : 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
      className={`flex flex-col gap-1 ${isRemote ? "items-end" : "items-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-lg px-3.5 py-2.5 shadow-card ${
          isRemote ? "bg-card" : "bg-secondary"
        } ${isPartial ? "border border-dashed border-muted-foreground/20" : ""}`}
      >
        {/* Original text (Hebrew) */}
        <p
          className={`text-pretty leading-relaxed ${
            isRemote
              ? "font-hebrew text-lg font-medium text-hebrew text-right"
              : "text-base text-russian"
          }`}
          dir={isRemote ? "rtl" : "ltr"}
        >
          {message.original}
        </p>

        {/* Divider */}
        <div className="my-1.5 h-px bg-foreground/5" />

        {/* Translated text (Russian) */}
        <p
          className={`text-pretty leading-relaxed ${
            isRemote
              ? "text-base text-foreground"
              : "font-hebrew text-lg font-medium text-hebrew text-right"
          } ${isPartial ? "italic" : ""}`}
          dir={isRemote ? "ltr" : "rtl"}
        >
          {message.translated}
        </p>
      </div>

      <div className="flex items-center gap-1.5 px-1">
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {message.timestamp}
        </span>
        {isPartial && (
          <span className="text-[9px] text-muted-foreground/50">partial</span>
        )}
      </div>
    </motion.div>
  );
}
