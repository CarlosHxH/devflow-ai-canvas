import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { FolderKanban, ArrowRight, BookOpen, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const fetchProjects = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("workspace_id", currentWorkspace.id)
      .order("created_at", { ascending: false });
    setProjects(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, [currentWorkspace]);

  return (
    <AppLayout title="Projetos">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Projetos</h2>
            <p className="text-muted-foreground">Gerencie seus projetos e tarefas</p>
          </div>
          <CreateProjectDialog onCreated={fetchProjects} />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse"><CardHeader><div className="h-5 bg-muted rounded w-2/3" /><div className="h-3 bg-muted rounded w-1/2 mt-2" /></CardHeader></Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh]">
            <FolderKanban className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum projeto ainda</h3>
            <p className="text-muted-foreground mb-4">Crie seu primeiro projeto para começar</p>
            <CreateProjectDialog onCreated={fetchProjects} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card key={project.id} className="group hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate(`/projects/${project.id}/board`)}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {project.description && <CardDescription>{project.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}/board`); }}>
                      <FolderKanban className="h-3 w-3 mr-1" /> Board
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}/canvas`); }}>
                      <PenTool className="h-3 w-3 mr-1" /> Canvas
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}/wiki`); }}>
                      <BookOpen className="h-3 w-3 mr-1" /> Wiki
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
