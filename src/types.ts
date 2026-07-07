export interface Camera {
  id: string;
  label: string;
  camPath: string;
  status: 'offline' | 'connecting' | 'online' | 'error';
  ipAddress?: string;
  location?: string;
}

export interface Zone {
  id: string;
  name: string;
  cams: Camera[];
}

export type VideoQuality = '480p' | '720p' | '1080p' | 'original';

export interface LogEntry {
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
  camId?: string;
}

export interface SystemStats {
  peerConnections: number;
  totalBandwidthStr: string;
  packetLossPercent: number;
  rttMs: number;
}
