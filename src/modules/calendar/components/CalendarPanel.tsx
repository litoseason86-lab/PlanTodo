import {type CSSProperties, useState} from 'react';

import type {Category, Tag} from '../../../../shared/domain/entities';
import {useCalendarController} from '../controllers/useCalendarController';
import {useSchedulingSidebarController} from '../controllers/useSchedulingSidebarController';
import {CalendarQuickCreatePopover} from './CalendarQuickCreatePopover';
import {CalendarSurface} from './CalendarSurface';
import {CalendarSettingsMenu} from './CalendarSettingsMenu';
import {CalendarTaskPopover} from './CalendarTaskPopover';
import {CalendarToolbar} from './CalendarToolbar';
import {SchedulingSidebar} from './SchedulingSidebar';

interface CalendarPanelProps {
  categories: Category[];
  tags?: Tag[];
  styleContext: {primary: string; primaryLight: string; secondary: string};
  showToast: (message: string, type?: 'success' | 'error') => void;
  initialDate?: string;
  onMutationSuccess?: () => Promise<void> | void;
}

export function CalendarPanel({categories, tags = [], styleContext, showToast, initialDate, onMutationSuccess}: CalendarPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [schedulingSidebarOpen, setSchedulingSidebarOpen] = useState(true);
  const controller = useCalendarController({
    categories,
    initialDate,
    showToast,
    onMutationSuccess: async () => {
      try {
        await onMutationSuccess?.();
      } finally {
        setSidebarRefreshKey((key) => key + 1);
      }
    },
  });
  const sidebarController = useSchedulingSidebarController({
    categories,
    tags,
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
        showSchedulingToggle
        schedulingSidebarOpen={schedulingSidebarOpen}
        onToggleSchedulingSidebar={() => setSchedulingSidebarOpen((open) => !open)}
        showWeekDensityControls
        weekTimelineDensity={controller.settings.weekTimelineDensity}
        onWeekTimelineDensityChange={controller.setWeekTimelineDensity}
      />
      {settingsOpen && (
        <CalendarSettingsMenu
          categories={categories}
          settings={controller.settings}
          setSettings={controller.setSettings}
        />
      )}
      <div style={{'--calendar-accent': styleContext.primary} as CSSProperties}>
        <div className={schedulingSidebarOpen ? 'grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]' : 'grid grid-cols-1 gap-4'}>
          <div className="min-w-0">
            <CalendarSurface
              controller={controller}
              categories={categories}
              enableQuickCreate
              weekTimelineDensity={controller.settings.weekTimelineDensity}
              onOpenQuickCreate={controller.openQuickCreateDraft}
              onRejectBatchTimeDrop={() => showToast('多选任务不能直接安排到时间段', 'error')}
            />
          </div>
          {schedulingSidebarOpen && (
            <SchedulingSidebar
              controller={sidebarController}
              categories={categories}
              tags={tags}
            />
          )}
        </div>
        {controller.quickCreateDraft && (
          <CalendarQuickCreatePopover
            draft={controller.quickCreateDraft}
            categories={categories}
            onCancel={controller.closeQuickCreateDraft}
            onSubmit={controller.submitQuickCreateDraft}
          />
        )}
        {controller.taskEditor && (
          <CalendarTaskPopover
            task={controller.taskEditor.task}
            categories={categories}
            anchor={controller.taskEditor.anchor}
            onCancel={controller.closeTaskEditor}
            onSave={controller.submitTaskEditor}
            onDelete={controller.deleteTaskFromEditor}
          />
        )}
      </div>
    </section>
  );
}
