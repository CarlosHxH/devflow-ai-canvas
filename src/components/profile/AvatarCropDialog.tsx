import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, RotateCw } from "lucide-react";

interface Props {
  open: boolean;
  imageFile: File | null;
  onClose: () => void;
  onCrop: (blob: Blob) => void;
}

export function AvatarCropDialog({ open, imageFile, onClose, onCrop }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgSrc, setImgSrc] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const CANVAS_SIZE = 280;

  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setImgSrc(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (!imgSrc) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Center the image
      const scale = CANVAS_SIZE / Math.min(img.width, img.height);
      setZoom(scale);
      setOffset({
        x: (CANVAS_SIZE - img.width * scale) / 2,
        y: (CANVAS_SIZE - img.height * scale) / 2,
      });
    };
    img.src = imgSrc;
  }, [imgSrc]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw circular clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(img, offset.x, offset.y, img.width * zoom, img.height * zoom);
    ctx.restore();

    // Draw border ring
    ctx.strokeStyle = "hsl(var(--primary))";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }, [zoom, offset]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  };

  const handleMouseUp = () => {
    dragging.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;
    const t = e.touches[0];
    lastPos.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    const t = e.touches[0];
    const dx = t.clientX - lastPos.current.x;
    const dy = t.clientY - lastPos.current.y;
    lastPos.current = { x: t.clientX, y: t.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  };

  const handleCrop = () => {
    const img = imgRef.current;
    if (!img) return;

    // Render at higher res for quality
    const outputSize = 512;
    const scale = outputSize / CANVAS_SIZE;
    const outCanvas = document.createElement("canvas");
    outCanvas.width = outputSize;
    outCanvas.height = outputSize;
    const ctx = outCanvas.getContext("2d")!;

    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(
      img,
      offset.x * scale,
      offset.y * scale,
      img.width * zoom * scale,
      img.height * zoom * scale
    );

    outCanvas.toBlob(
      (blob) => {
        if (blob) onCrop(blob);
      },
      "image/png",
      1
    );
  };

  const handleZoom = (val: number[]) => {
    const img = imgRef.current;
    if (!img) return;
    const minScale = CANVAS_SIZE / Math.max(img.width, img.height);
    const maxScale = minScale * 4;
    const newZoom = minScale + (val[0] / 100) * (maxScale - minScale);
    
    // Zoom toward center
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    const ratio = newZoom / zoom;
    setOffset((o) => ({
      x: cx - (cx - o.x) * ratio,
      y: cy - (cy - o.y) * ratio,
    }));
    setZoom(newZoom);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recortar Foto de Perfil</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative cursor-grab active:cursor-grabbing rounded-full overflow-hidden border-2 border-muted"
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          >
            <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} />
          </div>

          <div className="flex items-center gap-3 w-full max-w-[280px]">
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider
              defaultValue={[30]}
              max={100}
              step={1}
              onValueChange={handleZoom}
              className="flex-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">Arraste para reposicionar</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleCrop}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
