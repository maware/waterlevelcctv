import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Cpu, HardDrive, Shield, Cloud, Monitor, Video, ChevronRight, Server, RefreshCw, Layers } from 'lucide-react';

interface TopologyNode {
  id: string;
  label: string;
  ipAndPort: string;
  details: string;
  role: string;
  icon: React.ReactNode;
  color: string;
}

export default function NetworkTopology({ isDarkMode = true }: { isDarkMode?: boolean }) {
  const [activeNode, setActiveNode] = useState<string | null>(null);

  const nodes: TopologyNode[] = [
    {
      id: 'rtsp',
      label: 'กล้อง RTSP',
      ipAndPort: '192.168.1.x / 192.168.1.2, 192.168.1.4',
      details: 'กล้องวงจรปิดภายในวัด ส่งสตรีมแบบ RTSP ในวง LAN ท้องถิ่น',
      role: 'Source',
      icon: <Video className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />,
      color: 'emerald',
    },
    {
      id: 'rpi',
      label: 'Raspberry Pi (MediaMTX)',
      ipAndPort: '100.125.241.65:8554',
      details: 'บอร์ด Raspberry Pi รัน MediaMTX คอยดึง (Pull) สตรีม RTSP จากกล้องเข้ามาเป็นประจำ',
      role: 'Edge Relay',
      icon: <Cpu className={`w-5 h-5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />,
      color: 'indigo',
    },
    {
      id: 'tailscale',
      label: 'Tailscale VPN',
      ipAndPort: '100.x.x.x (WireGuard Private VPN)',
      details: 'ทำระบบแลนเสมือนส่วนตัว (Secure SD-WAN) เชื่อมโยงอาคาร/เครือข่ายข้ามสาขา และเชื่อมต่อ Raspberry Pi เข้ากับเซิร์ฟเวอร์หลักได้อย่างปลอดภัยโดยไม่ต้องเปิดพอร์ตภายนอก',
      role: 'Secure Encrypted Tunnel',
      icon: <Shield className={`w-5 h-5 ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`} />,
      color: 'cyan',
    },
    {
      id: 'windows',
      label: 'Windows Server (MediaMTX)',
      ipAndPort: 'Tailscale Line :8554 / WebRTC Port :8889',
      details: 'เครื่องเซิร์ฟเวอร์ระบบหลัก รวบรวมและพักทราฟฟิก ดึงสตรีมมาจาก Raspberry Pi ผ่านทาง Tailscale แล้วแปลงสตรีมเพื่อส่งรูปแบบ WebRTC WHEP ออกไปอินเทอร์เน็ต',
      role: 'Primary Gateway & Transcoder',
      icon: <Server className={`w-5 h-5 ${isDarkMode ? 'text-amber-500' : 'text-amber-600'}`} />,
      color: 'amber',
    },
    {
      id: 'cloudflare',
      label: 'Cloudflare Tunnel',
      ipAndPort: 'https://webrtc.watpuekwater.org',
      details: 'ช่องทางเชื่อมต่อสถิติและวิดีโอแบบปลอดภัยภายนอก ป้องกันไอพีเครื่องเซิร์ฟเวอร์หลัก บีบอัดดาต้า สลับ TLS เอนสคริปต์สตรีม WebRTC WHEP เพื่อส่งให้ผู้ใช้งานเบราว์เซอร์',
      role: 'Secure Proxy & HTTPS Delivery',
      icon: <Cloud className={`w-5 h-5 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} />,
      color: 'sky',
    },
    {
      id: 'client',
      label: 'Web Browser / Client',
      ipAndPort: 'WHEP Over HTTPS/WebRTC',
      details: 'หน้าต่างรับชมภาพกล้องวงจรปิดแบบดีเลย์ต่ำมาก (Ultra Low Latency < 1 วินาที) สามารถสลับสตรีมรับชมกล้องได้พร้อมกัน 8 ตัว',
      role: 'Consumer / Web App',
      icon: <Monitor className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />,
      color: 'blue',
    },
  ];

  return (
    <div className={`border rounded-xl p-5 shadow-xl relative overflow-hidden transition-colors duration-300 ${
      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-sky-100 shadow-sm'
    }`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className={`text-sm font-semibold tracking-wide uppercase flex items-center gap-2 ${
          isDarkMode ? 'text-indigo-400' : 'text-blue-800'
        }`}>
          <Layers className="w-4 h-4" /> แผนภาพเส้นทางสตรีมมิ่ง (Streaming Pipeline)
        </h3>
        <span className={`text-[12px] font-bold px-2 py-1 rounded ${
          isDarkMode ? 'text-slate-400 bg-slate-800' : 'text-blue-800 bg-sky-50 border border-sky-100'
        }`}>
          คลิกลำดับขั้นตอนเพื่อดูทราฟฟิกและตรวจสอบระบบ
        </span>
      </div>

      <p className={`text-sm mb-6 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
        ข้อมูลสตรีมส่งจากกล้องวงจรปิดวัดปึกผ่านบอร์ด Raspberry Pi, เครือข่าย Tailscale VPN และประมวลสตรีมบนเครื่อง MediaMTX Windows ปลายทางเข้าสู่เว็บบราวเซอร์ผ่าน Cloudflare Tunnel
      </p>

      {/* Grid Flow */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center relative z-10">
        {nodes.map((node, index) => {
          const isActive = activeNode === node.id;
          const colors: Record<string, string> = isDarkMode ? {
            emerald: 'border-emerald-500/30 text-emerald-400 hover:border-emerald-400/80 hover:bg-emerald-950/20',
            indigo: 'border-indigo-500/30 text-indigo-400 hover:border-indigo-400/80 hover:bg-indigo-950/20',
            cyan: 'border-cyan-500/30 text-cyan-400 hover:border-cyan-400/80 hover:bg-cyan-950/20',
            amber: 'border-amber-500/30 text-amber-400 hover:border-amber-400/80 hover:bg-amber-950/20',
            sky: 'border-sky-500/30 text-sky-400 hover:border-sky-400/80 hover:bg-sky-950/20',
            blue: 'border-blue-500/30 text-blue-400 hover:border-blue-400/80 hover:bg-blue-950/20',
          } : {
            emerald: 'border-emerald-250 text-emerald-700 bg-emerald-50/30 hover:bg-emerald-50',
            indigo: 'border-indigo-250 text-indigo-700 bg-indigo-50/30 hover:bg-indigo-50',
            cyan: 'border-cyan-250 text-cyan-700 bg-cyan-50/30 hover:bg-cyan-50',
            amber: 'border-amber-250 text-amber-700 bg-amber-50/30 hover:bg-amber-50',
            sky: 'border-sky-250 text-sky-700 bg-sky-50/30 hover:bg-sky-50',
            blue: 'border-blue-250 text-blue-700 bg-blue-50/30 hover:bg-blue-50',
          };
          
          const textActive: Record<string, string> = isDarkMode ? {
            emerald: 'bg-emerald-500/15 border-emerald-400 text-emerald-100',
            indigo: 'bg-indigo-500/15 border-indigo-400 text-indigo-100',
            cyan: 'bg-cyan-500/15 border-cyan-400 text-cyan-100',
            amber: 'bg-amber-500/15 border-amber-400 text-amber-100',
            sky: 'bg-sky-500/15 border-sky-400 text-sky-100',
            blue: 'bg-blue-500/15 border-blue-400 text-blue-100',
          } : {
            emerald: 'bg-emerald-500 border-emerald-500 text-white font-bold',
            indigo: 'bg-indigo-500 border-indigo-500 text-white font-bold',
            cyan: 'bg-cyan-500 border-cyan-500 text-white font-bold',
            amber: 'bg-amber-500 border-amber-500 text-white font-bold',
            sky: 'bg-sky-500 border-sky-500 text-white font-bold',
            blue: 'bg-blue-500 border-blue-500 text-white font-bold',
          };

          return (
            <React.Fragment key={node.id}>
              {/* Connector for mobile */}
              {index > 0 && (
                <div className="flex md:hidden items-center justify-center -my-1 text-slate-450">
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveNode(isActive ? null : node.id)}
                className={`w-full flex md:flex-col items-center gap-3 p-3 text-left md:text-center rounded-xl border transition-all cursor-pointer ${
                  isActive ? textActive[node.color] : colors[node.color]
                } ${isDarkMode ? 'bg-slate-950/40' : 'bg-white'}`}
              >
                <div className={`p-2 rounded-lg border flex items-center justify-center relative ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  {node.icon}
                  {/* Data flow pulsing point */}
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-slate-950 animate-ping"></span>
                </div>
                
                <div className="flex-1 md:flex-initial">
                  <h4 className="text-xs font-semibold leading-tight">{node.label}</h4>
                  <p className={`text-[10px] mt-0.5 truncate font-mono ${isActive ? 'text-white' : 'text-slate-500'}`}>{node.ipAndPort}</p>
                </div>
              </motion.button>

              {/* Desktop arrow connector */}
              {index < nodes.length - 1 && (
                <div className="hidden md:flex items-center justify-center text-slate-700 relative h-full">
                  <ChevronRight className={`w-4 h-4 animate-pulse ${isDarkMode ? 'text-indigo-500/40' : 'text-blue-500/40'}`} />
                  <motion.div
                    animate={{ x: [-10, 10], opacity: [0, 1, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: index * 0.2 }}
                    className={`absolute w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-indigo-500' : 'bg-blue-500'}`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Dynamic Details Box */}
      <motion.div
        layout
        className="mt-4"
      >
        {activeNode ? (
          (() => {
            const node = nodes.find(n => n.id === activeNode);
            if (!node) return null;
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`border p-4 rounded-xl flex gap-4 items-start ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-sky-50/20 border-sky-100 text-slate-750'
                }`}
              >
                <div className={`p-3 border rounded-xl mt-1 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-sky-50 border-sky-100'}`}>
                  {node.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className={`font-extrabold text-sm ${isDarkMode ? 'text-slate-200' : 'text-blue-900'}`}>{node.label}</h4>
                    <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                      isDarkMode ? 'bg-slate-800 text-indigo-400 border-slate-700' : 'bg-sky-100 text-blue-700 border-sky-200 font-bold'
                    }`}>
                      {node.role}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed font-sans">{node.details}</p>
                  <p className={`text-[11px] font-mono mt-2 px-2 py-1 rounded inline-block border ${
                    isDarkMode ? 'bg-slate-900 text-slate-400 border-slate-800/50' : 'bg-sky-100/40 text-blue-900 border-sky-200/55'
                  }`}>
                    ที่อยู่เครือข่าย / พอร์ต: <span className="text-indigo-600 font-bold">{node.ipAndPort}</span>
                  </p>
                </div>
              </motion.div>
            );
          })()
        ) : (
          <div className="text-center py-2 text-slate-500 text-xs italic">
            เคล็ดลับ: คลิกลำดับขั้นตอนใดก็ได้ ด้านบนเพื่อดูรายละเอียดสตรีมและหน้าที่การส่งข้อมูล
          </div>
        )}
      </motion.div>
    </div>
  );
}
