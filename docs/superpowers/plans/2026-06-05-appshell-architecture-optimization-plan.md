# AppShell 架构优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `src/app/AppShell.tsx` 从业务编排中心收缩为页面组合层，并保持现有前端行为不变。

**Architecture:** 采用增量提取：先拆 app 层 UI 和 toast，再提取共享数据 hook，随后按 categories、tasks、focus、reports 域迁移状态和副作用。`AppShell` 只负责 tab、theme、hook 装配和 panel props 传递，不直接调用业务 API。

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, existing module/controller/api structure

---

## Execution Preconditions

- 执行实现前必须使用 `superpowers:using-git-worktrees` 创建隔离工作区。
- 如果本地 `npm run dev` 仍在运行，先停止它，避免验证时混淆旧 bundle。
- 每个任务完成后至少运行对应窄测试或 `npm run lint`。
- 最终必须运行 `npm run lint`、`npm test`、`npm run build`。

## File Structure Map

### Create

- `src/app/hooks/useToast.ts`：toast 状态和自动清理。
- `src/app/hooks/useAppData.ts`：共享数据加载和刷新。
- `src/app/components/AppToast.tsx`：成功/错误 toast UI。
- `src/app/components/AppHeader.tsx`：品牌、导航和主题切换。
- `src/app/components/GlobalRunningBar.tsx`：非专注页运行中提示条。
- `src/modules/categories/controllers/useCategoryActions.ts`：分类弹窗、表单、保存、删除。
- `src/modules/tasks/controllers/useTaskActions.ts`：任务表单、筛选、创建、更新、删除。
- `src/modules/focus/controllers/useFocusSessionController.ts`：专注 session、计时器、开始/暂停/继续/停止。
- `src/modules/reports/controllers/useReportStatsController.ts`：日报/周报加载和 metrics。
- `src/app/errors.ts`：共享错误消息兜底函数。

### Modify

- `src/app/AppShell.tsx`：删除直接业务状态和 API 调用，改为组合 hooks/components。
- `src/modules/dashboard/controllers/useDashboardController.ts`：继续复用现有 `useDashboardController`，必要时只调整导出类型。
- `src/modules/focus/controllers/useFocusController.ts`：继续保留时间格式和 ring 计算纯函数。
- `src/modules/tasks/controllers/useTasksController.ts`：继续保留 `filterTasks`。

### Test / Verify

- Existing tests remain the main regression net:
  - `src/modules/tasks/components/TasksPanel.test.tsx`
  - `src/modules/focus/components/FocusPanel.test.tsx`
  - `src/modules/categories/components/CategoryPanel.test.tsx`
  - `src/modules/reports/components/*.test.tsx`
  - `src/modules/*/controllers/*.test.ts`
- Add tests only if extraction introduces pure behavior not covered elsewhere.

---

## Task 1: Extract Error Helper, Toast Hook, And Toast UI

**Files:**
- Create: `src/app/errors.ts`
- Create: `src/app/hooks/useToast.ts`
- Create: `src/app/components/AppToast.tsx`
- Modify: `src/app/AppShell.tsx`

- [ ] **Step 1: Move the error helper**

Create `src/app/errors.ts`:

```ts
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
```

Remove the local `getErrorMessage` function from `src/app/AppShell.tsx` and import:

```ts
import {getErrorMessage} from './errors';
```

- [ ] **Step 2: Create toast hook**

Create `src/app/hooks/useToast.ts`:

```ts
import {useCallback, useRef, useState} from 'react';

type ToastType = 'success' | 'error';

export function useToast() {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearSuccess = useCallback(() => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    setSuccessMsg(null);
  }, []);

  const clearError = useCallback(() => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setErrorMsg(null);
  }, []);

  const showToast = useCallback((msg: string, type: ToastType = 'success') => {
    if (type === 'success') {
      clearSuccess();
      setSuccessMsg(msg);
      successTimerRef.current = setTimeout(() => setSuccessMsg(null), 3500);
      return;
    }

    clearError();
    setErrorMsg(msg);
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 4500);
  }, [clearError, clearSuccess]);

  return {
    successMsg,
    errorMsg,
    showToast,
    clearSuccess,
    clearError,
  };
}
```

