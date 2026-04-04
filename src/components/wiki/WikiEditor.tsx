import { useState, useEffect, useCallback, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Save, Eye, Code, Sparkles, Network, GitCompare } from "lucide-react";
import { MarkdownPreview } from "./MarkdownPreview";
import { WikiDiffViewer } from "./WikiDiffViewer";
import { MarkdownToolbar } from "./MarkdownToolbar";

interface WikiEditorProps {
  pageId: string;
  title: string;
  content: string;
  updatedAt: string;
  onSave: (title: string, content: string) => void;
  onGenerateDoc: (prompt: string) => Promise<string | void>;
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
  const [pendingDiff, setPendingDiff] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setTitle(initialTitle);
    setContent(initialContent);
    setHasChanges(false);
    setPendingDiff(null);
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

  const updateContent = useCallback((newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  }, []);

  const handleGenerateWithDiff = async () => {
    if (!aiPrompt.trim()) return;
    const generated = await onGenerateDoc(aiPrompt);
    if (generated && typeof generated === "string") {
      const newContent = content ? content + "\n\n" + generated : generated;
      setPendingDiff(newContent);
      setTab("diff");
    }
  };

  const handleAcceptDiff = () => {
    if (pendingDiff !== null) {
      setContent(pendingDiff);
      setHasChanges(true);
      setPendingDiff(null);
      setTab("edit");
    }
  };

  const handleRejectDiff = () => {
    setPendingDiff(null);
    setTab("edit");
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Header - Sem alterações */}
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
            <Badge variant="outline" className="text-xs text-warning border-warning/30">
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
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-2 border-b border-border">
          <TabsList className="bg-transparent h-8">
            <TabsTrigger value="edit" className="text-xs gap-1 h-7">
              <Code className="h-3 w-3" /> Editar
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs gap-1 h-7">
              <Eye className="h-3 w-3" /> Preview
            </TabsTrigger>
            {pendingDiff !== null && (
              <TabsTrigger value="diff" className="text-xs gap-1 h-7">
                <GitCompare className="h-3 w-3" /> Diff IA
                <Badge className="ml-1 h-4 px-1 text-[10px] bg-primary">novo</Badge>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* CORREÇÃO: Adicionado data-[state=active]:flex-1 e flex-col */}
        <TabsContent 
          value="edit" 
          className="m-0 overflow-hidden flex-col data-[state=active]:flex-1 data-[state=active]:flex"
        >
          <MarkdownToolbar
            textareaRef={textareaRef}
            content={content}
            onContentChange={updateContent}
          />
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => updateContent(e.target.value)}
            className="flex-1 w-full resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0 bg-transparent p-4"
            placeholder="Escreva em Markdown..."
          />
        </TabsContent>

        {/* CORREÇÃO: Preview agora ocupa todo o espaço e permite scroll interno */}
        <TabsContent 
          value="preview" 
          className="m-0 overflow-y-auto px-6 py-4 data-[state=active]:flex-1 data-[state=active]:flex flex-col"
        >
          <MarkdownPreview content={content} />
        </TabsContent>

        {pendingDiff !== null && (
          <TabsContent 
            value="diff" 
            className="m-0 overflow-hidden data-[state=active]:flex-1 data-[state=active]:flex flex-col"
          >
            <WikiDiffViewer
              original={content}
              modified={pendingDiff}
              onAccept={handleAcceptDiff}
              onReject={handleRejectDiff}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* AI Actions Bar - Sem alterações */}
      <div className="border-t border-border px-4 py-2 flex items-center gap-2 relative bottom-4">
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
        <Input
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Gerar documentação ou diagrama com IA..."
          className="h-7 text-xs flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && aiPrompt.trim()) {
              handleGenerateWithDiff();
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={!aiPrompt.trim() || isGenerating}
          onClick={handleGenerateWithDiff}
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
