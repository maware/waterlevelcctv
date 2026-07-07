import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { Zone } from './types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

// Configure Google Provider with Sheets Scope
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

// Memory cache for active tokens and states
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Spreadsheet configurations
export let SPREADSHEET_ID = '1HlxtltTtl7Mk-i5d-2V9D0uy0y0U4L5oet3dRFPvmjQ';

export const updateActiveSpreadsheetId = (id: string) => {
  if (id && id.trim()) {
    localStorage.setItem('watpuek_spreadsheet_id', id.trim());
    SPREADSHEET_ID = id.trim();
  }
};

// Auto-initialize SPREADSHEET_ID on load
if (typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search);
    const paramId = params.get('sheetId');
    if (paramId && paramId.trim()) {
      localStorage.setItem('watpuek_spreadsheet_id', paramId.trim());
      SPREADSHEET_ID = paramId.trim();
    } else {
      const saved = localStorage.getItem('watpuek_spreadsheet_id');
      if (saved && saved.trim()) {
        SPREADSHEET_ID = saved.trim();
      }
    }
  } catch (error) {
    console.warn('Failed to parse URL sheetId or load from localStorage:', error);
  }
}

/**
 * Initialize and subscribe to Auth state changes
 */
export const initAuthListener = (
  onSuccess: (user: User, token: string) => void,
  onFailure: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        onSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onFailure();
      }
    } else {
      cachedAccessToken = null;
      onFailure();
    }
  });
};

/**
 * Sign in using Firebase Google popup
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve Google Sheets access token from Firebase Auth credential');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err) {
    console.error('Google Sign In failed:', err);
    throw err;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Logout from session
 */
export const googleSignOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Get active token
 */
export const getCachedToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Helper to fetch first sheet name (tab name) from Spreadsheet metadata
 */
export const getFirstSheetName = async (accessToken: string): Promise<string> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch spreadsheet metadata: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.sheets && data.sheets.length > 0) {
    return data.sheets[0].properties.title || 'Sheet1';
  }
  return 'Sheet1';
};

/**
 * Load CCTV Configuration from Google Sheets
 */
