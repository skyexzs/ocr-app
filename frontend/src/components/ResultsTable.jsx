import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Copy,
  Check,
  Eye,
  RefreshCw,
  Download,
  Search,
  ExternalLink,
  Layers,
  Folder,
  ShieldCheck,
  Sparkles,
  Zap,
  AlertTriangle
} from 'lucide-react';

export default function ResultsTable({
  items,
  onSelectItem,
  onRerunItem,
  batchId,
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [filter, setFilter] = useState('all'); // all, completed, processing, failed
  const [searchQuery, setSearchQuery] = useState('');

  // Format byte size
  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const copyToClipboard = (text, id, e) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadTextFile = (item, e) => {
    e.stopPropagation();
    if (!item.text) return;
    const blob = new Blob([item.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stem = item.filename.substring(0, item.filename.lastIndexOf('.')) || item.filename;
    link.href = url;
    link.download = `${stem}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    // Status filter
    if (filter === 'completed' && item.status !== 'completed') return false;
    if (filter === 'processing' && item.status !== 'processing' && item.status !== 'queued') return false;
    if (filter === 'failed' && item.status !== 'failed') return false;

    // Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = item.filename?.toLowerCase().includes(q);
      const matchPath = item.relative_path?.toLowerCase().includes(q);
      const matchText = item.text?.toLowerCase().includes(q);
      if (!matchName && !matchPath && !matchText) return false;
    }

    return true;
  });

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 shadow-xl overflow-hidden mb-8">
      {/* Table Header Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === 'all'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Items ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              filter === 'completed'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                : 'bg-slate-900/60 text-slate-400 hover:text-emerald-300'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Completed ({items.filter((i) => i.status === 'completed').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('processing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              filter === 'processing'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80'
                : 'bg-slate-900/60 text-slate-400 hover:text-cyan-300'
            }`}
          >
            <Loader2 className="w-3.5 h-3.5 text-cyan-400" />
            In Flight ({items.filter((i) => i.status === 'processing' || i.status === 'queued').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('failed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              filter === 'failed'
                ? 'bg-rose-950/80 text-rose-300 border border-rose-800/80'
                : 'bg-slate-900/60 text-slate-400 hover:text-rose-300'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            Errors ({items.filter((i) => i.status === 'failed').length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search files or text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 select-none">
            <tr>
              <th className="py-3 px-4 w-16">Preview</th>
              <th className="py-3 px-4">Document / Path</th>
              <th className="py-3 px-4">Engine</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Stats</th>
              <th className="py-3 px-4">Confidence</th>
              <th className="py-3 px-4">Duration</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="w-8 h-8 text-slate-600" />
                    <span>No document records match the selected filter.</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isCompleted = item.status === 'completed';
                const isProcessing = item.status === 'processing';
                const isQueued = item.status === 'queued';
                const isFailed = item.status === 'failed';

                return (
                  <tr
                    key={item.id}
                    onClick={() => isCompleted && onSelectItem(item)}
                    className={`group transition hover:bg-slate-800/40 ${
                      isCompleted ? 'cursor-pointer' : ''
                    }`}
                  >
                    {/* Thumbnail */}
                    <td className="py-3 px-4">
                      <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0 relative group-hover:border-slate-700">
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.filename}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileText className="w-5 h-5 text-slate-500" />
                        )}
                        {item.pages_count > 1 && (
                          <span className="absolute bottom-0 right-0 bg-slate-950/90 text-cyan-400 text-[9px] font-mono px-1 rounded-tl">
                            {item.pages_count}p
                          </span>
                        )}
                      </div>
                    </td>

                    {/* File & Path Info */}
                    <td className="py-3 px-4 max-w-xs sm:max-w-sm">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 font-medium text-slate-200 group-hover:text-emerald-400 transition truncate">
                          <span className="truncate">{item.filename}</span>
                        </div>
                        {item.relative_path && item.relative_path !== item.filename && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate font-mono">
                            <Folder className="w-3 h-3 text-emerald-500/70" />
                            <span className="truncate">{item.relative_path}</span>
                          </div>
                        )}
                        <span className="text-[11px] text-slate-500">
                          {formatSize(item.file_size)}
                        </span>
                      </div>
                    </td>

                    {/* Engine Badge */}
                    <td className="py-3 px-4">
                      {item.engine_used ? (
                        item.engine_used.includes('gemini') ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-950/70 text-purple-300 border border-purple-800/60"
                            title={item.engine_used}
                          >
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            Gemini AI
                          </span>
                        ) : item.engine_used.includes('openai') ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-950/70 text-sky-300 border border-sky-800/60"
                            title={item.engine_used}
                          >
                            <Zap className="w-3 h-3 text-sky-400" />
                            OpenAI AI
                          </span>
                        ) : item.engine_used.includes('fallback') ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-950/70 text-amber-300 border border-amber-800/60"
                            title="Online API failed; fell back to offline Tesseract"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            Fallback
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-900 text-slate-300 border border-slate-700/80"
                            title="Offline Tesseract OCR"
                          >
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            Offline
                          </span>
                        )
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Completed
                        </span>
                      )}
                      {isProcessing && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 animate-pulse">
                          <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
                          Processing
                        </span>
                      )}
                      {isQueued && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-950/70 text-amber-300 border border-amber-800/60">
                          <Clock className="w-3 h-3 text-amber-400" />
                          Queued
                        </span>
                      )}
                      {isFailed && (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-950/70 text-rose-300 border border-rose-800/60 cursor-help"
                          title={item.error || 'Extraction error'}
                        >
                          <AlertCircle className="w-3 h-3 text-rose-400" />
                          Failed
                        </span>
                      )}
                    </td>

                    {/* Stats (Words, Chars) */}
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {isCompleted ? (
                        <div className="flex flex-col text-[11px]">
                          <span className="text-slate-200 font-semibold">{item.word_count || 0} words</span>
                          <span className="text-slate-500">{item.char_count || 0} chars</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="py-3 px-4">
                      {isCompleted && item.confidence !== undefined ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                item.confidence >= 80
                                  ? 'bg-emerald-400'
                                  : item.confidence >= 60
                                  ? 'bg-amber-400'
                                  : 'bg-rose-400'
                              }`}
                              style={{ width: `${Math.min(100, item.confidence)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-300">
                            {item.confidence}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {item.duration_ms ? (
                        <span>{(item.duration_ms / 1000).toFixed(2)}s</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {/* Copy text */}
                        {isCompleted && (
                          <button
                            type="button"
                            onClick={(e) => copyToClipboard(item.text, item.id, e)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition title-tip"
                            title="Copy recognized text"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {/* View Split modal */}
                        {isCompleted && (
                          <button
                            type="button"
                            onClick={() => onSelectItem(item)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition"
                            title="Side-by-side Inspection"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Download TXT */}
                        {isCompleted && (
                          <button
                            type="button"
                            onClick={(e) => downloadTextFile(item, e)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-blue-400 transition"
                            title="Download .txt"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Re-run OCR */}
                        <button
                          type="button"
                          onClick={() => onRerunItem(item.id)}
                          disabled={isProcessing}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition disabled:opacity-30"
                          title="Re-run OCR"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
