/**
 * Individual region item in the region list.
 */

import { cn } from "@/lib/utils";

interface RegionItemProps {
  name: string;
  type: "template" | "ocr";
  required: boolean;
  description: string;
  status: "pending" | "captured" | "error";
  onSelect: () => void;
  onDraw: () => void;
}

const STATUS_CONFIG = {
  pending: { icon: "○", color: "text-muted-foreground", border: "border-muted" },
  captured: { icon: "✓", color: "text-green-500", border: "border-green-500" },
  error: { icon: "⚠", color: "text-red-500", border: "border-red-500" },
} as const;

export function RegionItem({
  name,
  type,
  required,
  description,
  status,
  onSelect,
  onDraw,
}: RegionItemProps) {
  const { icon, color, border } = STATUS_CONFIG[status];

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-md cursor-pointer",
        "border-l-4 hover:bg-accent/50 transition-colors",
        border
      )}
      onClick={onSelect}
    >
      <span className={cn("text-sm font-mono", color)}>{icon}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{name}</span>
          {required && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600">
              required
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "px-1 rounded",
              type === "ocr" ? "bg-blue-500/20 text-blue-600" : "bg-purple-500/20 text-purple-600"
            )}
          >
            {type}
          </span>
          <span className="truncate">{description}</span>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDraw();
        }}
        className={cn(
          "px-2 py-1 text-xs rounded",
          "bg-primary/10 hover:bg-primary/20 text-primary",
          "transition-colors"
        )}
      >
        Draw
      </button>
    </div>
  );
}
