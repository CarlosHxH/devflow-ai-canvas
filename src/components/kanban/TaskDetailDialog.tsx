import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, Plus, Send, ChevronRight, ChevronDown, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { TaskData } from "./TaskCard";

interface ChecklistItem {
  id: string;
  task_id: string;
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
  const [newSubItems, setNewSubItems] = useState<Record<string, string>>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [newComment, setNewComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);

  const topLevelItems = useMemo(() => {
    return checklists
      .filter(i => !i.parent_id)
      .sort((a, b) => a.position - b.position);
  }, [checklists]);

  const childrenMap = useMemo(() => {
    const map: Record<string, ChecklistItem[]> = {};
    checklists.filter(i => i.parent_id).forEach(i => {
      if (!map[i.parent_id!]) map[i.parent_id!] = [];
      map[i.parent_id!].push(i);
    });
    // Ensure all sub-arrays are also sorted by position
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => a.position - b.position);
    });
    return map;
  }, [checklists]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const updateChecklistItemPositions = async (items: ChecklistItem[]) => {
    const updates = items.map((item, index) => ({
      ...item,
      position: index,
    }));
    
    const { error } = await supabase.from("checklists").upsert(updates, { onConflict: "id" });
    if (error) {
      console.error("Error reordering checklists:", error);
      toast({ title: "Erro ao reordenar", variant: "destructive" });
      fetchChecklists(); // Revert to server state on error
    } else {
      onUpdated(); // Notify parent of change without fetching here
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setChecklists((currentChecklists) => {
      const activeItem = currentChecklists.find(item => item.id === active.id);
      const overItem = currentChecklists.find(item => item.id === over.id);

      if (!activeItem || !overItem) return currentChecklists;

      // Case 1: Reordering top-level items
      if (!activeItem.parent_id && !overItem.parent_id) {
        const topLevelIds = topLevelItems.map(item => item.id);
        const oldIndex = topLevelIds.indexOf(active.id as string);
        const newIndex = topLevelIds.indexOf(over.id as string);
        const newTopLevelOrder = arrayMove(topLevelItems, oldIndex, newIndex);

        const updatedChecklists = currentChecklists.map(item => {
          const newPosition = newTopLevelOrder.findIndex(tli => tli.id === item.id);
          return item.parent_id === null && newPosition !== -1 ? { ...item, position: newPosition } : item;
        });
        updateChecklistItemPositions(newTopLevelOrder);
        return updatedChecklists;
      }

      // Case 2: Reordering sub-items within the same parent
      if (activeItem.parent_id && overItem.parent_id && activeItem.parent_id === overItem.parent_id) {
        const parentId = activeItem.parent_id;
        const childrenOfParent = childrenMap[parentId].sort((a, b) => a.position - b.position);
        const childrenIds = childrenOfParent.map(item => item.id);

        const oldIndex = childrenIds.indexOf(active.id as string);
        const newIndex = childrenIds.indexOf(over.id as string);
        const newChildrenOrder = arrayMove(childrenOfParent, oldIndex, newIndex);

        const updatedChecklists = currentChecklists.map(item => {
          const newPosition = newChildrenOrder.findIndex(sci => sci.id === item.id);
          return item.parent_id === parentId && newPosition !== -1 ? { ...item, position: newPosition } : item;
        });
        updateChecklistItemPositions(newChildrenOrder);
        return updatedChecklists;
      }

      // Case 3: Moving a sub-item to another parent or to top-level (more complex, not implementing for now)
      return currentChecklists;
    });
  };

  interface SortableChecklistItemProps {
    item: ChecklistItem;
    children: React.ReactNode;
  }

  function SortableChecklistItem({ item, children }: SortableChecklistItemProps) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: item.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 52 : "auto",
      opacity: isDragging ? 0.8 : 1,
      position: isDragging ? "relative" as const : "static" as const,
    };

    return (
      <div ref={setNodeRef} style={style} className="flex flex-col relative group/sortable">
        <div className="flex items-center">
          <div 
            className="flex items-center justify-center p-1 mr-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground opacity-50 group-hover/sortable:opacity-100 transition-opacity"
            {...attributes} 
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex-1 w-full min-w-0">
            {children}
          </div>
        </div>
      </div>
    );
  }

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

  const addCheckItem = async (parentId?: string) => {
    const text = parentId ? newSubItems[parentId]?.trim() : newCheckItem.trim();
    if (!task || !text) return;
    const siblings = parentId ? (childrenMap[parentId] || []) : topLevelItems;
    await supabase.from("checklists").insert({
      task_id: task.id,
      title: text,
      position: siblings.length,
      parent_id: parentId || null,
    } as any);
    if (parentId) {
      setNewSubItems(prev => ({ ...prev, [parentId]: "" }));
      setExpandedItems(prev => new Set(prev).add(parentId));
    } else {
      setNewCheckItem("");
    }
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

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewComment(val);

    const words = val.split(" ");
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("@")) {
      setMentionSearch(lastWord.slice(1).toLowerCase());
    } else {
      setMentionSearch(null);
    }
  };

  const handleMentionSelect = (member: Member) => {
    const words = newComment.split(" ");
    words[words.length - 1] = `@${member.name} `;
    setNewComment(words.join(" "));
    setMentionSearch(null);
  };

  const addComment = async () => {
    if (!task || !user || !newComment.trim()) return;
    
    // Extrai quem foi mencionado
    const mentionedMembers = members.filter(m => newComment.includes(`@${m.name}`) && m.id !== user.id);

    // Salva o comentário
    await supabase.from("comments").insert({
      task_id: task.id,
      user_id: user.id,
      content: newComment.trim(),
    });

    // Envia notificação para os mencionados
    if (mentionedMembers.length > 0) {
      const notifications = mentionedMembers.map(m => ({
        user_id: m.id,
        actor_id: user.id,
        type: 'mention',
        content: `mencionou você na tarefa "${task.title}"`,
        link: `/projects/${task.project_id}/board?task=${task.id}`
      }));
      await (supabase as any).from("notifications").insert(notifications);
    }

    setNewComment("");
    setMentionSearch(null);
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={topLevelItems.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {topLevelItems.map((item) => {
                  const children = childrenMap[item.id] || [];
                  const isExpanded = expandedItems.has(item.id);
                  return (
                    <SortableChecklistItem key={item.id} item={item}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 group">
                          <button
                            onClick={() => toggleExpand(item.id)}
                            className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent shrink-0"
                          >
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </button>
                          <Checkbox checked={item.completed} onCheckedChange={() => toggleCheckItem(item)} />
                          <span className={`text-sm flex-1 ${item.completed ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                          {children.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">{children.filter(c => c.completed).length}/{children.length}</span>
                          )}
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteCheckItem(item.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {isExpanded && (
                          <div className="ml-6 space-y-1 border-l border-border pl-2">
                            <SortableContext
                              items={children.map(sub => sub.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {children.map((sub) => (
                                <SortableChecklistItem key={sub.id} item={sub}>
                                  <div className="flex items-center gap-2 group/sub">
                                    <Checkbox checked={sub.completed} onCheckedChange={() => toggleCheckItem(sub)} />
                                    <span className={`text-xs flex-1 ${sub.completed ? "line-through text-muted-foreground" : ""}`}>{sub.title}</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover/sub:opacity-100" onClick={() => deleteCheckItem(sub.id)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </SortableChecklistItem>
                              ))}
                            </SortableContext>
                            <div className="flex gap-2">
                              <Input
                                value={newSubItems[item.id] || ""}
                                onChange={(e) => setNewSubItems(prev => ({ ...prev, [item.id]: e.target.value }))}
                                placeholder="Sub-item..."
                                className="h-7 text-xs"
                                onKeyDown={(e) => e.key === "Enter" && addCheckItem(item.id)}
                              />
                              <Button size="sm" variant="ghost" onClick={() => addCheckItem(item.id)} className="h-7 px-2"><Plus className="h-3 w-3" /></Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </SortableChecklistItem>
                  );
                })}
              </SortableContext>
            </DndContext>
            <div className="flex gap-2">
              <Input value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)} placeholder="Novo item..." className="h-8 text-xs" onKeyDown={(e) => e.key === "Enter" && addCheckItem()} />
              <Button size="sm" variant="outline" onClick={() => addCheckItem()} className="h-8"><Plus className="h-3 w-3" /></Button>
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
            <div className="relative flex gap-2">
              {mentionSearch !== null && (
                <div className="absolute bottom-10 left-0 w-64 bg-background border rounded-md shadow-md z-50 max-h-40 overflow-y-auto">
                  {members
                    .filter(m => m.name.toLowerCase().includes(mentionSearch) && m.id !== user?.id)
                    .map(m => (
                      <div
                        key={m.id}
                        className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                        onClick={() => handleMentionSelect(m)}
                      >
                        {m.name}
                      </div>
                  ))}
                  {members.filter(m => m.name.toLowerCase().includes(mentionSearch) && m.id !== user?.id).length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum usuário encontrado</div>
                  )}
                </div>
              )}
              <Input 
                value={newComment} 
                onChange={handleCommentChange} 
                placeholder="Comentar... (use @ para mencionar)" 
                className="h-8 text-xs" 
                onKeyDown={(e) => {
                  if (e.key === "Enter" && mentionSearch === null) {
                    addComment();
                  }
                }} 
              />
              <Button size="sm" variant="outline" onClick={addComment} className="h-8"><Send className="h-3 w-3" /></Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
