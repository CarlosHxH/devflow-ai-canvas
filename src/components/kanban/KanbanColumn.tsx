import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard, TaskData } from "./TaskCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface StatusColumn {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface Props {
  status: StatusColumn;
  tasks: TaskData[];
  onAddTask: (statusId: string) => void;
  onTaskClick: (task: TaskData) => void;
  onDeleteTask: (taskId: string) => void;
}

export function KanbanColumn({ status, tasks, onAddTask, onTaskClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id, data: { type: "column" } });

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
        <h3 className="text-sm font-semibold">{status.name}</h3>
        <span className="text-xs text-muted-foreground ml-auto">{tasks.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 p-2 rounded-lg min-h-[200px] transition-colors ${isOver ? "bg-primary/5 border border-primary/20" : "bg-muted/30"}`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>

        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => onAddTask(status.id)}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  );
}
