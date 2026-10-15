import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  Sliders,
  ShieldCheck,
  Check,
  AlertCircle,
  Sparkles,
  AlignLeft,
  Key,
  Eye,
  EyeOff,
  Zap,
  Globe,
  Loader2,
  CheckCircle2,
  HelpCircle,
  Cpu
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

  // API Key show/hide toggle
  const [showKey, setShowKey] = useState(false);

  // Key verification state
  const [verifyingKey, setVerifyingKey] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null); // { valid: bool, message: string }

  // Sync customPath when systemInfo loads
  useEffect(() => {
    if (systemInfo?.output_directory) {
      setCustomPath(systemInfo.output_directory);
    }
  }, [systemInfo?.output_directory]);

  // Reset verification feedback when engine or key changes
  useEffect(() => {
    setVerifyResult(null);
  }, [settings.engine_type, settings.online_api_key]);

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

  const handleVerifyKey = async () => {
    const key = (settings.online_api_key || '').trim();
    if (!key) {
      setVerifyResult({ valid: false, message: 'Please enter an API key first' });
      return;
    }

    setVerifyingKey(true);
    setVerifyResult(null);
    try {
      const res = await fetch('/api/system/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.engine_type,
          api_key: key,
          base_url: settings.online_base_url || null,
        }),
      });
      const data = await res.json();
      if (data.valid) {
        setVerifyResult({ valid: true, message: 'Key is valid and active!' });
      } else {
        setVerifyResult({ valid: false, message: data.error || 'Verification failed' });
      }
    } catch (err) {
      setVerifyResult({ valid: false, message: err.message || 'Verification request failed' });
    } finally {
      setVerifyingKey(false);
    }
  };

  const languages = systemInfo?.ocr_engine?.languages || ['eng'];
  const isSentencesMode = settings.output_format === 'sentences';
  const engineType = settings.engine_type || 'tesseract';

  // Check if active online engine has an environment key configured on server
  const geminiEngineMeta = systemInfo?.online_engines?.find((e) => e.id === 'gemini');
  const openaiEngineMeta = systemInfo?.online_engines?.find((e) => e.id === 'openai');
  const hasServerEnvKey =
    (engineType === 'gemini' && geminiEngineMeta?.has_env_key) ||
    (engineType === 'openai' && openaiEngineMeta?.has_env_key);

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

        {/* Center/Right: Human-Readable Sentences Quick Switcher & Engine Badge */}
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

          {/* Engine indicator badge */}
          {engineType === 'tesseract' ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-md border border-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 font-medium">100% Offline</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-[11px] text-slate-400">
                Tesseract {systemInfo?.ocr_engine?.version || 'v5'}
              </span>
            </div>
          ) : engineType === 'gemini' ? (
            <div className="flex items-center gap-1.5 text-xs bg-purple-950/60 text-purple-200 px-2.5 py-1 rounded-md border border-purple-800/60 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-medium">Online AI</span>
              <span className="text-purple-400/60">•</span>
              <span className="font-mono text-[11px] text-purple-300">
                {settings.online_model || 'gemini-2.0-flash'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs bg-sky-950/60 text-sky-200 px-2.5 py-1 rounded-md border border-sky-800/60 shadow-sm">
              <Zap className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-medium">Online AI</span>
              <span className="text-sky-400/60">•</span>
              <span className="font-mono text-[11px] text-sky-300">
                {settings.online_model || 'gpt-4o-mini'}
              </span>
            </div>
          )}

          {/* Advanced Settings Drawer Toggle */}
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
            <span>{isOpen ? 'Close Engine & Options' : 'Engine & Options'}</span>
          </button>
        </div>
      </div>

      {/* Expanded settings drawer */}
      {isOpen && (
        <div className="mt-5 pt-4 border-t border-slate-800/80 animate-fade-in text-xs space-y-5">
          {/* Engine Selection Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-200 font-semibold flex items-center gap-1.5 text-xs">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>Recognition Engine</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Choose local offline processing or cloud AI vision
              </span>
            </div>

            {/* 3 Engine Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Card 1: Tesseract Offline */}
              <div
                onClick={() => onUpdateSettings({ engine_type: 'tesseract' })}
                className={`cursor-pointer rounded-xl p-3 border transition relative flex flex-col justify-between ${
                  engineType === 'tesseract'
                    ? 'bg-slate-900/90 border-emerald-500/80 shadow-md shadow-emerald-950/20 ring-1 ring-emerald-500/30'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-slate-200">Offline (Tesseract)</span>
                    </div>
                    {engineType === 'tesseract' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    100% Offline & local. Zero data leaves your machine. Fast, private, supports English and Indonesian.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                  <span>No API key required</span>
                  <span className="text-emerald-400 font-medium">Default</span>
                </div>
              </div>

              {/* Card 2: Google Gemini Flash */}
              <div
                onClick={() => onUpdateSettings({
                  engine_type: 'gemini',
                  online_model: settings.online_model || 'gemini-2.0-flash',
                })}
                className={`cursor-pointer rounded-xl p-3 border transition relative flex flex-col justify-between ${
                  engineType === 'gemini'
                    ? 'bg-slate-900/90 border-purple-500/80 shadow-md shadow-purple-950/20 ring-1 ring-purple-500/30'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-slate-200">Google Gemini Flash</span>
                    </div>
                    {engineType === 'gemini' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    State-of-the-art AI Vision. Outstanding accuracy on handwriting, receipts, multi-column tables, and flowing sentences.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Cloud API (Optional)</span>
                  <span className="text-purple-400 font-medium">Ultra High Accuracy</span>
                </div>
              </div>

              {/* Card 3: OpenAI Vision */}
              <div
                onClick={() => onUpdateSettings({
                  engine_type: 'openai',
                  online_model: settings.online_model || 'gpt-4o-mini',
                })}
                className={`cursor-pointer rounded-xl p-3 border transition relative flex flex-col justify-between ${
                  engineType === 'openai'
                    ? 'bg-slate-900/90 border-sky-500/80 shadow-md shadow-sky-950/20 ring-1 ring-sky-500/30'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                        <Zap className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-slate-200">OpenAI Vision</span>
                    </div>
                    {engineType === 'openai' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    GPT-4o multimodal vision intelligence. Supports standard OpenAI keys or custom compatible proxy endpoints.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Cloud API (Optional)</span>
                  <span className="text-sky-400 font-medium">GPT-4o Vision</span>
                </div>
              </div>
            </div>
          </div>

          {/* Online Engine Configuration Card (Visible only when Gemini or OpenAI is selected) */}
          {engineType !== 'tesseract' && (
            <div className="rounded-xl p-3.5 bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {engineType === 'gemini' ? 'Google Gemini API Configuration' : 'OpenAI API Configuration'}
                  </span>
                </span>
                {hasServerEnvKey && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    Server Environment Key Detected
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* API Key Input */}
                <div className="md:col-span-2">
                  <label className="block text-slate-300 text-[11px] font-medium mb-1">
                    {engineType === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}
                    {hasServerEnvKey && <span className="text-slate-500 ml-1.5">(leave blank to use server environment key)</span>}
                  </label>
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={settings.online_api_key || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateSettings({ online_api_key: val });
                          try {
                            localStorage.setItem(`ocr_key_${engineType}`, val);
                          } catch (_) {}
                        }}
                        placeholder={
                          hasServerEnvKey
                            ? 'Using environment variable key...'
                            : engineType === 'gemini'
                            ? 'AIzaSy...'
                            : 'sk-...'
                        }
                        className="w-full px-3 py-1.5 pr-9 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        title={showKey ? 'Hide key' : 'Show key'}
                      >
                        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleVerifyKey}
                      disabled={verifyingKey || (!settings.online_api_key && !hasServerEnvKey)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {verifyingKey ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Test Key</span>
                        </>
                      )}
                    </button>
                  </div>

                  {verifyResult && (
                    <div
                      className={`mt-1.5 text-[11px] flex items-center gap-1.5 ${
                        verifyResult.valid ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {verifyResult.valid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <span>{verifyResult.message}</span>
                    </div>
                  )}
                </div>

                {/* Model Selector */}
                <div>
                  <label className="block text-slate-300 text-[11px] font-medium mb-1">
                    AI Model
                  </label>
                  <select
                    value={
                      settings.online_model ||
                      (engineType === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini')
                    }
                    onChange={(e) => onUpdateSettings({ online_model: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  >
                    {engineType === 'gemini' ? (
                      <>
                        <option value="gemini-2.0-flash">gemini-2.0-flash (Recommended)</option>
                        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                        <option value="gemini-1.5-pro">gemini-1.5-pro (High detail)</option>
                      </>
                    ) : (
                      <>
                        <option value="gpt-4o-mini">gpt-4o-mini (Fast & efficient)</option>
                        <option value="gpt-4o">gpt-4o (Full vision model)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Custom Base URL (for OpenAI proxies or compatible local models) */}
              {engineType === 'openai' && (
                <div>
                  <label className="block text-slate-300 text-[11px] font-medium mb-1">
                    Custom Base URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={settings.online_base_url || ''}
                    onChange={(e) => onUpdateSettings({ online_base_url: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              {/* Fallback Checkbox */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none text-[11px]">
                  <input
                    type="checkbox"
                    checked={settings.fallback_to_offline !== false}
                    onChange={(e) => onUpdateSettings({ fallback_to_offline: e.target.checked })}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-0 bg-slate-950 w-3.5 h-3.5"
                  />
                  <span>
                    Auto-fallback to offline Tesseract if online request fails (avoids batch stoppage)
                  </span>
                </label>
                <span className="text-[10px] text-slate-500">Safe Hybrid Mode</span>
              </div>
            </div>
          )}

          {/* Secondary Options Grid (Preprocessing, Language, Output Format, Path) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* Preprocessing Mode (relevant for Tesseract) */}
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
                {engineType === 'tesseract'
                  ? 'Optimizes scanned receipts, smartphone photos, and faded text.'
                  : 'Applied automatically when fallback to Tesseract is triggered.'}
              </p>
            </div>

            {/* Language & PSM */}
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
                    const label =
                      lang === 'ind'
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
                Language model hint and segmentation method.
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
        </div>
      )}
    </div>
  );
}
