import { useState, useEffect } from "react";
import { MermaidRenderer } from "@/components/canvas/MermaidRenderer";
import { AiPromptPanel } from "@/components/canvas/AiPromptPanel";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Save, Code, Eye, ArrowRight } from "lucide-react";
import { Excalidraw } from "@excalidraw/excalidraw";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";

interface Props {
  projectId: string;
}

export function DiagramCanvas({ projectId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [mermaidCode, setMermaidCode] = useState("graph TD\n  A[Início] --> B[Processo]\n  B --> C{Decisão}\n  C -->|Sim| D[Resultado A]\n  C -->|Não| E[Resultado B]");
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"code" | "preview">("preview");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (excalidrawAPI) {
      loadCanvas();
    }
  }, [projectId, excalidrawAPI]);

  const loadCanvas = async () => {
    const { data } = await supabase
      .from("canvases")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (data && data.length > 0) {
      const canvas = data[0];
      setCanvasId(canvas.id);
      if (canvas.mermaid_code) setMermaidCode(canvas.mermaid_code);
      if (canvas.react_flow_data && (canvas.react_flow_data as any).elements) {
        const flowData = canvas.react_flow_data as any;
        excalidrawAPI.updateScene({
          elements: flowData.elements || [],
          appState: flowData.appState || {}
        });
      }
    }
  };

  const insertMermaidToExcalidraw = async (code: string) => {
    if (!excalidrawAPI) return;
    try {
      const { elements } = await parseMermaidToExcalidraw(code, {
        fontSize: 20,
      });
      // Recupera elementos atuais
      const currentElements = excalidrawAPI.getSceneElements();
      // Move os novos elementos pra direita
      const offsetX = 50;
      const offsetY = 50;
      const positionedElements = elements.map(el => ({
        ...el,
        x: el.x + offsetX,
        y: el.y + offsetY
      }));
      excalidrawAPI.updateScene({ elements: [...currentElements, ...positionedElements] });
    } catch (e) {
      console.error("Error parsing mermaid to excalidraw", e);
      toast({ title: "Erro na conversão", description: "Não foi possível enviar o gráfico para o canvas", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!user || !excalidrawAPI) return;
    setSaving(true);
    
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    
    // Filtramos o appState para não salvar dados gigantes ou transientes
    const flowData = { 
      elements, 
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        currentItemFontFamily: appState.currentItemFontFamily,
        theme: appState.theme
      } 
    };

    if (canvasId) {
      await supabase.from("canvases").update({
        mermaid_code: mermaidCode,
        react_flow_data: flowData as any,
      }).eq("id", canvasId);
    } else {
      const { data } = await supabase.from("canvases").insert({
        project_id: projectId,
        name: "Canvas Excalidraw",
        mermaid_code: mermaidCode,
        react_flow_data: flowData as any,
        created_by: user.id,
      }).select("id").single();
      if (data) setCanvasId(data.id);
    }
    setSaving(false);
    toast({ title: "Quadro salvo com sucesso!" });
  };

  const handleAiGenerated = (code: string) => {
    setMermaidCode(code);
    insertMermaidToExcalidraw(code);
  };

  const handleInsertManual = () => {
    insertMermaidToExcalidraw(mermaidCode);
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <div className="w-80 shrink-0 space-y-4 overflow-y-auto">
        <AiPromptPanel onGenerated={handleAiGenerated} />

        <div className="space-y-2 p-4 border rounded-lg bg-card">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Editor Mermaid</span>
            <div className="flex gap-1">
              <Button variant={viewMode === "code" ? "secondary" : "ghost"} size="icon" className="h-6 w-6" onClick={() => setViewMode("code")}>
                <Code className="h-3 w-3" />
              </Button>
              <Button variant={viewMode === "preview" ? "secondary" : "ghost"} size="icon" className="h-6 w-6" onClick={() => setViewMode("preview")}>
                <Eye className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {viewMode === "code" ? (
            <Textarea
              value={mermaidCode}
              onChange={(e) => setMermaidCode(e.target.value)}
              className="font-mono text-xs min-h-[200px] resize-none"
              placeholder="graph TD..."
            />
          ) : (
            <div className="border rounded p-2 min-h-[200px] bg-background">
              <MermaidRenderer code={mermaidCode} />
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleInsertManual} className="flex-1">
              <ArrowRight className="h-3 w-3 mr-1" /> Ao Quadro
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 gradient-primary">     
              <Save className="h-3 w-3 mr-1" /> {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Diagramas Mermaid e telas da IA são convertidos para desenho livre!
          </p>
        </div>
      </div>

      {/* Canvas - Excalidraw */}
      <div className="flex-1 relative border rounded-lg overflow-hidden bg-background" style={{ height: "100%", width: "100%" }}>
        <Excalidraw 
          excalidrawAPI={(api) => setExcalidrawAPI(api)} 
          langCode="pt-BR"
          UIOptions={{
            canvasActions: {
              toggleTheme: true,
              export: { saveFileToDisk: true },
              saveAsImage: true,
              clearCanvas: true,
              loadScene: false
            }
          }}
        />
      </div>
    </div>
  );
}




