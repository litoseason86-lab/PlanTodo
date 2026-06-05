import {Pause, Play, Square} from 'lucide-react';

import type {TaskExecutionSession} from '../../../../shared/domain/entities';

interface FocusPanelProps {
  styleContext: {
    primary: string;
    primaryLight: string;
    secondary: string;
  };
  runningSession: TaskExecutionSession;
  focusTimeElapsed: number;
  formattedElapsed: string;
  progressOffset: number;
  handleStopSession: () => void;
  handlePauseSession: () => void;
  handleResumeSession: () => void;
}

export function FocusPanel({
  styleContext,
  runningSession,
  formattedElapsed,
  progressOffset,
  handleStopSession,
  handlePauseSession,
  handleResumeSession,
}: FocusPanelProps) {
  const isPaused = runningSession.status === 'PAUSED';

  return (
    <div className="min-h-[550px] max-w-lg mx-auto flex flex-col items-center justify-center space-y-10 py-10 fade-in-up" id="focus_stopwatch_view">
      <div className="text-center space-y-3">
        <span
          className="px-4 py-1.5 text-[11px] font-bold rounded-full uppercase tracking-widest inline-block animate-pulse"
          style={{
            color: styleContext.primary,
            backgroundColor: styleContext.primaryLight,
            border: `2px solid ${styleContext.secondary}`,
          }}
        >
          {isPaused ? '⏸ 已暂停' : '🔥 专注中'}
        </span>

        <h2 className="text-lg font-bold text-slate-700 tracking-tight mt-3">{isPaused ? '专注已暂停' : '正在专注'}</h2>
        <p
          className="text-sm font-bold px-6 py-3 rounded-2xl max-w-md mx-auto truncate mt-2 border"
          style={{
            color: styleContext.primary,
            backgroundColor: styleContext.primaryLight,
            borderColor: `${styleContext.secondary}60`,
          }}
        >
          🎯 {runningSession.taskTitle || '正在高速运行心流'}
        </p>
      </div>

      <div
        className="relative w-[240px] h-[240px] flex items-center justify-center rounded-full"
        style={{boxShadow: `0 0 60px ${styleContext.primary}15, 0 4px 20px rgba(0,0,0,0.04)`}}
      >
        <div
          className="absolute inset-[-8px] rounded-full border-2 border-dashed breathing-ring pointer-events-none"
          style={{borderColor: `${styleContext.secondary}40`}}
        />

        <div className="absolute inset-0 rounded-full bg-white border border-slate-100 shadow-inner" />

        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="120" cy="120" r="104" stroke={styleContext.primaryLight} strokeWidth="10" fill="transparent" />
          <circle
            cx="120"
            cy="120"
            r="104"
            stroke={styleContext.primary}
            strokeWidth="10"
            fill="transparent"
            strokeDasharray={653}
            strokeDashoffset={progressOffset}
            strokeLinecap="round"
            className="transition-all duration-1000"
            style={{filter: `drop-shadow(0 0 6px ${styleContext.primary}40)`}}
          />
        </svg>

        <div className="text-center space-y-1 z-10 select-all">
          <h1 className="text-4xl font-bold font-mono text-slate-800 tracking-tight tabular-nums">{formattedElapsed}</h1>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block">已专注</p>
        </div>
      </div>

      <div className="w-full flex flex-col items-center gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          {isPaused ? (
            <button
              onClick={handleResumeSession}
              className="w-full text-white font-bold text-xs py-4 rounded-2xl transition-all flex items-center justify-center gap-2.5 shadow-sm hover:shadow-md cursor-pointer active:scale-[0.99]"
              style={{backgroundColor: styleContext.primary}}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>继续专注</span>
            </button>
          ) : (
            <button
              onClick={handlePauseSession}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs py-4 rounded-2xl transition-all border-2 flex items-center justify-center gap-2.5 shadow-sm hover:shadow-md cursor-pointer active:scale-[0.99]"
              style={{borderColor: styleContext.secondary}}
            >
              <Pause className="w-3.5 h-3.5 fill-current" style={{color: styleContext.primary}} />
              <span>暂停专注</span>
            </button>
          )}

          <button
            onClick={handleStopSession}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs py-4 rounded-2xl transition-all border-2 flex items-center justify-center gap-2.5 shadow-sm hover:shadow-md cursor-pointer active:scale-[0.99]"
            style={{borderColor: styleContext.primary}}
          >
            <Square className="w-3.5 h-3.5 fill-current" style={{color: styleContext.primary}} />
            <span>停止并记录专注时长</span>
          </button>
        </div>

        <p className="text-xs text-slate-400 font-semibold tracking-wide">
          {isPaused ? '暂停期间不计入专注时长' : '深呼吸，保持节奏'}
        </p>
      </div>
    </div>
  );
}