export const loadCCTVFromGoogleSheet = async (accessToken: string): Promise<Zone[]> => {
  const sheetName = await getFirstSheetName(accessToken);
  const range = `${sheetName}!A1:K300`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load values from Google Sheet: ${response.statusText}`);
  }

  const data = await response.json();
  const rows = data.values as string[][];

  if (!rows || rows.length < 2) {
    throw new Error('EMPTY_SHEET');
  }

  // Normalize headers to identify column indexes dynamically
  const headers = rows[0].map(h => (h ? h.toString().trim().toLowerCase() : ''));

  const getIdx = (keywords: string[], defaultIdx: number): number => {
    const foundIdx = headers.findIndex(h => keywords.some(k => h.includes(k.toLowerCase())));
    return foundIdx !== -1 ? foundIdx : defaultIdx;
  };

  // Dynamically map columns by checking headers
  const zoneIdIdx = getIdx(['รหัสโซน', 'zone_id', 'zone id'], 8); // default to col Index 8 (9th col)
  const zoneNameIdx = getIdx(['โซนหลัก', 'zone_name', 'zone name'], 2); // default to col Index 2 (3rd col)
  const camIdIdx = getIdx(['id กล้อง', 'camera_id', 'camera id', 'id'], 0); // default to col Index 0
  const camLabelIdx = getIdx(['ชื่อเรียกย่อ', 'camera_label', 'camera label', 'label'], 1); // default to 1
  const camPathIdx = getIdx(['พาธอิมพอร์ต', 'campath', 'cam path', 'camera path'], 6); // default to 6
  const ipAddressIdx = getIdx(['ip เครื่อง lan', 'ip_address', 'ip address', 'ip'], 7); // default to 7
  const locationIdx = getIdx(['คำอธิบายสถานที่ติดตั้ง', 'location', 'สถานที่ติดตั้ง', 'cctv location'], 4); // default to 4

  // Map flat rows into structured Local Zone objects
  const zonesMap = new Map<string, Zone>();

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Use mapped indexes with safe bounds
    const rawZoneId = row[zoneIdIdx] || '';
    const zoneName = row[zoneNameIdx] || '';
    
    // Fallbacks in case zone details are missing
    const zoneId = rawZoneId.trim() || `zone-${i}`;
    const zName = zoneName.trim() || `โซนหลัก ${i}`;

    const camId = (row[camIdIdx] || '').trim();
    const camLabel = (row[camLabelIdx] || '').trim();
    const camPath = (row[camPathIdx] || '').trim();
    const ipAddress = (row[ipAddressIdx] || '').trim();
    const location = (row[locationIdx] || '').trim();

    if (!camId) continue; // Skip rows that don't have a Camera ID

    if (!zonesMap.has(zoneId)) {
      zonesMap.set(zoneId, {
        id: zoneId,
        name: zName,
        cams: []
      });
    }

    const currentZone = zonesMap.get(zoneId);
    if (currentZone) {
      currentZone.cams.push({
        id: camId,
        label: camLabel || camId.toUpperCase(),
        camPath: camPath || camId,
        status: 'connecting',
        ipAddress: ipAddress || '192.168.1.x',
        location: location || `${zName} — จุดติดตั้ง`
      });
    }
  }

  const zonesList = Array.from(zonesMap.values());
  if (zonesList.length === 0) {
    throw new Error('EMPTY_SHEET');
  }

  return zonesList;
};

/**
 * Save CCTV Configuration to Google Sheets with detailed columns.
 */
export const saveCCTVToGoogleSheet = async (
  accessToken: string, 
  zones: Zone[],
  gatewayUrl: string = 'https://webrtc.watpuekwater.org',
  selectedQuality: string = '480p'
): Promise<void> => {
  const sheetName = await getFirstSheetName(accessToken);
  
  // Format data into 9 columns matching user's requested layout:
  // ID, ชื่อเรียกย่อ, โซนหลัก, ตำแหน่ง WHEP URL ที่เรียกจริง, คำอธิบายสถานที่ติดตั้ง, บริหารระดับความละเอียด, ข้อมูลกล้องแต่ละโซน (camPath), IP เครื่อง LAN, รหัสโซน
  const rows: string[][] = [
    [
      'ID กล้อง', 
      'ชื่อเรียกย่อ', 
      'โซนหลัก', 
      'ตำแหน่ง WHEP URL ที่เรียกจริง', 
      'คำอธิบายสถานที่ติดตั้ง', 
      'บริหารระดับความละเอียด', 
      'พาธอิมพอร์ต (camPath)', 
      'IP เครื่อง LAN', 
      'รหัสโซน'
    ]
  ];

  zones.forEach(zone => {
    zone.cams.forEach(cam => {
      // Build dynamic WHEP URL:
      const suffix = selectedQuality === '1080p' ? '_1080p' : '_480p';
      const whepUrl = `${gatewayUrl}/${cam.camPath}${suffix}/whep`;

      rows.push([
        cam.id,
        cam.label,
        zone.name,
        whepUrl,
        cam.location || '',
        selectedQuality,
        cam.camPath,
        cam.ipAddress || '',
        zone.id
      ]);
    });
  });

  // Step 1: Clear current content up to column K and 300 rows to ensure old records are wiped
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName + '!A1:K300')}:clear`;
  const clearResponse = await fetch(clearUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!clearResponse.ok) {
    throw new Error(`Failed to clear old Google Sheet config: ${clearResponse.statusText}`);
  }

  // Step 2: Write actual new configurations
  const writeRange = `${sheetName}!A1:I${rows.length}`;
  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`;
  
  const writeResponse = await fetch(writeUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range: writeRange,
      majorDimension: 'ROWS',
      values: rows
    })
  });

  if (!writeResponse.ok) {
    throw new Error(`Failed to write new values to Google Sheet: ${writeResponse.statusText}`);
  }
};

/**
 * Ensure the SYSTEM_CONFIG sheet tab exists in Google Sheets
 */
export const ensureConfigSheet = async (accessToken: string): Promise<void> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: 'SYSTEM_CONFIG'
              }
            }
          }
        ]
      })
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (errData?.error?.message?.includes('already exists') || errData?.error?.message?.includes('Already Exists')) {
        return; // Safe to ignore
      }
    }
  } catch (err) {
    console.warn('Could not check or add SYSTEM_CONFIG tab:', err);
  }
};

/**
 * Save application global settings to SYSTEM_CONFIG tab in Google Sheets
 */
export const saveConfigToGoogleSheet = async (
  accessToken: string,
  config: { 
    adminPassword?: string; 
    gatewayUrl?: string; 
    selectedQuality?: string;
    suffix480p?: string;
    suffix720p?: string;
    suffix1080p?: string;
    appsScriptUrl?: string;
  }
): Promise<void> => {
  await ensureConfigSheet(accessToken);
  
  const range = 'SYSTEM_CONFIG!A1:C8';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  
  const rows = [
    ['Key', 'Value', 'Description'],
    ['admin_password', config.adminPassword || '12345678', 'แอดมินรหัสผ่าน'],
    ['gateway_url', config.gatewayUrl || 'https://webrtc.watpuekwater.org', 'เกตเวย์หลัก WHEP URL'],
    ['selected_quality', config.selectedQuality || '480p', 'ความละเอียดวิดีโอหลัก (480p/1080p)'],
    ['suffix_480p', config.suffix480p || '_480p', 'คำต่อท้ายสตรีม 480p'],
    ['suffix_720p', config.suffix720p || '_480p', 'คำต่อท้ายสตรีม 720p'],
    ['suffix_1080p', config.suffix1080p || '_1080p', 'คำต่อท้ายสตรีม 1080p'],
    ['apps_script_url', config.appsScriptUrl || '', 'ลิงก์ Apps Script Web App สำหรับเก็บข้อมูลโดยตรงไม่ต้องผ่านการล็อคอิน']
  ];
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: rows
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to save configuration metrics: ${response.statusText}`);
  }
};

