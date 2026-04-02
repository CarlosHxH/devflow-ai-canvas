import { useState, useEffect, useCallback, useRef } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Save, Loader2, Download } from "lucide-react";

interface Props {
  projectId?: string;
}

export function ExcalidrawCanvas({ projectId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initialData, setInitialData] = useState<{
    elements: readonly ExcalidrawElement[];
    appState: Partial<AppState>;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  useEffect(() => {
    if (projectId) {
      loadCanvas();
    } else {
      setLoaded(true);
    }
  }, [projectId]);

  const loadCanvas = async () => {
    if (!projectId) { setLoaded(true); return; }
    const { data } = await supabase
      .from("canvases")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (data && data.length > 0) {
      const canvas = data[0];
      setCanvasId(canvas.id);
      if (canvas.react_flow_data) {
        const flowData = canvas.react_flow_data as any;
        if (flowData.elements) {
          setInitialData({
            elements: flowData.elements,
            appState: { ...flowData.appState, collaborators: new Map() },
          });
        }
      }
    }
    setLoaded(true);
  };

  const handleSave = async () => {
    if (!user || !projectId || !apiRef.current) return;
    setSaving(true);

    const elements = apiRef.current.getSceneElements();
    const appState = apiRef.current.getAppState();
    const saveData = {
      elements,
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        zoom: appState.zoom,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
      },
    };

    if (canvasId) {
      await supabase.from("canvases").update({
        react_flow_data: saveData as any,
      }).eq("id", canvasId);
    } else {
      const { data } = await supabase.from("canvases").insert({
        project_id: projectId,
        name: "Canvas Principal",
        react_flow_data: saveData as any,
        created_by: user.id,
      }).select("id").single();
      if (data) setCanvasId(data.id);
    }
    setSaving(false);
    toast({ title: "Canvas salvo!" });
  };

  const handleExport = async () => {
    if (!apiRef.current) return;
    try {
      const blob = await exportToBlob({
        elements: apiRef.current.getSceneElements(),
        appState: apiRef.current.getAppState(),
        files: apiRef.current.getFiles(),
        mimeType: "image/png",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "canvas.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-8rem)] border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        {projectId && (
          <Button size="sm" onClick={handleSave} disabled={saving} className="gradient-primary shadow-lg">
            {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={handleExport} className="shadow-lg bg-card">
          <Download className="h-3 w-3 mr-1" /> Exportar PNG
        </Button>
      </div>

      <Excalidraw
        excalidrawAPI={(api) => { apiRef.current = api; }}
        initialData={initialData ? {
          elements: initialData.elements as ExcalidrawElement[],
          appState: initialData.appState,
        } : undefined}
        theme="dark"
        langCode="pt-BR"
      />
    </div>
  );
}
