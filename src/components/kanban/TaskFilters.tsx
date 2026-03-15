import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Member {
  id: string;
  name: string;
}

interface Props {
  members: Member[];
  priority: string;
  assignee: string;
  onPriorityChange: (v: string) => void;
  onAssigneeChange: (v: string) => void;
}

export function TaskFilters({ members, priority, assignee, onPriorityChange, onAssigneeChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <Select value={priority} onValueChange={onPriorityChange}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="critical">Crítico</SelectItem>
          <SelectItem value="high">Alta</SelectItem>
          <SelectItem value="medium">Média</SelectItem>
          <SelectItem value="low">Baixa</SelectItem>
        </SelectContent>
      </Select>

      <Select value={assignee} onValueChange={onAssigneeChange}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="unassigned">Sem atribuição</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
