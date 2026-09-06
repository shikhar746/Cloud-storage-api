export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  is_deleted?: boolean;
  owner_id?: string;
  items_count?: number;
}

export interface FileItem {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  folder_id: string | null;
  created_at: string;
  storage_key?: string;
  signedUrl?: string;
  previewUrl?: string;
  is_deleted?: boolean;
  owner_id?: string;
  content?: string; // For text/markdown preview if local
}

export type ResourceType = 'file' | 'folder';
export type ShareRole = 'viewer' | 'editor';

/** What the caller may do with a resource, as reported by the API. */
export type AccessRole = 'owner' | 'editor' | 'viewer';

export interface ShareItem {
  id: string;
  resource_type: ResourceType;
  resource_id: string;
  grantee_user_id: string;
  role: ShareRole;
  created_at?: string;
  grantee_name?: string;
  grantee_email?: string;
}

export interface FolderContentResponse {
  folder: Folder | null;
  children: {
    folders: Folder[];
    files: FileItem[];
  };
  /** Caller's access to this folder; inherited by everything inside it. */
  role?: AccessRole;
}

export interface SharedUserRef {
  id: string;
  email: string;
  name: string | null;
}

interface SharedMeta {
  share_id?: string;
  role?: AccessRole;
  shared_at?: string;
  shared_by?: SharedUserRef | null;
}

export type SharedFolder = Folder & SharedMeta;
export type SharedFile = FileItem & SharedMeta;

export interface SharedWithMeResponse {
  folders: SharedFolder[];
  files: SharedFile[];
}

/** Upload limits the API reports on its health endpoint. */
export interface UploadLimits {
  /** At or under this, upload multipart through the API. */
  maxFileSizeBytes: number;
  /** Above maxFileSizeBytes and up to this, upload straight to storage. */
  maxDirectUploadBytes: number;
}

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

/** A file queued for upload, with the folder chain it should land in. */
export interface UploadEntry {
  file: File;
  /** Folder names below the drop target; empty for a loose file. */
  path: string[];
}

export interface UploadTask {
  id: string;
  name: string;
  size: number;
  loaded: number;
  status: UploadStatus;
  /** Which of the two upload paths this file took. */
  method: 'multipart' | 'direct';
  error?: string;
}

export interface TrashResponse {
  folders: Folder[];
  files: FileItem[];
}

export interface SearchResponse {
  folders: Folder[];
  files: FileItem[];
}

export type ViewMode = 'grid' | 'list';
export type ActiveNavTab = 'files' | 'shared' | 'trash' | 'settings';
export type FileCategory = 'all' | 'image' | 'document' | 'video' | 'audio' | 'archive' | 'code';

export interface SortConfig {
  by: 'name' | 'date' | 'size';
  direction: 'asc' | 'desc';
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}
