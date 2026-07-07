import { useEffect, useRef, useState } from 'react';
import { Camera, LogEntry } from '../types';
import { Play, RotateCw, VolumeX, Volume2, Maximize, Cpu, AlertTriangle, CheckCircle, Camera as CameraIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Hls from 'hls.js';

interface CameraStreamProps {
  camera: Camera;
  url: string;
  isExpanded?: boolean;
  onLog?: (log: LogEntry) => void;
  onSelectCapture?: (dataUrl: string) => void;
  onSnapshotRecorded?: (snapshotInfo: { timestamp: string; label: string; fileUrl: string }) => void;
  onStatusChange?: (status: 'offline' | 'connecting' | 'online' | 'error') => void;
}

function toMjpegUrl(hlsUrl: string): string {
  try {
    const u = new URL(hlsUrl);
    const parts = u.pathname.replace('/index.m3u8', '').split('/').filter(Boolean);
    let camId = parts[parts.length - 1];
    if (parts[0] === 'live') camId = parts[1];
    camId = camId.replace(/_(480p|720p|1080p)$/, '');
    return `/mjpeg/${camId}`;
  } catch {
    return hlsUrl;
  }
}

export default function CameraStream({
  camera,
  url,
  isExpanded = false,
  onLog,
  onSnapshotRecorded,
  onStatusChange,
}: CameraStreamProps) {
  const isCam501 = camera.id === 'cam501';
  const mjpegUrl = toMjpegUrl(url);

  // refs
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const statsIntervalRef = useRef<number | null>(null);

  const [connectionState, setConnectionState] = useState<'connecting' | 'online' | 'offline' | 'error'>('connecting');
  const [retryCount, setRetryCount] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [snapshotTaken, setSnapshotTaken] = useState(false);

  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);
  useEffect(() => {
    if (onStatusChangeRef.current) {
      onStatusChangeRef.current(isFallbackMode ? 'offline' : connectionState);
    }
  }, [connectionState, isFallbackMode]);

  const triggerLog = (type: 'info' | 'success' | 'warn' | 'error', message: string) => {
    if (onLog) onLog({ timestamp: new Date().toLocaleTimeString('th-TH'), type, message, camId: camera.id });
  };

  // ─── Register capture callback ────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__cameraCaptures = (window as any).__cameraCaptures || {};
      (window as any).__cameraCaptures[camera.id] = () => {
        if (isCam501) {
          const video = videoRef.current;
          if (video && video.readyState >= 1) {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth || 640;
              canvas.height = video.videoHeight || 360;
              const ctx = canvas.getContext('2d');
              if (ctx) { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/jpeg'); }
            } catch {}
          }
        } else {
          const img = imgRef.current;
          if (!img) return null;
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || 640;
            canvas.height = img.naturalHeight || 360;
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.drawImage(img, 0, 0); return canvas.toDataURL('image/jpeg'); }
          } catch {}
        }
        return null;
      };
    }
    return () => {
      if (typeof window !== 'undefined' && (window as any).__cameraCaptures) {
        delete (window as any).__cameraCaptures[camera.id];
      }
    };
  }, [camera.id, isCam501]);

  // ─── HLS สำหรับ cam501 ───────────────────────────────────────────────────

  useEffect(() => {
    if (!isCam501) return;
    let active = true;
    let startTimeout: any = null;

    const cleanupHls = () => {
      if (statsIntervalRef.current) {
        window.clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (e) {
          console.error('Error destroying HLS instance', e);
        }
        hlsRef.current = null;
      }
    };

    const startStreaming = async () => {
      if (!active) return;
      cleanupHls();
      setConnectionState('connecting');
      setIsFallbackMode(false);
      triggerLog('info', `กำลังเริ่มต้นเชื่อมต่อสตรีมกล้อง ${camera.label} ผ่านเทคโนโลยี HLS (${url})`);

      const video = videoRef.current;
      if (!video) return;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
if (Hls.isSupported() && !isIOS) {
        const hls = new Hls({
          maxMaxBufferLength: 10,
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;

        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!active) return;
          video.play()
            .then(() => {
              setConnectionState('online');
              triggerLog('success', `กล้อง ${camera.label} เชื่อมต่อสัญญาณ HLS สำเร็จ กำลังเล่นสตรีมย้อนหลัง/สด`);
            })
            .catch((err) => {
              console.warn('HLS play interrupted', err);
            });
        });



        hls.on(Hls.Events.ERROR, (event, data) => {
          if (!active) return;
          console.warn('HLS error:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('Fatal network error encountered, trying to recover...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('Fatal media error encountered, trying to recover...');
                hls.recoverMediaError();
                break;
              default:
                cleanupHls();
                setConnectionState('offline');
                setTimeout(() => setRetryCount(prev => prev + 1), 3000);
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Apple Safari / iOS iPhone)
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('x-webkit-airplay', 'allow');
        video.muted = true;
        video.autoplay = true;
        video.src = url;
        video.load();

        video.addEventListener('loadedmetadata', () => {
          if (!active) return;
          setConnectionState('online');
          triggerLog('success', `กล้อง ${camera.label} เชื่อมต่อสัญญาณ HLS (Native) สำเร็จ`);
        });

        video.addEventListener('error', (err) => {
          if (!active) return;
          console.warn('Native HLS video error:', err);
          setConnectionState('offline');
          setTimeout(() => setRetryCount(prev => prev + 1), 3000);
        });
      } else {
        setConnectionState('offline');
        triggerLog('error', `เบราว์เซอร์นี้ไม่รองรับการเล่นวิดีโอ HLS`);
      }
    };

    // Debounce connection initiation slightly (800ms) to let parent components settle
    startTimeout = setTimeout(() => {
      startStreaming();
    }, 800);

    return () => {
      active = false;
      cleanupHls();
      if (startTimeout) clearTimeout(startTimeout);
    };
  }, [retryCount, isCam501]);

  // ─── MJPEG สำหรับกล้องอื่น ───────────────────────────────────────────────
  useEffect(() => {
    if (isCam501) return;
    const img = imgRef.current;
    if (!img) return;

    setConnectionState('connecting');
    triggerLog('info', `กำลังเชื่อมต่อ MJPEG กล้อง ${camera.label} (${mjpegUrl})`);
    img.src = `${mjpegUrl}?t=${Date.now()}`;

    img.onload = () => {
      setConnectionState('online');
      triggerLog('success', `กล้อง ${camera.label} เชื่อมต่อ MJPEG สำเร็จ`);
    };
    img.onerror = () => {
      setConnectionState('offline');
      triggerLog('error', `กล้อง ${camera.label} เชื่อมต่อ MJPEG ไม่ได้`);
      setTimeout(() => setRetryCount(prev => prev + 1), 3000);
    };
  }, [mjpegUrl, retryCount, isCam501]);

  const handleFullscreen = () => {
    const el = isCam501 ? videoRef.current : imgRef.current;
    if (el?.requestFullscreen) el.requestFullscreen();
  };

  const handleSnapshot = () => {
    if (isCam501) {
      const video = videoRef.current;
      if (video && connectionState === 'online') {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg');
            setSnapshotTaken(true);
            setTimeout(() => setSnapshotTaken(false), 1200);
            if (onSnapshotRecorded) onSnapshotRecorded({ timestamp: new Date().toLocaleTimeString('th-TH'), label: camera.label, fileUrl: dataUrl });
          }
        } catch {}
      }
    } else {
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
            if (onSnapshotRecorded) onSnapshotRecorded({ timestamp: new Date().toLocaleTimeString('th-TH'), label: camera.label, fileUrl: dataUrl });
          }
        } catch {}
      }
    }
  };


  return (
    <div
      className={`relative w-full h-full bg-black flex flex-col group overflow-hidden select-none`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* 16:9 aspect ratio standard player layout */}
      <div className="relative w-full flex-1 aspect-ratio-video bg-slate-950 flex items-center justify-center">
        {isFallbackMode ? (
          /* Dark Disconnected Offline Canvas */
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 select-none text-slate-400 p-4 font-mono">
            {/* Elegant dark grid/scanlines pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none opacity-40"></div>
            
            {/* Warning indicator */}
            <div className="relative z-10 flex flex-col items-center justify-center text-center">
              <AlertTriangle className="w-8 h-8 text-rose-500 mb-3 animate-pulse" />
              <div className="text-sm font-semibold tracking-wide text-rose-400 font-sans">
                DISCONNECTED / ออฟไลน์
              </div>
              <div className="text-[11px] text-slate-500 mt-1 max-w-[240px] leading-relaxed font-sans">
                {camera.label} — ไม่สามารถดึงสัญญาณภาพได้<br />
                <span className="text-[10px] font-mono text-slate-600">IP: {camera.ipAddress || '192.168.1.x'}</span>
              </div>
            </div>

            {/* Time stamp indicator */}
            <div className="absolute bottom-2 right-2 text-[9px] text-slate-600 text-right bg-black/45 px-2 py-0.5 rounded border border-slate-900/40 font-mono">
              UTC: {new Date().toISOString().replace('T', ' ').slice(0, 19)}
            </div>
          </div>
        ) : (
          <>
            {/* cam501 — HLS video */}
            {isCam501 && (
              <video
                ref={videoRef}
                id="cam501-video"
                muted={isMuted}
                playsInline
                autoPlay
                className="w-full h-full object-cover object-center pointer-events-none"
              />
            )}
            {/* กล้องอื่น — MJPEG */}
            {!isCam501 && (
              <img
                ref={imgRef}
                alt={camera.label}
                className="w-full h-full object-cover object-center pointer-events-none"
                style={{ display: connectionState === 'online' ? 'block' : 'none' }}
              />
            )}
          </>
        )}

        {/* Loading / Error States overlay */}
        <AnimatePresence>
          {connectionState === 'connecting' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/90 z-20 flex flex-col items-center justify-center text-center gap-3"
            >
              <div className="relative">
                <div className="w-10 h-10 border-2 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] text-indigo-400 font-bold">
                  {retryCount}
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-slate-300 font-medium">กำลังเริ่มดึงภาพกล้อง CCTV...</span>
                <span className="text-[10px] font-mono text-slate-500">{camera.camPath}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Snapshot Taken Flash animation */}
        <AnimatePresence>
          {snapshotTaken && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 bg-white z-30 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Camera Tag Overlay removed */}

        {/* Hover Camera Controls Overlay (Bottom bar) */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="absolute bottom-0 inset-x-0 z-10 bg-slate-950/90 border-t border-slate-800 p-2 flex items-center justify-between gap-2"
            >
              {/* Media Controls */}
              <div className="flex items-center gap-1">
                {/* Connection recovery */}
                <button
                  type="button"
                  onClick={() => {
                    setConnectionState('connecting');
                    // wait 500ms and reconnect
                    setTimeout(() => {
                      setRetryCount(prev => prev + 1);
                      // manually reset
                      if (videoRef.current) {
                        videoRef.current.srcObject = null;
                      }
                    }, 500);
                  }}
                  className="p-1 px-2 text-[10px] flex items-center gap-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded border border-slate-800 transition"
                  title="เริ่มสตรีมกล้องใหม่"
                >
                  <RotateCw className="w-3 h-3 text-indigo-400" />
                  <span>รีสตาร์ท</span>
                </button>

                {/* Audio Unmute (In case there's audio) */}
                <button
                  type="button"
                  onClick={() => setIsMuted(prev => !prev)}
                  className={`p-1.5 rounded transition ${isMuted ? 'text-slate-500 hover:bg-slate-800' : 'text-emerald-400 bg-emerald-500/10'}`}
                  title={isMuted ? "เปิดเสียงสัญญาณเสียง" : "ปิดเสียงสปีกเกอร์"}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Utility Tools */}
              <div className="flex items-center gap-1.5">
                {/* Fully standard HTML Fullscreen handler */}
                <button
                  type="button"
                  onClick={handleFullscreen}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                  title="เปิดเต็มหน้าจอพจนานุกรม"
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