/**
 * Load application global configs from SYSTEM_CONFIG tab
 */
export const loadConfigFromGoogleSheet = async (
  accessToken: string
): Promise<{ 
  adminPassword?: string; 
  gatewayUrl?: string; 
  selectedQuality?: string;
  suffix480p?: string;
  suffix720p?: string;
  suffix1080p?: string;
  appsScriptUrl?: string;
} | null> => {
  await ensureConfigSheet(accessToken);
  
  const range = 'SYSTEM_CONFIG!A1:C15';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    return null;
  }
  
  const data = await response.json();
  const rows = data.values as string[][];
  
  if (!rows || rows.length < 2) {
    return null;
  }
  
  const config: { 
    adminPassword?: string; 
    gatewayUrl?: string; 
    selectedQuality?: string;
    suffix480p?: string;
    suffix720p?: string;
    suffix1080p?: string;
    appsScriptUrl?: string;
  } = {};
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    
    const key = (row[0] || '').trim();
    const value = (row[1] || '').trim();
    
    if (key === 'admin_password') {
      config.adminPassword = value;
    } else if (key === 'gateway_url') {
      config.gatewayUrl = value;
    } else if (key === 'selected_quality') {
      config.selectedQuality = value;
    } else if (key === 'suffix_480p') {
      config.suffix480p = value;
    } else if (key === 'suffix_720p') {
      config.suffix720p = value;
    } else if (key === 'suffix_1080p') {
      config.suffix1080p = value;
    } else if (key === 'apps_script_url') {
      config.appsScriptUrl = value;
    }
  }
  
  return config;
};

/**
 * Universal CSV Parser that handles nested quotes and commas correctly
 */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let entry = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        entry += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(entry);
      entry = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(entry);
      if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
        lines.push(row);
      }
      row = [];
      entry = '';
    } else {
      entry += char;
    }
  }
  
  if (entry || row.length > 0) {
    row.push(entry);
    lines.push(row);
  }
  
  return lines;
}

