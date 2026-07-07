import express from "express";
import path from "path";
import dotenv from "dotenv";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
const execFileAsync = promisify(execFile);
import { tmpdir } from "os";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { createProxyMiddleware } from "http-proxy-middleware";

dotenv.config();

const GEMINI_PRIMARY = "gemini-2.5-flash";
const GEMINI_FALLBACK = "gemini-3.1-flash-lite";

const WATER_PROMPT = `You are an expert AI Water Level Assistant for 'วัดปึก แจ้งระดับน้ำ'. Analyze this CCTV picture of a water level staff gauge in a canal.
CRITICAL RULES:
1. Scan ALL visible numbers on the gauge from top to bottom of image
2. List every number you can see completely
3. The BOTTOM EDGE of the image acts as a CUT LINE - any number partially cut by bottom edge is INCOMPLETE
4. A number is COMPLETE only if ALL its digits (including decimal point) are fully visible
5. From all COMPLETE numbers found, select the LOWEST value as the water level
6. Example: visible complete numbers are [4.85, 4.84, 4.83, 4.82, 4.81] → ANSWER IS 4.81 (lowest)
7. ถ้าเห็นเลขมาตรวัดแต่ไม่พบระดับน้ำ ให้ยึดเลขล่างสุด
8. Always list ALL detected numbers in detectedMarkings field
Return ONLY JSON (no markdown):
{"waterLevel":4.81,"confidence":0.95,"gaugeFound":true,"readStatus":"เฝ้าระวัง","explanation":"...","detectedMarkings":["4.81","4.82","4.83","4.84","4.85"]}
readStatus: <4.10="ระดับปกติ", 4.10-4.35="เฝ้าระวัง", >4.35="วิกฤต"`;

// ─── Local data storage ───────────────────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), 'data');
const READINGS_FILE = path.join(DATA_DIR, 'readings.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const FILL_LOG_FILE = path.join(DATA_DIR, 'fill-log.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(READINGS_FILE)) fs.writeFileSync(READINGS_FILE, JSON.stringify([]));
if (!fs.existsSync(FILL_LOG_FILE)) fs.writeFileSync(FILL_LOG_FILE, JSON.stringify([]));
if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, JSON.stringify({
  gatewayUrl: 'https://webrtc.watpuekwater.org',
  adminPassword: '12345678',
  selectedQuality: '480p',
}));

interface Reading {
  id: string;
  zoneName: string;
  camLabel: string;
  waterLevel: number;
  readStatus: string;
  confidence: number;
  explanation: string;
  hour: string;
  dateStr: string;
  recordedAt: string;
}

interface FillLogEntry {
  id: string;
  timestamp: string;      // ISO string เวลาที่ทำการเติม
  camLabel: string;
  zoneName: string;
  hour: string;           // ชั่วโมงที่พยายามเติม เช่น "14:00"
  dateStr: string;        // วันที่ของชั่วโมงที่พยายามเติม
  success: boolean;
  waterLevel: number | null;
  message: string;        // สรุปผลลัพธ์หรือ error
}

function readReadings(): Reading[] {
  try { return JSON.parse(fs.readFileSync(READINGS_FILE, 'utf-8')); } catch { return []; }
}

function saveReadings(readings: Reading[]) {
  fs.writeFileSync(READINGS_FILE, JSON.stringify(readings, null, 2), 'utf8');
}

function readFillLog(): FillLogEntry[] {
  try { return JSON.parse(fs.readFileSync(FILL_LOG_FILE, 'utf-8')); } catch { return []; }
}

function saveFillLog(entries: FillLogEntry[]) {
  fs.writeFileSync(FILL_LOG_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

// เพิ่ม log รายการใหม่ + ตัดรายการที่เก่ากว่า 30 วันทิ้งอัตโนมัติ
function addFillLogEntry(entry: Omit<FillLogEntry, 'id' | 'timestamp'>) {
  const log = readFillLog();
  const newEntry: FillLogEntry = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  log.unshift(newEntry);

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const trimmed = log.filter(e => new Date(e.timestamp).getTime() >= cutoff);

  saveFillLog(trimmed);
  return newEntry;
}

function readConfig(): any {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); } catch { return {}; }
}

function saveConfig(config: any) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

// ─── Chat storage ─────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  name: string;
  text: string;
  time: string;
}

const chatMessages: ChatMessage[] = [];
const MAX_MESSAGES = 200;
const wsClients = new Set<WebSocket>();

