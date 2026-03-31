import { useState, useEffect, useMemo } from "react";
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners, DragOverlay } from "@dnd-kit/core";
import { arrayMove, SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard, TaskData } from "./TaskCard";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { TaskFilters } from "./TaskFilters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

interface StatusColumn {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface Member {
  id: string;
  name: string;
}

interface Props {
  projectId: string;
}

export function KanbanBoard({ projectId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<StatusColumn[]>([]);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeTask, setActiveTask] = useState<TaskData | null>(null);
  const [activeColumn, setActiveColumn] = useState<StatusColumn | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [addingToStatus, setAddingToStatus] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [deleteColumnId, setDeleteColumnId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const fetchData = async () => {
    const [statusRes, taskRes] = await Promise.all([
      supabase.from("project_statuses").select("*").eq("project_id", projectId).order("position"),
      supabase.from("tasks").select("*").eq("project_id", projectId).order("position"),
    ]);
    setStatuses(statusRes.data || []);

    // Enrich tasks with checklist counts and comments
    const rawTasks = taskRes.data || [];
    if (rawTasks.length > 0) {
      const taskIds = rawTasks.map((t) => t.id);
      const [checkRes, commentRes, profileRes] = await Promise.all([
        supabase.from("checklists").select("id, task_id, completed").in("task_id", taskIds),
        supabase.from("comments").select("id, task_id").in("task_id", taskIds),
        supabase.from("profiles").select("id, full_name"),
      ]);

      const profileMap = new Map(profileRes.data?.map((p) => [p.id, p.full_name || "Usuário"]) || []);
      const checkMap = new Map<string, { total: number; done: number }>();
      (checkRes.data || []).forEach((c) => {
        const cur = checkMap.get(c.task_id) || { total: 0, done: 0 };
        cur.total++;
        if (c.completed) cur.done++;
        checkMap.set(c.task_id, cur);
      });
      const commentMap = new Map<string, number>();
      (commentRes.data || []).forEach((c) => commentMap.set(c.task_id, (commentMap.get(c.task_id) || 0) + 1));

      setTasks(rawTasks.map((t) => ({
        ...t,
        checklist_count: checkMap.get(t.id)?.total || 0,
        checklist_done: checkMap.get(t.id)?.done || 0,
        comment_count: commentMap.get(t.id) || 0,
        assignee_name: t.assignee_id ? profileMap.get(t.assignee_id) : undefined,
      })));

      setMembers(profileRes.data?.map((p) => ({ id: p.id, name: p.full_name || "Usuário" })) || []);
    } else {
      setTasks([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterAssignee === "unassigned" && t.assignee_id) return false;
      if (filterAssignee !== "all" && filterAssignee !== "unassigned" && t.assignee_id !== filterAssignee) return false;
      return true;
    });
  }, [tasks, filterPriority, filterAssignee]);

  const handleDragStart = (e: DragStartEvent) => {
    const { active } = e;
    // Column drag
    if (active.data.current?.type === "column-sortable") {
      const col = statuses.find((s) => s.id === active.data.current?.statusId);
      if (col) setActiveColumn(col);
      return;
    }
    // Task drag
    const task = tasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    // Skip if dragging a column
    if (active.data.current?.type === "column-sortable") return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTaskData = tasks.find((t) => t.id === activeId);
    if (!activeTaskData) return;

    // Dropping over a column
    const overStatus = statuses.find((s) => s.id === overId);
    if (overStatus && activeTaskData.status_id !== overId) {
      setTasks((prev) => prev.map((t) => t.id === activeId ? { ...t, status_id: overId } : t));
      return;
    }

    // Dropping over another task
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask && activeTaskData.status_id !== overTask.status_id) {
      setTasks((prev) => prev.map((t) => t.id === activeId ? { ...t, status_id: overTask.status_id } : t));
    }
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;

    // Column reorder
    if (active.data.current?.type === "column-sortable") {
      setActiveColumn(null);
      if (!over || active.id === over.id) return;
      const activeStatusId = active.data.current.statusId as string;
      const overStatusId = over.data.current?.statusId as string;
      if (!overStatusId) return;
      const oldIdx = statuses.findIndex((s) => s.id === activeStatusId);
      const newIdx = statuses.findIndex((s) => s.id === overStatusId);
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
      const reordered = arrayMove(statuses, oldIdx, newIdx);
      setStatuses(reordered);
      // Persist new positions
      await Promise.all(reordered.map((s, i) =>
        supabase.from("project_statuses").update({ position: i }).eq("id", s.id)
      ));
      return;
    }

    // Task drag end
    setActiveTask(null);
    if (!over) return;
    const activeId = active.id as string;
    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;
    await supabase.from("tasks").update({ status_id: task.status_id, position: task.position }).eq("id", activeId);
  };

  const confirmDeleteTask = async () => {
    if (!deleteTaskId) return;
    await supabase.from("tasks").delete().eq("id", deleteTaskId);
    setDeleteTaskId(null);
    fetchData();
    toast({ title: "Tarefa excluída" });
  };

