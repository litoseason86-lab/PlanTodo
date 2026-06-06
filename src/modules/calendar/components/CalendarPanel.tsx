import {type CSSProperties, useState} from 'react';

import type {Category} from '../../../../shared/domain/entities';
import {useCalendarController} from '../controllers/useCalendarController';
import {CalendarListView} from './CalendarListView';
import {CalendarToolbar} from './CalendarToolbar';
import {MonthCalendarView} from './MonthCalendarView';
import {WeekTimelineView} from './WeekTimelineView';

interface CalendarPanelProps {
  categories: Category[];
  styleContext: {primary: string; primaryLight: string; secondary: string};
  showToast: (message: string, type?: 'success' | 'error') => void;
  initialDate?: string;
}

export function CalendarPanel({categories, styleContext, showToast, initialDate}: CalendarPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const controller = useCalendarController({categories, initialDate, showToast});

  return (
    <section id="calendar_view" className="space-y-4">
      <CalendarToolbar
        view={controller.view}
        anchorDate={controller.anchorDate}
        setView={controller.setView}
        setAnchorDate={controller.setAnchorDate}
        onOpenSettings={() => setSettingsOpen((open) => !open)}
      />
      {settingsOpen && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs font-semibold text-slate-500">
          显示设置
        </div>
      )}
      <div style={{'--calendar-accent': styleContext.primary} as CSSProperties}>
        {controller.view === 'month' && (
          <MonthCalendarView
            anchorDate={controller.anchorDate}
            tasksByDate={controller.tasksByDate}
            categories={categories}
            onCreateDateTask={controller.createAllDayTask}
            onScheduleDate={controller.scheduleTaskForDate}
          />
        )}
        {controller.view === 'week' && (
          <WeekTimelineView
            anchorDate={controller.anchorDate}
            tasksByDate={controller.tasksByDate}
            categories={categories}
          />
        )}
        {controller.view === 'list' && (
          <CalendarListView
            dateFrom={controller.range.dateFrom}
            dateTo={controller.range.dateTo}
            tasksByDate={controller.tasksByDate}
            categories={categories}
          />
        )}
      </div>
    </section>
  );
}
