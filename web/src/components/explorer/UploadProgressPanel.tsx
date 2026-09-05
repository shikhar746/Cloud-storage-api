import React from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, X, Zap } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { formatBytes } from '../../utils/formatters';

/**
 * Live upload feedback. The old flow showed one spinner for the whole batch,
 * which said nothing during a multi-hundred-megabyte transfer.
 */
export const UploadProgressPanel: React.FC = () => {
  const { uploads, clearFinishedUploads } = useStorage();

  if (uploads.length === 0) return null;

  const active = uploads.filter((u) => u.status === 'pending' || u.status === 'uploading');
  const failed = uploads.filter((u) => u.status === 'error');

  const heading =
    active.length > 0
      ? `Uploading ${active.length} file${active.length === 1 ? '' : 's'}`
      : failed.length > 0
      ? `${failed.length} upload${failed.length === 1 ? '' : 's'} failed`
      : 'Uploads complete';

  return (
    <div
      id="upload-progress-panel"
      className="fixed bottom-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[#1f1f1f] bg-[#111111] shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[#1f1f1f] bg-[#161616]">
        <div className="flex items-center gap-2 min-w-0">
          <UploadCloud
            className={`w-4 h-4 shrink-0 ${
              active.length > 0 ? 'text-indigo-400 animate-pulse' : 'text-gray-500'
            }`}
          />
          <span className="text-xs font-bold text-white truncate">{heading}</span>
        </div>
        <button
          id="upload-panel-dismiss-btn"
          onClick={clearFinishedUploads}
          className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-[#1f1f1f] transition-colors shrink-0"
          title="Dismiss finished uploads"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto divide-y divide-[#1a1a1a]">
        {uploads.map((task) => {
          const pct =
            task.status === 'done'
              ? 100
              : task.size > 0
              ? Math.min(99, Math.round((task.loaded / task.size) * 100))
              : 0;

          return (
            <div key={task.id} className="px-3.5 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {task.status === 'done' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  {task.status === 'error' && (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  )}
                  <span className="text-xs font-medium text-gray-200 truncate" title={task.name}>
                    {task.name}
                  </span>
                </div>

                <span className="text-[11px] text-gray-500 shrink-0 tabular-nums">
                  {task.status === 'error' ? 'Failed' : `${pct}%`}
                </span>
              </div>

              {task.status !== 'error' && (
                <div className="h-1 w-full rounded-full bg-[#1f1f1f] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${
                      task.status === 'done' ? 'bg-emerald-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="text-gray-500 truncate">
                  {task.status === 'error'
                    ? task.error
                    : `${formatBytes(task.loaded)} of ${formatBytes(task.size)}`}
                </span>

                {task.method === 'direct' && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-800/40 text-amber-300 font-medium shrink-0"
                    title="Too large for the API — uploaded straight to storage"
                  >
                    <Zap className="w-2.5 h-2.5" />
                    <span>Direct</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
