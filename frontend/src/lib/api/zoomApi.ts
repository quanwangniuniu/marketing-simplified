import api from '../api';

export interface ZoomStatus {
  connected: boolean;
}

export interface ZoomMeeting {
  meeting_id: string;
  topic: string;
  join_url: string;
  start_url: string;
  start_time: string;
  duration: number;
}

export const zoomApi = {
  getStatus: async (): Promise<ZoomStatus> => {
    const response = await api.get('/api/v1/zoom/status/');
    return response.data;
  },

  connect: async (): Promise<{ auth_url: string }> => {
    const response = await api.get('/api/v1/zoom/connect/');
    return response.data;
  },

  disconnect: async (): Promise<void> => {
    await api.delete('/api/v1/zoom/disconnect/');
  },

  createMeeting: async (
    topic: string,
    start_time: string,
    duration: number,
  ): Promise<ZoomMeeting> => {
    const response = await api.post('/api/v1/zoom/meetings/', {
      topic,
      start_time,
      duration,
    });
    return response.data;
  },
};
