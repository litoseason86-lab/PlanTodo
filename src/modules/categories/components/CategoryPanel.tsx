import {Check, Edit3, Plus, Trash2, X} from 'lucide-react';

import type {Category, Task} from '../../../../shared/domain/entities';

interface CategoryPanelProps {
  styleContext: {
    primary: string;
    primaryLight: string;
  };
  categories: Category[];
  allTasks: Task[];
  presetColors: Array<{hex: string; label: string}>;
  isCategoryModalOpen: boolean;
  editingCategory: Category | null;
  catFormName: string;
  catFormColor: string;
  catFormSort: number;
  setIsCategoryModalOpen: (value: boolean) => void;
  setCatFormName: (value: string) => void;
  setCatFormColor: (value: string) => void;
  setCatFormSort: (value: number) => void;
  handleOpenCategoryModal: (category: Category | null) => void;
  handleDeleteCategory: (id: number) => void;
  handleSaveCategory: () => void;
}

export function CategoryPanel({
  styleContext,
  categories,
  allTasks,
  presetColors,
  isCategoryModalOpen,
  editingCategory,
  catFormName,
  catFormColor,
  catFormSort,
  setIsCategoryModalOpen,
  setCatFormName,
  setCatFormColor,
  setCatFormSort,
  handleOpenCategoryModal,
  handleDeleteCategory,
  handleSaveCategory,
}: CategoryPanelProps) {
  return (
    <div className="space-y-6" id="categories_view">
      <header className="bg-white rounded-2xl border border-slate-200/60 p-6 flex items-center justify-between gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]" id="categories_header">
        <div>
          <span className="px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider inline-block" style={{color: styleContext.primary, backgroundColor: styleContext.primaryLight}}>
            Categories Matrix
          </span>
          <h2 className="text-xl font-extrabold text-slate-800 mt-2">分类令牌设定中心</h2>
          <p className="text-xs text-slate-500 font-medium">设计多级色彩和排序权重，使专注数据分析能精密关联在特定板块中。</p>
        </div>

        <button
          onClick={() => handleOpenCategoryModal(null)}
          className="text-white font-bold text-xs px-5 py-3 rounded-xl shadow-sm shadow-[var(--color-primary)]/20 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
          style={{backgroundColor: styleContext.primary}}
        >
          <Plus className="w-3.5 h-3.5" /> 新建分类
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6" id="categories_grid">
        {categories.map((category) => {
          const associatedTasks = allTasks.filter((task) => task.categoryId === category.id);
          return (
            <div
              key={category.id}
              className="bg-white border border-slate-200/60 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] relative overflow-hidden flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
            >
              <div
                className="h-[56px] w-full flex items-end px-4 pb-2.5"
                style={{backgroundColor: category.color}}
              >
                <span className="text-[10px] uppercase font-bold text-white/90 tracking-widest bg-black/10 backdrop-blur-sm px-2.5 py-0.5 rounded-full">
                  #{category.sortOrder}
                </span>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm tracking-tight">{category.name}</h4>
                    <span className="text-[11px] text-slate-400 font-semibold font-mono">
                      {associatedTasks.length} 项关联
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-slate-50 rounded-lg p-0.5">
                    <button
                      onClick={() => handleOpenCategoryModal(category)}
                      className="p-1.5 hover:bg-white text-slate-500 rounded-md transition shadow-sm"
                      title="编辑"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-md transition"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div
          onClick={() => handleOpenCategoryModal(null)}
          className="bg-slate-50/50 hover:bg-white border-2 border-dashed border-slate-200 rounded-xl h-[138px] flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:border-[var(--color-primary)]/40 transition-all duration-300 group select-none"
        >
          <Plus className="w-6 h-6 text-slate-300 group-hover:scale-110 transition-transform duration-200 group-hover:text-[var(--color-primary)] mb-2" />
          <span className="text-xs font-semibold text-slate-400 group-hover:text-[var(--color-primary)] transition-colors">
            新建分类
          </span>
        </div>
      </div>

      {isCategoryModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          id="category_modal"
          onClick={(event) => { if (event.target === event.currentTarget) setIsCategoryModalOpen(false); }}
          onKeyDown={(event) => { if (event.key === 'Escape') setIsCategoryModalOpen(false); }}
        >
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-2xl max-w-sm w-full p-6 space-y-5 animate-in zoom-in-95 duration-200" id="category_modal_card">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-800">
                {editingCategory ? '编辑分类' : '新建分类'}
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-xl transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">名称</label>
                <input
                  type="text"
                  placeholder="e.g. 系统架构 / 会议纪要"
                  value={catFormName}
                  onChange={(event) => setCatFormName(event.target.value)}
                  autoFocus
                  className="w-full text-xs border border-slate-200 bg-slate-50/50 p-2.5 text-slate-800 rounded-xl outline-none focus:border-[var(--color-primary)] focus:bg-white font-semibold transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                  色彩标签
                </label>

                <div className="grid grid-cols-8 gap-1.5 p-3 bg-slate-50/50 border border-slate-200/40 rounded-xl">
                  {presetColors.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setCatFormColor(color.hex)}
                      title={color.label}
                      className={`w-full aspect-square rounded-lg border-2 transition-all duration-150 relative ${
                        catFormColor === color.hex
                          ? 'scale-110 ring-2 ring-offset-2 border-white shadow-md'
                          : 'hover:scale-105 border-transparent'
                      }`}
                      style={{backgroundColor: color.hex}}
                    >
                      {catFormColor === color.hex && (
                        <Check className="w-3 h-3 text-white absolute inset-0 m-auto stroke-[3]" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={catFormColor}
                    onChange={(event) => setCatFormColor(event.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 shrink-0 hover:scale-105 transition"
                  />
                  <input
                    type="text"
                    value={catFormColor}
                    onChange={(event) => setCatFormColor(event.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs text-slate-700 rounded-xl border border-slate-200 outline-none font-mono font-bold uppercase transition-colors focus:border-[var(--color-primary)]"
                    placeholder="#fb7185"
                  />
                  <div className="w-8 h-8 rounded-lg border border-slate-200" style={{backgroundColor: catFormColor}} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">排序权重</label>
                <input
                  type="number"
                  placeholder="0"
                  value={catFormSort}
                  onChange={(event) => setCatFormSort(Number(event.target.value))}
                  className="w-full text-xs border border-slate-200 bg-slate-50/50 p-2.5 rounded-xl outline-none font-semibold transition-colors focus:border-[var(--color-primary)] focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:bg-slate-100 text-xs font-semibold px-4 py-2 rounded-xl transition"
              >
                取消
              </button>
              <button
                onClick={handleSaveCategory}
                className="text-white text-xs font-bold px-5 py-2 rounded-xl transition-all shadow-sm shadow-[var(--color-primary)]/20 hover:shadow-md active:scale-[0.98]"
                style={{backgroundColor: styleContext.primary}}
              >
                {editingCategory ? '保存修改' : '创建分类'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
