import { AppLayout } from "@/components/layout/AppLayout";
import { BarChart3 } from "lucide-react";

export default function Reports() {
  return (
    <AppLayout title="Relatórios">
      <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
        <BarChart3 className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Dashboard (em breve)</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Progresso por projeto, burndown charts e distribuição de tarefas na Fase 5.
        </p>
      </div>
    </AppLayout>
  );
}
