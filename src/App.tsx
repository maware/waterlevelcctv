import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Zone, LogEntry, VideoQuality } from './types';
import CameraStream from './components/CameraStream';
import NetworkTopology from './components/NetworkTopology';
import DiagnosticConsole from './components/DiagnosticConsole';
import { 
   MessageSquare,
  Send,
  Video, 
  Settings, 
  Grid, 
  Maximize2, 
  Activity, 
  History, 
  Download, 
  X, 
  Database, 
  Trash2, 
  Volume2, 
  VolumeX,
  Tv, 
  Clock, 
  Eye, 
  Cpu, 
  Map,
  Save,
  ShieldCheck,
  Edit2,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Key,
  Sliders,
  Plus,
  Ruler,
  Table,
  Menu,
  RefreshCw,
  AlertTriangle,
  Camera as CameraIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
// Google Sheets removed — using local API instead
type SheetReading = {
  zoneName: string;
  camLabel: string;
  waterLevel: number;
  readStatus: string;
  hour: string;
  dateStr: string;
  recordedAt: string;
};


const INITIAL_ZONES: Zone[] = [
  {
    id: 'zone-1',
    name: 'บ้านน้ำขุ่น',
    cams: [
      { id: 'cam1', label: 'CAM 1', camPath: 'cam1', status: 'connecting', ipAddress: '192.168.1.10', location: 'บ้านน้ำขุ่น — หน้าทางเข้าบ้าน' },
      { id: 'cam2', label: 'CAM 2', camPath: 'cam2', status: 'connecting', ipAddress: '192.168.1.11', location: 'บ้านน้ำขุ่น — ถนนทางโค้งมะพร้าว' },
    ]
  },
  {
    id: 'zone-5',
    name: 'วัดทุ่งตาอิน',
    cams: [
      { id: 'cam9', label: 'CAM 9', camPath: 'cam9', status: 'connecting', ipAddress: '100.94.93.119', location: 'วัดทุ่งตาอิน' },
      { id: 'cam10', label: 'CAM 10', camPath: 'cam10', status: 'connecting', ipAddress: '100.94.93.119', location: 'วัดทุ่งตาอิน' },
    ]
  },
  {
    id: 'zone-2',
    name: 'วัดกะทิง',
    cams: [
      { id: 'cam3', label: 'CAM 3', camPath: 'cam3', status: 'connecting', ipAddress: '192.168.1.12', location: 'วัดกะทิง — บริเวณรอบเจดีย์หลวง' },
      { id: 'cam4', label: 'CAM 4', camPath: 'cam4', status: 'connecting', ipAddress: '192.168.1.13', location: 'วัดกะทิง — มุมลานเอนกประสงค์' },
    ]
  },
  {
    id: 'zone-3',
    name: 'วัดปึก',
    cams: [
      { id: 'cam5', label: 'CAM 5', camPath: 'cam5', status: 'connecting', ipAddress: '192.168.1.14', location: 'วัดปึก — ประตูโขงทางเข้าวัด' },
      { id: 'cam6', label: 'CAM 6', camPath: 'cam6', status: 'connecting', ipAddress: '192.168.1.15', location: 'วัดปึก — ศาลาการเปรียญและพุทธสถาน' }
    ]
  },
  {
    id: 'zone-4',
    name: 'บ้านแตงเม',
    cams: [
      { id: 'cam7', label: 'CAM 7', camPath: 'cam7', status: 'connecting', ipAddress: '192.168.1.16', location: 'บ้านแตงเม — แนวรั้วเกษตรผสมผสาน' },
      { id: 'cam8', label: 'CAM 8', camPath: 'cam8', status: 'connecting', ipAddress: '192.168.1.17', location: 'บ้านแตงเม — หน้าลานเก็บวัสดุ' }
    ]
  }
];

const INITIAL_AI_LOGS = [
  { id: 'l1', camId: 'cam2', camLabel: 'CAM 2', zoneName: 'บ้านน้ำขุ่น', waterLevel: 0.85, confidence: 0.94, readStatus: 'ระดับปกติ', explanation: 'ระดับน้ำอยู่ในเกณฑ์ปกติ สังเกตจากเสาวัดส่วนล่างสุดขีดวัด 0.85 เมตร สภาวะคลองระบายได้ดี', timestamp: '10 มิ.ย. 14:00' },
  { id: 'l2', camId: 'cam4', camLabel: 'CAM 4', zoneName: 'วัดกะทิง', waterLevel: 1.15, confidence: 0.92, readStatus: 'เฝ้าระวัง', explanation: 'ระดับน้ำอยู่ในเกณฑ์เฝ้าระวังบอร์ดล่างสุดที่ระดับ 1.15 เมตร เริ่มมีปริมาณน้ำหลากสะสมในพื้นที่', timestamp: '10 มิ.ย. 15:00' },
  { id: 'l3', camId: 'cam6', camLabel: 'CAM 6', zoneName: 'วัดปึก', waterLevel: 1.25, confidence: 0.98, readStatus: 'เฝ้าระวัง', explanation: 'สังเกตระดับน้ำพาดผ่านเสาวัดที่ขีด 1.25 เมตร ความมั่นใจสูง อยู่ในแถบเตือนสีส้มกลาง', timestamp: '10 มิ.ย. 16:00' },
  { id: 'l4', camId: 'cam8', camLabel: 'CAM 8', zoneName: 'บ้านแตงเม', waterLevel: 1.70, confidence: 0.91, readStatus: 'วิกฤต', explanation: 'ระดับน้ำหลากท่วมขอบปูนแตะเสาวัดด้านล่างส่วนวิกฤตทางกายภาพแดงเข้ม 1.70 เมตร เฝ้าระวังอย่างใกล้ชิด', timestamp: '10 มิ.ย. 17:00' }
];

interface HourlyTelemetryTableProps {
  zone: Zone;
  aiLogs: any[];
  isDarkMode: boolean;
  getLevelStatusTextAndColor: (val: number) => { text: string; badgeBg: string };
  hourlyReadings: { [key: string]: { level: number; status: string; timestamp: string; isSynced?: boolean } };
  sheetReadings?: SheetReading[];
  isReadingSheet?: boolean;
  onFetchSheet?: () => void;
  selectedDate?: Date;
}

// Shared highly robust zone and date matching helpers
const isReadingMatchesZone = (reading: any, zoneInput: any): boolean => {
  if (!reading || !zoneInput) return false;
  
  let zoneName = '';
  let zoneId = '';
  let cams: any[] = [];
  
  if (typeof zoneInput === 'string') {
    zoneName = zoneInput;
  } else if (zoneInput && typeof zoneInput === 'object') {
    zoneName = zoneInput.name || '';
    zoneId = zoneInput.id || '';
    cams = zoneInput.cams || [];
  }
  
  const cleanZoneName = zoneName.replace(/\s+/g, '').toLowerCase();
  const cleanZoneId = zoneId.replace(/\s+/g, '').toLowerCase();
  
  const cleanSheetZone = (reading.zoneName || '').replace(/\s+/g, '').toLowerCase();
  const cleanSheetCam = (reading.camLabel || '').replace(/\s+/g, '').toLowerCase();
  
  // 1. Match zone name
  if (cleanZoneName && (cleanSheetZone.includes(cleanZoneName) || cleanZoneName.includes(cleanSheetZone))) {
    return true;
  }
  
  // 2. Match zone ID if available
  if (cleanZoneId && (cleanSheetZone.includes(cleanZoneId) || cleanZoneId.includes(cleanSheetZone))) {
    return true;
  }
  
  // 3. Match any camera labels
  if (cams && cams.length > 0) {
    return cams.some(cam => {
      const cleanCamLabel = (cam.label || '').replace(/\s+/g, '').toLowerCase();
      const cleanCamId = (cam.id || '').replace(/\s+/g, '').toLowerCase();
      
      return (cleanSheetCam && (cleanSheetCam.includes(cleanCamLabel) || cleanCamLabel.includes(cleanSheetCam))) ||
             (cleanSheetZone && cleanSheetZone.includes(cleanCamId)) ||
             (cleanSheetZone && cleanSheetZone.includes(cleanCamLabel));
    });
  }
  
  return false;
};

const parseDateString = (str: string): { day: number, month: number, year: number } | null => {
  if (!str) return null;
  const clean = str.trim().toLowerCase();

  const thaiMonths = [
    ['มกรา', 'ม.ค.', 'jan'],
    ['กุมภา', 'ก.พ.', 'feb'],
    ['มีนา', 'มี.ค.', 'mar'],
    ['เมษา', 'เม.ย.', 'apr'],
    ['พฤษภา', 'พ.ค.', 'may'],
    ['มิถุนา', 'มิ.ย.', 'jun'],
    ['กรกฎา', 'ก.ค.', 'jul'],
    ['สิงหา', 'ส.ค.', 'aug'],
    ['กันยา', 'ก.ย.', 'sep'],
    ['ตุลา', 'ต.ค.', 'oct'],
    ['พฤศจิกา', 'พ.ย.', 'nov'],
    ['ธันวา', 'ธ.ค.', 'dec']
  ];

  let month = -1;
  for (let m = 0; m < 12; m++) {
    const list = thaiMonths[m];
    const matches = list.some(item => {
      const cleanItem = item.replace(/\./g, '').toLowerCase();
      const cleanNoDot = clean.replace(/\./g, '');
      return cleanNoDot.includes(cleanItem);
    });
    if (matches) {
      month = m + 1;
      break;
    }
  }

  // 1. Check ISO pattern: YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    let year = parseInt(isoMatch[1], 10);
    let mNum = parseInt(isoMatch[2], 10);
    let day = parseInt(isoMatch[3], 10);
    if (year > 2400) year -= 543;
    return { day, month: mNum, year };
  }

  // Extract the main date portion to avoid parsing colons/time digits (e.g. "12:00:00")
  let datePart = clean.replace(/,/g, '');
  if (clean.includes(':')) {
    const parts = clean.split(/[\s,]+/);
    const found = parts.find(p => p.includes('/') || p.includes('-') || p.match(/^\d+$/));
    if (found) {
      datePart = found;
    }
  }

  // 2. Check Slashed/Hyphened date digits: DD/MM/YYYY or YYYY/MM/DD
  const slashParts = datePart.split(/[\/\-]+/);
  if (slashParts.length >= 3) {
    const p0 = parseInt(slashParts[0], 10);
    const p1 = parseInt(slashParts[1], 10);
    const p2 = parseInt(slashParts[2], 10);

    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      let day = -1;
      let mNum = -1;
      let year = -1;

      if (p0 >= 2000) {
        year = p0;
        mNum = p1;
        day = p2;
      } else if (p2 >= 2000) {
        year = p2;
        day = p0;
        mNum = p1;
      } else if (p2 > 0) {
        // e.g. short year 11/06/26 or 11/06/69
        if (p2 === 26 || p2 === 2026 || p2 === 2526) {
          year = 2026;
        } else if (p2 === 69 || p2 === 2569 || p2 === 2069) {
          year = 2026;
        } else {
          year = p2 < 50 ? 2000 + p2 : 1900 + p2;
        }
        day = p0;
        mNum = p1;
      }

      if (year > 2400) year -= 543;
      const finalMonth = month !== -1 ? month : mNum;

      if (day >= 1 && day <= 31 && finalMonth >= 1 && finalMonth <= 12 && year !== -1) {
        return { day, month: finalMonth, year };
      }
    }
  }

  // 3. Fallback for textual dates, e.g. "11 มิถุนายน 2569" or "11 มิ.ย. 69"
  if (month !== -1) {
    const numbers = datePart.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
      const ints = numbers.map(x => parseInt(x, 10));
      let day = -1;
      let year = -1;

      const possibleYear = ints.find(x => x > 31 || x === 26 || x === 69 || x === 2569 || x === 2026);
      const possibleDay = ints.find(x => x >= 1 && x <= 31 && x !== possibleYear);

      if (possibleYear) {
        if (possibleYear === 26 || possibleYear === 2026 || possibleYear === 2526) {
          year = 2026;
        } else if (possibleYear === 69 || possibleYear === 2569 || possibleYear === 2069) {
          year = 2026;
        } else {
          year = possibleYear > 100 ? possibleYear : (possibleYear < 50 ? 2000 + possibleYear : 1900 + possibleYear);
        }
      } else {
        year = ints[1];
      }

      if (possibleDay) {
        day = possibleDay;
      } else {
        day = ints[0];
      }

      if (year > 2400) year -= 543;

      if (day >= 1 && day <= 31 && year !== -1) {
        return { day, month, year };
      }
    }
  }

  return null;
};