/**
 * Publicly loads the CCTV layout from the Google Sheet (via GViz CSV export)
 * WITHOUT requiring any user login or access token.
 * Prerequisite: Google Sheet sharing state must be set to "Anyone with the link can view".
 */
export const loadCCTVPublicly = async (): Promise<Zone[]> => {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheet publicly: ${response.statusText}`);
  }
  
  const csvText = await response.text();
  const rows = parseCSV(csvText);
  
  if (!rows || rows.length < 2) {
    throw new Error('EMPTY_SHEET');
  }
  
  // Normalize headers to identify column indexes dynamically
  const headers = rows[0].map(h => (h ? h.toString().trim().toLowerCase() : ''));

  const getIdx = (keywords: string[], defaultIdx: number): number => {
    const foundIdx = headers.findIndex(h => keywords.some(k => h.includes(k.toLowerCase())));
    return foundIdx !== -1 ? foundIdx : defaultIdx;
  };

  const zoneIdIdx = getIdx(['รหัสโซน', 'zone_id', 'zone id'], 8);
  const zoneNameIdx = getIdx(['โซนหลัก', 'zone_name', 'zone name'], 2);
  const camIdIdx = getIdx(['id กล้อง', 'camera_id', 'camera id', 'id'], 0);
  const camLabelIdx = getIdx(['ชื่อเรียกย่อ', 'camera_label', 'camera label', 'label'], 1);
  const camPathIdx = getIdx(['พาธอิมพอร์ต', 'campath', 'cam path', 'camera path'], 6);
  const ipAddressIdx = getIdx(['ip เครื่อง lan', 'ip_address', 'ip address', 'ip'], 7);
  const locationIdx = getIdx(['คำอธิบายสถานที่ติดตั้ง', 'location', 'สถานที่ติดตั้ง', 'cctv location'], 4);

  const zonesMap = new Map<string, Zone>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawZoneId = row[zoneIdIdx] || '';
    const zoneName = row[zoneNameIdx] || '';
    
    const zoneId = rawZoneId.trim() || `zone-${i}`;
    const zName = zoneName.trim() || `โซนหลัก ${i}`;

    const camId = (row[camIdIdx] || '').trim();
    const camLabel = (row[camLabelIdx] || '').trim();
    const camPath = (row[camPathIdx] || '').trim();
    const ipAddress = (row[ipAddressIdx] || '').trim();
    const location = (row[locationIdx] || '').trim();

    if (!camId) continue;

    if (!zonesMap.has(zoneId)) {
      zonesMap.set(zoneId, {
        id: zoneId,
        name: zName,
        cams: []
      });
    }

    const currentZone = zonesMap.get(zoneId);
    if (currentZone) {
      currentZone.cams.push({
        id: camId,
        label: camLabel || camId.toUpperCase(),
        camPath: camPath || camId,
        status: 'connecting',
        ipAddress: ipAddress || '192.168.1.x',
        location: location || `${zName} — จุดติดตั้ง`
      });
    }
  }

  const zonesList = Array.from(zonesMap.values());
  if (zonesList.length === 0) {
    throw new Error('EMPTY_SHEET');
  }

  return zonesList;
};

/**
 * Publicly loads the global configs (password, gateway, etc.) from Google Sheet
 * WITHOUT requiring any user login or access token.
 */
export const loadConfigPublicly = async (): Promise<{ 
  adminPassword?: string; 
  gatewayUrl?: string; 
  selectedQuality?: string;
  suffix480p?: string;
  suffix720p?: string;
  suffix1080p?: string;
  appsScriptUrl?: string;
} | null> => {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=SYSTEM_CONFIG`;
  const response = await fetch(url);
  
  if (!response.ok) {
    return null;
  }
  
  const csvText = await response.text();
  const rows = parseCSV(csvText);
  
  if (!rows || rows.length < 2) {
    return null;
  }

  const config: { 
    adminPassword?: string; 
    gatewayUrl?: string; 
    selectedQuality?: string;
    suffix480p?: string;
    suffix720p?: string;
    suffix1080p?: string;
    appsScriptUrl?: string;
  } = {};
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    
    const key = (row[0] || '').trim();
    const value = (row[1] || '').trim();
    
    if (key === 'admin_password') {
      config.adminPassword = value;
    } else if (key === 'gateway_url') {
      config.gatewayUrl = value;
    } else if (key === 'selected_quality') {
      config.selectedQuality = value;
    } else if (key === 'suffix_480p') {
      config.suffix480p = value;
    } else if (key === 'suffix_720p') {
      config.suffix720p = value;
    } else if (key === 'suffix_1080p') {
      config.suffix1080p = value;
    } else if (key === 'apps_script_url') {
      config.appsScriptUrl = value;
    }
  }
  
  return config;
};

