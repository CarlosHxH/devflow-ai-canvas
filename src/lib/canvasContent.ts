import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";

export type BlockKind = "mermaid" | "markdown" | "table";
export interface BlockMeta { kind: BlockKind; source: string; blockId: string }

const rid = () => Math.random().toString(36).slice(2, 12);

/** Shift elements so their top-left corner sits at (x, y) and tag them as one editable block. */
export function placeAndTag(elements: any[], x: number, y: number, kind: BlockKind, source: string) {
  const blockId = `blk_${rid()}`;
  const minX = Math.min(...elements.map((e) => e.x));
  const minY = Math.min(...elements.map((e) => e.y));
  const dx = x - minX;
  const dy = y - minY;
  return elements.map((e) => ({
    ...e,
    x: e.x + dx,
    y: e.y + dy,
    groupIds: [blockId],
    customData: { ...(e.customData || {}), kind, source, blockId },
  }));
}

/** Top-left of a group of elements. */
export function blockOrigin(elements: readonly any[]) {
  return {
    x: Math.min(...elements.map((e) => e.x)),
    y: Math.min(...elements.map((e) => e.y)),
  };
}

export function parseTableSource(source: string): string[][] {
  try {
    const data = JSON.parse(source);
    if (Array.isArray(data) && data.every(Array.isArray)) return data.map((r) => r.map(String));
  } catch { /* ignore */ }
  return [["Coluna 1", "Coluna 2"], ["", ""]];
}

function tableSkeleton(rows: string[][], x0: number, y0: number): ExcalidrawElementSkeleton[] {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const widths = Array.from({ length: cols }, (_, c) =>
    Math.max(120, ...rows.map((r) => (r[c] || "").length * 10 + 32)),
  );
  const h = 44;
  const out: ExcalidrawElementSkeleton[] = [];
  rows.forEach((row, ri) => {
    let x = x0;
    for (let c = 0; c < cols; c++) {
      const text = row[c] ?? "";
      out.push({
        type: "rectangle",
        x,
        y: y0 + ri * h,
        width: widths[c],
        height: h,
        strokeColor: "#a1a1aa",
        backgroundColor: ri === 0 ? "#27272a" : "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        roughness: 0,
        ...(text.trim() ? { label: { text, fontSize: 16 } } : {}),
      } as any);
      x += widths[c];
    }
  });
  return out;
}

export function buildTable(source: string) {
  return convertToExcalidrawElements(tableSkeleton(parseTableSource(source), 0, 0), { regenerateIds: true }) as any[];
}

const stripInline = (s: string) =>
  s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1")
    .replace(/~~(.+?)~~/g, "$1").replace(/!?\[(.*?)\]\((.*?)\)/g, "$1");

export function buildMarkdown(source: string) {
  const lines = source.replace(/\r/g, "").split("\n");
  const skel: ExcalidrawElementSkeleton[] = [];
  let y = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Markdown table
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        if (!/^\s*\|?\s*:?-{2,}/.test(lines[i]))
          rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => stripInline(c.trim())));
        i++;
      }
      const t = tableSkeleton(rows, 0, y);
      skel.push(...t);
      y += rows.length * 44 + 16;
      continue;
    }
    i++;
    if (!line.trim()) { y += 12; continue; }
    let text = line;
    let fontSize = 18;
    const hm = /^(#{1,6})\s+(.*)$/.exec(line);
    if (hm) { fontSize = [36, 28, 22, 20, 18, 18][hm[1].length - 1]; text = hm[2]; }
    else if (/^\s*[-*+]\s+\[( |x|X)\]\s+/.test(line)) text = line.replace(/^(\s*)[-*+]\s+\[( |x|X)\]\s+/, (_m, sp, c) => `${sp}${c.trim() ? "☑" : "☐"} `);
    else if (/^\s*[-*+]\s+/.test(line)) text = line.replace(/^(\s*)[-*+]\s+/, "$1• ");
    else if (/^>\s?/.test(line)) text = "│ " + line.replace(/^>\s?/, "");
    else if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      skel.push({ type: "line", x: 0, y: y + 8, points: [[0, 0], [400, 0]], strokeColor: "#71717a" } as any);
      y += 20; continue;
    }
    text = stripInline(text);
    skel.push({ type: "text", x: 0, y, text, fontSize, strokeColor: hm ? "#f4f4f5" : "#d4d4d8" } as any);
    y += fontSize * 1.4 + 6;
  }
  if (skel.length === 0) skel.push({ type: "text", x: 0, y: 0, text: " ", fontSize: 18 } as any);
  return convertToExcalidrawElements(skel, { regenerateIds: true }) as any[];
}

export function selectionIds(elements: any[]) {
  return Object.fromEntries(elements.map((e) => [e.id, true as const]));
}
