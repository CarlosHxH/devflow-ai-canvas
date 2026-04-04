import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { MermaidRenderer } from "@/components/canvas/MermaidRenderer";

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-a:text-primary prose-code:text-primary prose-blockquote:border-l-primary/50 prose-blockquote:text-muted-foreground prose-li:text-foreground/90 prose-table:text-foreground/90 prose-th:text-foreground prose-td:text-foreground/80 prose-hr:border-border">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeStr = String(children).replace(/\n$/, "");

            if (match?.[1] === "mermaid") {
              return <MermaidRenderer code={codeStr} className="my-4" />;
            }

            if (match) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  className="rounded-lg !bg-card border border-border text-sm"
                  customStyle={{ margin: 0, fontSize: "0.8125rem" }}
                >
                  {codeStr}
                </SyntaxHighlighter>
              );
            }

            return (
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono" {...props}>
                {children}
              </code>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4 rounded-lg border border-border">
                <table className="w-full text-sm">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="bg-muted px-3 py-2 text-left text-xs font-semibold border-b border-border">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-3 py-2 text-xs border-b border-border/50">
                {children}
              </td>
            );
          },
          a({ children, href }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {children}
              </a>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground my-4">
                {children}
              </blockquote>
            );
          },
          input({ checked, ...props }) {
            return (
              <input
                type="checkbox"
                checked={checked}
                disabled
                className="mr-2 accent-primary"
                {...props}
              />
            );
          },
        }}
      >
        {content || "*Sem conteúdo*"}
      </ReactMarkdown>
    </div>
  );
}
