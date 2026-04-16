import api from '../api';

export interface ZoomStatus {
  connected: boolean;
}

export interface ZoomMeeting {
  meeting_id: string;
  /** Zoom meeting instance UUID when returned by create; needed for past-meeting APIs. */
  uuid: string;
  topic: string;
  join_url: string;
  start_url: string;
  start_time: string;
  duration: number;
}

export interface ZoomMeetingLinkPayload {
  zoom_meeting_id: string;
  zoom_uuid?: string;
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

  /**
   * Persist Zoom identity on the MediaJira meeting (ZoomMeetingData). Call after createMeeting.
   */
  linkMeetingData: async (
    projectId: number,
    meetingId: number,
    payload: ZoomMeetingLinkPayload,
  ): Promise<void> => {
    await api.post('/api/v1/zoom/meetings/link/', {
      project_id: projectId,
      meeting_id: meetingId,
      zoom_meeting_id: payload.zoom_meeting_id,
      zoom_uuid: payload.zoom_uuid ?? '',
    });
  },
};
