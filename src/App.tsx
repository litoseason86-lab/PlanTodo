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
import { api, Category, Task, TaskExecutionSession, TaskStatus } from './api';
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

// Curated soft theme colors for theme selector
const THEME_STYLES = {
  peach: {
    id: 'peach' as const,
    name: '桃色暖光',
    primary: '#fb7185',
    secondary: '#fda4af',
    bg: '#fff5f5',
    light: '#fff1f2',
    accentText: 'text-rose-600',
    border: 'border-rose-200',
    primaryBg: 'bg-rose-500',
    primaryHoverBg: 'hover:bg-rose-600',
    primaryLight: '#fff1f2',
  },
  beige: {
    id: 'beige' as const,
    name: '经典优雅米',
    primary: '#d4a574',
    secondary: '#e7c29f',
    bg: '#fafaf9',
    light: '#fdfaf6',
    accentText: 'text-[#a0744a]',
    border: 'border-amber-200/60',
    primaryBg: 'bg-[#d4a574]',
    primaryHoverBg: 'hover:bg-[#c29260]',
    primaryLight: '#fdfaf6',
  }
};

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
  const [activeTab, setActiveTab] = useState<'today' | 'tasks' | 'categories' | 'daily' | 'weekly' | 'focus'>('today');
  const [activeTheme, setActiveTheme] = useState<'peach' | 'beige'>('peach');
  
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
      const catsData = await api.getCategories();
      setCategories(catsData);
      
      const tasksData = await api.getTasks({ date: selectedDate });
      setTasks(tasksData);

      const all = await api.getTasks();
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
      const data = await api.getTasks({ date: selectedDate });
      setTasks(data);
      const sessionData = await api.getSessions({ date: selectedDate });
      setSelectedDateSessions(sessionData);
    } catch (err) {
      console.error('Failed to sync date tasks', err);
    }
  };

  const checkRunningSession = async () => {
    try {
      const res = await api.getRunningSession();
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
        await api.updateCategory(editingCategory.id, {
          name: catFormName,
          color: catFormColor,
          sortOrder: catFormSort
        });
        showToast('分类更新完成');
      } else {
        await api.createCategory({
          name: catFormName,
          color: catFormColor,
          sortOrder: catFormSort
        });
        showToast('新分类创建成功');
      }
      setIsCategoryModalOpen(false);
      const list = await api.getCategories();
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
      await api.deleteCategory(id);
      showToast('分类已顺利移除');
      const list = await api.getCategories();
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
      await api.createTask({
        title: taskFormTitle,
        categoryId: catId,
        plannedDate: taskFormDate
      });
      showToast('任务已成功下派！');
      setTaskFormTitle('');
      
      const all = await api.getTasks();
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
      await api.updateTaskStatus(id, status);
      showToast('进展转换完美同步');
      loadTasksForSelectedDate();
      
      // Update local allTasks buffer
      const all = await api.getTasks();
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
      const session = await api.startSession(task.id);
      setRunningSession(session);
      setActiveTab('focus');
      showToast(`✨ 进入「${task.title}」深度聚焦空间`);
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
      const stopped = await api.stopSession(runningSession.id);
      
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
      loadTasksForSelectedDate();
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
      const tList = await api.getTasks({ date: dailyReportDate });
      setDailyTasks(tList);

      const sList = await api.getSessions({ date: dailyReportDate });
      setDailySessions(sList);

      // Fetch yesterday comparison
      const yesterday = new Date(dailyReportDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      const sPrevList = await api.getSessions({ date: yesterdayStr });
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
        const tList = await api.getTasks({ date: day });
        const sList = await api.getSessions({ date: day });
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
          50% { transform: scale(1.18); opacity: 0.3; }
        }
        .breathing-ring {
          animation: pulse-ring 3s infinite ease-in-out;
        }
        @keyframes line-breathe {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; filter: drop-shadow(0 0 4px var(--color-primary)); }
        }
        .card-timeline-node {
          box-shadow: 0 0 0 4px #ffffff, 0 0 0 6px var(--color-primary);
        }
      `}</style>

      {/* Global Alerts Floating Layer */}
      {successMsg && (
        <div className="fixed top-6 right-6 bg-emerald-550 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-2.5 z-50 transition-all text-xs font-bold animate-in fade-in slide-in-from-top-4" id="success_toast">
          <div className="w-2 h-2 bg-emerald-200 rounded-full animate-ping"></div>
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="fixed top-6 right-6 bg-rose-50 border border-rose-200 text-rose-700 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-2.5 z-50 transition-all text-xs font-bold animate-in fade-in slide-in-from-top-4" id="error_toast">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Active Session Floater widget */}
      {runningSession && activeTab !== 'focus' && (
        <div 
          onClick={() => setActiveTab('focus')}
          className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-4 rounded-3xl shadow-2xl flex items-center gap-4 cursor-pointer z-40 hover:scale-105 transition-all duration-300 animate-bounce"
          id="global_running_bar"
        >
          <div className="relative">
            <Timer className="w-5 h-5 text-rose-300 animate-spin" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full inline-block"></span>
          </div>
          <div className="text-left text-xs">
            <p className="font-bold text-[8.5px] uppercase tracking-wider text-rose-300/80">心流引擎已加载</p>
            <p className="text-[12px] font-bold truncate max-w-44 text-white">{runningSession.taskTitle || '主线专注中'}</p>
          </div>
          <span className="bg-white/10 text-rose-300 font-mono text-xs font-bold px-3 py-1 rounded-xl">
            {Math.floor(focusTimeElapsed / 60)}m {focusTimeElapsed % 60}s
          </span>
        </div>
      )}

      {/* Header Brand Section */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-rose-100/50 shadow-sm transition-all">
        <div className="max-w-[1280px] mx-auto px-6 py-4 flex items-center justify-between">
          
          <div className="flex items-center gap-2.5 select-none hover:opacity-90 transition">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-md`} style={{ backgroundColor: styleContext.primary }}>
              🍑
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-slate-800 uppercase leading-none">
                {activeTheme === 'peach' ? 'COZY MOMENT' : 'SIMPLE LIFE'}
              </h1>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">
                时间专注沉淀手记
              </p>
            </div>
          </div>

          {/* Horizontal Navigation Tabs */}
          <nav className="flex items-center gap-1.5" id="horizontal_navigation_menu">
            <button
              onClick={() => { setActiveTab('today'); setErrorMsg(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'today' 
                  ? `${styleContext.primaryBg} text-white shadow` 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>今日执行</span>
            </button>

            <button
              onClick={() => { setActiveTab('tasks'); setErrorMsg(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'tasks'
                  ? `${styleContext.primaryBg} text-white shadow` 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span>任务库</span>
            </button>

            <button
              onClick={() => { setActiveTab('categories'); setErrorMsg(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'categories'
                  ? `${styleContext.primaryBg} text-white shadow` 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Tags className="w-3.5 h-3.5" />
              <span>分类管理</span>
            </button>

            <button
              onClick={() => { setActiveTab('daily'); setErrorMsg(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'daily'
                  ? `${styleContext.primaryBg} text-white shadow` 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>每日记录</span>
            </button>

            <button
              onClick={() => { setActiveTab('weekly'); setErrorMsg(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'weekly'
                  ? `${styleContext.primaryBg} text-white shadow` 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>周复盘</span>
            </button>

            {runningSession && (
              <button
                onClick={() => { setActiveTab('focus'); setErrorMsg(null); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'focus'
                    ? 'bg-rose-500 text-white shadow-lg animate-pulse' 
                    : 'bg-rose-50 text-rose-600'
                }`}
              >
                <Timer className="w-3.5 h-3.5 animate-spin" />
                <span>专注中</span>
              </button>
            )}
          </nav>

          {/* Dual Theme Toggle switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTheme('peach')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeTheme === 'peach'
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🍑 {THEME_STYLES.peach.name}
            </button>
            <button
              onClick={() => setActiveTheme('beige')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeTheme === 'beige'
                  ? 'bg-white text-stone-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
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
            <header className="bg-white rounded-[16px] border border-slate-150 p-6 flex items-center justify-between gap-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)]" id="today_header">
              <div className="space-y-2">
                <span className="px-2.5 py-1 bg-rose-550 text-white text-[10px] font-bold rounded-full uppercase tracking-wider inline-block bg-[var(--color-primary)]">
                  Primary Flow Focus
                </span>
                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  今日规划时空轴
                </h2>
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" style={{ color: styleContext.primary }} />
                  <span className="font-semibold text-slate-600">聚焦选期:</span>
                  <input 
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 outline-none hover:border-slate-400 px-3 py-1 font-mono rounded-lg text-xs text-slate-700 font-bold"
                  />
                </div>
              </div>

              {/* Mini Today Category Stats Recharts Chart */}
              <div className="w-[320px] h-[100px] bg-slate-50 border border-slate-200/50 rounded-xl p-3 flex flex-col justify-between" id="today_header_chart">
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 tracking-wider">
                  <span>累计专注板块 (分钟)</span>
                  {todayCategoryFocusData.length > 0 && (
                    <span className="text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full font-mono">
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
              <div className="flex gap-4">
                <div className="bg-slate-100 hover:bg-slate-200 transition-colors rounded-xl px-4 py-2.5 text-center min-w-[70px]">
                  <p className="text-[10px] text-slate-400 font-bold">待完成</p>
                  <p className="text-base font-extrabold text-slate-800">
                    {tasks.filter(t => t.status === 'TODO' || t.status === 'IN_PROGRESS').length} 项
                  </p>
                </div>
                <div className="bg-emerald-50 rounded-xl px-4 py-2.5 text-center min-w-[70px]">
                  <p className="text-[10px] text-emerald-600 font-bold">已完结</p>
                  <p className="text-base font-extrabold text-emerald-600">
                    {tasks.filter(t => t.status === 'DONE').length} 项
                  </p>
                </div>
              </div>

            </header>

            {/* Wrapup alert after stopwatch session stops */}
            {lastFinishedSessionTask && (
              <div className="bg-white border-2 border-dashed border-rose-300 rounded-[16px] p-5 flex items-center justify-between gap-4 shadow-sm animate-in fade-in zoom-in-95" id="feedback_panel">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 font-bold">
                    💡
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-800">完成了刚才的心流阶？要顺手标记归档吗？</h4>
                    <p className="text-[11px] text-slate-500 mt-1">主线聚焦规划: <strong className="text-rose-600">「{lastFinishedSessionTask.title}」</strong></p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleUpdateTaskStatus(lastFinishedSessionTask.id, 'DONE');
                      setLastFinishedSessionTask(null);
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold px-3.5 py-2 rounded-lg shadow-sm transition"
                  >
                    ✓ 完美标记已完结
                  </button>
                  <button
                    onClick={() => setLastFinishedSessionTask(null)}
                    className="text-slate-400 hover:bg-slate-100 text-[11px] font-bold px-3.5 py-2 rounded-lg transition"
                  >
                    保留在今天清单
                  </button>
                </div>
              </div>
            )}

            {/* Flat rapid quick dispatch bar */}
            <div className="bg-white border border-slate-150 rounded-[12px] p-4 flex items-center gap-4 shadow-xs">
              <input 
                type="text"
                placeholder="💡 行动快马加鞭，在此规划今日的关键专注标的..."
                value={taskFormTitle}
                onChange={(e) => setTaskFormTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateTask();
                }}
                className="flex-1 text-xs border border-slate-150 bg-slate-50/70 p-2.5 rounded-lg outline-none focus:border-rose-300 bg-white font-bold transition-all text-slate-850"
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400">项目分类</span>
                <select 
                  value={taskFormCategory}
                  onChange={(e) => setTaskFormCategory(Number(e.target.value))}
                  className="px-3 py-2 text-xs border border-slate-150 bg-white rounded-lg text-slate-700 font-bold outline-none cursor-pointer hover:bg-slate-50"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                  {categories.length === 0 && <option value="">暂无分类</option>}
                </select>

                <button
                  onClick={() => handleCreateTask()}
                  className={`text-white font-bold text-xs px-4 py-2.5 rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer`}
                  style={{ backgroundColor: styleContext.primary }}
                >
                  <Plus className="w-3.5 h-3.5" /> 快速派遣人次
                </button>
              </div>
            </div>

            {/* Timeline Layout */}
            <div className="bg-white border border-slate-150 rounded-[16px] p-8 shadow-sm">
              <h3 className="font-extrabold text-sm/none text-slate-700 mb-8 border-l-4 pl-3.5" style={{ borderColor: styleContext.primary }}>
                Today's Core Progression 行动轨迹轴
              </h3>

              {tasks.length > 0 ? (
                <div className="relative pl-6 border-l-2 ml-4 space-y-8" style={{ borderColor: styleContext.primary }}>
                  
                  {tasks.map(task => {
                    const cat = categories.find(c => c.id === task.categoryId);
                    const focusMins = getTaskFocusMinutes(task.id);
                    
                    // node color states
                    let nodeDotClass = "bg-white border-2 border-slate-350";
                    let nodeInnerDotColor = "transparent";
                    
                    if (task.status === 'IN_PROGRESS') {
                      nodeDotClass = "bg-white animate-pulse shadow-md cursor-pointer ring-4 ring-rose-100";
                      nodeInnerDotColor = styleContext.primary;
                    } else if (task.status === 'DONE') {
                      nodeDotClass = "bg-emerald-100 border-2 border-emerald-400";
                      nodeInnerDotColor = "#86efac";
                    } else if (task.status === 'NOT_DONE') {
                      nodeDotClass = "bg-rose-50 border-2 border-rose-300";
                      nodeInnerDotColor = "#fca5a5";
                    }

                    return (
                      <div key={task.id} className="relative group/card">
                        
                        {/* Timeline Circle Bullet Node Element */}
                        <div 
                          className={`absolute -left-[32px] top-4 w-4.5 h-4.5 rounded-full flex items-center justify-center transition-all ${nodeDotClass}`}
                          style={{ borderColor: task.status === 'IN_PROGRESS' ? styleContext.primary : undefined }}
                        >
                          <div 
                            className={`w-2 h-2 rounded-full`} 
                            style={{ backgroundColor: nodeInnerDotColor }}
                          />
                        </div>

                        {/* Interactive Task Card Box container */}
                        <div 
                          className={`bg-white border-2 p-5 rounded-[12px] shadow-xs cursor-pointer select-none transition-all duration-200 ${
                            task.status === 'IN_PROGRESS' 
                              ? 'border-rose-400 shadow bg-rose-50/20' 
                              : 'border-slate-150 hover:bg-[var(--color-light)] hover:border-[var(--color-primary)] hover:border-2'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <h4 className={`text-sm tracking-tight font-extrabold ${task.status === 'DONE' ? 'text-slate-400 line-through font-medium' : 'text-slate-800'}`}>
                                {task.title}
                              </h4>
                              
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] font-bold text-slate-450 text-slate-400 flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/40">
                                  🏷️ {cat ? cat.name : '未分类板块'}
                                </span>

                                {(task.status === 'IN_PROGRESS' || task.status === 'DONE' || focusMins > 0) && (
                                  <span className="text-[11px] font-bold text-indigo-500 font-mono animate-pulse">
                                    ⏱️ 累积记录时长: {focusMins} 分钟
                                  </span>
                                )}

                                {task.status === 'NOT_DONE' && (
                                  <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                                    搁置
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Active control panel revealed on card / hover operations */}
                            <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover/card:opacity-100 transition-all duration-300">
                              
                              {task.status !== 'IN_PROGRESS' && task.status !== 'DONE' && (
                                <button
                                  onClick={() => handleStartSession(task)}
                                  className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition cursor-pointer"
                                  title="立即进入番茄心流状态"
                                >
                                  ▶️ 开启
                                </button>
                              )}

                              {task.status === 'IN_PROGRESS' && (
                                <button
                                  onClick={handleStopSession}
                                  className="px-2.5 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-[10px] font-extrabold transition cursor-pointer flex items-center gap-1"
                                >
                                  <Square className="w-2.5 h-2.5 text-rose-400 fill-current" />
                                  暂停专注
                                </button>
                              )}

                              {task.status !== 'DONE' && (
                                <button
                                  onClick={() => handleUpdateTaskStatus(task.id, 'DONE')}
                                  className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition cursor-pointer"
                                  title="顺利标记完成"
                                >
                                  ✓ 已完结
                                </button>
                              )}

                              {task.status !== 'NOT_DONE' && task.status !== 'DONE' && (
                                <button
                                  onClick={() => handleUpdateTaskStatus(task.id, 'NOT_DONE')}
                                  className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition cursor-pointer"
                                  title="暂时由于事务庞杂转拨入搁置排期"
                                >
                                  ✗ 未完
                                </button>
                              )}

                              {task.status === 'DONE' && (
                                <button
                                  onClick={() => handleUpdateTaskStatus(task.id, 'TODO')}
                                  className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-505 text-[10px] font-bold rounded-lg transition"
                                >
                                  更正待办
                                </button>
                              )}
                              {task.status === 'NOT_DONE' && (
                                <button
                                  onClick={() => handleUpdateTaskStatus(task.id, 'TODO')}
                                  className="p-1 px-2.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-bold rounded-lg transition"
                                >
                                  重启
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
                <div className="p-12 text-center text-slate-400">
                  <ClipboardList className="w-12 h-12 mx-auto stroke-1" style={{ color: styleContext.primary }} />
                  <p className="text-xs font-black uppercase tracking-wider mt-4">今日暂且是一块待开垦的长卷白幅</p>
                  <p className="text-[11px] text-slate-450 mt-1">您可在上方输入框中敲入核心指令派遣行动计划！</p>
                </div>
              )}

            </div>
          </div>
        )}

        {/* --- View: Pipeline Tasks Storage (任务库) --- */}
        {activeTab === 'tasks' && (
          <div className="space-y-6" id="tasks_view">
            
            <header className="bg-white rounded-[16px] border border-slate-150 p-6 flex flex-col gap-2 shadow-[0_4px_20px_rgba(0,0,0,0.02)]" id="tasks_header">
              <span className="px-3 py-1 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-full w-fit">
                Global Task Reserves
              </span>
              <h2 className="text-xl font-extrabold text-slate-800 mt-1">全局储备与规划中心</h2>
              <p className="text-xs text-slate-500 font-medium">配置、调度未来日期及历届滞存指令集的核心仓库，支持各种多级交叉状态过滤。</p>
            </header>

            {/* Split controls block: Left Add Form, Right Filter Results List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="bg-white border border-slate-200 p-6 rounded-[16px] space-y-4 h-fit shadow-xs">
                <h3 className="font-extrabold text-xs text-slate-850 uppercase tracking-wider flex items-center gap-2 border-b border-stone-105 pb-3 pb-2.5">
                  <Plus className="w-4 h-4 text-rose-500" />
                  新建储备规划项
                </h3>
                
                <form onSubmit={(e) => { e.preventDefault(); handleCreateTask(); }} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 select-none uppercase pl-1">行动主题与描述</label>
                    <input 
                      type="text"
                      placeholder="e.g. 审定核心业务数据，优化排期方案"
                      value={taskFormTitle}
                      onChange={(e) => setTaskFormTitle(e.target.value)}
                      className="w-full text-xs border border-slate-200 bg-slate-50 p-2.5 rounded-lg focus:bg-white outline-none focus:border-rose-300 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 select-none uppercase pl-1">归属板块分类标签</label>
                    <select 
                      value={taskFormCategory}
                      onChange={(e) => setTaskFormCategory(Number(e.target.value))}
                      className="w-full text-xs border border-slate-200 bg-white p-2.5 rounded-lg outline-none cursor-pointer hover:bg-slate-50 font-bold"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                      {categories.length === 0 && <option value="">暂无分类</option>}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 select-none uppercase pl-1">选定排期执行日期</label>
                    <input 
                      type="date"
                      value={taskFormDate}
                      onChange={(e) => setTaskFormDate(e.target.value)}
                      className="w-full text-xs border border-slate-200 bg-white p-2.5 rounded-lg outline-none cursor-pointer font-bold hover:bg-slate-50"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full text-white text-xs font-bold py-3 rounded-lg shadow-sm font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    style={{ backgroundColor: styleContext.primary }}
                  >
                    确认将此行动归档入库
                  </button>
                </form>
              </div>

              {/* Multi-Filters columns and detailed items list */}
              <div className="lg:col-span-2 space-y-4">
                
                <div className="bg-slate-100 border border-slate-200 p-4 rounded-[12px] flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">分类板块</p>
                      <select 
                        value={taskFilterCategory} 
                        onChange={(e) => setTaskFilterCategory(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg text-slate-700 font-bold"
                      >
                        <option value="all">查看全部主题</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">执行进展</p>
                      <select 
                        value={taskFilterStatus} 
                        onChange={(e) => setTaskFilterStatus(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg text-slate-700 font-bold"
                      >
                        <option value="all">所有状态指令</option>
                        <option value="TODO">待执行</option>
                        <option value="IN_PROGRESS">进行中</option>
                        <option value="DONE">已完结</option>
                        <option value="NOT_DONE">拖延/搁置</option>
                      </select>
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">日期区间范围</p>
                      <select 
                        value={taskFilterDateScope} 
                        onChange={(e) => setTaskFilterDateScope(e.target.value as any)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg text-slate-700 font-bold"
                      >
                        <option value="today">今日单日项目</option>
                        <option value="seven-days">未来核心期 (7天)</option>
                        <option value="all">全局指令库总集</option>
                      </select>
                    </div>

                  </div>

                  <span className="text-[10px] font-bold text-slate-400 font-mono bg-white px-2.5 py-1.5 rounded-lg border">
                    匹配: {allTasks.length} 项记录
                  </span>
                </div>

                {/* Listing of matched tasks pipeline (simplified matching list as specified) */}
                <div className="bg-white border border-slate-200 rounded-[12px] overflow-hidden">
                  <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                    {allTasks.filter(t => {
                      if (taskFilterCategory !== 'all' && t.categoryId !== Number(taskFilterCategory)) return false;
                      if (taskFilterStatus !== 'all' && t.status !== taskFilterStatus) return false;
                      
                      if (taskFilterDateScope === 'today') {
                        if (t.plannedDate !== selectedDate) return false;
                      } else if (taskFilterDateScope === 'seven-days') {
                        const planned = new Date(t.plannedDate).getTime();
                        const todayMs = new Date(selectedDate).getTime();
                        const limitMs = todayMs + 7 * 24 * 60 * 60 * 1000;
                        if (planned < todayMs || planned > limitMs) return false;
                      }
                      return true;
                    }).map(t => {
                      const cat = categories.find(c => c.id === t.categoryId);
                      const isComplete = t.status === 'DONE';
                      return (
                        <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-all">
                          <div className="space-y-1 pr-4">
                            <h4 className={`text-xs font-bold leading-normal ${isComplete ? 'text-slate-400 line-through font-medium' : 'text-slate-800'}`}>
                              {t.title}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span 
                                className="text-[9px] px-2 py-0.5 rounded-full border font-black uppercase tracking-wider"
                                style={{ 
                                  color: cat ? cat.color : '#64748b', 
                                  backgroundColor: (cat ? cat.color : '#fb7185') + '12',
                                  borderColor: (cat ? cat.color : '#fb7185') + '25'
                                }}
                              >
                                {cat ? cat.name : '通用'}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono font-bold flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-300" />
                                {t.plannedDate}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 select-none">
                            <select 
                              value={t.status}
                              onChange={(e) => handleUpdateTaskStatus(t.id, e.target.value as any)}
                              className="px-2 py-1 text-[10px] border border-slate-200 bg-white rounded-lg text-slate-700 font-bold outline-none"
                            >
                              <option value="TODO">待执行</option>
                              <option value="IN_PROGRESS">专注中</option>
                              <option value="DONE">已完结</option>
                              <option value="NOT_DONE">未完成</option>
                            </select>
                            
                            {!isComplete && (
                              <button
                                onClick={() => handleStartSession(t)}
                                className="p-1 px-2.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-extrabold hover:bg-rose-100 transition"
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
            
            <header className="bg-white rounded-[16px] border border-slate-150 p-6 flex items-center justify-between gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)]" id="categories_header">
              <div>
                <span className="px-3 py-1 bg-rose-50 text-[10px] text-rose-600 font-bold rounded-full uppercase tracking-wider inline-block">
                  Categories Matrix
                </span>
                <h2 className="text-xl font-extrabold text-slate-800 mt-2">分类令牌设定中心</h2>
                <p className="text-xs text-slate-500 font-medium">设计多级色彩和排序归一权重，使专注数据分析能精密关联在特定的业务板块中。</p>
              </div>

              <button
                onClick={() => handleOpenCategoryModal(null)}
                className="text-white font-bold text-xs px-4 py-3 rounded-lg shadow transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                style={{ backgroundColor: styleContext.primary }}
              >
                <Plus className="w-3.5 h-3.5" /> 创设全新板块分类
              </button>
            </header>

            {/* Grid Layout conforming strictly exactly to "每行4个单元网格布局" (at widescreen display grid-cols-4) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6" id="categories_grid">
              
              {categories.map(cat => {
                const associatedTasks = allTasks.filter(t => t.categoryId === cat.id);
                return (
                  <div 
                    key={cat.id} 
                    className="bg-white border-2 border-slate-200/80 rounded-[12px] shadow-sm relative overflow-hidden flex flex-col justify-between hover:scale-[1.02] hover:border-[var(--color-primary)] transition-all duration-300 group"
                  >
                    {/* Top colored stripe bar banner height 60px as demanded exactly */}
                    <div 
                      className="h-[60px] w-full transition-all duration-300 shadow-inner flex items-center px-4"
                      style={{ backgroundColor: cat.color }}
                    >
                      <span className="text-[10px] uppercase font-bold text-white tracking-widest bg-black/10 px-2 py-0.5 rounded-full">
                        RANK: {cat.sortOrder}
                      </span>
                    </div>

                    {/* Bottom detailed textual metrics info segment */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm tracking-tight pt-1">
                            {cat.name}
                          </h4>
                          <span className="text-[11px] text-slate-450 text-slate-400 font-bold font-mono">
                            {associatedTasks.length} 个关联指令项
                          </span>
                        </div>

                        {/* Options button group revealed cleanly on hover as requested */}
                        <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white rounded-lg shadow-sm">
                          <button
                            onClick={() => handleOpenCategoryModal(cat)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-md transition"
                            title="配置并修改字段"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-md transition"
                            title="抹消该分类"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                    </div>

                  </div>
                );
              })}

              {/* Dotted border placeholder box to spawn Quick modal category form as requested */}
              <div 
                onClick={() => handleOpenCategoryModal(null)}
                className="bg-stone-50 hover:bg-stone-100 border-2 border-dashed border-stone-300 rounded-[12px] h-[142px] flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:border-rose-400 hover:text-rose-600 transition-all group select-none"
              >
                <Plus className="w-7 h-7 text-stone-400 group-hover:scale-110 transition group-hover:text-[var(--color-primary)] mb-2" />
                <span className="text-xs font-bold text-slate-500 group-hover:text-[var(--color-primary)]">
                  + 创设空位板块档案
                </span>
                <span className="text-[9px] text-slate-400 mt-0.5">多重维度的业务色彩令</span>
              </div>

            </div>

            {/* Create / Edit Category Local overlay dialog modal block */}
            {isCategoryModalOpen && (
              <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" id="category_modal">
                <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-sm w-full p-6 space-y-5 animate-in zoom-in-95 duration-150" id="category_modal_card">
                  
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="font-extrabold text-sm text-slate-800">
                      {editingCategory ? '编辑分类板块' : '创设全新分类标签'}
                    </h3>
                    <button 
                      onClick={() => setIsCategoryModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">标签名称</label>
                      <input 
                        type="text"
                        placeholder="e.g. 审议系统架构 / 会议纪要"
                        value={catFormName}
                        onChange={(e) => setCatFormName(e.target.value)}
                        className="w-full text-xs border border-slate-200 bg-slate-50 p-2 text-slate-800 rounded-lg outline-none focus:border-rose-300 font-bold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                        视觉色彩标签
                      </label>
                      
                      <div className="grid grid-cols-4 gap-2 p-2 bg-slate-50 border rounded-xl">
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setCatFormColor(c.hex)}
                            title={c.label}
                            className={`w-full h-7 rounded-md border transition-all relative ${
                              catFormColor === c.hex 
                                ? 'scale-110 ring-2 ring-rose-450 ring-offset-1 border-white shadow-sm' 
                                : 'hover:scale-105 border-slate-200'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          >
                            {catFormColor === c.hex && (
                              <Check className="w-3 h-3 text-white absolute inset-0 m-auto stroke-3" />
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Manual Hex Override Input slot */}
                      <div className="flex items-center gap-2">
                        <input 
                          type="color"
                          value={catFormColor}
                          onChange={(e) => setCatFormColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border shrink-0 hover:scale-105 transition"
                        />
                        <input 
                          type="text"
                          value={catFormColor}
                          onChange={(e) => setCatFormColor(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs text-slate-800 rounded-lg border uppercase border-slate-200 outline-none font-mono font-bold"
                          placeholder="#fb7185"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">排序优先排序权重 (数值越大靠前显示)</label>
                      <input 
                        type="number"
                        placeholder="0"
                        value={catFormSort}
                        onChange={(e) => setCatFormSort(Number(e.target.value))}
                        className="w-full text-xs border border-slate-200 bg-slate-50 p-2 rounded-lg outline-none font-sans font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t">
                    <button
                      onClick={() => setIsCategoryModalOpen(false)}
                      className="text-slate-400 hover:bg-slate-100 text-xs font-bold px-3 py-2 rounded-lg transition"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveCategory}
                      className="text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-sm"
                      style={{ backgroundColor: styleContext.primary }}
                    >
                      保存该分类板块
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
            
            <header className="bg-white rounded-[16px] border border-slate-150 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)]" id="daily_header">
              <div>
                <span className="px-3 py-1 bg-rose-50 text-[10px] text-rose-600 font-bold rounded-full w-fit">
                  Daily Analytical Metrics Dashboard
                </span>
                <h2 className="text-xl font-extrabold text-slate-800 mt-2">当日精细执行状况数据面板</h2>
                <p className="text-xs text-slate-500 font-medium mt-1">自动核算计划行动完结状态与已专注分钟，采用数据可视看板呈现纯粹客观的时间运用图景。</p>
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="date"
                  value={dailyReportDate}
                  onChange={(e) => setDailyReportDate(e.target.value)}
                  className="bg-white border border-slate-200 px-3 py-2 text-xs rounded-lg font-mono font-bold outline-none cursor-pointer"
                />
                
                <button
                  onClick={loadDailyStats}
                  className="bg-slate-900 border border-slate-800 text-white font-bold text-xs px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  評估當日指標
                </button>
              </div>
            </header>

            {/* Redesigned grid dashboard block featuring charts according strictly: "所有报告页面不显示文字总结，纯数据可视化展示" */}
            {!dailyStatsLoaded ? (
              <div className="bg-white border border-slate-200 rounded-[16px] p-12 text-center flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: styleContext.primary }} />
                <p className="text-xs text-slate-400 font-bold">正在极速计算当天的专注记录指标...</p>
              </div>
            ) : dailyTasks.length === 0 && dailySessions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-[16px] p-16 text-center text-slate-400">
                <ClipboardList className="w-12 h-12 mx-auto stroke-1" style={{ color: styleContext.primary }} />
                <p className="text-sm font-extrabold uppercase mt-4 text-slate-705">当天没有任何心流或派遣履历记录</p>
                <p className="text-xs text-slate-400 mt-1">请尝试在上方切换另一个排期日期来查看具体的完结看板统计。</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Metric 1 Card: Tasks Completion Ratio Pie Chart */}
                <div className="bg-white border border-slate-150 rounded-[16px] p-6 shadow-xs flex flex-col justify-between">
                  <div className="pb-3 border-b">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metrics: Completion Rate</span>
                    <h3 className="font-extrabold text-xs text-slate-750 mt-1">行动计划达成度比例</h3>
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
                      <span className="text-2xl font-black font-sans leading-none text-slate-850">
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
                    <div className="bg-emerald-50 rounded-lg p-2">
                      <p className="text-[9px] text-emerald-600 font-bold">已完结</p>
                      <p className="font-extrabold font-mono text-emerald-600 mt-0.5">{doneDailyTasksCount}</p>
                    </div>
                    <div className="bg-rose-50 rounded-lg p-2">
                      <p className="text-[9px] text-rose-500 font-bold">待推进</p>
                      <p className="font-extrabold font-mono text-rose-500 mt-0.5">{todoDailyTasksCount + inProgressDailyTasksCount}</p>
                    </div>
                    <div className="bg-stone-550 bg-stone-50 rounded-lg p-2">
                      <p className="text-[9px] text-stone-500 font-bold">搁置项</p>
                      <p className="font-extrabold font-mono text-stone-500 mt-0.5">{notDoneDailyTasksCount}</p>
                    </div>
                  </div>
                </div>

                {/* Metric 2 Card: Total Active Minutes and Delta Yesterday comparisons */}
                <div className="bg-white border border-slate-150 rounded-[16px] p-6 shadow-xs flex flex-col justify-between">
                  <div className="pb-3 border-b">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metrics: Heavy Focus Clocks</span>
                    <h3 className="font-extrabold text-xs text-slate-755 mt-1">当日累计投入专注总量</h3>
                  </div>

                  <div className="py-8 text-center space-y-3 flex-1 flex flex-col justify-center">
                    <div className="inline-block p-4 rounded-full w-fit mx-auto bg-warm-50" style={{ backgroundColor: styleContext.primaryLight }}>
                      <Award className="w-8 h-8 animate-bounce" style={{ color: styleContext.primary }} />
                    </div>
                    <div>
                      <h4 className="text-3xl font-black font-sans text-slate-800 select-all tracking-tight">
                        {dailyTotalMins} <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">分钟</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 font-bold">
                        相当于折合约 <span className="font-mono text-slate-700">{(dailyTotalMins / 60).toFixed(1)} 手记小时</span>
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Yesterday Comparison indicators with Delta Percentage arrows */}
                  <div className="bg-slate-50 border p-3.5 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Yesterday Comparison 相比昨日差额</p>
                      <p className="text-[11px] text-slate-550 font-medium">昨日累计有效手记专注: <strong className="font-mono text-slate-800">{prevDailyTotalMins} 分钟</strong></p>
                    </div>
                    <div className="flex items-center gap-1 select-none">
                      {dailyFocusDeltaPercent >= 0 ? (
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2.2 py-1 inline-flex items-center gap-0.5 rounded-full font-bold">
                          <TrendingUp className="w-3 h-3 stroke-3" />
                          +{dailyFocusDeltaPercent}%
                        </span>
                      ) : (
                        <span className="bg-rose-100 text-rose-700 text-[10px] px-2.2 py-1 inline-flex items-center gap-0.5 rounded-full font-bold">
                          <TrendingDown className="w-3 h-3 stroke-3" />
                          {dailyFocusDeltaPercent}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metric 3 Card: Horizontal Bar charts for Focus split per Category */}
                <div className="bg-white border border-slate-150 rounded-[16px] p-6 shadow-xs flex flex-col justify-between">
                  <div className="pb-3 border-b">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metrics: Multi Bar Dimensions</span>
                    <h3 className="font-extrabold text-xs text-slate-755 mt-1">业务条线对应时长分布明细</h3>
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
            
            <header className="bg-white rounded-[16px] border border-slate-150 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)]" id="weekly_header">
              <div>
                <span className="px-3 py-1 bg-rose-50 text-[10px] text-rose-600 font-bold rounded-full w-fit">
                  Weekly Heuristic Performance Hub
                </span>
                <h2 className="text-xl font-extrabold text-slate-800 mt-2">周度效率能效复盘看板</h2>
                <p className="text-xs text-slate-500 font-medium mt-1">计算单周范围内，每日折线递增、达成分布比例占比，以丰富的数据链盘整效率质量。</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 text-xs rounded-lg">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">周期起始:</span>
                  <input 
                    type="date"
                    value={weeklyStartDate}
                    onChange={(e) => setWeeklyStartDate(e.target.value)}
                    className="cursor-pointer font-bold outline-none font-mono"
                  />
                </div>
                
                <button
                  onClick={loadWeeklyStats}
                  className="bg-slate-900 border border-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition overflow-hidden"
                >
                  計算本周能效
                </button>
              </div>
            </header>

            {!weeklyStatsLoaded ? (
              <div className="bg-white border border-slate-200 rounded-[16px] p-12 text-center flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin animate-infinite" style={{ color: styleContext.primary }} />
                <p className="text-xs text-slate-405 font-bold">正在周向搜罗并合并高能效率多重数链，请稍等...</p>
              </div>
            ) : weeklyTotalTasks === 0 && weeklyTotalMins === 0 ? (
              <div className="bg-white border border-stone-150 p-16 rounded-[16.5px] text-center text-slate-400">
                <CalendarRange className="w-12 h-12 mx-auto stroke-1 text-slate-350" />
                <p className="text-sm font-extrabold uppercase mt-4">该周期全 7 日没有发现任何派遣或专注履痕</p>
                <p className="text-xs text-slate-400 mt-0.5">请尝试改变起始日期，如选择本周一对应的具体日期。</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Visual Section Bento Row 1: Left Completion Rate Progression Chart, Right Pie Task Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Card Chart 1: 7 days Done completion dynamic rate Line Chart as demanded strictly */}
                  <div className="lg:col-span-2 bg-white border border-slate-150 rounded-[16px] p-6 shadow-xs flex flex-col justify-between">
                    <div className="pb-3 border-b">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metrics: Rate Trendline Progression</span>
                      <h3 className="font-extrabold text-xs text-slate-750 mt-1">7 日行动达标率走势线</h3>
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
                  <div className="bg-white border border-slate-150 rounded-[16px] p-6 shadow-xs flex flex-col justify-between">
                    <div className="pb-3 border-b">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metrics: Category share of completed</span>
                      <h3 className="font-extrabold text-xs text-slate-755 mt-1">已完结指令板块构成占比</h3>
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
                  <div className="bg-white border border-slate-150 rounded-[16px] p-6 shadow-xs flex flex-col justify-between md:col-span-2">
                    <div className="pb-3 border-b">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metrics: Day streak Heatmap grid</span>
                      <h3 className="font-extrabold text-xs text-slate-755 mt-1">连续能效达合判定网格轨迹</h3>
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
                            
                            <div className={`mt-3 mx-auto w-3.5 h-3.5 rounded-full flex items-center justify-center ${achieved ? 'bg-emerald-400 animate-pulse' : 'bg-slate-350 bg-stone-300'}`}>
                            </div>
                            
                            <span className="text-[9px] font-bold block mt-1.5 opacity-80">{mins}m</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-[var(--color-light)] p-3 rounded-xl border border-[var(--color-secondary)]/50 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-650">🏆 本周达标连续高效专注天数最高值</span>
                      <span className="text-sm font-extrabold tracking-tight px-3 py-1 rounded bg-white" style={{ color: styleContext.primary }}>
                        连续 {maxStreak} 日高效投产达标
                      </span>
                    </div>
                  </div>

                  {/* Quantitative counter stats list card */}
                  <div className="bg-white border border-slate-150 rounded-[16px] p-6 shadow-xs flex flex-col justify-between">
                    <div className="pb-3 border-b">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Metrics: Multi count total summaries</span>
                      <h3 className="font-extrabold text-xs text-slate-755 mt-1">本周能量能效核心大指标</h3>
                    </div>

                    <div className="divide-y divide-slate-100 flex-grow py-3">
                      
                      <div className="py-2.5 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-500">本周已指派派遣总数</span>
                        <strong className="font-bold font-mono text-slate-800">{weeklyTotalTasks} 项行动</strong>
                      </div>

                      <div className="py-2.5 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-500">本周顺利完结达成总数</span>
                        <strong className="font-extrabold font-mono text-emerald-600">{weeklyDoneTasks} 项行动</strong>
                      </div>

                      <div className="py-2.5 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-500">搁置/流失排期状态数</span>
                        <strong className="font-bold font-mono text-rose-500">{weeklyOverdueTasks} 项已被搁置</strong>
                      </div>

                      <div className="py-2.5 flex items-center justify-between text-xs font-medium">
                        <span className="font-bold text-indigo-600">本周心流精细计时总量</span>
                        <strong className="text-sm font-extrabold font-sans text-indigo-700">{weeklyTotalMins} 分钟</strong>
                      </div>

                    </div>

                  </div>

                </div>

              </div>
            )}
          </div>
        )}

        {/* --- View: Immersive Fullscreen Center Focus mode (专注计时页) --- */}
        {activeTab === 'focus' && runningSession && (
          <div className="min-h-[500px] max-w-lg mx-auto flex flex-col items-center justify-center space-y-8 animate-in fade-in py-10" id="focus_stopwatch_view">
            
            <div className="text-center space-y-2">
              {/* Tooltip text specified exactly */}
              <span className="px-4 py-1.5 bg-rose-50 border-2 border-rose-100 text-rose-600 text-[11px] font-black rounded-full uppercase tracking-widest inline-block animate-pulse">
                🔥 专注中
              </span>
              
              {/* Task name text specified exactly */}
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight mt-3">
                目前正在极度专注执行目标：
              </h2>
              <p className="text-base font-extrabold text-rose-600 bg-rose-50/50 border border-rose-200 px-6 py-3.5 rounded-xl max-w-md mx-auto truncate mt-2 shadow-xs">
                🎯 {runningSession.taskTitle || '正在高速运行心流'}
              </p>
            </div>

            {/* Premium circular dynamic ring stopwatch of 200px diameter exactly represented */}
            <div className="relative w-[200px] h-[200px] flex items-center justify-center shadow-lg rounded-full bg-white border border-slate-100">
              
              {/* Ambient pulsing visual ring */}
              <div className="absolute inset-0 rounded-full border-4 border-dashed border-rose-200 breathing-ring pointer-events-none duration-100"></div>
              
              {/* Main SVG circles path drawing track and progress */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                {/* Backing light round track 12px thickness */}
                <circle
                  cx="100"
                  cy="100"
                  r="86"
                  stroke={styleContext.primaryLight}
                  strokeWidth="12"
                  fill="transparent"
                />
                
                {/* Dynamically active progress path in theme gradient colored */}
                <circle
                  cx="100"
                  cy="100"
                  r="86"
                  stroke={styleContext.primary}
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={540}
                  strokeDashoffset={540 - (540 * Math.min(1.0, (focusTimeElapsed % 3600) / 3600))}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>

              {/* Monospace count digits inner alignment */}
              <div className="text-center space-y-0.5 z-10 select-all">
                <h1 className="text-3xl font-bold font-mono text-slate-800 tracking-tight">
                  {String(Math.floor(focusTimeElapsed / 3600)).padStart(2, '0')}:
                  {String(Math.floor((focusTimeElapsed % 3600) / 60)).padStart(2, '0')}:
                  {String(focusTimeElapsed % 60).padStart(2, '0')}
                </h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  已专注
                </p>
              </div>

            </div>

            {/* Immersive white stopwatch control triggers */}
            <div className="w-full flex flex-col items-center gap-4">
              <button
                onClick={handleStopSession}
                className="w-full bg-white hover:bg-slate-50 text-slate-850 font-extrabold text-xs py-3.5 rounded-xl transition border-2 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                style={{ borderColor: styleContext.primary }}
              >
                <Square className="w-3.5 h-3.5 text-rose-500 fill-current" />
                <span>停止并记录该段专注时长</span>
              </button>

              {/* Custom micro caption layout as specified exactly */}
              <p className="text-[12.5px] text-zinc-450 font-bold text-slate-400 font-sans tracking-wide">
                深呼吸，保持节奏
              </p>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
