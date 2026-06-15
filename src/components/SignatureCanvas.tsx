import React, { useRef, useState, useEffect } from 'react';

interface SignatureCanvasProps {
  onSave: (dataUrl: string) => void | Promise<void>;
  isLoading?: boolean;
}

export default function SignatureCanvas({ onSave, isLoading = false }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configure drawing parameters for high fluid fidelity
    ctx.strokeStyle = '#1e1b4b'; // Deep Indigo
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Prevent default body scrolling on touch devices when drawing
    const preventScroll = (e: TouchEvent) => {
      if (e.target === canvas) {
        e.preventDefault();
      }
    };
    document.body.addEventListener('touchstart', preventScroll, { passive: false });
    document.body.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      document.body.removeEventListener('touchstart', preventScroll);
      document.body.removeEventListener('touchmove', preventScroll);
    };
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pos = getCoordinates(e, canvas);
    if (!pos) return;

    setIsDrawing(true);
    lastPos.current = pos;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const pos = getCoordinates(e, canvas);
    if (!ctx || !pos || !lastPos.current) return;

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPos.current = pos;
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSubmit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    const dataUrl = canvas.toDataURL('image/png');
    await onSave(dataUrl);
  };

  return (
    <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
      <div className="flex justify-between items-center">
        <span className="text-xs font-black text-indigo-950 flex items-center gap-1">
          ✍️ 학생 확인 서명 패드
        </span>
        <button
          type="button"
          onClick={clearCanvas}
          className="text-[10px] font-bold text-slate-500 hover:text-slate-800 border border-slate-300 rounded px-2 py-0.5 bg-white transition cursor-pointer"
        >
          지우기
        </button>
      </div>

      <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl overflow-hidden relative shadow-inner">
        <canvas
          ref={canvasRef}
          width={360}
          height={140}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-[140px] block cursor-crosshair touch-none"
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-[11px] font-bold">
            선명하게 서명을 그려주세요
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={!hasDrawn || isLoading}
        onClick={handleSubmit}
        className={`w-full py-2 rounded-xl text-xs font-extrabold text-white transition-all shadow-xs cursor-pointer ${
          hasDrawn && !isLoading
            ? 'bg-indigo-900 hover:bg-indigo-950 hover:shadow-sm'
            : 'bg-slate-350 cursor-not-allowed opacity-50'
        }`}
      >
        {isLoading ? '서명 저장 중...' : '서명 제출 및 확인 완료'}
      </button>
    </div>
  );
}
