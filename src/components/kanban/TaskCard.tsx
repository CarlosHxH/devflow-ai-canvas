import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, CheckSquare, MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export interface TaskData {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  assignee_id: string | null;
  due_date: string | null;
  position: number;
  status_id: string;
  project_id: string;
  created_by: string;
  checklist_count?: number;
  checklist_done?: number;
  comment_count?: number;
  assignee_name?: string;
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  critical: { label: "Crítico", className: "bg-destructive/20 text-destructive border-destructive/30" },
  high: { label: "Alta", className: "bg-warning/20 text-warning border-warning/30" },
  medium: { label: "Média", className: "bg-primary/20 text-primary border-primary/30" },
  low: { label: "Baixa", className: "bg-muted text-muted-foreground border-border" },
};

interface Props {
  task: TaskData;
  onClick: () => void;
  onDelete?: (taskId: string) => void;
}

export function TaskCard({ task, onClick, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const prio = priorityConfig[task.priority] || priorityConfig.medium;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors space-y-2"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight">{task.title}</span>
        <Badge variant="outline" className={`text-[10px] shrink-0 ${prio.className}`}>{prio.label}</Badge>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {task.due_date && (
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(task.due_date).toLocaleDateString("pt-BR")}</span>
        )}
        {(task.checklist_count ?? 0) > 0 && (
          <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" />{task.checklist_done}/{task.checklist_count}</span>
        )}
        {(task.comment_count ?? 0) > 0 && (
          <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{task.comment_count}</span>
        )}
        {task.assignee_name && (
          <Avatar className="h-5 w-5 ml-auto">
            <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{task.assignee_name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </Card>
  );
}
