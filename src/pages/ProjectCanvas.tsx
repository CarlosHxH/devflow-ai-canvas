import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { DiagramCanvas } from "@/components/canvas/DiagramCanvas";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function ProjectCanvas() {
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
    <AppLayout title={`${projectName || "Projeto"} — Canvas`}>
      <div className="space-y-4 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <DiagramCanvas projectId={projectId} />
      </div>
    </AppLayout>
  );
}