- [ ] **Step 3: Create toast component**

Create `src/app/components/AppToast.tsx`:

```tsx
import {AlertCircle, Check, X} from 'lucide-react';

interface AppToastProps {
  successMsg: string | null;
  errorMsg: string | null;
  clearSuccess: () => void;
  clearError: () => void;
}

export function AppToast({successMsg, errorMsg, clearSuccess, clearError}: AppToastProps) {
  return (
    <>
      {successMsg && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4" id="success_toast">
          <div className="bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl shadow-emerald-200/40 flex items-center gap-3 min-w-[240px] overflow-hidden relative">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold">{successMsg}</span>
            <button onClick={clearSuccess} className="ml-auto text-white/60 hover:text-white transition shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
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
            <button onClick={clearError} className="ml-auto text-slate-300 hover:text-slate-500 transition shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Wire AppShell to the toast hook and component**

In `src/app/AppShell.tsx`, replace:

```ts
const [errorMsg, setErrorMsg] = useState<string | null>(null);
const [successMsg, setSuccessMsg] = useState<string | null>(null);
```

with:

```ts
const {successMsg, errorMsg, showToast, clearSuccess, clearError} = useToast();
```

Replace inline toast JSX with:

```tsx
<AppToast
  successMsg={successMsg}
  errorMsg={errorMsg}
  clearSuccess={clearSuccess}
  clearError={clearError}
/>
```

Replace direct `setErrorMsg(null)` in navigation handlers with `clearError()`.

- [ ] **Step 5: Verify**

Run:

```bash
npm run lint
npm test -- src/modules/categories/components/CategoryPanel.test.tsx src/modules/tasks/components/TasksPanel.test.tsx
```

Expected: both commands pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/app/errors.ts src/app/hooks/useToast.ts src/app/components/AppToast.tsx src/app/AppShell.tsx
git commit -m "refactor: extract app toast controller"
```

---

## Task 2: Extract Header And Global Running Bar Components

**Files:**
- Create: `src/app/components/AppHeader.tsx`
- Create: `src/app/components/GlobalRunningBar.tsx`
- Modify: `src/app/AppShell.tsx`

- [ ] **Step 1: Create header component**

Create `src/app/components/AppHeader.tsx`:

