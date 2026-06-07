import {ListTodo} from 'lucide-react';

import type {Category, Tag, Task} from '../../../../shared/domain/entities';
import type {TaskPriority} from '../../../../shared/domain/status';
import type {TaskStatus} from '../../../../shared/domain/status';
import {TaskFilterBar} from './TaskFilterBar';
import {TaskListItem} from './TaskListItem';

type TaskFilterDateScope = 'today' | 'seven-days' | 'all' | 'unscheduled';
type TaskPriorityFilter = 'all' | 'none' | TaskPriority;

interface TaskListProps {
  styleContext: {
    primary: string;
    primaryLight: string;
    secondary: string;
  };
  categories: Category[];
  tags: Tag[];
  allTasks: Task[];
  filteredTaskItems: Task[];
  calendarVisible: boolean;
  filters: {
    category: string;
    status: 'all' | TaskStatus;
    dateScope: TaskFilterDateScope;
    tagIds: number[];
    priority: TaskPriorityFilter;
    query: string;
    setCategory: (value: string) => void;
    setStatus: (value: 'all' | TaskStatus) => void;
    setDateScope: (value: TaskFilterDateScope) => void;
    setTagIds: (value: number[]) => void;
    setPriority: (value: TaskPriorityFilter) => void;
    setQuery: (value: string) => void;
  };
  onToggleCalendar: () => void;
  handleUpdateTaskStatus: (id: number, status: TaskStatus) => void;
  handleStartSession: (task: Task) => void;
  handleDeleteTask: (taskId: number) => void;
  onEditTask: (task: Task) => void;
}

export function TaskList({
  styleContext,
  categories,
  tags,
  allTasks,
  filteredTaskItems,
  calendarVisible,
  filters,
  onToggleCalendar,
  handleUpdateTaskStatus,
  handleStartSession,
  handleDeleteTask,
  onEditTask,
}: TaskListProps) {
  return (
    <div className="lg:col-span-2 space-y-4">
      <TaskFilterBar
        categories={categories}
        tags={tags}
        filteredCount={filteredTaskItems.length}
        calendarVisible={calendarVisible}
        taskFilterCategory={filters.category}
        taskFilterStatus={filters.status}
        taskFilterDateScope={filters.dateScope}
        selectedTagIds={filters.tagIds}
        priority={filters.priority}
        query={filters.query}
        setTaskFilterCategory={filters.setCategory}
        setTaskFilterStatus={filters.setStatus}
        setTaskFilterDateScope={filters.setDateScope}
        onTagIdsChange={filters.setTagIds}
        onPriorityChange={filters.setPriority}
        onQueryChange={filters.setQuery}
        onToggleCalendar={onToggleCalendar}
      />

      <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
        <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
          {filteredTaskItems.map((task) => (
            <TaskListItem
              key={task.id}
              styleContext={styleContext}
              task={task}
              category={categories.find((item) => item.id === task.categoryId)}
              handleUpdateTaskStatus={handleUpdateTaskStatus}
              handleStartSession={handleStartSession}
              handleDeleteTask={handleDeleteTask}
              onEditTask={onEditTask}
            />
          ))}

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
}
