import { User, Folder, FileItem, ShareItem, FolderContentResponse, TrashResponse, SearchResponse, ResourceType, ShareRole } from '../types/storage';
import { mockStorage } from './mockStorage';

const BASE_URL_STORAGE_KEY = 'csa_api_base_url';
const API_MODE_STORAGE_KEY = 'csa_api_mode'; // 'live' | 'sandbox'

const DEFAULT_API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'http://localhost:8080';
const DEFAULT_API_MODE =
  ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_MODE) as 'live' | 'sandbox') || 'live';

export async function checkBackendHealth(baseUrl: string): Promise<boolean> {
  try {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/`, {
      method: 'GET',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export class ApiClient {
  private baseUrl: string;
  private mode: 'live' | 'sandbox';
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    this.baseUrl = localStorage.getItem(BASE_URL_STORAGE_KEY) || DEFAULT_API_BASE_URL;
    this.mode = (localStorage.getItem(API_MODE_STORAGE_KEY) as 'live' | 'sandbox') || DEFAULT_API_MODE;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
    localStorage.setItem(BASE_URL_STORAGE_KEY, this.baseUrl);
  }

  getMode(): 'live' | 'sandbox' {
    return this.mode;
  }

  setMode(mode: 'live' | 'sandbox') {
    this.mode = mode;
    localStorage.setItem(API_MODE_STORAGE_KEY, mode);
  }

  async checkHealth(): Promise<{ ok: boolean; message: string }> {
    try {
      // Do not send Content-Type on GET to avoid unnecessary CORS preflight
      const res = await fetch(`${this.baseUrl}/`, {
        method: 'GET',
      });
      if (res.ok) {
        return { ok: true, message: 'Backend connected successfully (status: ok)' };
      }
      return { ok: false, message: `Server responded with HTTP ${res.status}` };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Could not reach server. Is CORS enabled or server running?',
      };
    }
  }

  private async refreshSession(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      credentials: 'include', // Backend uses httpOnly cookies for access/refresh tokens
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    });

    // Automatically handle token refresh on 401 for non-auth endpoints
    if (
      res.status === 401 &&
      !isRetry &&
      !endpoint.startsWith('/api/auth/login') &&
      !endpoint.startsWith('/api/auth/refresh')
    ) {
      const refreshed = await this.refreshSession();
      if (refreshed) {
        return this.request<T>(endpoint, options, true);
      }
    }

    if (res.status === 204) {
      return null as T;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Surface issues array, specific validation errors, and error codes
      let errorMsg = data?.error?.message;
      if (!errorMsg && Array.isArray(data?.error?.issues) && data.error.issues.length > 0) {
        errorMsg = data.error.issues
          .map((iss: any) => {
            const pathStr = Array.isArray(iss.path) && iss.path.length > 0 ? `${iss.path.join('.')}: ` : '';
            return `${pathStr}${iss.message || JSON.stringify(iss)}`;
          })
          .join('; ');
      }
      if (!errorMsg && data?.error?.code) {
        errorMsg = `[${data.error.code}] Validation error`;
      }
      if (!errorMsg && data?.message) {
        errorMsg = data.message;
      }
      throw new Error(errorMsg || `Request failed with status ${res.status}`);
    }
    return data as T;
  }

  // Authentication
  async me(): Promise<User | null> {
    if (this.mode === 'sandbox') {
      return mockStorage.getCurrentUser();
    }
    try {
      const res = await this.request<{ user: User }>('/api/auth/me');
      return res.user;
    } catch {
      return null;
    }
  }

  async login(email: string, password: string): Promise<User> {
    if (this.mode === 'sandbox') {
      return mockStorage.login(email, password);
    }
    const res = await this.request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return res.user;
  }

  async register(name: string, email: string, password: string): Promise<User> {
    if (this.mode === 'sandbox') {
      return mockStorage.register(name, email, password);
    }
    const res = await this.request<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    return res.user;
  }

  async logout(): Promise<void> {
    if (this.mode === 'sandbox') {
      return mockStorage.logout();
    }
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Backend logout failed', e);
    }
  }

  // Folder Operations
  async getRoot(userId: string): Promise<FolderContentResponse> {
    if (this.mode === 'sandbox') {
      return mockStorage.getRoot(userId);
    }
    return this.request<FolderContentResponse>('/api/folders/root');
  }

  async getFolder(userId: string, folderId: string): Promise<FolderContentResponse> {
    if (this.mode === 'sandbox') {
      return mockStorage.getFolder(userId, folderId);
    }
    return this.request<FolderContentResponse>(`/api/folders/${folderId}`);
  }

  async createFolder(userId: string, name: string, parentId?: string | null): Promise<Folder> {
    if (this.mode === 'sandbox') {
      return mockStorage.createFolder(userId, name, parentId);
    }
    const res = await this.request<{ folder?: Folder; id?: string; name?: string }>('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parentId: parentId ?? null }),
    });
    return (res.folder || res) as Folder;
  }

  async updateFolder(
    userId: string,
    folderId: string,
    updates: { name?: string; parentId?: string | null }
  ): Promise<Folder> {
    if (this.mode === 'sandbox') {
      return mockStorage.updateFolder(userId, folderId, updates);
    }
    const res = await this.request<{ folder?: Folder }> (`/api/folders/${folderId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return (res.folder || res) as Folder;
  }

  async deleteFolder(userId: string, folderId: string): Promise<void> {
    if (this.mode === 'sandbox') {
      return mockStorage.deleteFolder(userId, folderId);
    }
    return this.request<void>(`/api/folders/${folderId}`, { method: 'DELETE' });
  }

  async restoreFolder(userId: string, folderId: string): Promise<void> {
    if (this.mode === 'sandbox') {
      return mockStorage.restoreFolder(userId, folderId);
    }
    return this.request<void>(`/api/folders/${folderId}/restore`, { method: 'PATCH' });
  }

  async permanentDeleteFolder(userId: string, folderId: string): Promise<void> {
    if (this.mode === 'sandbox') {
      return mockStorage.permanentDeleteFolder(userId, folderId);
    }
    return this.request<void>(`/api/folders/${folderId}/permanent`, { method: 'DELETE' });
  }

  // File Operations
  async uploadFile(userId: string, file: File, folderId?: string | null): Promise<FileItem> {
    if (this.mode === 'sandbox') {
      return mockStorage.uploadFile(userId, file, folderId);
    }
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) {
      formData.append('folderId', folderId);
    }

    const res = await this.request<{ file?: FileItem }>('/api/files/upload', {
      method: 'POST',
      body: formData,
    });
    return (res.file || res) as FileItem;
  }

  async getFile(userId: string, fileId: string): Promise<{ file: FileItem; signedUrl: string }> {
    if (this.mode === 'sandbox') {
      return mockStorage.getFile(userId, fileId);
    }
    return this.request<{ file: FileItem; signedUrl: string }>(`/api/files/${fileId}`);
  }

  async updateFile(
    userId: string,
    fileId: string,
    updates: { name?: string; folderId?: string | null }
  ): Promise<FileItem> {
    if (this.mode === 'sandbox') {
      return mockStorage.updateFile(userId, fileId, updates);
    }
    const res = await this.request<{ file?: FileItem }>(`/api/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return (res.file || res) as FileItem;
  }

  async deleteFile(userId: string, fileId: string): Promise<void> {
    if (this.mode === 'sandbox') {
      return mockStorage.deleteFile(userId, fileId);
    }
    return this.request<void>(`/api/files/${fileId}`, { method: 'DELETE' });
  }

  async restoreFile(userId: string, fileId: string): Promise<FileItem> {
    if (this.mode === 'sandbox') {
      return mockStorage.restoreFile(userId, fileId);
    }
    const res = await this.request<{ file?: FileItem }>(`/api/files/${fileId}/restore`, { method: 'PATCH' });
    return (res.file || res) as FileItem;
  }

  async permanentDeleteFile(userId: string, fileId: string): Promise<void> {
    if (this.mode === 'sandbox') {
      return mockStorage.permanentDeleteFile(userId, fileId);
    }
    return this.request<void>(`/api/files/${fileId}/permanent`, { method: 'DELETE' });
  }

  // Trash
  async getTrash(userId: string): Promise<TrashResponse> {
    if (this.mode === 'sandbox') {
      return mockStorage.getTrash(userId);
    }
    return this.request<TrashResponse>('/api/folders/trash');
  }

  async emptyTrash(userId: string): Promise<void> {
    if (this.mode === 'sandbox') {
      return mockStorage.emptyTrash(userId);
    }
    const trash = await this.getTrash(userId);
    const errors: string[] = [];

    // Delete folders sequentially
    for (const folder of trash.folders) {
      try {
        await this.permanentDeleteFolder(userId, folder.id);
      } catch (err: any) {
        errors.push(`Folder "${folder.name}": ${err.message || 'Error'}`);
      }
    }

    // Delete files sequentially
    for (const file of trash.files) {
      try {
        await this.permanentDeleteFile(userId, file.id);
      } catch (err: any) {
        errors.push(`File "${file.name}": ${err.message || 'Error'}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Empty trash finished with some errors: ${errors.join(', ')}`);
    }
  }

  // Search
  async search(userId: string, query: string): Promise<SearchResponse> {
    if (this.mode === 'sandbox') {
      return mockStorage.search(userId, query);
    }
    return this.request<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`);
  }

  // Shares
  async createShare(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    granteeUserId: string,
    role: ShareRole
  ): Promise<ShareItem> {
    if (this.mode === 'sandbox') {
      return mockStorage.createShare(userId, resourceType, resourceId, granteeUserId, role);
    }
    const res = await this.request<{ share?: any } | any>('/api/shares', {
      method: 'POST',
      body: JSON.stringify({
        resourceType,
        resourceId,
        granteeUserId,
        role,
      }),
    });
    // Unwrap the envelope res.share and flatten
    const raw = res.share || res;
    return {
      id: raw.id,
      resource_type: raw.resource_type || resourceType,
      resource_id: raw.resource_id || resourceId,
      grantee_user_id: raw.grantee_user_id || raw.users?.id || granteeUserId,
      role: raw.role || role,
      created_at: raw.created_at,
      grantee_name: raw.grantee_name || raw.users?.name,
      grantee_email: raw.grantee_email || raw.users?.email,
    } as ShareItem;
  }

  async listShares(userId: string, resourceType: ResourceType, resourceId: string): Promise<ShareItem[]> {
    if (this.mode === 'sandbox') {
      return mockStorage.listShares(userId, resourceType, resourceId);
    }
    const res = await this.request<{ shares: any[] }>(`/api/shares/${resourceType}/${resourceId}`);
    const rawShares = res.shares || [];
    // Flatten the API users!grantee_user_id join
    return rawShares.map((s: any) => ({
      id: s.id,
      resource_type: s.resource_type || resourceType,
      resource_id: s.resource_id || resourceId,
      role: s.role,
      created_at: s.created_at,
      grantee_user_id: s.grantee_user_id || s.users?.id || '',
      grantee_name: s.grantee_name || s.users?.name || '',
      grantee_email: s.grantee_email || s.users?.email || '',
    }));
  }

  async deleteShare(userId: string, shareId: string): Promise<void> {
    if (this.mode === 'sandbox') {
      return mockStorage.deleteShare(userId, shareId);
    }
    return this.request<void>(`/api/shares/${shareId}`, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