/**
 * Sends water level measurement directly to the Google Apps Script Web App without login credentials.
 */
export const saveReadingToAppsScriptPublicly = async (
  scriptUrl: string,
  payload: {
    zoneName: string;
    camLabel: string;
    waterLevel: number;
    readStatus: string;
    explanation: string;
    confidence: number;
    hour: string; // e.g. "01:00"
    dateStr: string; // e.g. "2026-06-11"
    recordedAt: string; // e.g. "2026-06-11 01:40:15"
  }
): Promise<boolean> => {
  if (!scriptUrl || !scriptUrl.startsWith('http')) {
    console.warn('Apps Script URL is not configured or invalid:', scriptUrl);
    return false;
  }
  
  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    
    console.log("Successfully posted measurement to Google Apps Script (direct public link):", payload);
    return true;
  } catch (err) {
    console.error("Direct Apps Script upload failed:", err);
    throw err;
  }
};

export interface SheetReading {
  dateStr: string;
  hour: string;
  zoneName: string;
  camLabel: string;
  waterLevel: number;
  readStatus: string;
  explanation: string;
  confidence: number;
  recordedAt: string;
  rowIndex?: number;
}

/**
 * Parses recordedAt, dateStr, and hourStr to return milliseconds since Epoch.
 * Highly robust to support standard Gregorian years and Buddhist Era (BE) years.
 */
const getTimestampMs = (recordedAt: string, dateStr: string, hourStr: string): number => {
  if (!recordedAt && !dateStr) return 0;

  const parseRawDate = (str: string): { year: number, month: number, day: number, hour: number, minute: number, second: number } | null => {
    if (!str) return null;
    const clean = str.trim().replace(/,/g, '');

    // Check if format is like ISO "YYYY-MM-DD" or similar
    const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})([ T](\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
    if (isoMatch) {
      let year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1; // 0-based
      const day = parseInt(isoMatch[3], 10);
      const hour = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
      const minute = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
      const second = isoMatch[7] ? parseInt(isoMatch[7], 10) : 0;

      if (year > 2400) year -= 543; // BE to AD conversion
      return { year, month, day, hour, minute, second };
    }

    // Match traditional date or datetime strings like "11/06/2026 15:30:12" or "11/06/2569 15:30:12"
    const datetimeParts = clean.split(/\s+/);
    const datePart = datetimeParts[0];
    const timePart = datetimeParts[1] || '00:00:00';

    const dSegments = datePart.split(/[\/\-]/).map(x => parseInt(x, 10));
    const tSegments = timePart.split(':').map(x => parseInt(x, 10));

    if (dSegments.length === 3) {
      let day = 1;
      let month = 0;
      let year = 2026;

      // Check if it's year-first (length of segment 0 > segment 2)
      if (dSegments[0] > 100) {
        year = dSegments[0];
        month = dSegments[1] - 1;
        day = dSegments[2];
      } else {
        day = dSegments[0];
        month = dSegments[1] - 1;
        year = dSegments[2];
      }

      if (year > 2400) year -= 543; // convert Thai Buddhist BE year to AD

      const hour = tSegments[0] || 0;
      const minute = tSegments[1] || 0;
      const second = tSegments[2] || 0;

      return { year, month, day, hour, minute, second };
    }
    return null;
  };

  // Try parsing recordedAt timestamp first
  const parsedRec = parseRawDate(recordedAt);
  if (parsedRec) {
    const d = new Date(parsedRec.year, parsedRec.month, parsedRec.day, parsedRec.hour, parsedRec.minute, parsedRec.second);
    if (!isNaN(d.getTime())) {
      return d.getTime();
    }
  }

  // Fallback to dateStr with extracted hour Str
  const parsedDate = parseRawDate(dateStr);
  if (parsedDate) {
    let hr = 0;
    const hrMatch = hourStr.match(/\d+/);
    if (hrMatch) {
      hr = parseInt(hrMatch[0], 10);
    }
    const d = new Date(parsedDate.year, parsedDate.month, parsedDate.day, hr, 0, 0);
    if (!isNaN(d.getTime())) {
      return d.getTime();
    }
  }

  return 0;
};

