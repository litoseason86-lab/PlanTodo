import {useState} from 'react';

import {EmbeddedCalendarPanel} from '../../calendar/components/EmbeddedCalendarPanel';
import type {TasksPanelController} from '../controllers/useTasksPanelController';
import {TaskBasicInfoModal} from './TaskBasicInfoModal';
import {TaskCreateForm} from './TaskCreateForm';
import {TaskList} from './TaskList';

interface TasksPanelProps {
  styleContext: {
    primary: string;
    primaryLight: string;
    secondary: string;
  };
  controller: TasksPanelController;
}

export function TasksPanel({styleContext, controller}: TasksPanelProps) {
  const [calendarVisible, setCalendarVisible] = useState(false);

  const taskList = (
    <TaskList
      styleContext={styleContext}
      categories={controller.categories}
      tags={controller.tags}
      allTasks={controller.allTasks}
      filteredTaskItems={controller.filteredTaskItems}
      calendarVisible={calendarVisible}
      filters={controller.filters}
      onToggleCalendar={() => setCalendarVisible((visible) => !visible)}
      handleUpdateTaskStatus={controller.statusActions.updateTaskStatus}
      handleStartSession={controller.statusActions.startSession}
      handleDeleteTask={controller.mutations.deleteTask}
      onEditTask={controller.openEditTask}
    />
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
        <TaskCreateForm
          styleContext={styleContext}
          categories={controller.categories}
          tags={controller.tags}
          taskFormTitle={controller.createDraft.title}
          taskFormCategory={controller.createDraft.categoryId}
          taskFormDate={controller.createDraft.plannedDate}
          taskFormUnscheduled={controller.createDraft.unscheduled}
          selectedTagIds={controller.createDraft.tagIds}
          priority={controller.createDraft.priority}
          setTaskFormTitle={controller.createDraft.setTitle}
          setTaskFormCategory={controller.createDraft.setCategoryId}
          setTaskFormDate={controller.createDraft.setPlannedDate}
          setTaskFormUnscheduled={controller.createDraft.setUnscheduled}
          onTagIdsChange={controller.createDraft.setTagIds}
          onPriorityChange={controller.createDraft.setPriority}
          onCreateTag={controller.tagActions.createTag}
          handleCreateTask={controller.mutations.createTask}
        />

        {calendarVisible ? (
          <div className="lg:col-span-2 grid grid-cols-1 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] gap-4">
            {taskList}
            <EmbeddedCalendarPanel
              categories={controller.categories}
              initialDate={controller.calendar.selectedDate}
              showToast={controller.calendar.showToast}
              onMutationSuccess={controller.calendar.onMutationSuccess}
            />
          </div>
        ) : taskList}
      </div>

      {controller.editDraft.task && (
        <TaskBasicInfoModal
          task={controller.editDraft.task}
          categories={controller.categories}
          tags={controller.tags}
          onCreateTag={controller.tagActions.createTag}
          onSave={controller.mutations.updateTaskDetails}
          onClose={controller.closeEditTask}
        />
      )}
    </div>
  );
}
