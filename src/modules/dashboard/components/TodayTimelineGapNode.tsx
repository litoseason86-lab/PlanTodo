interface TodayTimelineGapNodeProps {
  startLabel: string;
  endLabel: string;
  durationMinutes: number;
}

export function TodayTimelineGapNode({startLabel, endLabel, durationMinutes}: TodayTimelineGapNodeProps) {
  const label = `空闲 ${durationMinutes} 分钟 ${startLabel}-${endLabel}`;

  return (
    <div className="flex items-center gap-3 py-2 text-slate-400" aria-label={label}>
      <div className="w-[72px] shrink-0 text-right text-[11px] font-semibold">{startLabel}</div>
      <div className="h-8 border-l-2 border-dashed border-slate-300" />
      <div className="min-w-0 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] italic">
        {label}
      </div>
    </div>
  );
}
