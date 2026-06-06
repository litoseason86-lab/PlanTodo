import type {Category} from '../../../../shared/domain/entities';
import {useCalendarController} from '../controllers/useCalendarController';
import {CalendarSurface} from './CalendarSurface';
import {CalendarToolbar} from './CalendarToolbar';

interface EmbeddedCalendarPanelProps {
  categories: Category[];
  initialDate: string;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onMutationSuccess?: () => Promise<void> | void;
}

export function EmbeddedCalendarPanel({
  categories,
  initialDate,
  showToast,
  onMutationSuccess,
}: EmbeddedCalendarPanelProps) {
  const controller = useCalendarController({categories, initialDate, showToast, onMutationSuccess});

  return (
    <section className="min-w-0 space-y-3">
      <CalendarToolbar
        view={controller.view}
        anchorDate={controller.anchorDate}
        setView={controller.setView}
        setAnchorDate={controller.setAnchorDate}
        onOpenSettings={() => undefined}
      />
      <div className="overflow-x-auto">
        <CalendarSurface
          controller={controller}
          categories={categories}
          embedded
          onRejectBatchTimeDrop={() => showToast('批量任务只能安排到日期', 'error')}
        />
      </div>
    </section>
  );
}
