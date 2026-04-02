import { AppLayout } from "@/components/layout/AppLayout";
import { ExcalidrawCanvas } from "@/components/canvas/ExcalidrawCanvas";

export default function Canvas() {
  return (
    <AppLayout title="Canvas & IA">
      <div className="animate-fade-in">
        <ExcalidrawCanvas />
      </div>
    </AppLayout>
  );
}
