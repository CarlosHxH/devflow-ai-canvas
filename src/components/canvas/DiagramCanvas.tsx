import { ExcalidrawCanvas } from "./ExcalidrawCanvas";

interface Props {
  projectId: string;
}

export function DiagramCanvas({ projectId }: Props) {
  return <ExcalidrawCanvas projectId={projectId} />;
}
