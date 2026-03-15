import { useState, useEffect, useMemo } from "react";
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners, DragOverlay } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
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
import { Label } from "@/components/ui/label";

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
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [addingToStatus, setAddingToStatus] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
    const task = tasks.find((t) => t.id === e.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;

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
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;

    const activeId = active.id as string;
    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;

    // Update position in DB
    await supabase.from("tasks").update({ status_id: task.status_id, position: task.position }).eq("id", activeId);
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
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statuses.map((status) => (
            <KanbanColumn
              key={status.id}
              status={status}
              tasks={filteredTasks.filter((t) => t.status_id === status.id)}
              onAddTask={(sid) => setAddingToStatus(sid)}
              onTaskClick={(t) => { setSelectedTask(t); setDetailOpen(true); }}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} onClick={() => {}} /> : null}
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
    </div>
  );
}
