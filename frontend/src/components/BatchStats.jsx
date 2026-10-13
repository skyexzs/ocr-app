import React from 'react';
import { Files, CheckCircle2, Clock, AlertCircle, Cpu, Zap, Activity } from 'lucide-react';

export default function BatchStats({ stats, duration, systemInfo }) {
  const total = stats?.total || 0;
  const completed = stats?.completed || 0;
  const failed = stats?.failed || 0;
  const processing = stats?.processing || 0;
  const queued = stats?.queued || 0;
  const percentage = stats?.percentage || 0;
  const etaSeconds = stats?.eta_seconds || 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
      {/* Total Images */}
      <div className="glass-card p-4 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Total Queue</span>
          <Files className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tracking-tight">{total}</span>
          <span className="text-xs text-slate-400">images</span>
        </div>
      </div>

      {/* Completed */}
      <div className="glass-card p-4 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-emerald-500/30 transition">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Extracted</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-emerald-400 tracking-tight">{completed}</span>
          <span className="text-xs text-slate-400">
            {total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%'}
          </span>
        </div>
      </div>

      {/* Processing / Active */}
      <div className="glass-card p-4 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-cyan-500/30 transition">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">In Flight</span>
          <Activity className={`w-4 h-4 text-cyan-400 ${processing > 0 ? 'animate-pulse' : ''}`} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-cyan-400 tracking-tight">{processing}</span>
          <span className="text-xs text-slate-400">active</span>
        </div>
      </div>

      {/* Queued / Remaining */}
      <div className="glass-card p-4 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-amber-500/30 transition">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Queued</span>
          <Clock className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-amber-400 tracking-tight">{queued}</span>
          <span className="text-xs text-slate-400">pending</span>
        </div>
      </div>

      {/* Errors / Failed */}
      <div className="glass-card p-4 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-rose-500/30 transition">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Errors</span>
          <AlertCircle className={`w-4 h-4 ${failed > 0 ? 'text-rose-400' : 'text-slate-500'}`} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold tracking-tight ${failed > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
            {failed}
          </span>
          <span className="text-xs text-slate-400">failed</span>
        </div>
      </div>

      {/* Speed & ETA */}
      <div className="glass-card p-4 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-violet-500/30 transition">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Est. Remaining</span>
          <Zap className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-violet-300 tracking-tight">
            {etaSeconds > 0 ? `${etaSeconds}s` : duration ? `${duration}s` : '0s'}
          </span>
          <span className="text-xs text-slate-400">
            {etaSeconds > 0 ? 'ETA' : 'elapsed'}
          </span>
        </div>
      </div>
    </div>
  );
}
