import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  ListTodo, 
  Tags, 
  FileText, 
  CalendarRange, 
  Timer, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  Play, 
  Square, 
  AlertCircle, 
  Loader2, 
  Calendar,
  X,
  Sparkles,
  ClipboardList,
  Compass,
  TrendingUp,
  Award,
  ChevronRight,
  TrendingDown
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import type {Category, Task, TaskExecutionSession} from '../shared/domain/entities';
import type {TaskStatus} from '../shared/domain/status';
import {APP_TABS, type AppTab} from './app/navigation';
import {THEME_STYLES, type ThemeId} from './app/theme';
import {categoriesApi} from './modules/categories/api/categoriesApi';
import {tasksApi} from './modules/tasks/api/tasksApi';
import {focusApi} from './modules/focus/api/focusApi';
import {filterTasks} from './modules/tasks/controllers/useTasksController';

const PRESET_COLORS = [
  { hex: '#fb7185', label: '樱花粉' },
  { hex: '#f0abfc', label: '丁香紫' },
  { hex: '#818cf8', label: '晴空蓝' },
  { hex: '#2dd4bf', label: '薄荷绿' },
  { hex: '#34d399', label: '松石绿' },
  { hex: '#fbbf24', label: '向日葵' },
  { hex: '#f97316', label: '金柿橙' },
  { hex: '#a78bfa', label: '薰衣草' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('today');
  const [activeTheme, setActiveTheme] = useState<ThemeId>('peach');
  
  // Data State
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runningSession, setRunningSession] = useState<TaskExecutionSession | null>(null);
  const [selectedDateSessions, setSelectedDateSessions] = useState<TaskExecutionSession[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]); // for wider scope queries
  
  // Common UI State
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active Timer Tick
  const [focusTimeElapsed, setFocusTimeElapsed] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Today Date pivot
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Category modal & state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catFormName, setCatFormName] = useState<string>('');
  const [catFormColor, setCatFormColor] = useState<string>('#fb7185');
  const [catFormSort, setCatFormSort] = useState<number>(0);

  // Tasks Tab filters & forms
  const [taskFormTitle, setTaskFormTitle] = useState<string>('');
  const [taskFormCategory, setTaskFormCategory] = useState<number>(0);
  const [taskFormDate, setTaskFormDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [taskFilterCategory, setTaskFilterCategory] = useState<string>('all');
  const [taskFilterStatus, setTaskFilterStatus] = useState<string>('all');
  const [taskFilterDateScope, setTaskFilterDateScope] = useState<'today' | 'seven-days' | 'all'>('today');

  // Daily report & stats selected date
  const [dailyReportDate, setDailyReportDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [dailyTasks, setDailyTasks] = useState<Task[]>([]);
  const [dailySessions, setDailySessions] = useState<TaskExecutionSession[]>([]);
  const [prevDailySessions, setPrevDailySessions] = useState<TaskExecutionSession[]>([]); // yesterday's
  const [dailyStatsLoaded, setDailyStatsLoaded] = useState<boolean>(false);

  // Weekly review calculations data
  const [weeklyStartDate, setWeeklyStartDate] = useState<string>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // defaults to Monday
    return new Date(d.setDate(diff)).toISOString().slice(0, 10);
  });
  const [weeklyDaysData, setWeeklyDaysData] = useState<Array<{
    day: string;
    tasks: Task[];
    sessions: TaskExecutionSession[];
  }>>([]);
  const [weeklyStatsLoaded, setWeeklyStatsLoaded] = useState<boolean>(false);

  // Post focus task wrap-up prompt state
  const [lastFinishedSessionTask, setLastFinishedSessionTask] = useState<Task | null>(null);

  const styleContext = THEME_STYLES[activeTheme];

  // --- Initial Data loading ---
  useEffect(() => {
    loadMetaData();
    checkRunningSession();
  }, []);

  // Sync Timer Ticker if runningSession gets updated
  useEffect(() => {
    if (runningSession) {
      const startMs = new Date(runningSession.startedAt).getTime();
      const calculateDiff = () => Math.max(0, Math.round((Date.now() - startMs) / 1000));
      setFocusTimeElapsed(calculateDiff());

      timerRef.current = setInterval(() => {
        setFocusTimeElapsed(calculateDiff());
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setFocusTimeElapsed(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [runningSession]);

  // Keep Tasks synced if date pivots
  useEffect(() => {
    loadTasksForSelectedDate();
  }, [selectedDate]);

  // Monitor daily analytics page requirements
  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailyStats();
    }
  }, [dailyReportDate, activeTab]);

  // Monitor weekly review page calculations
  useEffect(() => {
    if (activeTab === 'weekly') {
      loadWeeklyStats();
    }
  }, [weeklyStartDate, activeTab]);

  // General state triggers
  const loadMetaData = async () => {
    try {
      setLoading(true);
      const catsData = await categoriesApi.getCategories();
      setCategories(catsData);
      
      const tasksData = await tasksApi.getTasks({ date: selectedDate });
      setTasks(tasksData);

      const all = await tasksApi.getTasks();
      setAllTasks(all);

      if (catsData.length > 0 && !taskFormCategory) {
        setTaskFormCategory(catsData[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load metadata', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTasksForSelectedDate = async () => {
    try {
      const data = await tasksApi.getTasks({ date: selectedDate });
      setTasks(data);
      const sessionData = await focusApi.getSessions({ date: selectedDate });
      setSelectedDateSessions(sessionData);
    } catch (err) {
      console.error('Failed to sync date tasks', err);
    }
  };

  const checkRunningSession = async () => {
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
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 3500);
    } else {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 4500);
    }
  };

  // --- Category Handlers ---
  const handleOpenCategoryModal = (cat: Category | null) => {
    setEditingCategory(cat);
    if (cat) {
      setCatFormName(cat.name);
      setCatFormColor(cat.color);
      setCatFormSort(cat.sortOrder);
    } else {
      setCatFormName('');
      setCatFormColor('#fb7185');
      setCatFormSort(categories.length > 0 ? Math.max(...categories.map(c => c.sortOrder)) + 10 : 10);
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!catFormName.trim()) {
      showToast('分类名称不能为空呀', 'error');
      return;
    }
    try {
      setLoading(true);
      if (editingCategory) {
        await categoriesApi.updateCategory(editingCategory.id, {
          name: catFormName,
          color: catFormColor,
          sortOrder: catFormSort
        });
        showToast('分类更新完成');
      } else {
        await categoriesApi.createCategory({
          name: catFormName,
          color: catFormColor,
          sortOrder: catFormSort
        });
        showToast('新分类创建成功');
      }
      setIsCategoryModalOpen(false);
      const list = await categoriesApi.getCategories();
      setCategories(list);
    } catch (err: any) {
      showToast(err.message || '操作分类失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm('您确定要删去该分类？关联任务将变为无分类状态。')) return;
    try {
      setLoading(true);
      await categoriesApi.deleteCategory(id);
      showToast('分类已顺利移除');
      const list = await categoriesApi.getCategories();
      setCategories(list);
    } catch (err: any) {
      showToast(err.message || '删除分类失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Task Operations ---
  const handleCreateTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      await tasksApi.createTask({
        title: taskFormTitle,
        categoryId: catId,
        plannedDate: taskFormDate
      });
      showToast('任务已成功下派！');
      setTaskFormTitle('');
      
      const all = await tasksApi.getTasks();
      setAllTasks(all);

      if (taskFormDate === selectedDate) {
        loadTasksForSelectedDate();
      }
    } catch (err: any) {
      showToast(err.message || '生成行动项失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (id: number, status: TaskStatus) => {
    try {
      await tasksApi.updateTaskStatus(id, status);
      if (runningSession?.taskId === id && status !== 'IN_PROGRESS') {
        setRunningSession(null);
      }
      showToast('进展转换完美同步');
      await loadTasksForSelectedDate();
      
      // Update local allTasks buffer
      const all = await tasksApi.getTasks();
      setAllTasks(all);

      // Re-trigger daily / weekly stats if they correspond
      if (activeTab === 'daily') loadDailyStats();
      if (activeTab === 'weekly') loadWeeklyStats();
    } catch (err: any) {
      showToast(err.message || '更新状态故障', 'error');
    }
  };

  // --- Timer Focus Flow Engines ---
  const handleStartSession = async (task: Task) => {
    try {
      setLoading(true);
      const session = await focusApi.startSession(task.id);
      setRunningSession(session);
      setActiveTab('focus');
      showToast(`✨ 进入「${task.title}」深度聚焦空间`);
      await loadTasksForSelectedDate();
      const all = await tasksApi.getTasks();
      setAllTasks(all);
    } catch (err: any) {
      showToast(err.message || '无法启动心流计时器', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStopSession = async () => {
    if (!runningSession) return;
    try {
      setLoading(true);
      const stopped = await focusApi.stopSession(runningSession.id);
      
      // Try to find native task
      let originTask = tasks.find(t => t.id === stopped.taskId);
      if (!originTask) {
        originTask = allTasks.find(t => t.id === stopped.taskId);
      }
      if (originTask) {
        setLastFinishedSessionTask(originTask);
      }

      setRunningSession(null);
      showToast('这一阶段的高能专注已完美记入归属分类！');
      setActiveTab('today');
      await loadTasksForSelectedDate();
      const all = await tasksApi.getTasks();
      setAllTasks(all);
    } catch (err: any) {
      showToast(err.message || '终止心流阶段出现故障', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Single Day Statistics Analytics ---
  const loadDailyStats = async () => {
    setDailyStatsLoaded(false);
    try {
      const tList = await tasksApi.getTasks({ date: dailyReportDate });
      setDailyTasks(tList);

      const sList = await focusApi.getSessions({ date: dailyReportDate });
      setDailySessions(sList);

      // Fetch yesterday comparison
      const yesterday = new Date(dailyReportDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      const sPrevList = await focusApi.getSessions({ date: yesterdayStr });
      setPrevDailySessions(sPrevList);

      setDailyStatsLoaded(true);
    } catch (err) {
      console.error('Daily stats loading failure', err);
    }
  };

  // --- Multi Day Weekly Statistics Analytics ---
  const loadWeeklyStats = async () => {
    setWeeklyStatsLoaded(false);
    try {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weeklyStartDate);
        d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10);
      });

      const dayLoads = await Promise.all(days.map(async (day) => {
        const tList = await tasksApi.getTasks({ date: day });
        const sList = await focusApi.getSessions({ date: day });
        return { day, tasks: tList, sessions: sList };
      }));

      setWeeklyDaysData(dayLoads);
      setWeeklyStatsLoaded(true);
    } catch (err) {
      console.error('Weekly stats loading error', err);
    }
  };

  // Focus accumulator calculator
  const getTaskFocusMinutes = (taskId: number) => {
    const completedSecs = selectedDateSessions
      .filter(s => s.taskId === taskId && s.status === 'COMPLETED')
      .reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    
    let activeSecs = 0;
    if (runningSession && runningSession.taskId === taskId) {
      activeSecs = focusTimeElapsed;
    }
    
    return Math.round((completedSecs + activeSecs) / 60);
  };

  // Cumulative focus metrics for Today's Header Area
  const todayCategoryFocusData = categories.map(cat => {
    const catSessions = selectedDateSessions.filter(s => {
      const t = tasks.find(task => task.id === s.taskId) || allTasks.find(task => task.id === s.taskId);
      return t && t.categoryId === cat.id && s.status === 'COMPLETED';
    });
    const totalSecs = catSessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
    const minutes = Math.round(totalSecs / 60);
    return {
      name: cat.name,
      minutes: minutes,
      color: cat.color
    };
  }).filter(c => c.minutes > 0);

  // Daily statistics metrics computations
  const totalDailyCompletedSecs = dailySessions
    .filter(s => s.status === 'COMPLETED')
    .reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
  
  const totalPrevDailyCompletedSecs = prevDailySessions
    .filter(s => s.status === 'COMPLETED')
    .reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
  
  const dailyTotalMins = Math.round(totalDailyCompletedSecs / 60);
  const prevDailyTotalMins = Math.round(totalPrevDailyCompletedSecs / 60);
  
  const dailyFocusDeltaPercent = prevDailyTotalMins === 0 
    ? (dailyTotalMins > 0 ? 100 : 0)
    : Math.round(((dailyTotalMins - prevDailyTotalMins) / prevDailyTotalMins) * 100);

  const doneDailyTasksCount = dailyTasks.filter(t => t.status === 'DONE').length;
  const todoDailyTasksCount = dailyTasks.filter(t => t.status === 'TODO').length;
  const inProgressDailyTasksCount = dailyTasks.filter(t => t.status === 'IN_PROGRESS').length;
  const notDoneDailyTasksCount = dailyTasks.filter(t => t.status === 'NOT_DONE').length;

  const dailyCategoryDistributionData = categories.map(cat => {
    const catSessions = dailySessions.filter(s => {
      const t = dailyTasks.find(task => task.id === s.taskId) || allTasks.find(task => task.id === s.taskId);
      return t && t.categoryId === cat.id && s.status === 'COMPLETED';
    });
    const minutes = Math.round(catSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 60);
    return {
      name: cat.name,
      minutes: minutes,
      color: cat.color
    };
  }).filter(c => c.minutes > 0);

  // Weekly review computations
  const weeklyTotalTasks = weeklyDaysData.reduce((acc, d) => acc + d.tasks.length, 0);
  const weeklyDoneTasks = weeklyDaysData.reduce((acc, d) => acc + d.tasks.filter(t => t.status === 'DONE').length, 0);
  const weeklyPendingTasks = weeklyDaysData.reduce((acc, d) => acc + d.tasks.filter(t => t.status === 'TODO' || t.status === 'IN_PROGRESS').length, 0);
  const weeklyOverdueTasks = weeklyDaysData.reduce((acc, d) => acc + d.tasks.filter(t => t.status === 'NOT_DONE').length, 0);
  
  const weeklyTotalMins = Math.round(
    weeklyDaysData.reduce((acc, d) => {
      const sSecs = d.sessions.filter(s => s.status === 'COMPLETED').reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
      return acc + sSecs;
    }, 0) / 60
  );

  const weeklyTimelineRateData = weeklyDaysData.map(d => {
    const tCount = d.tasks.length;
    const dCount = d.tasks.filter(t => t.status === 'DONE').length;
    const rate = tCount === 0 ? 0 : Math.round((dCount / tCount) * 100);
    
    // convert YYYY-MM-DD to cleaner label Mon/Tue/Wed
    const dateObj = new Date(d.day);
    const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekdayName = weekdayLabels[dateObj.getDay()];
    
    return {
      day: d.day.slice(5), // MM-DD
      weekday: weekdayName,
      rate: rate,
      total: tCount,
      completed: dCount
    };
  });

  const weeklyCategoryDistribution = categories.map(cat => {
    let completedCount = 0;
    weeklyDaysData.forEach(d => {
      const match = d.tasks.filter(t => t.categoryId === cat.id && t.status === 'DONE');
      completedCount += match.length;
    });
    return {
      name: cat.name,
      value: completedCount,
      color: cat.color
    };
  }).filter(c => c.value > 0);

  // Longest streak calculation within active Monday-Sunday sequence
  const weeklyStreaksList = weeklyDaysData.map(d => {
    return d.tasks.length > 0 && d.tasks.filter(t => t.status === 'DONE').length >= Math.ceil(d.tasks.length / 2);
  });
  
  let maxStreak = 0;
  let tempStreak = 0;
  weeklyStreaksList.forEach(isDone => {
    if (isDone) {
      tempStreak++;
      if (tempStreak > maxStreak) maxStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  });

  const filteredTaskItems = filterTasks(allTasks, {
    category: taskFilterCategory,
    status: taskFilterStatus as 'all' | TaskStatus,
    dateScope: taskFilterDateScope,
    selectedDate,
  });

  return (
    <div className="min-h-screen text-[#413333] font-sans selection:bg-rose-100 pb-12 transition-colors duration-300" style={{ backgroundColor: styleContext.bg }} id="app_frame">
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
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1.0); opacity: 0.15; }
          50% { transform: scale(1.12); opacity: 0.25; }
        }
        .breathing-ring {
          animation: pulse-ring 3s infinite ease-in-out;
        }
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in-up {
          animation: fade-in-up 0.35s ease-out;
        }
      `}</style>

      {/* Global Alerts Floating Layer */}
      {successMsg && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4" id="success_toast">
          <div className="bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl shadow-emerald-200/40 flex items-center gap-3 min-w-[240px] overflow-hidden relative">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold">{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="ml-auto text-white/60 hover:text-white transition shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/30">
              <div className="h-full bg-white/80 rounded-full" style={{ animation: 'shrink 3.5s linear forwards' }}></div>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4" id="error_toast">
          <div className="bg-white border border-rose-200 text-rose-700 px-5 py-3 rounded-2xl shadow-xl shadow-rose-100/40 flex items-center gap-3 min-w-[240px] overflow-hidden relative">
            <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <span className="text-xs font-semibold">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="ml-auto text-slate-300 hover:text-slate-500 transition shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-rose-100">
              <div className="h-full bg-rose-400 rounded-full" style={{ animation: 'shrink 4.5s linear forwards' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Active Session Floater widget */}
      {runningSession && activeTab !== 'focus' && (
        <div
          onClick={() => setActiveTab('focus')}
          className="fixed bottom-6 right-6 bg-slate-900/95 backdrop-blur-xl text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-slate-900/20 flex items-center gap-3.5 cursor-pointer z-40 hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 ring-1 ring-white/10"
          id="global_running_bar"
        >
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center">
              <Timer className="w-4.5 h-4.5 text-rose-400" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-400 rounded-full ring-2 ring-slate-900 animate-pulse"></span>
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

      {/* Header Brand Section */}
      <header className="bg-white/70 backdrop-blur-xl sticky top-0 z-40 border-b border-slate-200/30 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-300">
        <div className="max-w-[1280px] mx-auto px-6 py-3.5 flex items-center justify-between">

          <div className="flex items-center gap-3 select-none cursor-default">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-lg shadow-rose-200/30 transition-transform duration-300 hover:scale-105" style={{ backgroundColor: styleContext.primary }}>
              🍑
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-tight text-slate-800 uppercase leading-none">
                {activeTheme === 'peach' ? 'COZY MOMENT' : 'SIMPLE LIFE'}
              </h1>
              <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest font-medium">
                时间专注沉淀手记
              </p>
            </div>
          </div>

          {/* Horizontal Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-white/60 backdrop-blur-sm rounded-2xl p-1.5 border border-slate-200/40 shadow-sm" id="horizontal_navigation_menu">
            {APP_TABS.filter((tab) => tab.key !== 'focus').map((tab) => {
              const iconMap = {
                today: LayoutDashboard,
                tasks: ListTodo,
                categories: Tags,
                daily: FileText,
                weekly: CalendarRange,
                focus: Timer,
              } as const;
              const Icon = iconMap[tab.key];

              return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setErrorMsg(null); }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  activeTab === tab.key
                    ? 'text-white shadow-md scale-[1.02]'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/80'
                }`}
                style={activeTab === tab.key ? { backgroundColor: styleContext.primary } : undefined}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
              );
            })}

            {runningSession && (
              <button
                onClick={() => { setActiveTab('focus'); setErrorMsg(null); }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  activeTab === 'focus'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-200/50'
                    : 'bg-rose-50/80 text-rose-500 hover:bg-rose-100/80'
                }`}
              >
                <Timer className="w-3.5 h-3.5 animate-spin" />
                <span>专注中</span>
              </button>
            )}
          </nav>

          {/* Dual Theme Toggle switcher */}
          <div className="flex items-center gap-0.5 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/30">
            <button
              onClick={() => setActiveTheme('peach')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                activeTheme === 'peach'
                  ? 'bg-white text-rose-600 shadow-sm ring-1 ring-rose-100'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              🍑 {THEME_STYLES.peach.name}
            </button>
            <button
              onClick={() => setActiveTheme('beige')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                activeTheme === 'beige'
                  ? 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-100'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              🪵 {THEME_STYLES.beige.name}
            </button>
          </div>

        </div>
      </header>

      {/* Main Responsive Area Centered */}
      <main className="max-w-[1280px] mx-auto px-6 mt-8 space-y-6" id="main_content">
        
        {/* --- View: Today Timeline (今日执行) --- */}
        {activeTab === 'today' && (
          <div className="space-y-6" id="today_view">
            
            {/* Header statistics panel */}
            <header className="bg-white rounded-2xl border border-slate-200/60 p-6 flex items-center justify-between gap-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]" id="today_header">
              <div className="space-y-2.5">
                <span className="px-3 py-1 text-white text-[10px] font-bold rounded-full uppercase tracking-wider inline-block bg-[var(--color-primary)] shadow-sm shadow-[var(--color-primary)]/20">
                  Primary Flow Focus
                </span>
                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  今日规划时空轴
                </h2>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" style={{ color: styleContext.primary }} />
                  <span className="font-semibold text-slate-600">聚焦选期:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 outline-none hover:border-slate-300 focus:border-[var(--color-primary)] px-3 py-1.5 font-mono rounded-xl text-xs text-slate-700 font-bold transition-colors"
                  />
                </div>
              </div>

              {/* Mini Today Category Stats Recharts Chart */}
              <div className="w-[320px] h-[100px] bg-slate-50/80 border border-slate-200/40 rounded-xl p-3 flex flex-col justify-between" id="today_header_chart">
                <div className="flex items-center justify-between text-[9px] font-semibold text-slate-400 tracking-wider">
                  <span>累计专注板块 (分钟)</span>
                  {todayCategoryFocusData.length > 0 && (
                    <span className="font-bold px-2 py-0.5 rounded-full font-mono" style={{ color: styleContext.primary, backgroundColor: styleContext.primaryLight }}>
                      已专注 {todayCategoryFocusData.reduce((acc, c) => acc + c.minutes, 0)}m
                    </span>
                  )}
                </div>

                <div className="flex-1 min-h-0 w-full mt-1">
                  {todayCategoryFocusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={todayCategoryFocusData}
                        layout="vertical"
                        margin={{ top: 2, right: 10, left: -25, bottom: 2 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          stroke="#57534e" 
                          fontSize={8} 
                          fontWeight="bold"
                          tickLine={false}
                          axisLine={false}
                          width={75}
                        />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow font-bold">
                                  <span>{data.name}：{data.minutes}分钟</span>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="minutes" radius={[0, 4, 4, 0]} barSize={8}>
                          {todayCategoryFocusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <p className="text-[9px] text-slate-400 font-bold">今日无计时，点击行动旁 ▶️ 开启专注模式</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Statistics values summary indicators */}
              <div className="flex gap-3">
                <div className="bg-slate-50 hover:bg-slate-100 transition-colors rounded-xl px-5 py-3 text-center min-w-[80px] border border-slate-200/40">
                  <p className="text-[10px] text-slate-400 font-semibold">待完成</p>
                  <p className="text-lg font-extrabold text-slate-700 mt-0.5">
                    {tasks.filter(t => t.status === 'TODO' || t.status === 'IN_PROGRESS').length}
                  </p>
                </div>
                <div className="bg-emerald-50 hover:bg-emerald-100/60 transition-colors rounded-xl px-5 py-3 text-center min-w-[80px] border border-emerald-200/40">
                  <p className="text-[10px] text-emerald-600 font-semibold">已完结</p>
                  <p className="text-lg font-extrabold text-emerald-600 mt-0.5">
                    {tasks.filter(t => t.status === 'DONE').length}
                  </p>
                </div>
              </div>

            </header>

            {/* Wrapup alert after stopwatch session stops */}
            {lastFinishedSessionTask && (
              <div className="bg-white border-2 border-dashed border-rose-200 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-sm animate-in fade-in zoom-in-95" id="feedback_panel">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-lg shadow-sm">
                    💡
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">完成了刚才的心流阶段？</h4>
                    <p className="text-xs text-slate-500 mt-0.5">主线聚焦: <strong className="text-rose-600">「{lastFinishedSessionTask.title}」</strong></p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      handleUpdateTaskStatus(lastFinishedSessionTask.id, 'DONE');
                      setLastFinishedSessionTask(null);
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm shadow-emerald-200/40 transition-all hover:scale-[1.02]"
                  >
                    ✓ 完美标记
                  </button>
                  <button
                    onClick={() => setLastFinishedSessionTask(null)}
                    className="text-slate-400 hover:bg-slate-100 text-xs font-semibold px-4 py-2 rounded-xl transition"
                  >
                    稍后处理
                  </button>
                </div>
              </div>
            )}

            {/* Flat rapid quick dispatch bar */}
            <div className="bg-white border border-slate-200/60 rounded-2xl p-4 flex items-center gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
              <input
                type="text"
                placeholder="💡 快速添加今日行动计划..."
                value={taskFormTitle}
                onChange={(e) => setTaskFormTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateTask();
                }}
                className="flex-1 text-sm border border-slate-200 bg-slate-50/50 p-2.5 rounded-xl outline-none focus:border-[var(--color-primary)] focus:bg-white focus:shadow-sm font-semibold transition-all text-slate-800 placeholder:text-slate-300"
              />
              <div className="flex items-center gap-2.5">
                <select
                  value={taskFormCategory}
                  onChange={(e) => setTaskFormCategory(Number(e.target.value))}
                  className="px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl text-slate-600 font-semibold outline-none cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                  {categories.length === 0 && <option value="">暂无分类</option>}
                </select>

                <button
                  onClick={() => handleCreateTask()}
                  className="text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-[var(--color-primary)]/20 hover:shadow-md hover:scale-[1.02] flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                  style={{ backgroundColor: styleContext.primary }}
                >
                  <Plus className="w-3.5 h-3.5" /> 快速派遣
                </button>
              </div>
            </div>

            {/* Timeline Layout */}
            <div className="bg-white border border-slate-200/60 rounded-2xl p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <h3 className="font-extrabold text-sm text-slate-700 mb-8 border-l-4 pl-3.5" style={{ borderColor: styleContext.primary }}>
                行动轨迹轴
              </h3>

              {tasks.length > 0 ? (
                <div className="relative pl-8 border-l-2 ml-4 space-y-6" style={{ borderColor: styleContext.secondary }}>

                  {tasks.map(task => {
                    const cat = categories.find(c => c.id === task.categoryId);
                    const focusMins = getTaskFocusMinutes(task.id);
                    const isActiveTask = runningSession?.taskId === task.id;

                    // node color states
                    let nodeDotClass = "bg-white border-2 border-slate-300";
                    let nodeInnerDotColor = "transparent";

                    if (isActiveTask) {
                      nodeDotClass = "bg-white shadow-md ring-4 ring-[var(--color-primary)]/15";
                      nodeInnerDotColor = styleContext.primary;
                    } else if (task.status === 'DONE') {
                      nodeDotClass = "bg-emerald-100 border-2 border-emerald-400";
                      nodeInnerDotColor = "#34d399";
                    } else if (task.status === 'NOT_DONE') {
                      nodeDotClass = "bg-rose-50 border-2 border-rose-300";
                      nodeInnerDotColor = "#fca5a5";
                    }

                    return (
                      <div key={task.id} className="relative group/card fade-in-up">

                        {/* Timeline Circle Bullet Node */}
                        <div
                          className={`absolute -left-[37px] top-5 w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${nodeDotClass}`}
                          style={isActiveTask ? { borderColor: styleContext.primary } : undefined}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full transition-colors"
                            style={{ backgroundColor: nodeInnerDotColor }}
                          />
                        </div>

                        {/* Interactive Task Card */}
                        <div
                          className={`bg-white border-2 p-5 rounded-xl transition-all duration-200 select-none ${
                            isActiveTask
                              ? 'border-[var(--color-primary)] shadow-md bg-[var(--color-light)]'
                              : task.status === 'DONE'
                                ? 'border-slate-200/60 bg-slate-50/30'
                                : 'border-slate-200/60 hover:border-[var(--color-primary)]/40 hover:shadow-sm hover:bg-[var(--color-light)]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">

                            <div className="space-y-2 flex-1 min-w-0">
                              <h4 className={`text-sm tracking-tight font-bold leading-snug ${task.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                {task.title}
                              </h4>

                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span
                                  className="text-[10px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-full border"
                                  style={{
                                    color: cat ? cat.color : '#64748b',
                                    backgroundColor: (cat ? cat.color : '#94a3b8') + '10',
                                    borderColor: (cat ? cat.color : '#94a3b8') + '20'
                                  }}
                                >
                                  {cat ? cat.name : '未分类'}
                                </span>

                                {focusMins > 0 && (
                                  <span className="text-[10px] font-semibold text-indigo-500 font-mono bg-indigo-50 px-2 py-0.5 rounded-full">
                                    ⏱ {focusMins} 分钟
                                  </span>
                                )}

                                {task.status === 'NOT_DONE' && (
                                  <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                                    已搁置
                                  </span>
                                )}

                                {isActiveTask && (
                                  <span className="text-[10px] font-bold bg-[var(--color-light)] px-2 py-0.5 rounded-full animate-pulse" style={{ color: styleContext.primary }}>
                                    专注进行中
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover/card:opacity-100 transition-all duration-200 shrink-0">

                              {!isActiveTask && task.status !== 'DONE' && (
                                <button
                                  onClick={() => handleStartSession(task)}
                                  className="px-2.5 py-1.5 bg-[var(--color-primary)]/10 rounded-lg hover:bg-[var(--color-primary)]/20 transition-all text-[10px] font-bold cursor-pointer"
                                  style={{ color: styleContext.primary }}
                                  title="开启心流专注"
                                >
                                  ▶ 专注
                                </button>
                              )}

                              {isActiveTask && (
                                <button
                                  onClick={handleStopSession}
                                  className="px-2.5 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                >
                                  <Square className="w-2.5 h-2.5 text-rose-400 fill-current" />
                                  停止
                                </button>
                              )}

                              {task.status !== 'DONE' && (
                                <button
                                  onClick={() => handleUpdateTaskStatus(task.id, 'DONE')}
                                  className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition text-[10px] font-bold cursor-pointer"
                                  title="标记完成"
                                >
                                  ✓ 完成
                                </button>
                              )}

                              {task.status !== 'NOT_DONE' && task.status !== 'DONE' && (
                                <button
                                  onClick={() => handleUpdateTaskStatus(task.id, 'NOT_DONE')}
                                  className="px-2.5 py-1.5 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition text-[10px] font-bold cursor-pointer"
                                  title="搁置"
                                >
                                  ✗ 搁置
                                </button>
                              )}

                              {(task.status === 'DONE' || task.status === 'NOT_DONE') && (
                                <button
                                  onClick={() => handleUpdateTaskStatus(task.id, 'TODO')}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-bold rounded-lg transition"
                                >
                                  重置
                                </button>
                              )}

                            </div>

                          </div>
                        </div>

                      </div>
                    );
                  })}

                </div>
              ) : (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: styleContext.primaryLight }}>
                    <ClipboardList className="w-8 h-8 stroke-[1.5]" style={{ color: styleContext.primary }} />
                  </div>
                  <p className="text-sm font-bold text-slate-600">今日暂无行动计划</p>
                  <p className="text-xs text-slate-400 mt-1.5">在上方输入框添加你的今日行动项</p>
                </div>
              )}

            </div>
          </div>
        )}

        {/* --- View: Pipeline Tasks Storage (任务库) --- */}
        {activeTab === 'tasks' && (
          <div className="space-y-6" id="tasks_view">
            
            <header className="bg-white rounded-2xl border border-slate-200/60 p-6 flex flex-col gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.04)]" id="tasks_header">
              <span className="px-3 py-1 text-[10px] font-bold rounded-full w-fit" style={{ color: styleContext.primary, backgroundColor: styleContext.primaryLight }}>
                Global Task Reserves
              </span>
              <h2 className="text-xl font-extrabold text-slate-800 mt-1">全局储备与规划中心</h2>
              <p className="text-xs text-slate-500 font-medium">配置、调度未来日期及历届滞存指令集的核心仓库，支持多级交叉状态过滤。</p>
            </header>

            {/* Split controls block: Left Add Form, Right Filter Results List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="bg-white border border-slate-200/60 p-6 rounded-2xl space-y-4 h-fit shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Plus className="w-4 h-4" style={{ color: styleContext.primary }} />
                  新建储备规划项
                </h3>

                <form onSubmit={(e) => { e.preventDefault(); handleCreateTask(); }} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">行动主题</label>
                    <input
                      type="text"
                      placeholder="e.g. 审定核心业务数据"
                      value={taskFormTitle}
                      onChange={(e) => setTaskFormTitle(e.target.value)}
                      className="w-full text-xs border border-slate-200 bg-slate-50/50 p-2.5 rounded-xl focus:bg-white outline-none focus:border-[var(--color-primary)] font-semibold transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">归属分类</label>
                    <select
                      value={taskFormCategory}
                      onChange={(e) => setTaskFormCategory(Number(e.target.value))}
                      className="w-full text-xs border border-slate-200 bg-white p-2.5 rounded-xl outline-none cursor-pointer hover:bg-slate-50 font-semibold transition-colors"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                      {categories.length === 0 && <option value="">暂无分类</option>}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">排期日期</label>
                    <input
                      type="date"
                      value={taskFormDate}
                      onChange={(e) => setTaskFormDate(e.target.value)}
                      className="w-full text-xs border border-slate-200 bg-white p-2.5 rounded-xl outline-none cursor-pointer font-semibold hover:bg-slate-50 transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full text-white text-xs font-bold py-3 rounded-xl shadow-sm shadow-[var(--color-primary)]/20 flex items-center justify-center gap-1.5 transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                    style={{ backgroundColor: styleContext.primary }}
                  >
                    <Plus className="w-3.5 h-3.5" /> 确认归档入库
                  </button>
                </form>
              </div>

              {/* Multi-Filters columns and detailed items list */}
              <div className="lg:col-span-2 space-y-4">
                
                <div className="bg-slate-50/80 border border-slate-200/40 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">

                    <div className="space-y-0.5">
                      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest pl-1">分类</p>
                      <select
                        value={taskFilterCategory}
                        onChange={(e) => setTaskFilterCategory(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg text-slate-700 font-semibold outline-none transition-colors hover:border-slate-300"
                      >
                        <option value="all">全部</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest pl-1">状态</p>
                      <select
                        value={taskFilterStatus}
                        onChange={(e) => setTaskFilterStatus(e.target.value)}
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
                        onChange={(e) => setTaskFilterDateScope(e.target.value as any)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg text-slate-700 font-semibold outline-none transition-colors hover:border-slate-300"
                      >
                        <option value="today">今日</option>
                        <option value="seven-days">未来7天</option>
                        <option value="all">全部</option>
                      </select>
                    </div>

                  </div>

                  <span className="text-[10px] font-semibold text-slate-400 font-mono bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                    匹配: {allTasks.length} 项
                  </span>
                </div>

                {/* Task list */}
                <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                  <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                    {filteredTaskItems.map(t => {
                      const cat = categories.find(c => c.id === t.categoryId);
                      const isComplete = t.status === 'DONE';
                      return (
                        <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-all group/task">
                          <div className="space-y-1.5 pr-4">
                            <h4 className={`text-xs font-bold leading-normal ${isComplete ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                              {t.title}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider"
                                style={{
                                  color: cat ? cat.color : '#64748b',
                                  backgroundColor: (cat ? cat.color : '#94a3b8') + '10',
                                  borderColor: (cat ? cat.color : '#94a3b8') + '20'
                                }}
                              >
                                {cat ? cat.name : '通用'}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono font-semibold flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-300" />
                                {t.plannedDate}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 select-none">
                            <select
                              value={t.status}
                              onChange={(e) => {
                                const nextStatus = e.target.value as TaskStatus;
                                if (nextStatus === 'IN_PROGRESS') {
                                  handleStartSession(t);
                                  return;
                                }
                                handleUpdateTaskStatus(t.id, nextStatus);
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
                                onClick={() => handleStartSession(t)}
                                className="px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all"
                                style={{ color: styleContext.primary, backgroundColor: styleContext.primaryLight }}
                                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = styleContext.secondary + '40')}
                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = styleContext.primaryLight)}
                              >
                                ▶ 专注
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {allTasks.length === 0 && (
                      <div className="p-12 text-center text-slate-400">
                        <p className="text-xs font-bold">没有找到符合这些筛选的储备方案项</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* --- View: Multi Grid Bento Categories Management (分类管理) --- */}
        {activeTab === 'categories' && (
          <div className="space-y-6" id="categories_view">
            
            <header className="bg-white rounded-2xl border border-slate-200/60 p-6 flex items-center justify-between gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]" id="categories_header">
              <div>
                <span className="px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider inline-block" style={{ color: styleContext.primary, backgroundColor: styleContext.primaryLight }}>
                  Categories Matrix
                </span>
                <h2 className="text-xl font-extrabold text-slate-800 mt-2">分类令牌设定中心</h2>
                <p className="text-xs text-slate-500 font-medium">设计多级色彩和排序权重，使专注数据分析能精密关联在特定板块中。</p>
              </div>

              <button
                onClick={() => handleOpenCategoryModal(null)}
                className="text-white font-bold text-xs px-5 py-3 rounded-xl shadow-sm shadow-[var(--color-primary)]/20 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: styleContext.primary }}
              >
                <Plus className="w-3.5 h-3.5" /> 新建分类
              </button>
            </header>

            {/* Grid Layout conforming strictly exactly to "每行4个单元网格布局" (at widescreen display grid-cols-4) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6" id="categories_grid">
              
              {categories.map(cat => {
                const associatedTasks = allTasks.filter(t => t.categoryId === cat.id);
                return (
                  <div
                    key={cat.id}
                    className="bg-white border border-slate-200/60 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] relative overflow-hidden flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
                  >
                    {/* Top colored stripe */}
                    <div
                      className="h-[56px] w-full flex items-end px-4 pb-2.5"
                      style={{ backgroundColor: cat.color }}
                    >
                      <span className="text-[10px] uppercase font-bold text-white/90 tracking-widest bg-black/10 backdrop-blur-sm px-2.5 py-0.5 rounded-full">
                        #{cat.sortOrder}
                      </span>
                    </div>

                    {/* Bottom info */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm tracking-tight">
                            {cat.name}
                          </h4>
                          <span className="text-[11px] text-slate-400 font-semibold font-mono">
                            {associatedTasks.length} 项关联
                          </span>
                        </div>

                        {/* Hover action buttons */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-slate-50 rounded-lg p-0.5">
                          <button
                            onClick={() => handleOpenCategoryModal(cat)}
                            className="p-1.5 hover:bg-white text-slate-500 rounded-md transition shadow-sm"
                            title="编辑"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
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

              {/* Add new category placeholder */}
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

            {/* Create / Edit Category Modal */}
            {isCategoryModalOpen && (
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
                id="category_modal"
                onClick={(e) => { if (e.target === e.currentTarget) setIsCategoryModalOpen(false); }}
                onKeyDown={(e) => { if (e.key === 'Escape') setIsCategoryModalOpen(false); }}
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
                        onChange={(e) => setCatFormName(e.target.value)}
                        autoFocus
                        className="w-full text-xs border border-slate-200 bg-slate-50/50 p-2.5 text-slate-800 rounded-xl outline-none focus:border-[var(--color-primary)] focus:bg-white font-semibold transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                        色彩标签
                      </label>

                      <div className="grid grid-cols-8 gap-1.5 p-3 bg-slate-50/50 border border-slate-200/40 rounded-xl">
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setCatFormColor(c.hex)}
                            title={c.label}
                            className={`w-full aspect-square rounded-lg border-2 transition-all duration-150 relative ${
                              catFormColor === c.hex
                                ? 'scale-110 ring-2 ring-offset-2 border-white shadow-md'
                                : 'hover:scale-105 border-transparent'
                            }`}
                            style={{ backgroundColor: c.hex, ringColor: c.hex }}
                          >
                            {catFormColor === c.hex && (
                              <Check className="w-3 h-3 text-white absolute inset-0 m-auto stroke-[3]" />
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Custom color input */}
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={catFormColor}
                          onChange={(e) => setCatFormColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 shrink-0 hover:scale-105 transition"
                        />
                        <input
                          type="text"
                          value={catFormColor}
                          onChange={(e) => setCatFormColor(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs text-slate-700 rounded-xl border border-slate-200 outline-none font-mono font-bold uppercase transition-colors focus:border-[var(--color-primary)]"
                          placeholder="#fb7185"
                        />
                        <div className="w-8 h-8 rounded-lg border border-slate-200" style={{ backgroundColor: catFormColor }}></div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">排序权重</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={catFormSort}
                        onChange={(e) => setCatFormSort(Number(e.target.value))}
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
                      style={{ backgroundColor: styleContext.primary }}
                    >
                      {editingCategory ? '保存修改' : '创建分类'}
                    </button>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}

        {/* --- View: Daily Analytics Visuals (每日记录 - NO TEXT SUMMARY as demanded exactly) --- */}
        {activeTab === 'daily' && (
          <div className="space-y-6" id="daily_view">
            
            <header className="bg-white rounded-2xl border border-slate-200/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]" id="daily_header">
              <div>
                <span className="px-3 py-1 text-[10px] font-bold rounded-full w-fit" style={{ color: styleContext.primary, backgroundColor: styleContext.primaryLight }}>
                  Daily Analytics
                </span>
                <h2 className="text-xl font-extrabold text-slate-800 mt-2">当日执行状况面板</h2>
                <p className="text-xs text-slate-500 font-medium mt-1">自动核算行动完结状态与专注分钟，以纯数据可视化呈现时间运用图景。</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dailyReportDate}
                  onChange={(e) => setDailyReportDate(e.target.value)}
                  className="bg-white border border-slate-200 px-3 py-2 text-xs rounded-xl font-mono font-bold outline-none cursor-pointer hover:border-slate-300 transition-colors"
                />

                <button
                  onClick={loadDailyStats}
                  className="bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer hover:bg-slate-800 active:scale-[0.98]"
                >
                  评估指标
                </button>
              </div>
            </header>

            {/* Redesigned grid dashboard block featuring charts according strictly: "所有报告页面不显示文字总结，纯数据可视化展示" */}
            {!dailyStatsLoaded ? (
              <div className="bg-white border border-slate-200/60 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: styleContext.primary }} />
                <p className="text-xs text-slate-400 font-semibold">正在计算当日指标...</p>
              </div>
            ) : dailyTasks.length === 0 && dailySessions.length === 0 ? (
              <div className="bg-white border border-slate-200/60 rounded-2xl p-16 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: styleContext.primaryLight }}>
                  <ClipboardList className="w-8 h-8 stroke-[1.5]" style={{ color: styleContext.primary }} />
                </div>
                <p className="text-sm font-bold text-slate-600">当天暂无数据记录</p>
                <p className="text-xs text-slate-400 mt-1.5">切换日期查看其他天的统计看板</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Metric 1: Completion Rate Pie Chart */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                  <div className="pb-3 border-b border-slate-100 border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Completion Rate</span>
                    <h3 className="font-bold text-xs text-slate-700 mt-1">行动达成度</h3>
                  </div>

                  <div className="h-[180px] flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: '已完成 (Done)', value: doneDailyTasksCount, color: '#34d399' },
                            { name: '执行中 & 待办', value: (todoDailyTasksCount + inProgressDailyTasksCount), color: styleContext.primary },
                            { name: '延滞搁置', value: notDoneDailyTasksCount, color: '#fca5a5' }
                          ].filter(v => v.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {[
                            { name: '已完成 (Done)', value: doneDailyTasksCount, color: '#34d399' },
                            { name: '执行中 & 待办', value: (todoDailyTasksCount + inProgressDailyTasksCount), color: styleContext.primary },
                            { name: '延滞搁置', value: notDoneDailyTasksCount, color: '#fca5a5' }
                          ].filter(v => v.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Centered big rating font percentage as requested */}
                    <div className="absolute inset-0 m-auto flex flex-col items-center justify-center w-fit h-fit select-none pointer-events-none">
                      <span className="text-2xl font-black font-sans leading-none text-slate-800">
                        {dailyTasks.length > 0 
                          ? `${Math.round((doneDailyTasksCount / dailyTasks.length) * 100)}%` 
                          : '0%'}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                        完成率
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs mt-3 select-none">
                    <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-100">
                      <p className="text-[9px] text-emerald-600 font-semibold">已完结</p>
                      <p className="font-bold font-mono text-emerald-600 mt-0.5">{doneDailyTasksCount}</p>
                    </div>
                    <div className="bg-rose-50 rounded-xl p-2.5 border border-rose-100">
                      <p className="text-[9px] text-rose-500 font-semibold">待推进</p>
                      <p className="font-bold font-mono text-rose-500 mt-0.5">{todoDailyTasksCount + inProgressDailyTasksCount}</p>
                    </div>
                    <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-100">
                      <p className="text-[9px] text-stone-500 font-semibold">搁置项</p>
                      <p className="font-bold font-mono text-stone-500 mt-0.5">{notDoneDailyTasksCount}</p>
                    </div>
                  </div>
                </div>

                {/* Metric 2: Total Focus Time */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                  <div className="pb-3 border-b border-slate-100 border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Focus Time</span>
                    <h3 className="font-bold text-xs text-slate-700 mt-1">当日专注总量</h3>
                  </div>

                  <div className="py-6 text-center space-y-3 flex-1 flex flex-col justify-center">
                    <div className="inline-block p-4 rounded-2xl w-fit mx-auto" style={{ backgroundColor: styleContext.primaryLight }}>
                      <Award className="w-8 h-8" style={{ color: styleContext.primary }} />
                    </div>
                    <div>
                      <h4 className="text-3xl font-black font-sans text-slate-800 tracking-tight">
                        {dailyTotalMins} <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">分钟</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 font-semibold">
                        约 <span className="font-mono text-slate-600">{(dailyTotalMins / 60).toFixed(1)}h</span>
                      </p>
                    </div>
                  </div>

                  {/* Yesterday Comparison */}
                  <div className="bg-slate-50/80 border border-slate-200/40 p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest">相比昨日</p>
                      <p className="text-[11px] text-slate-500 font-medium">昨日专注: <strong className="font-mono text-slate-700">{prevDailyTotalMins} 分钟</strong></p>
                    </div>
                    <div className="flex items-center gap-1 select-none">
                      {dailyFocusDeltaPercent >= 0 ? (
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2.5 py-1 inline-flex items-center gap-0.5 rounded-full font-bold">
                          <TrendingUp className="w-3 h-3 stroke-3" />
                          +{dailyFocusDeltaPercent}%
                        </span>
                      ) : (
                        <span className="bg-rose-100 text-rose-700 text-[10px] px-2.5 py-1 inline-flex items-center gap-0.5 rounded-full font-bold">
                          <TrendingDown className="w-3 h-3 stroke-3" />
                          {dailyFocusDeltaPercent}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metric 3: Category Bar Chart */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                  <div className="pb-3 border-b border-slate-100 border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Category Distribution</span>
                    <h3 className="font-bold text-xs text-slate-700 mt-1">分类时长分布</h3>
                  </div>

                  <div className="h-[210px] w-full mt-2">
                    {dailyCategoryDistributionData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={dailyCategoryDistributionData}
                          layout="vertical"
                          margin={{ top: 10, right: 10, left: -22, bottom: 5 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            stroke="#57534e" 
                            fontSize={10} 
                            fontWeight="bold"
                            tickLine={false}
                            axisLine={false}
                            width={75}
                          />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                  <div className="bg-slate-900 text-white text-[10px] px-2.5 py-1.5 rounded shadow font-extrabold">
                                    <span>{d.name}: {d.minutes} 分钟</span>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="minutes" radius={[0, 4, 4, 0]} barSize={12}>
                            {dailyCategoryDistributionData.map((e, index) => (
                              <Cell key={`cell-${index}`} fill={e.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-center p-3">
                        <p className="text-stone-400 text-xs font-bold">今日尚且没有有效完结的心流计时段来提供分类分布数据</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* --- View: Weekly Review Visuals (周复盘 - NO TEXT SUM) --- */}
        {activeTab === 'weekly' && (
          <div className="space-y-6" id="weekly_view">
            
            <header className="bg-white rounded-2xl border border-slate-200/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]" id="weekly_header">
              <div>
                <span className="px-3 py-1 text-[10px] font-bold rounded-full w-fit" style={{ color: styleContext.primary, backgroundColor: styleContext.primaryLight }}>
                  Weekly Performance
                </span>
                <h2 className="text-xl font-extrabold text-slate-800 mt-2">周度效率复盘看板</h2>
                <p className="text-xs text-slate-500 font-medium mt-1">计算单周范围内每日折线递增、达成分布占比，盘整效率质量。</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 text-xs rounded-xl">
                  <span className="text-[10px] text-slate-400 font-semibold">起始:</span>
                  <input
                    type="date"
                    value={weeklyStartDate}
                    onChange={(e) => setWeeklyStartDate(e.target.value)}
                    className="cursor-pointer font-bold outline-none font-mono"
                  />
                </div>

                <button
                  onClick={loadWeeklyStats}
                  className="bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all hover:bg-slate-800 active:scale-[0.98]"
                >
                  计算能效
                </button>
              </div>
            </header>

            {!weeklyStatsLoaded ? (
              <div className="bg-white border border-slate-200/60 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: styleContext.primary }} />
                <p className="text-xs text-slate-400 font-semibold">正在计算本周数据...</p>
              </div>
            ) : weeklyTotalTasks === 0 && weeklyTotalMins === 0 ? (
              <div className="bg-white border border-slate-200/60 p-16 rounded-2xl text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: styleContext.primaryLight }}>
                  <CalendarRange className="w-8 h-8 stroke-[1.5]" style={{ color: styleContext.primary }} />
                </div>
                <p className="text-sm font-bold text-slate-600">本周暂无数据记录</p>
                <p className="text-xs text-slate-400 mt-1.5">尝试调整起始日期到本周一</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Visual Section Bento Row 1: Left Completion Rate Progression Chart, Right Pie Task Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Card Chart 1: 7 days Done completion dynamic rate Line Chart as demanded strictly */}
                  <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                    <div className="pb-3 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metrics: Rate Trendline</span>
                      <h3 className="font-bold text-xs text-slate-700 mt-1">7日达成率走势</h3>
                    </div>

                    <div className="h-[220px] w-full mt-4 select-none">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={weeklyTimelineRateData}
                          margin={{ top: 10, right: 20, left: -20, bottom: 5 }}
                        >
                          <XAxis dataKey="weekday" stroke="#57534e" fontSize={10} fontWeight="bold" />
                          <YAxis stroke="#57534e" fontSize={10} domain={[0, 100]} />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-slate-900 text-white text-[10px] p-2 rounded shadow font-bold">
                                    <p className="font-mono">{selectedDate.slice(0,4)}-{data.day} ({data.weekday})</p>
                                    <p className="mt-1 text-rose-300">计划完成率: {data.rate}%</p>
                                    <p className="text-slate-300 text-[9px]">行动明细: {data.completed} / {data.total}项</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="rate" 
                            stroke={styleContext.primary} 
                            strokeWidth={3} 
                            activeDot={{ r: 6 }} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Card Chart 2: Category Complete Task Distribution Pie Chart */}
                  <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                    <div className="pb-3 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metrics: Category Share</span>
                      <h3 className="font-bold text-xs text-slate-700 mt-1">分类完成占比</h3>
                    </div>

                    <div className="h-[180px] flex items-center justify-center">
                      {weeklyCategoryDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={weeklyCategoryDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={65}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {weeklyCategoryDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={25} iconSize={8} fontSize={9} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-slate-400 text-xs font-bold text-center">本周暂且无对应已完结标签数据</p>
                      )}
                    </div>
                  </div>

                </div>

                {/* Visual Section Bento Row 2: Left 7 Days Heatmap Track with longest streak metrics, Right General metrics cards list */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Heatmap Continuous complete tracker */}
                  <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between md:col-span-2">
                    <div className="pb-3 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metrics: Heatmap</span>
                      <h3 className="font-bold text-xs text-slate-700 mt-1">每日达标轨迹</h3>
                    </div>

                    {/* Streak blocks tracker row of 7 days */}
                    <div className="grid grid-cols-7 gap-3 py-6 select-none">
                      {weeklyDaysData.map((d, index) => {
                        const dateObj = new Date(d.day);
                        const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                        const dayLabel = weekdayLabels[dateObj.getDay()];
                        
                        const achieved = d.tasks.length > 0 && d.tasks.filter(t => t.status === 'DONE').length >= Math.ceil(d.tasks.length / 2);
                        const activeHours = d.sessions.filter(s => s.status === 'COMPLETED').reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
                        const mins = Math.round(activeHours / 60);

                        return (
                          <div 
                            key={d.day} 
                            className={`p-3 rounded-lg border text-center transition-all ${
                              achieved 
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}
                          >
                            <span className="text-[9px] font-black tracking-widest block opacity-70 uppercase">{dayLabel}</span>
                            <span className="text-[11px] font-mono font-black mt-1 block">{d.day.slice(5)}</span>
                            
                            <div className={`mt-3 mx-auto w-3.5 h-3.5 rounded-full flex items-center justify-center ${achieved ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300 bg-stone-300'}`}>
                            </div>
                            
                            <span className="text-[9px] font-bold block mt-1.5 opacity-80">{mins}m</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-3 rounded-xl border flex items-center justify-between" style={{ backgroundColor: styleContext.primaryLight, borderColor: styleContext.secondary + '50' }}>
                      <span className="text-xs font-semibold text-slate-600">🏆 最长连续达标</span>
                      <span className="text-sm font-bold tracking-tight px-3 py-1 rounded-lg bg-white shadow-sm" style={{ color: styleContext.primary }}>
                        {maxStreak} 日
                      </span>
                    </div>
                  </div>

                  {/* Quantitative counter stats list card */}
                  <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                    <div className="pb-3 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metrics: Summary</span>
                      <h3 className="font-bold text-xs text-slate-700 mt-1">本周核心指标</h3>
                    </div>

                    <div className="divide-y divide-slate-100 flex-grow py-3">

                      <div className="py-3 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">派遣总数</span>
                        <strong className="font-bold font-mono text-slate-700">{weeklyTotalTasks} 项</strong>
                      </div>

                      <div className="py-3 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">完成总数</span>
                        <strong className="font-bold font-mono text-emerald-600">{weeklyDoneTasks} 项</strong>
                      </div>

                      <div className="py-3 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">搁置数</span>
                        <strong className="font-bold font-mono text-rose-500">{weeklyOverdueTasks} 项</strong>
                      </div>

                      <div className="py-3 flex items-center justify-between text-xs">
                        <span className="font-semibold text-indigo-600">专注总量</span>
                        <strong className="font-bold font-mono text-indigo-600">{weeklyTotalMins} 分钟</strong>
                      </div>

                    </div>

                  </div>

                </div>

              </div>
            )}
          </div>
        )}

        {/* --- View: Immersive Focus Timer (专注计时页) --- */}
        {activeTab === 'focus' && runningSession && (
          <div className="min-h-[550px] max-w-lg mx-auto flex flex-col items-center justify-center space-y-10 py-10 fade-in-up" id="focus_stopwatch_view">

            <div className="text-center space-y-3">
              <span className="px-4 py-1.5 text-[11px] font-bold rounded-full uppercase tracking-widest inline-block animate-pulse" style={{ color: styleContext.primary, backgroundColor: styleContext.primaryLight, border: `2px solid ${styleContext.secondary}` }}>
                🔥 专注中
              </span>

              <h2 className="text-lg font-bold text-slate-700 tracking-tight mt-3">
                正在专注
              </h2>
              <p className="text-sm font-bold px-6 py-3 rounded-2xl max-w-md mx-auto truncate mt-2 border" style={{ color: styleContext.primary, backgroundColor: styleContext.primaryLight, borderColor: styleContext.secondary + '60' }}>
                🎯 {runningSession.taskTitle || '正在高速运行心流'}
              </p>
            </div>

            {/* Circular progress ring — 240px */}
            <div className="relative w-[240px] h-[240px] flex items-center justify-center rounded-full" style={{ boxShadow: `0 0 60px ${styleContext.primary}15, 0 4px 20px rgba(0,0,0,0.04)` }}>

              {/* Outer glow ring */}
              <div className="absolute inset-[-8px] rounded-full border-2 border-dashed breathing-ring pointer-events-none" style={{ borderColor: styleContext.secondary + '40' }}></div>

              {/* Inner white background circle */}
              <div className="absolute inset-0 rounded-full bg-white border border-slate-100 shadow-inner"></div>

              {/* SVG progress ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="120"
                  cy="120"
                  r="104"
                  stroke={styleContext.primaryLight}
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="120"
                  cy="120"
                  r="104"
                  stroke={styleContext.primary}
                  strokeWidth="10"
                  fill="transparent"
                  strokeDasharray={653}
                  strokeDashoffset={653 - (653 * Math.min(1.0, (focusTimeElapsed % 3600) / 3600))}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                  style={{ filter: `drop-shadow(0 0 6px ${styleContext.primary}40)` }}
                />
              </svg>

              {/* Timer digits */}
              <div className="text-center space-y-1 z-10 select-all">
                <h1 className="text-4xl font-bold font-mono text-slate-800 tracking-tight tabular-nums">
                  {String(Math.floor(focusTimeElapsed / 3600)).padStart(2, '0')}:
                  {String(Math.floor((focusTimeElapsed % 3600) / 60)).padStart(2, '0')}:
                  {String(focusTimeElapsed % 60).padStart(2, '0')}
                </h1>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block">
                  已专注
                </p>
              </div>

            </div>

            {/* Stop button */}
            <div className="w-full flex flex-col items-center gap-4">
              <button
                onClick={handleStopSession}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs py-4 rounded-2xl transition-all border-2 flex items-center justify-center gap-2.5 shadow-sm hover:shadow-md cursor-pointer active:scale-[0.99]"
                style={{ borderColor: styleContext.primary }}
              >
                <Square className="w-3.5 h-3.5 fill-current" style={{ color: styleContext.primary }} />
                <span>停止并记录专注时长</span>
              </button>

              <p className="text-xs text-slate-400 font-semibold tracking-wide">
                深呼吸，保持节奏
              </p>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
