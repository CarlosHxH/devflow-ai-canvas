import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MermaidRenderer } from "@/components/canvas/MermaidRenderer";
import { AiPromptPanel } from "@/components/canvas/AiPromptPanel";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Code, Eye, Plus, Download } from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

function MermaidNode({ data }: { data: { code: string } }) {
  return (
    <div className="bg-card border rounded-lg p-4 min-w-[300px] max-w-[600px] shadow-lg">
      <MermaidRenderer code={data.code} />
    </div>
  );
}

const nodeTypes = { mermaid: MermaidNode };

export default function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [mermaidCode, setMermaidCode] = useState(
    "graph TD\n  A[Início] --> B[Processo]\n  B --> C{Decisão}\n  C -->|Sim| D[Resultado A]\n  C -->|Não| E[Resultado B]"
  );
  const [viewMode, setViewMode] = useState<"code" | "preview">("preview");

  const onConnect = (params: Connection) =>
    setEdges((eds) => addEdge(params, eds));

  const addMermaidNode = () => {
    const newNode: Node = {
      id: `mermaid-${Date.now()}`,
      type: "mermaid",
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: { code: mermaidCode },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleAiGenerated = (code: string) => {
    setMermaidCode(code);
    const newNode: Node = {
      id: `mermaid-${Date.now()}`,
      type: "mermaid",
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: { code },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  return (
    <AppLayout title="Canvas & IA">
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

            <Button size="sm" variant="outline" onClick={addMermaidNode} className="w-full">
              <Plus className="h-3 w-3 mr-1" /> Adicionar ao Canvas
            </Button>
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
    </AppLayout>
  );
}