/**
 * Universal row parser for Sheet Readings
 */
export const parseReadingsRows = (rows: string[][]): SheetReading[] => {
  const headers = rows[0].map(h => (h ? h.toString().trim().toLowerCase() : ''));

  const getIdx = (keywords: string[], defaultIdx: number): number => {
    const foundIdx = headers.findIndex(h => keywords.some(k => h.includes(k.toLowerCase())));
    return foundIdx !== -1 ? foundIdx : defaultIdx;
  };

  const recordedAtIdx = getIdx(['บันทึกเมื่อ', 'timestamp', 'recorded_at', 'recordedat', 'เวลาบันทึก', 'recorded at', 'วันเวลาที่บันทึก'], 0);
  const dateStrIdx = getIdx(['วันที่ตรวจวัด', 'วันที่', 'date', 'datestr', 'date_str'], 1);
  
  // Exclude timestamp/record columns from matching as hour
  const detectedHourIdx = headers.findIndex(h => 
    (h.includes('ชั่วโมง') || h.includes('hour') || h.includes('slot') || h === 'เวลา') && 
    !h.includes('บันทึก') && 
    !h.includes('created') && 
    !h.includes('recorded')
  );
  const hourIdx = detectedHourIdx !== -1 ? detectedHourIdx : getIdx(['เวลา', 'hour', 'time', 'ชั่วโมง', 'hour slot'], 2);
  
  const zoneNameIdx = getIdx(['พื้นที่', 'โซน', 'zone_name', 'zone_id', 'zone', 'ชื่อโซน', 'รหัสโซน', 'zone name'], 3);
  const camLabelIdx = getIdx(['กล้อง', 'camera', 'cam_label', 'cam', 'ชื่อเรียกย่อ', 'ชื่อกล้อง'], 4);
  const waterLevelIdx = getIdx(['ระดับน้ำที่วัดได้', 'ระดับน้ำ', 'ระดับ', 'water_level', 'level', 'ระดับน้ำจริง', 'water level'], 5);
  const readStatusIdx = getIdx(['สถานะตรวจวัด', 'สถานะ', 'status', 'read_status', 'สถานะภัย'], 6);
  const confidenceIdx = getIdx(['ความน่าเชื่อถือ', 'มั่นใจ', 'confidence', 'cc', 'ai confidence'], 7);
  const explanationIdx = getIdx(['คำอธิบาย', 'explanation', 'รายละเอียด', 'ข้อความ', 'ai explanation'], 8);

  const readings: SheetReading[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Robust parsing of water level
    const levelRaw = (row[waterLevelIdx] || '').toString().trim();
    let levelNum = 0;
    if (levelRaw && levelRaw !== '—') {
      const parsed = parseFloat(levelRaw.replace(/[^\d.]/g, ''));
      if (!isNaN(parsed)) {
        levelNum = parsed;
      }
    }
    
    const confRaw = (row[confidenceIdx] || '').toString().trim();
    let confNum = 1.0;
    if (confRaw && confRaw !== '—') {
      const parsed = parseFloat(confRaw.replace(/[^\d.]/g, ''));
      if (!isNaN(parsed)) {
        confNum = parsed;
        if (confNum > 1.0) {
          confNum = confNum / 100.0; // convert e.g. "95" or "95%" to 0.95
        }
      }
    }

    readings.push({
      recordedAt: (row[recordedAtIdx] || '').toString().trim(),
      dateStr: (row[dateStrIdx] || '').toString().trim(),
      hour: (row[hourIdx] || '').toString().trim(),
      zoneName: (row[zoneNameIdx] || '').toString().trim(),
      camLabel: (row[camLabelIdx] || '').toString().trim(),
      waterLevel: levelNum,
      readStatus: (row[readStatusIdx] || '').toString().trim() || 'ปกติ',
      explanation: (row[explanationIdx] || '').toString().trim(),
      confidence: confNum,
      rowIndex: i,
    });
  }

  // Sort readings descending (latest recorded record first)
  readings.sort((a, b) => {
    const tA = getTimestampMs(a.recordedAt, a.dateStr, a.hour);
    const tB = getTimestampMs(b.recordedAt, b.dateStr, b.hour);
    if (tB !== tA) {
      return tB - tA; // Newer timestamp first
    }
    // Tie-breaker: use row index from the sheet (rendered later = row index higher)
    return (b.rowIndex || 0) - (a.rowIndex || 0);
  });

  return readings;
};

