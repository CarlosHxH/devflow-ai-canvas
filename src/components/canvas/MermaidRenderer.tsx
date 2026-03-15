import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" });

interface Props {
  code: string;
  className?: string;
}

export function MermaidRenderer({ code, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code.trim() || !containerRef.current) return;

    const render = async () => {
      try {
        setError(null);
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, code.trim());
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (e: any) {
        setError(e.message || "Erro ao renderizar diagrama");
        if (containerRef.current) containerRef.current.innerHTML = "";
      }
    };
    render();
  }, [code]);

  return (
    <div className={className}>
      {error && <p className="text-xs text-destructive mb-2">{error}</p>}
      <div ref={containerRef} className="flex justify-center [&_svg]:max-w-full" />
    </div>
  );
}
