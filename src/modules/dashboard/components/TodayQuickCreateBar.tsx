import {Plus} from 'lucide-react';

import type {Category} from '../../../../shared/domain/entities';
import type {TodayQuickCreateController} from '../controllers/useTodayQuickCreateController';

interface TodayQuickCreateBarProps {
  categories: Category[];
  primaryColor: string;
  todayQuickCreate: TodayQuickCreateController;
}

export function TodayQuickCreateBar({categories, primaryColor, todayQuickCreate}: TodayQuickCreateBarProps) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl p-4 flex flex-wrap items-center gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
      <input
        type="text"
        placeholder="💡 快速添加今日行动计划..."
        value={todayQuickCreate.title}
        disabled={todayQuickCreate.isCreating}
        onChange={(event) => todayQuickCreate.setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            void todayQuickCreate.createTodayTask();
          }
        }}
        className="min-w-0 flex-1 text-sm border border-slate-200 bg-slate-50/50 p-2.5 rounded-xl outline-none focus:border-[var(--color-primary)] focus:bg-white focus:shadow-sm font-semibold transition-all text-slate-800 placeholder:text-slate-300"
      />
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          value={todayQuickCreate.categoryId}
          disabled={todayQuickCreate.isCreating}
          onChange={(event) => todayQuickCreate.setCategoryId(Number(event.target.value))}
          className="px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl text-slate-600 font-semibold outline-none cursor-pointer hover:bg-slate-50 transition-colors"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
          {categories.length === 0 && <option value="">暂无分类</option>}
        </select>

        <button
          type="button"
          onClick={() => void todayQuickCreate.createTodayTask()}
          disabled={todayQuickCreate.isCreating}
          className="text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-[var(--color-primary)]/20 hover:shadow-md hover:scale-[1.02] flex flex-wrap items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
          style={{backgroundColor: primaryColor}}
        >
          <Plus className="w-3.5 h-3.5" /> 快速派遣
        </button>
      </div>
    </div>
  );
}
