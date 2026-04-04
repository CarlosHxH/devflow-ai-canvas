import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { WikiPageList, type WikiPage } from "@/components/wiki/WikiPageList";
import { WikiEditor } from "@/components/wiki/WikiEditor";
import { WikiAiChat } from "@/components/wiki/WikiAiChat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bot, BookOpen } from "lucide-react";
import { toast } from "sonner";

export default function ProjectWiki() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projectName, setProjectName] = useState("");
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const fetchPages = useCallback(async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from("wiki_pages")
      .select("id, title, parent_id, position, content_markdown, created_at, updated_at")
      .eq("project_id", projectId)
      .order("position");
    if (data) setPages(data as WikiPage[]);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single()
      .then(({ data }) => {
        if (data) setProjectName(data.name);
      });
    fetchPages();
  }, [projectId, fetchPages]);

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  const handleCreatePage = async (parentId?: string) => {
    if (!projectId || !user) return;
    const position = pages.filter((p) => p.parent_id === (parentId || null)).length;
    const { data, error } = await supabase
      .from("wiki_pages")
      .insert({
        project_id: projectId,
        parent_id: parentId || null,
        title: "Nova página",
        content_markdown: "",
        created_by: user.id,
        position,
      })
      .select()
      .single();
    if (error) {
      toast.error("Erro ao criar página");
      return;
    }
    if (data) {
      await fetchPages();
      setSelectedPageId(data.id);
    }
  };

  const handleDeletePage = async (id: string) => {
    const { error } = await supabase.from("wiki_pages").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir página");
      return;
    }
    if (selectedPageId === id) setSelectedPageId(null);
    fetchPages();
  };

  const handleSave = async (title: string, content: string) => {
    if (!selectedPageId) return;
    setIsSaving(true);
    const { error } = await supabase
      .from("wiki_pages")
      .update({ title, content_markdown: content })
      .eq("id", selectedPageId);
    if (error) toast.error("Erro ao salvar");
    else {
      toast.success("Página salva");
      fetchPages();
    }
    setIsSaving(false);
  };

  const handleGenerateDoc = async (prompt: string): Promise<string | void> => {
    if (!selectedPage) return;
    setIsGenerating(true);
    let generated = "";

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wiki-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            type: "generate_doc",
            messages: [
              {
                role: "user",
                content: `Contexto atual do documento:\nTítulo: ${selectedPage.title}\nConteúdo:\n${selectedPage.content_markdown}\n\nSolicitação: ${prompt}`,
              },
            ],
          }),
        }
      );

      if (!resp.ok || !resp.body) throw new Error("Erro");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) generated += content;
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (generated) {
        return generated;
      }
    } catch {
      toast.error("Erro ao gerar documentação");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateDiagram = async (prompt: string) => {
    if (!selectedPage) return;
    setIsGenerating(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wiki-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            type: "generate_mermaid",
            messages: [
              {
                role: "user",
                content: `Baseado neste documento:\nTítulo: ${selectedPage.title}\nConteúdo:\n${selectedPage.content_markdown}\n\nGere um diagrama Mermaid para: ${prompt}`,
              },
            ],
          }),
        }
      );

      if (!resp.ok) throw new Error("Erro");
      const data = await resp.json();

      if (data.mermaid_code) {
        const mermaidBlock = "\n\n```mermaid\n" + data.mermaid_code + "\n```\n";
        const newContent = (selectedPage.content_markdown || "") + mermaidBlock;
        await supabase
          .from("wiki_pages")
          .update({ content_markdown: newContent })
          .eq("id", selectedPage.id);
        fetchPages();
        toast.success("Diagrama inserido na documentação");
      }
    } catch {
      toast.error("Erro ao gerar diagrama");
    } finally {
      setIsGenerating(false);
    }
  };

  const pagesContext = pages
    .map((p) => `# ${p.title}\n${p.content_markdown}`)
    .join("\n\n---\n\n");

  if (!projectId) return null;

  return (
    <AppLayout title={`Wiki — ${projectName}`}>
      <div className="flex flex-col h-[calc(100vh-4rem)] animate-fade-in">
        <div className="px-4 py-2 border-b border-border">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <Button
              variant={showChat ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowChat(!showChat)}
            >
              <Bot className="h-4 w-4 mr-1" />
              Assistente IA
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 shrink-0">
            <WikiPageList
              pages={pages}
              selectedPageId={selectedPageId}
              onSelectPage={setSelectedPageId}
              onCreatePage={handleCreatePage}
              onDeletePage={handleDeletePage}
            />
          </div>

          <div className="flex-1 overflow-hidden">
            {selectedPage ? (
              <WikiEditor
                pageId={selectedPage.id}
                title={selectedPage.title}
                content={selectedPage.content_markdown || ""}
                updatedAt={selectedPage.updated_at}
                onSave={handleSave}
                onGenerateDoc={handleGenerateDoc}
                onGenerateDiagram={handleGenerateDiagram}
                isSaving={isSaving}
                isGenerating={isGenerating}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <BookOpen className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Selecione ou crie uma página</p>
              </div>
            )}
          </div>

          {showChat && (
            <WikiAiChat
              projectId={projectId}
              pagesContext={pagesContext}
              onClose={() => setShowChat(false)}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
