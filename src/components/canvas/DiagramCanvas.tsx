import { useState, useCallback, useEffect } from "react";
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, addEdge, Connection, Node, BackgroundVariant } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { MermaidRenderer } from "./MermaidRenderer";
import { AiPromptPanel } from "./AiPromptPanel";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Code, Eye } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Props {
  projectId: string;
}

// Custom node that renders mermaid
function MermaidNode({ data }: { data: { code: string } }) {
  return (
    <div className="bg-card border rounded-lg p-4 min-w-[300px] max-w-[600px] shadow-lg">
      <MermaidRenderer code={data.code} />
    </div>
  );
}

const nodeTypes = { mermaid: MermaidNode };

export function DiagramCanvas({ projectId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [mermaidCode, setMermaidCode] = useState("graph TD\n  A[Início] --> B[Processo]\n  B --> C{Decisão}\n  C -->|Sim| D[Resultado A]\n  C -->|Não| E[Resultado B]");
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"code" | "preview">("preview");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCanvas();
  }, [projectId]);

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
      if (canvas.react_flow_data) {
        const flowData = canvas.react_flow_data as any;
        if (flowData.nodes) setNodes(flowData.nodes);
        if (flowData.edges) setEdges(flowData.edges);
      }
    }
  };

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const addMermaidNode = () => {
    const newNode: Node = {
      id: `mermaid-${Date.now()}`,
      type: "mermaid",
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: { code: mermaidCode },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const flowData = { nodes, edges };

    if (canvasId) {
      await supabase.from("canvases").update({
        mermaid_code: mermaidCode,
        react_flow_data: flowData as any,
      }).eq("id", canvasId);
    } else {
      const { data } = await supabase.from("canvases").insert({
        project_id: projectId,
        name: "Canvas Principal",
        mermaid_code: mermaidCode,
        react_flow_data: flowData as any,
        created_by: user.id,
      }).select("id").single();
      if (data) setCanvasId(data.id);
    }
    setSaving(false);
    toast({ title: "Canvas salvo!" });
  };

  const handleAiGenerated = (code: string) => {
    setMermaidCode(code);
    // Also add as a node on the canvas
    const newNode: Node = {
      id: `mermaid-${Date.now()}`,
      type: "mermaid",
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: { code },
    };
    setNodes((nds) => [...nds, newNode]);
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
            <Button size="sm" variant="outline" onClick={addMermaidNode} className="flex-1">
              <Plus className="h-3 w-3 mr-1" /> Ao Canvas
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 gradient-primary">
              <Save className="h-3 w-3 mr-1" /> {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 border rounded-lg overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-30" />
          <Controls className="[&_button]:bg-card [&_button]:border-border" />
          <MiniMap className="bg-card border border-border" />
        </ReactFlow>
      </div>
    </div>
  );
}
