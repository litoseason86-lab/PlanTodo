import {CalendarRange, Loader2} from 'lucide-react';
import {Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';

import type {Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import {getIsoDateWeekday} from '../../../../shared/lib/date';

interface WeeklyTimelineRow {
  day: string;
  weekday: string;
  rate: number;
  total: number;
  completed: number;
}

interface WeeklyCategoryRow {
  name: string;
  value: number;
  color: string;
}

interface WeeklyDayData {
  day: string;
  tasks: Task[];
  sessions: TaskExecutionSession[];
}

interface WeeklyReviewMetrics {
  weeklyTotalTasks: number;
  weeklyDoneTasks: number;
  weeklyPendingTasks: number;
  weeklyOverdueTasks: number;
  weeklyTotalMins: number;
  weeklyTimelineRateData: WeeklyTimelineRow[];
  weeklyCategoryDistribution: WeeklyCategoryRow[];
  weeklyDaysData: WeeklyDayData[];
  maxStreak: number;
}

interface WeeklyReviewPanelProps {
  styleContext: {
    primary: string;
    primaryLight: string;
    secondary: string;
  };
  weeklyStartDate: string;
  setWeeklyStartDate: (value: string) => void;
  loadWeeklyStats: () => void;
  weeklyStatsLoaded: boolean;
  metrics: WeeklyReviewMetrics;
}

export function WeeklyReviewPanel({
  styleContext,
  weeklyStartDate,
  setWeeklyStartDate,
  loadWeeklyStats,
  weeklyStatsLoaded,
  metrics,
}: WeeklyReviewPanelProps) {
  return (
    <div className="space-y-6" id="weekly_view">
      <header className="bg-white rounded-2xl border border-slate-200/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]" id="weekly_header">
        <div>
          <span className="px-3 py-1 text-[10px] font-bold rounded-full w-fit" style={{color: styleContext.primary, backgroundColor: styleContext.primaryLight}}>
            Weekly Performance
          </span>
          <h2 className="text-xl font-extrabold text-slate-800 mt-2">周度效率复盘看板</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">计算单周范围内每日折线递增、达成分布占比，盘整效率质量。</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 text-xs rounded-xl">
            <span className="text-[10px] text-slate-400 font-semibold">起始:</span>
            <input
              type="date"
              value={weeklyStartDate}
              onChange={(event) => setWeeklyStartDate(event.target.value)}
              className="cursor-pointer font-bold outline-none font-mono"
            />
          </div>

          <button
            onClick={loadWeeklyStats}
            className="bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all hover:bg-slate-800 active:scale-[0.98]"
          >
            计算能效
          </button>
        </div>
      </header>

      {!weeklyStatsLoaded ? (
        <div className="bg-white border border-slate-200/60 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{color: styleContext.primary}} />
          <p className="text-xs text-slate-400 font-semibold">正在计算本周数据...</p>
        </div>
      ) : metrics.weeklyTotalTasks === 0 && metrics.weeklyTotalMins === 0 ? (
        <div className="bg-white border border-slate-200/60 p-16 rounded-2xl text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{backgroundColor: styleContext.primaryLight}}>
            <CalendarRange className="w-8 h-8 stroke-[1.5]" style={{color: styleContext.primary}} />
          </div>
          <p className="text-sm font-bold text-slate-600">本周暂无数据记录</p>
          <p className="text-xs text-slate-400 mt-1.5">尝试调整起始日期到本周一</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
              <div className="pb-3 border-b border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metrics: Rate Trendline</span>
                <h3 className="font-bold text-xs text-slate-700 mt-1">7日达成率走势</h3>
              </div>

              <div className="h-[220px] w-full mt-4 select-none">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.weeklyTimelineRateData} margin={{top: 10, right: 20, left: -20, bottom: 5}}>
                    <XAxis dataKey="weekday" stroke="#57534e" fontSize={10} fontWeight="bold" />
                    <YAxis stroke="#57534e" fontSize={10} domain={[0, 100]} />
                    <Tooltip
                      content={({active, payload}) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as WeeklyTimelineRow;
                          return (
                            <div className="bg-slate-900 text-white text-[10px] p-2 rounded shadow font-bold">
                              <p className="font-mono">{data.day} ({data.weekday})</p>
                              <p className="mt-1 text-rose-300">计划完成率: {data.rate}%</p>
                              <p className="text-slate-300 text-[9px]">行动明细: {data.completed} / {data.total}项</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line type="monotone" dataKey="rate" stroke={styleContext.primary} strokeWidth={3} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
              <div className="pb-3 border-b border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metrics: Category Share</span>
                <h3 className="font-bold text-xs text-slate-700 mt-1">分类完成占比</h3>
              </div>

              <div className="h-[180px] flex items-center justify-center">
                {metrics.weeklyCategoryDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.weeklyCategoryDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {metrics.weeklyCategoryDistribution.map((entry, index) => (
                          <Cell key={`weekly-category-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={25} iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-xs font-bold text-center">本周暂且无对应已完结标签数据</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between md:col-span-2">
              <div className="pb-3 border-b border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metrics: Heatmap</span>
                <h3 className="font-bold text-xs text-slate-700 mt-1">每日达标轨迹</h3>
              </div>

              <div className="grid grid-cols-7 gap-3 py-6 select-none">
                {metrics.weeklyDaysData.map((dayData) => {
                  const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                  const achieved =
                    dayData.tasks.length > 0 &&
                    dayData.tasks.every((task) => task.status === 'DONE');
                  const minutes = Math.round(
                    dayData.sessions
                      .filter((session) => session.status === 'COMPLETED')
                      .reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0) / 60,
                  );

                  return (
                    <div
                      key={dayData.day}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        achieved ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      <span className="text-[9px] font-black tracking-widest block opacity-70 uppercase">{weekdayLabels[getIsoDateWeekday(dayData.day)]}</span>
                      <span className="text-[11px] font-mono font-black mt-1 block">{dayData.day.slice(5)}</span>
                      <div className={`mt-3 mx-auto w-3.5 h-3.5 rounded-full flex items-center justify-center ${achieved ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
                      <span className="text-[9px] font-bold block mt-1.5 opacity-80">{minutes}m</span>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 rounded-xl border flex items-center justify-between" style={{backgroundColor: styleContext.primaryLight, borderColor: `${styleContext.secondary}50`}}>
                <span className="text-xs font-semibold text-slate-600">🏆 最长连续达标</span>
                <span className="text-sm font-bold tracking-tight px-3 py-1 rounded-lg bg-white shadow-sm" style={{color: styleContext.primary}}>
                  {metrics.maxStreak} 日
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
              <div className="pb-3 border-b border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metrics: Summary</span>
                <h3 className="font-bold text-xs text-slate-700 mt-1">本周核心指标</h3>
              </div>

              <div className="divide-y divide-slate-100 flex-grow py-3">
                <div className="py-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500">派遣总数</span>
                  <strong className="font-bold font-mono text-slate-700">{metrics.weeklyTotalTasks} 项</strong>
                </div>
                <div className="py-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500">完成总数</span>
                  <strong className="font-bold font-mono text-emerald-600">{metrics.weeklyDoneTasks} 项</strong>
                </div>
                <div className="py-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500">进行中/待办</span>
                  <strong className="font-bold font-mono text-slate-700">{metrics.weeklyPendingTasks} 项</strong>
                </div>
                <div className="py-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500">搁置数</span>
                  <strong className="font-bold font-mono text-rose-500">{metrics.weeklyOverdueTasks} 项</strong>
                </div>
                <div className="py-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-600">专注总量</span>
                  <strong className="font-bold font-mono text-indigo-600">{metrics.weeklyTotalMins} 分钟</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
