import {useState, type ReactNode} from 'react';
import type React from 'react';

import {Calendar, GripVertical, ListTodo, Plus, Trash2} from 'lucide-react';

import type {Category, Task} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import {EmbeddedCalendarPanel} from '../../calendar/components/EmbeddedCalendarPanel';
import {writeCalendarDragPayload} from '../../calendar/controllers/schedulingDrag';

interface TasksPanelProps {
  styleContext: {
    primary: string;
    primaryLight: string;
    secondary: string;
  };
  categories: Category[];
  allTasks: Task[];
  filteredTaskItems: Task[];
  taskFormTitle: string;
  taskFormCategory: number;
  taskFormDate: string;
  taskFormUnscheduled: boolean;
  taskFilterCategory: string;
  taskFilterStatus: string;
  taskFilterDateScope: 'today' | 'seven-days' | 'all' | 'unscheduled';
  setTaskFormTitle: (value: string) => void;
  setTaskFormCategory: (value: number) => void;
  setTaskFormDate: (value: string) => void;
  setTaskFormUnscheduled: (value: boolean) => void;
  setTaskFilterCategory: (value: string) => void;
  setTaskFilterStatus: (value: string) => void;
  setTaskFilterDateScope: (value: 'today' | 'seven-days' | 'all' | 'unscheduled') => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  selectedDate: string;
  refreshAllTasks: () => Promise<Task[]>;
  loadTasksForSelectedDate: () => Promise<unknown>;
  handleCreateTask: (event?: React.FormEvent) => void;
  handleUpdateTaskStatus: (id: number, status: TaskStatus) => void;
  handleStartSession: (task: Task) => void;
  handleDeleteTask: (task: Task) => void;
}

