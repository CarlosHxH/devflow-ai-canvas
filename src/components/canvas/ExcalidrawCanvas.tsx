import { useState, useEffect, useCallback, useRef } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, Download, Sparkles, Users, X } from "lucide-react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" });

interface Props {
  projectId?: string;
}

function generateId() {
  return Math.random().toString(36).slice(2, 12);
}

async function mermaidToImageElement(
  code: string
): Promise<{ element: any; fileId: string; file: { mimeType: string; id: string; dataURL: string; created: number } } | null> {
  try {
    const id = `mermaid-render-${Date.now()}`;
    const { svg: svgStr } = await mermaid.render(id, code.trim());

    // Convert SVG string to a blob then to data URL
    const svgBlob = new Blob([svgStr], { type: "image/svg+xml" });
    const bitmap = await createImageBitmap(svgBlob);
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = bitmap.width * scale;
    canvas.height = bitmap.height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(bitmap, 0, 0);
    const dataURL = canvas.toDataURL("image/png");

    const fileId = generateId();
    const element = {
      id: generateId(),
      type: "image" as const,
      x: 100,
      y: 100,
      width: bitmap.width,
      height: bitmap.height,
      angle: 0,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: "solid" as const,
      strokeWidth: 0,
      strokeStyle: "solid" as const,
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      index: null,
      roundness: null,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 100000),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      status: "saved" as const,
      fileId,
      scale: [1, 1] as [number, number],
      crop: null,
    };

    const file = {
      mimeType: "image/png" as const,
      id: fileId,
      dataURL,
      created: Date.now(),
    };

    return { element, fileId, file };
  } catch (e) {
    console.error("Mermaid render error:", e);
    return null;
  }
}

