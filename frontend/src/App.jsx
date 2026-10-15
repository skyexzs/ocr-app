import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Download,
  FolderOpen,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Zap,
  HardDrive,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

import Dropzone from './components/Dropzone';
import BatchStats from './components/BatchStats';
import BatchProgress from './components/BatchProgress';
import ResultsTable from './components/ResultsTable';
import ResultModal from './components/ResultModal';
import SettingsBar from './components/SettingsBar';

export default function App() {
  const [stagedFiles, setStagedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [batchStatus, setBatchStatus] = useState('idle'); // idle, queued, processing, completed
  const [batchStats, setBatchStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    processing: 0,
    queued: 0,
    percentage: 0,
    eta_seconds: 0,
  });
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [batchDuration, setBatchDuration] = useState(null);

  const [settings, setSettings] = useState(() => {
    let storedEngine = 'tesseract';
    let storedKey = '';
    let storedModel = 'gemini-3.5-flash';
    try {
      const e = localStorage.getItem('ocr_engine_type');
      if (e) storedEngine = e;
      if (storedEngine === 'gemini') {
        storedKey = localStorage.getItem('ocr_key_gemini') || '';
        let m = localStorage.getItem('ocr_model_gemini') || 'gemini-3.5-flash';
        if (['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-flash'].includes(m)) {
          m = 'gemini-3.5-flash';
        }
        storedModel = m;
      } else if (storedEngine === 'openai') {
        storedKey = localStorage.getItem('ocr_key_openai') || '';
        storedModel = localStorage.getItem('ocr_model_openai') || 'gpt-4o-mini';
      }
    } catch (_) {}

    return {
      preprocess_mode: 'auto',
      language: 'eng',
      enhance_contrast: true,
      auto_rotate: false,
      psm: 3,
      output_format: 'sentences',
      engine_type: storedEngine,
      online_api_key: storedKey,
      online_model: storedModel,
      online_base_url: '',
      fallback_to_offline: true,
    };
  });

  const handleUpdateSettings = (newVals) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newVals };
      try {
        if (newVals.engine_type) {
          localStorage.setItem('ocr_engine_type', newVals.engine_type);
          if (newVals.engine_type === 'gemini') {
            updated.online_api_key = localStorage.getItem('ocr_key_gemini') || '';
            let m = updated.online_model || localStorage.getItem('ocr_model_gemini') || 'gemini-3.5-flash';
            if (['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-flash'].includes(m)) {
              m = 'gemini-3.5-flash';
            }
            updated.online_model = m;
          } else if (newVals.engine_type === 'openai') {
            updated.online_api_key = localStorage.getItem('ocr_key_openai') || '';
            updated.online_model = updated.online_model || 'gpt-4o-mini';
          }
        }
        if (newVals.online_api_key !== undefined) {
          localStorage.setItem(`ocr_key_${updated.engine_type}`, newVals.online_api_key);
        }
        if (newVals.online_model !== undefined) {
          localStorage.setItem(`ocr_model_${updated.engine_type}`, newVals.online_model);
        }
      } catch (_) {}
      return updated;
    });
  };

  const eventSourceRef = useRef(null);

  // Fetch system details on mount
  const fetchSystemInfo = async () => {
    try {
      const res = await fetch('/api/system/info');
      if (res.ok) {
        const data = await res.json();
        setSystemInfo(data);
      }
    } catch (err) {
      console.error('Failed to load system info:', err);
    }
  };

  useEffect(() => {
    fetchSystemInfo();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Sync selectedItem if item status updates while modal is open
  useEffect(() => {
    if (selectedItem) {
      const updated = items.find((i) => i.id === selectedItem.id);
      if (updated) setSelectedItem(updated);
    }
  }, [items]);

  // Handle files selected in Dropzone
  const handleFilesSelected = (newFiles) => {
    setStagedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveStagedFile = (idx) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleClearStagedFiles = () => {
    setStagedFiles([]);
  };

  // 1-Click Load Demo Samples
  const handleLoadSamples = async () => {
    try {
      const res = await fetch('/api/samples');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.samples || data.samples.length === 0) return;

      const loadedFiles = [];
      for (const sample of data.samples) {
        const fileRes = await fetch(sample.url);
        const blob = await fileRes.blob();
        const file = new File([blob], sample.filename, { type: blob.type });
        loadedFiles.push({
          file,
          name: sample.filename,
          size: sample.size_bytes,
          relativePath: sample.relative_path,
        });
      }
      setStagedFiles(loadedFiles);
    } catch (err) {
      console.error('Failed to load sample files:', err);
    }
  };

  // Start Batch Execution
  const handleStartBatch = async () => {
    if (stagedFiles.length === 0 || isSubmitting) return;
    setIsSubmitting(true);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const formData = new FormData();
      const relativeMap = {};

      stagedFiles.forEach((item) => {
        formData.append('files', item.file, item.name);
        relativeMap[item.name] = item.relativePath || item.name;
      });

      formData.append('relative_paths', JSON.stringify(relativeMap));
      formData.append('language', settings.language);
      formData.append('preprocess_mode', settings.preprocess_mode);
      formData.append('enhance_contrast', settings.enhance_contrast);
      formData.append('auto_rotate', settings.auto_rotate);
      formData.append('psm', settings.psm);
      formData.append('output_format', settings.output_format);
      formData.append('engine_type', settings.engine_type || 'tesseract');
      if (settings.online_api_key) {
        formData.append('online_api_key', settings.online_api_key);
      }
      if (settings.online_model) {
        formData.append('online_model', settings.online_model);
      }
      if (settings.online_base_url) {
        formData.append('online_base_url', settings.online_base_url);
      }
      formData.append('fallback_to_offline', settings.fallback_to_offline !== false ? 'true' : 'false');

      const res = await fetch('/api/batches', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Batch creation failed');
      }

      const batch = await res.json();
      setActiveBatchId(batch.batch_id);
      setBatchStatus('queued');
      setBatchStats(batch.stats);

      // Pre-fill initial items list
      const initialItems = stagedFiles.map((s, idx) => ({
        id: `pending-${idx}`,
        filename: s.name,
        relative_path: s.relativePath,
        file_size: s.size,
        status: 'queued',
        text: '',
        word_count: 0,
        char_count: 0,
        confidence: 0,
        duration_ms: 0,
      }));
      setItems(initialItems);
      setStagedFiles([]);

      // Subscribe to Server-Sent Events (SSE)
      listenToBatchEvents(batch.batch_id);
    } catch (error) {
      alert(`Error starting batch: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Connect to SSE stream
  const listenToBatchEvents = (batchId) => {
    const sse = new EventSource(`/api/batches/${batchId}/events`);
    eventSourceRef.current = sse;

    // Handle snapshot / initial load
    sse.addEventListener('snapshot', (e) => {
      const data = JSON.parse(e.data);
      if (data.stats) setBatchStats(data.stats);
      if (data.status) setBatchStatus(data.status);
      // Fetch full batch details once
      fetchBatchDetails(batchId);
    });

    sse.addEventListener('batch_started', (e) => {
      setBatchStatus('processing');
    });

    sse.addEventListener('item_status', (e) => {
      const payload = JSON.parse(e.data);
      if (payload.stats) setBatchStats(payload.stats);

      if (payload.item) {
        setItems((prev) => {
          const index = prev.findIndex(
            (it) => it.id === payload.item.id || it.filename === payload.item.filename
          );
          if (index >= 0) {
            const next = [...prev];
            next[index] = payload.item;
            return next;
          } else {
            return [...prev, payload.item];
          }
        });
      }
    });

    sse.addEventListener('batch_completed', (e) => {
      const payload = JSON.parse(e.data);
      setBatchStatus('completed');
      if (payload.stats) setBatchStats(payload.stats);
      if (payload.duration_seconds) setBatchDuration(payload.duration_seconds);
      fetchBatchDetails(batchId);
      sse.close();
    });

    sse.onerror = () => {
      // Fallback: poll batch details if SSE fails
      fetchBatchDetails(batchId);
    };
  };

  const fetchBatchDetails = async (batchId) => {
    try {
      const res = await fetch(`/api/batches/${batchId}`);
      if (res.ok) {
        const data = await res.json();
        setBatchStatus(data.status);
        setBatchStats(data.stats);
        if (data.items) setItems(data.items);
      }
    } catch (err) {
      console.error('Failed to fetch batch details:', err);
    }
  };

  // Re-run single item
  const handleRerunItem = async (itemId, customMode, customFormat, customEngine, customKey, customModel) => {
    if (!activeBatchId) return;
    try {
      const params = new URLSearchParams();
      if (customMode) params.append('preprocess_mode', customMode);
      if (customFormat) params.append('output_format', customFormat);
      if (customEngine) params.append('engine_type', customEngine);
      if (customKey) params.append('online_api_key', customKey);
      if (customModel) params.append('online_model', customModel);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/batches/${activeBatchId}/items/${itemId}/rerun${queryStr}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setItems((prev) =>
            prev.map((it) => (it.id === itemId ? data.item : it))
          );
        }
      }
    } catch (err) {
      console.error('Failed to rerun item:', err);
    }
  };

  // Open native OS folder
  const handleOpenFolder = async () => {
    try {
      await fetch('/api/system/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: systemInfo?.output_directory }),
      });
    } catch (err) {
      console.error('Failed to open OS folder:', err);
    }
  };

  // Trigger browser ZIP download
  const handleDownloadZip = () => {
    if (!activeBatchId) return;
    window.location.href = `/api/batches/${activeBatchId}/export/zip`;
  };

  const completedCount = batchStats?.completed || 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 font-black">
              <FileText className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Bulk OCR Studio
                </h1>
                {settings.engine_type === 'tesseract' ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Offline
                  </span>
                ) : settings.engine_type === 'gemini' ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-400" /> Gemini AI
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-300 border border-sky-500/20 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-sky-400" /> OpenAI AI
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Batch Image-to-Text Recognition & Local Storage
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Open local folder button */}
            <button
              type="button"
              onClick={handleOpenFolder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/80 transition"
              title="Open destination folder on this Mac"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Open Output Folder</span>
            </button>

            {/* Download ZIP */}
            <button
              type="button"
              disabled={completedCount === 0}
              onClick={handleDownloadZip}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md transition ${
                completedCount > 0
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download ZIP ({completedCount})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Settings Bar */}
        <SettingsBar
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          systemInfo={systemInfo}
          onOpenFolder={handleOpenFolder}
          onRefreshSystemInfo={fetchSystemInfo}
        />

        {/* Batch Stats Summary Cards */}
        {activeBatchId && (
          <BatchStats
            stats={batchStats}
            duration={batchDuration}
            systemInfo={systemInfo}
          />
        )}

        {/* Live Batch Progress Bar */}
        {activeBatchId && (
          <BatchProgress
            stats={batchStats}
            batchStatus={batchStatus}
          />
        )}

        {/* Upload Dropzone */}
        <Dropzone
          stagedFiles={stagedFiles}
          onFilesSelected={handleFilesSelected}
          onRemoveFile={handleRemoveStagedFile}
          onClearFiles={handleClearStagedFiles}
          onStartBatch={handleStartBatch}
          onLoadSamples={handleLoadSamples}
          isSubmitting={isSubmitting}
          hasActiveBatch={Boolean(activeBatchId)}
        />

        {/* Extracted Items Table */}
        {items.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>Batch Extraction Results</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  {items.length} items
                </span>
              </h2>
            </div>
            <ResultsTable
              items={items}
              onSelectItem={(item) => setSelectedItem(item)}
              onRerunItem={handleRerunItem}
              batchId={activeBatchId}
            />
          </div>
        )}
      </main>

      {/* Side-by-side Inspection Modal */}
      {selectedItem && (
        <ResultModal
          item={selectedItem}
          batchId={activeBatchId}
          onClose={() => setSelectedItem(null)}
          onRerun={(id, mode, format) => handleRerunItem(id, mode, format)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Bulk OCR Studio — Built with FastAPI & Tesseract OCR</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" /> All operations stay 100% on your local machine
          </span>
        </div>
      </footer>
    </div>
  );
}
