import { useState, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { Save, Eye, Code, Sparkles, Network } from "lucide-react";
import { cn } from "@/lib/utils";

interface WikiEditorProps {
  pageId: string;
  title: string;
  content: string;
  updatedAt: string;
  onSave: (title: string, content: string) => void;
  onGenerateDoc: (prompt: string) => void;
  onGenerateDiagram: (prompt: string) => void;
  isSaving: boolean;
  isGenerating: boolean;
}

export function WikiEditor({
  pageId,
  title: initialTitle,
  content: initialContent,
  updatedAt,
  onSave,
  onGenerateDoc,
  onGenerateDiagram,
  isSaving,
  isGenerating,
}: WikiEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [tab, setTab] = useState<string>("edit");
  const [aiPrompt, setAiPrompt] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setTitle(initialTitle);
    setContent(initialContent);
    setHasChanges(false);
  }, [pageId, initialTitle, initialContent]);

  const handleSave = useCallback(() => {
    onSave(title, content);
    setHasChanges(false);
  }, [title, content, onSave]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setHasChanges(true);
          }}
          className="text-lg font-semibold border-none bg-transparent px-0 h-auto focus-visible:ring-0"
          placeholder="Título da página"
        />
        <div className="flex items-center gap-2 shrink-0">
          {hasChanges && (
            <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/30">
              Não salvo
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {new Date(updatedAt).toLocaleString("pt-BR")}
          </span>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="h-3.5 w-3.5 mr-1" />
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
        <div className="px-4 pt-2 border-b border-border">
          <TabsList className="bg-transparent h-8">
            <TabsTrigger value="edit" className="text-xs gap-1 h-7">
              <Code className="h-3 w-3" /> Editar
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs gap-1 h-7">
              <Eye className="h-3 w-3" /> Preview
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="edit" className="flex-1 m-0 overflow-hidden">
          <Textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setHasChanges(true);
            }}
            className="h-full w-full resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0 bg-transparent"
            placeholder="Escreva em Markdown..."
          />
        </TabsContent>

        <TabsContent value="preview" className="flex-1 m-0 overflow-auto px-6 py-4">
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{content || "*Sem conteúdo*"}</ReactMarkdown>
          </div>
        </TabsContent>
      </Tabs>

      {/* AI Actions Bar */}
      <div className="border-t border-border px-4 py-2 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
        <Input
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Gerar documentação ou diagrama com IA..."
          className="h-7 text-xs flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && aiPrompt.trim()) {
              onGenerateDoc(aiPrompt);
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={!aiPrompt.trim() || isGenerating}
          onClick={() => onGenerateDoc(aiPrompt)}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          Doc
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={!aiPrompt.trim() || isGenerating}
          onClick={() => onGenerateDiagram(aiPrompt)}
        >
          <Network className="h-3 w-3 mr-1" />
          Diagrama
        </Button>
      </div>
    </div>
  );
}
