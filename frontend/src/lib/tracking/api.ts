import api from '../api';
import type { EngagementData, TrackingConfig } from './types';

const BASE = '/api/tracking';

export async function getConfig(): Promise<TrackingConfig> {
  const res = await api.get<TrackingConfig>(`${BASE}/config/`);
  return res.data;
}

export async function getTaskEngagement(taskId: number): Promise<EngagementData> {
  const res = await api.get<EngagementData>(`${BASE}/tasks/${taskId}/engagement/`);
  return res.data;
}
