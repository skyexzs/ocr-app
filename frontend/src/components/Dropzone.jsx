import React, { useRef, useState } from 'react';
import { UploadCloud, FolderUp, FilePlus2, X, FileImage, Sparkles, AlertCircle } from 'lucide-react';

const ACCEPTED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.tiff', '.tif',
  '.heic', '.heif', '.webp', '.bmp'
];

export default function Dropzone({
  stagedFiles,
  onFilesSelected,
  onRemoveFile,
  onClearFiles,
  onStartBatch,
  onLoadSamples,
  isSubmitting,
  hasActiveBatch,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // Format byte size
  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const isAcceptedFile = (file) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    return ACCEPTED_EXTENSIONS.includes(ext);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      processSelectedFiles(e.dataTransfer.files);
    }
  };

  const processSelectedFiles = (fileList) => {
    const validFiles = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (isAcceptedFile(file)) {
        // webkitRelativePath exists on folder selection, otherwise filename
        const relPath = file.webkitRelativePath || file.name;
        validFiles.push({
          file: file,
          name: file.name,
          size: file.size,
          relativePath: relPath,
        });
      }
    }
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files) {
      processSelectedFiles(e.target.files);
    }
    e.target.value = '';
  };

  const totalBytes = stagedFiles.reduce((acc, curr) => acc + (curr.size || 0), 0);

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl mb-6">
      {/* Hidden native inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(',')}
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Main Drag-and-Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 relative group ${
          isDragOver
            ? 'border-emerald-400 bg-emerald-500/10 scale-[0.99]'
            : 'border-slate-700 hover:border-slate-500 bg-slate-900/40 hover:bg-slate-900/70'
        }`}
      >
        <div className="flex flex-col items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center mb-4 text-emerald-400 shadow-lg group-hover:scale-105 group-hover:text-emerald-300 transition duration-300">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-lg font-semibold text-white mb-1">
            Drag & Drop image files or folders here
          </h3>
          <p className="text-sm text-slate-400 max-w-md mb-4">
            Supports bulk extraction from high-resolution scans, invoices, and photos with zero cloud transfer.
          </p>

          {/* Formats pill tags */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-mono text-slate-400">
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">PNG</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">JPG/JPEG</span>
            <span className="px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 font-semibold">HEIC / HEIF</span>
            <span className="px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 font-semibold">TIFF (Multi-Page)</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">WEBP</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">BMP</span>
          </div>
        </div>
      </div>

      {/* Button Toolbars */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Upload Files Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 hover:border-slate-600 transition shadow-sm active:scale-95"
          >
            <FilePlus2 className="w-4 h-4 text-blue-400" />
            Upload Files
          </button>

          {/* Upload Folder Button */}
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 hover:border-slate-600 transition shadow-sm active:scale-95"
          >
            <FolderUp className="w-4 h-4 text-emerald-400" />
            Upload Folder (Nested)
          </button>

          {/* Quick Demo Button */}
          {onLoadSamples && (
            <button
              type="button"
              onClick={onLoadSamples}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-950/40 hover:bg-violet-900/50 text-violet-300 text-xs font-medium border border-violet-800/50 hover:border-violet-700 transition"
              title="Quick test with bundled sample documents"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              Load Sample Images
            </button>
          )}
        </div>

        {/* Staging stats & Start Button */}
        {stagedFiles.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline">
              Selected: <strong className="text-white">{stagedFiles.length}</strong> items ({formatSize(totalBytes)})
            </span>
            <button
              type="button"
              onClick={onClearFiles}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 text-xs font-medium border border-slate-700 hover:border-rose-800/50 transition"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onStartBatch}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UploadCloud className="w-4 h-4" />
              {isSubmitting ? 'Starting...' : `Start OCR (${stagedFiles.length})`}
            </button>
          </div>
        )}
      </div>

      {/* Selected Pre-upload Files List (Scrollable preview) */}
      {stagedFiles.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Staged Files to Process ({stagedFiles.length})
            </h4>
            <span className="text-xs text-slate-500 font-mono">
              Ready to submit
            </span>
          </div>
          <div className="max-h-44 overflow-y-auto pr-1 space-y-1.5">
            {stagedFiles.map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 group hover:border-slate-700"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileImage className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span className="truncate font-mono">{item.relativePath || item.name}</span>
                  {item.relativePath && item.relativePath !== item.name && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900 flex-shrink-0">
                      folder
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-[11px] text-slate-500">{formatSize(item.size)}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFile(idx);
                    }}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
