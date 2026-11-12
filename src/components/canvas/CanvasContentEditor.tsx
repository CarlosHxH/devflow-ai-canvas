import { useEffect, useState } from "react";
import mermaid from "mermaid";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { MarkdownPreview } from "@/components/wiki/MarkdownPreview";
import { parseTableSource, type BlockKind } from "@/lib/canvasContent";

const DEFAULTS: Record<BlockKind, string> = {
  mermaid: "flowchart TD\n  A[Início] --> B{Decisão}\n  B -->|Sim| C[Fazer]\n  B -->|Não| D[Fim]",
  markdown: "# Título\n\n- Item 1\n- [ ] Tarefa\n\n| Coluna A | Coluna B |\n| --- | --- |\n| 1 | 2 |",
  table: JSON.stringify([["Coluna 1", "Coluna 2", "Coluna 3"], ["", "", ""], ["", "", ""]]),
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: { kind: BlockKind; source: string } | null;
  editing: boolean;
  onSubmit: (kind: BlockKind, source: string) => Promise<void> | void;
}

function MermaidPreview({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        await mermaid.parse(code);
        const { svg } = await mermaid.render(`prev-${Date.now()}`, code);
        if (alive) { setSvg(svg); setErr(""); }
      } catch (e: any) {
        if (alive) setErr(e?.message?.split("\n")[0] || "Código inválido");
      }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [code]);
  return (
    <div className="h-full overflow-auto rounded-md border bg-muted/30 p-2">
      {err && <p className="text-xs text-destructive mb-2">Erro: {err}</p>}
      <div className="[&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

export function CanvasContentEditor({ open, onOpenChange, initial, editing, onSubmit }: Props) {
  const [kind, setKind] = useState<BlockKind>("mermaid");
  const [sources, setSources] = useState<Record<BlockKind, string>>(DEFAULTS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setKind(initial.kind);
      setSources({ ...DEFAULTS, [initial.kind]: initial.source });
    } else {
      setSources(DEFAULTS);
    }
  }, [open, initial]);

  const table = parseTableSource(sources.table);
  const setTable = (rows: string[][]) => setSources((s) => ({ ...s, table: JSON.stringify(rows) }));
  const cols = Math.max(1, ...table.map((r) => r.length));

  const submit = async () => {
    setBusy(true);
    try { await onSubmit(kind, sources[kind]); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar conteúdo" : "Inserir no canvas"}</DialogTitle>
        </DialogHeader>
        <Tabs value={kind} onValueChange={(v) => !editing && setKind(v as BlockKind)}>
          <TabsList>
            <TabsTrigger value="mermaid" disabled={editing && kind !== "mermaid"}>Diagrama Mermaid</TabsTrigger>
            <TabsTrigger value="markdown" disabled={editing && kind !== "markdown"}>Texto Markdown</TabsTrigger>
            <TabsTrigger value="table" disabled={editing && kind !== "table"}>Tabela</TabsTrigger>
          </TabsList>
          <TabsContent value="mermaid">
            <div className="grid grid-cols-2 gap-3 h-[420px]">
              <Textarea aria-label="Código Mermaid" className="font-mono text-xs h-full resize-none"
                value={sources.mermaid} onChange={(e) => setSources((s) => ({ ...s, mermaid: e.target.value }))} />
              <MermaidPreview code={sources.mermaid} />
            </div>
          </TabsContent>
          <TabsContent value="markdown">
            <div className="grid grid-cols-2 gap-3 h-[420px]">
              <Textarea aria-label="Texto Markdown" className="font-mono text-xs h-full resize-none"
                value={sources.markdown} onChange={(e) => setSources((s) => ({ ...s, markdown: e.target.value }))} />
              <div className="overflow-auto rounded-md border p-3"><MarkdownPreview content={sources.markdown} /></div>
            </div>
          </TabsContent>
          <TabsContent value="table">
            <div className="h-[420px] overflow-auto space-y-2">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setTable([...table, Array(cols).fill("")])}><Plus className="h-3 w-3 mr-1" />Linha</Button>
                <Button size="sm" variant="outline" onClick={() => setTable(table.map((r, i) => [...r, i === 0 ? `Coluna ${cols + 1}` : ""]))}><Plus className="h-3 w-3 mr-1" />Coluna</Button>
              </div>
              <table className="border-collapse">
                <tbody>
                  <tr>
                    {Array.from({ length: cols }, (_, c) => (
                      <td key={c} className="text-center">
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={cols <= 1}
                          aria-label={`Remover coluna ${c + 1}`}
                          onClick={() => setTable(table.map((r) => r.filter((_, j) => j !== c)))}><Trash2 className="h-3 w-3" /></Button>
                      </td>
                    ))}
                  </tr>
                  {table.map((row, r) => (
                    <tr key={r}>
                      {Array.from({ length: cols }, (_, c) => (
                        <td key={c} className="p-0.5">
                          <Input aria-label={`Célula ${r + 1}-${c + 1}`} className={`h-8 text-xs ${r === 0 ? "font-semibold" : ""}`}
                            value={row[c] ?? ""}
                            onChange={(e) => setTable(table.map((rr, i) => i !== r ? rr : Array.from({ length: cols }, (_, j) => j === c ? e.target.value : rr[j] ?? "")))} />
                        </td>
                      ))}
                      <td>
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={table.length <= 1}
                          aria-label={`Remover linha ${r + 1}`}
                          onClick={() => setTable(table.filter((_, i) => i !== r))}><Trash2 className="h-3 w-3" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{editing ? "Atualizar" : "Inserir"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
