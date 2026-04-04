import { useMemo } from "react";
import { diffLines, Change } from "diff";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WikiDiffViewerProps {
  original: string;
  modified: string;
  onAccept: () => void;
  onReject: () => void;
}

export function WikiDiffViewer({ original, modified, onAccept, onReject }: WikiDiffViewerProps) {
  const changes = useMemo(() => diffLines(original, modified), [original, modified]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
        <span className="text-sm font-medium">Alterações sugeridas pela IA</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onReject} className="h-7 text-xs gap-1">
            <X className="h-3 w-3" /> Rejeitar
          </Button>
          <Button size="sm" onClick={onAccept} className="h-7 text-xs gap-1">
            <Check className="h-3 w-3" /> Aceitar
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="font-mono text-xs leading-relaxed p-4">
          {changes.map((change: Change, i: number) => {
            const lines = change.value.replace(/\n$/, "").split("\n");
            return lines.map((line, j) => (
              <div
                key={`${i}-${j}`}
                className={cn(
                  "px-3 py-0.5 border-l-2",
                  change.added && "bg-green-500/10 border-l-green-500 text-green-300",
                  change.removed && "bg-red-500/10 border-l-red-500 text-red-300 line-through opacity-70",
                  !change.added && !change.removed && "border-l-transparent text-muted-foreground"
                )}
              >
                <span className="select-none mr-3 text-muted-foreground/50">
                  {change.added ? "+" : change.removed ? "-" : " "}
                </span>
                {line || " "}
              </div>
            ));
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
