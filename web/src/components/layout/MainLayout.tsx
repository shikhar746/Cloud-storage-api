import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from '../explorer/Breadcrumbs';
import { ExplorerToolbar } from '../explorer/ExplorerToolbar';
import { DragDropZone } from '../explorer/DragDropZone';
import { FileExplorerView } from '../explorer/FileExplorerView';
import { SharedView } from '../explorer/SharedView';
import { TrashView } from '../explorer/TrashView';
import { ItemDetailsDrawer } from '../explorer/ItemDetailsDrawer';
import { UploadProgressPanel } from '../explorer/UploadProgressPanel';

import { NewFolderModal } from '../modals/NewFolderModal';
import { RenameModal } from '../modals/RenameModal';
import { MoveModal } from '../modals/MoveModal';
import { ShareModal } from '../modals/ShareModal';
import { FilePreviewModal } from '../explorer/FilePreviewModal';
import { useStorage } from '../../context/StorageContext';

export const MainLayout: React.FC = () => {
  const { activeTab } = useStorage();

  return (
    <div id="app-main-layout" className="h-screen w-full flex flex-col bg-[#0a0a0a] text-[#e5e7eb] overflow-hidden font-sans">
      {/* Top Navigation */}
      <Header />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar />

        {/* Center Explorer Canvas */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a] p-4 sm:p-6 overflow-hidden">
          {activeTab === 'files' && (
            <>
              <Breadcrumbs />
              <ExplorerToolbar />
            </>
          )}

          <DragDropZone>
            {activeTab === 'files' && <FileExplorerView />}
            {activeTab === 'shared' && <SharedView />}
            {activeTab === 'trash' && <TrashView />}
          </DragDropZone>
        </main>

        {/* Right Details Panel */}
        <ItemDetailsDrawer />
      </div>

      {/* Modals & Dialogs */}
      <NewFolderModal />
      <RenameModal />
      <MoveModal />
      <ShareModal />
      <FilePreviewModal />

      {/* Live upload feedback, floating over whichever tab is open */}
      <UploadProgressPanel />
    </div>
  );
};
