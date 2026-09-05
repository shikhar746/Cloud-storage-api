import React from 'react';
import { ChevronRight, ArrowLeft, HardDrive, Folder as FolderIcon } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';

export const Breadcrumbs: React.FC = () => {
  const { breadcrumbs, navigateToFolder, navigateUp, currentFolderId, folders, files } = useStorage();

  const isAtRoot = currentFolderId === null;
  const totalItems = folders.length + files.length;

  return (
    <div id="explorer-breadcrumbs" className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-1.5 flex-wrap text-sm">
        {!isAtRoot && (
          <button
            id="breadcrumbs-back-btn"
            onClick={navigateUp}
            className="p-1 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors mr-1"
            title="Go up one folder"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <React.Fragment key={crumb.id || 'root'}>
              {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
              <button
                onClick={() => navigateToFolder(crumb.id, crumb.name)}
                disabled={isLast}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                  isLast
                    ? 'text-indigo-400 font-medium cursor-default'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                {index === 0 ? (
                  <HardDrive className="w-4 h-4 text-indigo-400" />
                ) : (
                  <FolderIcon className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span>{crumb.name}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div className="hidden sm:block text-xs text-gray-500 font-medium">
        {totalItems} item{totalItems !== 1 ? 's' : ''} ({folders.length} folder{folders.length !== 1 ? 's' : ''}, {files.length} file{files.length !== 1 ? 's' : ''})
      </div>
    </div>
  );
};
