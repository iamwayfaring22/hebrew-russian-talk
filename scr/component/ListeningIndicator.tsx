import { motion } from "framer-motion";

interface ListeningIndicatorProps {
  state: "listening" | "translating" | "idle";
}

const labels: Record<string, string> = {
  listening: "Слушаю громкую связь...",
  translating: "Распознаю и перевожу...",
  idle: "Ожидание речи...",
};

export function ListeningIndicator({ state }: ListeningIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-center gap-2 py-2"
    >
      {state !== "idle" && (
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={`w-1 rounded-full ${
                state === "listening" ? "bg-primary" : "bg-hebrew"
              }`}
              animate={{ height: [4, 12, 4] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}
      <span className="text-xs text-muted-foreground">{labels[state]}</span>
    </motion.div>
  );
}
