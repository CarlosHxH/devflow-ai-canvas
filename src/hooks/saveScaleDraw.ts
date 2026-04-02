import { supabase } from "@/integrations/supabase/client";

const saveScaleDraw = async (scaleDraw: string, projectId: string, userId: string): Promise<string | null> => {
  const { data, error } = await supabase.from("canvases").insert({
    mermaid_code: scaleDraw,
    project_id: projectId,
    created_by: userId,
  }).select("id").single();
  if (error) {
    console.error("Error saving scale draw:", error);
    return null;
  }
  return data?.id;
};

const getScaleDraw = async (id: string): Promise<string | null> => {
  const { data, error } = await supabase.from("canvases").select("mermaid_code, project_id, created_by").eq("id", id).single();
  if (error) {
    console.error("Error getting scale draw:", error);
    return null;
  }
  return data?.mermaid_code;
};

export { saveScaleDraw, getScaleDraw };