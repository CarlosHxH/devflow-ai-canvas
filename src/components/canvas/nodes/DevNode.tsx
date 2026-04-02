import { Handle, Position } from "@xyflow/react";
import { 
  Database, Server, Cloud, Globe, AppWindow, 
  Smartphone, Layers, Code, HardDrive, Box
} from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export const devIcons: Record<string, React.ElementType> = {
  database: Database,
  server: Server,
  cloud: Cloud,
  api: Globe,
  web: AppWindow,
  mobile: Smartphone,
  queue: Layers,
  function: Code,
  storage: HardDrive,
  generic: Box,
};

export function DevNode({ data, selected }: { data: { type: string; label: string; onChange?: (label: string) => void }, selected: boolean }) {
  const Icon = devIcons[data.type] || devIcons.generic;
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || "Service");

  const onBlur = () => {
    setIsEditing(false);
    if (data.onChange) data.onChange(label);
  };

  return (
    <div className={`relative flex items-center gap-3 bg-card border-2 ${selected ? 'border-primary' : 'border-border'} rounded-xl px-4 py-3 shadow-sm min-w-[150px] transition-colors`}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 rounded-full bg-primary" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 rounded-full bg-primary" />
      <Handle type="source" position={Position.Right} id="right" className="w-2 h-2 rounded-full bg-primary" />
      <Handle type="target" position={Position.Left} id="left" className="w-2 h-2 rounded-full bg-primary" />

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      
      <div className="flex-1 min-w-0" onDoubleClick={() => setIsEditing(true)}>
        {isEditing ? (
          <Input 
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => e.key === "Enter" && onBlur()}
            className="h-7 text-xs px-2 py-0"
          />
        ) : (
          <div className="text-sm font-semibold truncate leading-tight cursor-text" title="Double click to edit">
            {label}
          </div>
        )}
      </div>
    </div>
  );
}
