// src/lib/api/assetApi.ts - Asset management API
import api from '../api';
import type { AxiosProgressEvent } from 'axios';
import { toast } from 'react-hot-toast';

// Asset types based on OpenAPI spec
export interface Asset {
  id: number;
  task: number;
  owner: number;
  team: number;
  status: 'NotSubmitted' | 'PendingReview' | 'UnderReview' | 'Approved' | 'RevisionRequired' | 'Archived';
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface AssetVersion {
  id: number;
  asset: number;
  version_number: number;
  file: string | null;
  uploaded_by: number;
  checksum: string | null;
  version_status: 'Draft' | 'Finalized';
  scan_status: 'pending' | 'scanning' | 'clean' | 'infected' | 'error';
  created_at: string;
}

// extract file name from file URL
export function extractFileNameFromUrl(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  try {
    const url = fileUrl.startsWith('http') ? new URL(fileUrl) : { pathname: fileUrl };
    const pathname = url.pathname || fileUrl;
    const fileName = pathname.split('/').pop() || '';
    const parts = fileName.split('_');
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      const extensionMatch = lastPart.match(/^[a-zA-Z0-9]{1,8}(\..+)$/);
      if (extensionMatch) {
        return parts.slice(0, -1).join('_') + extensionMatch[1];
      }
    }
    return fileName || null;
  } catch {
    return fileUrl.split('/').pop() || null;
  }
}

export interface AssetComment {
  id: number;
  asset: number;
  user: number;
  body: string;
  created_at: string;
}

export interface AssetAssignment {
  id: number;
  asset: number;
  user: number;
  role: 'reviewer' | 'approver';
  assigned_by: number;
  assigned_at: string;
  valid_until: string | null;
}

export interface AssetHistory {
  type: 'asset_created' | 'state_transition' | 'version_uploaded' | 'comment_added' | 'review_assigned';
  timestamp: string;
  user_id: number | null;
  details: any;
}

export type ReviewAction =
  | 'start_review'
  | 'approve'
  | 'reject'
  | 'acknowledge_rejection'
  | 'archive';

export interface CreateAssetRequest {
  task: number;
  team?: number;
  tags?: string[];
}

export interface CreateAssetVersionRequest {
  file: File;
}

export interface AssetListResponse {
  count: number;
  page: number;
  page_size: number;
  results: Asset[];
}

// Asset API class
export class AssetAPI {
  // Get assets list with optional task filter
  static async getAssets(taskId?: string): Promise<AssetListResponse> {
    try {
      const params = taskId ? { task: taskId } : {};
      const response = await api.get('/api/assets/', { params });
      return response.data;
    } catch (error) {
      toast.error('Failed to load assets');
      throw error;
    }
  }

  // Get single asset by ID
  static async getAsset(assetId: string): Promise<Asset> {
    try {
      const response = await api.get(`/api/assets/${assetId}/`);
      return response.data;
    } catch (error) {
      toast.error('Failed to load asset details');
      throw error;
    }
  }

  // Create new asset
  static async createAsset(data: CreateAssetRequest): Promise<Asset> {
    try {
      const response = await api.post('/api/assets/', data);
      return response.data;
    } catch (error) {
      toast.error('Failed to create asset');
      throw error;
    }
  }

  static async updateAsset(assetId: number, data: Partial<CreateAssetRequest>): Promise<Asset> {
    const response = await api.patch(`/api/assets/${assetId}/`, data);
    return response.data;
  }

  // Delete asset
  static async deleteAsset(assetId: string): Promise<void> {
    try {
      await api.delete(`/api/assets/${assetId}/`);
      toast.success('Asset deleted successfully');
    } catch (error) {
      toast.error('Failed to delete asset');
      throw error;
    }
  }

  // Get asset versions
  static async getAssetVersions(assetId: string): Promise<AssetVersion[]> {
    try {
      let url: string | null = `/api/assets/${assetId}/versions/?page=1&page_size=100`;
      const all: AssetVersion[] = [];
      while (url) {
        const resp = await api.get(url as string);
        const data: any = resp.data;
        if (Array.isArray(data)) {
          all.push(...(data as AssetVersion[]));
          url = null;
        } else {
          all.push(...((data.results || []) as AssetVersion[]));
          url = (data.next as string) || null;
        }
      }
      return all;
    } catch (error) {
      toast.error('Failed to load asset versions');
      throw error;
    }
  }

