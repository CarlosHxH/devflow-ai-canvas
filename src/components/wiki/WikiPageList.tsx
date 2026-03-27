import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Plus,
  ChevronRight,
  ChevronDown,
  Search,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface WikiPage {
  id: string;
  title: string;
  parent_id: string | null;
  position: number;
  content_markdown: string;
  created_at: string;
  updated_at: string;
}

interface WikiPageListProps {
  pages: WikiPage[];
  selectedPageId: string | null;
  onSelectPage: (id: string) => void;
  onCreatePage: (parentId?: string) => void;
  onDeletePage: (id: string) => void;
}

function PageTreeItem({
  page,
  pages,
  selectedPageId,
  onSelectPage,
  onCreatePage,
  onDeletePage,
  depth,
}: {
  page: WikiPage;
  pages: WikiPage[];
  selectedPageId: string | null;
  onSelectPage: (id: string) => void;
  onCreatePage: (parentId?: string) => void;
  onDeletePage: (id: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = pages
    .filter((p) => p.parent_id === page.id)
    .sort((a, b) => a.position - b.position);

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors hover:bg-accent/50",
          selectedPageId === page.id && "bg-accent text-accent-foreground"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelectPage(page.id)}
      >
        {children.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate flex-1">{page.title}</span>
        <div className="hidden group-hover:flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreatePage(page.id);
            }}
            className="p-0.5 rounded hover:bg-background"
            title="Adicionar subpágina"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeletePage(page.id);
            }}
            className="p-0.5 rounded hover:bg-destructive/20 text-destructive"
            title="Excluir"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {expanded &&
        children.map((child) => (
          <PageTreeItem
            key={child.id}
            page={child}
            pages={pages}
            selectedPageId={selectedPageId}
            onSelectPage={onSelectPage}
            onCreatePage={onCreatePage}
            onDeletePage={onDeletePage}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

export function WikiPageList({
  pages,
  selectedPageId,
  onSelectPage,
  onCreatePage,
  onDeletePage,
}: WikiPageListProps) {
  const [search, setSearch] = useState("");

  const rootPages = pages
    .filter((p) => !p.parent_id)
    .sort((a, b) => a.position - b.position);

  const filteredRootPages = search
    ? pages.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase())
      )
    : rootPages;

  return (
    <div className="flex flex-col h-full border-r border-border bg-sidebar">
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Páginas</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onCreatePage()}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar páginas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>
      <ScrollArea className="flex-1 px-1">
        {filteredRootPages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Nenhuma página criada
          </p>
        ) : search ? (
          filteredRootPages.map((page) => (
            <div
              key={page.id}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm hover:bg-accent/50",
                selectedPageId === page.id && "bg-accent text-accent-foreground"
              )}
              onClick={() => onSelectPage(page.id)}
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{page.title}</span>
            </div>
          ))
        ) : (
          filteredRootPages.map((page) => (
            <PageTreeItem
              key={page.id}
              page={page}
              pages={pages}
              selectedPageId={selectedPageId}
              onSelectPage={onSelectPage}
              onCreatePage={onCreatePage}
              onDeletePage={onDeletePage}
              depth={0}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
