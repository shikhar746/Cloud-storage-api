import {
  User,
  Folder,
  FileItem,
  ShareItem,
  FolderContentResponse,
  TrashResponse,
  SearchResponse,
  SharedWithMeResponse,
  ResourceType,
  ShareRole,
  UploadLimits,
  BreadcrumbItem,
} from '../types/storage';

/**
 * The one and only backend. There is no second deployment and no runtime
 * override, so this is a constant rather than build-time configuration.
 *
 * It is the same origin the app itself is served from, which is what keeps the
 * auth cookies first-party — see DEPLOY.md. Written out in full so that
 * running the dev server locally still talks to the real API.
 */
export const API_BASE_URL = 'https://cloud-storage-api-hquw.onrender.com';

/** Matches the API defaults; only used when the server reports no limits. */
export const FALLBACK_UPLOAD_LIMITS: UploadLimits = {
  maxFileSizeBytes: 50 * 1024 * 1024,
  maxDirectUploadBytes: 5 * 1024 * 1024 * 1024,
};

/** Status and upload limits, used to pick the upload path. */
function fetchHealth(): Promise<Response> {
  return fetch(`${API_BASE_URL}/api/health`, { method: 'GET' });
}

/** Turns an API error envelope into the most specific message available. */
function extractErrorMessage(data: any, status: number): string {
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
  return errorMsg || `Request failed with status ${status}`;
}

export class ApiClient {
  private refreshPromise: Promise<boolean> | null = null;
  private limits: UploadLimits | null = null;

