import { useState, useEffect, useCallback, useRef } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
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

    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load SVG image"));
      image.src = svgDataUrl;
    });

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgStr, "image/svg+xml");
    const svgEl = svgDoc.querySelector("svg");
    let imgWidth = img.naturalWidth || 800;
    let imgHeight = img.naturalHeight || 600;
    if (svgEl) {
      const vb = svgEl.getAttribute("viewBox");
      if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          imgWidth = parts[2];
          imgHeight = parts[3];
        }
      }
      const w = parseFloat(svgEl.getAttribute("width") || "0");
      const h = parseFloat(svgEl.getAttribute("height") || "0");
      if (w > 0 && h > 0) { imgWidth = w; imgHeight = h; }
    }
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = imgWidth * scale;
    canvas.height = imgHeight * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataURL = canvas.toDataURL("image/png");

    const fileId = generateId();
    const element = {
      id: generateId(),
      type: "image" as const,
      x: 100,
      y: 100,
      width: imgWidth,
      height: imgHeight,
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
      fileId: fileId as any,
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
    files?: BinaryFiles;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  // AI prompt state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [userGeminiKey, setUserGeminiKey] = useState<string | null>(null);

  // Realtime state
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelStatusRef = useRef<string>("");
  const isRemoteUpdate = useRef(false);
  const broadcastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteCollaboratorsRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (projectId || currentWorkspace) {
      loadCanvas();
    } else {
      setLoaded(true);
    }
  }, [projectId, currentWorkspace]);

  // Fetch user's Gemini API key
  useEffect(() => {
    if (!user) return;
    (supabase.from("user_settings") as any)
      .select("gemini_api_key")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.gemini_api_key) setUserGeminiKey(data.gemini_api_key);
      });
  }, [user]);

  // Track known file IDs to only send new ones
  const sentFileIds = useRef<Set<string>>(new Set());

  const handlePointerUpdate = useCallback((payload: { pointer: { x: number; y: number }; button: string }) => {
    if (!channelRef.current || !user || channelStatusRef.current !== "SUBSCRIBED") return;
    if (pointerTimerRef.current) clearTimeout(pointerTimerRef.current);
    pointerTimerRef.current = setTimeout(() => {
      channelRef.current?.send({
        type: "broadcast",
        event: "cursor-update",
        payload: {
          pointer: payload.pointer,
          button: payload.button,
          senderId: user.id,
          username: user.user_metadata?.full_name || user.email || "Anônimo",
        },
      }).catch(() => {});
    }, 50);
  }, [user]);

  const handleSceneChange = useCallback(() => {
    if (isRemoteUpdate.current) return;
    if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current);

    broadcastTimerRef.current = setTimeout(() => {
      if (
        !channelRef.current ||
        !apiRef.current ||
        !user ||
        channelStatusRef.current !== "SUBSCRIBED"
      ) return;

      const elements = apiRef.current.getSceneElements();
      const allFiles = apiRef.current.getFiles();
      const appState = apiRef.current.getAppState();

      const newFiles: Record<string, any> = {};
      for (const [id, file] of Object.entries(allFiles)) {
        if (!sentFileIds.current.has(id)) {
          newFiles[id] = file;
          sentFileIds.current.add(id);
        }
      }

      channelRef.current.send({
        type: "broadcast",
        event: "scene-update",
        payload: {
          elements: JSON.parse(JSON.stringify(elements)),
          files: Object.keys(newFiles).length > 0 ? newFiles : null,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor,
            zoom: appState.zoom,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
          },
          senderId: user.id,
        },
      }).catch((err: any) => console.warn("Broadcast error:", err));
    }, 250);
  }, [user]);

  // Realtime collaboration
  useEffect(() => {
    const contextId = projectId || currentWorkspace?.id;
    if (!contextId || !user) return;

    const channelName = `canvas:${contextId}`;

    // ✅ Remove canal anterior antes de criar novo
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      channelStatusRef.current = "";
    }

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "scene-update" }, (payload: any) => {
        if (!apiRef.current) return;
        const { elements, files, appState, senderId } = payload.payload;
        if (senderId === user.id) return;

        isRemoteUpdate.current = true;
        
        try {
          apiRef.current.updateScene({ elements, appState });

          if (files && Object.keys(files).length > 0) {
            apiRef.current.addFiles(Object.values(files) as any);
          }
        } catch (err) {
          console.warn("Error applying remote scene:", err);
        }

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            isRemoteUpdate.current = false;
          });
        });
      })
      .on("broadcast", { event: "cursor-update" }, (payload: any) => {
        if (!apiRef.current) return;
        const { pointer, button, senderId, username } = payload.payload;
        if (senderId === user.id) return;

        remoteCollaboratorsRef.current.set(senderId, {
          username,
          pointer,
          button,
        });

        const collaboratorsMap = new Map<string, any>();
        remoteCollaboratorsRef.current.forEach((value, key) => {
          collaboratorsMap.set(key, value);
        });

        apiRef.current.updateScene({ collaborators: collaboratorsMap as any });
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const presentUserIds = new Set(
          Object.values(state).flat().map((p: any) => p.user_id).filter(Boolean)
        );
        const users = Object.values(state)
          .flat()
          .map((p: any) => p.name)
          .filter(Boolean);
        setCollaborators(
          users.filter((u) => u !== (user.user_metadata?.full_name || user.email))
        );

        // Clean up collaborators who left
        for (const id of remoteCollaboratorsRef.current.keys()) {
          if (!presentUserIds.has(id)) {
            remoteCollaboratorsRef.current.delete(id);
          }
        }
        if (apiRef.current) {
          const collaboratorsMap = new Map<string, any>();
          remoteCollaboratorsRef.current.forEach((value, key) => {
            collaboratorsMap.set(key, value);
          });
          apiRef.current.updateScene({ collaborators: collaboratorsMap as any });
        }
      })
      .subscribe(async (status) => {
        channelStatusRef.current = status;

        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            name: user.user_metadata?.full_name || user.email || "Anônimo",
            online_at: new Date().toISOString(),
          });
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Canal perdido, tentando reconectar...");
          setTimeout(() => {
            supabase.removeChannel(channel);
            channelRef.current = null;
            channelStatusRef.current = "";
            setCollaborators([]);
          }, 3000);
        }
      });

    channelRef.current = channel;

    return () => {
      if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current);
      if (pointerTimerRef.current) clearTimeout(pointerTimerRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
      channelStatusRef.current = "";
      remoteCollaboratorsRef.current.clear();
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
            files: files as BinaryFiles,
          });
        }
      }
    } else {
      setInitialData(null);
      setCanvasId(null);
    }
    setLoaded(true);
  };

  const handleSave = async () => {
    if (!user || (!projectId && !currentWorkspace) || !apiRef.current) return;
    setSaving(true);

    const elements = apiRef.current.getSceneElements();
    const appState = apiRef.current.getAppState();
    const files = apiRef.current.getFiles();
    const saveData = {
      elements,
      files,
      appState: {
        viewBackgroundColor: (appState as any).viewBackgroundColor,
        zoom: appState.zoom,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
      },
    };

    if (canvasId) {
      await supabase.from("canvases").update({ react_flow_data: saveData as any }).eq("id", canvasId);
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
        body: { prompt: aiPrompt.trim(), gemini_api_key: userGeminiKey || undefined },
      });
      if (error) throw error;
      if (!data?.mermaid_code) throw new Error("Sem código Mermaid na resposta");

      const result = await mermaidToImageElement(data.mermaid_code);
      if (!result) throw new Error("Erro ao renderizar diagrama");

      const appState = apiRef.current.getAppState();
      result.element.x =
        -appState.scrollX + window.innerWidth / 2 / appState.zoom.value - result.element.width / 2;
      result.element.y =
        -appState.scrollY + window.innerHeight / 2 / appState.zoom.value - result.element.height / 2;

      apiRef.current.addFiles([result.file as any]);
      const currentElements = apiRef.current.getSceneElements();
      apiRef.current.updateScene({ elements: [...currentElements, result.element] });

      toast({ title: "Diagrama inserido no canvas!" });
      setAiPrompt("");
      setShowAiPanel(false);
      setTimeout(handleSceneChange, 200); // ✅ propaga via broadcast
    } catch (e: unknown) {
      const error = e as Error;
      toast({ title: "Erro ao gerar diagrama", description: error?.message, variant: "destructive" });
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
            <span className="text-xs text-muted-foreground">
              {collaborators.length} outro(s) online
            </span>
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
        initialData={
          initialData
            ? {
                elements: initialData.elements as ExcalidrawElement[],
                appState: initialData.appState,
              }
            : undefined
        }
        theme="dark"
        langCode="pt-BR"
        onChange={handleSceneChange}
        onPointerUpdate={handlePointerUpdate}
      />
    </div>
  );
}