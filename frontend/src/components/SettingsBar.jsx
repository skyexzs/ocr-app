import React, { useState } from 'react';
import {
  Settings,
  Folder,
  FolderOpen,
  Sliders,
  Cpu,
  ShieldCheck,
  Check,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  AlignLeft,
  FileText,
  Sparkles
} from 'lucide-react';

export default function SettingsBar({
  settings,
  onUpdateSettings,
  systemInfo,
  onOpenFolder,
  onRefreshSystemInfo,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [customPath, setCustomPath] = useState(systemInfo?.output_directory || '');
  const [pathUpdating, setPathUpdating] = useState(false);
  const [pathSuccess, setPathSuccess] = useState(false);
  const [pathError, setPathError] = useState(null);

  // Sync customPath when systemInfo loads
  React.useEffect(() => {
    if (systemInfo?.output_directory) {
      setCustomPath(systemInfo.output_directory);
    }
  }, [systemInfo?.output_directory]);

  const handleSavePath = async (e) => {
    e.preventDefault();
    if (!customPath.trim()) return;
    setPathUpdating(true);
    setPathError(null);
    try {
      const res = await fetch('/api/system/output-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: customPath.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update folder path');
      setPathSuccess(true);
      setTimeout(() => setPathSuccess(false), 2500);
      onRefreshSystemInfo?.();
    } catch (err) {
      setPathError(err.message);
    } finally {
      setPathUpdating(false);
    }
  };

  const languages = systemInfo?.ocr_engine?.languages || ['eng'];
  const isSentencesMode = settings.output_format === 'sentences';

  return (
    <div className="glass-panel p-4 rounded-2xl border border-slate-800 shadow-lg mb-6">
      {/* Top summary row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Folder indicator & open button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-xs">
            <Folder className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-slate-400">Save Destination:</span>
            <span className="font-mono text-slate-200 font-medium truncate max-w-xs sm:max-w-md">
              {systemInfo?.output_directory || './output'}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            title="Open destination directory in Finder / File Explorer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Open in OS</span>
          </button>
        </div>

        {/* Center/Right: Human-Readable Sentences Quick Switcher */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-end lg:self-auto">
          {/* Quick Segmented Toggle for Output Format */}
          <div className="flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-700/80 text-xs shadow-inner">
            <button
              type="button"
              onClick={() => onUpdateSettings({ output_format: 'visual' })}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition font-medium ${
                !isSentencesMode
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Preserve original image line breaks and column layout"
            >
              <AlignLeft className="w-3.5 h-3.5" />
              <span>Image Layout</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ output_format: 'sentences' })}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition font-medium ${
                isSentencesMode
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
              title="Transform text into natural, flowing human-readable sentences"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Flowing Sentences</span>
            </button>
          </div>

          {/* Engine badge */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-md border border-slate-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-300 font-medium">100% Offline</span>
            <span className="text-slate-600">•</span>
            <span className="font-mono text-[11px] text-slate-400">
              Tesseract {systemInfo?.ocr_engine?.version || 'v5'}
            </span>
          </div>

          {/* Advanced Settings Toggle */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              isOpen
                ? 'bg-slate-800 text-white border-slate-600'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isOpen ? 'Close' : 'Options'}</span>
          </button>
        </div>
      </div>

      {/* Expanded settings drawer */}
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in text-xs">
          {/* Output Format Selector */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Text Output Structure</span>
            </label>
            <select
              value={settings.output_format || 'visual'}
              onChange={(e) => onUpdateSettings({ output_format: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500 font-sans"
            >
              <option value="sentences">✨ Flowing Human-Readable Sentences</option>
              <option value="visual">📐 Original Image Layout & Breaks</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              {isSentencesMode
                ? 'Unwraps mid-sentence line breaks, de-hyphenates words, and capitalizes prose.'
                : 'Preserves exact visual line breaks and indentation from the scanned image.'}
            </p>
          </div>

          {/* Preprocessing Mode */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Image Pre-Processing
            </label>
            <select
              value={settings.preprocess_mode}
              onChange={(e) => onUpdateSettings({ preprocess_mode: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500 font-sans"
            >
              <option value="auto">Auto Enhanced (CLAHE + Bilateral)</option>
              <option value="threshold">Otsu Binarization (Crisp Black/White)</option>
              <option value="adaptive_threshold">Adaptive Gaussian (Uneven Lighting)</option>
              <option value="contrast">High Contrast (CLAHE Equalization)</option>
              <option value="grayscale">Grayscale Conversion</option>
              <option value="none">None (Raw Original Image)</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Optimizes scanned receipts, smartphone photos, and faded text.
            </p>
          </div>

          {/* OCR Language & PSM */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Language & Layout Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={settings.language}
                onChange={(e) => onUpdateSettings({ language: e.target.value })}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500 font-sans"
              >
                {languages.map((lang) => {
                  const label = lang === 'ind'
                    ? '🇮🇩 Indonesian (ind)'
                    : lang === 'eng'
                    ? '🇬🇧 English (eng)'
                    : lang.toUpperCase();
                  return (
                    <option key={lang} value={lang}>
                      {label}
                    </option>
                  );
                })}
              </select>

              <select
                value={settings.psm}
                onChange={(e) => onUpdateSettings({ psm: parseInt(e.target.value, 10) })}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value={3}>PSM 3 (Auto)</option>
                <option value={6}>PSM 6 (Block)</option>
                <option value={1}>PSM 1 (OSD)</option>
                <option value={11}>PSM 11 (Sparse)</option>
              </select>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Language model and segmentation method.
            </p>
          </div>

          {/* Deskew & Custom Output Folder */}
          <div className="flex flex-col justify-between">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Deskew & Directory
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 py-0.5 select-none text-[11px]">
                <input
                  type="checkbox"
                  checked={settings.auto_rotate}
                  onChange={(e) => onUpdateSettings({ auto_rotate: e.target.checked })}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-0 bg-slate-900 w-3.5 h-3.5"
                />
                <span>Auto-Deskew Orientation</span>
              </label>
            </div>

            {/* Custom Output Folder Form */}
            <form onSubmit={handleSavePath} className="mt-1">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="/Users/.../output"
                  className="flex-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={pathUpdating}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 transition"
                >
                  {pathUpdating ? '...' : pathSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : 'Set'}
                </button>
              </div>
              {pathError && (
                <span className="text-[10px] text-rose-400 block mt-0.5">{pathError}</span>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
