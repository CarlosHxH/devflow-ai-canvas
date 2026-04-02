import { Handle, Position } from "@xyflow/react";
import { useState } from "react";

export function StickyNode({ data, selected }: { data: { text: string; color: string; onChange?: (text: string) => void }, selected: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.text || "New Note");
  const bgColor = data.color || "#fef08a";

  const onBlur = () => {
    setIsEditing(false);
    if (data.onChange) data.onChange(text);
  };

  return (
    <div 
      className={`relative w-[200px] h-[200px] shadow-md border-2 ${selected ? 'border-primary' : 'border-black/10'} p-4 transition-colors flex flex-col`}
      style={{ backgroundColor: bgColor, color: "#1f2937" }} // default dark text for sticky notes
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Right} id="right" className="opacity-0" />
      <Handle type="target" position={Position.Left} id="left" className="opacity-0" />

      <div className="flex-1 w-full h-full cursor-text" onDoubleClick={() => setIsEditing(true)}>
        {isEditing ? (
          <textarea 
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={onBlur}
            className="w-full h-full bg-transparent resize-none outline-none border-none text-sm p-0 text-inherit font-medium"
            placeholder="Type your note here..."
          />
        ) : (
          <div className="text-sm font-medium whitespace-pre-wrap break-words h-full overflow-hidden" title="Double click to edit">
            {text}
          </div>
        )}
      </div>
    </div>
  );
}