/**
 * Load Water Level Readings from Google Sheets
 */
export const loadReadingsFromGoogleSheet = async (accessToken: string, targetSheetName?: string): Promise<SheetReading[]> => {
  let sheetName = targetSheetName;
  
  if (!sheetName) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const sheetTitles: string[] = (data.sheets || []).map((s: any) => s.properties.title || '');
        
        const candidates = ['hourly_telemetry', 'hourly', 'บันทึกระดับน้ำ', 'บันทึก', 'water_levels', 'water_readings', 'readings', 'measurements', 'logs', 'sheet2'];
        const foundSheet = sheetTitles.find(title => 
          candidates.some(cand => title.toLowerCase().includes(cand)) && 
          !title.toUpperCase().includes('CCTV') && 
          !title.toUpperCase().includes('CONFIG')
        );
        
        sheetName = foundSheet || 'HOURLY_TELEMETRY';
      } else {
        sheetName = 'HOURLY_TELEMETRY';
      }
    } catch {
      sheetName = 'HOURLY_TELEMETRY';
    }
  }

  const range = `${sheetName}!A1:K1000`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load readings: ${response.statusText}`);
  }

  const data = await response.json();
  const rows = data.values as string[][];

  if (!rows || rows.length < 2) {
    return [];
  }

  return parseReadingsRows(rows);
};

/**
 * Publicly loads water level readings without Google sign-in credentials.
 */
export const loadReadingsPublicly = async (): Promise<SheetReading[]> => {
  const candidates = ['HOURLY_TELEMETRY', 'hourly_telemetry', 'บันทึกระดับน้ำ', 'water_levels', 'readings', 'Sheet2'];
  
  const results = await Promise.all(
    candidates.map(async (sheetName, index) => {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
        const response = await fetch(url);
        if (response.ok) {
          const text = await response.text();
          if (text && text.trim().length > 0 && !text.includes('HTML') && !text.includes('html')) {
            return { index, text };
          }
        }
      } catch (e) {
        // Ignore network errors or failed sheets
      }
      return null;
    })
  );

  const sortedSuccessful = results
    .filter((r): r is { index: number; text: string } => r !== null)
    .sort((a, b) => a.index - b.index);

  if (sortedSuccessful.length === 0) {
    throw new Error('Could not find any valid readings sheet publicly from candidates.');
  }

  const csvText = sortedSuccessful[0].text;

  const rows = parseCSV(csvText);
  if (!rows || rows.length < 2) {
    return [];
  }

  return parseReadingsRows(rows);
};
