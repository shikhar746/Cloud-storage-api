import React from 'react';
import {
  Folder,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  File,
} from 'lucide-react';
import { getFileCategory } from '../../utils/formatters';

interface FileIconProps {
  name: string;
  mimeType?: string;
  isFolder?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const FileIcon: React.FC<FileIconProps> = ({
  name,
  mimeType = '',
  isFolder = false,
  className = '',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
    xl: 'w-14 h-14',
  };

  const currentSize = sizeClasses[size];

  if (isFolder) {
    return (
      <div className={`flex items-center justify-center text-amber-500 ${className}`}>
        <Folder className={currentSize} fill="currentColor" fillOpacity={0.2} />
      </div>
    );
  }

  const category = getFileCategory(name, mimeType);
  const ext = name.split('.').pop()?.toLowerCase() || '';

  if (category === 'image') {
    return (
      <div className={`flex items-center justify-center text-violet-600 ${className}`}>
        <FileImage className={currentSize} />
      </div>
    );
  }

  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv' || mimeType.includes('spreadsheet')) {
    return (
      <div className={`flex items-center justify-center text-emerald-600 ${className}`}>
        <FileSpreadsheet className={currentSize} />
      </div>
    );
  }

  if (category === 'code') {
    return (
      <div className={`flex items-center justify-center text-cyan-600 ${className}`}>
        <FileCode className={currentSize} />
      </div>
    );
  }

  if (category === 'video') {
    return (
      <div className={`flex items-center justify-center text-rose-500 ${className}`}>
        <FileVideo className={currentSize} />
      </div>
    );
  }

  if (category === 'audio') {
    return (
      <div className={`flex items-center justify-center text-pink-500 ${className}`}>
        <FileAudio className={currentSize} />
      </div>
    );
  }

  if (category === 'archive') {
    return (
      <div className={`flex items-center justify-center text-amber-600 ${className}`}>
        <FileArchive className={currentSize} />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center text-blue-600 ${className}`}>
      <FileText className={currentSize} />
    </div>
  );
};
