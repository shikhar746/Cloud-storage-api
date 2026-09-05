import { User, Folder, FileItem, ShareItem, TrashResponse, FolderContentResponse, SearchResponse, BreadcrumbItem } from '../types/storage';

const STORAGE_USERS_KEY = 'csa_mock_users';
const STORAGE_CURRENT_USER_KEY = 'csa_mock_current_user';
const STORAGE_DATA_PREFIX = 'csa_mock_data_';

const DEFAULT_DEMO_USER: User = {
  id: 'usr_demo_746a',
  name: 'Alex Rivera',
  email: 'alex.rivera@example.com',
};

const SAMPLE_IMAGE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%230f172a"/><stop offset="100%" stop-color="%231e293b"/></linearGradient></defs><rect width="800" height="500" fill="url(%23g)"/><circle cx="400" cy="250" r="120" fill="%232563eb" opacity="0.2"/><path d="M260 270 C280 200, 360 190, 400 220 C440 180, 520 190, 540 270 C560 310, 520 350, 480 350 L290 350 C240 350, 220 310, 260 270 Z" fill="%233b82f6"/><text x="400" y="420" font-family="sans-serif" font-size="22" font-weight="600" fill="%23f8fafc" text-anchor="middle">Cloud Storage Architecture Diagram</text></svg>`;

const SAMPLE_MARKDOWN = `# Project Specification & Architecture

## Overview
This cloud storage system provides high-performance object persistence, nested directory hierarchies, access control lists (ACL), and resilient multi-stage trash lifecycle management.

### Key Capabilities
- **Authentication**: JWT access & refresh token cookie rotation.
- **Hierarchical Storage**: Recursive path resolution with parent-child folder linkages.
- **Trash & Lifecycle**: 30-day soft deletion with full recursive restore and permanent purge.
- **Granular Sharing**: Viewer and Editor roles for fine-grained multi-user collaboration.
`;

