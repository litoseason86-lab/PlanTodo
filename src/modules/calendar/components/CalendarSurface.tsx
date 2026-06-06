import type {Category} from '../../../../shared/domain/entities';
import type {useCalendarController} from '../controllers/useCalendarController';
import {CalendarListView} from './CalendarListView';
import {MonthCalendarView} from './MonthCalendarView';
import {WeekTimelineView} from './WeekTimelineView';

interface CalendarSurfaceProps {
  controller: ReturnType<typeof useCalendarController>;
  categories: Category[];
  embedded?: boolean;
  onRejectBatchTimeDrop: () => void;
}

export function CalendarSurface({controller, categories, embedded = false, onRejectBatchTimeDrop}: CalendarSurfaceProps) {
  return (
    <div className={embedded ? 'min-w-0' : undefined}>
      {controller.view === 'month' && (
        <MonthCalendarView
          anchorDate={controller.anchorDate}
          tasksByDate={controller.tasksByDate}
          categories={categories}
          onCreateDateTask={controller.createAllDayTask}
          onScheduleDate={controller.scheduleTaskForDate}
          onBatchScheduleDate={(taskIds, date) => controller.batchScheduleDate({taskIds, date})}
        />
      )}
      {controller.view === 'week' && (
        <WeekTimelineView
          anchorDate={controller.anchorDate}
          tasksByDate={controller.tasksByDate}
          categories={categories}
          focusSessions={controller.focusSessions}
          showFocusSessions={controller.settings.showFocusSessions}
          onScheduleDate={controller.scheduleTaskForDate}
          onBatchScheduleDate={(taskIds, date) => controller.batchScheduleDate({taskIds, date})}
          onScheduleTime={controller.scheduleTaskAtTime}
          onMoveTimedTask={controller.moveTimedTask}
          onResizeTimedTask={controller.resizeTimedTask}
          onRejectBatchTimeDrop={onRejectBatchTimeDrop}
        />
      )}
      {controller.view === 'list' && (
        <CalendarListView
          dateFrom={controller.range.dateFrom}
          dateTo={controller.range.dateTo}
          tasksByDate={controller.tasksByDate}
          categories={categories}
          focusSessions={controller.focusSessions}
          showFocusSessions={controller.settings.showFocusSessions}
        />
      )}
    </div>
  );
}
