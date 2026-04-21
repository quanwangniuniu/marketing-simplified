
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, RotateCcw, ZoomIn, ZoomOut, Eye } from 'lucide-react';
import { uploadTiktokImage } from '@/lib/api/tiktokApi';

interface TiktokCropImageDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  imageFile?: File;
  imageFiles?: File[];
  initialIndex?: number;
  onConfirm: (croppedFile: File, ratio: string, index?: number) => void;
}

// 固定编辑容器（放大一些，保证更沉浸的编辑体验）
const EDIT_W = 900;
const EDIT_H = 530;

const RATIOS = [
  { label: 'Horizontal', value: '16:9', r: 1200 / 628 },
  { label: 'Square', value: '1:1', r: 1 },
  { label: 'Vertical', value: '9:16', r: 9 / 16 },
] as const;

type RatioValue = typeof RATIOS[number]['value'];

type Transform = { scale: number; x: number; y: number }; // 图片在编辑容器内的平移/缩放

const TiktokCropImageDrawer: React.FC<TiktokCropImageDrawerProps> = ({
  isOpen,
  onClose,
  imageFile,
  imageFiles,
  initialIndex = 0,
  onConfirm,
}) => {
  const files = imageFiles && imageFiles.length ? imageFiles : imageFile ? [imageFile] : [];
  const [idx, setIdx] = useState(initialIndex);
  const [imgUrl, setImgUrl] = useState('');
  const [imgNat, setImgNat] = useState({ w: 0, h: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  const [fillBlur, setFillBlur] = useState(true);
  const [ratioVal, setRatioVal] = useState<RatioValue>('16:9');
  const ratio = useMemo(() => RATIOS.find(r => r.value === ratioVal)!.r, [ratioVal]);

  // 可变裁剪框（保持比例），初始为容器内最大
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number }>(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  useEffect(() => {
    const boxR = EDIT_W / EDIT_H;
    let w: number, h: number;
    if (ratio > boxR) { w = EDIT_W; h = Math.round(EDIT_W / ratio); } else { h = EDIT_H; w = Math.round(EDIT_H * ratio); }
    const x = Math.round((EDIT_W - w) / 2);
    const y = Math.round((EDIT_H - h) / 2);
    setCropRect({ x, y, w, h });
  }, [ratio]);

  // 初始化/切换图片
  useEffect(() => {
    const f = files[idx];
    if (!f) return;
    const u = URL.createObjectURL(f);
    setImgUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [files, idx]);

  // 变换状态：scale/center
  const [tf, setTf] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  // 初始化或切换图片时：设置缩放并把图片居中到当前裁剪框中心
  useEffect(() => {
    if (!imgNat.w || !imgNat.h) return;
    const s = Math.min(cropRect.w / imgNat.w, cropRect.h / imgNat.h);
    setTf({ scale: s, x: cropRect.x + cropRect.w / 2, y: cropRect.y + cropRect.h / 2 });
  }, [imgNat.w, imgNat.h, idx]);
  // 比例变化时仅调整缩放，不改变当前位置，避免用户拖动裁剪框时图片跟着移动
  useEffect(() => {
    if (!imgNat.w || !imgNat.h) return;
    const s = Math.min(cropRect.w / imgNat.w, cropRect.h / imgNat.h);
    setTf((t) => ({ ...t, scale: s }));
  }, [ratioVal]);

  // 移动与缩放裁剪框（不移动图片）
  const moveRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; corner: 'nw'|'ne'|'sw'|'se' } | null>(null);
  const onMoveStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    moveRef.current = { sx: e.clientX, sy: e.clientY, ox: cropRect.x, oy: cropRect.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (moveRef.current) {
      const dx = e.clientX - moveRef.current.sx;
      const dy = e.clientY - moveRef.current.sy;
      const nx = Math.max(0, Math.min(EDIT_W - cropRect.w, moveRef.current.ox + dx));
      const ny = Math.max(0, Math.min(EDIT_H - cropRect.h, moveRef.current.oy + dy));
      setCropRect((r) => ({ ...r, x: nx, y: ny }));
      return;
    }
    if (resizeRef.current) {
      onResizeMove(e);
    }
  };
  const stopDrag = () => { moveRef.current = null; resizeRef.current = null; };

   // 开始调整裁剪框尺寸
   const onResizeStart = (corner: 'nw'|'ne'|'sw'|'se') => (e: React.MouseEvent) => {
     e.stopPropagation();
     resizeRef.current = { sx: e.clientX, sy: e.clientY, ox: cropRect.x, oy: cropRect.y, ow: cropRect.w, oh: cropRect.h, corner };
   };
   const onResizeMove = (e: React.MouseEvent) => {
     if (!resizeRef.current) return;
     const { sx, sy, ox, oy, ow, oh, corner } = resizeRef.current;
     let dx = e.clientX - sx; let dy = e.clientY - sy;
     // 将位移投影到等比例变化上，依据 corner 确定基向量
     if (corner === 'nw' || corner === 'se') { dy = dx / ratio; } else { dy = -dx / ratio; }
     let newW = Math.max(40, ow + (corner.includes('e') ? dx : -dx));
     let newH = Math.round(newW / ratio);
     if (corner.includes('n')) {
       const newY = oy + (oh - newH);
       const clampedY = Math.max(0, Math.min(EDIT_H - newH, newY));
       const adjustH = oh + (oy - clampedY);
       newW = Math.round(adjustH * ratio); newH = adjustH;
       const clampedX = Math.max(0, Math.min(EDIT_W - newW, ox + (ow - newW)));
       setCropRect({ x: clampedX, y: clampedY, w: newW, h: newH });
     } else if (corner.includes('w')) {
       const newX = ox + (ow - newW);
       const clampedX = Math.max(0, Math.min(EDIT_W - newW, newX));
       const adjustW = ow + (ox - clampedX);
       newW = adjustW; newH = Math.round(adjustW / ratio);
       const clampedY = Math.max(0, Math.min(EDIT_H - newH, oy + (oh - newH)));
       setCropRect({ x: clampedX, y: clampedY, w: newW, h: newH });
     } else {
       // se / ne 增长方向在右侧
       newW = Math.max(40, ow + dx);
       newH = Math.round(newW / ratio);
       const clampedW = Math.min(newW, EDIT_W - ox);
       const clampedH = Math.min(newH, EDIT_H - oy);
       // 兼顾比例，取受限更强的一侧
       const constrainedW = Math.min(clampedW, Math.round(clampedH * ratio));
       const constrainedH = Math.round(constrainedW / ratio);
       setCropRect({ x: ox, y: oy, w: constrainedW, h: constrainedH });
     }
   };

  // 缩放（围绕当前中心点缩放）
  const zoom = (k: number) => {
    setTf((t) => ({ ...t, scale: Math.max(0.1, Math.min(10, t.scale * k)) }));
  };

  // 预览画布（右侧，显示最终导出图）
   const prevCanvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cvs = prevCanvasRef.current; const img = imgRef.current; if (!cvs || !img) return;
    const outW = ratioVal === '16:9' ? 1200 : ratioVal === '1:1' ? 640 : 720; // 与后端校验一致
    const outH = Math.round(outW / ratio);
    cvs.width = outW; cvs.height = outH;
    const ctx = cvs.getContext('2d'); if (!ctx) return;
    // 背景填充（模糊）
    if (fillBlur) {
      ctx.filter = 'blur(24px)';
      const s = Math.max(outW / imgNat.w, outH / imgNat.h);
      const bw = imgNat.w * s, bh = imgNat.h * s;
      ctx.drawImage(img, (outW - bw) / 2, (outH - bh) / 2, bw, bh);
      ctx.filter = 'none';
    } else ctx.clearRect(0, 0, outW, outH);

    // 根据编辑视图的 transform 计算裁剪区域 → 映射到输出
    // 视图中图片的像素到编辑容器映射：图片中心点在 (tf.x, tf.y)，缩放 tf.scale。
    // 将输出画布内的裁剪框等效为编辑视图中的 cropRect。
    // 先把输出画布映射到编辑裁剪框等比缩放填充
    const scaleOut = outW / cropRect.w; // 横向填满

    // 计算在编辑容器内，某个画布像素对应回图片原始像素的仿射
    // 对于输出的每个像素，我们用 drawImage 一次性完成：传入源裁剪矩形
    // 求源裁剪：在编辑视图中，cropRect 范围内显示的是图片坐标：
    const invScale = 1 / tf.scale;
    // 左上角在编辑视图坐标 = (cropRect.x, cropRect.y)
    // 以图片中心为原点，编辑视图坐标点 (vx,vy) 对应的图片像素：
    const viewToImg = (vx: number, vy: number) => ({
      ix: (vx - tf.x) * invScale + imgNat.w / 2,
      iy: (vy - tf.y) * invScale + imgNat.h / 2,
    });
     const p1 = viewToImg(cropRect.x, cropRect.y);
     const p2 = viewToImg(cropRect.x + cropRect.w, cropRect.y + cropRect.h);

    ctx.drawImage(
      img,
      p1.ix, p1.iy,
      Math.max(1, p2.ix - p1.ix),
      Math.max(1, p2.iy - p1.iy),
      0, 0,
      outW, outH,
    );
  }, [ratio, ratioVal, tf.x, tf.y, tf.scale, imgNat.w, imgNat.h, imgUrl, fillBlur, cropRect.x, cropRect.y, cropRect.w, cropRect.h]);

  // 导出（与右侧预览同逻辑）
   const exportCanvasRef = useRef<HTMLCanvasElement>(null);
   const handleConfirm = async () => {
    const img = imgRef.current; const out = exportCanvasRef.current; if (!img || !out) return;
    const outW = ratioVal === '16:9' ? 1200 : ratioVal === '1:1' ? 640 : 720;
    const outH = Math.round(outW / ratio);
    out.width = outW; out.height = outH;
    const ctx = out.getContext('2d'); if (!ctx) return;

    if (fillBlur) {
      ctx.filter = 'blur(24px)';
      const s = Math.max(outW / imgNat.w, outH / imgNat.h);
      const bw = imgNat.w * s, bh = imgNat.h * s;
      ctx.drawImage(img, (outW - bw) / 2, (outH - bh) / 2, bw, bh);
      ctx.filter = 'none';
    } else ctx.clearRect(0, 0, outW, outH);

    const invScale = 1 / tf.scale;
    const viewToImg = (vx: number, vy: number) => ({
      ix: (vx - tf.x) * invScale + imgNat.w / 2,
      iy: (vy - tf.y) * invScale + imgNat.h / 2,
    });
    const p1 = viewToImg(cropRect.x, cropRect.y);
    const p2 = viewToImg(cropRect.x + cropRect.w, cropRect.y + cropRect.h);

    ctx.drawImage(
      img,
      p1.ix, p1.iy,
      Math.max(1, p2.ix - p1.ix),
      Math.max(1, p2.iy - p1.iy),
      0, 0,
      outW, outH,
    );

     const blob: Blob | null = await new Promise((resolve) => out.toBlob((b)=>resolve(b), 'image/jpeg', 0.9));
     if (!blob) return;
     const base = files[idx]?.name || 'image.jpg';
     const file = new File([blob], base.replace(/\.(png|jpe?g|webp)$/i, '') + '.jpg', { type: 'image/jpeg' });
     try {
       await uploadTiktokImage(file);
     } finally {
       onConfirm(file, ratioVal, idx);
       onClose();
     }
  };

  if (!isOpen || !files[idx]) return null;

  return (
    <div className="fixed inset-0 z-[10001]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-4 bg-white rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-lg">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold">Crop image</h2>
          </div>
        </div>

        {/* Top Controls */}
        <div className="px-6 py-3 border-b flex items-center justify-between">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="w-4 h-4" checked={fillBlur} onChange={(e)=>setFillBlur(e.target.checked)} />
            <span className="text-sm">Fill the blank area with Gaussian Blur</span>
          </label>
          <select value={ratioVal} onChange={(e)=>setRatioVal(e.target.value as RatioValue)} className="px-3 py-1 border rounded text-sm">
            {RATIOS.map(r => (<option key={r.value} value={r.value}>{r.label}</option>))}
          </select>
          <div className="flex items-center gap-2 text-sm text-gray-600"><span>Preview</span><Eye className="w-4 h-4"/></div>
        </div>

        <div className="flex-1 flex">
          {/* 左侧缩略图（多图时） */}
          {files.length>1 && (
            <div className="w-40 border-r p-4 space-y-3 overflow-y-auto">
              {files.map((f,i)=>{
                const u = URL.createObjectURL(f);
                return (
                  <button key={i} onClick={()=>setIdx(i)} className={`block w-full aspect-[4/3] rounded border overflow-hidden ${i===idx?'ring-2 ring-teal-600 border-teal-600':'border-gray-300 hover:border-gray-400'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} onLoad={()=>URL.revokeObjectURL(u)} alt="thumb" className="w-full h-full object-cover"/>
                  </button>
                );
              })}
            </div>
          )}

          {/* 中间固定编辑模块 720×460 */}
          <div className="flex-1 p-6">
            <div
              className="relative mx-auto border rounded-lg overflow-hidden bg-gray-100"
              style={{ width: EDIT_W, height: EDIT_H }}
              onMouseMove={onMouseMove}
              onMouseUp={stopDrag}
              onMouseLeave={stopDrag}
            >
              {/* 背景模糊层（填充整个 720×460） */}
              <canvas className="absolute inset-0" ref={(el)=>{
                if(!el) return; const ctx=el.getContext('2d'); const img=imgRef.current; if(!ctx||!img) return; el.width=EDIT_W; el.height=EDIT_H; ctx.clearRect(0,0,EDIT_W,EDIT_H);
                if (fillBlur){
                  ctx.filter='blur(24px)';
                  const s=Math.max(EDIT_W/imgNat.w, EDIT_H/imgNat.h);
                  const bw=imgNat.w*s, bh=imgNat.h*s;
                  ctx.drawImage(img,(EDIT_W-bw)/2,(EDIT_H-bh)/2,bw,bh);
                  ctx.filter='none';
                }
              }}/>

              {/* 图片本体：以中心点 tf.x/tf.y + scale 渲染，裁剪框外区域半透明遮罩 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={imgUrl}
                alt="to crop"
                onLoad={(e)=>{
                  const im=e.currentTarget; setImgNat({w:im.naturalWidth,h:im.naturalHeight});
                }}
                draggable={false}
                className="absolute select-none"
                style={{
                  left: 0,
                  top: 0,
                  width: imgNat.w*tf.scale,
                  height: imgNat.h*tf.scale,
                  transform: `translate(${tf.x - (imgNat.w*tf.scale)/2}px, ${tf.y - (imgNat.h*tf.scale)/2}px)`,
                }}
              />

              {/* 裁剪框 */}
              <div
                className="absolute border-2 border-[#3CCED7] cursor-move"
                style={{ left: cropRect.x, top: cropRect.y, width: cropRect.w, height: cropRect.h }}
                onMouseDown={onMoveStart}
              >
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                  {Array.from({length:9}).map((_,i)=>(<div key={i} className="border border-white/30"/>))}
                </div>
                {/* 拖拽手柄 */}
                <div onMouseDown={onResizeStart('nw')} className="absolute -top-1 -left-1 w-3 h-3 bg-white border border-[#3CCED7] rounded-sm cursor-nwse-resize" />
                <div onMouseDown={onResizeStart('ne')} className="absolute -top-1 -right-1 w-3 h-3 bg-white border border-[#3CCED7] rounded-sm cursor-nesw-resize" />
                <div onMouseDown={onResizeStart('sw')} className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border border-[#3CCED7] rounded-sm cursor-nesw-resize" />
                <div onMouseDown={onResizeStart('se')} className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border border-[#3CCED7] rounded-sm cursor-nwse-resize" />
              </div>

              {/* 遮罩（裁剪框外区域） */}
              <div className="absolute inset-0 pointer-events-none" aria-hidden>
                <svg width={EDIT_W} height={EDIT_H} className="block">
                  <defs>
                    <mask id="m">
                      <rect x="0" y="0" width={EDIT_W} height={EDIT_H} fill="#fff"/>
                      <rect x={cropRect.x} y={cropRect.y} width={cropRect.w} height={cropRect.h} fill="#000"/>
                    </mask>
                  </defs>
                  <rect x="0" y="0" width={EDIT_W} height={EDIT_H} fill="rgba(0,0,0,0.35)" mask="url(#m)"/>
                </svg>
              </div>

              {/* 浮层按钮 */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-4 flex items-center gap-3">
                <button onClick={()=>{ // 重置平移缩放
                  const s = Math.max(cropRect.w/imgNat.w, cropRect.h/imgNat.h);
                  setTf({ scale: s, x: cropRect.x + cropRect.w/2, y: cropRect.y + cropRect.h/2 });
                }} className="flex items-center gap-2 px-3 py-2 rounded-md bg-black/60 text-white text-sm hover:bg-black/70"><RotateCcw className="w-4 h-4"/>Reset</button>
                <button onClick={()=>zoom(1.1)} className="p-2 rounded-md bg-black/60 text-white hover:bg-black/70" aria-label="Zoom in"><ZoomIn className="w-4 h-4"/></button>
                <button onClick={()=>zoom(0.9)} className="p-2 rounded-md bg-black/60 text-white hover:bg-black/70" aria-label="Zoom out"><ZoomOut className="w-4 h-4"/></button>
              </div>
            </div>
          </div>

          {/* 右侧 Preview */}
          <div className="w-80 border-l p-6">
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden bg-gray-100" style={{ width: 240, height: Math.round(240/ratio) }}>
                <canvas ref={prevCanvasRef} style={{ width: '100%', height: '100%' }} />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900 mb-1">Creative spec</div>
                <div className="text-sm text-gray-600">{ratioVal==='16:9'?'1200x628':ratioVal==='1:1'?'640x640':'720x1280'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900 mb-2">Available placements</div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-black rounded flex items-center justify-center"><span className="text-white text-xs font-bold">T</span></div>
                  <span className="text-sm text-gray-600">TikTok</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={handleConfirm} className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">Confirm</button>
        </div>
      </div>

      {/* 隐藏导出画布 */}
      <canvas ref={exportCanvasRef} className="hidden" />
    </div>
  );
};

export default TiktokCropImageDrawer;