function getSeedData(userId: string) {
  const rootFolders: Folder[] = [
    {
      id: 'fld_design_1',
      name: 'Design Assets & Branding',
      parent_id: null,
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      owner_id: userId,
      is_deleted: false,
    },
    {
      id: 'fld_eng_2',
      name: 'Engineering Specs',
      parent_id: null,
      created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
      owner_id: userId,
      is_deleted: false,
    },
    {
      id: 'fld_financial_3',
      name: 'Financial & Reports',
      parent_id: null,
      created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
      owner_id: userId,
      is_deleted: false,
    },
    {
      id: 'fld_sub_icons',
      name: 'Vector Icons & SVGs',
      parent_id: 'fld_design_1',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      owner_id: userId,
      is_deleted: false,
    },
  ];

  const rootFiles: FileItem[] = [
    {
      id: 'fil_arch_diagram',
      name: 'cloud-architecture-overview.svg',
      mime_type: 'image/svg+xml',
      size_bytes: 428000,
      folder_id: null,
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      owner_id: userId,
      previewUrl: SAMPLE_IMAGE_SVG,
      is_deleted: false,
    },
    {
      id: 'fil_spec_doc',
      name: 'product-specification-v2.md',
      mime_type: 'text/markdown',
      size_bytes: 18450,
      folder_id: null,
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      owner_id: userId,
      content: SAMPLE_MARKDOWN,
      is_deleted: false,
    },
    {
      id: 'fil_q3_budget',
      name: 'q3-fiscal-budget-forecast.xlsx',
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size_bytes: 1240000,
      folder_id: 'fld_financial_3',
      created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
      owner_id: userId,
      is_deleted: false,
    },
    {
      id: 'fil_api_contract',
      name: 'backend-openapi-contract.json',
      mime_type: 'application/json',
      size_bytes: 45200,
      folder_id: 'fld_eng_2',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      owner_id: userId,
      content: JSON.stringify(
        {
          openapi: '3.0.3',
          info: { title: 'Cloud Storage API', version: '1.0.0' },
          paths: {
            '/api/folders/root': { get: { summary: 'Get root folders and files' } },
            '/api/files/upload': { post: { summary: 'Upload file with multipart body' } },
          },
        },
        null,
        2
      ),
      is_deleted: false,
    },
    {
      id: 'fil_brand_logo',
      name: 'company-identity-logo.svg',
      mime_type: 'image/svg+xml',
      size_bytes: 312000,
      folder_id: 'fld_design_1',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      owner_id: userId,
      previewUrl: SAMPLE_IMAGE_SVG,
      is_deleted: false,
    },
    {
      id: 'fil_old_draft',
      name: 'deprecated-draft-v1.txt',
      mime_type: 'text/plain',
      size_bytes: 5200,
      folder_id: null,
      created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
      owner_id: userId,
      is_deleted: true, // in trash
      content: 'This draft has been moved to trash.',
    },
  ];

  const shares: ShareItem[] = [
    {
      id: 'shr_1',
      resource_type: 'folder',
      resource_id: 'fld_design_1',
      grantee_user_id: 'usr_sarah_99',
      grantee_name: 'Sarah Jenkins',
      grantee_email: 'sarah.j@company.org',
      role: 'editor',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];

  return { folders: rootFolders, files: rootFiles, shares };
}

interface UserStorageState {
  folders: Folder[];
  files: FileItem[];
  shares: ShareItem[];
}

export class MockStorageService {
  private getUserData(userId: string): UserStorageState {
    const raw = localStorage.getItem(`${STORAGE_DATA_PREFIX}${userId}`);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error('Failed parsing mock user data', e);
      }
    }
    const seed = getSeedData(userId);
    this.saveUserData(userId, seed);
    return seed;
  }

  private saveUserData(userId: string, data: UserStorageState) {
    localStorage.setItem(`${STORAGE_DATA_PREFIX}${userId}`, JSON.stringify(data));
  }

  // Authentication
  async getCurrentUser(): Promise<User | null> {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }

  async login(email: string, password: string): Promise<User> {
    // Basic validation matching backend
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email format');
    }
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const users: Array<User & { password_hash: string }> = JSON.parse(
      localStorage.getItem(STORAGE_USERS_KEY) || '[]'
    );

    let match = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!match) {
      // If logging in with demo or new credentials in sandbox
      if (email.toLowerCase().includes('demo') || email.toLowerCase() === DEFAULT_DEMO_USER.email) {
        const demo = { ...DEFAULT_DEMO_USER, email: email.toLowerCase() };
        localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(demo));
        return demo;
      }
      throw new Error('Invalid email or password');
    }

    const userObj: User = { id: match.id, name: match.name, email: match.email };
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(userObj));
    return userObj;
  }

  async register(name: string, email: string, password: string): Promise<User> {
    if (!name || name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address');
    }
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const users: Array<User & { password_hash: string }> = JSON.parse(
      localStorage.getItem(STORAGE_USERS_KEY) || '[]'
    );

    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Email already registered');
    }

    const newUser: User = {
      id: `usr_${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim(),
      email: email.toLowerCase().trim(),
    };

    users.push({ ...newUser, password_hash: 'mock_hash_' + password });
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(newUser));

    // Seed mock data for new user
    this.saveUserData(newUser.id, getSeedData(newUser.id));

    return newUser;
  }

  async logout(): Promise<void> {
    localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
  }

  async useDemoAccount(): Promise<User> {
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(DEFAULT_DEMO_USER));
    return DEFAULT_DEMO_USER;
  }

  // Folder Navigation & Operations
  async getRoot(userId: string): Promise<FolderContentResponse> {
    const data = this.getUserData(userId);
    const folders = data.folders.filter((f) => !f.is_deleted && f.parent_id === null);
    const files = data.files.filter((f) => !f.is_deleted && f.folder_id === null);

    // Compute item counts for folders
    const foldersWithCounts = folders.map((f) => {
      const childFolders = data.folders.filter((cf) => !cf.is_deleted && cf.parent_id === f.id);
      const childFiles = data.files.filter((cf) => !cf.is_deleted && cf.folder_id === f.id);
      return { ...f, items_count: childFolders.length + childFiles.length };
    });

    return {
      folder: null,
      children: {
        folders: foldersWithCounts,
        files,
      },
    };
  }

  async getFolder(userId: string, folderId: string): Promise<FolderContentResponse> {
    const data = this.getUserData(userId);
    const folder = data.folders.find((f) => f.id === folderId && !f.is_deleted);
    if (!folder) {
      throw new Error('Folder not found');
    }

    const childFolders = data.folders.filter((f) => !f.is_deleted && f.parent_id === folderId);
    const childFiles = data.files.filter((f) => !f.is_deleted && f.folder_id === folderId);

    const foldersWithCounts = childFolders.map((f) => {
      const subFolders = data.folders.filter((cf) => !cf.is_deleted && cf.parent_id === f.id);
      const subFiles = data.files.filter((cf) => !cf.is_deleted && cf.folder_id === f.id);
      return { ...f, items_count: subFolders.length + subFiles.length };
    });

    return {
      folder,
      children: {
        folders: foldersWithCounts,
        files: childFiles,
      },
    };
  }

  /** Ancestor chain ending at this folder, mirroring GET /api/folders/:id/path. */
  async getFolderPath(userId: string, folderId: string): Promise<BreadcrumbItem[]> {
    const data = this.getUserData(userId);
    const path: BreadcrumbItem[] = [];
    const seen = new Set<string>();
    let currentId: string | null = folderId;

    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const folder: Folder | undefined = data.folders.find(
        (f) => f.id === currentId && !f.is_deleted
      );
      if (!folder) break;
      path.unshift({ id: folder.id, name: folder.name });
      currentId = folder.parent_id;
    }

    return path;
  }

  async createFolder(userId: string, name: string, parentId?: string | null): Promise<Folder> {
    const data = this.getUserData(userId);
    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error('Folder name is required');
    }

    // Check duplicate
    const exists = data.folders.some(
      (f) => !f.is_deleted && f.parent_id === (parentId ?? null) && f.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      throw new Error('A folder with that name already exists in this location');
    }

    const newFolder: Folder = {
      id: `fld_${Math.random().toString(36).substring(2, 9)}`,
      name: cleanName,
      parent_id: parentId ?? null,
      created_at: new Date().toISOString(),
      owner_id: userId,
      is_deleted: false,
      items_count: 0,
    };

    data.folders.push(newFolder);
    this.saveUserData(userId, data);
    return newFolder;
  }

  async updateFolder(userId: string, folderId: string, updates: { name?: string; parentId?: string | null }): Promise<Folder> {
    const data = this.getUserData(userId);
    const folderIndex = data.folders.findIndex((f) => f.id === folderId && !f.is_deleted);
    if (folderIndex === -1) {
      throw new Error('Folder not found');
    }

    const target = data.folders[folderIndex];

    if (updates.name !== undefined) {
      const name = updates.name.trim();
      if (!name) throw new Error('Folder name cannot be empty');
      target.name = name;
    }

    if (updates.parentId !== undefined) {
      // Prevent moving folder into itself
      if (updates.parentId === folderId) {
        throw new Error('Cannot move a folder into itself');
      }
      target.parent_id = updates.parentId;
    }

    data.folders[folderIndex] = target;
    this.saveUserData(userId, data);
    return target;
  }

  async deleteFolder(userId: string, folderId: string): Promise<void> {
    const data = this.getUserData(userId);
    const folder = data.folders.find((f) => f.id === folderId && !f.is_deleted);
    if (!folder) throw new Error('Folder not found');

    folder.is_deleted = true;

    // Cascade soft-delete descendants
    const markChildren = (parentId: string) => {
      data.folders.forEach((f) => {
        if (f.parent_id === parentId) {
          f.is_deleted = true;
          markChildren(f.id);
        }
      });
      data.files.forEach((file) => {
        if (file.folder_id === parentId) {
          file.is_deleted = true;
        }
      });
    };

    markChildren(folderId);
    this.saveUserData(userId, data);
  }

  async restoreFolder(userId: string, folderId: string): Promise<void> {
    const data = this.getUserData(userId);
    const folder = data.folders.find((f) => f.id === folderId && f.is_deleted);
    if (!folder) throw new Error('Folder not found in trash');

    folder.is_deleted = false;

    // If parent is also deleted, restore to root
    if (folder.parent_id) {
      const parent = data.folders.find((f) => f.id === folder.parent_id);
      if (!parent || parent.is_deleted) {
        folder.parent_id = null;
      }
    }

    // Restore direct contents
    data.folders.forEach((f) => {
      if (f.parent_id === folderId) f.is_deleted = false;
    });
    data.files.forEach((f) => {
      if (f.folder_id === folderId) f.is_deleted = false;
    });

    this.saveUserData(userId, data);
  }

  async permanentDeleteFolder(userId: string, folderId: string): Promise<void> {
    const data = this.getUserData(userId);
    data.folders = data.folders.filter((f) => f.id !== folderId);
    data.files = data.files.filter((f) => f.folder_id !== folderId);
    this.saveUserData(userId, data);
  }

  // File Operations
  async uploadFile(userId: string, file: File, folderId?: string | null): Promise<FileItem> {
    const data = this.getUserData(userId);

    let previewUrl: string | undefined;
    let content: string | undefined;

    if (file.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(file);
    } else if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
      try {
        content = await file.text();
      } catch (e) {
        console.warn('Could not read file text', e);
      }
    }

    const newFile: FileItem = {
      id: `fil_${Math.random().toString(36).substring(2, 9)}`,
      name: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      folder_id: folderId ?? null,
      created_at: new Date().toISOString(),
      owner_id: userId,
      previewUrl,
      content,
      is_deleted: false,
    };

    data.files.unshift(newFile);
    this.saveUserData(userId, data);
    return newFile;
  }

  async getFile(userId: string, fileId: string): Promise<{ file: FileItem; signedUrl: string }> {
    const data = this.getUserData(userId);
    const file = data.files.find((f) => f.id === fileId && !f.is_deleted);
    if (!file) throw new Error('File not found');

    const downloadUrl = file.previewUrl || `https://storage.example.com/download/${file.id}/${encodeURIComponent(file.name)}?token=mock_signed_url`;
    return {
      file,
      signedUrl: downloadUrl,
    };
  }

  async updateFile(userId: string, fileId: string, updates: { name?: string; folderId?: string | null }): Promise<FileItem> {
    const data = this.getUserData(userId);
    const fileIndex = data.files.findIndex((f) => f.id === fileId && !f.is_deleted);
    if (fileIndex === -1) throw new Error('File not found');

    const target = data.files[fileIndex];
    if (updates.name !== undefined) {
      const name = updates.name.trim();
      if (!name) throw new Error('File name cannot be empty');
      target.name = name;
    }
    if (updates.folderId !== undefined) {
      target.folder_id = updates.folderId;
    }

    data.files[fileIndex] = target;
    this.saveUserData(userId, data);
    return target;
  }

  async deleteFile(userId: string, fileId: string): Promise<void> {
    const data = this.getUserData(userId);
    const file = data.files.find((f) => f.id === fileId && !f.is_deleted);
    if (!file) throw new Error('File not found');

    file.is_deleted = true;
    this.saveUserData(userId, data);
  }

  async restoreFile(userId: string, fileId: string): Promise<FileItem> {
    const data = this.getUserData(userId);
    const file = data.files.find((f) => f.id === fileId && f.is_deleted);
    if (!file) throw new Error('File not found in trash');

    file.is_deleted = false;
    // Check if parent folder is deleted; if so, move to root
    if (file.folder_id) {
      const parent = data.folders.find((f) => f.id === file.folder_id);
      if (!parent || parent.is_deleted) {
        file.folder_id = null;
      }
    }

    this.saveUserData(userId, data);
    return file;
  }

  async permanentDeleteFile(userId: string, fileId: string): Promise<void> {
    const data = this.getUserData(userId);
    data.files = data.files.filter((f) => f.id !== fileId);
    this.saveUserData(userId, data);
  }

  // Trash & Search
  async getTrash(userId: string): Promise<TrashResponse> {
    const data = this.getUserData(userId);
    const deletedFolders = data.folders.filter((f) => f.is_deleted);
    const deletedFiles = data.files.filter((f) => f.is_deleted);

    // Filter out items whose parents are also deleted to prevent duplicate cascading view
    const deletedFolderIds = new Set(deletedFolders.map((f) => f.id));
    const topLevelFolders = deletedFolders.filter(
      (f) => f.parent_id === null || !deletedFolderIds.has(f.parent_id)
    );
    const topLevelFiles = deletedFiles.filter(
      (f) => f.folder_id === null || !deletedFolderIds.has(f.folder_id)
    );

    return {
      folders: topLevelFolders,
      files: topLevelFiles,
    };
  }

  async emptyTrash(userId: string): Promise<void> {
    const data = this.getUserData(userId);
    data.folders = data.folders.filter((f) => !f.is_deleted);
    data.files = data.files.filter((f) => !f.is_deleted);
    this.saveUserData(userId, data);
  }

  async search(userId: string, query: string): Promise<SearchResponse> {
    const data = this.getUserData(userId);
    const q = query.toLowerCase().trim();
    if (!q) return { folders: [], files: [] };

    const matchingFolders = data.folders.filter(
      (f) => !f.is_deleted && f.name.toLowerCase().includes(q)
    );
    const matchingFiles = data.files.filter(
      (f) => !f.is_deleted && f.name.toLowerCase().includes(q)
    );

    return {
      folders: matchingFolders,
      files: matchingFiles,
    };
  }

  // Sharing
  async createShare(
    userId: string,
    resourceType: 'file' | 'folder',
    resourceId: string,
    granteeEmail: string,
    role: 'viewer' | 'editor'
  ): Promise<ShareItem> {
    const data = this.getUserData(userId);
    const newShare: ShareItem = {
      id: `shr_${Math.random().toString(36).substring(2, 9)}`,
      resource_type: resourceType,
      resource_id: resourceId,
      grantee_user_id: `usr_${Math.random().toString(36).substring(2, 6)}`,
      grantee_email: granteeEmail,
      grantee_name: granteeEmail.split('@')[0],
      role,
      created_at: new Date().toISOString(),
    };

    data.shares.unshift(newShare);
    this.saveUserData(userId, data);
    return newShare;
  }

  async listShares(userId: string, resourceType: 'file' | 'folder', resourceId: string): Promise<ShareItem[]> {
    const data = this.getUserData(userId);
    return data.shares.filter(
      (s) => s.resource_type === resourceType && s.resource_id === resourceId
    );
  }

  async deleteShare(userId: string, shareId: string): Promise<void> {
    const data = this.getUserData(userId);
    data.shares = data.shares.filter((s) => s.id !== shareId);
    this.saveUserData(userId, data);
  }

  // Storage calculation
  getStorageUsage(userId: string): { usedBytes: number; totalBytes: number; breakdown: Record<string, number> } {
    const data = this.getUserData(userId);
    const totalBytes = 15 * 1024 * 1024 * 1024; // 15 GB
    let usedBytes = 0;
    const breakdown: Record<string, number> = {
      images: 0,
      documents: 0,
      media: 0,
      archives: 0,
      code: 0,
      others: 0,
    };

    data.files.forEach((f) => {
      if (f.is_deleted) return;
      usedBytes += f.size_bytes;
      if (f.mime_type.startsWith('image/')) {
        breakdown.images += f.size_bytes;
      } else if (
        f.mime_type.includes('pdf') ||
        f.mime_type.includes('spreadsheet') ||
        f.mime_type.includes('document') ||
        f.mime_type.includes('presentation')
      ) {
        breakdown.documents += f.size_bytes;
      } else if (f.mime_type.startsWith('video/') || f.mime_type.startsWith('audio/')) {
        breakdown.media += f.size_bytes;
      } else if (f.mime_type.includes('zip') || f.mime_type.includes('tar') || f.mime_type.includes('compressed')) {
        breakdown.archives += f.size_bytes;
      } else if (f.mime_type.includes('json') || f.mime_type.startsWith('text/')) {
        breakdown.code += f.size_bytes;
      } else {
        breakdown.others += f.size_bytes;
      }
    });

    return { usedBytes, totalBytes, breakdown };
  }

  resetToDefaults(userId: string): void {
    const fresh = getSeedData(userId);
    this.saveUserData(userId, fresh);
  }
}

export const mockStorage = new MockStorageService();
