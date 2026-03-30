import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard, TaskData } from "./TaskCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, MoreHorizontal, Pencil, Trash2, GripVertical, Palette } from "lucide-react";

interface StatusColumn {
  id: string;
  name: string;
  color: string;
  position: number;
}

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#64748b",
];

interface Props {
  status: StatusColumn;
  tasks: TaskData[];
  isFirst: boolean;
  isLast: boolean;
  onAddTask: (statusId: string) => void;
  onTaskClick: (task: TaskData) => void;
  onDeleteTask: (taskId: string) => void;
  onRename: (statusId: string, newName: string) => void;
  onChangeColor: (statusId: string, newColor: string) => void;
  onMove: (statusId: string, direction: "left" | "right") => void;
  onDelete: (statusId: string) => void;
}

export function KanbanColumn({
  status, tasks, isFirst, isLast,
  onAddTask, onTaskClick, onDeleteTask,
  onRename, onChangeColor, onMove, onDelete,
}: Props) {
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: status.id, data: { type: "column" } });

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `column-${status.id}`,
    data: { type: "column-sortable", statusId: status.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(status.name);
  const [colorOpen, setColorOpen] = useState(false);

  const handleRename = () => {
    if (editName.trim() && editName.trim() !== status.name) {
      onRename(status.id, editName.trim());
    }
    setEditing(false);
  };

  const startEditing = () => {
    setEditName(status.name);
    setEditing(true);
  };

  return (
    <div ref={setSortableRef} style={style} className="flex flex-col w-72 shrink-0">
      <div className="flex items-center gap-1.5 mb-3 px-1 group/header">
        {/* Drag handle for column reorder */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0 touch-none"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger asChild>
            <button className="h-3 w-3 rounded-full shrink-0 ring-2 ring-transparent hover:ring-primary/30 transition-all cursor-pointer" style={{ backgroundColor: status.color }} />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={`h-6 w-6 rounded-full transition-all hover:scale-110 ${c === status.color ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  style={{ backgroundColor: c }}
                  onClick={() => { onChangeColor(status.id, c); setColorOpen(false); }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {editing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditing(false); }}
            className="h-6 text-sm font-semibold px-1 py-0"
            autoFocus
          />
        ) : (
          <h3
            className="text-sm font-semibold truncate cursor-pointer hover:text-primary transition-colors select-none"
            onDoubleClick={startEditing}
            title="Duplo-clique para renomear"
          >
            {status.name}
          </h3>
        )}

        <span className="text-xs text-muted-foreground ml-auto shrink-0">{tasks.length}</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={startEditing}>
              <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setColorOpen(true)}>
              <Palette className="h-3.5 w-3.5 mr-2" /> Alterar cor
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(status.id)}>
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir coluna
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        ref={setDroppableRef}
        className={`flex-1 space-y-2 p-2 rounded-lg min-h-[200px] transition-colors ${isOver ? "bg-primary/5 border border-primary/20" : "bg-muted/30"}`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} onDelete={onDeleteTask} />
          ))}
        </SortableContext>

        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => onAddTask(status.id)}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  );
}
