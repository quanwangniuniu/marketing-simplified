import api from '../api';

export interface AdCreativeFormData {
  name: string;
  object_story_spec?: {
    page_id?: string;
    instagram_user_id?: string;
    link_data?: {
      link?: string;
      message?: string;
      name?: string;
      caption?: string;
      description?: string;
      call_to_action?: {
        type?: string;
        value?: {
          link?: string;
        };
      };
      image_hash?: string;
    };
    photo_data?: {
      caption?: string;
      image_hash?: string;
      url?: string;
    };
    video_data?: {
      video_id?: string;
      image_url?: string;
      title?: string;
      message?: string;
    };
    text_data?: {
      message?: string;
    };
  };
  authorization_category?: string;
}

export interface AdCreative {
  id: string;
  slug?: string;
  name: string;
  status: 'ACTIVE' | 'IN_PROCESS' | 'WITH_ISSUES' | 'DELETED';
  call_to_action_type: string;
  body?: string;
  actor?: any;
  object_story_spec?: {
    link_data?: {
      name?: string;
      message?: string;
      description?: string;
      link?: string;
      call_to_action?: {
        type?: string;
      };
      [key: string]: any;
    };
    photo_data?: any;
    video_data?: any;
    text_data?: any;
    [key: string]: any;
  };
  object_story_spec_link_data?: any;
  object_story_spec_photo_data?: any;
  object_story_spec_video_data?: any;
  object_story_spec_text_data?: any;
}

export interface AdCreativeListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AdCreative[];
}

export interface AdCreativeCreateResponse {
  data: {
    id: string;
    slug?: string;
  };
}

export interface ErrorResponse {
  error: string;
  code: string;
}

export const FacebookMetaAPI = {
  /**
   * Get all ad creatives with pagination, sorting, and filtering
   * GET /facebook_meta/adcreatives
   */
  getAdCreatives: async (params?: { 
    fields?: string;
    page?: number;
    page_size?: number;
    ordering?: string;
    status?: string;
    call_to_action_type?: string;
  }): Promise<AdCreativeListResponse> => {
    const response = await api.get('/api/facebook_meta/adcreatives/', { params });
    return response.data;
  },

  /**
   * Get a specific ad creative by ID
   * GET /facebook_meta/{ad_creative_id}/
   */
  getAdCreative: async (
    adCreativeId: number | string,
    params?: { fields?: string; thumbnail_width?: number; thumbnail_height?: number }
  ): Promise<AdCreative> => {
    const response = await api.get(`/api/facebook_meta/${adCreativeId}/`, { params });
    return response.data;
  },

  /**
   * Create a new ad creative
   * POST /facebook_meta/adcreatives/
   */
  createAdCreative: async (data: AdCreativeFormData): Promise<AdCreativeCreateResponse> => {
    const response = await api.post('/api/facebook_meta/adcreatives/', data);
    return response.data;
  },

  /**
   * Update an ad creative
   * PATCH /facebook_meta/{ad_creative_id}/
   */
  updateAdCreative: async (
    adCreativeId: number | string,
    data: Partial<{
      name: string;
      status: string;
      adlabels: string[];
    }>
  ): Promise<{ success: boolean }> => {
    const response = await api.patch(`/api/facebook_meta/${adCreativeId}/`, data);
    return response.data;
  },

  /**
   * Delete an ad creative
   * DELETE /facebook_meta/{ad_creative_id}/
   */
  deleteAdCreative: async (adCreativeId: number | string): Promise<{ success: boolean }> => {
    const response = await api.delete(`/api/facebook_meta/${adCreativeId}/`);
    return response.data;
  },

  /**
   * Get ad creative preview
   * GET /facebook_meta/{ad_creative_id}/preview/
   */
  getAdCreativePreview: async (
    adCreativeId: number | string,
    params: {
      ad_format: string;
      width?: number;
      height?: number;
    }
  ): Promise<any> => {
    const response = await api.get(`/api/facebook_meta/${adCreativeId}/preview/`, { params });
    return response.data;
  },

  /**
   * Get preview JSON spec by token
   * GET /facebook_meta/preview/{token}/
   */
  getPreviewJsonSpec: async (token: string): Promise<any> => {
    const response = await api.get(`/api/facebook_meta/preview/${token}/`);
    return response.data;
  },

  // Associate media files with ad creative
  associateMedia: async (adCreativeId: number | string, photoIds: number[] = [], videoIds: number[] = []) => {
    const response = await api.post(`/api/facebook_meta/${adCreativeId}/associate-media/`, {
      photo_ids: photoIds,
      video_ids: videoIds
    });
    return response.data;
  },
};

export default FacebookMetaAPI;

