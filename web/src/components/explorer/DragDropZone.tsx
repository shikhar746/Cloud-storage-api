import React, { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { collectDroppedEntries } from '../../utils/dropEntries';

interface DragDropZoneProps {
  children: React.ReactNode;
}

export const DragDropZone: React.FC<DragDropZoneProps> = ({ children }) => {
  const { uploadFiles, breadcrumbs, canEdit } = useStorage();
  const [isDragging, setIsDragging] = useState(false);

  const currentName = breadcrumbs[breadcrumbs.length - 1]?.name || 'Storage';

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    // a viewer has nowhere to drop: the upload would be refused server-side
    if (canEdit && e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (canEdit && e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only turn off if leaving window/container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canEdit) return;

    // dataTransfer.files cannot see inside a dropped folder, so the entries are
    // walked instead. collectDroppedEntries reads the DataTransfer up front:
    // the browser neuters it the moment this handler returns.
    const { entries, dirs } = await collectDroppedEntries(e.dataTransfer);
    if (entries.length === 0 && dirs.length === 0) return;
    await uploadFiles(entries, dirs);
  };

  return (
    <div
      id="drag-drop-zone-container"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex-1 flex flex-col min-h-0"
    >
      {children}

      {isDragging && (
        <div
          id="drag-upload-overlay"
          className="absolute inset-0 bg-[#0a0a0a]/90 backdrop-blur-xs z-50 rounded-2xl flex flex-col items-center justify-center text-white p-6 m-2 border-2 border-dashed border-indigo-500/80 animate-in fade-in duration-150"
        >
          <div className="w-16 h-16 rounded-full bg-indigo-950/60 border border-indigo-500/40 flex items-center justify-center mb-4">
            <UploadCloud className="w-8 h-8 text-indigo-400 animate-bounce" />
          </div>
          <h3 className="text-xl font-bold">Drop files or folders to upload</h3>
          <p className="text-sm text-gray-400 mt-1">
            Uploading into <span className="font-semibold text-white">"{currentName}"</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">Folders keep their structure</p>
        </div>
      )}
    </div>
  );
};
