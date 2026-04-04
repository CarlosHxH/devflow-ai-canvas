import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Link,
  Image,
  Table,
  Minus,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onContentChange: (newContent: string) => void;
  content: string;
}

type FormatAction = {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  action: (textarea: HTMLTextAreaElement, content: string) => { newContent: string; cursorPos: number };
};

function wrapSelection(
  textarea: HTMLTextAreaElement,
  content: string,
  before: string,
  after: string
): { newContent: string; cursorPos: number } {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = content.slice(start, end);

  if (selected) {
    const newContent = content.slice(0, start) + before + selected + after + content.slice(end);
    return { newContent, cursorPos: start + before.length + selected.length + after.length };
  }

  const placeholder = "texto";
  const newContent = content.slice(0, start) + before + placeholder + after + content.slice(end);
  return { newContent, cursorPos: start + before.length };
}

function insertAtCursor(
  textarea: HTMLTextAreaElement,
  content: string,
  text: string,
  cursorOffset?: number
): { newContent: string; cursorPos: number } {
  const start = textarea.selectionStart;
  const needsNewline = start > 0 && content[start - 1] !== "\n" ? "\n" : "";
  const insertion = needsNewline + text;
  const newContent = content.slice(0, start) + insertion + content.slice(start);
  return {
    newContent,
    cursorPos: start + insertion.length - (cursorOffset ?? 0),
  };
}

const SEPARATOR = "---";

const TABLE_TEMPLATE = `| Coluna 1 | Coluna 2 | Coluna 3 |
| --- | --- | --- |
| Dado 1 | Dado 2 | Dado 3 |`;

export function MarkdownToolbar({ textareaRef, onContentChange, content }: MarkdownToolbarProps) {
  const exec = (action: FormatAction["action"]) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { newContent, cursorPos } = action(textarea, content);
    onContentChange(newContent);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const groups: (FormatAction | typeof SEPARATOR)[][] = [
    [
      {
        icon: <Heading1 className="h-3.5 w-3.5" />,
        label: "Título 1",
        action: (ta, c) => insertAtCursor(ta, c, "# "),
      },
      {
        icon: <Heading2 className="h-3.5 w-3.5" />,
        label: "Título 2",
        action: (ta, c) => insertAtCursor(ta, c, "## "),
      },
      {
        icon: <Heading3 className="h-3.5 w-3.5" />,
        label: "Título 3",
        action: (ta, c) => insertAtCursor(ta, c, "### "),
      },
    ],
    [
      {
        icon: <Bold className="h-3.5 w-3.5" />,
        label: "Negrito",
        shortcut: "Ctrl+B",
        action: (ta, c) => wrapSelection(ta, c, "**", "**"),
      },
      {
        icon: <Italic className="h-3.5 w-3.5" />,
        label: "Itálico",
        shortcut: "Ctrl+I",
        action: (ta, c) => wrapSelection(ta, c, "_", "_"),
      },
      {
        icon: <Strikethrough className="h-3.5 w-3.5" />,
        label: "Tachado",
        action: (ta, c) => wrapSelection(ta, c, "~~", "~~"),
      },
      {
        icon: <Code className="h-3.5 w-3.5" />,
        label: "Código inline",
        action: (ta, c) => wrapSelection(ta, c, "`", "`"),
      },
    ],
    [
      {
        icon: <List className="h-3.5 w-3.5" />,
        label: "Lista",
        action: (ta, c) => insertAtCursor(ta, c, "- Item\n"),
      },
      {
        icon: <ListOrdered className="h-3.5 w-3.5" />,
        label: "Lista numerada",
        action: (ta, c) => insertAtCursor(ta, c, "1. Item\n"),
      },
      {
        icon: <ListChecks className="h-3.5 w-3.5" />,
        label: "Checklist",
        action: (ta, c) => insertAtCursor(ta, c, "- [ ] Item\n"),
      },
    ],
    [
      {
        icon: <Quote className="h-3.5 w-3.5" />,
        label: "Citação",
        action: (ta, c) => insertAtCursor(ta, c, "> "),
      },
      {
        icon: <Link className="h-3.5 w-3.5" />,
        label: "Link",
        action: (ta, c) => wrapSelection(ta, c, "[", "](url)"),
      },
      {
        icon: <Image className="h-3.5 w-3.5" />,
        label: "Imagem",
        action: (ta, c) => insertAtCursor(ta, c, "![alt](url)\n"),
      },
      {
        icon: <Table className="h-3.5 w-3.5" />,
        label: "Tabela",
        action: (ta, c) => insertAtCursor(ta, c, TABLE_TEMPLATE + "\n"),
      },
      {
        icon: <Minus className="h-3.5 w-3.5" />,
        label: "Linha horizontal",
        action: (ta, c) => insertAtCursor(ta, c, "\n---\n"),
      },
    ],
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border bg-muted/30 flex-wrap">
        {groups.map((group, gi) => (
          <div key={gi} className="flex items-center gap-0.5">
            {gi > 0 && <Separator orientation="vertical" className="h-5 mx-1" />}
            {group.map((item, i) => {
              if (typeof item === "string") return null;
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => exec(item.action)}
                    >
                      {item.icon}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {item.label}
                    {item.shortcut && (
                      <span className="ml-2 text-muted-foreground">{item.shortcut}</span>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
