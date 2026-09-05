import React, { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';

interface DragDropZoneProps {
  children: React.ReactNode;
}

export const DragDropZone: React.FC<DragDropZoneProps> = ({ children }) => {
  const { uploadFiles, breadcrumbs } = useStorage();
  const [isDragging, setIsDragging] = useState(false);

  const currentName = breadcrumbs[breadcrumbs.length - 1]?.name || 'Storage';

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only turn off if leaving window/container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
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
          <h3 className="text-xl font-bold">Drop files to upload</h3>
          <p className="text-sm text-gray-400 mt-1">
            Uploading into <span className="font-semibold text-white">"{currentName}"</span>
          </p>
        </div>
      )}
    </div>
  );
};
