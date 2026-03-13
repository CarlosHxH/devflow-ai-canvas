import { AppLayout } from "@/components/layout/AppLayout";
import { BookOpen } from "lucide-react";

export default function Docs() {
  return (
    <AppLayout title="Documentação">
      <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
        <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Wiki (em breve)</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Editor Markdown colaborativo com assistente IA contextual na Fase 4.
        </p>
      </div>
    </AppLayout>
  );
}
