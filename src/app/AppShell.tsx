import {useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {
  Calendar,
  CalendarRange,
  ClipboardList,
  LayoutDashboard,
  ListTodo,
  Loader2,
  Square,
  Tags,
  Timer,
} from 'lucide-react';

import type {Category, Task, TaskExecutionSession} from '../../shared/domain/entities';
import type {TaskStatus} from '../../shared/domain/status';
import {categoriesApi} from '../modules/categories/api/categoriesApi';
import {CategoryPanel} from '../modules/categories/components/CategoryPanel';
import {getNextCategorySortOrder} from '../modules/categories/controllers/useCategoriesController';
import {DashboardPanel} from '../modules/dashboard/components/DashboardPanel';
import {buildTodayCategoryFocusData, getTaskFocusMinutes} from '../modules/dashboard/controllers/useDashboardController';
import {focusApi} from '../modules/focus/api/focusApi';
import {FocusPanel} from '../modules/focus/components/FocusPanel';
import {formatFocusElapsed, calculateFocusRingOffset} from '../modules/focus/controllers/useFocusController';
import {DailyReportPanel} from '../modules/reports/components/DailyReportPanel';
import {buildDailyReportMetrics} from '../modules/reports/controllers/useDailyReportController';
import {WeeklyReviewPanel} from '../modules/reports/components/WeeklyReviewPanel';
import {buildWeeklyReviewMetrics} from '../modules/reports/controllers/useWeeklyReviewController';
import {APP_TABS, type AppTab} from './navigation';
import {THEME_STYLES, type ThemeId} from './theme';
import {tasksApi} from '../modules/tasks/api/tasksApi';
import {filterTasks} from '../modules/tasks/controllers/useTasksController';
import {TasksPanel} from '../modules/tasks/components/TasksPanel';
import {calculateEffectiveFocusSeconds} from '../modules/focus/controllers/useFocusController';
import {AppToast} from './components/AppToast';
import {getErrorMessage} from './errors';
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runningSession, setRunningSession] = useState<TaskExecutionSession | null>(null);
  const [selectedDateSessions, setSelectedDateSessions] = useState<TaskExecutionSession[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const {successMsg, errorMsg, showToast, clearSuccess, clearError} = useToast();
  const [focusTimeElapsed, setFocusTimeElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catFormName, setCatFormName] = useState('');
  const [catFormColor, setCatFormColor] = useState('#fb7185');
  const [catFormSort, setCatFormSort] = useState(0);
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

  useEffect(() => {
    void loadMetaData();
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
    void loadTasksForSelectedDate();
  }, [selectedDate]);

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

  async function loadMetaData() {
    try {
      setLoading(true);
      const catsData = await categoriesApi.getCategories();
      setCategories(catsData);
      const tasksData = await tasksApi.getTasks({date: selectedDate});
      setTasks(tasksData);
      const all = await tasksApi.getTasks();
      setAllTasks(all);
      if (catsData.length > 0 && !taskFormCategory) {
        setTaskFormCategory(catsData[0].id);
      }
    } catch (err) {
      console.error('Failed to load metadata', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTasksForSelectedDate() {
    try {
      const data = await tasksApi.getTasks({date: selectedDate});
      setTasks(data);
      const sessionData = await focusApi.getSessions({date: selectedDate});
      setSelectedDateSessions(sessionData);
    } catch (err) {
      console.error('Failed to sync date tasks', err);
    }
  }

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

  function handleOpenCategoryModal(cat: Category | null) {
    setEditingCategory(cat);
    if (cat) {
      setCatFormName(cat.name);
      setCatFormColor(cat.color);
      setCatFormSort(cat.sortOrder);
    } else {
      setCatFormName('');
      setCatFormColor('#fb7185');
      setCatFormSort(getNextCategorySortOrder(categories));
    }
    setIsCategoryModalOpen(true);
  }

  async function handleSaveCategory() {
    if (!catFormName.trim()) {
      showToast('分类名称不能为空呀', 'error');
      return;
    }

    try {
      setLoading(true);
      if (editingCategory) {
        await categoriesApi.updateCategory(editingCategory.id, {name: catFormName, color: catFormColor, sortOrder: catFormSort});
        showToast('分类更新完成');
      } else {
        await categoriesApi.createCategory({name: catFormName, color: catFormColor, sortOrder: catFormSort});
        showToast('新分类创建成功');
      }
      setIsCategoryModalOpen(false);
      setCategories(await categoriesApi.getCategories());
    } catch (err) {
      showToast(getErrorMessage(err, '操作分类失败'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCategory(id: number) {
    if (!window.confirm('您确定要删去该分类？关联任务将变为无分类状态。')) return;
    try {
      setLoading(true);
      await categoriesApi.deleteCategory(id);
      showToast('分类已顺利移除');
      setCategories(await categoriesApi.getCategories());
    } catch (err) {
      showToast(getErrorMessage(err, '删除分类失败'), 'error');
    } finally {
      setLoading(false);
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
      setAllTasks(await tasksApi.getTasks());
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
      setAllTasks(await tasksApi.getTasks());
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
      setAllTasks(await tasksApi.getTasks());
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
      setAllTasks(await tasksApi.getTasks());
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
      setAllTasks(await tasksApi.getTasks());
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

  const iconMap = {
    today: LayoutDashboard,
    tasks: ListTodo,
    categories: Tags,
    daily: ClipboardList,
    weekly: CalendarRange,
    focus: Timer,
  } as const;

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
        <div onClick={() => setActiveTab('focus')} className="fixed bottom-6 right-6 bg-slate-900/95 backdrop-blur-xl text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-slate-900/20 flex items-center gap-3.5 cursor-pointer z-40 hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 ring-1 ring-white/10" id="global_running_bar">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center"><Timer className="w-4.5 h-4.5 text-rose-400" /></div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-400 rounded-full ring-2 ring-slate-900 animate-pulse" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-[9px] uppercase tracking-widest text-rose-400/70 font-semibold">心流引擎运行中</p>
            <p className="text-xs font-semibold truncate max-w-[160px] text-white/90">{runningSession.taskTitle || '主线专注中'}</p>
          </div>
          <span className="bg-white/10 text-rose-300 font-mono text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 tabular-nums">
            {Math.floor(focusTimeElapsed / 60)}:{String(focusTimeElapsed % 60).padStart(2, '0')}
          </span>
        </div>
      )}

      <header className="bg-white/70 backdrop-blur-xl sticky top-0 z-40 border-b border-slate-200/30 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-300">
        <div className="max-w-[1280px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 select-none cursor-default">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-lg shadow-rose-200/30 transition-transform duration-300 hover:scale-105" style={{backgroundColor: styleContext.primary}}>🍑</div>
            <div>
              <h1 className="font-extrabold text-sm tracking-tight text-slate-800 uppercase leading-none">{activeTheme === 'peach' ? 'COZY MOMENT' : 'SIMPLE LIFE'}</h1>
              <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest font-medium">时间专注沉淀手记</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-white/60 backdrop-blur-sm rounded-2xl p-1.5 border border-slate-200/40 shadow-sm" id="horizontal_navigation_menu">
            {APP_TABS.filter((tab) => tab.key !== 'focus').map((tab) => {
              const Icon = iconMap[tab.key];
              return (
                <button
                  key={tab.key}
                  onClick={() => {setActiveTab(tab.key); clearError();}}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                    activeTab === tab.key ? 'text-white shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-700 hover:bg-white/80'
                  }`}
                  style={activeTab === tab.key ? {backgroundColor: styleContext.primary} : undefined}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            {runningSession && (
              <button
                onClick={() => {setActiveTab('focus'); clearError();}}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  activeTab === 'focus' ? 'bg-rose-500 text-white shadow-md shadow-rose-200/50' : 'bg-rose-50/80 text-rose-500 hover:bg-rose-100/80'
                }`}
              >
                <Timer className={`w-3.5 h-3.5 ${runningSession.status === 'PAUSED' ? '' : 'animate-spin'}`} />
                <span>{runningSession.status === 'PAUSED' ? '已暂停' : '专注中'}</span>
              </button>
            )}
          </nav>

          <div className="flex items-center gap-0.5 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/30">
            <button onClick={() => setActiveTheme('peach')} className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer ${activeTheme === 'peach' ? 'bg-white text-rose-600 shadow-sm ring-1 ring-rose-100' : 'text-slate-400 hover:text-slate-600'}`}>🍑 {THEME_STYLES.peach.name}</button>
            <button onClick={() => setActiveTheme('beige')} className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer ${activeTheme === 'beige' ? 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-100' : 'text-slate-400 hover:text-slate-600'}`}>🪵 {THEME_STYLES.beige.name}</button>
          </div>
        </div>
      </header>

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
            isCategoryModalOpen={isCategoryModalOpen}
            editingCategory={editingCategory}
            catFormName={catFormName}
            catFormColor={catFormColor}
            catFormSort={catFormSort}
            setIsCategoryModalOpen={setIsCategoryModalOpen}
            setCatFormName={setCatFormName}
            setCatFormColor={setCatFormColor}
            setCatFormSort={setCatFormSort}
            handleOpenCategoryModal={handleOpenCategoryModal}
            handleDeleteCategory={handleDeleteCategory}
            handleSaveCategory={handleSaveCategory}
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
