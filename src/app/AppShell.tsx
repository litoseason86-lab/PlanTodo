import {useEffect, useState} from 'react';

import {CalendarPanel} from '../modules/calendar/components/CalendarPanel';
import {OrganizationPanel} from '../modules/categories/components/OrganizationPanel';
import {useCategoryActions} from '../modules/categories/controllers/useCategoryActions';
import {DashboardPanel} from '../modules/dashboard/components/DashboardPanel';
import {useDashboardController} from '../modules/dashboard/controllers/useDashboardController';
import {useTodayQuickCreateController} from '../modules/dashboard/controllers/useTodayQuickCreateController';
import {FocusPanel} from '../modules/focus/components/FocusPanel';
import {useFocusSessionController} from '../modules/focus/controllers/useFocusSessionController';
import {DailyReportPanel} from '../modules/reports/components/DailyReportPanel';
import {useReportStatsController} from '../modules/reports/controllers/useReportStatsController';
import {WeeklyReviewPanel} from '../modules/reports/components/WeeklyReviewPanel';
import {type AppTab} from './navigation';
import {THEME_STYLES, type ThemeId} from './theme';
import {useTaskActions} from '../modules/tasks/controllers/useTaskActions';
import {useTasksPanelController} from '../modules/tasks/controllers/useTasksPanelController';
import {TasksPanel} from '../modules/tasks/components/TasksPanel';
import {useTagActions} from '../modules/tags/controllers/useTagActions';
import {AppHeader} from './components/AppHeader';
import {AppToast} from './components/AppToast';
import {GlobalRunningBar} from './components/GlobalRunningBar';
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

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<AppTab>('today');
  const [activeTheme, setActiveTheme] = useState<ThemeId>('peach');
  const {
    categories,
    tags,
    tasks,
    selectedDateSessions,
    allTasks,
    setLoading,
    selectedDate,
    setSelectedDate,
    refreshCategories,
    refreshTags,
    refreshAllTasks,
    loadTasksForSelectedDate,
    loadMetaData,
  } = useAppData();
  const {successMsg, errorMsg, showToast, clearSuccess, clearError} = useToast();
  const styleContext = THEME_STYLES[activeTheme];
  const reportStats = useReportStatsController({categories, allTasks});
  const focusSession = useFocusSessionController({
    tasks,
    allTasks,
    setActiveTab,
    setLoading,
    showToast,
    loadTasksForSelectedDate,
    refreshAllTasks,
  });
  const categoryActions = useCategoryActions({
    categories,
    refreshCategories,
    setLoading,
    showToast,
  });
  const tagActions = useTagActions({
    refreshTags,
    refreshAllTasks,
  });
  const todayQuickCreateController = useTodayQuickCreateController({
    categories,
    selectedDate,
    setLoading,
    showToast,
    refreshAllTasks,
    loadTasksForSelectedDate,
  });
  const taskActions = useTaskActions({
    categories,
    allTasks,
    selectedDate,
    activeTab,
    runningSession: focusSession.runningSession,
    lastFinishedSessionTask: focusSession.lastFinishedSessionTask,
    setRunningSession: focusSession.setRunningSession,
    setLastFinishedSessionTask: focusSession.setLastFinishedSessionTask,
    setLoading,
    showToast,
    loadTasksForSelectedDate,
    refreshAllTasks,
    loadDailyStats: reportStats.loadDailyStats,
    loadWeeklyStats: reportStats.loadWeeklyStats,
  });
  const tasksPanelController = useTasksPanelController({
    categories,
    tags,
    allTasks,
    selectedDate,
    setLoading,
    showToast,
    refreshTags,
    refreshAllTasks,
    loadTasksForSelectedDate,
    stopRunningSessionForTask: async (taskId) => {
      if (focusSession.runningSession?.taskId === taskId) {
        focusSession.setRunningSession(null);
      }
      if (focusSession.lastFinishedSessionTask?.id === taskId) {
        focusSession.setLastFinishedSessionTask(null);
      }
    },
    refreshReports: async () => {
      await Promise.all([
        reportStats.loadDailyStats(),
        reportStats.loadWeeklyStats(),
      ]);
    },
    updateTaskStatus: taskActions.handleUpdateTaskStatus,
    startSession: focusSession.handleStartSession,
  });
  const dashboardController = useDashboardController({
    categories,
    tasks,
    allTasks,
    selectedDateSessions,
    runningSession: focusSession.runningSession,
    focusTimeElapsed: focusSession.focusTimeElapsed,
  });

  useEffect(() => {
    void loadMetaData()
      .then(({categories: loadedCategories}) => {
        if (loadedCategories.length > 0) {
          taskActions.setDefaultTaskCategory(loadedCategories[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to load metadata', err);
      });
    void focusSession.checkRunningSession();
  }, []);

  useEffect(() => {
    void loadTasksForSelectedDate().catch((err) => {
      console.error('Failed to sync date tasks', err);
    });
  }, [loadTasksForSelectedDate]);

  useEffect(() => {
    if (activeTab === 'daily') {
      void reportStats.loadDailyStats();
    }
  }, [reportStats.dailyReportDate, activeTab, reportStats.loadDailyStats]);

  useEffect(() => {
    if (activeTab === 'weekly') {
      void reportStats.loadWeeklyStats();
    }
  }, [reportStats.weeklyStartDate, activeTab, reportStats.loadWeeklyStats]);

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

      {focusSession.runningSession && activeTab !== 'focus' && (
        <GlobalRunningBar
          runningSession={focusSession.runningSession}
          focusTimeElapsed={focusSession.focusTimeElapsed}
          onOpenFocus={() => setActiveTab('focus')}
        />
      )}

      <AppHeader
        activeTab={activeTab}
        activeTheme={activeTheme}
        hasRunningSession={Boolean(focusSession.runningSession)}
        runningSessionStatus={focusSession.runningSession?.status}
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
            todayCategoryFocusData={dashboardController.todayCategoryFocusData}
            todayQuickCreate={todayQuickCreateController}
            handleUpdateTaskStatus={taskActions.handleUpdateTaskStatus}
            handleStartSession={focusSession.handleStartSession}
            handleStopSession={focusSession.handleStopSession}
            runningSession={focusSession.runningSession}
            lastFinishedSessionTask={focusSession.lastFinishedSessionTask}
            setLastFinishedSessionTask={focusSession.setLastFinishedSessionTask}
            getTaskFocusMinutes={dashboardController.getTaskFocusMinutes}
          />
        )}
        {activeTab === 'tasks' && (
          <TasksPanel
            styleContext={{primary: styleContext.primary, primaryLight: styleContext.primaryLight, secondary: styleContext.secondary}}
            controller={tasksPanelController}
          />
        )}
        {activeTab === 'categories' && (
          <OrganizationPanel
            styleContext={{primary: styleContext.primary, primaryLight: styleContext.primaryLight}}
            categories={categories}
            tags={tags}
            categoryController={{
              allTasks,
              presetColors: PRESET_COLORS,
              ...categoryActions,
            }}
            tagController={tagActions}
          />
        )}
        {activeTab === 'calendar' && (
          <CalendarPanel
            styleContext={{primary: styleContext.primary, primaryLight: styleContext.primaryLight, secondary: styleContext.secondary}}
            categories={categories}
            tags={tags}
            showToast={showToast}
            onMutationSuccess={async () => {
              await refreshAllTasks();
              await loadTasksForSelectedDate();
            }}
          />
        )}
        {activeTab === 'daily' && (
          <DailyReportPanel
            styleContext={{primary: styleContext.primary, primaryLight: styleContext.primaryLight}}
            dailyReportDate={reportStats.dailyReportDate}
            setDailyReportDate={reportStats.setDailyReportDate}
            loadDailyStats={reportStats.loadDailyStats}
            dailyStatsLoaded={reportStats.dailyStatsLoaded}
            dailyTasks={reportStats.dailyTasks}
            dailySessions={reportStats.dailySessions}
            metrics={reportStats.dailyMetrics}
          />
        )}
        {activeTab === 'weekly' && (
          <WeeklyReviewPanel
            styleContext={{primary: styleContext.primary, primaryLight: styleContext.primaryLight, secondary: styleContext.secondary}}
            weeklyStartDate={reportStats.weeklyStartDate}
            setWeeklyStartDate={reportStats.setWeeklyStartDate}
            loadWeeklyStats={reportStats.loadWeeklyStats}
            weeklyStatsLoaded={reportStats.weeklyStatsLoaded}
            metrics={reportStats.weeklyMetrics}
          />
        )}
        {activeTab === 'focus' && focusSession.runningSession && (
          <FocusPanel
            styleContext={{primary: styleContext.primary, primaryLight: styleContext.primaryLight, secondary: styleContext.secondary}}
            runningSession={focusSession.runningSession}
            focusTimeElapsed={focusSession.focusTimeElapsed}
            formattedElapsed={focusSession.formattedElapsed}
            progressOffset={focusSession.progressOffset}
            handleStopSession={focusSession.handleStopSession}
            handlePauseSession={focusSession.handlePauseSession}
            handleResumeSession={focusSession.handleResumeSession}
          />
        )}
      </main>
    </div>
  );
}
