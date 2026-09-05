import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Folder,
  FileItem,
  BreadcrumbItem,
  ViewMode,
  ActiveNavTab,
  FileCategory,
  SortConfig,
  TrashResponse,
  SearchResponse,
  SharedWithMeResponse,
  AccessRole,
  UploadTask,
  UploadLimits,
} from '../types/storage';
import { api, FALLBACK_UPLOAD_LIMITS } from '../services/api';
import { mockStorage } from '../services/mockStorage';
import { useAuth } from './AuthContext';

interface StorageContextType {
  currentFolderId: string | null;
  breadcrumbs: BreadcrumbItem[];
  folders: Folder[];
  files: FileItem[];
  loading: boolean;
  error: string | null;
  activeTab: ActiveNavTab;
  setActiveTab: (tab: ActiveNavTab) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  sortConfig: SortConfig;
  setSortConfig: React.Dispatch<React.SetStateAction<SortConfig>>;
  selectedCategory: FileCategory;
  setSelectedCategory: (cat: FileCategory) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: SearchResponse | null;
  selectedItem: { type: 'file' | 'folder'; data: FileItem | Folder } | null;
  setSelectedItem: (item: { type: 'file' | 'folder'; data: FileItem | Folder } | null) => void;

  // Access control: what the caller may do in the folder they are looking at
  currentFolderRole: AccessRole;
  canEdit: boolean;
  canShare: boolean;

  // Shared with me
  sharedWithMe: SharedWithMeResponse;
  fetchSharedWithMe: () => Promise<void>;
  sharedLoading: boolean;

  // Uploads in flight
  uploads: UploadTask[];
  uploadLimits: UploadLimits;
  clearFinishedUploads: () => void;
  
  // Navigation
  navigateToFolder: (folderId: string | null, folderName?: string) => Promise<void>;
  navigateUp: () => Promise<void>;
  refreshCurrentFolder: () => Promise<void>;

  // Operations
  createFolder: (name: string) => Promise<Folder>;
  renameFolder: (folderId: string, newName: string) => Promise<Folder>;
  deleteFolder: (folderId: string) => Promise<void>;
  restoreFolder: (folderId: string) => Promise<void>;
  permanentDeleteFolder: (folderId: string) => Promise<void>;
  moveFolder: (folderId: string, targetParentId: string | null) => Promise<void>;

  uploadFiles: (fileList: FileList | File[]) => Promise<void>;
  downloadFile: (file: FileItem) => Promise<void>;
  renameFile: (fileId: string, newName: string) => Promise<FileItem>;
  deleteFile: (fileId: string) => Promise<void>;
  restoreFile: (fileId: string) => Promise<FileItem>;
  permanentDeleteFile: (fileId: string) => Promise<void>;
  moveFile: (fileId: string, targetFolderId: string | null) => Promise<void>;

  // Trash
  trashData: TrashResponse;
  fetchTrash: () => Promise<void>;
  emptyTrash: () => Promise<void>;

  // Storage calculation
  storageUsage: { usedBytes: number; totalBytes: number; breakdown: Record<string, number> };

