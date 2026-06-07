import {ChevronLeft, ChevronRight, Settings} from 'lucide-react';

import {addIsoDateDays, addIsoDateMonths} from '../../../../shared/lib/date';
import type {CalendarView} from '../controllers/calendarLayout';
import type {WeekTimelineDensity} from '../controllers/weekTimelineInteraction';

interface CalendarToolbarProps {
  view: CalendarView;
  anchorDate: string;
  setView: (view: CalendarView) => void;
  setAnchorDate: (date: string) => void;
  onOpenSettings?: () => void;
  showSchedulingToggle?: boolean;
  schedulingSidebarOpen?: boolean;
  onToggleSchedulingSidebar?: () => void;
  showWeekDensityControls?: boolean;
  weekTimelineDensity?: WeekTimelineDensity;
  onWeekTimelineDensityChange?: (density: WeekTimelineDensity) => void;
}

const densityOptions: Array<{value: WeekTimelineDensity; label: string}> = [
  {value: 'compact', label: '紧凑'},
  {value: 'standard', label: '标准'},
  {value: 'comfortable', label: '宽松'},
];

export function CalendarToolbar({
  view,
  anchorDate,
  setView,
  setAnchorDate,
  onOpenSettings,
  showSchedulingToggle = false,
  schedulingSidebarOpen = false,
  onToggleSchedulingSidebar,
  showWeekDensityControls = false,
  weekTimelineDensity = 'standard',
  onWeekTimelineDensityChange,
}: CalendarToolbarProps) {
  const moveDate = (direction: -1 | 1) => (
    view === 'month'
      ? addIsoDateMonths(anchorDate, direction)
      : addIsoDateDays(anchorDate, direction * 7)
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-extrabold text-slate-800">日历</h2>
        <p className="text-xs font-semibold text-slate-400">{anchorDate}</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="上一段" onClick={() => setAnchorDate(moveDate(-1))} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-600">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" aria-label="下一段" onClick={() => setAnchorDate(moveDate(1))} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-600">
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(['month', 'week', 'list'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${view === item ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
            >
              {item === 'month' ? '月' : item === 'week' ? '周' : '列表'}
            </button>
          ))}
        </div>
        {view === 'week' && showWeekDensityControls && (
          <div role="group" aria-label="周视图密度" className="flex rounded-lg border border-slate-200 bg-white p-1">
            {densityOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={weekTimelineDensity === option.value}
                onClick={() => onWeekTimelineDensityChange?.(option.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${weekTimelineDensity === option.value ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        {showSchedulingToggle && (
          <button
            type="button"
            aria-label={schedulingSidebarOpen ? '关闭安排任务' : '安排任务'}
            onClick={onToggleSchedulingSidebar}
            className={`rounded-lg border px-3 py-2 text-xs font-bold ${schedulingSidebarOpen ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            {schedulingSidebarOpen ? '关闭安排任务' : '安排任务'}
          </button>
        )}
        {onOpenSettings && (
          <button type="button" aria-label="显示设置" onClick={onOpenSettings} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-600">
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
