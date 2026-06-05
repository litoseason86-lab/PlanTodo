import {useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {
  Calendar,
  Loader2,
  Square,
} from 'lucide-react';

import type {Category, Task, TaskExecutionSession} from '../../shared/domain/entities';
import type {TaskStatus} from '../../shared/domain/status';
import {CategoryPanel} from '../modules/categories/components/CategoryPanel';
import {useCategoryActions} from '../modules/categories/controllers/useCategoryActions';
import {DashboardPanel} from '../modules/dashboard/components/DashboardPanel';
import {buildTodayCategoryFocusData, getTaskFocusMinutes} from '../modules/dashboard/controllers/useDashboardController';
import {focusApi} from '../modules/focus/api/focusApi';
import {FocusPanel} from '../modules/focus/components/FocusPanel';
import {formatFocusElapsed, calculateFocusRingOffset} from '../modules/focus/controllers/useFocusController';
import {DailyReportPanel} from '../modules/reports/components/DailyReportPanel';
import {buildDailyReportMetrics} from '../modules/reports/controllers/useDailyReportController';
import {WeeklyReviewPanel} from '../modules/reports/components/WeeklyReviewPanel';
import {buildWeeklyReviewMetrics} from '../modules/reports/controllers/useWeeklyReviewController';
import {type AppTab} from './navigation';
import {THEME_STYLES, type ThemeId} from './theme';
import {tasksApi} from '../modules/tasks/api/tasksApi';
import {filterTasks} from '../modules/tasks/controllers/useTasksController';
import {TasksPanel} from '../modules/tasks/components/TasksPanel';
import {calculateEffectiveFocusSeconds} from '../modules/focus/controllers/useFocusController';
import {AppHeader} from './components/AppHeader';
import {AppToast} from './components/AppToast';
import {GlobalRunningBar} from './components/GlobalRunningBar';
import {getErrorMessage} from './errors';
import {useAppData} from './hooks/useAppData';
import {useToast} from './hooks/useToast';

const PRESET_COLORS = [
  {hex: '#fb7185', label: '樱花粉'},
  {hex: '#f0abfc', label: '丁香紫'},
  {hex: '#818cf8', label: '晴空蓝'},
  {hex: '#2dd4bf', label: '薄荷绿'},
  {hex: '#34d399', label: '松石绿'},
  {hex: '#fbbf24', label: '向日葵'},
  {hex: '#f97316', label: '金柿橙'},
  {hex: '#a78bfa', label: '薰衣草'},
];

const STORAGE_STYLES = {
  primary: THEME_STYLES.peach.primary,
  primaryLight: THEME_STYLES.peach.primaryLight,
  secondary: THEME_STYLES.peach.secondary,
};

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<AppTab>('today');
  const [activeTheme, setActiveTheme] = useState<ThemeId>('peach');
  const {
    categories,
    tasks,
    selectedDateSessions,
    allTasks,
    loading,
    setLoading,
    selectedDate,
    setSelectedDate,
    refreshCategories,
    refreshAllTasks,
    loadTasksForSelectedDate,
    loadMetaData,
  } = useAppData();
  const [runningSession, setRunningSession] = useState<TaskExecutionSession | null>(null);
  const {successMsg, errorMsg, showToast, clearSuccess, clearError} = useToast();
  const [focusTimeElapsed, setFocusTimeElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [taskFormTitle, setTaskFormTitle] = useState('');
  const [taskFormCategory, setTaskFormCategory] = useState(0);
  const [taskFormDate, setTaskFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [taskFilterCategory, setTaskFilterCategory] = useState('all');
  const [taskFilterStatus, setTaskFilterStatus] = useState('all');
  const [taskFilterDateScope, setTaskFilterDateScope] = useState<'today' | 'seven-days' | 'all'>('today');
  const [dailyReportDate, setDailyReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyTasks, setDailyTasks] = useState<Task[]>([]);
  const [dailySessions, setDailySessions] = useState<TaskExecutionSession[]>([]);
  const [prevDailySessions, setPrevDailySessions] = useState<TaskExecutionSession[]>([]);
  const [dailyStatsLoaded, setDailyStatsLoaded] = useState(false);
  const [weeklyStartDate, setWeeklyStartDate] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().slice(0, 10);
  });
  const [weeklyDaysData, setWeeklyDaysData] = useState<Array<{
    day: string;
    tasks: Task[];
    sessions: TaskExecutionSession[];
  }>>([]);
  const [weeklyStatsLoaded, setWeeklyStatsLoaded] = useState(false);
  const [lastFinishedSessionTask, setLastFinishedSessionTask] = useState<Task | null>(null);

  const styleContext = THEME_STYLES[activeTheme];
  const categoryActions = useCategoryActions({
    categories,
    refreshCategories,
    setLoading,
    showToast,
  });

  useEffect(() => {
    void loadMetaData()
      .then(({categories: loadedCategories}) => {
        if (loadedCategories.length > 0) {
          setTaskFormCategory((current) => current || loadedCategories[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to load metadata', err);
      });
    void checkRunningSession();
  }, []);

  useEffect(() => {
    if (runningSession) {
      const calculateDiff = () => calculateEffectiveFocusSeconds(runningSession);
      setFocusTimeElapsed(calculateDiff());
      if (runningSession.status === 'PAUSED') {
        return undefined;
      }
      timerRef.current = setInterval(() => setFocusTimeElapsed(calculateDiff()), 1000);
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setFocusTimeElapsed(0);
    return undefined;
  }, [runningSession]);

  useEffect(() => {
    void loadTasksForSelectedDate().catch((err) => {
      console.error('Failed to sync date tasks', err);
    });
  }, [loadTasksForSelectedDate]);

  useEffect(() => {
    if (activeTab === 'daily') {
      void loadDailyStats();
    }
  }, [dailyReportDate, activeTab]);

  useEffect(() => {
    if (activeTab === 'weekly') {
      void loadWeeklyStats();
    }
  }, [weeklyStartDate, activeTab]);

  async function checkRunningSession() {
    try {
      const res = await focusApi.getRunningSession();
      if (res.session) {
        setRunningSession(res.session);
        setActiveTab('focus');
      } else {
        setRunningSession(null);
      }
    } catch (err) {
      console.error('Check session state error', err);
    }
  }

  async function handleCreateTask(event?: FormEvent) {
    if (event) event.preventDefault();
    if (!taskFormTitle.trim()) {
      showToast('行动主题不能留空啦', 'error');
      return;
    }
    const catId = taskFormCategory || (categories.length > 0 ? categories[0].id : 0);
    if (!catId) {
      showToast('请先新建至少一个分类板块', 'error');
      return;
    }

    try {
      setLoading(true);
      await tasksApi.createTask({title: taskFormTitle, categoryId: catId, plannedDate: taskFormDate});
      showToast('任务已成功下派！');
      setTaskFormTitle('');
      await refreshAllTasks();
      if (taskFormDate === selectedDate) {
        void loadTasksForSelectedDate();
      }
    } catch (err) {
      showToast(getErrorMessage(err, '生成行动项失败'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateTaskStatus(id: number, status: TaskStatus) {
    try {
      await tasksApi.updateTaskStatus(id, status);
      if (runningSession?.taskId === id && status !== 'IN_PROGRESS') {
        setRunningSession(null);
      }
      showToast('进展转换完美同步');
      await loadTasksForSelectedDate();
      await refreshAllTasks();
      if (activeTab === 'daily') void loadDailyStats();
      if (activeTab === 'weekly') void loadWeeklyStats();
    } catch (err) {
      showToast(getErrorMessage(err, '更新状态故障'), 'error');
    }
  }

  async function handleDeleteTask(task: Task) {
    if (!window.confirm(`确定删除「${task.title}」？关联专注记录也会同步删除。`)) return;

    try {
      setLoading(true);
      await tasksApi.deleteTask(task.id);
      if (runningSession?.taskId === task.id) {
        setRunningSession(null);
      }
      if (lastFinishedSessionTask?.id === task.id) {
        setLastFinishedSessionTask(null);
      }
      showToast('任务已删除');
      await loadTasksForSelectedDate();
      await refreshAllTasks();
      if (activeTab === 'daily') void loadDailyStats();
      if (activeTab === 'weekly') void loadWeeklyStats();
    } catch (err) {
      showToast(getErrorMessage(err, '删除任务失败'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleStartSession(task: Task) {
    try {
      setLoading(true);
      const session = await focusApi.startSession(task.id);
      setRunningSession(session);
      setActiveTab('focus');
      showToast(`✨ 进入「${task.title}」深度聚焦空间`);
      await loadTasksForSelectedDate();
      await refreshAllTasks();
    } catch (err) {
      showToast(getErrorMessage(err, '无法启动心流计时器'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleStopSession() {
    if (!runningSession) return;
    try {
      setLoading(true);
      const stopped = await focusApi.stopSession(runningSession.id);
      let originTask = tasks.find((task) => task.id === stopped.taskId);
      if (!originTask) {
        originTask = allTasks.find((task) => task.id === stopped.taskId);
      }
      if (originTask) {
        setLastFinishedSessionTask(originTask);
      }
      setRunningSession(null);
      showToast('这一阶段的高能专注已完美记入归属分类！');
      setActiveTab('today');
      await loadTasksForSelectedDate();
      await refreshAllTasks();
    } catch (err) {
      showToast(getErrorMessage(err, '终止心流阶段出现故障'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handlePauseSession() {
    if (!runningSession) return;
    try {
      setLoading(true);
      const paused = await focusApi.pauseSession(runningSession.id);
      setRunningSession(paused);
      setFocusTimeElapsed(calculateEffectiveFocusSeconds(paused));
      showToast('专注已暂停，暂停时间不会计入统计');
    } catch (err) {
      showToast(getErrorMessage(err, '暂停专注失败'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleResumeSession() {
    if (!runningSession) return;
    try {
      setLoading(true);
      const resumed = await focusApi.resumeSession(runningSession.id);
      setRunningSession(resumed);
      setFocusTimeElapsed(calculateEffectiveFocusSeconds(resumed));
      showToast('继续专注');
    } catch (err) {
      showToast(getErrorMessage(err, '继续专注失败'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadDailyStats() {
    setDailyStatsLoaded(false);
    try {
      const tList = await tasksApi.getTasks({date: dailyReportDate});
      setDailyTasks(tList);
      const sList = await focusApi.getSessions({date: dailyReportDate});
      setDailySessions(sList);
      const yesterday = new Date(dailyReportDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      setPrevDailySessions(await focusApi.getSessions({date: yesterdayStr}));
      setDailyStatsLoaded(true);
    } catch (err) {
      console.error('Daily stats loading failure', err);
    }
  }

  async function loadWeeklyStats() {
    setWeeklyStatsLoaded(false);
    try {
      const days = Array.from({length: 7}, (_, i) => {
        const d = new Date(weeklyStartDate);
        d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10);
      });

      const dayLoads = await Promise.all(days.map(async (day) => {
        const tList = await tasksApi.getTasks({date: day});
        const sList = await focusApi.getSessions({date: day});
        return {day, tasks: tList, sessions: sList};
      }));

      setWeeklyDaysData(dayLoads);
      setWeeklyStatsLoaded(true);
    } catch (err) {
      console.error('Weekly stats loading error', err);
    }
  }

  const todayCategoryFocusData = useMemo(
    () => buildTodayCategoryFocusData({categories, tasks, allTasks, selectedDateSessions}),
    [categories, tasks, allTasks, selectedDateSessions],
  );

  const dailyMetrics = useMemo(
    () => buildDailyReportMetrics({
      categories,
      dailyTasks,
      allTasks,
      dailySessions,
      prevDailySessions,
    }),
    [categories, dailyTasks, allTasks, dailySessions, prevDailySessions],
  );

  const weeklyMetrics = useMemo(
    () => buildWeeklyReviewMetrics({categories, weeklyDaysData}),
    [categories, weeklyDaysData],
  );

  const filteredTaskItems = useMemo(
    () => filterTasks(allTasks, {
      category: taskFilterCategory,
      status: taskFilterStatus as 'all' | TaskStatus,
      dateScope: taskFilterDateScope,
      selectedDate,
    }),
    [allTasks, taskFilterCategory, taskFilterStatus, taskFilterDateScope, selectedDate],
  );

  const focusController = {
    formattedElapsed: formatFocusElapsed(focusTimeElapsed),
    progressOffset: calculateFocusRingOffset(focusTimeElapsed),
  };
  const getTaskFocusMinutesForPanel = (taskId: number) =>
    getTaskFocusMinutes({
      taskId,
      selectedDateSessions,
      runningSession,
      focusTimeElapsed,
    });

  return (
    <div className="min-h-screen text-[#413333] font-sans selection:bg-rose-100 pb-12 transition-colors duration-300" style={{backgroundColor: styleContext.bg}} id="app_frame">
      <style>{`
        :root {
          --color-primary: ${styleContext.primary};
          --color-secondary: ${styleContext.secondary};
          --color-bg: ${styleContext.bg};
          --color-light: ${styleContext.light};
        }
        body {
          background-color: var(--color-bg) !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif;
          line-height: 1.6;
          transition: background-color 0.3s ease;
        }
      `}</style>

      <AppToast
        successMsg={successMsg}
        errorMsg={errorMsg}
        clearSuccess={clearSuccess}
        clearError={clearError}
      />

      {runningSession && activeTab !== 'focus' && (
        <GlobalRunningBar
          runningSession={runningSession}
          focusTimeElapsed={focusTimeElapsed}
          onOpenFocus={() => setActiveTab('focus')}
        />
      )}

      <AppHeader
        activeTab={activeTab}
        activeTheme={activeTheme}
        hasRunningSession={Boolean(runningSession)}
        runningSessionStatus={runningSession?.status}
        primaryColor={styleContext.primary}
        setActiveTab={setActiveTab}
        setActiveTheme={setActiveTheme}
        clearError={clearError}
      />

      <main className="max-w-[1280px] mx-auto px-6 mt-8 space-y-6" id="main_content">
        {activeTab === 'today' && (
          <DashboardPanel
            styleContext={{primary: styleContext.primary, primaryLight: styleContext.primaryLight, secondary: styleContext.secondary}}
            categories={categories}
            tasks={tasks}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            todayCategoryFocusData={todayCategoryFocusData}
            taskFormTitle={taskFormTitle}
            taskFormCategory={taskFormCategory}
            setTaskFormTitle={setTaskFormTitle}
            setTaskFormCategory={setTaskFormCategory}
            handleCreateTask={handleCreateTask}
            handleUpdateTaskStatus={handleUpdateTaskStatus}
            handleStartSession={handleStartSession}
            handleStopSession={handleStopSession}
            runningSession={runningSession}
            lastFinishedSessionTask={lastFinishedSessionTask}
            setLastFinishedSessionTask={setLastFinishedSessionTask}
            getTaskFocusMinutes={getTaskFocusMinutesForPanel}
          />
        )}
        {activeTab === 'tasks' && (
          <TasksPanel
            styleContext={{primary: styleContext.primary, primaryLight: styleContext.primaryLight, secondary: styleContext.secondary}}
            categories={categories}
            allTasks={allTasks}
            filteredTaskItems={filteredTaskItems}
            selectedDate={selectedDate}
            taskFormTitle={taskFormTitle}
            taskFormCategory={taskFormCategory}
            taskFormDate={taskFormDate}
            taskFilterCategory={taskFilterCategory}
            taskFilterStatus={taskFilterStatus}
            taskFilterDateScope={taskFilterDateScope}
            setTaskFormTitle={setTaskFormTitle}
            setTaskFormCategory={setTaskFormCategory}
            setTaskFormDate={setTaskFormDate}
            setTaskFilterCategory={setTaskFilterCategory}
            setTaskFilterStatus={setTaskFilterStatus}
            setTaskFilterDateScope={setTaskFilterDateScope}
            handleCreateTask={handleCreateTask}
            handleUpdateTaskStatus={handleUpdateTaskStatus}
            handleStartSession={handleStartSession}
            handleDeleteTask={handleDeleteTask}
          />
        )}
        {activeTab === 'categories' && (
          <CategoryPanel
            styleContext={{primary: styleContext.primary, primaryLight: styleContext.primaryLight}}
            categories={categories}
            allTasks={allTasks}
            presetColors={PRESET_COLORS}
            isCategoryModalOpen={categoryActions.isCategoryModalOpen}
            editingCategory={categoryActions.editingCategory}
            catFormName={categoryActions.catFormName}
            catFormColor={categoryActions.catFormColor}
            catFormSort={categoryActions.catFormSort}
            setIsCategoryModalOpen={categoryActions.setIsCategoryModalOpen}
            setCatFormName={categoryActions.setCatFormName}
            setCatFormColor={categoryActions.setCatFormColor}
            setCatFormSort={categoryActions.setCatFormSort}
            handleOpenCategoryModal={categoryActions.handleOpenCategoryModal}
            handleDeleteCategory={categoryActions.handleDeleteCategory}
            handleSaveCategory={categoryActions.handleSaveCategory}
          />
        )}
        {activeTab === 'daily' && (
          <DailyReportPanel
            styleContext={{primary: styleContext.primary, primaryLight: styleContext.primaryLight}}
            dailyReportDate={dailyReportDate}
            setDailyReportDate={setDailyReportDate}
            loadDailyStats={loadDailyStats}
            dailyStatsLoaded={dailyStatsLoaded}
            dailyTasks={dailyTasks}
            dailySessions={dailySessions}
            metrics={dailyMetrics}
          />
        )}
        {activeTab === 'weekly' && (
          <WeeklyReviewPanel
            styleContext={{primary: styleContext.primary, primaryLight: styleContext.primaryLight, secondary: styleContext.secondary}}
            weeklyStartDate={weeklyStartDate}
            setWeeklyStartDate={setWeeklyStartDate}
            loadWeeklyStats={loadWeeklyStats}
            weeklyStatsLoaded={weeklyStatsLoaded}
            metrics={weeklyMetrics}
          />
        )}
        {activeTab === 'focus' && runningSession && (
          <FocusPanel
            styleContext={{primary: styleContext.primary, primaryLight: styleContext.primaryLight, secondary: styleContext.secondary}}
            runningSession={runningSession}
            focusTimeElapsed={focusTimeElapsed}
            formattedElapsed={focusController.formattedElapsed}
            progressOffset={focusController.progressOffset}
            handleStopSession={handleStopSession}
            handlePauseSession={handlePauseSession}
            handleResumeSession={handleResumeSession}
          />
        )}
      </main>
    </div>
  );
}
