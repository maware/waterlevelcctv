import { useEffect, useRef, useState } from 'react';
import { Camera, LogEntry } from '../types';
import { RotateCw, VolumeX, Volume2, Maximize, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraStreamProps {
  camera: Camera;
  url: string;
  isExpanded?: boolean;
  onLog?: (log: LogEntry) => void;
  onSelectCapture?: (dataUrl: string) => void;
  onSnapshotRecorded?: (snapshotInfo: { timestamp: string; label: string; fileUrl: string }) => void;
  onStatusChange?: (status: 'offline' | 'connecting' | 'online' | 'error') => void;
}

// แปลง HLS URL → MJPEG URL
// เช่น https://webrtc.watpuekwater.org/cam3_480p/index.m3u8 → /mjpeg/cam3
// เช่น https://webrtc.watpuekwater.org/live/cam501/index.m3u8 → /mjpeg/cam501
function toMjpegUrl(hlsUrl: string): string {
  try {
    const u = new URL(hlsUrl);
    const parts = u.pathname.replace('/index.m3u8', '').split('/').filter(Boolean);
    // เอา path สุดท้าย แล้วตัด suffix _480p / _1080p ออก
    let camId = parts[parts.length - 1];
    // ถ้าเป็น live/cam501 → cam501
    if (parts[0] === 'live') camId = parts[1];
    // ตัด _480p, _1080p ออก
    camId = camId.replace(/_(480p|720p|1080p)$/, '');
    return `/mjpeg/${camId}`;
  } catch {
    return hlsUrl;
  }
}
const HLS_CAM501_URL = '/live/cam501/index.m3u8';

export default function CameraStream({
  camera,
  url,
  isExpanded = false,
  onLog,
  onSnapshotRecorded,
  onStatusChange,
}: CameraStreamProps) {
  const imgRef = useRef<HTMLImageElement>(null);

  const [connectionState, setConnectionState] = useState<'connecting' | 'online' | 'offline' | 'error'>('connecting');
  const [retryCount, setRetryCount] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [snapshotTaken, setSnapshotTaken] = useState(false);

  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);
  useEffect(() => {
    if (onStatusChangeRef.current) onStatusChangeRef.current(connectionState);
  }, [connectionState]);

  const triggerLog = (type: 'info' | 'success' | 'warn' | 'error', message: string) => {
    if (onLog) onLog({ timestamp: new Date().toLocaleTimeString('th-TH'), type, message, camId: camera.id });
  };

  const mjpegUrl = toMjpegUrl(url);

  // Register capture callback (ดึงจาก img tag)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__cameraCaptures = (window as any).__cameraCaptures || {};
      (window as any).__cameraCaptures[camera.id] = () => {
        const img = imgRef.current;
        if (!img) return null;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 640;
          canvas.height = img.naturalHeight || 360;
          const ctx = canvas.getContext('2d');
          if (ctx) { ctx.drawImage(img, 0, 0); return canvas.toDataURL('image/jpeg'); }
        } catch {}
        return null;
      };
    }
    return () => {
      if (typeof window !== 'undefined' && (window as any).__cameraCaptures) {
        delete (window as any).__cameraCaptures[camera.id];
      }
    };
  }, [camera.id]);

  const handleSnapshot = () => {
    const img = imgRef.current;
    if (img && connectionState === 'online') {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 640;
        canvas.height = img.naturalHeight || 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg');
          setSnapshotTaken(true);
          setTimeout(() => setSnapshotTaken(false), 1200);
          if (onSnapshotRecorded) {
            onSnapshotRecorded({ timestamp: new Date().toLocaleTimeString('th-TH'), label: camera.label, fileUrl: dataUrl });
          }
        }
      } catch (err) {
        triggerLog('error', `ไม่สามารถจับภาพหน้าจอได้`);
      }
    }
  };

  const handleFullscreen = () => {
    const img = imgRef.current;
    if (img?.requestFullscreen) img.requestFullscreen();
  };

  // โหลด MJPEG ใหม่เมื่อ retry
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    setConnectionState('connecting');
    triggerLog('info', `กำลังเชื่อมต่อ MJPEG กล้อง ${camera.label} (${mjpegUrl})`);

    // เพิ่ม timestamp เพื่อ force reload
    img.src = `${mjpegUrl}?t=${Date.now()}`;

    img.onload = () => {
      setConnectionState('online');
      triggerLog('success', `กล้อง ${camera.label} เชื่อมต่อ MJPEG สำเร็จ`);
    };

     img.onerror = () => {
      setConnectionState('offline');
      triggerLog('error', `กล้อง ${camera.label} เชื่อมต่อ MJPEG ไม่ได้`);
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
      }, 3000);
    };
  }, [mjpegUrl, retryCount]);

  return (
    <div
      className="relative w-full h-full bg-black flex flex-col group overflow-hidden select-none"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="relative w-full flex-1 bg-slate-950 flex items-center justify-center">

        {/* MJPEG img tag */}
        {connectionState !== 'offline' && (
          <img
            ref={imgRef}
            alt={camera.label}
            id={camera.id === 'cam501' ? 'cam501-video' : undefined}
            className="w-full h-full object-cover object-center pointer-events-none"
            style={{ display: connectionState === 'online' ? 'block' : 'none' }}
          />
        )}

        {/* Offline */}
        {connectionState === 'offline' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-4 font-mono">
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none opacity-40" />
            <div className="relative z-10 flex flex-col items-center justify-center text-center">
              <AlertTriangle className="w-8 h-8 text-rose-500 mb-3 animate-pulse" />
              <div className="text-sm font-semibold tracking-wide text-rose-400 font-sans">DISCONNECTED / ออฟไลน์</div>
              <div className="text-[11px] text-slate-500 mt-1 max-w-[240px] leading-relaxed font-sans">
                {camera.label} — ไม่สามารถดึงสัญญาณภาพได้<br />
                <span className="text-[10px] font-mono text-slate-600">IP: {camera.ipAddress || '192.168.1.x'}</span>
              </div>
            </div>
            <div className="absolute bottom-2 right-2 text-[9px] text-slate-600 bg-black/45 px-2 py-0.5 rounded border border-slate-900/40 font-mono">
              UTC: {new Date().toISOString().replace('T', ' ').slice(0, 19)}
            </div>
          </div>
        )}

        {/* Connecting */}
        <AnimatePresence>
          {connectionState === 'connecting' && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/90 z-20 flex flex-col items-center justify-center text-center gap-3"
            >
              <div className="relative">
                <div className="w-10 h-10 border-2 border-slate-800 border-t-indigo-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] text-indigo-400 font-bold">{retryCount}</div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-slate-300 font-medium">กำลังเริ่มดึงภาพกล้อง CCTV...</span>
                <span className="text-[10px] font-mono text-slate-500">{camera.camPath}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Snapshot flash */}
        <AnimatePresence>
          {snapshotTaken && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: [1, 0] }} transition={{ duration: 0.5 }}
              className="absolute inset-0 bg-white z-30 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Controls */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }}
              className="absolute bottom-0 inset-x-0 z-10 bg-slate-950/90 border-t border-slate-800 p-2 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRetryCount(prev => prev + 1)}
                  className="p-1 px-2 text-[10px] flex items-center gap-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded border border-slate-800 transition"
                  title="เริ่มสตรีมกล้องใหม่"
                >
                  <RotateCw className="w-3 h-3 text-indigo-400" />
                  <span>รีสตาร์ท</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleFullscreen}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                  title="เปิดเต็มหน้าจอ"
                >
                  <Maximize className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}