// mjpeg-server.cjs
// RTSP → MJPEG server (low latency version)

const http = require('http');
const { spawn } = require('child_process');

const FFMPEG = 'C:\\ffmpeg\\bin\\ffmpeg.exe';
const PORT = 3002;

const CAMERAS = {
  cam1:  'rtsp://100.93.6.53:8554/cam1_480p',
  cam2:  'rtsp://100.93.6.53:8554/cam2_480p',
  cam9:  'rtsp://100.94.93.119:8554/cam9_480p',
  cam10: 'rtsp://100.94.93.119:8554/cam10_480p',
  cam3:  'rtsp://100.94.25.84:8554/cam3_480p',
  cam4:  'rtsp://100.94.25.84:8554/cam4_480p',
  cam5: 'rtsp://100.125.241.65:8554/cam5_480p',
  cam6: 'rtsp://100.125.241.65:8554/cam6_480p',
  cam7:  'rtsp://100.96.229.10:8554/cam7_480p',
  cam8:  'rtsp://100.96.229.10:8554/cam8_480p',
  cam501:'rtsp://localhost:8554/live/cam501',
};

const streams = {};

function startStream(camId) {
  if (streams[camId]) return;

  const rtspUrl = CAMERAS[camId];
  console.log(`[${camId}] Starting FFmpeg: ${rtspUrl}`);

  const needsBuffer = ['cam3', 'cam7', 'cam8'].includes(camId);
  const bufferSize = camId === 'cam3' ? '1000000' : needsBuffer ? '500000' : '100000';

  const ffmpeg = spawn(FFMPEG, [
    '-rtsp_transport', 'tcp',
    '-fflags', 'nobuffer',
    '-flags', 'low_delay',
    '-analyzeduration', bufferSize,
    '-probesize', bufferSize,
    '-i', rtspUrl,
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-q:v', '5',
    '-r', '15',
    '-vf', 'yadif=mode=1,scale=854:480',
    '-flush_packets', '1',          // flush ทันทีทุก packet
    'pipe:1'
  ]);

  streams[camId] = { ffmpeg, clients: new Set() };

  let buf = Buffer.alloc(0);

  ffmpeg.stdout.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);

    while (true) {
      // หา SOI (0xFFD8)
      let start = -1;
      for (let i = 0; i < buf.length - 1; i++) {
        if (buf[i] === 0xff && buf[i + 1] === 0xd8) { start = i; break; }
      }
      if (start === -1) { buf = Buffer.alloc(0); break; }

      // หา EOI (0xFFD9) หลัง SOI
      let end = -1;
      for (let i = start + 2; i < buf.length - 1; i++) {
        if (buf[i] === 0xff && buf[i + 1] === 0xd9) { end = i + 1; break; }
      }
      if (end === -1) break; // frame ยังไม่ครบ รอ chunk ต่อไป

      // ได้ frame ครบแล้ว
      const frame = buf.slice(start, end + 1);
      buf = buf.slice(end + 1);

      const header = Buffer.from(
        '--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ' + frame.length + '\r\n\r\n'
      );

      // ส่งให้ทุก client พร้อมกัน
      streams[camId]?.clients.forEach(res => {
        try {
          res.write(Buffer.concat([header, frame, Buffer.from('\r\n')]));
        } catch (e) {}
      });
    }
  });

  ffmpeg.stderr.on('data', () => {}); // suppress stderr

  ffmpeg.on('close', (code) => {
    console.log(`[${camId}] FFmpeg exited (${code}) — restarting in 3s...`);
    if (streams[camId]) {
      streams[camId].clients.forEach(res => { try { res.end(); } catch {} });
    }
    delete streams[camId];
    setTimeout(() => startStream(camId), 3000);
  });

  ffmpeg.on('error', (err) => {
    console.error(`[${camId}] FFmpeg error:`, err.message);
    if (streams[camId]) {
      streams[camId].clients.forEach(res => { try { res.end(); } catch {} });
    }
    delete streams[camId];
    setTimeout(() => startStream(camId), 3000);
  });
}

function stopStream(camId) {
  // ไม่หยุด FFmpeg เพราะ pre-start ไว้แล้ว
  // FFmpeg จะรันตลอดเพื่อลด delay เมื่อ client เปิดดู
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/list') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      cameras: Object.keys(CAMERAS),
      active: Object.keys(streams)
    }));
  }

  const camId = req.url.replace('/', '').split('?')[0];
  if (!CAMERAS[camId]) {
    res.writeHead(404);
    return res.end(`Camera "${camId}" not found. Available: ${Object.keys(CAMERAS).join(', ')}`);
  }

  console.log(`[${camId}] Client connected: ${req.socket.remoteAddress}`);

  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Connection': 'keep-alive',
  });

  startStream(camId);
  streams[camId].clients.add(res);

  req.on('close', () => {
    console.log(`[${camId}] Client disconnected`);
    streams[camId]?.clients.delete(res);
    setTimeout(() => stopStream(camId), 5000);
  });
});

// ─── DASH for cam501 ──────────────────────────────────────────────────────
const startDash = () => {
  console.log('[DASH] Starting cam501...');
  const dash = spawn(FFMPEG, [
    '-rtsp_transport', 'tcp',
    '-timeout', '10000000',
    '-i', 'rtsp://localhost:8554/live/cam501',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-f', 'dash',
    '-seg_duration', '0.5',
    '-window_size', '3',
    '-remove_at_exit', '1',
    '-use_timeline', '1',
    '-use_template', '1',
    'C:/web/public/dash/cam501/manifest.mpd'
  ]);
  dash.stderr.on('data', () => {});
  dash.on('close', (code) => {
    console.log(`[DASH] exited (${code}) — restarting in 3s...`);
    setTimeout(startDash, 3000);
  });
  dash.on('error', (err) => {
    console.error('[DASH] error:', err.message);
    setTimeout(startDash, 3000);
  });
};

setTimeout(startDash, 3000);

server.listen(PORT, () => {
  console.log(`\nMJPEG Server รันที่ http://localhost:${PORT}`);
  console.log('Endpoints:');
  Object.keys(CAMERAS).forEach(id => {
    console.log(`  http://localhost:${PORT}/${id}`);
  });
  console.log(`\nList: http://localhost:${PORT}/list\n`);

  // Pre-start ทุกกล้องตั้งแต่เริ่ม ไม่รอ client
  setTimeout(() => {
    Object.keys(CAMERAS).forEach(id => {
      startStream(id);
      console.log(`[${id}] pre-started`);
    });
  }, 1000);
});
