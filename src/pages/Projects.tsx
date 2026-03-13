import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban } from "lucide-react";

export default function Projects() {
  return (
    <AppLayout title="Projetos">
      <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
        <FolderKanban className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Projetos (em breve)</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Kanban boards, tarefas com checklists, filtros e atribuições serão implementados na Fase 2.
        </p>
      </div>
    </AppLayout>
  );
}
