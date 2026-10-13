import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

export default function BatchProgress({ stats, batchStatus }) {
  if (!stats || stats.total === 0) return null;

  const percentage = Math.min(100, Math.max(0, stats.percentage || 0));
  const isFinished = batchStatus === 'completed' || (stats.completed + stats.failed === stats.total && stats.total > 0);
  const isProcessing = batchStatus === 'processing' || stats.processing > 0;

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800 shadow-xl mb-6 relative overflow-hidden">
      {/* Glow background accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {isProcessing ? (
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : isFinished ? (
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-slate-700/40 text-slate-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          )}

          <div>
            <h4 className="font-semibold text-white text-sm sm:text-base flex items-center gap-2">
              {isFinished ? (
                <span className="text-emerald-400 font-medium">Batch Extraction Finished</span>
              ) : isProcessing ? (
                <span>Batch OCR In Progress...</span>
              ) : (
                <span>Queue Ready</span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {stats.completed + stats.failed} / {stats.total} files
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {isProcessing && stats.eta_seconds > 0 ? (
                <span>Estimated completion in ~{stats.eta_seconds} seconds</span>
              ) : isFinished ? (
                <span>All recognized documents saved to output directory</span>
              ) : (
                <span>Ready to start background queue processing</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-2xl font-black font-mono tracking-tight text-white">
            {percentage}%
          </span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full h-3 bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out relative ${
            isFinished
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
              : 'bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 shadow-[0_0_12px_rgba(6,182,212,0.5)]'
          }`}
          style={{ width: `${percentage}%` }}
        >
          {isProcessing && (
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
