import { AppLayout } from "@/components/layout/AppLayout";
import { PenTool } from "lucide-react";

export default function Canvas() {
  return (
    <AppLayout title="Canvas & IA">
      <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
        <PenTool className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Canvas com IA (em breve)</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Canvas infinito com React Flow, Mermaid.js e geração de diagramas via IA na Fase 3.
        </p>
      </div>
    </AppLayout>
  );
}
