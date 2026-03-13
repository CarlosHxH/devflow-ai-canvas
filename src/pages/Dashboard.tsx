import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { FolderKanban, PenTool, BookOpen, Plus, Sparkles } from "lucide-react";

export default function Dashboard() {
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();

  if (!currentWorkspace) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
          <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center shadow-glow mb-6">
            <Sparkles className="h-8 w-8 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Bem-vindo ao DevFlow OS</h2>
          <p className="text-muted-foreground mb-6 text-center max-w-md">
            Crie seu primeiro workspace para começar a gerenciar projetos, diagramas e documentação.
          </p>
          <Button onClick={() => navigate("/workspace/new")} className="gradient-primary shadow-glow">
            <Plus className="mr-2 h-4 w-4" />
            Criar Workspace
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{currentWorkspace.name}</h2>
          <p className="text-muted-foreground">Visão geral do workspace</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="group cursor-pointer hover:shadow-lg transition-all hover:border-primary/30" onClick={() => navigate("/projects")}>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:gradient-primary group-hover:shadow-glow transition-all">
                <FolderKanban className="h-5 w-5 text-primary group-hover:text-primary-foreground transition-colors" />
              </div>
              <div>
                <CardTitle className="text-base">Projetos</CardTitle>
                <CardDescription>Kanban & tarefas</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Gerencie tarefas com boards Kanban, checklists e filtros avançados.</p>
            </CardContent>
          </Card>

          <Card className="group cursor-pointer hover:shadow-lg transition-all hover:border-primary/30" onClick={() => navigate("/canvas")}>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent group-hover:shadow-glow transition-all">
                <PenTool className="h-5 w-5 text-accent group-hover:text-accent-foreground transition-colors" />
              </div>
              <div>
                <CardTitle className="text-base">Canvas & IA</CardTitle>
                <CardDescription>Diagramas inteligentes</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Crie diagramas com Mermaid.js e IA em um canvas infinito.</p>
            </CardContent>
          </Card>

          <Card className="group cursor-pointer hover:shadow-lg transition-all hover:border-primary/30" onClick={() => navigate("/docs")}>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center group-hover:bg-success group-hover:shadow-glow transition-all">
                <BookOpen className="h-5 w-5 text-success group-hover:text-success-foreground transition-colors" />
              </div>
              <div>
                <CardTitle className="text-base">Documentação</CardTitle>
                <CardDescription>Wiki do projeto</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Documentação Markdown com assistente IA contextual.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