async function geminiOCR(ai: GoogleGenAI, imagePart: any): Promise<any> {
  try {
    const r = await ai.models.generateContent({
      model: GEMINI_PRIMARY,
      contents: [imagePart, WATER_PROMPT],
    });
    return JSON.parse((r.text || "{}").replace(/```json|```/g, "").trim());
  } catch {
    const r = await ai.models.generateContent({
      model: GEMINI_FALLBACK,
      contents: [imagePart, WATER_PROMPT],
    });
    return JSON.parse((r.text || "{}").replace(/```json|```/g, "").trim());
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);

  // ─── WebSocket server ──────────────────────────────────────────────────────
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/chat" });

  const broadcastOnline = () => {
    const count = wsClients.size;
    const payload = JSON.stringify({ type: "online", count });
    wsClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
  };

  wss.on("connection", (ws) => {
    wsClients.add(ws);
    broadcastOnline();
    ws.send(JSON.stringify({ type: "history", messages: chatMessages.slice(-50) }));

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { name: string; text: string };
        if (!msg.name || !msg.text || msg.text.trim().length === 0) return;
        const newMsg: ChatMessage = {
          id: Date.now().toString(),
          name: msg.name.trim().slice(0, 20),
          text: msg.text.trim().slice(0, 300),
          time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        };
        chatMessages.push(newMsg);
        if (chatMessages.length > MAX_MESSAGES) chatMessages.shift();
        const payload = JSON.stringify({ type: "message", message: newMsg });
        wsClients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) client.send(payload);
        });
      } catch {}
    });

    ws.on("close", () => { wsClients.delete(ws); broadcastOnline(); });
    ws.on("error", () => wsClients.delete(ws));
  });

  // ─── MJPEG proxy ──────────────────────────────────────────────────────────
  app.use('/mjpeg', createProxyMiddleware({
    target: 'http://localhost:3002',
    changeOrigin: true,
    pathRewrite: { '^/mjpeg': '' },
  }));

  // ─── HLS proxy สำหรับ cam501 ──────────────────────────────────────────────
  app.use('/live', createProxyMiddleware({
    target: 'http://localhost:8888',
    changeOrigin: true,
    pathRewrite: { '^/live': '/live' },
  }));

  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ extended: true, limit: "15mb" }));

  // ─── Local readings API ────────────────────────────────────────────────────

  // GET /api/readings — ดึงประวัติทั้งหมด (รองรับ filter วันที่และโซน)
  app.get("/api/readings", (req, res) => {
    try {
      let readings = readReadings();
      const { zone, date, limit } = req.query;
      if (zone) readings = readings.filter(r => r.zoneName === zone);
      if (date) readings = readings.filter(r => r.dateStr === date || r.recordedAt?.includes(date as string));
      if (limit) readings = readings.slice(-Number(limit));
      res.json(readings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/fill-log — ดึง log การเติมค่าจาก snapshot (เก็บย้อนหลัง 30 วัน)
  app.get("/api/fill-log", (req, res) => {
    try {
      let log = readFillLog();
      const { camLabel, success, limit } = req.query;
      if (camLabel) log = log.filter(e => e.camLabel === camLabel);
      if (success === 'true') log = log.filter(e => e.success === true);
      if (success === 'false') log = log.filter(e => e.success === false);
      if (limit) log = log.slice(0, Number(limit));
      res.json(log);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/run-fill-job — รัน fill job แบบ manual พร้อม stream log กลับมา (Server-Sent Events)
  app.post("/api/run-fill-job", async (req, res) => {
    const { hoursBack = 72, targetCam = '', targetHour = '', targetDate = '' } = req.body;

    // ตั้งค่า SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (type: string, message: string) => {
      res.write(`data: ${JSON.stringify({ type, message, time: new Date().toLocaleTimeString('th-TH') })}\n\n`);
    };

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        send('error', 'ไม่พบ GEMINI_API_KEY — ไม่สามารถรัน fill job ได้');
        res.end(); return;
      }

      send('info', `เริ่มรัน fill job ย้อนหลัง ${hoursBack} ชั่วโมง...`);

      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
      const pad = (n: number) => String(n).padStart(2, '0');
      let targetCams = getTargetCams();
      if (targetCam) targetCams = targetCams.filter((c: any) => c.camLabel === targetCam);

      send('info', `กล้องที่ตรวจสอบ: ${targetCams.map((c: any) => c.camLabel).join(', ')}`);

      // ฟังก์ชันหา snapshot ที่ดีที่สุด (copy มาจาก findBestSnapshotInHour ที่อยู่ใน startServer scope)
      const findSnapshot = (camId: string, hourDate: Date, nowActual: Date): { path: string; minute: number } | null => {
        const p = (n: number) => String(n).padStart(2, '0');
        const ds = `${hourDate.getFullYear()}-${p(hourDate.getMonth()+1)}-${p(hourDate.getDate())}`;
        const zeroDir = path.join(DATA_DIR, 'snapshots', ds, `${p(hourDate.getHours())}-00`);
        const zeroPath = path.join(zeroDir, `${camId}.jpg`);
        if (fs.existsSync(zeroPath)) return { path: zeroPath, minute: 0 };
        const sameHour = hourDate.getHours() === nowActual.getHours() &&
          hourDate.toDateString() === nowActual.toDateString();
        const maxMinute = sameHour ? Math.floor(nowActual.getMinutes() / 5) * 5 : 55;
        for (let m = maxMinute; m >= 5; m -= 5) {
          const candidateDate = new Date(hourDate);
          candidateDate.setMinutes(m);
          const mDir = path.join(DATA_DIR, 'snapshots', ds, `${p(hourDate.getHours())}-${p(m)}`);
          const mPath = path.join(mDir, `${camId}.jpg`);
          if (fs.existsSync(mPath)) return { path: mPath, minute: m };
        }
        return null;
      };

      // debug: แสดง path ตัวอย่างที่จะไปหา (ชั่วโมงล่าสุด, กล้องแรก)
      if (targetCams.length > 0) {
        const p2 = (n: number) => String(n).padStart(2, '0');
        const ds = `${now.getFullYear()}-${p2(now.getMonth()+1)}-${p2(now.getDate())}`;
        const samplePath = path.join(DATA_DIR, 'snapshots', ds, `${p2(now.getHours())}-00`, `${targetCams[0].camId}.jpg`);
        send('info', `[debug] ตัวอย่าง path ที่ค้นหา: ${samplePath} → ${fs.existsSync(samplePath) ? 'พบ' : 'ไม่พบ'}`);
        send('info', `[debug] SNAPSHOT_DIR = ${path.join(DATA_DIR, 'snapshots')}`);
      }

      const readings = readReadings();
      send('info', `[debug] readings.json: ${readings.length} records จาก ${path.join(process.cwd(), 'data', 'readings.json')}`);
      const gaps: { cam: any; checkDate: Date; hourStr: string; snapshotPath: string; snapshotMinute: number }[] = [];

      send('info', `พบ ${targetCams.length} กล้อง, กำลังสแกน ${hoursBack} ชั่วโมงย้อนหลัง...`);

      let debugNoSnapshot = 0;
      let debugHasReading = 0;

      for (const cam of targetCams) {
        for (let h = 0; h < hoursBack; h++) {
          const checkDate = new Date(now.getTime() - h * 60 * 60 * 1000);
          const hourStr = `${pad(checkDate.getHours())}:00`;
          // กรองเฉพาะชั่วโมง/วันที่ที่ระบุ (สำหรับกดเติมรายชั่วโมงเดียว)
          if (targetHour && hourStr !== targetHour) continue;
          if (targetDate) {
            const cellDate = `${checkDate.getFullYear()}-${pad(checkDate.getMonth()+1)}-${pad(checkDate.getDate())}`;
            if (cellDate !== targetDate) continue;
          }
          // เช็ควันที่ด้วย โดยใช้ recordedAt format "DD/MM/YYYY" (คริสต์ศักราช)
          const datePrefix = `${pad(checkDate.getDate())}/${pad(checkDate.getMonth()+1)}/${checkDate.getFullYear()}`;
          const hasReading = readings.some((r: any) =>
            r.camLabel === cam.camLabel &&
            r.hour === hourStr &&
            r.waterLevel != null &&
            (r.recordedAt || '').startsWith(datePrefix)
          );
          if (hasReading) { debugHasReading++; continue; }

          const found = findSnapshot(cam.camId, checkDate, now);
          if (!found) { debugNoSnapshot++; continue; }

          gaps.push({ cam, checkDate, hourStr, snapshotPath: found.path, snapshotMinute: found.minute });
        }
      }

      send('info', `สแกนเสร็จ: มีข้อมูลแล้ว ${debugHasReading} รายการ, ไม่มี snapshot ${debugNoSnapshot} รายการ, พบช่องว่าง ${gaps.length} รายการ`);

      if (gaps.length === 0) {
        send('success', `✅ ไม่พบช่องว่างที่ต้องเติม — ข้อมูลครบถ้วนทุกชั่วโมงในช่วง ${hoursBack} ชั่วโมงที่ผ่านมา`);
        res.end(); return;
      }

      send('info', `พบช่องว่าง ${gaps.length} รายการ กำลังเติมค่า...`);

      let filledCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      for (const { cam, checkDate, hourStr, snapshotPath, snapshotMinute } of gaps) {
        send('info', `🔍 ${cam.camLabel} ${pad(checkDate.getDate())}/${pad(checkDate.getMonth()+1)} ${hourStr} — อ่านจาก snapshot นาที ${pad(snapshotMinute)}`);
        const thaiMonths = ['มก.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
        const dateStr = `${checkDate.getDate()} ${thaiMonths[checkDate.getMonth()]}`;
        const recordedAt = `${pad(checkDate.getDate())}/${pad(checkDate.getMonth()+1)}/${checkDate.getFullYear()+543} ${hourStr}:00`;

        let ocrResult: any = null;
        let retries = 0;
        const maxRetries = 5;

        while (retries <= maxRetries) {
          try {
            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
            const imgBuf = fs.readFileSync(snapshotPath);
            const imagePart = { inlineData: { mimeType: 'image/jpeg', data: imgBuf.toString('base64') } };
            ocrResult = await geminiOCR(ai, imagePart);
            break; // สำเร็จแล้ว ออกจาก loop
          } catch (e: any) {
            const msg = e.message || '';
            // Gemini error อาจเป็น JSON string — ลอง parse ก่อน
            let retryDelaySec = 0;
            try {
              const parsed = JSON.parse(msg);
              const retryInfo = parsed?.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'));
              if (retryInfo?.retryDelay) {
                retryDelaySec = parseInt(retryInfo.retryDelay) || 0;
              }
            } catch {
              // ไม่ใช่ JSON ลอง regex แทน
              const retryMatch = msg.match(/retry[^\d]*(\d+(?:\.\d+)?)s/i);
              if (retryMatch) retryDelaySec = Math.ceil(parseFloat(retryMatch[1]));
            }

            if (retryDelaySec > 0 && retries < maxRetries) {
              const waitSec = retryDelaySec + 2;
              retries++;
              send('warn', `⏳ Rate limit (429) — รอ ${waitSec} วินาที แล้วลองใหม่ (${retries}/${maxRetries})...`);
              await new Promise(r => setTimeout(r, waitSec * 1000));
              await new Promise(r => setTimeout(r, waitSec * 1000));
            } else {
              // error อื่นหรือเกิน retry
              addFillLogEntry({ camLabel: cam.camLabel, zoneName: cam.zoneName, hour: hourStr, dateStr, success: false, waterLevel: null, message: `error: ${e.message}` });
              send('error', `❌ ${cam.camLabel} ${hourStr}: ${e.message}`);
              errorCount++;
              ocrResult = null;
              break;
            }
          }
        }

        if (ocrResult !== null) {
          if (ocrResult.waterLevel != null) {
            const reading = {
              id: Date.now().toString(),
              zoneName: cam.zoneName, camLabel: cam.camLabel,
              waterLevel: ocrResult.waterLevel, readStatus: ocrResult.readStatus || '',
              explanation: ocrResult.explanation || '', confidence: ocrResult.confidence || 0,
              hour: hourStr, dateStr, recordedAt, fromSnapshot: true,
            };
            const all = readReadings();
            all.unshift(reading);
            saveReadings(all);
            addFillLogEntry({ camLabel: cam.camLabel, zoneName: cam.zoneName, hour: hourStr, dateStr, success: true, waterLevel: ocrResult.waterLevel, message: `เติมค่าสำเร็จ ${ocrResult.waterLevel} ม.` });
            send('success', `✅ ${cam.camLabel} ${hourStr}: ${ocrResult.waterLevel.toFixed(2)} ม. (${ocrResult.readStatus || 'N/A'})`);
            filledCount++;
          } else {
            addFillLogEntry({ camLabel: cam.camLabel, zoneName: cam.zoneName, hour: hourStr, dateStr, success: false, waterLevel: null, message: 'AI อ่านค่าไม่ได้' });
            send('warn', `⚠️ ${cam.camLabel} ${hourStr}: AI อ่านค่าจากภาพไม่ได้`);
            skipCount++;
          }
        }
        // delay ระหว่าง request เพื่อไม่ให้ยิง API เร็วเกินไป (15 req/min = ~4 วิ/req)
        await new Promise(r => setTimeout(r, 4000));
      }

      send('success', `🎉 เสร็จสิ้น — เติมสำเร็จ ${filledCount} รายการ, อ่านไม่ได้ ${skipCount} รายการ, error ${errorCount} รายการ`);
    } catch (err: any) {
      send('error', `❌ Error: ${err.message}`);
    }
    res.end();
  });

  // POST /api/readings — บันทึกระดับน้ำใหม่
  app.post("/api/readings", (req, res) => {
    try {
      const secret = req.query.secret || req.body.secret;
      const systemSecret = process.env.CRON_SECRET || "watpuek_cloud_sync_secret";
      if (secret && secret !== systemSecret) return res.status(401).json({ error: "Unauthorized" });

      const reading: Reading = {
        id: Date.now().toString(),
        zoneName: req.body.zoneName || "",
        camLabel: req.body.camLabel || "",
        waterLevel: Number(req.body.waterLevel) || 0,
        readStatus: req.body.readStatus || "",
        confidence: Number(req.body.confidence) || 0,
        explanation: req.body.explanation || "",
        hour: req.body.hour || "",
        dateStr: req.body.dateStr || "",
        recordedAt: req.body.recordedAt || new Date().toLocaleString("th-TH"),
      };

      const readings = readReadings();
      readings.push(reading);
      // เก็บแค่ 10000 รายการล่าสุด
      if (readings.length > 10000) readings.splice(0, readings.length - 10000);
      saveReadings(readings);
      res.json({ status: "success", id: reading.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/readings/:id — ลบรายการ
  app.delete("/api/readings/:id", (req, res) => {
    try {
      const readings = readReadings().filter(r => r.id !== req.params.id);
      saveReadings(readings);
      res.json({ status: "success" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/readings — ลบทั้งหมด
  app.delete("/api/readings", (req, res) => {
    try {
      saveReadings([]);
      res.json({ status: "success" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/backup-to-sheet — proxy ส่งข้อมูลไป Apps Script
  const APPS_SCRIPT_BACKUP_URL = 'https://script.google.com/macros/s/AKfycbyoTwp5gjPx-prtPTE0-YwST8MRanodYIOyqLi-YGp6XXzt3vPacY5FpGoyn1lfMYZq3Q/exec';
  app.post('/api/backup-to-sheet', async (_req, res) => {
    try {
      const readings = readReadings();
      const rows = readings.map(r => [
        r.recordedAt || r.dateStr || '',
        r.dateStr || '',
        r.hour || '',
        r.zoneName || '',
        r.camLabel || '',
        r.waterLevel != null ? r.waterLevel : '',
        r.readStatus || '',
        r.confidence ? (Number(r.confidence) * 100).toFixed(0) + '%' : '',
        r.explanation || ''
      ]);
      const response = await fetch(APPS_SCRIPT_BACKUP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ type: 'backup', rows })
      });
      const result = await response.json();
      console.log('[Backup] Apps Script response:', result);
      res.json({ status: 'success', count: rows.length, result });
    } catch (err: any) {
      console.error('[Backup] error:', err.message);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // GET /api/config — ดึง config
  app.get("/api/config", (_req, res) => {
    res.json(readConfig());
  });

  // POST /api/config — บันทึก config
  app.post("/api/config", (req, res) => {
    try {
      const current = readConfig();
      saveConfig({ ...current, ...req.body });
      res.json({ status: "success" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/zones — ดึง zones ทั้งหมด (ถ้าไม่มีใน config ส่ง null ให้ App.tsx ใช้ INITIAL_ZONES แทน)
  app.get("/api/zones", (_req, res) => {
    try {
      const cfg = readConfig();
      res.json({ zones: cfg.zones || null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/zones — บันทึก zones ทั้งหมด
  app.post("/api/zones", (req, res) => {
    try {
      const { zones } = req.body;
      if (!Array.isArray(zones)) return res.status(400).json({ error: "zones must be an array" });
      const current = readConfig();
      saveConfig({ ...current, zones });
      res.json({ status: "success" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── OCR endpoint ──────────────────────────────────────────────────────────
  app.post("/api/ocr-water-level", async (req, res) => {
    try {
      const { imageUrl, imageBase64, mimeType } = req.body;
      if (!imageUrl && !imageBase64) {
        return res.status(400).json({ error: "Please provide either imageUrl or imageBase64" });
      }
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(400).json({ error: "GEMINI_API_KEY_MISSING" });
      }
      const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
      let imagePart: any;
      if (imageBase64) {
        imagePart = { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64.replace(/^data:image\/\w+;base64,/, "") } };
      } else {
        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) throw new Error(`ดึงภาพไม่ได้: ${imageRes.status}`);
        imagePart = { inlineData: { mimeType: imageRes.headers.get("content-type") || "image/jpeg", data: Buffer.from(await imageRes.arrayBuffer()).toString("base64") } };
      }
      res.json(await geminiOCR(ai, imagePart));
    } catch (err: any) {
      res.status(500).json({ error: "SERVICE_ERROR", message: err.message });
    }
  });

  // ─── Snapshot file server — serve ไฟล์ภาพ snapshot โดยตรง ──────────────────
  app.get("/api/snapshot-file/:date/:hourMin/:camId", (req, res) => {
    try {
      const { date, hourMin, camId } = req.params;
      const SNAP_DIR = path.join(DATA_DIR, 'snapshots');
      const filePath = path.join(SNAP_DIR, date, hourMin, camId);
      // ป้องกัน path traversal
      if (!filePath.startsWith(SNAP_DIR)) return res.status(403).end();
      if (!fs.existsSync(filePath)) return res.status(404).end();
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      fs.createReadStream(filePath).pipe(res);
    } catch (err: any) {
      res.status(500).end();
    }
  });

  // ─── Snapshot endpoint ────────────────────────────────────────────────────
  app.get("/api/snapshot/:camId", async (req, res) => {
    try {
      const secret = req.query.secret as string;
      const systemSecret = process.env.CRON_SECRET || "watpuek_cloud_sync_secret";
      if (secret !== systemSecret) return res.status(401).json({ error: "Unauthorized" });

      const camId = req.params.camId;
      const camPath = (req.query.camPath as string) || `${camId}_480p`;
      const mediamtxBase = process.env.MEDIAMTX_URL || "http://localhost:8888";
      const hlsUrl = `${mediamtxBase}/${camPath}/index.m3u8`;
      const outPath = `${tmpdir()}/snap_${camId}_${Date.now()}.jpg`;
      const isWin = process.platform === "win32";
      const ffmpegCmd = isWin ? "C:\\ffmpeg\\bin\\ffmpeg.exe" : "ffmpeg";

      // ใช้ execFile แบบ async (ไม่ผ่าน shell, ไม่บล็อก event loop ของ server)
      await execFileAsync(ffmpegCmd, [
        "-y", "-i", hlsUrl,
        "-frames:v", "1",
        "-q:v", "2",
        "-update", "1",
        outPath,
      ], { timeout: 20000 });

      const buf = fs.readFileSync(outPath);
      fs.unlinkSync(outPath);
      res.setHeader("Content-Type", "image/jpeg");
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ error: "SNAPSHOT_FAILED", message: err.message });
    }
  });

  // ─── Hourly scan trigger ──────────────────────────────────────────────────
  app.all("/api/trigger-hourly-scan", async (req, res) => {
    try {
      const secret        = req.query.secret      || req.body.secret;
      const camId         = (req.query.camId      || req.body.camId      || "cam2") as string;
      const camPath       = (req.query.camPath    || req.body.camPath    || `${camId}_480p`) as string;
      const zoneName      = (req.query.zoneName   || req.body.zoneName   || "") as string;
      const camLabel      = (req.query.camLabel   || req.body.camLabel   || camId) as string;

      const systemSecret = process.env.CRON_SECRET || "watpuek_cloud_sync_secret";
      if (!secret || secret !== systemSecret) return res.status(401).json({ status: "unauthorized" });

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") return res.status(400).json({ status: "config_error" });

      const snapshotUrl = `http://localhost:${PORT}/api/snapshot/${camId}?secret=${systemSecret}&camPath=${encodeURIComponent(camPath)}`;
      const imageRes = await fetch(snapshotUrl);
      if (!imageRes.ok) throw new Error(`ดึงภาพไม่ได้: HTTP ${imageRes.status}`);

      const imagePart = { inlineData: { mimeType: imageRes.headers.get("content-type") || "image/jpeg", data: Buffer.from(await imageRes.arrayBuffer()).toString("base64") } };
      const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
      const ocrResult = await geminiOCR(ai, imagePart);

      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
      const thaiMonths = ["มก.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
      const pad = (n: number) => String(n).padStart(2, "0");
      const recordedAt = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()+543} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const dateStr = `${now.getDate()} ${thaiMonths[now.getMonth()]}`;
      const hour = `${pad(now.getHours())}:00`;

      const payload = { zoneName, camLabel, waterLevel: ocrResult.waterLevel, readStatus: ocrResult.readStatus, explanation: ocrResult.explanation, confidence: ocrResult.confidence, hour, dateStr, recordedAt };

      // บันทึกลง local file แทน Google Sheets
      const readings = readReadings();
      readings.push({ id: Date.now().toString(), ...payload });
      if (readings.length > 10000) readings.splice(0, readings.length - 10000);
      saveReadings(readings);

      res.json({ status: "success", message: `สแกนสำเร็จ ${hour}`, data: payload });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err.message });
    }
  });

  app.get("/admin", (_req, res) => res.redirect("/?admin=true"));

  // ─── Static / Vite ────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // DASH MIME types
    express.static.mime.define({
      'application/dash+xml': ['mpd'],
      'video/mp4': ['m4s'],
    });
    app.use('/dash', express.static(path.join(process.cwd(), 'public/dash'), {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mpd')) {
          res.setHeader('Content-Type', 'application/dash+xml');
          res.setHeader('Access-Control-Allow-Origin', '*');
        }
        if (filePath.endsWith('.m4s')) {
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Access-Control-Allow-Origin', '*');
        }
      }
    }));
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  // ─── Start MJPEG server ───────────────────────────────────────────────────
  const mjpeg = spawn("node", ["mjpeg-server.cjs"], { cwd: process.cwd(), stdio: "inherit" });
  mjpeg.on("error", (err: Error) => console.error("[MJPEG]", err.message));
  mjpeg.on("close", (code: number) => console.log(`[MJPEG] exited: ${code}`));

  // ─── Daily backup to Google Sheets ──────────────────────────────────────────
  const BACKUP_SHEET_ID = process.env.BACKUP_SHEET_ID || '';
  const BACKUP_SHEET_NAME = 'DAILY_BACKUP';

  const runDailyBackup = async () => {
    try {
      const readings = readReadings();
      if (readings.length === 0) { console.log('[Backup] ไม่มีข้อมูลที่จะ backup'); return; }
      console.log(`[Backup] กำลัง backup ${readings.length} รายการ...`);
      const backupRes = await fetch(`http://localhost:${PORT}/api/backup-to-sheet`, { method: 'POST' });
      const result = await backupRes.json();
      console.log(`[Backup] Google Sheets: ${result.count} รายการ`);
      const rows = readings.map(r => [
        r.recordedAt || '', r.dateStr || '', r.hour || '',
        r.zoneName || '', r.camLabel || '',
        r.waterLevel != null ? r.waterLevel : '',
        r.readStatus || '',
        r.confidence ? (r.confidence * 100).toFixed(0) + '%' : '',
        r.explanation || ''
      ]);
      const headers = ['วันเวลาที่บันทึก','วันที่','ชั่วโมง','โซน','กล้อง','ระดับน้ำ (ม.)','สถานะ','ความแม่นยำ','คำอธิบาย'];
      const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const backupPath = path.join(DATA_DIR, `backup_${new Date().toISOString().slice(0,10)}.csv`);
      fs.writeFileSync(backupPath, '\uFEFF' + csv, 'utf8');
      console.log(`[Backup] CSV: ${backupPath}`);
    } catch (err: any) {
      console.error('[Backup] error:', err.message);
    }
  };

  // ตั้ง backup ทุกวันตอนเที่ยงคืน (00:00)
  const msToMidnight = (() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime() - now.getTime();
  })();

  setTimeout(() => {
    runDailyBackup();
    setInterval(runDailyBackup, 24 * 60 * 60 * 1000);
  }, msToMidnight);

  console.log(`[Backup] ตั้งเวลา backup อัตโนมัติทุกวัน (อีก ${Math.round(msToMidnight/3600000)} ชั่วโมง)`);
  // ─── Hourly auto scan ─────────────────────────────────────────────────────
  const DEFAULT_CAMS = [
    { camId: 'cam2', camPath: 'cam2_480p', camLabel: 'CAM 2', zoneName: 'บ้านน้ำขุ่น' },
    { camId: 'cam4', camPath: 'cam4_480p', camLabel: 'CAM 4', zoneName: 'วัดกะทิง' },
    { camId: 'cam6', camPath: 'cam6_480p', camLabel: 'CAM 6', zoneName: 'วัดปึก' },
    { camId: 'cam8', camPath: 'cam8_480p', camLabel: 'CAM 8', zoneName: 'บ้านแตงเม' },
    { camId: 'cam10', camPath: 'cam10_480p', camLabel: 'CAM 10', zoneName: 'วัดทุ่งตาอิน' },
  ];

  // ดึง target cams จาก config (ถ้าตั้งไว้) หรือใช้ default
  const getTargetCams = () => {
    try {
      const cfg = readConfig();
      if (cfg.scanCams && Array.isArray(cfg.scanCams) && cfg.scanCams.length > 0) {
        return cfg.scanCams;
      }
    } catch {}
    return DEFAULT_CAMS;
  };

  // สแกนกล้องเดียว ครั้งเดียว (ไม่ retry — ถ้าไม่สำเร็จจะไปอ่านจาก snapshot แทนใน fillMissingFromSnapshots)
  const scanCamOnce = async (cam: any, systemSecret: string) => {
    try {
      const url = `http://localhost:${PORT}/api/trigger-hourly-scan?secret=${systemSecret}&camId=${cam.camId}&camPath=${encodeURIComponent(cam.camPath)}&zoneName=${encodeURIComponent(cam.zoneName)}&camLabel=${encodeURIComponent(cam.camLabel)}`;
      const res = await fetch(url);
      const data = await res.json();
      const success = data.status === 'success' && data.data?.waterLevel != null;
      console.log(`[Cron] ${cam.camLabel}: ${success ? data.data.waterLevel + ' ม.' : 'ไม่สำเร็จ'} (${data.data?.readStatus || 'N/A'})`);
      if (!success) {
        console.log(`[Cron] ${cam.camLabel}: จะเช็คจาก snapshot แทน`);
      }
    } catch (err: any) {
      console.error(`[Cron] ${cam.camLabel} error:`, err.message);
      console.log(`[Cron] ${cam.camLabel}: จะเช็คจาก snapshot แทน`);
    }
  };

  // ─── Snapshot helpers ───────────────────────────────────────────────────────
  const SNAPSHOT_DIR = path.join(DATA_DIR, 'snapshots');
  if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  // getSnapshotPath: เก็บ path ระดับชั่วโมง (HH-00) เหมือนเดิมสำหรับ fillMissingFromSnapshots
  // และเก็บ path ระดับ 5 นาที (HH-MM) แยกไว้สำหรับ snapshot ความถี่สูง
  const getSnapshotPath = (camId: string, date: Date, useMinuteBucket: boolean = false) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
    const minuteBucket = useMinuteBucket ? Math.floor(date.getMinutes() / 5) * 5 : 0;
    const hourStr = `${pad(date.getHours())}-${pad(minuteBucket)}`;
    const dir = path.join(SNAPSHOT_DIR, dateStr, hourStr);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${camId}.jpg`);
  };

  const saveSnapshot = async (camId: string, camPath: string, date: Date, useMinuteBucket: boolean = false) => {
    try {
      const systemSecret = process.env.CRON_SECRET || 'watpuek_cloud_sync_secret';
      const snapshotUrl = `http://localhost:${PORT}/api/snapshot/${camId}?secret=${systemSecret}&camPath=${encodeURIComponent(camPath)}`;
      const res = await fetch(snapshotUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const outPath = getSnapshotPath(camId, date, useMinuteBucket);
      fs.writeFileSync(outPath, buf);
      console.log(`[Snapshot] บันทึก ${camId} → ${outPath}`);
      return outPath;
    } catch (err: any) {
      console.error(`[Snapshot] ${camId} error:`, err.message);
      return null;
    }
  };

  const cleanOldSnapshots = () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 3);
      const dirs = fs.readdirSync(SNAPSHOT_DIR);
      for (const d of dirs) {
        const dateMatch = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!dateMatch) continue;
        const dirDate = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2])-1, parseInt(dateMatch[3]));
        if (dirDate < cutoff) {
          fs.rmSync(path.join(SNAPSHOT_DIR, d), { recursive: true, force: true });
          console.log(`[Snapshot] ลบ snapshot เก่า: ${d}`);
        }
      }
    } catch (err: any) {
      console.error('[Snapshot] cleanOldSnapshots error:', err.message);
    }
  };

  // ─── Snapshot job ทุก 5 นาที (เฉพาะกล้องที่ใช้สแกน AI) ──────────────────────
  const runSnapshotJob = async () => {
    const targetCams = getTargetCams();
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    for (const cam of targetCams) {
      await saveSnapshot(cam.camId, cam.camPath, now, true); // useMinuteBucket = true
    }
  };

  // เช็คและวิเคราะห์ชั่วโมงที่ค่าว่างจาก snapshot
  // หา snapshot ที่ดีที่สุดในชั่วโมงที่กำหนด: ลองนาที 00 ก่อน ถ้าไม่มีไล่หานาทีอื่น (05,10,...55)
  // เลือกนาทีที่ใกล้เวลาปัจจุบันจริง (nowActual) มากที่สุดที่ยังไม่เกินเวลาปัจจุบัน
  const findBestSnapshotInHour = (camId: string, hourDate: Date, nowActual: Date): { path: string; minute: number } | null => {
    const pad = (n: number) => String(n).padStart(2, '0');
    // path นาที 00 (แบบเดิม ไม่ใช้ minute bucket)
    const zeroPath = getSnapshotPath(camId, hourDate, false);
    if (fs.existsSync(zeroPath)) return { path: zeroPath, minute: 0 };

    // ไล่หานาที 55,50,...05 ที่ไม่เกินเวลาปัจจุบันจริง เลือกตัวที่ใกล้ nowActual มากที่สุดก่อน
    const sameHour = hourDate.getHours() === nowActual.getHours() &&
      hourDate.toDateString() === nowActual.toDateString();
    const maxMinute = sameHour ? Math.floor(nowActual.getMinutes() / 5) * 5 : 55;

    for (let m = maxMinute; m >= 5; m -= 5) {
      const candidateDate = new Date(hourDate);
      candidateDate.setMinutes(m);
      const candidatePath = getSnapshotPath(camId, candidateDate, true);
      if (fs.existsSync(candidatePath)) return { path: candidatePath, minute: m };
    }
    return null;
  };

  const fillMissingFromSnapshots = async (hoursBack: number = 24): Promise<number> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return 0;

    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const pad = (n: number) => String(n).padStart(2, '0');
    const targetCams = getTargetCams();

    // หาช่องว่างทั้งหมดก่อน (อ่าน readings แค่ครั้งเดียว) เพื่อเช็คได้เร็วว่ามีอะไรต้องเติมไหม
    const readings = readReadings();
    const gaps: { cam: any; checkDate: Date; hourStr: string; snapshotPath: string; snapshotMinute: number }[] = [];

    for (const cam of targetCams) {
      // เช็คย้อนหลังตาม hoursBack ชั่วโมง (h=0 คือชั่วโมงปัจจุบัน)
      for (let h = 0; h < hoursBack; h++) {
        const checkDate = new Date(now.getTime() - h * 60 * 60 * 1000);
        const hourStr = `${pad(checkDate.getHours())}:00`;
        // เช็ควันที่ด้วย ไม่ใช่แค่ชั่วโมง เพราะ record ต่างวันชั่วโมงเดียวกันต้องเติมแยกกัน
        const datePrefix = `${pad(checkDate.getDate())}/${pad(checkDate.getMonth()+1)}/${checkDate.getFullYear()}`;
        const hasReading = readings.some(r =>
          r.camLabel === cam.camLabel &&
          r.hour === hourStr &&
          r.waterLevel != null &&
          (r.recordedAt || '').startsWith(datePrefix)
        );
        if (hasReading) continue;

        // หา snapshot ที่ดีที่สุดของชั่วโมงนั้น (นาที 00 ก่อน ถ้าไม่มีไล่หานาทีอื่น)
        const found = findBestSnapshotInHour(cam.camId, checkDate, now);
        if (!found) continue;

        gaps.push({ cam, checkDate, hourStr, snapshotPath: found.path, snapshotMinute: found.minute });
      }
    }

    if (gaps.length === 0) {
      console.log('[Fill] ไม่พบช่องว่างที่ต้องเติม ข้าม');
      return 0;
    }

    console.log(`[Fill] พบช่องว่าง ${gaps.length} รายการ กำลังอ่านจาก snapshot...`);
    let filledCount = 0;

    for (const { cam, checkDate, hourStr, snapshotPath, snapshotMinute } of gaps) {
      console.log(`[Fill] พบค่าว่าง ${cam.camLabel} ${hourStr} — อ่านจาก snapshot นาที ${pad(snapshotMinute)}...`);
      const thaiMonths = ['มก.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
      const dateStr = `${checkDate.getDate()} ${thaiMonths[checkDate.getMonth()]}`;
      try {
        const imgBuf = fs.readFileSync(snapshotPath);
        const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
        const imagePart = { inlineData: { mimeType: 'image/jpeg', data: imgBuf.toString('base64') } };
        const ocrResult = await geminiOCR(ai, imagePart);

        const recordedAt = `${pad(checkDate.getDate())}/${pad(checkDate.getMonth()+1)}/${checkDate.getFullYear()+543} ${hourStr}:00`;

        const reading = {
          id: Date.now().toString(),
          zoneName: cam.zoneName,
          camLabel: cam.camLabel,
          waterLevel: ocrResult.waterLevel,
          readStatus: ocrResult.readStatus || '',
          explanation: ocrResult.explanation || '',
          confidence: ocrResult.confidence || 0,
          hour: hourStr,
          dateStr,
          recordedAt,
          fromSnapshot: true,
        };

        if (ocrResult.waterLevel != null) {
          const all = readReadings();
          all.unshift(reading);
          saveReadings(all);
          console.log(`[Fill] ${cam.camLabel} ${hourStr}: ${ocrResult.waterLevel} ม. (จาก snapshot)`);
          filledCount++;
          addFillLogEntry({
            camLabel: cam.camLabel,
            zoneName: cam.zoneName,
            hour: hourStr,
            dateStr,
            success: true,
            waterLevel: ocrResult.waterLevel,
            message: `เติมค่าสำเร็จ ${ocrResult.waterLevel} ม. (จาก snapshot)`,
          });
        } else {
          addFillLogEntry({
            camLabel: cam.camLabel,
            zoneName: cam.zoneName,
            hour: hourStr,
            dateStr,
            success: false,
            waterLevel: null,
            message: 'AI อ่านค่าจากภาพไม่ได้ (waterLevel เป็น null)',
          });
        }
      } catch (e: any) {
        console.error(`[Fill] ${cam.camLabel} ${hourStr} error:`, e.message);
        addFillLogEntry({
          camLabel: cam.camLabel,
          zoneName: cam.zoneName,
          hour: hourStr,
          dateStr,
          success: false,
          waterLevel: null,
          message: `error: ${e.message}`,
        });
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    return filledCount;
  };

  // Job แยกต่างหาก: เช็คช่องว่างย้อนหลัง 3 วัน (72 ชม.) ทุก 5 นาที
  const runFillMissingJob = async () => {
    const filled = await fillMissingFromSnapshots(72);
    if (filled > 0) {
      console.log(`[Fill] เติมค่าสำเร็จ ${filled} รายการ`);
    }
  };

  const runHourlyScan = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') { console.log('[Cron] ไม่พบ GEMINI_API_KEY'); return; }
    const targetCams = getTargetCams();
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    console.log(`[Cron] เริ่มสแกน ${new Date().toLocaleTimeString('th-TH')} (${targetCams.length} กล้อง)`);
    const systemSecret = process.env.CRON_SECRET || 'watpuek_cloud_sync_secret';

    for (const cam of targetCams) {
      // บันทึก snapshot นาที 00 ก่อนสแกน (รับประกันมีภาพให้ fillMissingFromSnapshots ใช้ได้แน่นอน)
      await saveSnapshot(cam.camId, cam.camPath, now);
      await scanCamOnce(cam, systemSecret);
      await new Promise(r => setTimeout(r, 3000));
    }

    // ลบ snapshot เก่าเกิน 3 วัน
    cleanOldSnapshots();

    console.log('[Cron] สแกนเสร็จสิ้น (ใช้ปุ่ม "รัน Fill Job" ในหน้า admin เพื่อเติมค่าที่ขาดหาย)');
  };

  const msToNextHour = (60 - new Date().getMinutes()) * 60 * 1000 - new Date().getSeconds() * 1000;
  setTimeout(() => { runHourlyScan(); setInterval(runHourlyScan, 60 * 60 * 1000); }, msToNextHour);
  console.log(`[Cron] สแกนอัตโนมัติทุกชั่วโมง (อีก ${Math.round(msToNextHour/60000)} นาที)`);

  // Snapshot job: เก็บภาพทุก 5 นาที (เฉพาะกล้องที่ใช้สแกน AI)
  const nowForSnapshot = new Date();
  const remainderMin = nowForSnapshot.getMinutes() % 5;
  const secsSinceLast5MinMark = remainderMin * 60 + nowForSnapshot.getSeconds();
  const msToNext5Min = (5 * 60 * 1000) - (secsSinceLast5MinMark * 1000);
  setTimeout(() => { runSnapshotJob(); setInterval(runSnapshotJob, 5 * 60 * 1000); }, msToNext5Min);
  console.log(`[Snapshot] เก็บภาพอัตโนมัติทุก 5 นาที (อีก ${Math.round(msToNext5Min/1000)} วินาที)`);

  // Fill-missing job: เช็คช่องว่างย้อนหลัง 3 วัน ทุก 5 นาที รันหลัง snapshot job 2 นาที
  // (เว้นระยะให้ runHourlyScan มีเวลาสแกนสดจบก่อน ลดโอกาสชนกันตอนนาที 00)
  console.log('[Fill] Fill Job พร้อมใช้งาน — รันด้วยมือผ่านหน้า admin');
  httpServer.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://0.0.0.0:${PORT}`));
}

startServer();