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
} from '../types/storage';
import { api } from '../services/api';
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
    return mockStorage.getStorageUsage(user.id);
  }, [user, files, folders]);

  // Load active folder items
  const loadFolderContent = useCallback(
    async (folderId: string | null) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        if (folderId === null) {
          const res = await api.getRoot(user.id);
          setFolders(res.children.folders || []);
          setFiles(res.children.files || []);
        } else {
          const res = await api.getFolder(user.id, folderId);
          setFolders(res.children.folders || []);
          setFiles(res.children.files || []);
        }
      } catch (err) {
        console.error('Failed loading folder content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load folder');
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

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

  // Initial load or user change
  useEffect(() => {
    if (user && activeTab === 'files') {
      loadFolderContent(currentFolderId);
    } else if (user && activeTab === 'trash') {
      fetchTrash();
    }
  }, [user, currentFolderId, activeTab, loadFolderContent, fetchTrash]);

  // Navigation handlers
  const navigateToFolder = async (folderId: string | null, folderName?: string) => {
    setCurrentFolderId(folderId);
    setSelectedItem(null);
    if (folderId === null) {
      setBreadcrumbs([{ id: null, name: 'My Storage' }]);
    } else {
      setBreadcrumbs((prev) => {
        // If already in breadcrumbs, slice up to it
        const index = prev.findIndex((b) => b.id === folderId);
        if (index !== -1) {
          return prev.slice(0, index + 1);
        }
        return [...prev, { id: folderId, name: folderName || 'Folder' }];
      });
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

  const uploadFiles = async (fileList: FileList | File[]) => {
    if (!user) throw new Error('Not authenticated');
    const list = Array.from(fileList);
    setLoading(true);
    try {
      for (const file of list) {
        await api.uploadFile(user.id, file, currentFolderId);
      }
      await refreshCurrentFolder();
    } finally {
      setLoading(false);
    }
  };

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
