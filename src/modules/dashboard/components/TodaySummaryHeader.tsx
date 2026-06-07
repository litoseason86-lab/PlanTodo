import {Calendar} from 'lucide-react';
import {Bar, BarChart, Cell, ResponsiveContainer} from 'recharts';

import type {Task} from '../../../../shared/domain/entities';

interface TodaySummaryHeaderProps {
  primaryColor: string;
  primaryLightColor: string;
  tasks: Task[];
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  todayCategoryFocusData: Array<{
    name: string;
    minutes: number;
    color: string;
  }>;
}

export function TodaySummaryHeader({
  primaryColor,
  primaryLightColor,
  tasks,
  selectedDate,
  setSelectedDate,
  todayCategoryFocusData,
}: TodaySummaryHeaderProps) {
  const pendingCount = tasks.filter((task) => task.status === 'TODO' || task.status === 'IN_PROGRESS').length;
  const doneCount = tasks.filter((task) => task.status === 'DONE').length;
  const totalFocusMinutes = todayCategoryFocusData.reduce((sum, item) => sum + item.minutes, 0);

  return (
    <header className="bg-white rounded-2xl border border-slate-200/60 p-6 flex flex-wrap items-center justify-between gap-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]" id="today_header">
      <div className="space-y-2.5 min-w-0">
        <span className="px-3 py-1 text-white text-[10px] font-bold rounded-full uppercase tracking-wider inline-block bg-[var(--color-primary)] shadow-sm shadow-[var(--color-primary)]/20">
          Primary Flow Focus
        </span>
        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">今日规划时空轴</h2>
        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
          <Calendar className="w-3.5 h-3.5" style={{color: primaryColor}} />
          <span className="font-semibold text-slate-600">聚焦选期:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="bg-slate-50 border border-slate-200 outline-none hover:border-slate-300 focus:border-[var(--color-primary)] px-3 py-1.5 font-mono rounded-xl text-xs text-slate-700 font-bold transition-colors"
          />
        </div>
      </div>

      <div className="w-full sm:w-[320px] h-[100px] bg-slate-50/80 border border-slate-200/40 rounded-xl p-3 flex flex-col justify-between" id="today_header_chart">
        <div className="flex items-center justify-between gap-2 text-[9px] font-semibold text-slate-400 tracking-wider">
          <span>累计专注板块 (分钟)</span>
          {todayCategoryFocusData.length > 0 && (
            <span className="font-bold px-2 py-0.5 rounded-full font-mono" style={{color: primaryColor, backgroundColor: primaryLightColor}}>
              已专注 {totalFocusMinutes}m
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 w-full mt-1">
          {todayCategoryFocusData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={todayCategoryFocusData} layout="vertical" margin={{top: 2, right: 10, left: -25, bottom: 2}}>
                <Bar dataKey="minutes" radius={[0, 4, 4, 0]} barSize={8}>
                  {todayCategoryFocusData.map((entry, index) => (
                    <Cell key={`today-category-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-[9px] text-slate-400 font-bold">今日无计时，点击行动旁 ▶️ 开启专注模式</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="bg-slate-50 hover:bg-slate-100 transition-colors rounded-xl px-5 py-3 text-center min-w-[80px] border border-slate-200/40">
          <p className="text-[10px] text-slate-400 font-semibold">待完成</p>
          <p className="text-lg font-extrabold text-slate-700 mt-0.5">{pendingCount}</p>
        </div>
        <div className="bg-emerald-50 hover:bg-emerald-100/60 transition-colors rounded-xl px-5 py-3 text-center min-w-[80px] border border-emerald-200/40">
          <p className="text-[10px] text-emerald-600 font-semibold">已完结</p>
          <p className="text-lg font-extrabold text-emerald-600 mt-0.5">{doneCount}</p>
        </div>
      </div>
    </header>
  );
}
