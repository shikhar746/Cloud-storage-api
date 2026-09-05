import { User, Folder, FileItem, ShareItem, FolderContentResponse, TrashResponse, SearchResponse, ResourceType, ShareRole } from '../types/storage';
import { mockStorage } from './mockStorage';

const BASE_URL_STORAGE_KEY = 'csa_api_base_url';
const API_MODE_STORAGE_KEY = 'csa_api_mode'; // 'live' | 'sandbox'

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

  constructor() {
    this.baseUrl = localStorage.getItem(BASE_URL_STORAGE_KEY) || 'http://localhost:5000';
    this.mode = (localStorage.getItem(API_MODE_STORAGE_KEY) as 'live' | 'sandbox') || 'sandbox';
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
      const res = await fetch(`${this.baseUrl}/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
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

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      credentials: 'include', // Backend uses httpOnly cookies for access/refresh tokens
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    });

    if (res.status === 204) {
      return null as T;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg = data?.error?.message || `Request failed with status ${res.status}`;
      throw new Error(errorMsg);
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
      // Try refresh
      try {
        const refreshed = await this.request<{ user: User }>('/api/auth/refresh', { method: 'POST' });
        return refreshed.user;
      } catch {
        return null;
      }
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
    // Delete permanent in parallel
    const trash = await this.getTrash(userId);
    await Promise.all([
      ...trash.folders.map((f) => this.permanentDeleteFolder(userId, f.id)),
      ...trash.files.map((file) => this.permanentDeleteFile(userId, file.id)),
    ]);
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
    granteeEmailOrId: string,
    role: ShareRole
  ): Promise<ShareItem> {
    if (this.mode === 'sandbox') {
      return mockStorage.createShare(userId, resourceType, resourceId, granteeEmailOrId, role);
    }
    return this.request<ShareItem>('/api/shares', {
      method: 'POST',
      body: JSON.stringify({
        resourceType,
        resourceId,
        granteeUserId: granteeEmailOrId,
        role,
      }),
    });
  }

  async listShares(userId: string, resourceType: ResourceType, resourceId: string): Promise<ShareItem[]> {
    if (this.mode === 'sandbox') {
      return mockStorage.listShares(userId, resourceType, resourceId);
    }
    const res = await this.request<{ shares: ShareItem[] }>(`/api/shares/${resourceType}/${resourceId}`);
    return res.shares || [];
  }

  async deleteShare(userId: string, shareId: string): Promise<void> {
    if (this.mode === 'sandbox') {
      return mockStorage.deleteShare(userId, shareId);
    }
    return this.request<void>(`/api/shares/${shareId}`, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
