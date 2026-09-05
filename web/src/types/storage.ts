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