  // Create/upload a new asset version
  static async createAssetVersion(
    assetId: string,
    data: CreateAssetVersionRequest,
    opts?: { onUploadProgress?: (percent: number) => void }
  ): Promise<AssetVersion> {
    try {
      const form = new FormData();
      form.append('file', data.file);
      const response = await api.post(`/api/assets/${assetId}/versions/`, form, {
        baseURL: process.env.NEXT_PUBLIC_API_URL || undefined,
        maxBodyLength: Infinity as any,
        maxContentLength: Infinity as any,
        onUploadProgress: (evt: AxiosProgressEvent) => {
          const total = typeof evt.total === 'number' ? evt.total : undefined;
          const loaded = typeof evt.loaded === 'number' ? evt.loaded : undefined;
          const percent = typeof evt.progress === 'number'
            ? Math.round(evt.progress * 100)
            : (total && loaded ? Math.round((loaded * 100) / total) : undefined);
          if (typeof percent === 'number' && opts && typeof opts.onUploadProgress === 'function') {
            opts.onUploadProgress(percent);
          }
        },
      });
      toast.success('Asset version uploaded');
      return response.data;
    } catch (error) {
      toast.error('Failed to upload asset version');
      throw error;
    }
  }

  // Update/replace an existing asset version (Draft only)
  static async updateAssetVersion(
    assetId: string,
    versionId: string | number,
    data: { file: File },
    opts?: { onUploadProgress?: (percent: number) => void }
  ): Promise<AssetVersion> {
    try {
      const form = new FormData();
      form.append('file', data.file);
      const response = await api.put(`/api/assets/${assetId}/versions/${versionId}/`, form, {
        baseURL: process.env.NEXT_PUBLIC_API_URL || undefined,
        maxBodyLength: Infinity as any,
        maxContentLength: Infinity as any,
        onUploadProgress: (evt: AxiosProgressEvent) => {
          const total = typeof evt.total === 'number' ? evt.total : undefined;
          const loaded = typeof evt.loaded === 'number' ? evt.loaded : undefined;
          const percent = typeof evt.progress === 'number'
            ? Math.round(evt.progress * 100)
            : (total && loaded ? Math.round((loaded * 100) / total) : undefined);
          if (typeof percent === 'number' && opts && typeof opts.onUploadProgress === 'function') {
            opts.onUploadProgress(percent);
          }
        },
      });
      toast.success('Version updated');
      return response.data;
    } catch (error) {
      toast.error('Failed to update version');
      throw error;
    }
  }

  // Delete an existing asset version (Draft only)
  static async deleteAssetVersion(assetId: string, versionId: string | number): Promise<void> {
    try {
      await api.delete(`/api/assets/${assetId}/versions/${versionId}/`);
      toast.success('Version deleted');
    } catch (error) {
      toast.error('Failed to delete version');
      throw error;
    }
  }

  // Get asset comments
  static async getAssetComments(assetId: string): Promise<AssetComment[]> {
    try {
      let url: string | null = `/api/assets/${assetId}/comments/?page=1&page_size=100`;
      const all: AssetComment[] = [];
      while (url) {
        const resp = await api.get(url as string);
        const data: any = resp.data;
        if (Array.isArray(data)) {
          all.push(...(data as AssetComment[]));
          url = null;
        } else {
          all.push(...((data.results || []) as AssetComment[]));
          url = (data.next as string) || null;
        }
      }
      return all;
    } catch (error) {
      toast.error('Failed to load asset comments');
      throw error;
    }
  }

  // Create asset comment
  static async createAssetComment(assetId: string, data: { body: string }): Promise<AssetComment> {
    try {
      const response = await api.post(`/api/assets/${assetId}/comments/`, data);
      return response.data;
    } catch (error) {
      toast.error('Failed to add comment');
      throw error;
    }
  }

  // Get asset assignments
  static async getAssetAssignments(assetId: string): Promise<AssetAssignment[]> {
    try {
      const response = await api.get(`/api/assets/${assetId}/assignments/`);
      return response.data.results || [];
    } catch (error) {
      toast.error('Failed to load asset assignments');
      throw error;
    }
  }

