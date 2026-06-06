import type {Category} from '../../../../shared/domain/entities';
import type {CalendarSettings} from '../controllers/calendarSettings';

interface CalendarSettingsMenuProps {
  categories: Category[];
  settings: CalendarSettings;
  setSettings: (settings: CalendarSettings) => void;
}

export function CalendarSettingsMenu({categories, settings, setSettings}: CalendarSettingsMenuProps) {
  const toggleCategory = (categoryId: number) => {
    const allCategoryIds = categories.map((category) => category.id);
    const currentVisibleIds = settings.visibleCategoryIds.length === 0 ? allCategoryIds : settings.visibleCategoryIds;
    const visibleCategoryIds = currentVisibleIds.includes(categoryId)
      ? currentVisibleIds.filter((id) => id !== categoryId)
      : [...currentVisibleIds, categoryId];
    setSettings({...settings, visibleCategoryIds});
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 text-xs font-bold text-slate-600 sm:grid-cols-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showCompleted}
            onChange={(event) => setSettings({...settings, showCompleted: event.target.checked})}
          />
          显示已完成
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showFocusSessions}
            onChange={(event) => setSettings({...settings, showFocusSessions: event.target.checked})}
          />
          显示专注记录
        </label>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs font-extrabold text-slate-500">分类显示范围</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <label key={category.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                checked={settings.visibleCategoryIds.length === 0 || settings.visibleCategoryIds.includes(category.id)}
                onChange={() => toggleCategory(category.id)}
              />
              <span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: category.color}} />
              {category.name}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
