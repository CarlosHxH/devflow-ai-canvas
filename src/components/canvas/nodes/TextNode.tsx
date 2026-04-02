import { Handle, Position } from "@xyflow/react";
import { useState, useRef, useEffect } from "react";

export function TextNode({ data, selected }: { data: { text: string; onChange?: (text: string) => void }, selected: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.text || "Texto");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Auto-resize textarea
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [isEditing, text]);

  const onBlur = () => {
    setIsEditing(false);
    if (data.onChange) data.onChange(text);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  return (
    <div 
      className={`relative min-w-[100px] min-h-[40px] flex items-center justify-center p-2 rounded-md border-2 ${selected ? 'border-primary border-dashed bg-primary/5' : 'border-transparent hover:border-black/5'} transition-colors`}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Right} id="right" className="opacity-0" />
      <Handle type="target" position={Position.Left} id="left" className="opacity-0" />

      <div className="w-full h-full cursor-text text-center" onDoubleClick={() => setIsEditing(true)}>
        {isEditing ? (
          <textarea 
            ref={inputRef}
            value={text}
            onChange={handleChange}
            onBlur={onBlur}
            className="w-full bg-transparent resize-none outline-none border-none text-lg p-0 text-inherit font-medium text-center overflow-hidden"
            placeholder="Digite algo..."
          />
        ) : (
          <div className="text-lg font-medium whitespace-pre-wrap break-words" title="Duplo clique para editar">
            {text}
          </div>
        )}
      </div>
    </div>
  );
}
