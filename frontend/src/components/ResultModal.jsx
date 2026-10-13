import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
  AlignLeft
} from 'lucide-react';

export default function ResultModal({
  item,
  batchId,
  onClose,
  onRerun,
}) {
  const [copied, setCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const [isRerunning, setIsRerunning] = useState(false);
  // Allow toggling between Sentences and Visual Layout directly in the modal
  const [viewFormat, setViewFormat] = useState('sentences');

  useEffect(() => {
    setZoomLevel(1);
    setActivePage(1);
    // Initialize viewFormat to item's default or sentences
    if (item?.output_format) {
      setViewFormat(item.output_format);
    } else if (item?.sentences_text) {
      setViewFormat('sentences');
    }
  }, [item?.id]);

  if (!item) return null;

  const imageUrl = `/api/batches/${batchId}/items/${item.id}/image`;

  // Get active text based on selected viewFormat and page
  const pages = item.pages || [];
  let displayedText = '';

  if (pages.length > 0 && pages[activePage - 1]) {
    const pageObj = pages[activePage - 1];
    if (viewFormat === 'sentences') {
      displayedText = pageObj.sentences_text || pageObj.text;
    } else {
      displayedText = pageObj.text;
    }
  } else {
    if (viewFormat === 'sentences') {
      displayedText = item.sentences_text || item.text;
    } else {
      displayedText = item.raw_text || item.text;
    }
  }

  const handleCopy = () => {
    if (!displayedText) return;
    navigator.clipboard.writeText(displayedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!displayedText) return;
    const blob = new Blob([displayedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stem = item.filename.substring(0, item.filename.lastIndexOf('.')) || item.filename;
    const suffix = viewFormat === 'sentences' ? '_sentences' : '_raw';
    link.href = url;
    link.download = `${stem}${suffix}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRerun = async (newFormat) => {
    setIsRerunning(true);
    try {
      await onRerun(item.id, null, newFormat || viewFormat);
    } finally {
      setIsRerunning(false);
    }
  };

  const activeWords = displayedText ? displayedText.split(/\s+/).filter(Boolean).length : 0;
  const activeChars = displayedText ? displayedText.length : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-6xl h-[90vh] rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <h3 className="text-base font-semibold text-white truncate flex items-center gap-2">
                <span>{item.filename}</span>
                {item.confidence !== undefined && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                    {item.confidence}% confidence
                  </span>
                )}
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {viewFormat === 'sentences' ? 'Flowing Sentences' : 'Visual Layout'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono truncate">
                Saved at: <span className="text-slate-300">{item.saved_file_path || 'Pending'}</span>
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Text</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Download .txt</span>
            </button>

            <button
              type="button"
              onClick={() => handleRerun()}
              disabled={isRerunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
              title="Re-run OCR on this document"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRerunning ? 'animate-spin' : ''}`} />
              <span>Re-run</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 transition ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Split View Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 overflow-hidden">
          {/* Left: Original Image Viewer */}
          <div className="h-full flex flex-col bg-slate-950/50 overflow-hidden relative">
            {/* Image viewer toolbar */}
            <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-900/50 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-300">Original Document</span>
                {item.dimensions && (
                  <span className="font-mono text-[11px] text-slate-500">
                    ({item.dimensions.width} × {item.dimensions.height}px)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.2))}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] px-1 text-slate-400">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.2))}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                  title="Fit to View"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 ml-1"
                  title="Open Raw Image in New Tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Image Canvas with Zoom Pan */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/70">
              <div
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-w-full max-h-full flex items-center justify-center shadow-2xl"
              >
                <img
                  src={imageUrl}
                  alt={item.filename}
                  className="max-h-[70vh] object-contain rounded border border-slate-800 shadow-2xl bg-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Right: Recognized Text Viewer */}
          <div className="h-full flex flex-col bg-slate-900/30 overflow-hidden">
            {/* Text viewer toolbar */}
            <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-900/50 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                {/* Format Switcher Pills */}
                <div className="flex items-center rounded-lg bg-slate-950 p-0.5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setViewFormat('sentences')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                      viewFormat === 'sentences'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Sentences</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewFormat('visual')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                      viewFormat === 'visual'
                        ? 'bg-slate-800 text-slate-200 border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <AlignLeft className="w-3 h-3" />
                    <span>Image Layout</span>
                  </button>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                  <span>{activeWords} words</span>
                  <span>•</span>
                  <span>{activeChars} chars</span>
                </div>
              </div>

              {/* Multi-page switcher if multi-page TIFF */}
              {pages.length > 1 && (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-500 mr-1">Page:</span>
                  {pages.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePage(idx + 1)}
                      className={`px-2 py-0.5 rounded font-mono text-[11px] transition ${
                        activePage === idx + 1
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Text Editor Area */}
            <div className="flex-1 p-5 overflow-y-auto font-mono text-sm leading-relaxed text-slate-200 select-text whitespace-pre-wrap selection:bg-emerald-500/30">
              {displayedText ? (
                displayedText
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <FileText className="w-8 h-8 mb-2" />
                  <p>No text detected in this image.</p>
                  <p className="text-xs text-slate-600 mt-1">Try re-running with threshold or contrast enhancement.</p>
                </div>
              )}
            </div>

            {/* Bottom info footer */}
            <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>
                  {viewFormat === 'sentences'
                    ? 'Formatted as flowing human-readable prose'
                    : 'Formatted matching visual image layout'}
                </span>
              </div>
              <div>
                Duration: <span className="text-slate-200">{item.duration_ms || 0}ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