  private async refreshSession(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
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
    const url = `${API_BASE_URL}${endpoint}`;
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
      throw new Error(extractErrorMessage(data, res.status));
    }
    return data as T;
  }

  /**
   * fetch() cannot report upload progress, so anything that sends a file body
   * goes through XMLHttpRequest instead. Returns the raw response for the
   * caller to interpret — including 401, which only our own API can retry.
   */
  private xhrSend(opts: {
    method: string;
    url: string;
    body: XMLHttpRequestBodyInit;
    headers?: Record<string, string>;
    withCredentials: boolean;
    onProgress?: (loaded: number, total: number) => void;
  }): Promise<{ status: number; text: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(opts.method, opts.url, true);
      xhr.withCredentials = opts.withCredentials;

      for (const [key, value] of Object.entries(opts.headers ?? {})) {
        xhr.setRequestHeader(key, value);
      }

      if (opts.onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          // lengthComputable is false for chunked bodies; skip rather than lie
          if (e.lengthComputable) opts.onProgress!(e.loaded, e.total);
        });
      }

      xhr.addEventListener('load', () => resolve({ status: xhr.status, text: xhr.responseText }));
      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
      xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')));

      xhr.send(opts.body);
    });
  }

  /** Upload limits the server enforces, cached for the life of the connection. */
  async getLimits(): Promise<UploadLimits> {
    if (this.limits) return this.limits;

    try {
      const res = await fetchHealth();
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const reported = data?.limits;
        if (
          Number.isFinite(reported?.maxFileSizeBytes) &&
          Number.isFinite(reported?.maxDirectUploadBytes)
        ) {
          this.limits = {
            maxFileSizeBytes: reported.maxFileSizeBytes,
            maxDirectUploadBytes: reported.maxDirectUploadBytes,
          };
          return this.limits;
        }
      }
    } catch {
      // unreachable server — the upload itself will surface the real problem
    }
    // an older API that reports no limits: assume the documented defaults
    return FALLBACK_UPLOAD_LIMITS;
  }

  // Authentication
  async me(): Promise<User | null> {
    try {
      const res = await this.request<{ user: User }>('/api/auth/me');
      return res.user;
    } catch {
      return null;
    }
  }

  async login(email: string, password: string): Promise<User> {
    const res = await this.request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return res.user;
  }

  async register(name: string, email: string, password: string): Promise<User> {
    const res = await this.request<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    return res.user;
  }

  async loginWithGoogle(credential: string): Promise<User> {
    const res = await this.request<{ user: User }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
    return res.user;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Backend logout failed', e);
    }
  }

  // Folder Operations
  async getRoot(userId: string): Promise<FolderContentResponse> {
    return this.request<FolderContentResponse>('/api/folders/root');
  }

  async getFolder(userId: string, folderId: string): Promise<FolderContentResponse> {
    return this.request<FolderContentResponse>(`/api/folders/${folderId}`);
  }

  async createFolder(userId: string, name: string, parentId?: string | null): Promise<Folder> {
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
    const res = await this.request<{ folder?: Folder }> (`/api/folders/${folderId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return (res.folder || res) as Folder;
  }

  /** Ancestor chain ending at this folder, so breadcrumbs survive a refresh. */
  async getFolderPath(userId: string, folderId: string): Promise<BreadcrumbItem[]> {
    const res = await this.request<{ path: Array<{ id: string; name: string }> }>(
      `/api/folders/${folderId}/path`
    );
    return res.path || [];
  }

  async deleteFolder(userId: string, folderId: string): Promise<void> {
    return this.request<void>(`/api/folders/${folderId}`, { method: 'DELETE' });
  }

  async restoreFolder(userId: string, folderId: string): Promise<void> {
    return this.request<void>(`/api/folders/${folderId}/restore`, { method: 'PATCH' });
  }

  async permanentDeleteFolder(userId: string, folderId: string): Promise<void> {
    return this.request<void>(`/api/folders/${folderId}/permanent`, { method: 'DELETE' });
  }

  // File Operations

  /**
   * Small-file path: multipart straight at the API, which buffers the body and
   * forwards it to storage. Capped server-side at MAX_FILE_SIZE_BYTES.
   */
  async uploadFile(
    userId: string,
    file: File,
    folderId?: string | null,
    onProgress?: (loaded: number, total: number) => void,
    isRetry = false
  ): Promise<FileItem> {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) {
      formData.append('folderId', folderId);
    }

    const res = await this.xhrSend({
      method: 'POST',
      url: `${API_BASE_URL}/api/files/upload`,
      body: formData,
      withCredentials: true,
      onProgress,
    });

    // xhrSend does not run the fetch path's refresh-on-401, so do it here
    if (res.status === 401 && !isRetry && (await this.refreshSession())) {
      return this.uploadFile(userId, file, folderId, onProgress, true);
    }

    // a proxy or gateway can answer with HTML, so never assume JSON parses
    let data: any = {};
    try {
      data = res.text ? JSON.parse(res.text) : {};
    } catch {
      data = {};
    }

    if (res.status < 200 || res.status >= 300) {
      throw new Error(extractErrorMessage(data, res.status));
    }
    return (data.file || data) as FileItem;
  }

  /**
   * Large-file path: the bytes never touch the API. Ask it for a signed URL,
   * PUT the file straight to storage, then tell the API to record the row.
   */
  async uploadFileDirect(
    userId: string,
    file: File,
    folderId?: string | null,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<FileItem> {
    const ticket = await this.request<{
      storageKey: string;
      path: string;
      token: string;
      signedUrl: string;
    }>('/api/files/upload-url', {
      method: 'POST',
      body: JSON.stringify({ folderId: folderId ?? null, sizeBytes: file.size }),
    });

    // Supabase's signed upload expects a PUT of a multipart body with the file
    // under the empty field name; the signed URL already carries its token.
    const form = new FormData();
    form.append('cacheControl', '3600');
    form.append('', file);

    const put = await this.xhrSend({
      method: 'PUT',
      url: ticket.signedUrl,
      body: form,
      headers: { 'x-upsert': 'false' },
      // a different origin entirely — never send our session cookies there
      withCredentials: false,
      onProgress,
    });

    if (put.status < 200 || put.status >= 300) {
      throw new Error(`Storage rejected the upload (HTTP ${put.status})`);
    }

    const res = await this.request<{ file?: FileItem }>('/api/files/complete', {
      method: 'POST',
      body: JSON.stringify({
        storageKey: ticket.storageKey,
        name: file.name,
        folderId: folderId ?? null,
      }),
    });
    return (res.file || res) as FileItem;
  }

  /** Files in one folder, without the folder tree that getFolder also returns. */
  async listFiles(userId: string, folderId?: string | null): Promise<FileItem[]> {
    const qs = folderId ? `?folderId=${encodeURIComponent(folderId)}` : '';
    const res = await this.request<{ files: FileItem[] }>(`/api/files${qs}`);
    return res.files || [];
  }

  async getFile(userId: string, fileId: string): Promise<{ file: FileItem; signedUrl: string }> {
    return this.request<{ file: FileItem; signedUrl: string }>(`/api/files/${fileId}`);
  }

  async updateFile(
    userId: string,
    fileId: string,
    updates: { name?: string; folderId?: string | null }
  ): Promise<FileItem> {
    const res = await this.request<{ file?: FileItem }>(`/api/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return (res.file || res) as FileItem;
  }

  async deleteFile(userId: string, fileId: string): Promise<void> {
    return this.request<void>(`/api/files/${fileId}`, { method: 'DELETE' });
  }

  async restoreFile(userId: string, fileId: string): Promise<FileItem> {
    const res = await this.request<{ file?: FileItem }>(`/api/files/${fileId}/restore`, { method: 'PATCH' });
    return (res.file || res) as FileItem;
  }

  async permanentDeleteFile(userId: string, fileId: string): Promise<void> {
    return this.request<void>(`/api/files/${fileId}/permanent`, { method: 'DELETE' });
  }

  // Trash
  async getTrash(userId: string): Promise<TrashResponse> {
    return this.request<TrashResponse>('/api/folders/trash');
  }

  async emptyTrash(userId: string): Promise<void> {
    // one server-side sweep — the old client loop fired a request per item and
    // could leave the trash half emptied if any one of them failed
    return this.request<void>('/api/folders/trash', { method: 'DELETE' });
  }

  // Search
  async search(userId: string, query: string): Promise<SearchResponse> {
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

  /** Resources other people have shared directly with the signed-in user. */
  async getSharedWithMe(userId: string): Promise<SharedWithMeResponse> {
    const res = await this.request<SharedWithMeResponse>('/api/shares/shared-with-me');
    return { folders: res.folders || [], files: res.files || [] };
  }

  /** Exact-address lookup, so sharing can take an email instead of a UUID. */
  async lookupUserByEmail(email: string): Promise<User> {
    const res = await this.request<{ user: User }>(
      `/api/users/lookup?email=${encodeURIComponent(email)}`
    );
    return res.user;
  }

  async deleteShare(userId: string, shareId: string): Promise<void> {
    return this.request<void>(`/api/shares/${shareId}`, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
