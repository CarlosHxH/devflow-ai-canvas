import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, Plus, Send, ChevronRight, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { TaskData } from "./TaskCard";

interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  position: number;
  parent_id: string | null;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  user_name?: string;
}

interface Member {
  id: string;
  name: string;
}

interface Props {
  task: TaskData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  onUpdated: () => void;
}

export function TaskDetailDialog({ task, open, onOpenChange, members, onUpdated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState<string>("unassigned");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [newComment, setNewComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task && open) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setAssigneeId(task.assignee_id || "unassigned");
      setStartDate(task.start_date || "");
      setDueDate(task.due_date || "");
      fetchChecklists();
      fetchComments();
    }
  }, [task, open]);

  const fetchChecklists = async () => {
    if (!task) return;
    const { data } = await supabase.from("checklists").select("*").eq("task_id", task.id).order("position");
    setChecklists(data || []);
  };

  const fetchComments = async () => {
    if (!task) return;
    const { data } = await supabase.from("comments").select("*").eq("task_id", task.id).order("created_at", { ascending: true });
    if (data) {
      const profileIds = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
      const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name || "Usuário"]) || []);
      setComments(data.map((c) => ({ ...c, user_name: profileMap.get(c.user_id) || "Usuário" })));
    }
  };

  const handleSave = async () => {
    if (!task) return;
    setSaving(true);
    await supabase.from("tasks").update({
      title,
      description: description || null,
      priority,
      assignee_id: assigneeId === "unassigned" ? null : assigneeId,
      start_date: startDate || null,
      due_date: dueDate || null,
    }).eq("id", task.id);
    setSaving(false);
    onUpdated();
    toast({ title: "Tarefa atualizada" });
  };

  const handleDelete = async () => {
    if (!task) return;
    await supabase.from("tasks").delete().eq("id", task.id);
    onOpenChange(false);
    onUpdated();
    toast({ title: "Tarefa excluída" });
  };

  const addCheckItem = async () => {
    if (!task || !newCheckItem.trim()) return;
    await supabase.from("checklists").insert({
      task_id: task.id,
      title: newCheckItem.trim(),
      position: checklists.length,
    });
    setNewCheckItem("");
    fetchChecklists();
  };

  const toggleCheckItem = async (item: ChecklistItem) => {
    await supabase.from("checklists").update({ completed: !item.completed }).eq("id", item.id);
    fetchChecklists();
    onUpdated();
  };

  const deleteCheckItem = async (id: string) => {
    await supabase.from("checklists").delete().eq("id", id);
    fetchChecklists();
    onUpdated();
  };

  const addComment = async () => {
    if (!task || !user || !newComment.trim()) return;
    await supabase.from("comments").insert({
      task_id: task.id,
      user_id: user.id,
      content: newComment.trim(),
    });
    setNewComment("");
    fetchComments();
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Detalhes da Tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title & Description */}
          <div className="space-y-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold border-none px-0 focus-visible:ring-0" />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição..." className="min-h-[60px] resize-none" />
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Crítico</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Responsável</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Sem atribuição</SelectItem>
                  {members.map((m) => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data de início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data de finalização</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} size="sm" className="gradient-primary">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button onClick={handleDelete} size="sm" variant="destructive">
              <Trash2 className="h-3 w-3 mr-1" /> Excluir
            </Button>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Checklist</Label>
            {checklists.map((item) => (
              <div key={item.id} className="flex items-center gap-2 group">
                <Checkbox checked={item.completed} onCheckedChange={() => toggleCheckItem(item)} />
                <span className={`text-sm flex-1 ${item.completed ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteCheckItem(item.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)} placeholder="Novo item..." className="h-8 text-xs" onKeyDown={(e) => e.key === "Enter" && addCheckItem()} />
              <Button size="sm" variant="outline" onClick={addCheckItem} className="h-8"><Plus className="h-3 w-3" /></Button>
            </div>
          </div>

          {/* Comments */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Comentários</Label>
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                    <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{c.user_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{c.user_name}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Comentar..." className="h-8 text-xs" onKeyDown={(e) => e.key === "Enter" && addComment()} />
              <Button size="sm" variant="outline" onClick={addComment} className="h-8"><Send className="h-3 w-3" /></Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
