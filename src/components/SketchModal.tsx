import React, { useEffect, useRef, useState } from 'react';
import { Eraser, Undo2, X } from 'lucide-react';
import { useBackHandler } from '../context/NotesContext';

interface SketchModalProps {
  open: boolean;
  onInsert: (dataUrl: string) => void;
  onClose: () => void;
}

const PEN_COLORS = [
  { id: 'ink', color: '#202124', label: 'Charcoal ink' },
  { id: 'amber', color: '#D9A928', label: 'Amber ink' },
  { id: 'red', color: '#E45B5B', label: 'Red ink' },
];

export function SketchModal({ open, onInsert, onClose }: SketchModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<ImageData[]>([]);
  const isDrawingRef = useRef(false);

  const [penColor, setPenColor] = useState('#202124');
  const [hasDrawing, setHasDrawing] = useState(false);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokesRef.current = [];
    setHasDrawing(false);
  };

  useEffect(() => {
    if (open) {
      window.setTimeout(initCanvas, 0);
    }
  }, [open]);

  useBackHandler(open, onClose);
  if (!open) return null;

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    strokesRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (strokesRef.current.length > 25) strokesRef.current.shift();

    const { x, y } = getCoords(e);
    isDrawingRef.current = true;
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    setHasDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
  };

  const handleUndoStroke = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || strokesRef.current.length === 0) return;
    const prev = strokesRef.current.pop()!;
    ctx.putImageData(prev, 0, 0);
    setHasDrawing(strokesRef.current.length > 0);
  };

  const handleInsert = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onInsert(dataUrl);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-[var(--bg-card)] border border-[var(--divider)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--text-primary)]">Quick Sketch</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sketch pad"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--divider)] bg-white">
          <canvas
            ref={canvasRef}
            width={640}
            height={380}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-full aspect-[640/380] touch-none cursor-crosshair block"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {PEN_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setPenColor(c.color)}
                aria-label={c.label}
                className={`h-7 w-7 rounded-full border-2 transition-transform cursor-pointer ${
                  penColor === c.color
                    ? 'scale-110 border-[var(--accent-primary)]'
                    : 'border-[var(--divider)]'
                }`}
                style={{ backgroundColor: c.color }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndoStroke}
              aria-label="Undo stroke"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={initCanvas}
              aria-label="Clear canvas"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              <Eraser className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-full bg-[var(--bg-subtle)] text-sm font-semibold text-[var(--text-primary)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!hasDrawing}
            onClick={handleInsert}
            className="flex-1 min-h-[44px] rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] disabled:opacity-40 cursor-pointer"
          >
            Insert Sketch
          </button>
        </div>
      </div>
    </div>
  );
}