  const handleAddTask = async () => {
    if (!addingToStatus || !newTaskTitle.trim() || !user) return;
    const tasksInColumn = tasks.filter((t) => t.status_id === addingToStatus);
    await supabase.from("tasks").insert({
      project_id: projectId,
      status_id: addingToStatus,
      title: newTaskTitle.trim(),
      position: tasksInColumn.length,
      created_by: user.id,
    });
    setNewTaskTitle("");
    setAddingToStatus(null);
    fetchData();
  };

  // --- Column management ---
  const handleRenameColumn = async (statusId: string, newName: string) => {
    await supabase.from("project_statuses").update({ name: newName }).eq("id", statusId);
    fetchData();
  };

  const handleChangeColumnColor = async (statusId: string, newColor: string) => {
    await supabase.from("project_statuses").update({ color: newColor }).eq("id", statusId);
    fetchData();
  };

  const handleMoveColumn = async (statusId: string, direction: "left" | "right") => {
    const idx = statuses.findIndex((s) => s.id === statusId);
    if (idx < 0) return;
    const swapIdx = direction === "left" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= statuses.length) return;
    const a = statuses[idx];
    const b = statuses[swapIdx];
    await Promise.all([
      supabase.from("project_statuses").update({ position: b.position }).eq("id", a.id),
      supabase.from("project_statuses").update({ position: a.position }).eq("id", b.id),
    ]);
    fetchData();
  };

  const handleDeleteColumn = (statusId: string) => {
    const tasksInCol = tasks.filter((t) => t.status_id === statusId);
    if (tasksInCol.length > 0) {
      toast({ title: "Não é possível excluir", description: "Mova ou exclua as tarefas desta coluna primeiro.", variant: "destructive" });
      return;
    }
    setDeleteColumnId(statusId);
  };

  const confirmDeleteColumn = async () => {
    if (!deleteColumnId) return;
    await supabase.from("project_statuses").delete().eq("id", deleteColumnId);
    setDeleteColumnId(null);
    fetchData();
    toast({ title: "Coluna excluída" });
  };

  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;
    await supabase.from("project_statuses").insert({
      project_id: projectId,
      name: newColumnName.trim(),
      position: statuses.length,
    });
    setNewColumnName("");
    setAddingColumn(false);
    fetchData();
  };

  return (
    <div className="space-y-4">
      <TaskFilters
        members={members}
        priority={filterPriority}
        assignee={filterAssignee}
        onPriorityChange={setFilterPriority}
        onAssigneeChange={setFilterAssignee}
      />

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <SortableContext items={statuses.map((s) => `column-${s.id}`)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {statuses.map((status, idx) => (
              <KanbanColumn
                key={status.id}
                status={status}
                tasks={filteredTasks.filter((t) => t.status_id === status.id)}
                isFirst={idx === 0}
                isLast={idx === statuses.length - 1}
                onAddTask={(sid) => setAddingToStatus(sid)}
                onTaskClick={(t) => { setSelectedTask(t); setDetailOpen(true); }}
                onDeleteTask={(id) => setDeleteTaskId(id)}
                onRename={handleRenameColumn}
                onChangeColor={handleChangeColumnColor}
                onMove={handleMoveColumn}
                onDelete={handleDeleteColumn}
              />
            ))}

            {/* Add column button */}
          <div className="flex flex-col w-72 shrink-0">
            {addingColumn ? (
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/30">
                <Input
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="Nome da coluna"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddColumn(); if (e.key === "Escape") setAddingColumn(false); }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddColumn} disabled={!newColumnName.trim()} className="flex-1">Criar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingColumn(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="border-dashed text-muted-foreground h-10" onClick={() => setAddingColumn(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nova coluna
              </Button>
            )}
          </div>
        </div>
        </SortableContext>
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} onClick={() => {}} /> : null}
          {activeColumn ? (
            <div className="w-72 h-10 rounded-lg bg-muted/60 border border-primary/20 flex items-center justify-center text-sm font-semibold text-muted-foreground">
              {activeColumn.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Quick add task dialog */}
      <Dialog open={!!addingToStatus} onOpenChange={(o) => !o && setAddingToStatus(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Título</Label>
            <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Nome da tarefa" onKeyDown={(e) => e.key === "Enter" && handleAddTask()} autoFocus />
            <Button onClick={handleAddTask} disabled={!newTaskTitle.trim()} className="w-full gradient-primary">Criar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <TaskDetailDialog
        task={selectedTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        members={members}
        onUpdated={fetchData}
      />

      {/* Confirm delete task */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={(o) => !o && setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. A tarefa e seus dados serão removidos permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete column */}
      <AlertDialog open={!!deleteColumnId} onOpenChange={(o) => !o && setDeleteColumnId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coluna?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. A coluna será removida permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteColumn} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