  // Modals
  previewFile: FileItem | null;
  setPreviewFile: (file: FileItem | null) => void;
  shareTarget: { type: 'file' | 'folder'; item: FileItem | Folder } | null;
  setShareTarget: (target: { type: 'file' | 'folder'; item: FileItem | Folder } | null) => void;
  renameTarget: { type: 'file' | 'folder'; id: string; currentName: string } | null;
  setRenameTarget: (target: { type: 'file' | 'folder'; id: string; currentName: string } | null) => void;
  moveTarget: { type: 'file' | 'folder'; id: string; name: string } | null;
  setMoveTarget: (target: { type: 'file' | 'folder'; id: string; name: string } | null) => void;
  isNewFolderOpen: boolean;
  setIsNewFolderOpen: (open: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;

  // Sidebar controls
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

/** Rounded byte size for user-facing limit messages. */
function formatLimit(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${Number(gb.toFixed(gb >= 10 ? 0 : 1))} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export const StorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, apiMode } = useAuth();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: 'My Storage' },
  ]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveNavTab>('files');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ by: 'name', direction: 'asc' });
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);

  const [selectedItem, setSelectedItem] = useState<{ type: 'file' | 'folder'; data: FileItem | Folder } | null>(null);

  // 'owner' until the API says otherwise: root only ever holds your own items
  const [currentFolderRole, setCurrentFolderRole] = useState<AccessRole>('owner');

  const [sharedWithMe, setSharedWithMe] = useState<SharedWithMeResponse>({ folders: [], files: [] });
  const [sharedLoading, setSharedLoading] = useState(false);

  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const [uploadLimits, setUploadLimits] = useState<UploadLimits>(FALLBACK_UPLOAD_LIMITS);

  // Trash state
  const [trashData, setTrashData] = useState<TrashResponse>({ folders: [], files: [] });

  // Modals state
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [shareTarget, setShareTarget] = useState<{ type: 'file' | 'folder'; item: FileItem | Folder } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ type: 'file' | 'folder'; id: string; currentName: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ type: 'file' | 'folder'; id: string; name: string } | null>(null);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Responsive sidebar state: open by default on desktop (>=1024px), closed on mobile (<1024px)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  // viewers get a read-only explorer: every mutating call would 404 or 403
  const canEdit = currentFolderRole === 'owner' || currentFolderRole === 'editor';
  const canShare = currentFolderRole === 'owner';

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  // Storage usage calculation
  const storageUsage = useMemo(() => {
    if (!user) {
      return {
        usedBytes: 0,
        totalBytes: 15 * 1024 * 1024 * 1024,
        breakdown: { images: 0, documents: 0, media: 0, archives: 0, code: 0, others: 0 },
      };
    }
    if (apiMode === 'live') {
      // Live API enforces no total quota, only a per-file ceiling.
      // Sum loaded files size_bytes client-side for honest usage.
      const breakdown = { images: 0, documents: 0, media: 0, archives: 0, code: 0, others: 0 };
      let usedBytes = 0;
      for (const f of files) {
        const bytes = f.size_bytes || 0;
        usedBytes += bytes;
        if (f.mime_type.startsWith('image/')) breakdown.images += bytes;
        else if (f.mime_type.startsWith('text/') || f.mime_type.includes('pdf') || f.mime_type.includes('document')) breakdown.documents += bytes;
        else if (f.mime_type.startsWith('video/') || f.mime_type.startsWith('audio/')) breakdown.media += bytes;
        else if (f.mime_type.includes('zip') || f.mime_type.includes('tar') || f.mime_type.includes('compressed')) breakdown.archives += bytes;
        else if (f.mime_type.includes('javascript') || f.mime_type.includes('json') || f.mime_type.includes('typescript')) breakdown.code += bytes;
        else breakdown.others += bytes;
      }
      return {
        usedBytes,
        totalBytes: 0, // 0 denotes no artificial total cap
        breakdown,
      };
    }
    return mockStorage.getStorageUsage(user.id);
  }, [user, apiMode, files]);

  // Load active folder items
  const loadFolderContent = useCallback(
    async (folderId: string | null) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const res =
          folderId === null
            ? await api.getRoot(user.id)
            : await api.getFolder(user.id, folderId);
        setFolders(res.children.folders || []);
        setFiles(res.children.files || []);
        // sandbox and older servers report no role — treat that as full access
        setCurrentFolderRole(res.role ?? 'owner');
      } catch (err) {
        console.error('Failed loading folder content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load folder');
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  // The server owns the upload thresholds; ask it rather than hard-coding them
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    api.getLimits().then((l) => {
      if (mounted) setUploadLimits(l);
    });
    return () => {
      mounted = false;
    };
  }, [user, apiMode]);

  const fetchSharedWithMe = useCallback(async () => {
    if (!user) return;
    setSharedLoading(true);
    try {
      const data = await api.getSharedWithMe(user.id);
      setSharedWithMe(data);
    } catch (err) {
      console.error('Failed to load shared items:', err);
      setError(err instanceof Error ? err.message : 'Failed to load shared items');
    } finally {
      setSharedLoading(false);
    }
  }, [user]);

  // Load trash
  const fetchTrash = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.getTrash(user.id);
      setTrashData(data);
    } catch (err) {
      console.error('Failed to load trash:', err);
    }
  }, [user]);

  // Handle Search
  useEffect(() => {
    if (!user || !searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.search(user.id, searchQuery);
        setSearchResults(res);
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  // one pass on sign-in so the sidebar badge is right before the tab is opened
  useEffect(() => {
    if (user) fetchSharedWithMe();
  }, [user, fetchSharedWithMe]);

  // Initial load or user change
  useEffect(() => {
    if (user && activeTab === 'files') {
      loadFolderContent(currentFolderId);
    } else if (user && activeTab === 'trash') {
      fetchTrash();
    } else if (user && activeTab === 'shared') {
      fetchSharedWithMe();
    }
  }, [user, currentFolderId, activeTab, loadFolderContent, fetchTrash, fetchSharedWithMe]);

  // Navigation handlers
  const navigateToFolder = async (folderId: string | null, folderName?: string) => {
    setCurrentFolderId(folderId);
    setSelectedItem(null);

    if (folderId === null) {
      setBreadcrumbs([{ id: null, name: 'My Storage' }]);
      await loadFolderContent(null);
      return;
    }

    const trail = breadcrumbs;
    const existingIndex = trail.findIndex((b) => b.id === folderId);
    const isChildOfCurrent = folders.some((f) => f.id === folderId);

    if (existingIndex !== -1) {
      // walking back up the trail we already have
      setBreadcrumbs(trail.slice(0, existingIndex + 1));
    } else if (isChildOfCurrent) {
      // stepping into something listed right here
      setBreadcrumbs([...trail, { id: folderId, name: folderName || 'Folder' }]);
    } else {
      // a jump from search or the shared list — the trail we hold says nothing
      // about where this folder sits, so ask the server for the real chain
      setBreadcrumbs([
        { id: null, name: 'My Storage' },
        { id: folderId, name: folderName || 'Folder' },
      ]);
      if (user) {
        try {
          const path = await api.getFolderPath(user.id, folderId);
          if (path.length > 0) {
            setBreadcrumbs([{ id: null, name: 'My Storage' }, ...path]);
          }
        } catch (err) {
          // a shared folder whose ancestors you cannot see still opens fine
          console.warn('Could not resolve folder path', err);
        }
      }
    }

    await loadFolderContent(folderId);
  };

  const navigateUp = async () => {
    if (breadcrumbs.length <= 1) return;
    const parent = breadcrumbs[breadcrumbs.length - 2];
    await navigateToFolder(parent.id, parent.name);
  };

  const refreshCurrentFolder = async () => {
    if (activeTab === 'files') {
      await loadFolderContent(currentFolderId);
    } else if (activeTab === 'trash') {
      await fetchTrash();
    } else if (activeTab === 'shared') {
      await fetchSharedWithMe();
    }
  };

  // Operations
  const createFolder = async (name: string) => {
    if (!user) throw new Error('Not authenticated');
    const newFolder = await api.createFolder(user.id, name, currentFolderId);
    await refreshCurrentFolder();
    return newFolder;
  };

  const renameFolder = async (folderId: string, newName: string) => {
    if (!user) throw new Error('Not authenticated');
    const updated = await api.updateFolder(user.id, folderId, { name: newName });
    await refreshCurrentFolder();
    return updated;
  };

  const deleteFolder = async (folderId: string) => {
    if (!user) throw new Error('Not authenticated');
    await api.deleteFolder(user.id, folderId);
    await refreshCurrentFolder();
    await fetchTrash();
  };

  const restoreFolder = async (folderId: string) => {
    if (!user) throw new Error('Not authenticated');
    await api.restoreFolder(user.id, folderId);
    await fetchTrash();
    await refreshCurrentFolder();
  };

  const permanentDeleteFolder = async (folderId: string) => {
    if (!user) throw new Error('Not authenticated');
    await api.permanentDeleteFolder(user.id, folderId);
    await fetchTrash();
  };

  const moveFolder = async (folderId: string, targetParentId: string | null) => {
    if (!user) throw new Error('Not authenticated');
    await api.updateFolder(user.id, folderId, { parentId: targetParentId });
    await refreshCurrentFolder();
  };

  const clearFinishedUploads = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status === 'pending' || u.status === 'uploading'));
  }, []);

  const uploadFiles = async (fileList: FileList | File[]) => {
    if (!user) throw new Error('Not authenticated');

    const list = Array.from(fileList);
    if (list.length === 0) return;

    // the thresholds come from the server, so raising MAX_FILE_SIZE_BYTES there
    // is enough — the browser does not need a matching constant
    const limits = await api.getLimits();
    setUploadLimits(limits);

    const newId = () =>
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `up_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const tasks: UploadTask[] = list.map((file) => ({
      id: newId(),
      name: file.name,
      size: file.size,
      loaded: 0,
      status: 'pending',
      method: file.size > limits.maxFileSizeBytes ? 'direct' : 'multipart',
    }));

    setUploads((prev) => [...prev, ...tasks]);
    setError(null);
    setLoading(true);

    const patch = (id: string, changes: Partial<UploadTask>) => {
      setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...changes } : u)));
    };

    const failures: string[] = [];

    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        const task = tasks[i];

        if (file.size > limits.maxDirectUploadBytes) {
          const message = `exceeds the ${formatLimit(limits.maxDirectUploadBytes)} maximum`;
          patch(task.id, { status: 'error', error: message });
          failures.push(`"${file.name}" ${message}`);
          continue;
        }

        patch(task.id, { status: 'uploading' });
        const onProgress = (loaded: number) => patch(task.id, { loaded });

        try {
          if (task.method === 'direct') {
            // too big for the API to buffer — straight to storage, then register
            await api.uploadFileDirect(user.id, file, currentFolderId, onProgress);
          } else {
            await api.uploadFile(user.id, file, currentFolderId, onProgress);
          }
          patch(task.id, { status: 'done', loaded: file.size });
        } catch (err: any) {
          const message = err?.message || 'Upload failed';
          patch(task.id, { status: 'error', error: message });
          failures.push(`"${file.name}": ${message}`);
        }
      }

      // only the file list can have changed, so skip refetching the folder tree
      try {
        setFiles(await api.listFiles(user.id, currentFolderId));
      } catch {
        await refreshCurrentFolder();
      }

      if (failures.length > 0) {
        setError(`Upload issues: ${failures.join('; ')}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = useCallback(async (file: FileItem) => {
    try {
      let url = file.signedUrl || file.previewUrl;
      if (!url && user) {
        const res = await api.getFile(user.id, file.id);
        url = res.signedUrl || res.file?.signedUrl || res.file?.previewUrl;
      }
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        throw new Error('No download URL available for this file');
      }
    } catch (err: any) {
      console.error('Failed to download file', err);
      setError(err?.message || 'Could not download file');
    }
  }, [user]);

  const renameFile = async (fileId: string, newName: string) => {
    if (!user) throw new Error('Not authenticated');
    const updated = await api.updateFile(user.id, fileId, { name: newName });
    await refreshCurrentFolder();
    return updated;
  };

  const deleteFile = async (fileId: string) => {
    if (!user) throw new Error('Not authenticated');
    await api.deleteFile(user.id, fileId);
    await refreshCurrentFolder();
    await fetchTrash();
  };

  const restoreFile = async (fileId: string) => {
    if (!user) throw new Error('Not authenticated');
    const restored = await api.restoreFile(user.id, fileId);
    await fetchTrash();
    await refreshCurrentFolder();
    return restored;
  };

  const permanentDeleteFile = async (fileId: string) => {
    if (!user) throw new Error('Not authenticated');
    await api.permanentDeleteFile(user.id, fileId);
    await fetchTrash();
  };

  const moveFile = async (fileId: string, targetFolderId: string | null) => {
    if (!user) throw new Error('Not authenticated');
    await api.updateFile(user.id, fileId, { folderId: targetFolderId });
    await refreshCurrentFolder();
  };

  const emptyTrash = async () => {
    if (!user) throw new Error('Not authenticated');
    await api.emptyTrash(user.id);
    await fetchTrash();
  };

  return (
    <StorageContext.Provider
      value={{
        currentFolderId,
        breadcrumbs,
        folders,
        files,
        loading,
        error,
        activeTab,
        setActiveTab,
        viewMode,
        setViewMode,
        sortConfig,
        setSortConfig,
        selectedCategory,
        setSelectedCategory,
        searchQuery,
        setSearchQuery,
        searchResults,
        selectedItem,
        setSelectedItem,
        currentFolderRole,
        canEdit,
        canShare,
        sharedWithMe,
        fetchSharedWithMe,
        sharedLoading,
        uploads,
        uploadLimits,
        clearFinishedUploads,
        navigateToFolder,
        navigateUp,
        refreshCurrentFolder,
        createFolder,
        renameFolder,
        deleteFolder,
        restoreFolder,
        permanentDeleteFolder,
        moveFolder,
        uploadFiles,
        downloadFile,
        renameFile,
        deleteFile,
        restoreFile,
        permanentDeleteFile,
        moveFile,
        trashData,
        fetchTrash,
        emptyTrash,
        storageUsage,
        previewFile,
        setPreviewFile,
        shareTarget,
        setShareTarget,
        renameTarget,
        setRenameTarget,
        moveTarget,
        setMoveTarget,
        isNewFolderOpen,
        setIsNewFolderOpen,
        isSettingsOpen,
        setIsSettingsOpen,
        isSidebarOpen,
        setIsSidebarOpen,
        toggleSidebar,
        closeSidebar,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
};

export const useStorage = () => {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error('useStorage must be used within a StorageProvider');
  }
  return context;
};
