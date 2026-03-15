import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onGenerated: (code: string) => void;
}

export function AiPromptPanel({ onGenerated }: Props) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-diagram", {
        body: { prompt: prompt.trim() },
      });

      if (error) throw error;
      if (data?.mermaid_code) {
        onGenerated(data.mermaid_code);
        toast({ title: "Diagrama gerado com sucesso!" });
      } else {
        throw new Error("Resposta sem código Mermaid");
      }
    } catch (e: any) {
      toast({ title: "Erro ao gerar diagrama", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-primary" />
        Gerar com IA
      </div>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Descreva o diagrama que você deseja gerar... Ex: 'Fluxo de autenticação com login, signup e recuperação de senha'"
        className="min-h-[80px] resize-none text-sm"
      />
      <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="w-full gradient-primary" size="sm">
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
        {loading ? "Gerando..." : "Gerar Diagrama"}
      </Button>
    </div>
  );
}
