import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function ProjectBoard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    if (!projectId) return;
    supabase.from("projects").select("name").eq("id", projectId).single().then(({ data }) => {
      if (data) setProjectName(data.name);
    });
  }, [projectId]);

  if (!projectId) return null;

  return (
    <AppLayout title={projectName || "Board"}>
      <div className="space-y-4 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <KanbanBoard projectId={projectId} />
      </div>
    </AppLayout>
  );
}
