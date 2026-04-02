import { useState } from "react";
import { MermaidRenderer } from "@/components/canvas/MermaidRenderer";
import { AiPromptPanel } from "@/components/canvas/AiPromptPanel";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Code, Eye, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Excalidraw } from "@excalidraw/excalidraw";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";

export default function Canvas() {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"code" | "preview">("preview");
  const [mermaidCode, setMermaidCode] = useState(
    "graph TD\n  A[Início] --> B[Processo]\n  B --> C{Decisão}\n  C -->|Sim| D[Resultado A]\n  C -->|Não| E[Resultado B]"
  );

  const insertMermaidToExcalidraw = async (code: string) => {
    if (!excalidrawAPI) return;
    try {
      const { elements } = await parseMermaidToExcalidraw(code, {
        fontSize: 20,
      });
      const currentElements = excalidrawAPI.getSceneElements();
      const offsetX = 100;
      const offsetY = 100;
      const positionedElements = elements.map(el => ({
        ...el,
        x: el.x + offsetX,
        y: el.y + offsetY
      }));
      excalidrawAPI.updateScene({ elements: [...currentElements, ...positionedElements] });
    } catch (e) {
      console.error("Error parsing mermaid to excalidraw", e);
    }
  };

  const handleAiGenerated = (code: string) => {
    setMermaidCode(code);
    insertMermaidToExcalidraw(code);
  };

  const handleInsertManual = () => {
    insertMermaidToExcalidraw(mermaidCode);
  };

  return (
    <AppLayout title="Canvas & IA (Excalidraw)">
      <div className="flex gap-4 h-[calc(100vh-8rem)] animate-fade-in">
        {/* Sidebar */}
        <div className="w-80 shrink-0 space-y-4 overflow-y-auto">
          <AiPromptPanel onGenerated={handleAiGenerated} />

          <div className="space-y-2 p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Editor Mermaid</span>
              <div className="flex gap-1">
                <Button
                  variant={viewMode === "code" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setViewMode("code")}
                >
                  <Code className="h-3 w-3" />
                </Button>
                <Button
                  variant={viewMode === "preview" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setViewMode("preview")}
                >
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

            <Button size="sm" variant="outline" onClick={handleInsertManual} className="w-full">
              <ArrowRight className="h-3 w-3 mr-1" /> Enviar para o Canvas
            </Button>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              A IA pode gerar diagramas e inseri-los automaticamente no seu quadro branco!
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
    </AppLayout>
  );
}


