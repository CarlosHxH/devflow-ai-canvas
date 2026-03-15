import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onCreated: () => void;
}

export function CreateProjectDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!name.trim() || !user || !currentWorkspace) return;
    setLoading(true);
    const { error } = await supabase.from("projects").insert({
      name: name.trim(),
      description: description.trim() || null,
      workspace_id: currentWorkspace.id,
      created_by: user.id,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao criar projeto", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Projeto criado!" });
      setName("");
      setDescription("");
      setOpen(false);
      onCreated();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-primary shadow-glow">
          <Plus className="h-4 w-4 mr-2" /> Novo Projeto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Projeto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="project-name">Nome</Label>
            <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do projeto" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-desc">Descrição</Label>
            <Textarea id="project-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição opcional" />
          </div>
          <Button onClick={handleCreate} disabled={loading || !name.trim()} className="w-full gradient-primary">
            {loading ? "Criando..." : "Criar Projeto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
