import {type CSSProperties, useState} from 'react';

import type {Category} from '../../../../shared/domain/entities';
import {useCalendarController} from '../controllers/useCalendarController';
import {useSchedulingSidebarController} from '../controllers/useSchedulingSidebarController';
import {CalendarSurface} from './CalendarSurface';
import {CalendarSettingsMenu} from './CalendarSettingsMenu';
import {CalendarToolbar} from './CalendarToolbar';
import {SchedulingSidebar} from './SchedulingSidebar';

interface CalendarPanelProps {
  categories: Category[];
  styleContext: {primary: string; primaryLight: string; secondary: string};
  showToast: (message: string, type?: 'success' | 'error') => void;
  initialDate?: string;
  onMutationSuccess?: () => Promise<void> | void;
}

export function CalendarPanel({categories, styleContext, showToast, initialDate, onMutationSuccess}: CalendarPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const controller = useCalendarController({
    categories,
    initialDate,
    showToast,
    onMutationSuccess: async () => {
      await onMutationSuccess?.();
      setSidebarRefreshKey((key) => key + 1);
    },
  });
  const sidebarController = useSchedulingSidebarController({
    range: controller.range,
    externalRefreshKey: sidebarRefreshKey,
    showToast,
    batchScheduleDate: controller.batchScheduleDate,
    batchUnschedule: controller.batchUnschedule,
  });

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
        <CalendarSettingsMenu
          categories={categories}
          settings={controller.settings}
          setSettings={controller.setSettings}
        />
      )}
      <div style={{'--calendar-accent': styleContext.primary} as CSSProperties}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <CalendarSurface
              controller={controller}
              categories={categories}
              onRejectBatchTimeDrop={() => showToast('批量任务只能安排到日期', 'error')}
            />
          </div>
          <SchedulingSidebar
            controller={sidebarController}
            categories={categories}
          />
        </div>
      </div>
    </section>
  );
}