```tsx
import {CalendarRange, ClipboardList, LayoutDashboard, ListTodo, Tags, Timer} from 'lucide-react';

import {APP_TABS, type AppTab} from '../navigation';
import {THEME_STYLES, type ThemeId} from '../theme';

interface AppHeaderProps {
  activeTab: AppTab;
  activeTheme: ThemeId;
  hasRunningSession: boolean;
  runningSessionStatus?: string;
  primaryColor: string;
  setActiveTab: (tab: AppTab) => void;
  setActiveTheme: (theme: ThemeId) => void;
  clearError: () => void;
}

const iconMap = {
  today: LayoutDashboard,
  tasks: ListTodo,
  categories: Tags,
  daily: ClipboardList,
  weekly: CalendarRange,
  focus: Timer,
} as const;

export function AppHeader({
  activeTab,
  activeTheme,
  hasRunningSession,
  runningSessionStatus,
  primaryColor,
  setActiveTab,
  setActiveTheme,
  clearError,
}: AppHeaderProps) {
  const goToTab = (tab: AppTab) => {
    setActiveTab(tab);
    clearError();
  };

  return (
    <header className="bg-white/70 backdrop-blur-xl sticky top-0 z-40 border-b border-slate-200/30 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-300">
      <div className="max-w-[1280px] mx-auto px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3 select-none cursor-default">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-lg shadow-rose-200/30 transition-transform duration-300 hover:scale-105" style={{backgroundColor: primaryColor}}>🍑</div>
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
                onClick={() => goToTab(tab.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  activeTab === tab.key ? 'text-white shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-700 hover:bg-white/80'
                }`}
                style={activeTab === tab.key ? {backgroundColor: primaryColor} : undefined}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
          {hasRunningSession && (
            <button
              onClick={() => goToTab('focus')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === 'focus' ? 'bg-rose-500 text-white shadow-md shadow-rose-200/50' : 'bg-rose-50/80 text-rose-500 hover:bg-rose-100/80'
              }`}
            >
              <Timer className={`w-3.5 h-3.5 ${runningSessionStatus === 'PAUSED' ? '' : 'animate-spin'}`} />
              <span>{runningSessionStatus === 'PAUSED' ? '已暂停' : '专注中'}</span>
            </button>
          )}
        </nav>

        <div className="flex items-center gap-0.5 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/30">
          <button onClick={() => setActiveTheme('peach')} className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer ${activeTheme === 'peach' ? 'bg-white text-rose-600 shadow-sm ring-1 ring-rose-100' : 'text-slate-400 hover:text-slate-600'}`}>🍑 {THEME_STYLES.peach.name}</button>
          <button onClick={() => setActiveTheme('beige')} className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer ${activeTheme === 'beige' ? 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-100' : 'text-slate-400 hover:text-slate-600'}`}>🪵 {THEME_STYLES.beige.name}</button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create global running bar component**

Create `src/app/components/GlobalRunningBar.tsx`:

```tsx
import {Timer} from 'lucide-react';

import type {TaskExecutionSession} from '../../../shared/domain/entities';

interface GlobalRunningBarProps {
  runningSession: TaskExecutionSession;
  focusTimeElapsed: number;
  onOpenFocus: () => void;
}

export function GlobalRunningBar({runningSession, focusTimeElapsed, onOpenFocus}: GlobalRunningBarProps) {
  return (
    <div onClick={onOpenFocus} className="fixed bottom-6 right-6 bg-slate-900/95 backdrop-blur-xl text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-slate-900/20 flex items-center gap-3.5 cursor-pointer z-40 hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 ring-1 ring-white/10" id="global_running_bar">
      <div className="relative shrink-0">
        <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center">
          <Timer className="w-4.5 h-4.5 text-rose-400" />
        </div>
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
  );
}
```

- [ ] **Step 3: Replace inline AppShell JSX**

In `src/app/AppShell.tsx`, remove local `iconMap` and inline header/running bar JSX.

Add:

```tsx
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
```

- [ ] **Step 4: Verify**

Run:

```bash
npm run lint
npm test -- src/modules/focus/components/FocusPanel.test.tsx
```

Expected: both commands pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/components/AppHeader.tsx src/app/components/GlobalRunningBar.tsx src/app/AppShell.tsx
git commit -m "refactor: extract app shell chrome"
```

---

## Task 3: Extract Shared App Data Hook

**Files:**
- Create: `src/app/hooks/useAppData.ts`
- Modify: `src/app/AppShell.tsx`

- [ ] **Step 1: Create hook**

Create `src/app/hooks/useAppData.ts`:

```ts
import {useCallback, useState} from 'react';

import type {Category, Task, TaskExecutionSession} from '../../../shared/domain/entities';
import {categoriesApi} from '../../modules/categories/api/categoriesApi';
import {focusApi} from '../../modules/focus/api/focusApi';
import {tasksApi} from '../../modules/tasks/api/tasksApi';

export function useAppData() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDateSessions, setSelectedDateSessions] = useState<TaskExecutionSession[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const refreshCategories = useCallback(async () => {
    const data = await categoriesApi.getCategories();
    setCategories(data);
    return data;
  }, []);

  const refreshAllTasks = useCallback(async () => {
    const data = await tasksApi.getTasks();
    setAllTasks(data);
    return data;
  }, []);

  const loadTasksForSelectedDate = useCallback(async () => {
    const data = await tasksApi.getTasks({date: selectedDate});
    setTasks(data);
    const sessionData = await focusApi.getSessions({date: selectedDate});
    setSelectedDateSessions(sessionData);
    return {tasks: data, sessions: sessionData};
  }, [selectedDate]);

  const loadMetaData = useCallback(async () => {
    setLoading(true);
    try {
      const catsData = await categoriesApi.getCategories();
      setCategories(catsData);
      const tasksData = await tasksApi.getTasks({date: selectedDate});
      setTasks(tasksData);
      const all = await tasksApi.getTasks();
      setAllTasks(all);
      return {categories: catsData, tasks: tasksData, allTasks: all};
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  return {
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
  };
}
```

- [ ] **Step 2: Wire AppShell**

In `src/app/AppShell.tsx`, remove state declarations for:

```ts
categories
tasks
selectedDateSessions
allTasks
loading
selectedDate
```

Add:

```ts
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
```

Keep the existing initial effect:

```ts
useEffect(() => {
  void loadMetaData().catch((err) => {
    console.error('Failed to load metadata', err);
  });
  void checkRunningSession();
}, [loadMetaData]);
```

Keep the selected date effect in `AppShell`, but point it to the hook function:

```ts
useEffect(() => {
  void loadTasksForSelectedDate().catch((err) => {
    console.error('Failed to sync date tasks', err);
  });
}, [loadTasksForSelectedDate]);
```

Remove the old local `loadMetaData` and `loadTasksForSelectedDate` functions.

- [ ] **Step 3: Replace direct refreshes**

Replace:

```ts
setCategories(await categoriesApi.getCategories());
setAllTasks(await tasksApi.getTasks());
```

with:

```ts
await refreshCategories();
await refreshAllTasks();
```

Keep any temporary imports needed until later tasks remove the remaining API calls.

- [ ] **Step 4: Verify**

Run:

```bash
npm run lint
npm test -- src/modules/dashboard/components/DashboardPanel.test.tsx src/modules/tasks/components/TasksPanel.test.tsx
```

Expected: both commands pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/hooks/useAppData.ts src/app/AppShell.tsx
git commit -m "refactor: extract app data hook"
```

---

## Task 4: Extract Category Actions Hook

**Files:**
- Create: `src/modules/categories/controllers/useCategoryActions.ts`
- Modify: `src/app/AppShell.tsx`

- [ ] **Step 1: Create hook**

Create `src/modules/categories/controllers/useCategoryActions.ts`:

```ts
import {useState} from 'react';

import type {Category} from '../../../../shared/domain/entities';
import {getErrorMessage} from '../../../app/errors';
import {categoriesApi} from '../api/categoriesApi';
import {getNextCategorySortOrder} from './useCategoriesController';

interface UseCategoryActionsArgs {
  categories: Category[];
  refreshCategories: () => Promise<Category[]>;
  setLoading: (loading: boolean) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export function useCategoryActions({categories, refreshCategories, setLoading, showToast}: UseCategoryActionsArgs) {
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catFormName, setCatFormName] = useState('');
  const [catFormColor, setCatFormColor] = useState('#fb7185');
  const [catFormSort, setCatFormSort] = useState(0);

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
      await refreshCategories();
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
      await refreshCategories();
    } catch (err) {
      showToast(getErrorMessage(err, '删除分类失败'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return {
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
  };
}
```

- [ ] **Step 2: Wire AppShell**

Remove local category modal/form state and category handlers from `AppShell`.

Add:

```ts
const categoryActions = useCategoryActions({
  categories,
  refreshCategories,
  setLoading,
  showToast,
});
```

Update `CategoryPanel` props to read from `categoryActions`, for example:

```tsx
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
```

- [ ] **Step 3: Verify**

Run:

```bash
npm run lint
npm test -- src/modules/categories/components/CategoryPanel.test.tsx src/modules/categories/controllers/useCategoriesController.test.ts
```

Expected: both commands pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/modules/categories/controllers/useCategoryActions.ts src/app/AppShell.tsx
git commit -m "refactor: extract category actions"
```

---

## Task 5: Extract Report Stats Hook

**Files:**
- Create: `src/modules/reports/controllers/useReportStatsController.ts`
- Modify: `src/app/AppShell.tsx`

- [ ] **Step 1: Create hook**

Create `src/modules/reports/controllers/useReportStatsController.ts`:

```ts
import {useCallback, useMemo, useState} from 'react';

import type {Category, Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import {focusApi} from '../../focus/api/focusApi';
import {tasksApi} from '../../tasks/api/tasksApi';
import {buildDailyReportMetrics} from './useDailyReportController';
import {buildWeeklyReviewMetrics} from './useWeeklyReviewController';

interface WeeklyDayData {
  day: string;
  tasks: Task[];
  sessions: TaskExecutionSession[];
}

interface UseReportStatsControllerArgs {
  categories: Category[];
  allTasks: Task[];
}

function getCurrentWeekStartDate() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

export function useReportStatsController({categories, allTasks}: UseReportStatsControllerArgs) {
  const [dailyReportDate, setDailyReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyTasks, setDailyTasks] = useState<Task[]>([]);
  const [dailySessions, setDailySessions] = useState<TaskExecutionSession[]>([]);
  const [prevDailySessions, setPrevDailySessions] = useState<TaskExecutionSession[]>([]);
  const [dailyStatsLoaded, setDailyStatsLoaded] = useState(false);
  const [weeklyStartDate, setWeeklyStartDate] = useState(getCurrentWeekStartDate);
  const [weeklyDaysData, setWeeklyDaysData] = useState<WeeklyDayData[]>([]);
  const [weeklyStatsLoaded, setWeeklyStatsLoaded] = useState(false);

  const loadDailyStats = useCallback(async () => {
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
  }, [dailyReportDate]);

  const loadWeeklyStats = useCallback(async () => {
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
  }, [weeklyStartDate]);

  const dailyMetrics = useMemo(
    () => buildDailyReportMetrics({categories, dailyTasks, allTasks, dailySessions, prevDailySessions}),
    [categories, dailyTasks, allTasks, dailySessions, prevDailySessions],
  );

  const weeklyMetrics = useMemo(
    () => buildWeeklyReviewMetrics({categories, weeklyDaysData}),
    [categories, weeklyDaysData],
  );

  return {
    dailyReportDate,
    setDailyReportDate,
    dailyTasks,
    dailySessions,
    dailyStatsLoaded,
    weeklyStartDate,
    setWeeklyStartDate,
    weeklyStatsLoaded,
    dailyMetrics,
    weeklyMetrics,
    loadDailyStats,
    loadWeeklyStats,
  };
}
```

- [ ] **Step 2: Wire AppShell**

Remove local daily/weekly state, `loadDailyStats`, `loadWeeklyStats`, `dailyMetrics`, and `weeklyMetrics`.

Add:

```ts
const reportStats = useReportStatsController({categories, allTasks});
```

Replace report effects:

```ts
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
```

Update `DailyReportPanel` and `WeeklyReviewPanel` props to use `reportStats`.

- [ ] **Step 3: Verify**

Run:

```bash
npm run lint
npm test -- src/modules/reports/controllers/useDailyReportController.test.ts src/modules/reports/controllers/useWeeklyReviewController.test.ts src/modules/reports/components/DailyReportPanel.test.tsx src/modules/reports/components/WeeklyReviewPanel.test.tsx
```

Expected: all listed tests pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/modules/reports/controllers/useReportStatsController.ts src/app/AppShell.tsx
git commit -m "refactor: extract report stats controller"
```

---

## Task 6: Extract Focus Session Controller

**Files:**
- Create: `src/modules/focus/controllers/useFocusSessionController.ts`
- Modify: `src/app/AppShell.tsx`

- [ ] **Step 1: Create hook**

Create `src/modules/focus/controllers/useFocusSessionController.ts`:

```ts
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import type {Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import {getErrorMessage} from '../../../app/errors';
import {focusApi} from '../api/focusApi';
import {calculateEffectiveFocusSeconds, calculateFocusRingOffset, formatFocusElapsed} from './useFocusController';

interface UseFocusSessionControllerArgs {
  tasks: Task[];
  allTasks: Task[];
  setActiveTab: (tab: 'today' | 'tasks' | 'categories' | 'daily' | 'weekly' | 'focus') => void;
  setLoading: (loading: boolean) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  loadTasksForSelectedDate: () => Promise<unknown>;
  refreshAllTasks: () => Promise<Task[]>;
}

export function useFocusSessionController({
  tasks,
  allTasks,
  setActiveTab,
  setLoading,
  showToast,
  loadTasksForSelectedDate,
  refreshAllTasks,
}: UseFocusSessionControllerArgs) {
  const [runningSession, setRunningSession] = useState<TaskExecutionSession | null>(null);
  const [focusTimeElapsed, setFocusTimeElapsed] = useState(0);
  const [lastFinishedSessionTask, setLastFinishedSessionTask] = useState<Task | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const checkRunningSession = useCallback(async () => {
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
  }, [setActiveTab]);

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

  const handleStartSession = useCallback(async (task: Task) => {
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
  }, [loadTasksForSelectedDate, refreshAllTasks, setActiveTab, setLoading, showToast]);

  const handleStopSession = useCallback(async () => {
    if (!runningSession) return;
    try {
      setLoading(true);
      const stopped = await focusApi.stopSession(runningSession.id);
      const originTask = tasks.find((task) => task.id === stopped.taskId) ?? allTasks.find((task) => task.id === stopped.taskId);
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
  }, [allTasks, loadTasksForSelectedDate, refreshAllTasks, runningSession, setActiveTab, setLoading, showToast, tasks]);

  const handlePauseSession = useCallback(async () => {
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
  }, [runningSession, setLoading, showToast]);

  const handleResumeSession = useCallback(async () => {
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
  }, [runningSession, setLoading, showToast]);

  const focusController = useMemo(
    () => ({
      formattedElapsed: formatFocusElapsed(focusTimeElapsed),
      progressOffset: calculateFocusRingOffset(focusTimeElapsed),
    }),
    [focusTimeElapsed],
  );

  return {
    runningSession,
    setRunningSession,
    focusTimeElapsed,
    lastFinishedSessionTask,
    setLastFinishedSessionTask,
    checkRunningSession,
    handleStartSession,
    handleStopSession,
    handlePauseSession,
    handleResumeSession,
    formattedElapsed: focusController.formattedElapsed,
    progressOffset: focusController.progressOffset,
  };
}
```

- [ ] **Step 2: Wire AppShell**

Remove local running session state, timer ref, focus elapsed effect, `checkRunningSession`, focus handlers, and `focusController`.

Add:

```ts
const focusSession = useFocusSessionController({
  tasks,
  allTasks,
  setActiveTab,
  setLoading,
  showToast,
  loadTasksForSelectedDate,
  refreshAllTasks,
});
```

Replace references:

```ts
runningSession -> focusSession.runningSession
focusTimeElapsed -> focusSession.focusTimeElapsed
lastFinishedSessionTask -> focusSession.lastFinishedSessionTask
setLastFinishedSessionTask -> focusSession.setLastFinishedSessionTask
handleStartSession -> focusSession.handleStartSession
handleStopSession -> focusSession.handleStopSession
handlePauseSession -> focusSession.handlePauseSession
handleResumeSession -> focusSession.handleResumeSession
focusController.formattedElapsed -> focusSession.formattedElapsed
focusController.progressOffset -> focusSession.progressOffset
```

Update initial effect:

```ts
useEffect(() => {
  void loadMetaData().catch((err) => {
    console.error('Failed to load metadata', err);
  });
  void focusSession.checkRunningSession();
}, [loadMetaData, focusSession.checkRunningSession]);
```

- [ ] **Step 3: Verify**

Run:

```bash
npm run lint
npm test -- src/modules/focus/controllers/useFocusController.test.ts src/modules/focus/components/FocusPanel.test.tsx src/modules/dashboard/components/DashboardPanel.test.tsx
```

Expected: all listed tests pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/modules/focus/controllers/useFocusSessionController.ts src/app/AppShell.tsx
git commit -m "refactor: extract focus session controller"
```

---

## Task 7: Extract Task Actions Hook

**Files:**
- Create: `src/modules/tasks/controllers/useTaskActions.ts`
- Modify: `src/app/AppShell.tsx`

- [ ] **Step 1: Create hook**

Create `src/modules/tasks/controllers/useTaskActions.ts`:

```ts
import {useMemo, useState, type FormEvent} from 'react';

import type {Category, Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import {getErrorMessage} from '../../../app/errors';
import {tasksApi} from '../api/tasksApi';
import {filterTasks} from './useTasksController';

interface UseTaskActionsArgs {
  categories: Category[];
  allTasks: Task[];
  selectedDate: string;
  activeTab: 'today' | 'tasks' | 'categories' | 'daily' | 'weekly' | 'focus';
  runningSession: TaskExecutionSession | null;
  lastFinishedSessionTask: Task | null;
  setRunningSession: (session: TaskExecutionSession | null) => void;
  setLastFinishedSessionTask: (task: Task | null) => void;
  setLoading: (loading: boolean) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  loadTasksForSelectedDate: () => Promise<unknown>;
  refreshAllTasks: () => Promise<Task[]>;
  loadDailyStats: () => Promise<void>;
  loadWeeklyStats: () => Promise<void>;
}

export function useTaskActions({
  categories,
  allTasks,
  selectedDate,
  activeTab,
  runningSession,
  lastFinishedSessionTask,
  setRunningSession,
  setLastFinishedSessionTask,
  setLoading,
  showToast,
  loadTasksForSelectedDate,
  refreshAllTasks,
  loadDailyStats,
  loadWeeklyStats,
}: UseTaskActionsArgs) {
  const [taskFormTitle, setTaskFormTitle] = useState('');
  const [taskFormCategory, setTaskFormCategory] = useState(0);
  const [taskFormDate, setTaskFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [taskFilterCategory, setTaskFilterCategory] = useState('all');
  const [taskFilterStatus, setTaskFilterStatus] = useState('all');
  const [taskFilterDateScope, setTaskFilterDateScope] = useState<'today' | 'seven-days' | 'all'>('today');

  const filteredTaskItems = useMemo(
    () => filterTasks(allTasks, {
      category: taskFilterCategory,
      status: taskFilterStatus as 'all' | TaskStatus,
      dateScope: taskFilterDateScope,
      selectedDate,
    }),
    [allTasks, taskFilterCategory, taskFilterStatus, taskFilterDateScope, selectedDate],
  );

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
        await loadTasksForSelectedDate();
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
      if (activeTab === 'daily') await loadDailyStats();
      if (activeTab === 'weekly') await loadWeeklyStats();
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
      if (activeTab === 'daily') await loadDailyStats();
      if (activeTab === 'weekly') await loadWeeklyStats();
    } catch (err) {
      showToast(getErrorMessage(err, '删除任务失败'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return {
    taskFormTitle,
    taskFormCategory,
    taskFormDate,
    taskFilterCategory,
    taskFilterStatus,
    taskFilterDateScope,
    filteredTaskItems,
    setTaskFormTitle,
    setTaskFormCategory,
    setTaskFormDate,
    setTaskFilterCategory,
    setTaskFilterStatus,
    setTaskFilterDateScope,
    handleCreateTask,
    handleUpdateTaskStatus,
    handleDeleteTask,
  };
}
```

- [ ] **Step 2: Wire AppShell**

Remove local task form/filter state, `filteredTaskItems`, `handleCreateTask`, `handleUpdateTaskStatus`, and `handleDeleteTask`.

Add:

```ts
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
```

Update `DashboardPanel` and `TasksPanel` task props to use `taskActions`.

- [ ] **Step 3: Verify**

Run:

```bash
npm run lint
npm test -- src/modules/tasks/controllers/taskFilters.test.ts src/modules/tasks/components/TasksPanel.test.tsx src/modules/dashboard/components/DashboardPanel.test.tsx
```

Expected: all listed tests pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/modules/tasks/controllers/useTaskActions.ts src/app/AppShell.tsx
git commit -m "refactor: extract task actions"
```

---

## Task 8: Replace Remaining AppShell Derived Logic And Clean Imports

**Files:**
- Modify: `src/app/AppShell.tsx`
- Modify: `src/modules/dashboard/controllers/useDashboardController.ts` only if needed

- [ ] **Step 1: Use existing dashboard controller hook**

In `src/app/AppShell.tsx`, replace manual `useMemo` for `todayCategoryFocusData` and local `getTaskFocusMinutesForPanel` with:

```ts
const dashboardController = useDashboardController({
  categories,
  tasks,
  allTasks,
  selectedDateSessions,
  runningSession: focusSession.runningSession,
  focusTimeElapsed: focusSession.focusTimeElapsed,
});
```

Update `DashboardPanel` props:

```tsx
todayCategoryFocusData={dashboardController.todayCategoryFocusData}
getTaskFocusMinutes={dashboardController.getTaskFocusMinutes}
```

- [ ] **Step 2: Remove unused AppShell imports**

`src/app/AppShell.tsx` should no longer import:

```ts
FormEvent
useMemo
useRef
Category
Task
TaskExecutionSession
TaskStatus
categoriesApi
tasksApi
focusApi
getNextCategorySortOrder
buildTodayCategoryFocusData
getTaskFocusMinutes
formatFocusElapsed
calculateFocusRingOffset
calculateEffectiveFocusSeconds
buildDailyReportMetrics
buildWeeklyReviewMetrics
filterTasks
Calendar
CalendarRange
Check
ClipboardList
LayoutDashboard
ListTodo
Loader2
Square
Tags
Timer
X
AlertCircle
```

Keep only imports actually used by the final `AppShell`, expected to include:

```ts
import {useEffect, useState} from 'react';
import {DashboardPanel} from '../modules/dashboard/components/DashboardPanel';
import {useDashboardController} from '../modules/dashboard/controllers/useDashboardController';
import {FocusPanel} from '../modules/focus/components/FocusPanel';
import {DailyReportPanel} from '../modules/reports/components/DailyReportPanel';
import {WeeklyReviewPanel} from '../modules/reports/components/WeeklyReviewPanel';
import {TasksPanel} from '../modules/tasks/components/TasksPanel';
import {CategoryPanel} from '../modules/categories/components/CategoryPanel';
import {useCategoryActions} from '../modules/categories/controllers/useCategoryActions';
import {useFocusSessionController} from '../modules/focus/controllers/useFocusSessionController';
import {useReportStatsController} from '../modules/reports/controllers/useReportStatsController';
import {useTaskActions} from '../modules/tasks/controllers/useTaskActions';
import {AppHeader} from './components/AppHeader';
import {AppToast} from './components/AppToast';
import {GlobalRunningBar} from './components/GlobalRunningBar';
import {useAppData} from './hooks/useAppData';
import {useToast} from './hooks/useToast';
import {type AppTab} from './navigation';
import {THEME_STYLES, type ThemeId} from './theme';
```

- [ ] **Step 3: Check AppShell responsibility**

Run:

```bash
wc -l src/app/AppShell.tsx
rg -n "categoriesApi|tasksApi|focusApi|useRef|setInterval|buildDailyReportMetrics|buildWeeklyReviewMetrics|filterTasks|getNextCategorySortOrder" src/app/AppShell.tsx
```

Expected:

```txt
src/app/AppShell.tsx is 350 lines or fewer
rg returns no matches
```

- [ ] **Step 4: Verify**

Run:

```bash
npm run lint
npm test
npm run build
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/AppShell.tsx src/modules/dashboard/controllers/useDashboardController.ts
git commit -m "refactor: simplify app shell composition"
```

---

## Final Verification

- [ ] **Step 1: Run complete verification**

Run:

```bash
npm run lint
npm test
npm run build
wc -l src/app/AppShell.tsx
rg -n "categoriesApi|tasksApi|focusApi|useRef|setInterval|buildDailyReportMetrics|buildWeeklyReviewMetrics|filterTasks|getNextCategorySortOrder" src/app/AppShell.tsx
```

Expected:

- `npm run lint` passes.
- `npm test` passes.
- `npm run build` passes.
- `AppShell.tsx` is 350 lines or fewer.
- `rg` returns no matches.

- [ ] **Step 2: Manual browser smoke test**

Run:

```bash
npm run dev
```

Open `http://127.0.0.1:3000` and smoke test:

- 今日执行可创建任务。
- 任务库可删除任务。
- 分类管理可打开新建分类弹窗。
- 专注可开始、暂停、继续、停止。
- 每日记录和周复盘可打开并显示数据。

- [ ] **Step 3: Final commit status**

Run:

```bash
git status --short
git log --oneline -8
```

Expected:

- `git status --short` shows no uncommitted implementation changes.
- Recent commits show the refactor tasks in order.