export function ExcalidrawCanvas({ projectId }: Props) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initialData, setInitialData] = useState<{
    elements: readonly ExcalidrawElement[];
    appState: Partial<AppState>;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  // AI prompt state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Realtime state
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const channelRef = useRef<any>(null);
  const isRemoteUpdate = useRef(false);

  useEffect(() => {
    if (projectId || currentWorkspace) {
      loadCanvas();
    } else if (!projectId && !currentWorkspace) {
      setLoaded(true);
    }
  }, [projectId, currentWorkspace]);

  // Realtime collaboration
  useEffect(() => {
    const contextId = projectId || currentWorkspace?.id;
    if (!contextId || !user) return;

    const channelName = `canvas:${contextId}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "scene-update" }, (payload: any) => {
        if (!apiRef.current) return;
        const { elements, files, senderId } = payload.payload;
        if (senderId === user.id) return;

        isRemoteUpdate.current = true;
        apiRef.current.updateScene({ elements });
        if (files) {
          apiRef.current?.addFiles(Object.values(files));
        }
        setTimeout(() => { isRemoteUpdate.current = false; }, 100);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat().map((p: any) => p.name).filter(Boolean);
        setCollaborators(users.filter(u => u !== (user.user_metadata?.full_name || user.email)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            name: user.user_metadata?.full_name || user.email || "Anônimo",
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [projectId, currentWorkspace, user]);

  const loadCanvas = async () => {
    const query = supabase.from("canvases").select("*") as any;
    
    if (projectId) {
      query.eq("project_id", projectId);
    } else if (currentWorkspace) {
      query.eq("workspace_id", currentWorkspace.id).is("project_id", null);
    } else {
      setLoaded(true);
      return;
    }

    const { data } = await query.order("created_at", { ascending: true }).limit(1);

    if (data && data.length > 0) {
      const canvas = data[0];
      setCanvasId(canvas.id);
      if (canvas.react_flow_data) {
        const flowData = canvas.react_flow_data as any;
        if (flowData.elements) {
          const files = flowData.files || {};
          setInitialData({
            elements: flowData.elements,
            appState: { 
              ...flowData.appState,
              theme: "dark",
            },
          });
          // Restore files after mount
          setTimeout(() => {
            if (apiRef.current && Object.keys(files).length > 0) {
              apiRef.current.addFiles(Object.values(files));
            }
          }, 500);
        }
      }
    } else {
      setInitialData(null);
      setCanvasId(null);
    }
    setLoaded(true);
  };

  const broadcastScene = useCallback(() => {
    if (!channelRef.current || !apiRef.current || isRemoteUpdate.current || !user) return;
    const elements = apiRef.current.getSceneElements();
    const files = apiRef.current.getFiles();
    channelRef.current.send({
      type: "broadcast",
      event: "scene-update",
      payload: { elements, files, senderId: user.id },
    });
  }, [user]);

  // Debounced broadcast on scene change
  const broadcastTimerRef = useRef<any>(null);
  const handleSceneChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      if (isRemoteUpdate.current) return;
      if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current);
      broadcastTimerRef.current = setTimeout(broadcastScene, 200);
    },
    [broadcastScene]
  );

  const handleSave = async () => {
    if (!user || (!projectId && !currentWorkspace) || !apiRef.current) return;
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
      const insertData: any = {
        name: projectId ? "Project Canvas" : "Workspace Canvas",
        react_flow_data: saveData as any,
        created_by: user.id,
      };
      
      if (projectId) {
        insertData.project_id = projectId;
      } else {
        insertData.workspace_id = currentWorkspace?.id;
      }

      const { data } = await supabase.from("canvases").insert(insertData).select("id").single();
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

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || !apiRef.current) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-diagram", {
        body: { prompt: aiPrompt.trim() },
      });
      if (error) throw error;
      if (!data?.mermaid_code) throw new Error("Sem código Mermaid na resposta");

      const result = await mermaidToImageElement(data.mermaid_code);
      if (!result) throw new Error("Erro ao renderizar diagrama");

      const appState = apiRef.current.getAppState();
      const centerX = -appState.scrollX + (window.innerWidth / 2 / appState.zoom.value) - result.element.width / 2;
      const centerY = -appState.scrollY + (window.innerHeight / 2 / appState.zoom.value) - result.element.height / 2;
      result.element.x = centerX;
      result.element.y = centerY;

      apiRef.current.addFiles([result.file as any]);
      const currentElements = apiRef.current.getSceneElements();
      apiRef.current.updateScene({
        elements: [...currentElements, result.element as any],
      });

      toast({ title: "Diagrama inserido no canvas!" });
      setAiPrompt("");
      setShowAiPanel(false);
      setTimeout(broadcastScene, 200);
    } catch (e: any) {
      toast({ title: "Erro ao gerar diagrama", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
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
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        {collaborators.length > 0 && (
          <div className="flex items-center gap-1 bg-card/90 backdrop-blur-sm border rounded-md px-2 py-1 shadow-lg">
            <Users className="h-3 w-3 text-emerald-500" />
            <span className="text-xs text-muted-foreground">{collaborators.length} outro(s) online</span>
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAiPanel(!showAiPanel)}
          className="shadow-lg bg-card"
        >
          <Sparkles className="h-3 w-3 mr-1" /> IA
        </Button>

        {(projectId || currentWorkspace) && (
          <Button size="sm" onClick={handleSave} disabled={saving} className="gradient-primary shadow-lg">
            {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={handleExport} className="shadow-lg bg-card">
          <Download className="h-3 w-3 mr-1" /> PNG
        </Button>
      </div>

      {showAiPanel && (
        <div className="absolute top-14 right-3 z-10 w-80 bg-card/95 backdrop-blur-sm border rounded-lg shadow-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Gerar Diagrama com IA
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAiPanel(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Descreva o diagrama..."
            className="min-h-[80px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAiGenerate();
            }}
          />
          <Button
            onClick={handleAiGenerate}
            disabled={aiLoading || !aiPrompt.trim()}
            className="w-full gradient-primary"
            size="sm"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {aiLoading ? "Gerando..." : "Inserir no Canvas"}
          </Button>
        </div>
      )}

      <Excalidraw
        excalidrawAPI={(api) => { apiRef.current = api; }}
        initialData={initialData ? {
          elements: initialData.elements as ExcalidrawElement[],
          appState: initialData.appState,
        } : undefined}
        theme="dark"
        langCode="pt-BR"
        onChange={handleSceneChange}
      />
    </div>
  );
}