const isReadingMatchesDate = (reading: any, targetDate: Date): boolean => {
  if (!reading || !targetDate) return false;

  const rDateRaw = (reading.dateStr || '').trim();
  const rRecRaw = (reading.recordedAt || '').trim();

  if (!rDateRaw && !rRecRaw) return false;

  const targetDay = targetDate.getDate();
  const targetMonth = targetDate.getMonth() + 1;
  const targetYear = targetDate.getFullYear();

  const checkSingleValue = (str: string): boolean => {
    if (!str) return false;

    // Direct parser verification
    const parsed = parseDateString(str);
    if (parsed) {
      return parsed.day === targetDay && parsed.month === targetMonth && parsed.year === targetYear;
    }

    // fallback ISO direct match
    const clean = str.toLowerCase().replace(/\s+/g, '').replace(/,/g, '');
    const localIso = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
    const localIsoTh = `${targetYear + 543}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
    if (clean.includes(localIso) || clean.includes(localIsoTh)) {
      return true;
    }

    return false;
  };

  if (rDateRaw && checkSingleValue(rDateRaw)) {
    return true;
  }
  if (rRecRaw && checkSingleValue(rRecRaw)) {
    return true;
  }

  return false;
};

const getHourNumber = (hourStr: string): number => {
  if (!hourStr) return -1;
  const clean = hourStr.trim();
  // Check if standard split by colon (e.g. "10:00")
  if (clean.includes(':')) {
    const parts = clean.split(':');
    const parsed = parseInt(parts[0], 10);
    return isNaN(parsed) ? -1 : parsed;
  }
  // Check if split by dot (e.g. "10.00" or "10.30")
  if (clean.includes('.')) {
    const parts = clean.split('.');
    const parsed = parseInt(parts[0], 10);
    return isNaN(parsed) ? -1 : parsed;
  }
  // Extract first number sequence
  const match = clean.match(/\d+/);
  if (match) {
    const parsed = parseInt(match[0], 10);
    return isNaN(parsed) ? -1 : parsed;
  }
  return -1;
};

function HourlyTelemetryTable({ 
  zone, 
  aiLogs, 
  isDarkMode, 
  getLevelStatusTextAndColor, 
  hourlyReadings,
  sheetReadings = [],
  isReadingSheet = false,
  onFetchSheet,
  selectedDate
}: HourlyTelemetryTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentHrRef = useRef<HTMLTableRowElement>(null);

  const isSameDate = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && 
    d1.getMonth() === d2.getMonth() && 
    d1.getDate() === d2.getDate();

  const targetDate = selectedDate || new Date();
  const isSelectedDateToday = isSameDate(targetDate, new Date());
  const currentHr = isSelectedDateToday ? new Date().getHours() : -1;

  useEffect(() => {
    // Wait a brief tick for render then scroll the current hour row to the top
    const timer = setTimeout(() => {
      if (currentHrRef.current && containerRef.current) {
        const container = containerRef.current;
        const row = currentHrRef.current;
        container.scrollTop = Math.max(0, row.offsetTop - 110);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [zone.id]);

  // Find latest water level record in aiLogs
  const secondCam = zone.cams[1] || zone.cams[0];
  const latestLog = aiLogs.find((log: any) => log.camId === secondCam?.id);

  // Even-numbered camera logic: Always anchor on the lowest readings (0.85, 1.15, 1.25, 1.70)
  const getSimDefaultLevel = (camId: string) => {
    if (camId === 'cam2') return 0.85;
    if (camId === 'cam4') return 1.15;
    if (camId === 'cam6') return 1.25;
    if (camId === 'cam8') return 1.70;
    return 1.10;
  };

  const currentVal = latestLog ? latestLog.waterLevel : (
    secondCam ? getSimDefaultLevel(secondCam.id) : 1.10
  );

  // 1. Matched Sheet Readings for Target Date
  const matchedSheetReadingsTarget = (sheetReadings || []).filter(sr => 
    isReadingMatchesZone(sr, zone) && isReadingMatchesDate(sr, targetDate)
  );

  // 2. Matched Sheet Readings for ALL time (Past-to-Present)
  const zoneAllSheetReadings = (sheetReadings || [])
    .filter(sr => isReadingMatchesZone(sr, zone))
    .sort((a, b) => {
      // Sort descending (latest first)
      const parseDateTime = (str: string, hourStr: string) => {
        try {
          if (!str) return 0;
          return new Date(str).getTime() + (getHourNumber(hourStr) * 3600000);
        } catch {
          return 0;
        }
      };
      return parseDateTime(b.recordedAt || b.dateStr, b.hour) - parseDateTime(a.recordedAt || a.dateStr, a.hour);
    });

  // Precalculate levels for all hours 0 to 24
  const hourlyLevels: Record<number, number | null> = {};
  for (let h = 0; h <= 24; h++) {
    const sheetTodayHourMatch = matchedSheetReadingsTarget.find(sr => getHourNumber(sr.hour) === h);
    let level: number | null = null;
    const hourKey = `${zone.id}_${h}`;
    const savedReading = hourlyReadings ? hourlyReadings[hourKey] : undefined;

    if (sheetTodayHourMatch) {
      level = sheetTodayHourMatch.waterLevel;
    } else if (savedReading && savedReading.isSynced && (isSelectedDateToday ? h <= currentHr : true)) {
      level = savedReading.level != null ? savedReading.level : 0;
    }
    hourlyLevels[h] = level;
  }

  // Find previous day's 23 reading if possible to compare with current target date's 0 hour
  const prevDay = new Date(targetDate);
  prevDay.setDate(targetDate.getDate() - 1);
  const matchedPrevDay23 = (sheetReadings || []).find(sr => 
    isReadingMatchesZone(sr, zone) && 
    isReadingMatchesDate(sr, prevDay) && 
    getHourNumber(sr.hour) === 23
  );
  const yesterday23Level = matchedPrevDay23 ? matchedPrevDay23.waterLevel : null;

  const rows = [];
  for (let h = 0; h <= 24; h++) {
    const isCurrent = h === currentHr;
    const isFuture = h > currentHr;
    const level = hourlyLevels[h];
    const prevLvl = h === 0 ? yesterday23Level : hourlyLevels[h - 1];
    
    let diff = null;
    if (level !== null && prevLvl !== null) {
      diff = level - prevLvl;
    }
    
    const diffText = diff === null 
      ? '—' 
      : diff > 0 
        ? `+${diff.toFixed(2)}` 
        : diff === 0 
          ? '0.00' 
          : `${diff.toFixed(2)}`;
          
    const diffColorClass = diff === null 
      ? 'text-slate-400' 
      : diff > 0 
        ? 'text-rose-500 font-extrabold' 
        : diff === 0 
          ? 'text-slate-400 dark:text-slate-500' 
          : 'text-emerald-500 font-extrabold';

    rows.push(
      <tr 
        key={h}
        ref={isCurrent ? currentHrRef : null}
        className={`border-b border-dashed border-slate-100 dark:border-slate-900 transition-all font-medium hover:font-bold ${
          isCurrent 
            ? (isDarkMode ? 'bg-rose-950/20 text-rose-450 font-extrabold' : 'bg-rose-100/70 text-rose-900 font-extrabold')
            : (isDarkMode ? 'hover:bg-slate-900/45 text-slate-300' : 'hover:bg-sky-50/50 text-slate-650')
        }`}
        style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '28.5px', lineHeight: '1.2' }}
      >
        <td className="px-3 py-1 text-center" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '28.5px' }}>
          {isCurrent ? (
            <strong className="font-extrabold text-rose-600 dark:text-rose-400" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '45px' }}>{h.toString().padStart(2, '0')}:00</strong>
          ) : (
            <span className="font-bold" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '45px', fontWeight: 'bold' }}>{h.toString().padStart(2, '0')}:00</span>
          )}
        </td>
        <td className="px-3 py-1 text-center" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '28.5px' }}>
          {isCurrent ? (
            <strong className="font-extrabold text-rose-600 dark:text-rose-400" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '45px' }}>
              {level != null ? `${level.toFixed(2)}` : '—'}
            </strong>
          ) : (
            <span className="inline-flex items-center justify-center font-bold" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '45px' }}>
              {level != null ? `${level.toFixed(2)}` : '—'}
            </span>
          )}
        </td>
        <td className={`px-3 py-1 text-center font-bold ${diffColorClass}`} style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '28.5px' }} title={prevLvl !== null ? `เปรียบเทียบกับชั่วโมงก่อนหน้า (ก่อนหน้า: ${prevLvl.toFixed(2)} ม.)` : 'ไม่มีข้อมูลชั่วโมงก่อนหน้า'}>
          <span style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '45px' }}>{diffText}</span>
        </td>
      </tr>
    );
  }

  return (
    <div className="flex flex-col" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '28.5px', lineHeight: '1.2' }}>
      <div 
         ref={containerRef}
        className="divide-y divide-slate-100 dark:divide-slate-900 relative"
        style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '28.5px' }}
      >
        <table className="w-full text-left border-collapse" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '28.5px' }}>
          <thead>
            <tr className={`sticky top-0 font-black uppercase tracking-wider z-10 ${
              isDarkMode ? 'bg-slate-900 text-slate-400 border-b border-slate-800' : 'bg-sky-100/95 text-blue-900 border-b border-sky-101'
            }`} style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '45px' }}>
              <th className="px-3 py-2.5 text-center" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '45px' }}>เวลา</th>
              <th className="px-3 py-2.5 text-center leading-tight" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '45px' }}>ระดับน้ำ<br />(เมตร)</th>
              <th className="px-3 py-2.5 text-center leading-tight" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '45px' }}>เพิ่ม<br />ลด</th>
            </tr>
          </thead>
          <tbody className="font-medium" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '28.5px' }}>
            {rows}
          </tbody>
        </table>
      </div>

      {/* Legend below the table explaining increase / decrease trends */}
      <div className={`p-4 border-t flex flex-wrap items-center justify-around gap-6 font-extrabold select-none ${
        isDarkMode ? 'bg-slate-950/50 border-slate-900 text-slate-300' : 'bg-sky-50/50 border-sky-101 text-blue-955'
      }`} style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '28.5px', lineHeight: '33.2px' }}>
        <div className="flex items-center gap-2" title="ระดับน้ำเพิ่มขึ้นเมื่อเทียบกับชั่วโมงก่อนหน้า" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '28.5px' }}>
          <span className="w-5 h-5 rounded-full bg-rose-500 shrink-0" />
          <span style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '42.5px', width: '274.538px' }}>ระดับน้ำเพิ่มขึ้น <span className="text-rose-500 font-extrabold" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '42.5px' }}>(สีแดง)</span></span>
        </div>
        
        <div className="flex items-center gap-2" title="ระดับน้ำลดลงเมื่อเทียบกับชั่วโมงก่อนหน้า" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '28.5px' }}>
          <span className="w-5 h-5 rounded-full bg-emerald-500 shrink-0" />
          <span style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '42.5px' }}>ระดับน้ำลดลง <span className="text-emerald-500 font-extrabold" style={{ fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", fontSize: '42.5px' }}>(สีเขียว)</span></span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // State variables
  const [zones, setZones] = useState<Zone[]>(() => {
    // ใช้ INITIAL_ZONES เป็น default (API จะ override ใน useEffect)
    const stored = localStorage.getItem('watpuek_zones');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored zones', e);
      }
    }
    return INITIAL_ZONES;
  });
  const [gatewayUrl, setGatewayUrl] = useState<string>(() => {
    return localStorage.getItem('watpuek_gateway') || 'https://webrtc.watpuekwater.org';
  });
  const [selectedQuality, setSelectedQuality] = useState<VideoQuality>('480p');
  
  // Suffix parameters corresponding to different MediaMTX transcodings
  const [suffix480p, setSuffix480p] = useState<string>('_480p');
  const [suffix720p, setSuffix720p] = useState<string>('_480p');
  const [suffix1080p, setSuffix1080p] = useState<string>('_1080p');
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(() => {
    return localStorage.getItem('watpuek_apps_script_url') || '';
  });

  // Stored live hourly readings, fetched or saved locally/clouddy
  // key of dictionary: `${zoneId}_${hour}`
  const [hourlyReadings, setHourlyReadings] = useState<{
    [key: string]: { level: number; status: string; timestamp: string; isSynced?: boolean }
  }>(() => {
    try {
      const saved = localStorage.getItem('watpuek_hourly_readings');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [isAutoScanEnabled, setIsAutoScanEnabled] = useState<boolean>(() => {
    return localStorage.getItem('watpuek_auto_scan_enabled') !== 'false';
  });

  const [lastAutoScanHour, setLastAutoScanHour] = useState<number>(() => {
    const saved = localStorage.getItem('watpuek_last_auto_scan_hour');
    return saved ? parseInt(saved, 10) : -1;
  });

  // Google Sheets integration state variables
  const [cloudSyncState, setCloudSyncState] = useState<'loading' | 'online' | 'offline'>('online');

  // Google Sheets history readings state variables
  const [sheetReadings, setSheetReadings] = useState<SheetReading[]>(() => {
    try {
      const saved = localStorage.getItem('watpuek_history_sheet_readings');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isReadingSheet, setIsReadingSheet] = useState<boolean>(false);

  // Logs terminal state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // UI Panels toggles
  const [activeTab, setActiveTab ] = useState<'grid' | 'ai' | 'history' | 'admin'>('grid');
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('admin') === 'true' || window.location.pathname === '/admin';
  });
  const [isCam501Admin, setIsCam501Admin] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('cam501admin') === 'watpuek501secret';
  });
  const cam501ChatContainerRef = useRef<HTMLDivElement>(null);
  const [cam501OnlineCount, setCam501OnlineCount] = useState<number>(0);
  const [cam501ChatOpen, setCam501ChatOpen] = useState<boolean>(false);
  const [cam501ChatMessages, setCam501ChatMessages] = useState<{id: string, name: string, text: string, time: string, isMe: boolean}[]>([]);
  const [cam501ChatInput, setCam501ChatInput] = useState<string>('');
  const [cam501ChatName, setCam501ChatName] = useState<string>(() => localStorage.getItem('watpuek_chat_name') || '');
  const [cam501ChatNameInput, setCam501ChatNameInput] = useState<string>('');
  const [cam501ChatNameSet, setCam501ChatNameSet] = useState<boolean>(() => !!localStorage.getItem('watpuek_chat_name'));
  const cam501WsRef = useRef<WebSocket | null>(null);
  const cam501ChatEndRef = useRef<HTMLDivElement>(null);
  const cam501VideoRef = useRef<HTMLVideoElement>(null);
  const [cam501UseSnapshot, setCam501UseSnapshot] = useState<boolean>(false);
  const [cam501SnapshotUrl, setCam501SnapshotUrl] = useState<string>('');
  const [cam501Muted, setCam501Muted] = useState<boolean>(false);
  const [historySelectedZoneId, setHistorySelectedZoneId] = useState<string>('zone-1');
  const [historySelectedDayOffset, setHistorySelectedDayOffset] = useState<number>(0);
  const [historySelectedDate, setHistorySelectedDate] = useState<Date>(() => new Date());
  const [historyCalendarMonth, setHistoryCalendarMonth] = useState<Date>(() => new Date());
  const [historyHoveredHour, setHistoryHoveredHour] = useState<number | null>(null);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState<boolean>(false);
  const [isMobileToolbarOpen, setIsMobileToolbarOpen] = useState<boolean>(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('watpuek_admin_logged') === 'true';
  });
  const [adminPassword, setAdminPassword] = useState<string>(() => {
    return localStorage.getItem('watpuek_admin_password') || '12345678';
  });
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  
  // Password change states (inside Admin panel)
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [passwordStatusMessage, setPasswordStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Settings auto-save state
  const [lastLocalSaved, setLastLocalSaved] = useState<string>('');

  // Active theme (Always day mode 'light' on initial page load, customizable during session)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // AI Water Level States
  const [aiLogs, setAiLogs] = useState<any[]>(() => {
    const stored = localStorage.getItem('watpuek_ai_logs');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_AI_LOGS;
  });
  const [selectedAiCamId, setSelectedAiCamId] = useState<string>('cam6');
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [aiScannedImage, setAiScannedImage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [customFileBase64, setCustomFileBase64] = useState<string | null>(null);
  const [showTelemetry, setShowTelemetry] = useState<Record<string, boolean>>({});

  // High-precision interactive manual calibration states
  const [minGaugeScale, setMinGaugeScale] = useState<number>(3.50); // Lowest marker in meters
  const [maxGaugeScale, setMaxGaugeScale] = useState<number>(5.00); // Highest marker in meters
  const [manualLinePercent, setManualLinePercent] = useState<number>(50); // Height percentage from bottom (0 - 100)
  const [isManualMode, setIsManualMode] = useState<boolean>(false); // Mode toggle for manual calibration tool

  // Configurable auto fetch interval for today sheet hourly readings
  const [autoFetchInterval, setAutoFetchInterval] = useState<number>(30);

  // Reference for horizontal scrolling list
  const scrollRef = useRef<HTMLDivElement>(null);
  const historyScrollRef = useRef<HTMLDivElement>(null);

  // References and states for viewport-following scroll arrows (with vertical glide catch-up motion)
  const buyenLiveContainerRef = useRef<HTMLDivElement>(null);
  const buyenHistoryContainerRef = useRef<HTMLDivElement>(null);
  const [liveArrowsY, setLiveArrowsY] = useState<number>(180);
  const [historyArrowsY, setHistoryArrowsY] = useState<number>(180);

  const [activeZoneIndex, setActiveZoneIndex] = useState<number>(0);
  const [currentZoomedZone, setCurrentZoomedZone] = useState<number | null>(null);

  // โซนที่แสดงในหน้าเว็บ (กรองโซนที่ถูกซ่อนออก)
  const visibleZones = zones.filter(z => !z.hidden);
  
  // Real-time clock state
  const [currentTime, setCurrentTime] = useState<string>('');
  
  // Captured snapshot state
  const [snapshots, setSnapshots] = useState<{ id: string; timestamp: string; label: string; fileUrl: string }[]>([]);

  useEffect(() => {
    const handleScrollFollow = () => {
      // Calculate active floating top for Live Cameras arrow buttons
      if (buyenLiveContainerRef.current) {
        const rect = buyenLiveContainerRef.current.getBoundingClientRect();
        const containerHeight = rect.height;
        const viewportHeight = window.innerHeight;
        // Target is the middle of the screen relative to container top
        const targetY = (viewportHeight / 2) - rect.top;
        // Stay within container bounds safely with 40px margin
        const clampedY = Math.max(40, Math.min(containerHeight - 40, targetY));
        setLiveArrowsY(clampedY);
      }

      // Calculate active floating top for History Logs arrow buttons
      if (buyenHistoryContainerRef.current) {
        const rect = buyenHistoryContainerRef.current.getBoundingClientRect();
        const containerHeight = rect.height;
        const viewportHeight = window.innerHeight;
        const targetY = (viewportHeight / 2) - rect.top;
        const clampedY = Math.max(40, Math.min(containerHeight - 40, targetY));
        setHistoryArrowsY(clampedY);
      }
    };

    window.addEventListener('scroll', handleScrollFollow, { passive: true });
    window.addEventListener('resize', handleScrollFollow, { passive: true });
    
    // Initial call with timeout to ensure DOM styles/heights are paint-ready
    handleScrollFollow();
    const t = setTimeout(handleScrollFollow, 150);

    return () => {
      window.removeEventListener('scroll', handleScrollFollow);
      window.removeEventListener('resize', handleScrollFollow);
      clearTimeout(t);
    };
  }, [activeZoneIndex, zones, showTelemetry]);

  // Scroll to top when changing active tab
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

    const addLog = (type: LogEntry['type'], message: string, camId?: string) => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString('th-TH'),
      type,
      message,
      camId,
    };
    setLogs((prev) => [newLog, ...prev].slice(0, 500));
  };

  const handleSnapshotRecorded = (snapshotInfo: { timestamp: string; label: string; fileUrl: string; }) => {
    const newSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: snapshotInfo.timestamp,
      label: snapshotInfo.label,
      fileUrl: snapshotInfo.fileUrl
    };
    setSnapshots((prev) => [newSnapshot, ...prev].slice(0, 50));
    addLog('success', `บันทึกภาพหน้าจอกล้องสำเร็จ: [${snapshotInfo.label}]`);
  };

  const handleCameraStatusChange = useCallback((camId: string, status: 'offline' | 'connecting' | 'online' | 'error') => {
    setZones((prev) => {
      let overallChanged = false;
      const updated = prev.map((zone) => {
        let zoneChanged = false;
        const camsUpdated = zone.cams.map((cam) => {
          if (cam.id === camId && cam.status !== status) {
            zoneChanged = true;
            overallChanged = true;
            return { ...cam, status };
          }
          return cam;
        });
        return zoneChanged ? { ...zone, cams: camsUpdated } : zone;
      });
      return overallChanged ? updated : prev;
    });
  }, []);

  const downloadSnapshot = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `watpuek_snapshot_${filename}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog('info', `ดาวน์โหลดรูปภาพหน้าจอลงอุปกรณ์เครื่องคอมพิวเตอร์หลัก: [${filename}]`);
  };

  const mockImageForCam = (camId: string) => {
    const mockMap: Record<string, string> = {
      'cam2': 'https://lh3.googleusercontent.com/d/1D6EBHOiMkmaAcqYzSoycbBCuDeGiu9s7',
      'cam4': 'https://lh3.googleusercontent.com/d/1R8ox_4-UX7o7ClbRALeig0tnUR4bhX6V',
      'cam6': 'https://lh3.googleusercontent.com/d/1ufB4jlpSsZfh1_x7ZPLtHc6M6fc4lJ1a',
      'cam8': 'https://lh3.googleusercontent.com/d/18vH7SfoLj4cRErltfn3fxeD5N1Rl3DVQ'
    };
    return mockMap[camId];
  };

  const getLevelStatusTextAndColor = (val: number) => {
    const isHigh = val > 2.5;
    const criticalThreshold = isHigh ? 4.30 : 1.50;
    const warningThreshold = isHigh ? 4.10 : 1.00;

    if (val >= criticalThreshold) {
      return { 
        text: 'วิกฤต', 
        badgeBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 dark:bg-rose-500/20' 
      };
    } else if (val >= warningThreshold) {
      return { 
        text: 'เฝ้าระวัง', 
        badgeBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 dark:bg-amber-500/20' 
      };
    } else {
      return { 
        text: 'ระดับปกติ', 
        badgeBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/20' 
      };
    }
  };

  const registerHourlyReading = (zoneId: string, level: number, status: string) => {
    const now = new Date();
    const currentHour = now.getHours();
    const hourKey = `${zoneId}_${currentHour}`;
    
    const dateStr = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    
    const newReading = {
      level,
      status,
      timestamp: `${dateStr} ${timeStr}`,
      isSynced: false
    };

    setHourlyReadings(prev => {
      const updated = { ...prev, [hourKey]: newReading };
      localStorage.setItem('watpuek_hourly_readings', JSON.stringify(updated));
      return updated;
    });
  };

  const postMeasurementToAppsScript = async (
    zoneName: string,
    camLabel: string,
    waterLevel: number,
    readStatus: string,
    explanation: string,
    confidence: number,
    zoneId: string,
    hourNum: number
  ) => {
    const now = new Date();
    const thaiMonths = ["มก.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    const pad = (n: number) => String(n).padStart(2, '0');
    const payload = {
      zoneName,
      camLabel,
      waterLevel,
      readStatus,
      explanation,
      confidence,
      hour: `${pad(hourNum)}:00`,
      dateStr: `${now.getDate()} ${thaiMonths[now.getMonth()]}`,
      recordedAt: `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()+543} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    };
    try {
      const res = await fetch('/api/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        addLog('success', `บันทึกระดับน้ำ ${waterLevel}ม. (${readStatus}) ลงเซิร์ฟเวอร์สำเร็จ`);
        const hourKey = `${zoneId}_${hourNum}`;
        setHourlyReadings(prev => {
          if (prev[hourKey]) {
            const updated = { ...prev, [hourKey]: { ...prev[hourKey], isSynced: true } };
            localStorage.setItem('watpuek_hourly_readings', JSON.stringify(updated));
            return updated;
          }
          return prev;
        });
      }
    } catch (err: any) {
      addLog('warn', `บันทึกระดับน้ำล้มเหลว: ${err.message}`);
    }
  };

  const handleAiAnalyze = async (camId: string, testUrl?: string, customBase64?: string) => {
    setIsAiAnalyzing(true);
    setAiError(null);
    setAiAnalysisResult(null);
    setAiScannedImage(null);

    const camera = zones.flatMap(z => z.cams).find(c => c.id === camId);
    if (!camera) {
      setAiError("ไม่พบกล้องวงจรปิดที่เลือกในระบบ");
      setIsAiAnalyzing(false);
      return;
    }

    const zone = zones.find(z => z.cams.some(c => c.id === camId));
    const zoneName = zone ? zone.name : "ไม่ระบุโซน";

    let liveCapture: string | null = null;
    if (!testUrl && !customBase64 && typeof window !== 'undefined' && (window as any).__cameraCaptures && (window as any).__cameraCaptures[camId]) {
      try {
        liveCapture = (window as any).__cameraCaptures[camId]();
        if (liveCapture) {
          addLog('info', `[ดึงภาพจากกล้อง] ดึงภาพสดจากหน้ากล้องวงจรปิด [${camera.label}] เรียบร้อย กำลังวิเคราะห์...`);
        }
      } catch (err) {
        console.warn('Failed capturing live frame snapshot:', err);
      }
    }

    try {
      let body: any = {};
      let resolvedImageUrl = "";

      if (testUrl) {
        body.imageUrl = testUrl;
        resolvedImageUrl = testUrl;
        setAiScannedImage(testUrl);
      } else if (customBase64) {
        body.imageBase64 = customBase64;
        resolvedImageUrl = "uploaded";
        setAiScannedImage('data:image/jpeg;base64,' + customBase64.replace(/^data:image\/\w+;base64,/, ''));
      } else if (liveCapture) {
        body.imageBase64 = liveCapture;
        resolvedImageUrl = liveCapture;
        setAiScannedImage(liveCapture);
      } else {
        const urlToUse = mockImageForCam(camId);
        body.imageUrl = urlToUse || mockImageForCam('cam6');
        resolvedImageUrl = urlToUse || mockImageForCam('cam6');
        setAiScannedImage(resolvedImageUrl);
      }

      const response = await fetch("/api/ocr-water-level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      let data: any = {};
      const responseContentType = response.headers.get("Content-Type") || "";
      if (responseContentType.includes("application/json")) {
        data = await response.json();
      } else {
        const textError = await response.text();
        throw new Error(textError.substring(0, 120) || "ระบบขัดข้องและส่งเนื้อหาประเภทอื่นกลับมาแทนข้อความผลลัพธ์ JSON");
      }

      if (!response.ok) {
        throw new Error(data.message || "เกิดปัญหาขัดข้องทางเทคนิคบน API");
      }

      setAiAnalysisResult(data);
      addLog('success', `วิเคราะห์มาตรวัดน้ำกล้อง [${camera.label}] ด้วย AI สำเร็จ: อ่านได้ ${data.waterLevel} เมตร (${data.readStatus})`);

      const newLog = {
        id: 'log-' + Date.now(),
        camId: camera.id,
        camLabel: camera.label,
        zoneName: zoneName,
        waterLevel: data.waterLevel,
        confidence: data.confidence,
        readStatus: data.readStatus,
        explanation: data.explanation,
        imageUrl: liveCapture || testUrl || mockImageForCam(camera.id) || "uploaded",
        timestamp: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      };

      setAiLogs((prev: any) => {
        const u = [newLog, ...prev];
        localStorage.setItem('watpuek_ai_logs', JSON.stringify(u));
        return u;
      });

      if (zone) {
        registerHourlyReading(zone.id, data.waterLevel, data.readStatus);
        postMeasurementToAppsScript(
          zoneName,
          camera.label,
          data.waterLevel,
          data.readStatus,
          data.explanation,
          data.confidence,
          zone.id,
          new Date().getHours()
        );
      }

    } catch (err: any) {
      console.error(err);
      
      let simulatedResult: any = null;
      const image1_id = '1D6EBHOiMkmaAcqYzSoycbBCuDeGiu9s7';
      const image2_id = '1R8ox_4-UX7o7ClbRALeig0tnUR4bhX6V';
      const image3_id = '1ufB4jlpSsZfh1_x7ZPLtHc6M6fc4lJ1a';
      const image4_id = '18vH7SfoLj4cRErltfn3fxeD5N1Rl3DVQ';

      let matchedSample = 3;
      if (testUrl) {
        if (testUrl.includes(image1_id)) matchedSample = 1;
        else if (testUrl.includes(image2_id)) matchedSample = 2;
        else if (testUrl.includes(image3_id)) matchedSample = 3;
        else if (testUrl.includes(image4_id)) matchedSample = 4;
      } else {
        if (camId === 'cam2') matchedSample = 1;
        if (camId === 'cam4') matchedSample = 2;
        if (camId === 'cam6') matchedSample = 3;
        if (camId === 'cam8') matchedSample = 4;
      }

      if (matchedSample === 1) {
        simulatedResult = {
          waterLevel: 0.85,
          confidence: 0.96,
          gaugeFound: true,
          readStatus: "ระดับปกติ",
          explanation: "[สแกนจำลองภาพ 1] แผงปัญญาประดิษฐ์ตรวจระดับน้ำคลองพิกัด 0.85 เมตร ระดับน้ำปกติเหมาะสมและปลอดภัย ไหลเวียนไหลสะดวกไม่กีดขวาง",
          detectedMarkings: ["0.6", "0.7", "0.8", "0.9", "1.0"]
        };
      } else if (matchedSample === 2) {
        simulatedResult = {
          waterLevel: 1.15,
          confidence: 0.94,
          gaugeFound: true,
          readStatus: "เฝ้าระวัง",
          explanation: "[สแกนจำลองภาพ 2] ตรวจเช็กพบคราบคลื่นน้ำเพิ่มขวางขึ้นเกณฑ์เตือนภัยสีเหลืองส้มที่ 1.15 เมตร อยู่ในช่วงเฝ้าระวังควบคุมความรุนแรงปริมาณชลประทาน",
          detectedMarkings: ["0.9", "1.0", "1.1", "1.2", "1.3"]
        };
      } else if (matchedSample === 3) {
        simulatedResult = {
          waterLevel: 1.25,
          confidence: 0.98,
          gaugeFound: true,
          readStatus: "เฝ้าระวัง",
          explanation: "[สแกนจำลองภาพ 3] กล้องคู่ CAM 6 ในพื้นที่วัดปึก สังเกตแนวคราบน้ำและแสงสะท้อน แว่นขีดพาดแนวหลักชี้วัด 1.25 เมตร ระดับเพิ่มขึ้นจากสัปดาห์ก่อนหน้าเล็กน้อย",
          detectedMarkings: ["1.0", "1.1", "1.2", "1.3", "1.4"]
        };
      } else {
        simulatedResult = {
          waterLevel: 1.70,
          confidence: 0.91,
          gaugeFound: true,
          readStatus: "วิกฤต",
          explanation: "[สแกนจำลองภาพ 4] ปัญญาประดิษฐ์ตรวจวัดพบลำน้ำเอ่อนองแดงฉานท่วมเกิน 1.70 เมตร (เกณฑ์ขีดท่วมวิกฤตสีแดง) กระแสน้ำพัดหนุนแรงข้ามส่วนท่อและขอบปูนกั้นตลิ่ง",
          detectedMarkings: ["1.4", "1.5", "1.6", "1.7", "1.8"]
        };
      }

      setAiAnalysisResult(simulatedResult);
      addLog('warn', `วิเคราะห์แบบกระบวนจำลองออฟไลน์: กล้อง [${camera.label}] -> ผลอ่านได้ ${simulatedResult.waterLevel} เมตร (${simulatedResult.readStatus})`);

      const newSimLog = {
        id: 'log-' + Date.now(),
        camId: camera.id,
        camLabel: camera.label,
        zoneName: zoneName,
        waterLevel: simulatedResult.waterLevel,
        confidence: simulatedResult.confidence,
        readStatus: simulatedResult.readStatus,
        explanation: simulatedResult.explanation,
        imageUrl: liveCapture || testUrl || mockImageForCam(camera.id) || "uploaded",
        timestamp: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      };

      setAiLogs((prev: any) => {
        const u = [newSimLog, ...prev];
        localStorage.setItem('watpuek_ai_logs', JSON.stringify(u));
        return u;
      });

      if (zone) {
        registerHourlyReading(zone.id, simulatedResult.waterLevel, simulatedResult.readStatus);
        postMeasurementToAppsScript(
          zoneName,
          camera.label,
          simulatedResult.waterLevel,
          simulatedResult.readStatus,
          simulatedResult.explanation,
          simulatedResult.confidence,
          zone.id,
          new Date().getHours()
        );
      }

      setAiError("ยังไม่ได้ระบุคีย์ลับ Gemini API ใน Settings > Secrets หรือระบบเชื่อมต่อติดขัด: เปิดใช้โหมดตรวจจับท้องถิ่นจำลองให้ทดสอบตรวจบอร์ดภาพ 1 - 4 เสมือนจริง!");
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const handleAddCamera = () => {
    const activeZone = zones[activeZoneIndex];
    if (!activeZone) return;

    const camId = `cam-${Date.now()}`;
    const newCam: Camera = {
      id: camId,
      label: `กล้องใหม่`,
      camPath: `cam-new`,
      status: 'offline',
      ipAddress: '192.168.1.x',
      location: 'ระบุสถานที่...'
    };

    const updatedZones = [...zones];
    updatedZones[activeZoneIndex].cams = [...(updatedZones[activeZoneIndex].cams || []), newCam];
    setZones(updatedZones);
    localStorage.setItem('watpuek_zones', JSON.stringify(updatedZones));
    addLog('success', `เพิ่มกล้องใหม่ในโซน [${activeZone.name}]`);
    if (googleToken) autoSyncToGoogleSheet(updatedZones);
  };

  const handleDeleteCamera = (zIdx: number, cIdx: number) => {
    const zone = zones[zIdx];
    const cam = zone?.cams[cIdx];
    if (!cam) return;
    if (!window.confirm(`ลบกล้อง [${cam.label}] ออกจากโซน [${zone.name}]?`)) return;
    const updatedZones = [...zones];
    updatedZones[zIdx].cams = updatedZones[zIdx].cams.filter((_, i) => i !== cIdx);
    setZones(updatedZones);
    localStorage.setItem('watpuek_zones', JSON.stringify(updatedZones));
    addLog('success', `ลบกล้อง [${cam.label}] ออกจาก [${zone.name}] แล้ว`);
    if (googleToken) autoSyncToGoogleSheet(updatedZones);
  };
  
  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') === 'true') {
  } else {
    // ถ้าไม่ได้มาจาก /admin และกำลังอยู่หน้า admin ให้ redirect กลับ
    if (activeTab === 'admin') setActiveTab('grid');
  }
}, []);
  // Google Auth removed — using local API

  // WebSocket chat connection
  useEffect(() => {
  let ws: WebSocket;
  let reconnectTimer: ReturnType<typeof setTimeout>;

  const connect = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname === 'cam.watpuekwater.org'
      ? 'cam.watpuekwater.org'
      : window.location.host;
    const wsUrl = `${protocol}//${host}/ws/chat`;

    ws = new WebSocket(wsUrl);
    cam501WsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'history') {
          setCam501ChatMessages(data.messages.map((m: any) => ({
            ...m,
            isMe: m.name === localStorage.getItem('watpuek_chat_name')
          })));
        } else if (data.type === 'message') {
          setCam501ChatMessages(prev => [...prev, {
            ...data.message,
            isMe: data.message.name === localStorage.getItem('watpuek_chat_name')
          }]);
          setTimeout(() => {
            const container = cam501ChatContainerRef.current;
            if (container) container.scrollTop = container.scrollHeight;
          }, 50);
        } else if (data.type === 'online') {
          setCam501OnlineCount(data.count);
        }
      } catch {}
    };

    ws.onclose = () => {
      reconnectTimer = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  };

  connect();

  return () => {
    clearTimeout(reconnectTimer);
    ws?.close();
  };
}, []);



  // Prevent unauthorized access to the AI tab if not logged in as admin
  useEffect(() => {
    if (activeTab === 'admin' && !isAdminRoute) {
      setActiveTab('grid');
      addLog('warn', 'ถูกจำกัดสิทธิ์การเข้าใช้งาน: หน้าวิเคราะห์ระดับน้ำ AI อนุญาตเฉพาะผู้ดูแลระบบที่มีรหัสผ่านเท่านั้น');
    }
  }, [activeTab, isAdminLoggedIn, isAdminRoute]);



  // Auto-save zones + config to localStorage whenever they change (admin edits persist instantly)
  useEffect(() => {
    if (!isAdminLoggedIn) return;
    localStorage.setItem('watpuek_zones', JSON.stringify(zones));
    localStorage.setItem('watpuek_gateway', gatewayUrl);
    localStorage.setItem('watpuek_admin_password', adminPassword);
    localStorage.setItem('watpuek_apps_script_url', appsScriptUrl);
    const t = new Date().toLocaleTimeString('th-TH');
    setLastLocalSaved(t);
  }, [zones, gatewayUrl, adminPassword, appsScriptUrl, isAdminLoggedIn]);

  // โหลด config จาก local API
  useEffect(() => {
    const fetchLocalConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const cfg = await res.json();
          if (cfg.adminPassword) {
            setAdminPassword(cfg.adminPassword);
            localStorage.setItem('watpuek_admin_password', cfg.adminPassword);
          }
          if (cfg.gatewayUrl) {
            setGatewayUrl(cfg.gatewayUrl);
            localStorage.setItem('watpuek_gateway', cfg.gatewayUrl);
          }
          if (cfg.selectedQuality) setSelectedQuality(cfg.selectedQuality as VideoQuality);
          if (cfg.suffix480p) setSuffix480p(cfg.suffix480p);
          if (cfg.suffix720p) setSuffix720p(cfg.suffix720p);
          if (cfg.suffix1080p) setSuffix1080p(cfg.suffix1080p);
          // อัปเดตสถานะ hidden ของแต่ละโซนตาม hiddenZones ใน config
          if (Array.isArray(cfg.hiddenZones)) {
            setZones(prev => prev.map(z => ({
              ...z,
              hidden: cfg.hiddenZones.includes(z.id),
            })));
          }
          // โหลด zones จาก server ถ้ามี (admin บันทึกไว้)
          if (Array.isArray(cfg.zones) && cfg.zones.length > 0) {
            const serverZones = cfg.zones.map((z: Zone) => ({
              ...z,
              hidden: Array.isArray(cfg.hiddenZones) ? cfg.hiddenZones.includes(z.id) : false,
            }));
            setZones(serverZones);
            localStorage.setItem('watpuek_zones', JSON.stringify(serverZones));
          }
        }
        setCloudSyncState('online');
        addLog('success', 'โหลด config จากเซิร์ฟเวอร์สำเร็จ');
      } catch (err: any) {
        setCloudSyncState('offline');
        addLog('warn', 'โหลด config ไม่ได้ ใช้ค่าจาก localStorage แทน');
      }
    };
    fetchLocalConfig();
  }, []);

  // Loop-interval automatically triggered from client web app has been removed as requested (handled by Apps Script in the background)

  const autoSyncToGoogleSheet = async (_updatedZones: Zone[]) => {
    // Google Sheets removed — save config locally instead
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword, gatewayUrl, selectedQuality, suffix480p, suffix720p, suffix1080p })
      });
    } catch {}
  };

  const handleFetchFromGoogleSheet = async (_tokenToUse?: string) => {
    // โหลด config จาก local API
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const cfg = await res.json();
        if (cfg.adminPassword) setAdminPassword(cfg.adminPassword);
        if (cfg.gatewayUrl) setGatewayUrl(cfg.gatewayUrl);
        if (cfg.selectedQuality) setSelectedQuality(cfg.selectedQuality as VideoQuality);
        if (cfg.suffix480p) setSuffix480p(cfg.suffix480p);
        if (cfg.suffix720p) setSuffix720p(cfg.suffix720p);
        if (cfg.suffix1080p) setSuffix1080p(cfg.suffix1080p);
        addLog('success', 'โหลด config จากเซิร์ฟเวอร์สำเร็จ');
      }
    } catch (err: any) {
      addLog('warn', `โหลด config ไม่ได้: ${err.message}`);
    }
  };

  const handleFetchHistoryFromSheet = async (_tokenToUse?: string) => {
    setIsReadingSheet(true);
    addLog('info', 'กำลังดึงประวัติระดับน้ำจากเซิร์ฟเวอร์...');
    try {
      const res = await fetch('/api/readings?limit=1000');
      if (!res.ok) throw new Error('โหลดไม่ได้');
      const readings: SheetReading[] = await res.json();
      setSheetReadings(readings);
      localStorage.setItem('watpuek_history_sheet_readings', JSON.stringify(readings));
      addLog('success', `ดึงข้อมูลประวัติจำนวน ${readings.length} รายการสำเร็จ`);
    } catch (err: any) {
      addLog('warn', `ดึงประวัติไม่ได้: ${err.message}`);
    } finally {
      setIsReadingSheet(false);
    }
  };

  // โหลดประวัติตอนเริ่มและทุก 30 นาที
  useEffect(() => {
    handleFetchHistoryFromSheet();
    const intervalTimer = setInterval(() => {
      handleFetchHistoryFromSheet();
    }, 5 * 60 * 1000);
    return () => clearInterval(intervalTimer);
  }, []);

  const handleSaveToGoogleSheet = async (_tokenToUse?: string) => {
    // บันทึก config ลง local server แทน Google Sheets
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword, gatewayUrl, selectedQuality, suffix480p, suffix720p, suffix1080p })
      });
      if (res.ok) {
        localStorage.setItem('watpuek_zones', JSON.stringify(zones));
        localStorage.setItem('watpuek_gateway', gatewayUrl);
        localStorage.setItem('watpuek_admin_password', adminPassword);
        addLog('success', 'บันทึก config ลงเซิร์ฟเวอร์สำเร็จ');
        alert('บันทึกข้อมูลสำเร็จ!');
      }
    } catch (err: any) {
      addLog('error', `บันทึก config ล้มเหลว: ${err.message}`);
      alert(`บันทึกล้มเหลว: ${err.message}`);
    }
  };

  const handleGoogleLogin = async () => {
    // Google login removed
    addLog('info', 'ระบบใช้ local storage แล้ว ไม่ต้องล็อกอิน Google');
  };

  const handleGoogleLogout = async () => {
    // Google logout removed
  };

  const handleAddZone = () => {
    const zoneId = `zone-${Date.now()}`;
    const zoneName = `โซนใหม่ ${zones.length + 1}`;
    const newZone: Zone = {
      id: zoneId,
      name: zoneName,
      cams: []
    };

    const updatedZones = [...zones, newZone];
    setZones(updatedZones);
    localStorage.setItem('watpuek_zones', JSON.stringify(updatedZones));
    setActiveZoneIndex(updatedZones.length - 1);
    addLog('success', `เพิ่มกลุ่มโซนกล้องใหม่สำเร็จ: [${zoneName}] — แก้ไขชื่อได้ที่ช่องชื่อโซน`);

    if (googleToken) {
      autoSyncToGoogleSheet(updatedZones);
    }
  };

  const handleDeleteZone = (zIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const zoneToDelete = zones[zIdx];
    if (!zoneToDelete) return;
    
    const confirmed = window.confirm(`คุณแน่ใจว่าต้องการลบพื้นที่กลุ่มโซน [${zoneToDelete.name}] และกล้องทั้งหมดในกลุ่มนี้หรือไม่?`);
    if (!confirmed) return;
    
    const updatedZones = zones.filter((_, idx) => idx !== zIdx);
    setZones(updatedZones);
    localStorage.setItem('watpuek_zones', JSON.stringify(updatedZones));
    if (activeZoneIndex >= updatedZones.length) {
      setActiveZoneIndex(Math.max(0, updatedZones.length - 1));
    }
    addLog('success', `ลบพื้นที่กลุ่มโซนกล้องเรียบร้อย: [${zoneToDelete.name}]`);
    if (googleToken) {
      autoSyncToGoogleSheet(updatedZones);
    }
  };

  const clearSnapshots = () => {
    setSnapshots([]);
    addLog('info', 'ล้างแคชรูปภาพหน้าจอกล้องที่บันทึกไว้ในเบราว์เซอร์ทั้งหมด');
  };

  // Resolve proper URL path with suffix based on selected quality
  const generateWHEPUrl = (camPath: string, quality: VideoQuality) => {
    let suffix = '';
    if (quality === '480p') suffix = suffix480p;
    else if (quality === '720p') suffix = suffix480p; // 720p uses same suffix as 480p
    else if (quality === '1080p') suffix = suffix1080p;
    
    return `${gatewayUrl}/${camPath}${suffix}/index.m3u8`;
  };

  return (
    <div className={`min-h-screen font-sans antialiased selection:bg-blue-500 selection:text-white flex flex-col transition-colors duration-300 min-w-[1400px] ${
      isDarkMode 
        ? 'bg-slate-950 text-slate-100' 
        : 'bg-indigo-50/60 text-slate-800'
    }`}>
      
      {/* HEADER SECTION */}
      <header className={`border-b transition-colors duration-300 sticky top-0 z-50 px-6 py-4 flex flex-wrap items-center justify-between gap-4 ${
        isDarkMode 
          ? 'border-slate-900 bg-slate-900/40 backdrop-blur-md' 
          : 'border-sky-100 bg-white/90 shadow-sm backdrop-blur-md text-slate-800'
      }`}>
        
        {/* Logo & Headline */}
        <div 
          onClick={() => {
            setActiveTab('grid');
            addLog('info', 'กลับสู่หน้ากล้องสดวงจรปิด');
          }}
          className="flex items-center gap-3 cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all select-none"
          title="กลับหน้าดูกล้องสดวงจรปิด"
        >
          <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shadow-md bg-white">
            <img 
              src="https://lh3.googleusercontent.com/d/1LTEYFOZi9nL8TqVJshdbAPGRI8yMEo4r" 
              alt="Wat Puek Logo" 
              className="w-full h-full object-contain p-0.5" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 
                style={{ lineHeight: '30px', fontSize: '55px' }}
                className={`leading-tight font-extrabold tracking-tight transition-colors ${isDarkMode ? 'text-slate-100' : 'text-blue-950'}`}
              >
                วัดปึก &nbsp;แจ้งระดับน้ำ
              </h1>
            </div>
            <p 
              style={{ lineHeight: '20px', fontSize: '22px' }}
              className={`text-sm sm:text-[18px] font-mono leading-normal mt-1.5 transition-colors ${isDarkMode ? 'text-slate-400' : 'text-blue-700/85'}`}
            >
              cam.watpuekwater.org/
            </p>
          </div>
        </div>

        {/* Mobile Combined Toolbar Toggle Button */}
        <button
          type="button"
          onClick={() => setIsMobileToolbarOpen(!isMobileToolbarOpen)}
          className={`hidden p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ml-auto ${
            isMobileToolbarOpen
              ? (isDarkMode 
                  ? 'bg-cyan-400 text-slate-950 border-cyan-400 font-bold shadow-inner' 
                  : 'bg-blue-600 text-white border-blue-600 font-bold shadow-inner')
              : (isDarkMode 
                  ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800' 
                  : 'bg-white border-sky-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 shadow-sm')
          }`}
          title="แถบควบคุมและตั้งค่า"
        >
          <Sliders className="w-5 h-5" />
        </button>

        {/* Mobile Expanded 4-Icon Toolbar Row */}
        <AnimatePresence>
          {isMobileToolbarOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="hidden"
            >
              <div 
                style={isDarkMode ? {} : { backgroundColor: '#a6c0ff', borderWidth: '0px' }}
                className={`flex items-center justify-between gap-1.5 p-2 rounded-2xl shadow-inner ${
                  isDarkMode 
                    ? 'bg-slate-900/60 border border-slate-800' 
                    : 'border-0'
                }`}
              >
                {/* 1. Database Status */}
                <div 
                  title={
                    cloudSyncState === 'online' 
                      ? 'ดึงแนวโครงสายและอัปเดตข้อมูลกล้องทั้งหมดตาม Google Sheet สำเร็จแล้ว (ระบบออนไลน์)' 
                      : cloudSyncState === 'loading' 
                        ? 'กำลังเชื่อมต่อออนไลน์ดึงยอดความปลอดภัยจาก Google Sheet...' 
                        : 'ไม่ได้เชื่อมโยง Google Sheet (ใช้ค่าตั้งบอร์ดความจำบราวเซอร์ออฟไลน์)'
                  }
                  className={`p-2.5 rounded-xl border transition-all flex items-center justify-center flex-1 ${
                    cloudSyncState === 'online' 
                      ? (isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm')
                      : cloudSyncState === 'loading'
                        ? (isDarkMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse' : 'bg-amber-50/60 border-amber-200 text-amber-600 shadow-sm animate-pulse')
                        : (isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-rose-50 border-rose-100 text-rose-500 shadow-sm')
                  }`}
                >
                  <Database className="w-5 h-5" />
                </div>

                {/* 2. Theme switcher */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDarkMode(!isDarkMode);
                    addLog('info', `เปลี่ยนโทนสีหน้าจอเป็นโหมด${!isDarkMode ? 'กลางคืน (Night View)' : 'กลางวัน (Day View)'}`);
                  }}
                  className={`p-2.5 rounded-xl border transition-all duration-250 cursor-pointer flex items-center justify-center flex-1 ${
                    isDarkMode 
                      ? 'bg-cyan-400/10 border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/20' 
                      : 'bg-white border-sky-100 text-blue-700 hover:bg-blue-50 hover:border-blue-300 shadow-sm'
                  }`}
                  title={isDarkMode ? "เปลี่ยนเป็นโหมดกลางวัน" : "เปลี่ยนเป็นโหมดกลางคืน"}
                >
                  {isDarkMode ? <Sun className="w-5 h-5 text-amber-400 animate-pulse" /> : <Moon className="w-5 h-5 text-blue-700" />}
                </button>

                {/* 4. Menu selector */}
                <button
                  type="button"
                  onClick={() => {
                    setIsViewMenuOpen(!isViewMenuOpen);
                    if (!isViewMenuOpen) setIsSettingsOpen(false);
                  }}
                  className={`p-2.5 rounded-xl border transition-all duration-250 cursor-pointer flex items-center justify-center flex-1 ${
                    isViewMenuOpen
                      ? (isDarkMode 
                          ? 'bg-cyan-400 text-slate-950 border-cyan-400 font-bold shadow-inner' 
                          : 'bg-blue-600 text-white border-blue-600 font-bold shadow-inner')
                      : (isDarkMode 
                          ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800' 
                          : 'bg-white border-sky-200 text-blue-700 hover:bg-blue-50 hover:border-blue-350 shadow-sm')
                  }`}
                  title="สลับหน้าแสดงผล"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Hub Indicators */}
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">

          {/* Cloud Google Sheets Sync Status Indicator 
          <div 
            title={
              cloudSyncState === 'online' 
                ? 'ดึงแนวโครงสายและอัปเดตข้อมูลกล้องทั้งหมดตาม Google Sheet สำเร็จแล้ว (ระบบออนไลน์)' 
                : cloudSyncState === 'loading' 
                  ? 'กำลังเชื่อมต่อออนไลน์ดึงยอดความปลอดภัยจาก Google Sheet...' 
                  : 'ไม่ได้เชื่อมโยง Google Sheet (ใช้ค่าตั้งบอร์ดความจำบราวเซอร์ออฟไลน์)'
            }
            className={`p-1.5 sm:p-2.5 rounded-lg border transition-all flex items-center justify-center ${
              cloudSyncState === 'online' 
                ? (isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm')
                : cloudSyncState === 'loading'
                  ? (isDarkMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse' : 'bg-amber-50 border-emerald-200 text-emerald-600 shadow-sm')
                  : (isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-rose-50 border-rose-100 text-rose-500 shadow-sm')
            }`}
          >
            <Database className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>

          {/* Theme Dynamic Selection 
          <button
            type="button"
            onClick={() => {
              setIsDarkMode(!isDarkMode);
              addLog('info', `เปลี่ยนโทนสีหน้าจอเป็นโหมด${!isDarkMode ? 'กลางคืน (Night View)' : 'กลางวัน (Day View)'}`);
            }}
            className={`p-1.5 sm:p-2 rounded-lg border transition-all duration-250 cursor-pointer flex items-center justify-center ${
              isDarkMode 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' 
                : 'bg-white border-sky-100 text-blue-700 hover:bg-blue-50 hover:border-blue-300 shadow-sm'
            }`}
            title={isDarkMode ? "เปลี่ยนเป็นโหมดกลางวัน" : "เปลี่ยนเป็นโหมดกลางคืน"}
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-blue-700" />}
          </button>*/}


 
          {/* View Selection Menu Dropdown next to Settings gear icon */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsViewMenuOpen(!isViewMenuOpen);
                if (!isViewMenuOpen) setIsSettingsOpen(false);
              }}
             className={`p-6 rounded-xl border transition-all duration-250 cursor-pointer flex items-center justify-center ${
                isViewMenuOpen
                  ? 'bg-amber-500 text-slate-950 border-amber-450 font-bold shadow-inner'
                  : (isDarkMode 
                      ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800' 
                      : 'bg-white border-sky-200 text-blue-700 hover:bg-blue-50 hover:border-blue-350 shadow-sm')
              }`}
              title="สลับหน้าแสดงผล"
            >
              <Menu className="w-16 h-6" />
            </button>
            <AnimatePresence>
              {isViewMenuOpen && (
                <>
                  {/* Invisible screen backdrop to close dropdown on click outside */}
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsViewMenuOpen(false)} />
                  
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute right-[-12px] sm:right-0 mt-2 w-[600px] max-w-[calc(100vw-32px)] rounded-2xl border p-3 shadow-2xl z-50 transition-colors duration-300 ${
                      isDarkMode 
                        ? 'bg-slate-950 border-slate-800 text-slate-100 shadow-slate-950/80' 
                        : 'bg-white border-sky-100 text-slate-800 shadow-sky-900/10'
                    }`}
                  >
                    <div className="space-y-1 font-sans text-left font-extrabold text-[20px]">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('grid');
                          setIsViewMenuOpen(false);
                          addLog('info', 'สลับไปที่หน้าแผงรับชมกล้องวงจรปิดเรียลไทม์');
                        }}
                        className={`w-full py-2 px-3 rounded-xl transition flex items-center gap-3 cursor-pointer text-left whitespace-nowrap${
                          activeTab === 'grid'
                            ? (isDarkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-50 text-blue-700')
                            : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60' : 'text-slate-650 hover:text-blue-800 hover:bg-sky-50/50')
                        }`}
                      >
                        <Grid className="w-5 h-5 flex-shrink-0" />
                        <span className="text-[55px]">ดูไลฟ์สด (จาก...กล้องวงจรปิด)</span>
                      </button>
 
                      {isAdminLoggedIn && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('ai');
                            setIsViewMenuOpen(false);
                            addLog('info', 'สลับไปที่เมนูระบบปัญญาประดิษฐ์วิเคราะห์ระดับน้ำอัตโนมัติ');
                          }}
                          className={`w-full py-2 px-3 rounded-xl transition flex items-center gap-3 cursor-pointer text-left whitespace-nowrap${
                            activeTab === 'ai'
                              ? (isDarkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-50 text-blue-700')
                              : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60' : 'text-slate-650 hover:text-blue-800 hover:bg-sky-50/50')
                          }`}
                        >
                          <Cpu className="w-5 h-5 flex-shrink-0" />
                          <span className="text-[55px]">วิเคราะห์ระดับน้ำ AI</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('history');
                          setIsViewMenuOpen(false);
                          addLog('info', 'สลับไปที่หน้าสรุปประวัติระดับน้ำและการวิเคราะห์แนวโน้มรายวัน');
                        }}
                        className={`w-full py-2 px-3 rounded-xl transition flex items-center gap-3 cursor-pointer text-left whitespace-nowrap${
                          activeTab === 'history'
                            ? (isDarkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-50 text-blue-700')
                            : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60' : 'text-slate-650 hover:text-blue-800 hover:bg-sky-50/50')
                        }`}
                      >
                        <History className="w-5 h-5 flex-shrink-0" />
                        <span className="text-[55px]">ประวัติระดับน้ำ (จาก...กราฟ)</span>
                      </button>
 {isAdminLoggedIn && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('admin');
                          setIsViewMenuOpen(false);
                          addLog('info', 'สลับไปที่การจัดการผู้ดูแลระบบ');
                        }}
                        className={`w-full py-2 px-3 rounded-xl transition flex items-center gap-3 cursor-pointer text-left whitespace-nowrap${
                          activeTab === 'admin'
                            ? (isDarkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-50 text-blue-700')
                            : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60' : 'text-slate-650 hover:text-blue-800 hover:bg-sky-50/50')
                        }`}
                      >
                        <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                        <span className="text-[55px]">จัดการระดับ / ระบบ</span>
                        </button> 
                        )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile Expanded Sections Row (inline fold-down accordion) */}
        <AnimatePresence>
          {(isSettingsOpen || isViewMenuOpen) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className={`w-full sm:hidden overflow-hidden border-t border-dashed mt-2 pt-4 px-1 ${
                isDarkMode ? 'border-slate-800 text-slate-100' : 'border-sky-100 text-slate-800'
              }`}
            >
              {isSettingsOpen && (
                <div className="space-y-4 font-sans text-left pb-2">
                  <div className="flex items-center gap-2">
                    <Settings className={`w-4 h-4 ${isDarkMode ? 'text-amber-400' : 'text-blue-600'}`} />
                    <span className={`text-[15px] font-black tracking-wide ${isDarkMode ? 'text-slate-100' : 'text-blue-950'}`}>
                      คุณภาพวิดีโอ
                    </span>
                  </div>
                  
                  {/* Quality selector */}
                  <div className="space-y-2">
                    <div className={`grid grid-cols-3 p-1 rounded-xl border gap-1.5 font-bold ${
                      isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-sky-50/50 border-sky-100'
                    }`}>
                      {(['480p', '720p', '1080p'] as VideoQuality[]).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => {
                            setSelectedQuality(q);
                            addLog('info', `ปรับความละเอียดการดึงข้อมูลทราฟฟิกกล้องทั้งหมดเป็นระดับ [${q}]`);
                            setIsSettingsOpen(false);
                          }}
                          className={`py-2 rounded-lg transition cursor-pointer text-xs font-black text-center ${
                            selectedQuality === q 
                              ? (isDarkMode ? 'bg-cyan-400 text-slate-950 font-black' : 'bg-blue-600 text-white font-black shadow-sm') 
                              : (isDarkMode ? 'text-slate-400 hover:text-slate-100 bg-slate-900' : 'text-blue-800 hover:text-blue-955 bg-white shadow-xs')
                          }`}
                        >
                          {q.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <p className={`text-[11px] leading-relaxed font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      * การเชื่อมสตรีมมิ่งความละเอียดสูงจะใช้เน็ตเวิร์กมากขึ้น แนะนำ 480p/720p สำหรับการดูหลายจุดพร้อมกัน
                    </p>
                  </div>
                </div>
              )}

              {isViewMenuOpen && (
                <div className="space-y-3 font-sans text-left pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Menu className={`w-4 h-4 ${isDarkMode ? 'text-amber-400' : 'text-blue-600'}`} />
                    <span className={`text-[15px] font-black tracking-wide ${isDarkMode ? 'text-slate-100' : 'text-blue-950'}`}>
                      สลับหน้าแสดงผล
                    </span>
                  </div>
                  <div className="space-y-1.5 text-sm font-extrabold flex flex-col">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('grid');
                        setIsViewMenuOpen(false);
                        addLog('info', 'สลับไปที่หน้าแผงรับชมกล้องวงจรปิดเรียลไทม์');
                      }}
                      className={`w-full py-2.5 px-3 rounded-lg transition flex items-center gap-2.5 cursor-pointer text-left ${
                        activeTab === 'grid'
                          ? (isDarkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-50 text-blue-700')
                          : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60' : 'text-slate-650 hover:text-blue-800 hover:bg-sky-50/50')
                      }`}
                    >
                      <Grid className="w-4 h-4" />
                      <span>ดูไลฟ์สด จาก กล้องวงจรปิด</span>
                    </button>

                    {isAdminLoggedIn && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('ai');
                          setIsViewMenuOpen(false);
                          addLog('info', 'สลับไปที่เมนูระบบปัญญาประดิษฐ์วิเคราะห์ระดับน้ำอัตโนมัติ');
                        }}
                        className={`w-full py-2.5 px-3 rounded-lg transition flex items-center gap-2.5 cursor-pointer text-left ${
                          activeTab === 'ai'
                            ? (isDarkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-50 text-blue-700')
                            : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60' : 'text-slate-650 hover:text-blue-800 hover:bg-sky-50/50')
                        }`}
                      >
                        <Cpu className="w-4 h-4" />
                        <span>วิเคราะห์ระดับน้ำ AI</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('history');
                        setIsViewMenuOpen(false);
                        addLog('info', 'สลับไปที่หน้าสรุปประวัติระดับน้ำและการวิเคราะห์แนวโน้มรายวัน');
                      }}
                      className={`w-full py-2.5 px-3 rounded-lg transition flex items-center gap-2.5 cursor-pointer text-left ${
                        activeTab === 'history'
                          ? (isDarkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-50 text-blue-700')
                          : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60' : 'text-slate-650 hover:text-blue-800 hover:bg-sky-50/50')
                      }`}
                    >
                      <History className="w-4 h-4" />
                      <span>ประวัติระดับน้ำ จาก กราฟ</span>
                    </button>

                    {(isAdminLoggedIn || isAdminRoute) && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('admin');
                          setIsViewMenuOpen(false);
                          addLog('info', 'สลับไปที่การจัดการผู้ดูแลระบบ');
                        }}
                        className={`w-full py-2.5 px-3 rounded-lg transition flex items-center gap-2.5 cursor-pointer text-left ${
                          activeTab === 'admin'
                            ? (isDarkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-50 text-blue-700')
                            : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60' : 'text-slate-650 hover:text-blue-800 hover:bg-sky-50/50')
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>จัดการระดับ / ระบบ</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>
 {/* Banner แจ้งเตือนเหตุการณ์จำลอง */}
<div style={{ width: '100%', backgroundColor: '#f59e0b', textAlign: 'center', padding: '6px 16px' }}>
  <span style={{ fontSize: '55px', fontWeight: '900', color: '#1c1917', fontFamily: "'Angsana New', serif", whiteSpace: 'nowrap' }}>
    ⚠️ ภาพจากเหตุการณ์จำลองเท่านั้น &nbsp;ยังไม่ใช่เหตุการณ์จริง ⚠️
  </span>
</div>
      {/* MAIN LAYOUT WRAPPER */}
      <main className="flex-1 p-6 w-full mx-auto space-y-6">

        {/* Snapshots Sidebar tray (Show only if there's any image captured) */}
        <AnimatePresence>
          {snapshots.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`border rounded-xl p-4 shadow-lg transition-colors duration-300 ${
                isDarkMode 
                  ? 'bg-indigo-950/20 border-indigo-500/20 text-slate-200' 
                  : 'bg-white border-sky-100/70 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-3 bg-transparent rounded">
                <span className={`text-[13px] font-extrabold tracking-wider uppercase flex items-center gap-2 ${
                  isDarkMode ? 'text-indigo-400' : 'text-blue-800 font-extrabold'
                }`}>
                  <Eye className="w-4 h-4" /> ภาพสกรีนช็อตรูปจากกล้อง ({snapshots.length})
                </span>
                <button
                  onClick={clearSnapshots}
                  className="text-xs font-sans text-red-500 hover:text-red-700 flex items-center gap-1.5 transition cursor-pointer font-bold"
                >
                  <Trash2 className="w-4 h-4" /> ล้างแคชไฟล์ภาพทั้งหมด
                </button>
              </div>

              {/* Snapshots grid */}
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
                {snapshots.map((snap) => (
                  <div 
                    key={snap.id} 
                    className="relative shrink-0 w-44 rounded-lg overflow-hidden border border-slate-200/20 bg-slate-950 group"
                  >
                    <img 
                      src={snap.fileUrl} 
                      alt={snap.label} 
                      className="w-full aspect-video object-cover" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="p-2 bg-slate-900 text-[11px] font-mono leading-tight space-y-0.5">
                      <div className="font-bold text-slate-200 truncate">{snap.label}</div>
                      <div className="text-slate-400">{snap.timestamp}</div>
                    </div>

                    {/* Download option when hovering */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition duration-150 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadSnapshot(snap.fileUrl, snap.label)}
                        className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer"
                        title="ดาวน์โหลดไฟล์ภาพ"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>        {/* MIDDLE SECTION — RENDER BASED ON ACTIVE TAB */}
        <div className="relative">
          {activeTab === 'grid' && (
            <div className="space-y-6">
             {/* cam501 — กล้องกลางด้านบน */}
{/* wrapper: วิดีโอ + ปุ่ม + แชท อยู่ข้างๆ กัน วิดีโอไม่บีบ */}
<div className="w-full mx-auto flex justify-center">
<div className="flex items-stretch gap-3 transition-all duration-300">

  {/* [1] กล้อง + header — fixed 900px ไม่บีบเมื่อเปิดแชท */}
  <div className={`rounded-2xl overflow-hidden shadow-xl border flex-shrink-0 ${
    isDarkMode ? 'bg-slate-900/65 border-slate-800' : 'bg-white border-sky-100'
  }`} style={{ width: '1100px' }}>
    {/* Header */}
    <div className={`px-6 py-3 border-b flex items-center gap-3 ${
      isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-sky-50/50 border-sky-100'
    }`}>
      <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
      <h3 style={{ fontSize: '55px' }} className={`font-black leading-tight ${isDarkMode ? 'text-slate-100' : 'text-blue-950'}`}>
        วัดปึก = &nbsp;พระอธิการสุบิน &nbsp;ขนฺติธมฺโม&nbsp; ( เจ้าอาวาส วัดปึก )
      </h3>
    </div>
    {/* วิดีโอ 16:9 */}
    <div className="w-full aspect-video relative">
      <CameraStream
        camera={{ id: 'cam501', label: 'CAM 501', camPath: 'cam501', status: 'connecting', ipAddress: '192.168.1.111', location: 'จุดพิเศษ' }}
        url={`${gatewayUrl}/live/cam501/index.m3u8`}
        onLog={(log) => addLog(log.type, log.message, log.camId)}
        onSnapshotRecorded={handleSnapshotRecorded}
        onStatusChange={(status) => handleCameraStatusChange('cam501', status)}
      />
    </div>
  </div>

  {/* [2] ปุ่ม — fixed 140px สูงเท่ากล้อง */}
  <div className={`flex flex-col rounded-2xl overflow-hidden shadow-xl border flex-shrink-0 ${
    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
  }`} style={{ width: '140px' }}>
    <button
      onClick={() => {
        setCam501ChatOpen(prev => {
          if (!prev) {
            setTimeout(() => {
              const container = cam501ChatContainerRef.current;
              if (container) container.scrollTop = container.scrollHeight;
            }, 100);
          }
          return !prev;
        });
      }}
      className={`flex-1 w-full flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-95 ${
        cam501ChatOpen
          ? 'bg-blue-500 text-white'
          : (isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200')
      }`}
      style={{ borderBottom: isDarkMode ? '1px solid #475569' : '1px solid #cbd5e1' }}
      title={cam501ChatOpen ? 'ปิดแชท' : 'เปิดแชท'}
    >
      <MessageSquare className="w-10 h-10" />
    </button>
    <button
      onClick={() => {
        const video = document.getElementById('cam501-video') as HTMLVideoElement;
        if (video) { video.muted = !video.muted; setCam501Muted(video.muted); }
      }}
      title={cam501Muted ? 'กดเพื่อเปิดเสียง' : 'กดเพื่อปิดเสียง'}
      className={`flex-1 w-full flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-95 ${
        cam501Muted ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
      }`}
    >
      {cam501Muted ? <VolumeX className="w-10 h-10" /> : <Volume2 className="w-10 h-10" />}
    </button>
  </div>

  {/* [3] แชท — แสดงเมื่อกดปุ่ม flex-1 */}
  {cam501ChatOpen && (
    <div className={`flex flex-col rounded-2xl overflow-hidden shadow-xl border ${
      isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-sky-100'
    }`} style={{ width: '600px', minWidth: '600px' }}>
      {!cam501ChatNameSet ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-3">
          <p className={`text-[40px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>ใส่ชื่อของคุณก่อนเข้าแชท</p>
          <input type="text" value={cam501ChatNameInput} onChange={(e) => setCam501ChatNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && cam501ChatNameInput.trim()) { const name = cam501ChatNameInput.trim().slice(0, 20); setCam501ChatName(name); setCam501ChatNameSet(true); localStorage.setItem('watpuek_chat_name', name); }}}
            placeholder="ชื่อของคุณ..." maxLength={20}
            className={`w-full rounded-lg px-3 py-2 text-[40px] border outline-none ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-slate-50 border-sky-200 text-slate-800'}`}
          />
          <button onClick={() => { if (cam501ChatNameInput.trim()) { const name = cam501ChatNameInput.trim().slice(0, 20); setCam501ChatName(name); setCam501ChatNameSet(true); localStorage.setItem('watpuek_chat_name', name); }}}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-[40px] font-bold cursor-pointer hover:bg-blue-700 transition">เข้าแชท</button>
        </div>
      ) : (
        <>
          <div className={`px-3 py-2 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800' : 'border-sky-100'}`}>
            <span style={{ fontSize: '40px' }} className={`font-bold leading-tight ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              💬 แชทสด <br/>🟢ออนไลน์ {cam501OnlineCount}&nbsp;&nbsp;คนคุณคือ &nbsp;<span className="text-blue-500">{cam501ChatName}</span>
            </span>
            <button onClick={() => { setCam501ChatNameSet(false); setCam501ChatNameInput(''); localStorage.removeItem('watpuek_chat_name'); }}
              className={`text-[40px] cursor-pointer ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>ออกจากแชท</button>
          </div>
          <div ref={cam501ChatContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: '400px' }}>
            {cam501ChatMessages.length === 0 ? (
              <p className={`text-center text-xs py-8 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>ยังไม่มีข้อความ — เริ่มแชทได้เลย!</p>
            ) : (
              cam501ChatMessages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                  {!msg.isMe && <span className="text-[30px] text-slate-400 mb-0.5 px-1">{msg.name}</span>}
                  <div style={{ fontSize: '30px' }} className={`max-w-[85%] px-3 py-1.5 rounded-xl ${msg.isMe ? 'bg-blue-600 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-800')}`}>
                    <p>{msg.text}</p>
                    <p className="text-[22px] opacity-60 mt-0.5">{msg.time}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={cam501ChatEndRef} />
          </div>
          <div className={`p-3 border-t flex gap-2 ${isDarkMode ? 'border-slate-800' : 'border-sky-100'}`}>
            <input type="text" value={cam501ChatInput} onChange={(e) => setCam501ChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && cam501ChatInput.trim() && cam501WsRef.current?.readyState === WebSocket.OPEN) { cam501WsRef.current.send(JSON.stringify({ name: cam501ChatName, text: cam501ChatInput.trim() })); setCam501ChatInput(''); }}}
              placeholder="พิมพ์แล้วกด Enter..."
              className={`flex-1 rounded-lg px-3 py-2 text-[30px] border outline-none ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-slate-50 border-sky-200 text-slate-800'}`}
            />
            <button onClick={() => { if (cam501ChatInput.trim() && cam501WsRef.current?.readyState === WebSocket.OPEN) { cam501WsRef.current.send(JSON.stringify({ name: cam501ChatName, text: cam501ChatInput.trim() })); setCam501ChatInput(''); }}}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition"><Send className="w-4 h-4" /></button>
          </div>
        </>
      )}
    </div>
  )}
</div></div>
              {/* Horizontal Scroll Area with Arrows */}
              <div ref={buyenLiveContainerRef} className="relative flex items-center group/scroller">
                
                {/* Left Arrow Button */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.15, x: -4 }}
                  whileTap={{ scale: 0.9 }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1, top: liveArrowsY }}
                  transition={{ type: "spring", stiffness: 100, damping: 18 }}
                  onClick={() => {
                    if (scrollRef.current) {
                      scrollRef.current.scrollBy({ left: -340, behavior: 'smooth' });
                    }
                  }}
                  className={`absolute left-4 md:left-8 -translate-y-1/2 z-50 p-2.5 md:p-3.5 rounded-full border shadow-2xl cursor-pointer ${
                    isDarkMode 
                      ? 'bg-slate-900/90 border-slate-700/85 text-slate-100 hover:bg-slate-800' 
                      : 'bg-white/95 border-sky-200 text-blue-900 hover:bg-sky-50 hover:border-blue-350 shadow-xl'
                  }`}
                  style={{ touchAction: 'none' }}
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                </motion.button>

                {/* Horizontally Scrollable Element Container */}
                <div 
                  ref={scrollRef}
                  className="w-full flex overflow-x-auto justify-start lg:justify-center gap-6 pb-6 pt-2 no-scrollbar scroll-smooth snap-x select-none"
                >
                  {visibleZones.map((zone, zIdx) => (
                    <motion.div
                      key={zone.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: zIdx * 0.08 }}
                      style={{ paddingTop: '0px' }}
                      className={`min-w-[400px] flex-1 max-w-[480px] snap-center rounded-2xl overflow-hidden shadow-xl border flex flex-col justify-between transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-slate-900/65 border-slate-800/80 text-white' 
                          : 'bg-white border-sky-100 text-slate-800'
                      }`}
                    >
                      {/* Zone Title Header */}
                      <div
                        style={{ height: '66px' }}
                        className={`px-6 border-b flex justify-center items-center transition-colors ${
                          isDarkMode ? 'bg-slate-900/80 border-slate-800/90' : 'bg-sky-50/50 border-sky-100/60'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-3">
                          <span className={`w-3.5 h-3.5 rounded-full ${
                            zone.cams.some(cam => cam.status === 'online')
                              ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                              : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse'
                          }`}></span>
                          <h3
                            style={{ fontSize: '55px' }}
                            className={`font-black tracking-tight leading-tight ${isDarkMode ? 'text-slate-100' : 'text-blue-950'}`}
                          >
                            {zone.name}
                          </h3>
                        </div>
                      </div>

                      {/* Zone streams */}
                      <div className={`flex-1 flex flex-col gap-4 ${isDarkMode ? 'divide-y divide-slate-950' : 'divide-y divide-sky-50'}`}>
                        {zone.cams.map((cam) => {
                          const whepUrl = generateWHEPUrl(cam.camPath, selectedQuality);
                          return (
                            <div key={cam.id} className="relative aspect-video">
                              {cloudSyncState === 'loading' ? (
                                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center gap-1.5 p-4 select-none">
                                  <div className="w-5 h-5 border-2 border-slate-800 border-t-cyan-500 rounded-full animate-spin"></div>
                                  <div className="text-[10px] text-slate-500 font-mono tracking-wider">SYNCING CONFIG...</div>
                                </div>
                              ) : (
                                <CameraStream
                                  camera={cam}
                                  url={whepUrl}
                                  onLog={(log) => addLog(log.type, log.message, log.camId)}
                                  onSnapshotRecorded={handleSnapshotRecorded}
                                  onStatusChange={(status) => handleCameraStatusChange(cam.id, status)}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Zone Action: Focus on this zone */}
                      <div className={`p-4 border-t transition-colors ${
                        isDarkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-sky-50/20 border-sky-100'
                      }`}>
                        <button
                          type="button"
                          onClick={() => {
                            const realIndex = zones.findIndex(z => z.id === zone.id);
                            setActiveZoneIndex(realIndex !== -1 ? realIndex : zIdx);
                            setIsFocusModalOpen(true);
                            addLog('info', `เปิดวิดีโอเจาะจงจุดเดี่ยว (Focus View): จุดติดตั้ง [${zone.name}]`);
                          }}
                          className={`w-full py-4.5 text-[50px] sm:text-[50px] leading-none font-black border rounded-2xl flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98] ${
                            isDarkMode 
                              ? 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/50' 
                              : 'text-blue-800 bg-blue-600/10 hover:bg-blue-600/15 border-blue-600/50'
                          }`}
                        >
                          <ZoomIn className="w-7 h-7 sm:w-8 sm:h-8 stroke-[3]" />
                          <span>ขยาย จุด {zone.name}</span>
                        </button>

                        {/* Hourly Water Level Telemetry Table (Measured from 2nd Camera or latest log dynamically) */}
                        <div className="border-t border-dashed border-slate-200 dark:border-slate-800 text-left overflow-hidden pt-4 mt-4">
                          <div className={`border rounded-xl overflow-hidden ${
                            isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-sky-100/60'
                          }`}>
                            <HourlyTelemetryTable 
                              zone={zone}
                              aiLogs={aiLogs}
                              isDarkMode={isDarkMode}
                              getLevelStatusTextAndColor={getLevelStatusTextAndColor}
                              hourlyReadings={hourlyReadings}
                              sheetReadings={sheetReadings}
                              isReadingSheet={isReadingSheet}
                              onFetchSheet={() => handleFetchHistoryFromSheet()}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                 {/* Right Arrow Button */}
                 <motion.button
                   type="button"
                   whileHover={{ scale: 1.15, x: 4 }}
                   whileTap={{ scale: 0.9 }}
                   initial={{ opacity: 0, scale: 0.8 }}
                   animate={{ opacity: 1, scale: 1, top: liveArrowsY }}
                   transition={{ type: "spring", stiffness: 100, damping: 18 }}
                   onClick={() => {
                     if (scrollRef.current) {
                       scrollRef.current.scrollBy({ left: 340, behavior: 'smooth' });
                     }
                   }}
                   className={`absolute right-4 md:right-8 -translate-y-1/2 z-50 p-2.5 md:p-3.5 rounded-full border shadow-2xl cursor-pointer ${
                     isDarkMode 
                       ? 'bg-slate-900/90 border-slate-700/85 text-slate-100 hover:bg-slate-800' 
                       : 'bg-white/95 border-sky-200 text-blue-900 hover:bg-sky-50 hover:border-blue-350 shadow-xl'
                   }`}
                   style={{ touchAction: 'none' }}
                 >
                   <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                 </motion.button>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Alert Warning if Gemini is Simulated */}
              {aiError && (
                <div className={`p-4.5 rounded-2xl border flex items-start gap-3.5 transition-colors duration-300 text-sm ${
                  isDarkMode 
                    ? 'bg-amber-950/25 border-amber-500/30 text-amber-300' 
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  <Sliders className="w-5.5 h-5.5 shrink-0 animate-bounce mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-extrabold text-[15px]">ข้อแนะนำการใช้งานระบบอ่านค่าระดับน้ำด้วยภาพ</p>
                    <p className="opacity-90 leading-relaxed text-[13px]">{aiError}</p>
                  </div>
                </div>
              )}

              {/* Main 2-Column AI Grid Section */}
              <div className="grid grid-cols-12 gap-6 items-start">
                
                {/* Left Column: Select Camera & Samples */}
                <div className="col-span-7 space-y-6">
                  
                  {/* Card Section: Select Camera */}
                  <div className={`border rounded-2xl p-5.5 transition-all duration-300 ${
                    isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-sky-100 shadow-sm'
                  }`}>
                    <h3 className={`text-base font-extrabold mb-4 font-sans flex items-center gap-2 ${isDarkMode ? 'text-slate-100' : 'text-blue-950'}`}>
                      <Video className="w-5 h-5 text-blue-600" />
                      <span>เลือกจุดภาพถ่ายกล้องวงจรปิดเลขคู่ (Even CCTV Cameras)</span>
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3.5">
                      {[
                        { id: 'cam2', label: 'CAM 2 - บ้านน้ำขุ่น', desc: 'จุดโค้งต้นมะพร้าว', sampleIdx: 1, image: 'https://lh3.googleusercontent.com/d/1D6EBHOiMkmaAcqYzSoycbBCuDeGiu9s7' },
                        { id: 'cam4', label: 'CAM 4 - วัดกะทิง', desc: 'มุมลานเอนกประสงค์', sampleIdx: 2, image: 'https://lh3.googleusercontent.com/d/1R8ox_4-UX7o7ClbRALeig0tnUR4bhX6V' },
                        { id: 'cam6', label: 'CAM 6 - วัดปึก', desc: 'ศาลาการเปรียญพุทธสถาน', sampleIdx: 3, image: 'https://lh3.googleusercontent.com/d/1ufB4jlpSsZfh1_x7ZPLtHc6M6fc4lJ1a' },
                        { id: 'cam8', label: 'CAM 8 - บ้านแตงเม', desc: 'หน้าลานเก็บวัสดุ', sampleIdx: 4, image: 'https://lh3.googleusercontent.com/d/18vH7SfoLj4cRErltfn3fxeD5N1Rl3DVQ' }
                      ].map((c) => {
                        const isSelected = selectedAiCamId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedAiCamId(c.id);
                              addLog('info', `เลือกวิเคราะห์ระดับน้ำกล้องจุดเลขคู่: [${c.label}]`);
                            }}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                              isSelected 
                                ? (isDarkMode ? 'bg-indigo-500/10 border-cyan-400 ring-2 ring-cyan-500/20' : 'bg-blue-50/50 border-blue-500') 
                                : (isDarkMode ? 'bg-slate-950 border-slate-800 hover:bg-slate-900' : 'bg-slate-50 border-slate-200 hover:bg-slate-100')
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                                isSelected 
                                  ? 'bg-blue-600 text-white' 
                                  : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600')
                              }`}>{c.id.toUpperCase()}</span>
                              <span className="text-[11px] text-slate-500 font-mono">ภาพตัวอย่าง {c.sampleIdx}</span>
                            </div>
                            <p className="font-extrabold text-[13px] truncate">{c.label}</p>
                            <p className="text-[11px] text-slate-500 truncate">{c.desc}</p>
                            
                            <div className="mt-2 aspect-video rounded-lg overflow-hidden relative border border-slate-700/10">
                              <img 
                                src={c.image} 
                                alt={c.label} 
                                className="w-full h-full object-cover grayscale-[30%] hover:scale-105 duration-350 transition-transform"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => {
                          const camera = zones.flatMap(z => z.cams).find(c => c.id === selectedAiCamId);
                          if (camera) {
                            addLog('info', `เริ่มดึงภาพสดของกล้อง [${camera.label}] เพื่อวิเคราะห์วัดระดับน้ำ...`);
                            handleAiAnalyze(selectedAiCamId);
                          }
                        }}
                        className="w-full py-4.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-black shadow-lg shadow-blue-500/15 cursor-pointer transition flex items-center justify-center gap-2"
                      >
                        <CameraIcon className="w-5 h-5 shrink-0" />
                        <span>📸 ดึงภาพจากกล้องสดตรวจวัดระดับน้ำเดี๋ยวนี้ (Scan Live Camera CCTV)</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Section: Water Level Sample Photos (User Drive Links) */}
                  <div className={`border rounded-2xl p-5.5 transition-all duration-300 ${
                    isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-sky-100 shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
                      <h3 className={`text-base font-extrabold font-sans flex items-center gap-2 ${isDarkMode ? 'text-slate-100' : 'text-blue-955'}`}>
                        <Eye className="w-5 h-5 text-indigo-500" />
                        <span>ตัวเลือกประมวลผลด้วยภาพตัวอย่างที่ให้มา (4 Drive Links)</span>
                      </h3>
                      <span className="text-xs bg-slate-200/50 dark:bg-slate-800 dark:text-slate-400 text-slate-600 px-2.5 py-1 rounded-full font-mono font-bold">100% Match</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2.5">
                      {[
                        { idx: 1, label: 'ภาพที่ 1 (0.85 ม.)', camId: 'cam2', url: 'https://lh3.googleusercontent.com/d/1D6EBHOiMkmaAcqYzSoycbBCuDeGiu9s7' },
                        { idx: 2, label: 'ภาพที่ 2 (1.15 ม.)', camId: 'cam4', url: 'https://lh3.googleusercontent.com/d/1R8ox_4-UX7o7ClbRALeig0tnUR4bhX6V' },
                        { idx: 3, label: 'ภาพที่ 3 (1.25 ม.)', camId: 'cam6', url: 'https://lh3.googleusercontent.com/d/1ufB4jlpSsZfh1_x7ZPLtHc6M6fc4lJ1a' },
                        { idx: 4, label: 'ภาพที่ 4 (1.70 ม.)', camId: 'cam8', url: 'https://lh3.googleusercontent.com/d/18vH7SfoLj4cRErltfn3fxeD5N1Rl3DVQ' }
                      ].map((item) => (
                        <button
                          key={item.idx}
                          type="button"
                          onClick={() => {
                            setSelectedAiCamId(item.camId);
                            handleAiAnalyze(item.camId, item.url);
                          }}
                          className={`py-3 px-2 rounded-xl text-center cursor-pointer transition border font-bold text-xs ${
                            selectedAiCamId === item.camId && aiAnalysisResult?.waterLevel === (item.idx === 1 ? 0.85 : item.idx === 2 ? 1.15 : item.idx === 3 ? 1.25 : 1.70)
                              ? 'bg-blue-600 text-white border-blue-600 shadow'
                              : (isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900' : 'bg-sky-50/50 border-sky-100 hover:bg-sky-50 text-blue-900')
                          }`}
                        >
                          <div className="font-mono text-[10px] opacity-70 mb-0.5">ภาพตัวอย่าง {item.idx}</div>
                          <div className="font-extrabold">{item.label}</div>
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                      <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[12px] font-black font-sans leading-relaxed text-amber-800 dark:text-amber-200">
                            กฎสำคัญในการตรวจวัดระดับน้ำทางกายภาพ (Staff Gauge CCTV Rules):
                          </p>
                          <p className="text-[13px] font-extrabold text-rose-600 dark:text-rose-400 leading-relaxed mt-1">
                            ⚠️ "การวัดระดับ ถ้าเห็นเลขมาตรวัดในภาพกล้อง แต่ไม่พบระดับน้ำให้ยึดเลขที่อยู่ด้านล่างเป็นระดับน้ำทันที"
                          </p>
                          <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                            * ท่านสามารถกดเลือกรูปแบบพิกัดด้านบนเพื่อจำลองหรือสแกนด้วย AI ได้ทันที ระบบจะวิเคราะห์ระเบียบมาตรวัดโดยอัตโนมัติตามข้อกำหนดชลประทานนี้
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Section: Drag and Drop / Custom Image Uploader */}
                  <div className={`border rounded-2xl p-5.5 transition-all duration-300 ${
                    isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-sky-100 shadow-sm'
                  }`}>
                    <h3 className={`text-base font-extrabold mb-3 font-sans flex items-center gap-2 ${isDarkMode ? 'text-slate-100' : 'text-blue-955'}`}>
                      <Plus className="w-5 h-5 text-emerald-500" />
                      <span>อัปโหลดภาพถ่ายมาตรวัดน้ำกล้องคู่ด้วยตัวคุณเอง (Upload Staff Gauge)</span>
                    </h3>

                    <label className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition ${
                      isDarkMode ? 'border-slate-800 bg-slate-950/40 hover:border-slate-705' : 'border-sky-200 bg-sky-50/20 hover:border-sky-400'
                    }`}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              const base64String = reader.result as string;
                              setCustomFileBase64(base64String);
                              addLog('info', `อัปโหลดภาพมาใหม่ของคุณเองเพื่อวิเคราะห์ระดับน้ำ: ${file.name}`);
                              // strip header data url prefix for processing
                              const strippedBase64 = base64String.split(',')[1];
                              // Trigger analysis on currently selected AI camera with upload data
                              handleAiAnalyze(selectedAiCamId, undefined, strippedBase64);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <div className="p-3 rounded-full bg-blue-500/10 text-blue-600">
                        <Cpu className="w-6 h-6 shrink-0" />
                      </div>
                      <div className="text-center">
                        <span className="font-extrabold text-xs text-blue-600 block sm:inline">กดเลือกคัดไฟล์เพื่ออัปโหลด</span>
                        <span className={`text-xs ml-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>หรือลากมาวางจุดนี้เพื่อสแกนตรวจจับ</span>
                      </div>
                      <span className="text-[35px] text-slate-500">รองรับระบบไฟล์ภาพ .JPG, .PNG และภาพจากกล้องสมาร์ตโฟนทั่วไป</span>
                    </label>
                  </div>

                </div>

                {/* Right Column: AI & Manual Interactive Analysis Outcome Dashboard */}
                <div className="col-span-5">
                  {(() => {
                    const calculatedManualLevel = minGaugeScale + (manualLinePercent / 100) * (maxGaugeScale - minGaugeScale);
                    const isHighScale = aiAnalysisResult && aiAnalysisResult.waterLevel > 2.5;
                    const dialMin = isHighScale ? 3.50 : 0.00;
                    const dialMax = isHighScale ? 5.00 : 2.50;
                    const percentOfDial = aiAnalysisResult 
                      ? ((aiAnalysisResult.waterLevel - dialMin) / (dialMax - dialMin)) * 125 
                      : 0;

                    const computedManualStatusClass = (val: number) => {
                      const threshold = minGaugeScale + (maxGaugeScale - minGaugeScale) * 0.7;
                      const warningThreshold = minGaugeScale + (maxGaugeScale - minGaugeScale) * 0.4;
                      if (val >= threshold) return "วิกฤต";
                      if (val >= warningThreshold) return "เฝ้าระวัง";
                      return "ระดับปกติ";
                    };

                    const manualStatus = computedManualStatusClass(calculatedManualLevel);

                    return (
                      <div className={`border rounded-2xl p-6 transition-all duration-300 relative overflow-hidden ${
                        isDarkMode ? 'bg-slate-900 border-slate-800 shadow-xl' : 'bg-white border-sky-100 shadow-md'
                      }`}>
                        
                        {/* High-Tech Grid Scan Mesh Effect */}
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-600 to-emerald-500 opacity-90" />

                        {/* Interactive Switch Action Tabs */}
                        {/* Interactive Switch Action Tabs */}
                        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 mb-6 border border-slate-200/50 dark:border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => setIsManualMode(false)}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              !isManualMode
                                ? (isDarkMode ? 'bg-slate-800 text-blue-400 shadow-md' : 'bg-white text-blue-600 shadow-sm')
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                            }`}
                          >
                            <Cpu className="w-3.5 h-3.5 shrink-0" />
                            <span>สแกนตรวจจับ AI (OCR)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsManualMode(true)}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              isManualMode
                                ? (isDarkMode ? 'bg-slate-800 text-indigo-400 shadow-md' : 'bg-white text-indigo-600 shadow-sm')
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                            }`}
                          >
                            <Ruler className="w-3.5 h-3.5 shrink-0" />
                            <span>ทาบขีดวัดความสูงเสา</span>
                          </button>
                        </div>

                        {!isManualMode ? (
                          // AI Mode Panel
                          <div className="space-y-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 
                                  className={`font-black tracking-wide ${isDarkMode ? 'text-slate-100' : 'text-blue-955'}`}
                                  style={{ fontSize: '55px' }}
                                >
                                  ผลลัพธ์การประมวลผล Generative AI
                                </h3>
                                <p className="text-[11px] text-slate-500">ผ่านบริการ Gemini 1.5/2.5 API เครือข่ายคลาวด์</p>
                              </div>
                              <span 
                                className={`px-2.5 py-1 font-bold rounded-lg ${
                                  isAiAnalyzing 
                                    ? 'bg-blue-500/10 text-blue-500 animate-pulse' 
                                    : 'bg-emerald-500/10 text-emerald-500'
                                }`}
                              >
                                {isAiAnalyzing ? '🔴 กำลังสแกน...' : '🟢 ตอบรับแล้ว'}
                              </span>
                            </div>

                            {isAiAnalyzing ? (
                              <div className="py-20 flex flex-col items-center justify-center space-y-4">
                                <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                                <div className="text-center space-y-1">
                                  <p className={`text-sm font-extrabold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>กำลังวิเคราะห์รูปบอร์ดวัด...</p>
                                  <p className="text-xs text-slate-500">AI กำลังซูมมองพิกัดตัวเลขระดับเซนติเมตรและวิเคราะห์กระแสน้ำไหล</p>
                                </div>
                              </div>
                            ) : aiAnalysisResult ? (
                              <div className="space-y-5">
                                
                                {/* Dynamic Gauge Meter Dial with auto scale selection 4.xx or 0-2.5 */}
                                <div className="flex flex-col items-center justify-center p-3 border border-slate-200/10 rounded-2xl bg-slate-500/[0.03]">
                                  <div className="relative w-36 h-20 overflow-hidden flex items-end justify-center">
                                    
                                    {/* Standard SVG Arc Dial representation */}
                                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 50">
                                      {/* Background arc track */}
                                      <path 
                                        d="M 10 50 A 40 40 0 0 1 90 50" 
                                        fill="none" 
                                        stroke={isDarkMode ? "#1e293b" : "#e2e8f0"} 
                                        strokeWidth="8" 
                                        strokeLinecap="round" 
                                      />
                                      {/* Safety-color filled segment according to water level */}
                                      <path 
                                        d="M 10 50 A 40 40 0 0 1 90 50" 
                                        fill="none" 
                                        stroke={
                                          aiAnalysisResult.waterLevel >= (isHighScale ? 4.30 : 1.5) 
                                            ? "#f43f5e" // red (highly critical)
                                            : aiAnalysisResult.waterLevel >= (isHighScale ? 4.10 : 1.0) 
                                              ? "#f59e0b" // orange (warning)
                                              : "#10b981" // green (normal)
                                        } 
                                        strokeWidth="8" 
                                        strokeLinecap="round" 
                                        strokeDasharray="125"
                                        strokeDashoffset={125 - Math.min(Math.max(percentOfDial, 0), 125)}
                                      />
                                    </svg>

                                    {/* Center Value */}
                                    <div className="text-center z-10 space-y-0.5">
                                      <span className="text-3xl font-black font-mono tracking-tight text-blue-600 dark:text-blue-400 block">
                                        {aiAnalysisResult.waterLevel != null ? aiAnalysisResult.waterLevel.toFixed(2) : '0.00'}
                                      </span>
                                      <span className={`text-[10px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                        เมตร (METERS)
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between w-full mt-3.5 px-4 text-[11px] font-bold text-slate-500">
                                    <span>{(dialMin ?? 0).toFixed(2)} ม. ({isHighScale ? 'เฝ้าระวังต่ำ' : 'แห้งแล้ง'})</span>
                                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                                      aiAnalysisResult.readStatus === 'วิกฤต' 
                                        ? 'bg-rose-500 text-white animate-pulse'
                                        : aiAnalysisResult.readStatus === 'เฝ้าระวัง'
                                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                    }`}>
                                      สถานะ: {aiAnalysisResult.readStatus}
                                    </span>
                                    <span>{(dialMax ?? 0).toFixed(2)} ม. (ท่วมวิกฤต)</span>
                                  </div>
                                </div>

                                {/* Confidence and Marks tags */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="p-3 rounded-xl bg-slate-500/5 text-left border border-slate-700/5 font-sans">
                                    <span className="text-[10px] text-slate-500 block">ความมั่นใจ (Confidence)</span>
                                    <span className="text-xs font-black font-mono text-emerald-500">{(aiAnalysisResult.confidence != null ? (aiAnalysisResult.confidence * 100).toFixed(0) : '0')}% CC (AI)</span>
                                  </div>
                                  <div className="p-3 rounded-xl bg-slate-500/5 text-left border border-slate-700/5 font-sans">
                                    <span className="text-[10px] text-slate-500 block">ช่วงสายตาที่ตรวจพบ (Detected Marks)</span>
                                    <span className="text-xs font-bold font-mono tracking-wide truncate block">
                                      {aiAnalysisResult.detectedMarkings?.join(', ') || "บอร์ดมาตรเด่นชัด"}
                                    </span>
                                  </div>
                                </div>

                                {/* AI Observations Box */}
                                <div className="p-4 rounded-xl bg-indigo-500/[0.04] border border-blue-500/10 text-left space-y-2">
                                  <span className={`text-[12px] font-black block ${isDarkMode ? 'text-indigo-300' : 'text-blue-900 border-b border-blue-100 dark:border-blue-900/30 pb-1'}`}>
                                    📝 รายงานการอ่านค่ากล้องวงจรปิดด้วย AI
                                  </span>
                                  <p className={`text-[13px] leading-relaxed font-sans font-semibold select-text ${isDarkMode ? 'text-slate-300' : 'text-slate-650'}`}>
                                    {aiAnalysisResult.explanation}
                                  </p>
                                </div>

                                {/* Interactive Manual Override / Save */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const camera = zones.flatMap(z => z.cams).find(c => c.id === selectedAiCamId);
                                    const zone = zones.find(z => z.cams.some(c => c.id === selectedAiCamId));
                                    const newLog = {
                                      id: 'manual-' + Date.now(),
                                      camId: selectedAiCamId,
                                      camLabel: camera?.label || 'CAM',
                                      zoneName: zone?.name || 'วัดปึก',
                                      waterLevel: aiAnalysisResult.waterLevel,
                                      confidence: aiAnalysisResult.confidence,
                                      readStatus: aiAnalysisResult.readStatus,
                                      explanation: `[บันทึกสแกน AI] ระบุระดับน้ำสูงจริง ${aiAnalysisResult.waterLevel != null ? aiAnalysisResult.waterLevel.toFixed(2) : '0.00'} เมตร ตรวจสอบผ่านด่านเฝ้าระวังอัตราพยากรณ์คลองวัดปึกอย่างแม่นยำ`,
                                      imageUrl: aiScannedImage || mockImageForCam(selectedAiCamId) || "",
                                      timestamp: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                                    };
                                    setAiLogs((prev: any) => {
                                      const u = [newLog, ...prev];
                                      localStorage.setItem('watpuek_ai_logs', JSON.stringify(u));
                                      return u;
                                    });
                                    addLog('success', `บันทึกเกณฑ์ระดับน้ำสแกน AI: ${aiAnalysisResult.waterLevel != null ? aiAnalysisResult.waterLevel.toFixed(2) : '0.00'} เมตร เรียบร้อยแล้ว`);
                                  }}
                                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/15 cursor-pointer transition flex items-center justify-center gap-1.5"
                                >
                                  <Save className="w-4 h-4 shrink-0" />
                                  <span>ยึดรายงาน AI เก็บเข้าระบบประวัติ (Save AI Reading)</span>
                                </button>
                              </div>
                            ) : (
                              <div className="py-20 text-center text-slate-500">
                                <Cpu className="w-10 h-10 mx-auto mb-2 text-slate-400 animate-pulse" />
                                <p className="text-xs">ไม่ได้เลือกประมวลผลตัวอย่างใดๆ</p>
                                <p className="text-[10px] text-slate-400">กรุณากดเลือกภาพหลักเพื่อส่งให้ตัวตรวจจับปัญญาประดิษฐ์</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          // High-Precision Manual Calibration Panel (No complex library, 100% stable interaction)
                          <div className="space-y-5 text-left">
                            <div>
                              <h3 className={`text-[14px] font-black tracking-wide ${isDarkMode ? 'text-slate-100' : 'text-indigo-400'}`}>
                                เครื่องมือทาบแนวเส้นสายตากึ่งอัตโนมัติ (Manual Ruler Overlay)
                              </h3>
                              <p className="text-[11px] text-slate-500">
                                วิธีใช้: ลากระดับหรือกรอกป้อนช่วงสเกลหัวเสากริ่งเพื่อประเมินความสูงของน้ำได้ทันทีสำหรับแนว 4.xx เมตร
                              </p>
                              <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                💡 กฎวัดระดับ: ถ้าเห็นเลขมาตรวัดในภาพกล้อง แต่ไม่พบระดับน้ำให้ยึดเลขที่อยู่ด้านล่างเป็นระดับน้ำทันที
                              </p>
                            </div>

                            {/* Relative visual block with overlay line to calibrated picture */}
                            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-700/25 bg-slate-950 shadow-inner flex items-center justify-center">
                              {/* Background Target Image */}
                              <img 
                                src={aiScannedImage || mockImageForCam(selectedAiCamId)} 
                                alt="CCTV Target for Manual Calibration" 
                                className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none opacity-85"
                              />

                              {/* Target Laser Level Line with drag percent height */}
                              {/* Target Laser Level Line with drag percent height */}
                              <div 
                                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-rose-500 to-yellow-400 shadow-[0_0_12px_rgba(244,63,94,1)] flex items-center justify-between pointer-events-none z-20"
                                style={{ bottom: `${manualLinePercent}%` }}
                              >
                                <span className="text-[10px] bg-rose-600 text-white font-extrabold px-2 py-0.5 rounded-r shadow-md font-mono shrink-0">
                                  แนวระดับน้ำจริง: ${(calculatedManualLevel ?? 0).toFixed(2)} ม.
                                </span>
                                <span className="w-2.5 h-2.5 mr-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                              </div>

                              {/* Overlay scale marking indicators on the side */}
                              <div className="absolute right-2 top-2 bottom-2 w-14 bg-slate-900/80 backdrop-blur-xs border border-white/10 rounded px-1 py-1.5 flex flex-col justify-between pointer-events-none select-none z-10 font-mono text-[9px] text-slate-300 text-right">
                                <div className="border-t border-white/20 pt-0.5">Top: ${(maxGaugeScale ?? 0).toFixed(2)}m</div>
                                <div className="border-t border-white/10 pt-0.5">75%: ${(minGaugeScale != null && maxGaugeScale != null ? minGaugeScale + (maxGaugeScale - minGaugeScale) * 0.75 : 0).toFixed(2)}m</div>
                                <div className="border-t border-white/10 pt-0.5">Mid: ${(minGaugeScale != null && maxGaugeScale != null ? minGaugeScale + (maxGaugeScale - minGaugeScale) * 0.5 : 0).toFixed(2)}m</div>
                                <div className="border-t border-white/10 pt-0.5">25%: ${(minGaugeScale != null && maxGaugeScale != null ? minGaugeScale + (maxGaugeScale - minGaugeScale) * 0.25 : 0).toFixed(2)}m</div>
                                <div className="border-t border-white/20 pt-0.5">Bot: ${(minGaugeScale ?? 0).toFixed(2)}m</div>
                              </div>

                              {/* Quick click drag area helper indicator */}
                              <div className="absolute left-2 bottom-2 bg-black/65 backdrop-blur-xs text-[9px] text-white font-semibold py-1 px-2 rounded font-sans pointer-events-none">
                                เลื่อนแถบด้านล่างเพื่อปรับระดับน้ำทับเส้นผิวน้ำในรูปภาพ
                              </div>
                            </div>

                            {/* Active calibration controls */}
                            <div className="p-4 rounded-xl bg-slate-500/5 border border-slate-700/5 space-y-4">
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                                  <span>ปรับระดับความสูงของแนววัดระดับน้ำจริง:</span>
                                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm font-mono bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                                    ${(calculatedManualLevel ?? 0).toFixed(2)} เมตร (m)
                                  </span>
                                </div>
                                <input 
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={manualLinePercent}
                                  onChange={(e) => setManualLinePercent(Number(e.target.value))}
                                  className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                              </div>

                              {/* Calibration Scales input */}
                              <div className="grid grid-cols-2 gap-3.5 pt-1">
                                <div className="space-y-1">
                                  <label className="text-[11px] font-bold text-slate-500 block">
                                    จุดวัดล่างสุดของเสาวัด (เมตร)
                                  </label>
                                  <input 
                                    type="number"
                                    step="0.05"
                                    value={minGaugeScale}
                                    onChange={(e) => setMinGaugeScale(Number(e.target.value))}
                                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-bold text-slate-500 block">
                                    จุดวัดสูงสุดของเสาวัด (เมตร)
                                  </label>
                                  <input 
                                    type="number"
                                    step="0.05"
                                    value={maxGaugeScale}
                                    onChange={(e) => setMaxGaugeScale(Number(e.target.value))}
                                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-bold text-slate-500 block">
                                    จุดวัดสูงสุดของเสาวัด (เมตร)
                                  </label>
                                  <input 
                                    type="number"
                                    step="0.05"
                                    value={maxGaugeScale}
                                    onChange={(e) => setMaxGaugeScale(Number(e.target.value))}
                                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Live computed status box */}
                            <div className={`p-4 rounded-xl flex items-center justify-between border ${
                              manualStatus === 'วิกฤต'
                                ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                                : manualStatus === 'เฝ้าระวัง'
                                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                            }`}>
                              <div>
                                <span className="text-[10px] block font-bold uppercase tracking-wider opacity-75">ผลลัพธ์คำนวณสถานะภัย</span>
                                <span className="text-xs font-black">
                                  ระดับอ้างอิง: {(calculatedManualLevel ?? 0).toFixed(2)} เมตร — {manualStatus === 'วิกฤต' ? '🔴 วิกฤตน้ำท่วมขังไหลเอ่อ' : manualStatus === 'เฝ้าระวัง' ? '🟡 เกณฑ์เฝ้าระวังภัยใกล้ชิด' : '🟢 ปริมาณปกติดี'}
                                </span>
                              </div>
                              <span className="text-[10px] bg-slate-800 text-slate-200 px-2 py-0.5 rounded font-bold font-mono">
                                สเกลแม่นยำสูง
                              </span>
                            </div>

                            {/* Submit Manual Log Button */}
                            <button
                              type="button"
                              onClick={() => {
                                const camera = zones.flatMap(z => z.cams).find(c => c.id === selectedAiCamId);
                                const zone = zones.find(z => z.cams.some(c => c.id === selectedAiCamId));
                                const readStatusStr = computedManualStatusClass(calculatedManualLevel);

                                const newLog = {
                                  id: 'manual-calibration-' + Date.now(),
                                  camId: selectedAiCamId,
                                  camLabel: camera?.label || 'CAM',
                                  zoneName: zone?.name || 'วัดปึก',
                                  waterLevel: calculatedManualLevel,
                                  confidence: 1.0,
                                  readStatus: readStatusStr,
                                  explanation: `[บันทึกกึ่งเครื่องมือทาบสายตา] โดยพิจารณาจากภาพถ่ายกล้องวงจรปิด ได้ระดับจุดผิวน้ำจริงที่ ${(calculatedManualLevel ?? 0).toFixed(2)} เมตร เปรียบเทียบสเกลอ้างอิงของคลองส่งน้ำวัดปึกช่วงน้ำหนุน`,
                                  imageUrl: aiScannedImage || mockImageForCam(selectedAiCamId) || "",
                                  timestamp: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                                };
                                
                                setAiLogs((prev: any) => {
                                  const u = [newLog, ...prev];
                                  localStorage.setItem('watpuek_ai_logs', JSON.stringify(u));
                                  return u;
                                });
                                addLog('success', `บันทึกจากการกึ่งทาบสายตาเรียบร้อย: [${camera?.label || selectedAiCamId}] ทาบวัดได้ ${(calculatedManualLevel ?? 0).toFixed(2)} เมตร`);
                                
                                setAiAnalysisResult({
                                  waterLevel: calculatedManualLevel,
                                  confidence: 1.0,
                                  gaugeFound: true,
                                  readStatus: readStatusStr,
                                  explanation: `ตรวจสอบระดับด้วยสายตาทาบบนรูปภาพกล้อง ${camera?.label || 'วัดระดับ'} โดยเจ้าหน้าที่ อาสาสมัครระดมค่าวัดระดับน้ำสเกลหัวเสาได้ผลลัพธ์เป็นเอกฉันท์ที่ ${(calculatedManualLevel ?? 0).toFixed(2)} เมตร`,
                                  detectedMarkings: [(minGaugeScale ?? 0).toFixed(1), (calculatedManualLevel ?? 0).toFixed(1), (maxGaugeScale ?? 0).toFixed(1)]
                                });
                              }}
                              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-500/15 cursor-pointer transition flex items-center justify-center gap-1.5"
                            >
                              <Save className="w-4 h-4 shrink-0" />
                              <span>บันทึกและส่งรายงานค่าวัดสายตานี้ (Submit Calibrated Level)</span>
                            </button>
                          </div>
                        )}

                      </div>
                    );
                  })()}
                </div>

              </div>

              {/* Graphical Trend & Logging Timeline */}
              <div className="grid grid-cols-12 gap-6 items-start">
                
                {/* Visual Trend Diagram (Custom SVG Chart) */}
                <div className="col-span-7 font-sans">
                  <div className={`border rounded-2xl p-6 transition-all duration-300 ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-sky-101 shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div>
                        <h3 className={`text-sm font-black font-sans ${isDarkMode ? 'text-slate-100' : 'text-blue-955'}`}>
                          สถิติกราฟวิเคราะห์ระดับน้ำลำคลอง (Water Level Trend Timeline)
                        </h3>
                        <p className="text-[11px] text-slate-550">แสดงพล็อตข้อมูลประเมินตามประวัติตำบลวังแซ้ม</p>
                      </div>
                      <span className="text-xs bg-slate-500/10 text-blue-650 font-bold px-2.5 py-0.5 rounded-full">เรียงตามเวลา</span>
                    </div>

                    {/* Highly-tuned Premium Custom SVG Area Graph */}
                    <div className="h-64 w-full relative flex items-end justify-center">
                      <svg className="w-full h-full pb-6 pt-2 select-none" viewBox="0 0 400 150" preserveAspectRatio="none">
                        {/* Grid lines */}
                        <line x1="10" y1="20" x2="390" y2="20" stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} strokeWidth="1" strokeDasharray="3,3" />
                        <line x1="10" y1="60" x2="390" y2="60" stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} strokeWidth="1" strokeDasharray="3,3" />
                        <line x1="10" y1="100" x2="390" y2="100" stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} strokeWidth="1" strokeDasharray="3,3" />
                        <line x1="10" y1="130" x2="390" y2="130" stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} strokeWidth="1" />

                        {/* Chart Area Fill Gradient using SVG */}
                        <defs>
                          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                          </linearGradient>
                        </defs>

                        {/* Draw custom polyline and fill for logs */}
                        {(() => {
                          const points = [...aiLogs].reverse().slice(-5);
                          if (points.length < 2) return null;
                          const widthStep = 380 / (points.length - 1);
                          const getX = (idx: number) => idx * widthStep + 10;
                          // maps level 0.0m - 2.5m -> 130 to 20 height coords
                          const getY = (val: number) => 130 - (val / 2.5) * 110;

                          const polyPoints = points.map((p, idx) => `${getX(idx)},${getY(p.waterLevel)}`).join(' ');
                          const fillPoints = `${getX(0)},130 ` + polyPoints + ` ${getX(points.length - 1)},130`;

                          return (
                            <>
                              <polygon points={fillPoints} fill="url(#chartGradient)" />
                              <polyline points={polyPoints} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
                              
                              {/* Draw interactive vertex circles */}
                              {points.map((p, idx) => (
                                <g key={p.id || idx}>
                                  <circle cx={getX(idx)} cy={getY(p.waterLevel || 0)} r="4" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                                  <text x={getX(idx)} y={getY(p.waterLevel || 0) - 8} textAnchor="middle" fontSize="8" fontWeight="bold" fill={isDarkMode ? "#94a3b8" : "#1e3a8a"} className="font-mono">
                                    {p.waterLevel != null ? p.waterLevel.toFixed(1) : '-'}ม.
                                  </text>
                                </g>
                              ))}
                            </>
                          );
                        })()}
                      </svg>
                      
                      {/* Dates Axis Labels below custom SVG area */}
                      <div className="absolute inset-x-0 bottom-0 h-5 flex justify-between px-3 text-[10px] font-mono font-bold text-slate-555 bg-transparent">
                        {[...aiLogs].reverse().slice(-5).map((p, index) => (
                          <span key={p.id || index}>{p.timestamp.split(' ')[1] || p.timestamp}</span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-1 border-t border-dashed border-slate-700/10 pt-3 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 block" />
                        <span>ระดับน้ำเฉลี่ยล่าสุด: {([...aiLogs].reduce((sum: number, l: any) => sum + (l.waterLevel != null ? l.waterLevel : 0), 0) / Math.max(aiLogs.length, 1)).toFixed(2)} เมตร</span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Historic Log List view */}
                <div className="col-span-5">
                  <div className={`border rounded-2xl p-6 transition-all duration-300 ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-sky-101 shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`text-sm font-black font-sans ${isDarkMode ? 'text-slate-100' : 'text-blue-955'}`}>
                        ประวัติการวิเคราะห์ด้วย AI ล่าสุด
                      </h3>
                    </div>
                    
                    <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                      {aiLogs.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 dark:text-slate-505">
                          ยังไม่มีประวัติการประมวลผลสำหรับวันนี้
                        </div>
                      ) : (
                        [...aiLogs].map((log) => (
                          <div 
                            key={log.id} 
                            className={`p-3 rounded-xl border text-left flex items-center justify-between gap-3 text-xs ${
                              isDarkMode ? 'bg-slate-950/50 border-slate-850' : 'bg-slate-50 border-slate-150'
                            }`}
                          >
                            <div className="space-y-1 truncate">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-[12px]">{log.camLabel}</span>
                                <span className={`px-1.5 py-0.5 text-[9px] rounded font-bold ${
                                  log.readStatus === 'วิกฤต' 
                                    ? 'bg-rose-500 text-white' 
                                    : log.readStatus === 'เฝ้าระวัง' 
                                      ? 'bg-amber-500 text-slate-950' 
                                      : 'bg-emerald-500 text-white'
                                }`}>
                                  {log.readStatus}
                                </span>
                              </div>
                              <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-505'} truncate`}>
                                {log.zoneName} · {log.timestamp}
                              </p>
                            </div>
                            
                            <div className="text-right shrink-0">
                              <span className="text-sm font-black font-mono text-blue-600 block">
                                {log.waterLevel != null ? log.waterLevel.toFixed(2) : '0.00'} ม.
                              </span>
                              <span className="text-[9px] text-slate-500 block">มั่นใจ {(log.confidence != null ? (log.confidence * 100).toFixed(0) : '0')}%</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                  </div>
                </div>

              </div>

            </motion.div>
          )}

          {activeTab === 'history' && (() => {
            const now = new Date();
            
            const getOffsetFromDate = (d: Date) => {
              const today = new Date();
              const d1 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const d2 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
              const diffTime = d1.getTime() - d2.getTime();
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              return diffDays >= 0 ? diffDays : 0;
            };

            const historySelectedDayOffset = getOffsetFromDate(historySelectedDate);
            const getSelectedDayInfo = (d: Date) => {
              const today = new Date();
              const yesterday = new Date(today);
              yesterday.setDate(today.getDate() - 1);
              
              const isSameDate = (d1: Date, d2: Date) => 
                d1.getFullYear() === d2.getFullYear() && 
                d1.getMonth() === d2.getMonth() && 
                d1.getDate() === d2.getDate();
                
              const label = isSameDate(d, today)
                ? 'วันนี้'
                : isSameDate(d, yesterday)
                  ? 'เมื่อวาน'
                  : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                  
              const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
              return { label, dateStr };
            };

            const selectedDay = getSelectedDayInfo(historySelectedDate);

            const getCalendarDays = (monthDate: Date) => {
              const year = monthDate.getFullYear();
              const month = monthDate.getMonth();
              
              const firstDayOfMonth = new Date(year, month, 1);
              const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sun, 6 is Sat
              
              const lastDayOfMonth = new Date(year, month + 1, 0);
              const daysInMonth = lastDayOfMonth.getDate();
              
              const days = [];
              for (let i = 0; i < startDayOfWeek; i++) {
                days.push(null);
              }
              for (let d = 1; d <= daysInMonth; d++) {
                days.push(new Date(year, month, d));
              }
              return days;
            };

            const thaiMonthNames = [
              'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
              'กรกฏาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
            ];

            const prevMonth = () => {
              const prev = new Date(historyCalendarMonth.getFullYear(), historyCalendarMonth.getMonth() - 1, 1);
              setHistoryCalendarMonth(prev);
            };

            const nextMonth = () => {
              const next = new Date(historyCalendarMonth.getFullYear(), historyCalendarMonth.getMonth() + 1, 1);
              const today = new Date();
              if (next.getFullYear() < today.getFullYear() || (next.getFullYear() === today.getFullYear() && next.getMonth() <= today.getMonth())) {
                setHistoryCalendarMonth(next);
              }
            };

            const isNextMonthDisabled = () => {
              const today = new Date();
              return historyCalendarMonth.getFullYear() > today.getFullYear() || 
                (historyCalendarMonth.getFullYear() === today.getFullYear() && historyCalendarMonth.getMonth() >= today.getMonth());
            };

            const getHistoricalReadingsForZoneAndDate = (zoneId: string, offset: number) => {
              const currentZoneObj = zones.find(z => z.id === zoneId);
              const zoneName = currentZoneObj ? currentZoneObj.name : '';

              const matchedSheetReadings = sheetReadings.filter(sr => {
                return isReadingMatchesZone(sr, currentZoneObj || zoneName) && isReadingMatchesDate(sr, historySelectedDate);
              });

              const readings = [];
              for (let h = 0; h < 24; h++) {
                if (offset === 0 && h > new Date().getHours()) continue; // ข้ามชั่วโมงที่เป็นอนาคตสำหรับวันนี้
                const hourlyMatch = matchedSheetReadings.find(sr => getHourNumber(sr.hour) === h);
                if (hourlyMatch) {
                  readings.push({
                    hour: h,
                    level: hourlyMatch.waterLevel,
                    status: hourlyMatch.readStatus || getLevelStatusTextAndColor(hourlyMatch.waterLevel).text,
                    isSynced: true,
                    source: 'sheet' as any
                  });
                  continue;
                }

                // สอง ตรวจสอบข้อมูลประสานประวัติเครื่องมือในคลังระบบ
                const hourKey = `${zoneId}_${h}`;
                const saved = hourlyReadings[hourKey];
                if (saved) {
                  if (offset === 0 && h <= new Date().getHours()) {
                    readings.push({
                      hour: h,
                      level: saved.level,
                      status: saved.status,
                      isSynced: !!saved.isSynced,
                      source: saved.status.includes('ตรวจวัด') || saved.timestamp.includes('AI') ? 'ai' : ('manual' as 'ai' | 'manual' | 'simulated')
                    });
                  }
                }
              }
              return readings;
            };

            return (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Header Section */}
                <div className={`flex justify-center items-center -text-center p-6 rounded-2xl border transition-colors duration-300 ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-sky-101/70 text-slate-800 shadow-xs'
                }`}>
                  <div className="flex flex-row items-center justify-between gap-4">
                    <div className="md:item-center -text-center">
                      <h2 
                        className={`font-black font-sans flex items-center gap-2 leading-[31px] sm:leading-[25px] ${isDarkMode ? 'text-cyan-400' : ''}`}
                        style={{ color: !isDarkMode ? '#fe0f0f' : undefined, fontSize: '55px' }}
                      >
                        <History className="stroke-[2.5] flex-shrink-0" style={{ width: '25.5px', height: '29.5px' }} />
                        ประวัติระดับน้ำ &nbsp;(จาก...กราฟ)
                      </h2>
                    </div>
                  </div>
                </div>

                {/* Main Split Layout */}
                <div className="grid grid-cols-12 gap-6 items-start">
                  
                  {/* Left Calendar Selection Sidebar */}
                  <div 
                    className={`col-span-3 transition-colors duration-300 ${
                      isDarkMode ? 'bg-slate-900 border-slate-850' : 'bg-white border-slate-200'
                    }`}
                    style={{
                      borderRadius: '20px',
                      borderWidth: '0.8px',
                      borderColor: '#000000',
                      borderStyle: 'solid',
                      paddingTop: '0px',
                      marginLeft: '0px',
                      marginTop: '10px'
                    }}
                  >
                    {/* Header Title Box */}
                    <div 
                      className="transition-colors duration-300"
                      style={{
                        borderWidth: '0px',
                        marginBottom: '0px',
                        paddingLeft: '0px',
                        paddingTop: '0px',
                        paddingRight: '0px',
                        paddingBottom: '10px',
                        marginLeft: '0px',
                        marginTop: '14px'
                      }}
                    >
                      <h3 className={`font-black leading-tight text-center ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`} style={{ fontSize: '55px', textAlign: 'center' }}>
                        เลือกวันที่ &nbsp;ที่ต้องการดูประวัติ
                      </h3>
                    </div>

                    {/* Calendar Month Selector Controls */}
                    <div 
                      className="transition-colors duration-300 flex items-center justify-between gap-1 px-4"
                      style={{
                        marginBottom: '0px',
                        paddingTop: '0px',
                        paddingLeft: '0px',
                        paddingRight: '0px',
                        paddingBottom: '0px',
                        borderRadius: '0px',
                        borderWidth: '0.8px',
                        borderColor: '#000000',
                        borderStyle: 'solid',
                        backgroundColor: isDarkMode ? '#0f172a' : '#e5f5ff',
                        color: isDarkMode ? '#22d3ee' : '#003da5',
                        height: '98.75px'
                      }}
                    >
                      <button
                        type="button"
                        onClick={prevMonth}
                        className={`p-1 rounded-md transition cursor-pointer ${
                          isDarkMode 
                            ? 'text-cyan-400 hover:text-cyan-200 hover:bg-slate-800/50' 
                            : 'text-blue-900 hover:text-blue-955 hover:bg-slate-50/40'
                        }`}
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="flex items-center gap-1 justify-center flex-1">
                        <select
                          value={historyCalendarMonth.getMonth()}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            const newDate = new Date(historyCalendarMonth.getFullYear(), val, 1);
                            setHistoryCalendarMonth(newDate);
                          }}
                          className={`font-black bg-transparent border-0 outline-none cursor-pointer py-0.5 rounded-md ${
                            isDarkMode ? 'text-cyan-400' : 'text-blue-955'
                          }`}
                          style={{ fontSize: '55px', textAlign: 'center', textAlignLast: 'center' }}
                        >
                          {thaiMonthNames.map((name, index) => {
                            const today = new Date();
                            const isFut = historyCalendarMonth.getFullYear() === today.getFullYear() && index > today.getMonth();
                            const isAfterYear = historyCalendarMonth.getFullYear() > today.getFullYear();
                            return (
                              <option 
                                key={index} 
                                value={index} 
                                disabled={isFut || isAfterYear}
                                className={isDarkMode ? 'bg-slate-900 text-slate-250' : 'bg-white text-slate-800'}
                              >
                                {name}
                              </option>
                            );
                          })}
                        </select>
                        <select
                          value={historyCalendarMonth.getFullYear()}
                          onChange={(e) => {
                            const newYear = parseInt(e.target.value, 10);
                            const today = new Date();
                            let newMonth = historyCalendarMonth.getMonth();
                            if (newYear === today.getFullYear() && newMonth > today.getMonth()) {
                              newMonth = today.getMonth();
                            }
                            const newDate = new Date(newYear, newMonth, 1);
                            setHistoryCalendarMonth(newDate);
                          }}
                          className={`font-black bg-transparent border-0 outline-none cursor-pointer py-0.5 rounded-md ${
                            isDarkMode ? 'text-cyan-400' : 'text-blue-955'
                          }`}
                          style={{ fontSize: '55px', textAlign: 'center', textAlignLast: 'center' }}
                        >
                          {Array.from({ length: 8 }, (_, i) => {
                            const year = new Date().getFullYear() - 6 + i;
                            const thaiYear = year + 543;
                            return (
                              <option 
                                key={year} 
                                value={year}
                                disabled={year > new Date().getFullYear()}
                                className={isDarkMode ? 'bg-slate-900 text-slate-250' : 'bg-white text-slate-807'}
                              >
                                พ.ศ. {thaiYear}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={nextMonth}
                        disabled={isNextMonthDisabled()}
                        className={`p-1 rounded-md transition cursor-pointer ${
                          isNextMonthDisabled()
                            ? 'opacity-30 cursor-not-allowed text-slate-400'
                            : (isDarkMode ? 'text-cyan-400 hover:text-cyan-200 hover:bg-slate-800/50' : 'text-blue-900 hover:text-blue-955 hover:bg-slate-50/40')
                        }`}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Date/Days Grid Container */}
                    <div 
                      className="p-4 transition-colors duration-300"
                      style={{
                        borderWidth: '0px'
                      }}
                    >

                      {/* Display days header indicator */}
                      <div className="grid grid-cols-7 gap-0.5 text-center font-black min-h-[36px] mb-1.5 text-slate-400 dark:text-slate-505">
                        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((day, idx) => (
                          <div key={day} className={idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-cyan-455' : ''} style={{ fontSize: '40px', lineHeight: '1.2' }}>
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Days Grid matrix */}
                      <div className="grid grid-cols-7 gap-1">
                        {getCalendarDays(historyCalendarMonth).map((day, idx) => {
                          if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;

                          const today = new Date();
                          const isToday = 
                            day.getFullYear() === today.getFullYear() && 
                            day.getMonth() === today.getMonth() && 
                            day.getDate() === today.getDate();

                          const isSelected = 
                            day.getFullYear() === historySelectedDate.getFullYear() && 
                            day.getMonth() === historySelectedDate.getMonth() && 
                            day.getDate() === historySelectedDate.getDate();

                          const isFuture = day.getTime() > today.getTime() && !isToday;

                          return (
                            <button
                              key={day.toISOString()}
                              type="button"
                              disabled={isFuture}
                              onClick={() => {
                                setHistorySelectedDate(day);
                                setHistoryHoveredHour(null);
                                const labelInfo = getSelectedDayInfo(day);
                                addLog('info', `เรียกดูแฟ้มข้อมูลวิเคราะห์ระดับน้ำ ประจำวัน ${labelInfo.label} (${labelInfo.dateStr})`);
                              }}
                              className={`aspect-square rounded-lg font-bold flex flex-col items-center justify-center relative transition-all duration-150 cursor-pointer ${
                                isFuture
                                  ? 'text-slate-300 dark:text-slate-755 cursor-not-allowed opacity-20'
                                  : isSelected
                                    ? (isDarkMode ? 'bg-cyan-500/25 border border-cyan-400 text-cyan-400' : 'bg-blue-600 text-white shadow-xs')
                                    : isToday
                                      ? (isDarkMode ? 'hover:bg-slate-800 text-cyan-333 bg-slate-900 border border-slate-800 font-extrabold' : 'hover:bg-sky-50 text-blue-600 bg-sky-50/50 border border-blue-200 font-extrabold')
                                      : (isDarkMode ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-655 hover:bg-slate-100/50 hover:text-blue-800')
                              }`}
                              style={{ fontSize: '40px', fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif" }}
                            >
                              <span>{day.getDate()}</span>
                              {isToday && !isSelected && (
                                <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-cyan-400' : 'bg-blue-600'}`} />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Daily quick jump pills */}
                      <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-850">
                        <button
                          type="button"
                          onClick={() => {
                            const today = new Date();
                            setHistorySelectedDate(today);
                            setHistoryCalendarMonth(today);
                            setHistoryHoveredHour(null);
                          }}
                          className={`font-black px-2.5 py-1.5 rounded-lg transition border cursor-pointer font-sans w-full text-center ${
                            isDarkMode ? 'bg-slate-950 hover:bg-slate-900 text-slate-400 border-slate-800' : 'bg-sky-50/45 hover:bg-sky-50 text-blue-850 border-blue-105'
                          }`}
                          style={{ fontSize: '40px' }}
                        >
                          เลือกวันนี้
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const yesterday = new Date();
                            yesterday.setDate(yesterday.getDate() - 1);
                            setHistorySelectedDate(yesterday);
                            setHistoryCalendarMonth(yesterday);
                            setHistoryHoveredHour(null);
                          }}
                          className={`font-black px-2.5 py-1.5 rounded-lg transition border cursor-pointer font-sans w-full text-center ${
                            isDarkMode ? 'bg-slate-950 hover:bg-slate-900 text-slate-400 border-slate-800' : 'bg-sky-50/45 hover:bg-sky-105 text-blue-850 border-blue-105'
                          }`}
                          style={{ fontSize: '40px' }}
                        >
                          เลือกเมื่อวาน
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Main column: responsive horizontal scroller displaying all zone cards containing their 24h tables */}
                  <div ref={buyenHistoryContainerRef} className="col-span-9 relative flex items-center group/scroller-history">
                    
                    {/* Left Arrow Button (Fixed viewport-centered layout) */}
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.15, x: -4 }}
                      whileTap={{ scale: 0.9 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1, top: historyArrowsY }}
                      transition={{ type: "spring", stiffness: 100, damping: 18 }}
                      onClick={() => {
                        if (historyScrollRef.current) {
                          historyScrollRef.current.scrollBy({ left: -340, behavior: 'smooth' });
                        }
                      }}
                      className={`absolute left-4 md:left-8 -translate-y-1/2 z-50 p-2.5 md:p-3.5 rounded-full border shadow-2xl cursor-pointer ${
                        isDarkMode 
                          ? 'bg-slate-900/90 border-slate-700/85 text-slate-100 hover:bg-slate-800' 
                          : 'bg-white/95 border-sky-200 text-blue-900 hover:bg-sky-50 hover:border-blue-350 shadow-xl'
                      }`}
                      style={{ touchAction: 'none' }}
                    >
                      <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                    </motion.button>

                    {/* Horizontally Scrollable Element Container */}
                    <div 
                      ref={historyScrollRef}
                      className="w-full flex overflow-x-auto justify-start gap-6 pb-6 pt-2 no-scrollbar scroll-smooth snap-x select-none"
                    >
                      {visibleZones.map((zone, zIdx) => {
                        const zoneReadings = getHistoricalReadingsForZoneAndDate(zone.id, historySelectedDayOffset);
                        
                        // Pre-calculate statistics metrics for this zone on the chosen day
                        const levelsVec = zoneReadings.map(r => r.level).filter(x => x !== null);
                        const sumLvl = levelsVec.reduce((a, b) => a + b, 0);
                        const avgLvl = levelsVec.length > 0 ? (sumLvl / levelsVec.length) : null;
                        
                        let hiLvl = -1;
                        let hiHour = 0;
                        let loLvl = 999;
                        let loHour = 0;
                        
                        zoneReadings.forEach(r => {
                          if (r.level > hiLvl) {
                            hiLvl = r.level;
                            hiHour = r.hour;
                          }
                          if (r.level < loLvl) {
                            loLvl = r.level;
                            loHour = r.hour;
                          }
                        });

                        return (
                          <motion.div
                            key={zone.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: zIdx * 0.08 }}
                            className={`min-w-[400px] flex-1 max-w-[480px] snap-center rounded-2xl overflow-hidden shadow-xl border flex flex-col justify-between transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-slate-900/65 border-slate-800/80 text-white' 
                                : 'bg-white border-sky-101 text-slate-850'
                            }`}
                          >
                            {/* Zone Title Header */}
                            <div 
                              style={{ height: 'auto', minHeight: '75px' }}
                              className={`px-6 py-4.5 border-b flex flex-col justify-center items-center gap-2.5 transition-colors ${
                                isDarkMode ? 'bg-slate-900/80 border-slate-800/90' : 'bg-sky-50/50 border-sky-101/60'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-3">
                                <span className={`w-3.5 h-3.5 rounded-full ${
                                  zoneReadings.length > 0 
                                    ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.65)]' 
                                    : 'bg-slate-400 dark:bg-slate-600'
                                }`} />
                                <h3 className={`font-black tracking-tight leading-none text-center ${isDarkMode ? 'text-slate-100' : 'text-blue-955'}`} style={{ fontSize: zIdx === 1 ? '55.5px' : '55px' }}>{zone.name}</h3>
                              </div>
                              <span 
                                className="font-extrabold text-slate-900 px-3 py-0.5 inline-block text-center"
                                style={{ 
                                  fontFamily: "'Angsana New', 'AngsanaUPC', 'Sarabun', sans-serif", 
                                  fontSize: '40px',
                                  backgroundColor: '#e9e9e9',
                                  borderRadius: '15px'
                                }}
                              >
                                {selectedDay.dateStr}
                              </span>
                            </div>

                            {/* 3-column table identical to live camera, 00:00-24:00 without scroll bar as requested */}
                            <div className="flex-1 w-full overflow-hidden">
                              <HourlyTelemetryTable 
                                zone={zone}
                                aiLogs={aiLogs}
                                isDarkMode={isDarkMode}
                                getLevelStatusTextAndColor={getLevelStatusTextAndColor}
                                hourlyReadings={hourlyReadings}
                                sheetReadings={sheetReadings}
                                isReadingSheet={isReadingSheet}
                                onFetchSheet={() => handleFetchHistoryFromSheet()}
                                selectedDate={historySelectedDate}
                              />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Right Arrow Button (Fixed viewport-centered layout) */}
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.15, x: 4 }}
                      whileTap={{ scale: 0.9 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1, top: historyArrowsY }}
                      transition={{ type: "spring", stiffness: 100, damping: 18 }}
                      onClick={() => {
                        if (historyScrollRef.current) {
                          historyScrollRef.current.scrollBy({ left: 340, behavior: 'smooth' });
                        }
                      }}
                      className={`absolute right-4 md:right-8 -translate-y-1/2 z-50 p-2.5 md:p-3.5 rounded-full border shadow-2xl cursor-pointer ${
                        isDarkMode 
                          ? 'bg-slate-900/90 border-slate-700/85 text-slate-100 hover:bg-slate-800' 
                          : 'bg-white/95 border-sky-200 text-blue-900 hover:bg-sky-50 hover:border-blue-350 shadow-xl'
                      }`}
                      style={{ touchAction: 'none' }}
                    >
                      <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                    </motion.button>
                  </div>
                </div>

              </motion.div>
            );
          })()}












          {activeTab === 'admin' && (
            <div>
              {!isAdminLoggedIn ? (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto my-12"
            >
              <div className={`border rounded-xl p-8 shadow-xl space-y-6 transition-colors duration-300 ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-sky-100 text-slate-800'
              }`}>
                <div className="text-center space-y-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 border ${
                    isDarkMode ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-amber-100 border-amber-200 text-amber-700'
                  }`}>
                    <ShieldCheck className="w-6 h-6 animate-pulse" />
                  </div>
                  <h2 className={`text-lg font-bold font-sans ${isDarkMode ? 'text-slate-100' : 'text-blue-955'}`}>
                    เข้าสู่ระบบผู้ดูแลระบบ (Admin Login)
                  </h2>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    เข้าสู่ระบบเพื่อแก้ไขโครงสร้างสัญญาณกล้อง และดูบันทึกระบบย่อย
                  </p>
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (username === 'admin' && password === adminPassword) {
                    setIsAdminLoggedIn(true);
                    localStorage.setItem('watpuek_admin_logged', 'true');
                    setLoginError('');
                    addLog('success', 'ผู้ดูแลระบบเข้าสู่ระบบสำเร็จ (Admin session started)');
                  } else {
                    setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
                    addLog('error', 'ความพยายามในการเข้าสู่ระบบล้มเหลว (Admin login attempt failed)');
                  }
                }} className="space-y-4">
                  <div className="space-y-1">
                    <label className={`text-[12px] font-bold block font-sans ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      ชื่อผู้ใช้งาน (Username)
                    </label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={`w-full rounded-lg px-3 py-2 text-xs font-mono outline-none ${
                        isDarkMode ? 'bg-slate-950 border border-slate-800 text-slate-200 focus:border-amber-500' : 'bg-slate-50 border border-sky-100 text-slate-850 focus:border-blue-500'
                      }`}
                      placeholder="ระบุ username"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={`text-[12px] font-bold block font-sans ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      รหัสผ่าน (Password)
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full rounded-lg px-3 py-2 text-xs font-mono outline-none ${
                        isDarkMode ? 'bg-slate-950 border border-slate-800 text-slate-200 focus:border-amber-500' : 'bg-slate-50 border border-sky-100 text-slate-850 focus:border-blue-500'
                      }`}
                      placeholder="ระบุรหัสผ่าน admin"
                    />
                  </div>

                  {loginError && (
                    <p className="text-rose-500 text-xs font-medium bg-rose-500/10 border border-rose-500/20 rounded py-1 px-2">
                      {loginError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className={`w-full py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-md ${
                      isDarkMode ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    เข้าสู่ระบบ
                  </button>
                </form>
              </div>
            </motion.div>
            ) : (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Table of all Cameras and their actual streaming details & local configs */}
              <div className={`p-5 border rounded-xl space-y-4 transition-colors ${
                isDarkMode ? 'bg-slate-900/60 border-slate-900 text-white' : 'bg-white border-sky-100 text-slate-800'
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-4 font-sans">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDarkMode ? 'bg-emerald-500' : 'bg-emerald-600'}`}></span>
                    <span className={isDarkMode ? 'text-slate-200' : 'text-blue-950'}>สถานะตารางโครงข่ายกล้องติดตั้งจริง (Real-Time Camera Node Directory)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminLoggedIn(false);
                      localStorage.removeItem('watpuek_admin_logged');
                      addLog('info', 'ผู้ดูแลระบบออกจากระบบสำเร็จ');
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer border font-sans ${
                      isDarkMode 
                        ? 'bg-slate-950 border-rose-500/10 hover:border-rose-500/30 text-rose-400 hover:bg-slate-900' 
                        : 'bg-rose-50 border-rose-200 text-red-700 hover:bg-rose-100'
                    }`}
                  >
                    ออกจากระบบแอดมิน (Log Out)
                  </button>
                </div>
                <div className={`overflow-x-auto rounded-lg border ${
                  isDarkMode ? 'border-slate-950/60 bg-slate-950/20' : 'border-sky-50 bg-sky-50/10'
                }`}>
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead className={`border-b ${isDarkMode ? 'bg-slate-950 text-slate-400 border-slate-900' : 'bg-sky-50 text-blue-900 border-sky-100'}`}>
                      <tr>
                        <th className="p-3 font-sans">ID</th>
                        <th className="p-3 font-sans">ชื่อเรียกย่อ</th>
                        <th className="p-3 font-sans">โซนหลัก</th>
                        <th className="p-3 font-sans">IP เครื่อง LAN</th>
                        <th className="p-3 font-sans">คำอธิบายสถานที่ติดตั้ง</th>
                        <th className="p-3 font-sans">ตำแหน่ง HLS URL ที่เรียกจริง</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y divide-slate-800 opacity-95 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                      {zones.flatMap(zone => zone.cams.map(cam => {
                        const finalWHEPUrl = `${gatewayUrl}/${cam.camPath}${selectedQuality === '480p' ? suffix480p : selectedQuality === '720p' ? suffix480p : suffix1080p}/index.m3u8`;
                        return (
                          <tr key={cam.id} className={`transition ${isDarkMode ? 'hover:bg-slate-950/40' : 'hover:bg-sky-50/50'}`}>
                            <td className="p-3 text-indigo-505 font-extrabold text-indigo-400">{cam.id.toUpperCase()}</td>
                            <td className="p-3 font-extrabold">{cam.label}</td>
                            <td className={`p-3 font-sans ${isDarkMode ? 'text-amber-400' : 'text-blue-900 font-semibold'}`}>{zone.name}</td>
                            <td className={`p-3 font-semibold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{cam.ipAddress || '192.168.1.x'}</td>
                            <td className="p-3 font-sans text-slate-500">{cam.location}</td>
                            <td className={`p-3 text-[11px] select-all truncate max-w-[600px] ${
                              isDarkMode ? 'text-slate-400' : 'text-slate-600'
                            }`} title={finalWHEPUrl}>
                              {finalWHEPUrl}
                            </td>
                          </tr>
                        );
                      }))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Google Sheets Integration Card */}
              <div className={`p-5 border rounded-xl space-y-4 transition-colors ${
                isDarkMode ? 'bg-slate-900/60 border-slate-900 text-white' : 'bg-white border-sky-100/70 text-slate-800 shadow-sm'
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-bold flex items-center gap-2 font-sans">
                    <Database className={`w-5 h-5 ${isDarkMode ? 'text-indigo-400' : 'text-blue-600'}`} />
                    <span>การเชื่อมประสานบัญชี Google Sheets (Cloud Configuration Sync)</span>
                  </h3>
                  {googleUser && (
                    <span className="text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full py-0.5 px-2.5">
                      ลงชื่อเข้าใช้งานแล้ว: {googleUser.displayName || googleUser.email}
                    </span>
                  )}
                </div>

                <div className={`p-4 rounded-xl border space-y-4 ${isDarkMode ? 'bg-slate-950/70 border-slate-850' : 'bg-sky-50/20 border-sky-100'}`}>
                  {/* Sheet ID Customizer Input */}
                  <div className="space-y-2">
                    <label className={`block text-xs font-bold font-sans ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      ระบุคีย์ Google Spreadsheet ID ที่ต้องการใช้งาน:
                    </label>
                    <div className="flex flex-row gap-2">
                      <input
                        type="text"
                        value={currentSheetId}
                        onChange={(e) => setCurrentSheetId(e.target.value.trim())}
                        placeholder="กรอก Google Spreadsheet ID เช่น 1HlxtltTtl7Mk-i5d-2V9D0uy0..."
                        className={`text-xs p-2.5 rounded-lg border font-mono w-full ${
                          isDarkMode 
                            ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' 
                            : 'bg-white border-slate-200 text-slate-800 focus:border-blue-500'
                        } focus:outline-hidden`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          updateActiveSpreadsheetId(currentSheetId);
                          addLog('success', `อัปเดตและบันทึกคีย์ Spreadsheet ID เป็น: ${currentSheetId} เรียบร้อยแล้ว`);
                          // Trigger reloading readings
                          handleFetchFromGoogleSheet();
                        }}
                        className="text-xs py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-850 text-white font-bold cursor-pointer transition shrink-0"
                      >
                        บันทึกคีย์ ID
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      * หากต้องการเปิดเว็บเครื่องอื่นโดยใช้คีย์ชีตนี้ทันที สามารถแชร์ลิงก์เป็น: <code className="bg-slate-800 text-slate-300 px-1 py-0.5 rounded font-mono select-all">?sheetId={currentSheetId}</code> ต่อท้าย URL เว็บไซต์ได้เลย!
                    </p>
                  </div>

                  <hr className={isDarkMode ? 'border-slate-850' : 'border-slate-200'} />

                  <div className="flex flex-row items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${googleUser ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-400' : 'text-blue-700/80'}`}>สถานะจัดเก็บสตรีม</span>
                      </div>
                      <p className={`text-xs font-semibold font-sans ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{syncStatus}</p>
                      <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500 font-mono">
                        <span className="font-semibold">SHEET ID ปัจจุบัน:</span>
                        <a 
                          href={`https://docs.google.com/spreadsheets/d/${currentSheetId}`} 
                          target="_blank" 
                          referrerPolicy="no-referrer"
                          rel="noopener noreferrer" 
                          className="hover:underline text-indigo-500 font-bold break-all"
                          title="แตะเพื่อเปิดในแท็บใหม่"
                        >
                          {currentSheetId}
                        </a>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!googleUser ? (
                        <button
                          type="button"
                          onClick={handleGoogleLogin}
                          className="text-xs py-2 px-3.5 border rounded-lg cursor-pointer flex items-center gap-2 font-sans font-bold bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-sm active:scale-97 transition"
                        >
                          <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          </svg>
                          <span>กูเกิลคอนเนค (Sign in to Sync)</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={isSyncing}
                            onClick={() => handleFetchFromGoogleSheet()}
                            className={`px-3.5 py-2 text-xs font-bold font-sans rounded-lg transition border flex items-center gap-1.5 cursor-pointer shadow-xs ${
                              isSyncing ? 'opacity-50 cursor-not-allowed' : ''
                            } ${
                              isDarkMode 
                                ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25' 
                                : 'bg-sky-50 border-sky-200 hover:bg-sky-100 text-blue-700'
                            }`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{isSyncing ? 'กำลังดึง...' : 'ดึงข้อมูลจาก Google Sheets'}</span>
                          </button>

                          <button
                            type="button"
                            disabled={isSyncing}
                            onClick={handleSaveToGoogleSheet}
                            className={`px-3.5 py-2 text-xs font-bold font-sans rounded-lg transition border flex items-center gap-1.5 cursor-pointer shadow-xs ${
                              isSyncing ? 'opacity-50 cursor-not-allowed' : ''
                            } ${
                              isDarkMode 
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25' 
                                : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{isSyncing ? 'กำลังบันทึก...' : 'ซิงก์อัปโหลดไป Google Sheets'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleGoogleLogout}
                            className={`px-3 py-2 text-xs font-bold font-sans rounded-lg transition border flex items-center gap-1 cursor-pointer ${
                              isDarkMode 
                                ? 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200' 
                                : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>ออกจากกูเกิล (Log Out)</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Important Instructions Alert Panel */}
                <div className={`p-4 rounded-xl border text-xs space-y-3 font-sans leading-relaxed ${
                  isDarkMode ? 'bg-slate-950/40 border-slate-850/60 text-slate-300' : 'bg-amber-50/20 border-amber-100/50 text-slate-700'
                }`}>
                  <h4 className="font-bold flex items-center gap-1.5 text-amber-600 dark:text-amber-450">
                    <AlertTriangle className="w-4.5 h-4.5" />
                    <span>คำชี้แจงสำคัญเพื่อให้ซิงก์ข้อมูลไปปรากฏบนอุปกรณ์อื่นได้อย่างสมบูรณ์:</span>
                  </h4>
                  <ul className="list-decimal list-inside space-y-2 text-[11px] md:text-xs">
                    <li>
                      <strong className="text-amber-600 dark:text-amber-400">การตั้งค่าสิทธิ์เข้าถึงบน Google Sheet (สำคัญที่สุด)</strong>
                      <p className="pl-4 text-slate-400">
                        หากต้องการให้คนอื่นหรือนำโปรแกรมนี้ไปเปิดบน <span className="font-semibold underline">อุปกรณ์อื่น, แท็บใหม่ หรือโหมด Incognito</span> แล้วเห็นตัวเลขระดับน้ำเรียลไทม์ปรากฏทันทีโดยไม่ต้องกดลงชื่อเข้าใช้ Google บัญชีคุณซ้ำอีกครั้ง <strong>คุณต้องกดปุ่ม "แชร์ (Share)" ที่มุมขวาบนของ Google Sheets แล้วตั้งค่าสิทธิ์ให้เป็น "ทุกคนที่มีลิงก์ (Anyone with the link)" มีสิทธิ์เข้าถึงเป็น "ผู้มีสิทธิ์อ่าน (Viewer)"</strong>
                      </p>
                    </li>
                    <li>
                      <strong className="text-indigo-400 dark:text-indigo-350">เหตุผลที่ต้องแชร์แบบสาธารณะ</strong>
                      <p className="pl-4 text-slate-400">
                        หากชีตถูกตั้งสิทธิ์เป็นแบบส่วนตัวเฉพาะตัวคุณ (Restricted) การดึงข้อมูลออนไลน์เมื่อเปิดใช้จากอุปกรณ์ใหม่จะถูกตรวจพบว่าเป็น "บุคคลทั่วไปภายนอก" และทาง Google API จะบล็อกการดึงข้อมูลทันที การแชร์ชีตเป็นสาธารณะ (สิทธิ์ดูได้อย่างเดียว) จึงจำเป็นอย่างยิ่งในการแสดงผลเรียลไทม์สาธารณะโดยไม่สูญเสียความปลอดภัย (เพราะชีตของคุณไม่มีใครเขียนทับได้ยกเว้นผู้ดูแลระบบที่ลงชื่อเข้าใช้เท่านั้น)
                      </p>
                    </li>
                    <li>
                      <strong className="text-indigo-400 dark:text-indigo-350">การแก้ปัญหากลุ่มคอลัมน์ "เวลา" และ "ชั่วโมง" สลับกัน</strong>
                      <p className="pl-4 text-slate-400">
                        ในระบบล่าสุด เราได้อัปเดตตัวกรองหัวข้ออัจฉริยะ (Smart Column Mapping) ซึ่งจะแยกระหว่างคอลัมน์ <strong>"ชั่วโมงที่ตรวจวัด" (Hour Slot - คอลัมน์ที่ 3)</strong> ออกจากคอลัมน์ <strong>"วันเวลาที่บันทึก" (Recorded At - คอลัมน์ที่ 1)</strong> อย่างเด็ดขาด ทำให้แถวต่างๆ ดึงข้อมูลระดับน้ำมาลงตามช่องชั่วโมง 00:00 - 23:00 ในระบบได้อย่างแม่นยำ ไร้ข้อสลับสับสน
                      </p>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Admin Private Password Section */}
              <div className={`p-5 border rounded-xl space-y-4 transition-colors ${
                isDarkMode ? 'bg-slate-900/60 border-slate-900 text-white' : 'bg-white border-sky-100 text-slate-850'
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold flex items-center gap-2 font-sans">
                    <Key className={`w-5 h-5 ${isDarkMode ? 'text-amber-500' : 'text-blue-600'}`} />
                    <span>จัดการบัญชีผู้ดูแลระบบ (Admin Private Controls)</span>
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-2">
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newPassword || !confirmNewPassword) {
                        setPasswordStatusMessage({ text: 'กรุณากรอกรหัสผ่านใหม่ให้ครบถ้วน', isError: true });
                        return;
                      }
                      if (newPassword.length < 6) {
                        setPasswordStatusMessage({ text: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร', isError: true });
                        return;
                      }
                      if (newPassword !== confirmNewPassword) {
                        setPasswordStatusMessage({ text: 'การยืนยันรหัสผ่านใหม่ไม่ตรงกัน', isError: true });
                        return;
                      }
                      const finalPass = newPassword;
                      setAdminPassword(finalPass);
                      localStorage.setItem('watpuek_admin_password', finalPass);
                      setNewPassword('');
                      setConfirmNewPassword('');
                      setPasswordStatusMessage({ text: 'เปลี่ยนรหัสผ่านผู้ดูแลระบบสำเร็จแล้ว!', isError: false });
                      addLog('success', 'เปลี่ยนรหัสผ่านแอดมินสำหรับความปลอดภัยของระบบกล้องเรียบร้อย');
                      if (googleToken) {
                        saveConfigToGoogleSheet(googleToken, {
                          adminPassword: finalPass,
                          gatewayUrl,
                          selectedQuality
                        }).then(() => {
                          addLog('success', 'อัปเดตและซิงก์รหัสผ่านใหม่เข้าสู่ Google Sheets สำเร็จแล้ว (คีย์ SYSTEM_CONFIG)');
                        }).catch((err) => {
                          addLog('error', `ไม่สามารถซิงก์รหัสผ่านใหม่ไป Google Sheets: ${err.message || err}`);
                        });
                      }
                    }}
                    className="space-y-3.5"
                  >
                    <span className="text-[12px] font-mono tracking-wider uppercase text-slate-500 font-bold block">
                      เปลี่ยนรหัสผ่านเข้าสู่ระบบ (Change Password)
                    </span>

                    <div className="space-y-1">
                      <label className="block text-[12px] font-semibold text-slate-400">รหัสผ่านใหม่ (New Password)</label>
                      <input 
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="กรอกรหัสผ่านใหม่"
                        className={`w-full rounded-lg px-3 py-1.5 text-xs outline-none font-mono ${
                          isDarkMode ? 'bg-slate-950 border border-slate-800 text-slate-200' : 'bg-slate-50 border border-sky-100 text-slate-850'
                        }`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[12px] font-semibold text-slate-400">ยืนยันรหัสผ่านใหม่ (Confirm Password)</label>
                      <input 
                        type="password"
                        required
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง"
                        className={`w-full rounded-lg px-3 py-1.5 text-xs outline-none font-mono ${
                          isDarkMode ? 'bg-slate-950 border border-slate-800 text-slate-200' : 'bg-slate-50 border border-sky-100 text-slate-850'
                        }`}
                      />
                    </div>

                    {passwordStatusMessage && (
                      <p className={`text-[12px] font-sans font-bold py-1 px-2.5 rounded border ${
                        !passwordStatusMessage.isError 
                          ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25' 
                          : 'text-rose-500 bg-rose-500/10 border-rose-500/25'
                      }`}>
                        {passwordStatusMessage.text}
                      </p>
                    )}

                    <button
                      type="submit"
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 border ${
                        isDarkMode 
                          ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-slate-900 hover:text-white' 
                          : 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700'
                      }`}
                    >
                      <Key className="w-4 h-4" />
                      <span>บันทึกรหัสผ่านใหม่</span>
                    </button>
                  </form>

                  <div className="space-y-6 font-sans border-l border-slate-800/25 pl-6">
                    <div className="flex items-center gap-2 border-b border-slate-800/20 pb-2 mb-2">
                      <Settings className="w-5 h-5 text-amber-500" />
                      <span className="text-[14px] font-extrabold tracking-wider uppercase text-amber-500 block leading-none">
                        ตั้งค่าเกตเวย์สตรีมมิ่ง (HLS Streaming Router)
                      </span>
                    </div>

                    {/* MediaMTX Domain Base URL Settings */}
                    <div className="space-y-2">
                      <label className={`block text-[11px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-indigo-400' : 'text-blue-700'}`}>
                        HLS Gateway Server Base URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={gatewayUrl}
                          onChange={(e) => {
                            setGatewayUrl(e.target.value);
                            localStorage.setItem('watpuek_gateway', e.target.value);
                          }}
                          placeholder="https://webrtc.watpuekwater.org"
                          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            isDarkMode ? 'bg-slate-950 border border-slate-800 text-slate-200' : 'bg-slate-50 border border-sky-200 text-slate-850'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setGatewayUrl('https://webrtc.watpuekwater.org');
                            localStorage.setItem('watpuek_gateway', 'https://webrtc.watpuekwater.org');
                            addLog('info', 'คืนค่าเริ่มต้นเซิร์ฟเวอร์ HLS เป็น webrtc.watpuekwater.org');
                          }}
                          className={`p-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer border transition ${
                            isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-blue-50/50 border-blue-200 text-blue-700 hover:bg-blue-50'
                          }`}
                          title="รีเซ็ตเกตเวย์"
                        >
                          รีเซ็ต
                        </button>
                      </div>
                      <p className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        ต้นทางสตรีม MediaMTX ใน Windows ผ่าน Cloudflare Tunnel โดเมนเพื่อความปลอดภัย
                      </p>
                    </div>

                    {/* Quality suffix customization */}
                    <div className="space-y-2">
                      <label className={`block text-[11px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-cyan-400' : 'text-blue-800'}`}>
                        MediaMTX Stream Suffixes (คำต่อท้ายพอร์ต)
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold block mb-1 text-slate-500">Low (480p)</span>
                          <input
                            type="text"
                            value={suffix480p}
                            onChange={(e) => setSuffix480p(e.target.value)}
                            className={`w-full rounded px-2 py-1 text-xs font-mono text-center focus:outline-none ${
                              isDarkMode ? 'bg-slate-950 border border-slate-800 text-slate-300' : 'bg-slate-50 border border-sky-200 text-slate-800'
                            }`}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold block mb-1 text-slate-500">Med (720p)</span>
                          <input
                            type="text"
                            value={suffix720p}
                            onChange={(e) => setSuffix720p(e.target.value)}
                            className={`w-full rounded px-2 py-1 text-xs font-mono text-center focus:outline-none ${
                              isDarkMode ? 'bg-slate-950 border border-slate-800 text-slate-300' : 'bg-slate-50 border border-sky-200 text-slate-800'
                            }`}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold block mb-1 text-slate-500">High (1080p)</span>
                          <input
                            type="text"
                            value={suffix1080p}
                            onChange={(e) => setSuffix1080p(e.target.value)}
                            className={`w-full rounded px-2 py-1 text-xs font-mono text-center focus:outline-none ${
                              isDarkMode ? 'bg-slate-950 border border-slate-800 text-slate-300' : 'bg-slate-50 border border-sky-200 text-slate-800'
                            }`}
                          />
                        </div>
                      </div>
                      <p className={`text-[10px] leading-relaxed mt-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        ตัวอย่าง: cam1_480p สำหรับ SD และ cam1_1080p สำหรับ Full HD
                      </p>
                    </div>

                    {/* Google Apps Script Integration URL Setting */}
                    <div className="space-y-2 pt-2 border-t border-slate-700/10">
                      <label className={`block text-[11px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                        Google Apps Script Web App API URL (เชื่อมต่อตรงโดยไม่ต้องล็อกอิน)
                      </label>
                      <input
                        type="text"
                        value={appsScriptUrl}
                        onChange={(e) => {
                          setAppsScriptUrl(e.target.value);
                          localStorage.setItem('watpuek_apps_script_url', e.target.value);
                        }}
                        placeholder="https://script.google.com/macros/s/.../exec"
                        className={`w-full rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                          isDarkMode ? 'bg-slate-950 border border-slate-800 text-slate-200' : 'bg-slate-50 border border-sky-200 text-slate-850'
                        }`}
                      />
                      <p className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        ยูอาร์แอลเว็บแอปของระบบ Apps Script ของท่าน เพื่อใช้ส่งข้อมูลบันทึกลง Google Sheet ประจำชั่วโมงทันทีโดยไม่ผ่านหน้าล็อกอิน (Direct HTTP POST)
                      </p>
                    </div>

                    {/* Hourly Auto scan toggle (Migrated/disabled since controlled by Apps Script) */}
                    <div className="space-y-2 pt-2 border-t border-slate-700/10">
                      <label className={`block text-[11px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        ระบบบันทึกรายชั่วโมงอัตโนมัติ (Hourly Auto Sync)
                      </label>
                      <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                        isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-800'
                      }`}>
                        ⚙️ <strong>ปิดระบบส่งข้อมูลซ้ำซ้อนจากหน้าเว็บแล้ว:</strong> ระบบการตรวจวัดและอัปเดตค่าระดับน้ำรายชั่วโมงได้ถูกตั้งค่าให้ทำงานผ่าน Apps Script เบื้องหลัง (Background Apps Script Triggers) โดยอัตโนมัติเรียบร้อยแล้ว จึงตัดการทำงานฝั่งผู้ใช้เพื่อความเสถียรและประหยัดทรัพยากร
                      </div>
                    </div>

                    {/* Today Sheet Auto-reload Interval setting */}
                    <div className="space-y-2 pt-2 border-t border-slate-700/10">
                      <div className="flex items-center justify-between">
                        <label className={`block text-[11px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-cyan-400' : 'text-blue-700'}`}>
                          ตั้งเวลาดาวน์โหลดประวัติน้ำรายชั่วโมงจาก Google Sheet อัตโนมัติ (Sheet Auto-reload Interval)
                        </label>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={autoFetchInterval}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setAutoFetchInterval(val);
                            localStorage.setItem('watpuek_auto_fetch_interval', String(val));
                            addLog('info', `ปรับตั้งเวลาอัปโหลดดึงข้อมูลชั่วโมงวันนี้จาก Google Sheet เป็นทุกๆ ${val} นาที`);
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 outline-none ${
                            isDarkMode ? 'bg-slate-950 border border-slate-850 text-slate-200' : 'bg-slate-50 border border-sky-100 text-slate-850'
                          }`}
                        >
                          <option value={1}>1 นาที</option>
                          <option value={2}>2 นาที</option>
                          <option value={3}>3 นาที</option>
                          <option value={5}>5 นาที (ค่าเริ่มต้น)</option>
                          <option value={10}>10 นาที</option>
                          <option value={15}>15 นาที</option>
                          <option value={30}>30 นาที</option>
                          <option value={0}>ปิดการดึงข้อมูลอัตโนมัติ (Manual)</option>
                        </select>
                        <span className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          * ระบบจะเชื่อมโยงดึงค่าผลการวัดล่าสุดจากชีตของวันนี้และซิงก์อัปเดตหน้าจอโดยตรงอัตโนมัติ
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Admin Camera Configuration Section */}
              <div className={`p-5 border rounded-xl space-y-4 transition-colors ${
                isDarkMode ? 'bg-slate-900/60 border-slate-900 text-white' : 'bg-white border-sky-100 text-slate-850'
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-4 font-sans">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Sliders className={`w-5 h-5 ${isDarkMode ? 'text-amber-500' : 'text-blue-600'}`} />
                    <span>บริหารระดับความละเอียด และข้อมูลกล้องแต่ละโซน (HLS / RTSP Imports)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('คุณต้องการรีเซ็ตค่ากลับเป็นค่าเริ่มต้นตามที่ออกแบบไว้ใช่หรือไม่?')) {
                        localStorage.removeItem('watpuek_zones');
                        window.location.reload();
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition border font-sans cursor-pointer ${
                      isDarkMode 
                        ? 'bg-slate-950 border-amber-500/10 hover:border-amber-500/30 text-amber-400 hover:bg-slate-900' 
                        : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    คืนค่าเริ่มต้นความละเอียดพอร์ตเดิม (Reset Default)
                  </button>
                </div>

                {/* ===== ZONE MANAGER ===== */}
                <div className={`border-t pt-6 ${isDarkMode ? 'border-slate-800' : 'border-sky-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className={`text-xs font-extrabold uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Map className="w-4 h-4" />
                      จัดการจุดติดตั้ง / โซนกล้อง
                    </h4>
                    <div className={`text-[11px] flex items-center gap-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                      {lastLocalSaved ? `auto-saved ${lastLocalSaved}` : 'auto-save พร้อม'}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    {/* Left: Zone list */}
                    <div className={`w-52 shrink-0 flex flex-col gap-2`}>
                      {zones.map((zone, zIdx) => (
                        <div
                          key={zone.id}
                          onClick={() => setActiveZoneIndex(zIdx)}
                          className={`group flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                            activeZoneIndex === zIdx
                              ? (isDarkMode ? 'bg-blue-600/15 border-blue-500 text-blue-300' : 'bg-blue-50 border-blue-400 text-blue-800')
                              : (isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700' : 'bg-white border-sky-100 text-slate-600 hover:border-sky-300')
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${activeZoneIndex === zIdx ? 'bg-blue-400' : (isDarkMode ? 'bg-slate-700' : 'bg-slate-300')}`}></span>
                            <span className="text-xs font-semibold truncate">{zone.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>
                              {zone.cams?.length || 0} กล้อง
                            </span>
                            {zones.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteZone(zIdx, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                title="ลบโซนนี้"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Add Zone inline */}
                      <button
                        type="button"
                        onClick={handleAddZone}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed text-xs font-bold transition cursor-pointer ${
                          isDarkMode ? 'border-slate-700 text-slate-500 hover:border-blue-500 hover:text-blue-400' : 'border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-600'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        เพิ่มโซนใหม่
                      </button>
                    </div>

                    {/* Right: Zone detail + cameras */}
                    <div className="flex-1 min-w-0 space-y-4">
                      {/* Zone name */}
                      <div className={`flex items-center gap-3 p-3 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-sky-50/40 border-sky-100'}`}>
                        <label className={`text-xs font-bold shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ชื่อโซน</label>
                        <input
                          type="text"
                          value={zones[activeZoneIndex]?.name || ''}
                          onChange={(e) => {
                            const newZones = [...zones];
                            newZones[activeZoneIndex].name = e.target.value;
                            setZones(newZones);
                          }}
                          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-bold outline-none border ${
                            isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-blue-500' : 'bg-white border-sky-200 text-slate-800 focus:border-blue-400'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={handleAddCamera}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white transition cursor-pointer shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          เพิ่มกล้อง
                        </button>
                      </div>

                      {/* Camera cards */}
                      {!zones[activeZoneIndex]?.cams?.length ? (
                        <div className={`text-center py-10 border-2 border-dashed rounded-xl text-xs ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-200 text-slate-400'}`}>
                          ยังไม่มีกล้องในโซนนี้ — กด "เพิ่มกล้อง" เพื่อเริ่มต้น
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {zones[activeZoneIndex].cams.map((cam, cIdx) => (
                            <div key={cam.id} className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-sky-100 shadow-sm'}`}>
                              {/* Card header */}
                              <div className={`px-4 py-2.5 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-sky-100'}`}>
                                <div className="flex items-center gap-2">
                                  <CameraIcon className="w-3.5 h-3.5 text-blue-400" />
                                  <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>กล้อง {cIdx + 1}</span>
                                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>{cam.id}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCamera(activeZoneIndex, cIdx)}
                                  className="p-1 rounded text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                  title="ลบกล้องนี้"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {/* Fields */}
                              <div className="p-3 space-y-2.5">
                                {[
                                  { label: 'ชื่อกล้อง (Label)', key: 'label', value: cam.label, placeholder: 'CAM 1' },
                                  { label: 'camPath (MediaMTX)', key: 'camPath', value: cam.camPath, placeholder: 'cam1', mono: true },
                                  { label: 'IP Address (LAN)', key: 'ipAddress', value: cam.ipAddress || '', placeholder: '192.168.1.x', mono: true },
                                  { label: 'สถานที่ติดตั้ง', key: 'location', value: cam.location || '', placeholder: 'บริเวณ...' },
                                ].map(({ label, key, value, placeholder, mono }) => (
                                  <div key={key}>
                                    <label className={`block text-[10px] font-semibold mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{label}</label>
                                    <input
                                      type="text"
                                      value={value}
                                      placeholder={placeholder}
                                      onChange={(e) => {
                                        const newZones = [...zones];
                                        (newZones[activeZoneIndex].cams[cIdx] as any)[key] = e.target.value;
                                        setZones(newZones);
                                      }}
                                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs outline-none border ${mono ? 'font-mono' : ''} ${
                                        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-200 focus:border-blue-500' : 'bg-slate-50 border-sky-200 text-slate-800 focus:border-blue-400'
                                      }`}
                                    />
                                  </div>
                                ))}
                                <div className={`text-[10px] font-mono pt-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                                  HLS: /{cam.camPath}{suffix480p}/index.m3u8
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>{/* end right panel */}
                  </div>{/* end flex gap-4 */}

                  {/* Save bar */}
                  <div className={`flex flex-wrap items-center justify-end gap-2 pt-4 mt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-sky-100'}`}>
                      <div className="flex gap-2 flex-wrap">
                        {/* Export JSON */}
                        <button
                          type="button"
                          onClick={() => {
                            const payload = { zones, gatewayUrl, adminPassword, appsScriptUrl, suffix480p, suffix720p, suffix1080p, exportedAt: new Date().toISOString() };
                            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = `watpuek-settings-${new Date().toISOString().slice(0,10)}.json`;
                            a.click();
                          }}
                          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer border ${
                            isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export JSON</span>
                        </button>
                        {/* Import JSON */}
                        <label className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer border ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Import JSON</span>
                          <input type="file" accept=".json" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              try {
                                const data = JSON.parse(ev.target?.result as string);
                                if (data.zones) setZones(data.zones);
                                if (data.gatewayUrl) setGatewayUrl(data.gatewayUrl);
                                if (data.adminPassword) setAdminPassword(data.adminPassword);
                                if (data.appsScriptUrl) setAppsScriptUrl(data.appsScriptUrl);
                                if (data.suffix480p) setSuffix480p(data.suffix480p);
                                if (data.suffix720p) setSuffix720p(data.suffix720p);
                                if (data.suffix1080p) setSuffix1080p(data.suffix1080p);
                                addLog('success', `นำเข้าการตั้งค่าจากไฟล์ ${file.name} สำเร็จ`);
                              } catch { addLog('error', 'ไฟล์ JSON ไม่ถูกต้อง ไม่สามารถนำเข้าได้'); }
                            };
                            reader.readAsText(file);
                            e.target.value = '';
                          }} />
                        </label>
                        {/* Sync to Cloud */}
                        <button
                          type="button"
                          onClick={() => handleSaveToGoogleSheet()}
                          className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
                        >
                          <Save className="w-3.5 h-3.5 text-slate-900" />
                          <span>Sync ขึ้น Google Sheets</span>
                        </button>
                      </div>
                    </div>{/* end save bar */}
                </div>{/* end zone manager */}
              </div>{/* end gateway settings card */}

              {/* Logger & Subsystem controllers inside Admin Panel */}
              <div className="pt-4 border-t border-slate-950">
                <div className="flex items-center justify-between mb-3 text-xs font-semibold tracking-wider text-slate-400 uppercase font-mono">
                  <span>ล็อกระบบ และเกตเวย์เชื่อมประสานงาน (SYSTEM GATEWAY LOGGER)</span>
                  <span className="text-xs text-slate-500 hover:text-slate-300 transition cursor-pointer font-sans" onClick={() => addLog('info', 'ส่งคำร้องขอ Ping สัญญาณผ่าน Tailscale IP Mesh...')}>
                    คลิกเพื่อทดสอบ Ping เครือข่าย
                  </span>
                </div>
                <DiagnosticConsole 
                  logs={logs} 
                  onClearLogs={clearSnapshots}
                  serverUrl={gatewayUrl}
                />
              </div>
            </motion.div>
            )}
          </div>
          )}
        </div>

      {/* 2. FOCUS WINDOW/ZONE OVERLAY MODAL */}
      <AnimatePresence>
        {isFocusModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl"
            onClick={() => setIsFocusModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-8"
            >
              {/* Card กล้อง — กึ่งกลางทั้งบนล่างและซ้ายขวา */}
              <div className={`rounded-3xl overflow-hidden shadow-2xl flex flex-col ${
                isDarkMode ? 'bg-slate-900/95 ring-1 ring-slate-700/60' : 'bg-white/95 ring-1 ring-sky-200/80'
              }`} style={{ width: '90%' }}>

                {/* Header */}
                <div className={`px-5 flex items-center justify-center ${
                  isDarkMode ? 'bg-slate-950/80' : 'bg-sky-50/80'
                }`} style={{ paddingTop: 'clamp(16px, 4vmin, 32px)', paddingBottom: 'clamp(16px, 4vmin, 32px)' }}>
                  <div className="flex items-center gap-3">
                    <span className="relative flex" style={{ width: 'clamp(16px, 3vmin, 22px)', height: 'clamp(16px, 3vmin, 22px)' }}>
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDarkMode ? 'bg-cyan-400' : 'bg-blue-500'}`}></span>
                      <span className={`relative inline-flex rounded-full h-full w-full ${isDarkMode ? 'bg-cyan-500' : 'bg-blue-600'}`}></span>
                    </span>
                    <h3
                      className={`font-black tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-blue-950'} text-[270px] sm:text-[48px]`}
                    >
                      {zones[activeZoneIndex]?.name}
                    </h3>
                  </div>
                </div>

                {/* กล้อง — มือถือแนวตั้ง, desktop แนวนอน */}
                <div className="flex flex-col sm:flex-row">
                  {zones[activeZoneIndex]?.cams.map((cam, camIdx) => {
                    const whepUrl = generateWHEPUrl(cam.camPath, selectedQuality);
                    const isLastCam = camIdx === (zones[activeZoneIndex]?.cams.length ?? 0) - 1;
                    return (
                      <div key={cam.id} className="flex-1 flex flex-col bg-slate-950">
                        <div className="w-full aspect-video">
                          <CameraStream
                            camera={cam}
                            url={whepUrl}
                            isExpanded={true}
                            onLog={(log) => addLog(log.type, log.message, log.camId)}
                            onSnapshotRecorded={handleSnapshotRecorded}
                            onStatusChange={(status) => handleCameraStatusChange(cam.id, status)}
                          />
                        </div>

                        {/* AI shortcut */}
                        {isAdminLoggedIn && isLastCam && (
                          <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
                            <span className="text-xs font-black text-cyan-400 flex items-center gap-1">
                              <Cpu className="w-3.5 h-3.5 animate-pulse" />
                              วิเคราะห์ระดับน้ำอัตโนมัติ
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setIsFocusModalOpen(false);
                                setSelectedAiCamId(cam.id);
                                setActiveTab('ai');
                                handleAiAnalyze(cam.id);
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-extrabold cursor-pointer transition"
                            >
                              ตรวจระดับน้ำ AI 🔍
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ปุ่มปิด — อยู่ใต้ card */}
                <div className={`flex items-center justify-center ${
                  isDarkMode ? 'bg-slate-950/60' : 'bg-sky-50/60'
                }`} style={{ padding: 'clamp(16px, 4vmin, 32px)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFocusModalOpen(false);
                      addLog('info', 'ปิดหน้าต่างวิดีโอ');
                    }}
                    style={{
                      width: '80%',
                    }}
                    className="rounded-2xl font-black bg-rose-600 hover:bg-rose-500 active:scale-95 text-white transition-all shadow-xl cursor-pointer text-[270px] sm:text-[32px] py-[40px] sm:py-[18px]"
                  >
                    ✕ ปิด
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
{isCam501Admin && (
  <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md`}>
    <div className={`w-full max-w-xl rounded-2xl border shadow-2xl p-6 space-y-4 ${
      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-sky-100'
    }`}>
      <h2 className={`text-xl font-black ${isDarkMode ? 'text-slate-100' : 'text-blue-950'}`}>
        จัดการ CAM 501
      </h2>

      {/* Toggle Live / ภาพนิ่ง */}
      <div className="flex items-center gap-4">
        <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
          โหมดแสดงผล:
        </span>
        <button
          onClick={() => setCam501UseSnapshot(false)}
          className={`px-4 py-2 rounded-lg text-sm font-bold border transition cursor-pointer ${
            !cam501UseSnapshot
              ? 'bg-blue-600 text-white border-blue-600'
              : (isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600')
          }`}
        >
          🎥 Live Stream
        </button>
        <button
          onClick={() => setCam501UseSnapshot(true)}
          className={`px-4 py-2 rounded-lg text-sm font-bold border transition cursor-pointer ${
            cam501UseSnapshot
              ? 'bg-amber-500 text-slate-950 border-amber-500'
              : (isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600')
          }`}
        >
          📷 ภาพนิ่ง
        </button>
      </div>

      {/* ถ้าเลือกภาพนิ่ง ให้ใส่ URL */}
      {cam501UseSnapshot && (
        <div className="space-y-2">
          <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            URL ภาพนิ่ง (Snapshot URL)
          </label>
          <input
            type="text"
            value={cam501SnapshotUrl}
            onChange={(e) => setCam501SnapshotUrl(e.target.value)}
            placeholder="https://cam.watpuekwater.org/api/snapshot/cam501?secret=..."
            className={`w-full rounded-lg px-3 py-2 text-xs font-mono border outline-none ${
              isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-sky-200 text-slate-800'
            }`}
          />
          {cam501SnapshotUrl && (
            <img src={cam501SnapshotUrl} alt="cam501 snapshot" className="w-full rounded-lg border border-slate-200" />
          )}
        </div>
      )}

      <button
        onClick={() => setIsCam501Admin(false)}
        className="w-full py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm cursor-pointer"
      >
        ปิด
      </button>
    </div>
  </div>
)}
      </main>

      {/* FOOTER DEVELOPMENT SIGNATURE */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-6 mt-12 text-center text-xs text-slate-500 font-mono space-y-1.5">
        <div>
          วัดปึก แจ้งระดับน้ำ © {new Date().getFullYear()} — cam.watpuekwater.org/
        </div>
        <div className="text-[10px] text-slate-600 max-w-xl mx-auto leading-relaxed">
          วัดปึก ตำบลวังแซ้ม อำเภอมะขาม จังหวัดจันทบุรี
        </div>
      </footer>
    </div>
  );
}