  // Create asset assignment (reviewer/approver)
  static async createAssetAssignment(
    assetId: string,
    data: { user: number; role: 'reviewer' | 'approver' }
  ): Promise<AssetAssignment> {
    try {
      const response = await api.post(`/api/assets/${assetId}/assignments/`, data);
      toast.success('Assignment created');
      return response.data;
    } catch (error) {
      toast.error('Failed to create assignment');
      throw error;
    }
  }

  // Get asset history
  static async getAssetHistory(assetId: string): Promise<AssetHistory[]> {
    try {
      let url: string | null = `/api/assets/${assetId}/history/?page=1&page_size=100`;
      const all: AssetHistory[] = [];
      while (url) {
        const resp = await api.get(url as string);
        const data: any = resp.data;
        if (Array.isArray(data)) {
          all.push(...(data as AssetHistory[]));
          url = null;
        } else {
          all.push(...((data.results || []) as AssetHistory[]));
          url = (data.next as string) || null;
        }
      }
      return all;
    } catch (error) {
      toast.error('Failed to load asset history');
      throw error;
    }
  }

  // Publish a draft asset version -> Finalized
  static async publishAssetVersion(assetId: string, versionId: string | number): Promise<AssetVersion> {
    try {
      const response = await api.post(`/api/assets/${assetId}/versions/${versionId}/publish/`);
      toast.success('Version published');
      return response.data;
    } catch (error) {
      toast.error('Failed to publish version');
      throw error;
    }
  }

  // Submit asset for review (NotSubmitted -> PendingReview)
  static async submitAsset(assetId: string): Promise<{ status: string } | any> {
    try {
      const response = await api.put(`/api/assets/${assetId}/submit/`);
      toast.success('Asset submitted');
      return response.data;
    } catch (error) {
      toast.error('Failed to submit asset');
      throw error;
    }
  }

  // Centralized review action endpoint (PATCH /assets/{asset_id}/review/)
  static async reviewAsset(
    assetId: string,
    action: ReviewAction,
    extra?: Record<string, any>
  ): Promise<any> {
    try {
      const payload = { action, ...(extra || {}) };
      const response = await api.patch(`/api/assets/${assetId}/review/`, payload);
      // Friendly toast per action
      const actionToMsg: Record<ReviewAction, string> = {
        start_review: 'Review started',
        approve: 'Asset approved',
        reject: 'Asset rejected',
        acknowledge_rejection: 'Rejection acknowledged',
        archive: 'Asset archived',
      };
      toast.success(actionToMsg[action] || 'Action completed');
      return response.data;
    } catch (error) {
      toast.error('Failed to perform action');
      throw error;
    }
  }

  // Start review (PendingReview -> UnderReview)
  static async startReview(assetId: string): Promise<any> {
    try {
      const response = await api.put(`/api/assets/${assetId}/start_review/`);
      toast.success('Review started');
      return response.data;
    } catch (error) {
      toast.error('Failed to start review');
      throw error;
    }
  }

  // Approve (UnderReview -> Approved)
  static async approve(assetId: string): Promise<any> {
    try {
      const response = await api.put(`/api/assets/${assetId}/approve/`);
      toast.success('Asset approved');
      return response.data;
    } catch (error) {
      toast.error('Failed to approve');
      throw error;
    }
  }

  // Reject (UnderReview -> RevisionRequired)
  static async reject(assetId: string): Promise<any> {
    try {
      const response = await api.put(`/api/assets/${assetId}/reject/`);
      toast.success('Asset rejected');
      return response.data;
    } catch (error) {
      toast.error('Failed to reject');
      throw error;
    }
  }

  // Acknowledge rejection (RevisionRequired -> NotSubmitted)
  static async acknowledgeRejection(assetId: string): Promise<any> {
    try {
      const response = await api.put(`/api/assets/${assetId}/acknowledge_rejection/`);
      toast.success('Rejection acknowledged');
      return response.data;
    } catch (error) {
      toast.error('Failed to acknowledge');
      throw error;
    }
  }

  // Archive
  static async archive(assetId: string): Promise<any> {
    try {
      const response = await api.put(`/api/assets/${assetId}/archive/`);
      toast.success('Asset archived');
      return response.data;
    } catch (error) {
      toast.error('Failed to archive');
      throw error;
    }
  }
}

export default AssetAPI;