export function TasksPanel({
  styleContext,
  categories,
  allTasks,
  filteredTaskItems,
  taskFormTitle,
  taskFormCategory,
  taskFormDate,
  taskFormUnscheduled,
  taskFilterCategory,
  taskFilterStatus,
  taskFilterDateScope,
  setTaskFormTitle,
  setTaskFormCategory,
  setTaskFormDate,
  setTaskFormUnscheduled,
  setTaskFilterCategory,
  setTaskFilterStatus,
  setTaskFilterDateScope,
  showToast,
  selectedDate,
  refreshAllTasks,
  loadTasksForSelectedDate,
  handleCreateTask,
  handleUpdateTaskStatus,
  handleStartSession,
  handleDeleteTask,
}: TasksPanelProps) {
  const [calendarVisible, setCalendarVisible] = useState(false);
  const taskList = (
    <div className="lg:col-span-2 space-y-4">
      <div className="bg-slate-50/80 border border-slate-200/40 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-0.5">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest pl-1">分类</p>
            <select
              value={taskFilterCategory}
              onChange={(event) => setTaskFilterCategory(event.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg text-slate-700 font-semibold outline-none transition-colors hover:border-slate-300"
            >
              <option value="all">全部</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-0.5">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest pl-1">状态</p>
            <select
              value={taskFilterStatus}
              onChange={(event) => setTaskFilterStatus(event.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg text-slate-700 font-semibold outline-none transition-colors hover:border-slate-300"
            >
              <option value="all">全部</option>
              <option value="TODO">待执行</option>
              <option value="IN_PROGRESS">进行中</option>
              <option value="DONE">已完结</option>
              <option value="NOT_DONE">已搁置</option>
            </select>
          </div>

          <div className="space-y-0.5">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest pl-1">日期</p>
            <select
              value={taskFilterDateScope}
              onChange={(event) => setTaskFilterDateScope(event.target.value as 'today' | 'seven-days' | 'all' | 'unscheduled')}
              className="px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg text-slate-700 font-semibold outline-none transition-colors hover:border-slate-300"
            >
              <option value="today">今日</option>
              <option value="seven-days">未来7天</option>
              <option value="unscheduled">未安排</option>
              <option value="all">全部</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400 font-mono bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/60">
            匹配: {filteredTaskItems.length} 项
          </span>
          <button
            type="button"
            onClick={() => setCalendarVisible((visible) => !visible)}
            className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            {calendarVisible ? '隐藏日历' : '显示日历'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
        <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
          {filteredTaskItems.map((task) => {
            const category = categories.find((item) => item.id === task.categoryId);
            const isComplete = task.status === 'DONE';

            return (
              <div key={task.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-all group/task">
                <div className="space-y-1.5 pr-4">
                  <h4 className={`text-xs font-bold leading-normal ${isComplete ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {task.title}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider"
                      style={{
                        color: category ? category.color : '#64748b',
                        backgroundColor: `${category ? category.color : '#94a3b8'}10`,
                        borderColor: `${category ? category.color : '#94a3b8'}20`,
                      }}
                    >
                      {category ? category.name : '通用'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono font-semibold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-300" />
                      {task.plannedDate ?? '未安排'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 select-none">
                  <button
                    type="button"
                    aria-label={`拖拽任务 ${task.title}`}
                    draggable
                    onDragStart={(event) => {
                      writeCalendarDragPayload(event.dataTransfer, {type: 'calendar-task', taskId: task.id, source: 'task-list'});
                    }}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </button>
                  <select
                    aria-label={`task-status-${task.id}`}
                    value={task.status}
                    onChange={(event) => {
                      const nextStatus = event.target.value as TaskStatus;
                      if (nextStatus === 'IN_PROGRESS') {
                        handleStartSession(task);
                        return;
                      }
                      handleUpdateTaskStatus(task.id, nextStatus);
                    }}
                    className="px-2 py-1 text-[10px] border border-slate-200 bg-white rounded-lg text-slate-600 font-semibold outline-none transition-colors hover:border-slate-300"
                  >
                    <option value="TODO">待执行</option>
                    <option value="IN_PROGRESS">专注中</option>
                    <option value="DONE">已完结</option>
                    <option value="NOT_DONE">未完成</option>
                  </select>

                  {!isComplete && (
                    <button
                      onClick={() => handleStartSession(task)}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all"
                      style={{color: styleContext.primary, backgroundColor: styleContext.primaryLight}}
                      onMouseOver={(event) => { event.currentTarget.style.backgroundColor = `${styleContext.secondary}40`; }}
                      onMouseOut={(event) => { event.currentTarget.style.backgroundColor = styleContext.primaryLight; }}
                    >
                      ▶ 专注
                    </button>
                  )}

                  <button
                    type="button"
                    aria-label={`删除任务 ${task.title}`}
                    title="删除任务"
                    onClick={() => handleDeleteTask(task)}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {allTasks.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{backgroundColor: styleContext.primaryLight}}>
                <ListTodo className="w-8 h-8 stroke-[1.5]" style={{color: styleContext.primary}} />
              </div>
              <p className="text-xs font-bold">没有找到符合这些筛选的储备方案项</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6" id="tasks_view">
      <header className="bg-white rounded-2xl border border-slate-200/60 p-6 flex flex-col gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.04)]" id="tasks_header">
        <span className="px-3 py-1 text-[10px] font-bold rounded-full w-fit" style={{color: styleContext.primary, backgroundColor: styleContext.primaryLight}}>
          Global Task Reserves
        </span>
        <h2 className="text-xl font-extrabold text-slate-800 mt-1">全局储备与规划中心</h2>
        <p className="text-xs text-slate-500 font-medium">配置、调度未来日期及历届滞存指令集的核心仓库，支持多级交叉状态过滤。</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200/60 p-6 rounded-2xl space-y-4 h-fit shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
          <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Plus className="w-4 h-4" style={{color: styleContext.primary}} />
            新建储备规划项
          </h3>

          <form onSubmit={(event) => { event.preventDefault(); handleCreateTask(); }} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">行动主题</label>
              <input
                type="text"
                placeholder="e.g. 审定核心业务数据"
                value={taskFormTitle}
                onChange={(event) => setTaskFormTitle(event.target.value)}
                className="w-full text-xs border border-slate-200 bg-slate-50/50 p-2.5 rounded-xl focus:bg-white outline-none focus:border-[var(--color-primary)] font-semibold transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">归属分类</label>
              <select
                value={taskFormCategory}
                onChange={(event) => setTaskFormCategory(Number(event.target.value))}
                className="w-full text-xs border border-slate-200 bg-white p-2.5 rounded-xl outline-none cursor-pointer hover:bg-slate-50 font-semibold transition-colors"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
                {categories.length === 0 && <option value="">暂无分类</option>}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">排期日期</label>
              <input
                type="date"
                value={taskFormDate}
                disabled={taskFormUnscheduled}
                onChange={(event) => setTaskFormDate(event.target.value)}
                className="w-full text-xs border border-slate-200 bg-white p-2.5 rounded-xl outline-none cursor-pointer font-semibold hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={taskFormUnscheduled}
                onChange={(event) => setTaskFormUnscheduled(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              不安排日期
            </label>

            <button
              type="submit"
              className="w-full text-white text-xs font-bold py-3 rounded-xl shadow-sm shadow-[var(--color-primary)]/20 flex items-center justify-center gap-1.5 transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              style={{backgroundColor: styleContext.primary}}
            >
              <Plus className="w-3.5 h-3.5" /> 确认归档入库
            </button>
          </form>
        </div>

        {calendarVisible ? (
          <div className="lg:col-span-2 grid grid-cols-1 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] gap-4">
            {taskList as ReactNode}
            <EmbeddedCalendarPanel
              categories={categories}
              initialDate={selectedDate}
              showToast={showToast}
              onMutationSuccess={async () => {
                await refreshAllTasks();
                await loadTasksForSelectedDate();
              }}
            />
          </div>
        ) : taskList}
      </div>
    </div>
  );
}
