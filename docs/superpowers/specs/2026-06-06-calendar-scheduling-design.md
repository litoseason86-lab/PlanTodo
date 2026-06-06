# 日历排期功能一期设计

## 背景

PlanTodo 当前已经具备任务、分类、专注、日报和周报能力，但日程安排仍然停留在“按日期筛选任务”的层面。任务模型只有 `plannedDate`，无法表达具体开始时间、结束时间、全天任务、跨天任务，也无法支撑周视图时间轴、拖拽排期和日历显示设置。

用户希望参考滴答清单的日历能力，新增一个复杂日历功能。一期范围已确认采用 B-core：

- 周视图、月视图、列表视图
- 时间字段与排期更新
- 拖拽安排任务
- 基础显示设置：显示范围、显示已完成、分类颜色、专注记录
- 批量操作和推迟放到二期

这不是一个单纯的前端页面。正确做法是先建立任务排期底座，再在前端提供日历视图。

## 参考资料

本设计参考以下滴答清单帮助文档，但只吸收适合 PlanTodo 当前领域模型的部分：

- 周视图：轻松安排周计划：`https://help.dida365.com/articles/6950641140068515840`
- 月视图：每月总结复盘：`https://help.dida365.com/articles/6950640298334617600`
- 年视图：查看年度任务完成情况：`https://help.dida365.com/articles/7397517843383713792`
- 列表视图：按天查看任务：`https://help.dida365.com/articles/6950643979079647232`
- 日程视图：以时间串联任务：`https://help.dida365.com/articles/7213438708429619200`
- 任务与日历同时显示：`https://help.dida365.com/articles/7358382716586295296`
- 日历显示设置：`https://help.dida365.com/articles/6950647988939128832`
- 常见问题：`https://help.dida365.com/articles/6950648670899404800`

## 目标

一期目标如下：

1. 新增日历入口，让用户可以在月、周、列表三种视图中查看任务。
2. 扩展任务排期模型，支持日期任务、全天任务、时间段任务和跨天全天任务。
3. 支持把任务拖到日期或时间轴中完成排期。
4. 支持在日历中调整已有排期任务的日期和时间段。
5. 支持基础显示设置：分类显示范围、是否显示已完成、按分类颜色显示、是否显示专注记录。
6. 保持现有今日执行、任务库、专注、日报、周报行为兼容。
7. 保持前后端分层边界，避免把日历逻辑塞进 `AppShell` 或 `DashboardPanel`。

## 非目标

以下能力不进入一期：

- 年视图与年度热力图
- 批量选择、批量拖动、批量删除、批量完成
- 推迟 1 小时或批量推迟
- 农历、节假日、调休
- 辅助时区
- 标签、优先级、重复任务、检查事项
- 习惯打卡、倒数纪念日、课表、订阅日历
- 外部日历导入、导出、同步
- AI 自动排期
- 移动端专属交互，如长按手势和横屏优化

这些能力要么依赖 PlanTodo 当前没有的领域模型，要么会显著扩大拖拽和状态一致性测试面。一期硬塞会制造债务。

## 推荐方案

采用“扩展任务排期字段 + 新增前端 calendar 模块”的方案。

不单独新增 `CalendarEvent` 领域模型。PlanTodo 当前核心对象是任务，日历一期展示和操作的对象也都是任务。独立事件模型适合未来接入外部日历、健康数据、纪念日或课程表，但现在引入会让一期同时处理任务和事件两套语义，收益不足。

后端继续以 `tasks` 模块承接任务排期规则，新增日期范围查询和排期更新能力。前端新增 `src/modules/calendar`，负责视图状态、日历布局、拖拽排期和显示设置。`AppShell` 只新增 tab 装配，不承接日历业务逻辑。

## 数据模型

扩展共享 `Task` 类型：

```ts
export interface Task {
  id: number;
  userId: number;
  categoryId: number;
  title: string;
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}
```

字段语义：

- `plannedDate`：任务排期起始日期，继续使用 `YYYY-MM-DD`。保留现有字段以兼容今日执行、任务库和报表。
- `plannedEndDate`：跨天全天任务的结束日期。普通日期任务为空。
- `startAt`：具体开始时间，使用 ISO datetime 字符串。
- `endAt`：具体结束时间，使用 ISO datetime 字符串。
- `allDay`：是否按全天/日期任务显示。

排期形态：

| 形态 | 字段规则 | 展示位置 |
| --- | --- | --- |
| 日期任务 | `plannedDate` + `allDay=true`，无 `startAt/endAt` | 月视图日期格、周视图全天栏、列表视图日期组 |
| 跨天全天任务 | `plannedDate` + `plannedEndDate` + `allDay=true` | 月视图跨天条、周视图全天栏 |
| 时间段任务 | `plannedDate` + `startAt/endAt` + `allDay=false` | 周视图时间轴、列表视图时间段 |

一期不支持“跨天时间段任务”。如果 `allDay=false`，`startAt` 和 `endAt` 必须落在同一个本地日期。跨天时间段任务放到后续设计，避免第一版时间轴布局复杂度过高。

现有任务迁移规则：

- 已有任务默认 `allDay=true`
- `plannedEndDate/startAt/endAt` 为空
- 现有 `plannedDate` 保持不变

## 后端设计

### Task repository

扩展 `TaskFilters`：

```ts
export interface TaskFilters {
  userId: number;
  plannedDate?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: TaskStatus;
  categoryId?: number;
}
```

新增排期更新输入：

```ts
export interface UpdateTaskScheduleInput {
  taskId: number;
  userId: number;
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
}
```

仓储接口新增：

```ts
updateSchedule(input: UpdateTaskScheduleInput): Task | undefined;
```

`listByFilters` 在存在 `dateFrom/dateTo` 时返回与日期区间相交的任务：

- 普通日期任务：`plannedDate` 落入区间
- 跨天全天任务：`plannedDate..plannedEndDate` 与区间相交
- 时间段任务：`startAt/endAt` 的日期落入区间

### Task service

新增 `updateSchedule` 业务方法，负责：

- 校验任务存在且属于当前用户
- 校验日期字符串合法
- 校验 `plannedEndDate >= plannedDate`
- 校验 `allDay=false` 时必须有 `startAt/endAt`
- 校验 `endAt > startAt`
- 拒绝一期不支持的跨天时间段任务
- 调用仓储更新排期

创建任务时也接受排期字段，但默认保持兼容：

- 未传排期字段时：按现有 `plannedDate` 创建全天任务
- 传 `startAt/endAt` 时：创建时间段任务

### HTTP API

保留现有接口：

- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id/status`
- `DELETE /api/tasks/:id`

扩展查询参数：

```txt
GET /api/tasks?dateFrom=2026-06-01&dateTo=2026-06-30
GET /api/tasks?dateFrom=2026-06-01&dateTo=2026-06-07&categoryId=1
```

新增排期接口：

```txt
PATCH /api/tasks/:id/schedule
```

请求体：

```json
{
  "plannedDate": "2026-06-06",
  "plannedEndDate": "2026-06-08",
  "startAt": "2026-06-06T09:00:00.000",
  "endAt": "2026-06-06T10:00:00.000",
  "allDay": false
}
```

`allDay=true` 时 `startAt/endAt` 会被清空。

### Focus session range API

日历需要在周视图和月视图中显示专注记录。当前 `FocusSessionRepository` 已有 `listByDateRange`，但 HTTP 和前端 API 只支持单日查询。

一期需要扩展：

```txt
GET /api/task-sessions?dateFrom=2026-06-01&dateTo=2026-06-07
```

兼容现有单日查询：

```txt
GET /api/task-sessions?date=2026-06-06
```

路由规则：

- 传 `date` 时按现有单日逻辑处理
- 传 `dateFrom/dateTo` 时按区间查询
- 同时传 `date` 和区间参数时返回 `400`
- `dateTo < dateFrom` 返回 `400`

## 存储设计

### SQLite

新增迁移：

```sql
ALTER TABLE tasks ADD COLUMN planned_end_date TEXT;
ALTER TABLE tasks ADD COLUMN start_at TEXT;
ALTER TABLE tasks ADD COLUMN end_at TEXT;
ALTER TABLE tasks ADD COLUMN all_day INTEGER NOT NULL DEFAULT 1;
```

现有数据通过默认值兼容。

SQLite repository 需要同步更新：

- row mapper
- insert task
- list filters
- update schedule
- test fixtures

### JSON

JSON repository 读旧数据时补默认值：

```ts
{
  allDay: task.allDay ?? true,
  plannedEndDate: task.plannedEndDate,
  startAt: task.startAt,
  endAt: task.endAt,
}
```

写入时保存新字段。导入 JSON 到 SQLite 时同步映射新字段，旧 JSON 数据仍可导入。

## 前端设计

### 导航

`APP_TABS` 新增：

```ts
{key: 'calendar', label: '日历'}
```

`AppShell` 只负责装配：

```tsx
{activeTab === 'calendar' && <CalendarPanel ... />}
```

不得把日历视图状态、拖拽逻辑、日期范围计算写入 `AppShell`。

### 目录结构

新增：

```txt
src/modules/calendar/
  api/calendarApi.ts
  components/CalendarPanel.tsx
  components/CalendarToolbar.tsx
  components/CalendarSettingsMenu.tsx
  components/MonthCalendarView.tsx
  components/WeekTimelineView.tsx
  components/CalendarListView.tsx
  controllers/useCalendarController.ts
  controllers/calendarLayout.ts
  controllers/calendarSettings.ts
```

`calendarApi` 可以复用 `tasksApi` 和 `focusApi`，但向日历模块暴露日历语义的方法，例如：

- `getCalendarTasks({dateFrom, dateTo, categoryId})`
- `updateTaskSchedule(taskId, schedule)`
- `getFocusSessions({dateFrom, dateTo})`

### Calendar controller

`useCalendarController` 负责：

- 当前视图：`month | week | list`
- 当前锚点日期
- 当前显示范围日期区间
- 当前显示设置
- 加载区间任务
- 加载区间专注记录
- 排期更新
- 拖拽落点转排期参数

显示设置先保存在 `localStorage`，不新增后端用户设置表。

```ts
interface CalendarSettings {
  visibleCategoryIds: number[];
  showCompleted: boolean;
  colorMode: 'category';
  showFocusSessions: boolean;
}
```

`visibleCategoryIds` 为空时表示全部分类。

### 月视图

月视图能力：

- 展示当前月完整网格，包含前后补齐日期
- 日期格显示任务摘要
- 支持按分类颜色显示任务块
- 支持隐藏已完成任务
- 支持点击日期创建全天任务
- 支持把任务拖到日期格，更新 `plannedDate` 并清空时间段
- 支持跨天全天任务横跨多个日期展示

月视图不做：

- 年热力图
- 多周缩放
- 农历节假日

### 周视图

周视图能力：

- 顶部全天任务栏
- 7 日竖向时间轴
- 日期任务和跨天全天任务进入全天栏
- 时间段任务进入对应日的时间轴
- 拖日期任务到时间轴，默认生成 60 分钟时间段
- 拖时间段任务到其他时间槽，更新 `startAt/endAt`
- 拖时间段任务边缘调整时长
- 显示专注记录 overlay

一期时间轴采用固定小时范围，例如 06:00 到 23:00。隐藏时段和缩放放二期。

### 列表视图

列表视图能力：

- 按日期分组展示区间任务
- 时间段任务显示开始/结束时间
- 全天任务显示在日期组顶部
- 可选择显示专注记录摘要
- 复用显示范围、已完成、分类颜色设置

列表视图是低成本浏览入口，不承载复杂拖拽。

### 基础显示设置

设置入口放在日历工具栏右侧。

一期支持：

- 显示范围：按分类筛选
- 显示已完成：开关
- 任务颜色：固定按分类颜色
- 显示专注记录：开关

不支持：

- 按标签/优先级颜色
- 自定义任务块颜色
- 现代/经典主题切换
- 类型图标开关
- 辅助时区

## 与现有模块的关系

### tasks

`tasks` 仍然是任务领域的规则归属。日历只是任务排期和展示入口，不重新定义任务状态。

任务库继续可创建日期任务。后续可在任务库表单中增加时间段字段，但不是日历一期的必要条件。

### dashboard

今日执行继续使用 `selectedDate` 加载当天任务。时间段字段加入后，今日执行可以继续按 `plannedDate` 取当天任务，不必立即改造成时间轴。

### focus

专注记录来源仍然是 `focus` 模块。日历只读取 session 并在日历中展示，不改变专注状态机。

### reports

日报、周报继续基于任务完成状态和专注记录生成。排期字段不改变已有统计口径。

## 错误处理

后端返回明确错误：

- `400 Invalid plannedDate`
- `400 plannedEndDate must be after plannedDate`
- `400 Timed task requires startAt and endAt`
- `400 endAt must be after startAt`
- `400 Cross-day timed tasks are not supported yet`
- `404 Task not found`

前端展示 toast，并在排期失败时回滚当前拖拽造成的乐观 UI。

## 测试策略

### 后端测试

新增或扩展：

- `schemas.test.ts`：排期 body、日期范围 query 校验
- `tasks.service.test.ts`：排期校验、跨天限制、任务不存在
- JSON repository 测试：新字段读写、旧数据默认值
- SQLite repository 测试：迁移、新字段读写、日期范围查询
- `createRepositories` 相关测试不变

### 前端测试

新增：

- `calendarLayout.test.ts`
  - 月视图日期网格
  - 周起止日期计算
  - 时间段任务定位
  - 跨天全天任务分段
- `calendarSettings.test.ts`
  - 默认设置
  - localStorage 读写
  - 分类过滤
- `useCalendarController.test.ts`
  - 切换视图
  - 日期跳转
  - 排期更新成功刷新
  - 排期失败回滚并 toast
- 组件测试
  - 月视图渲染任务
  - 周视图渲染全天栏和时间轴任务
  - 显示已完成开关
  - 显示专注记录开关

全量验证继续使用：

```bash
npm test
npm run lint
npm run build
```

## 实施顺序

1. 扩展 `Task` 类型、schemas、service、repository contract。
2. 增加 JSON/SQLite 存储字段和迁移。
3. 增加任务日期范围查询和排期更新 API。
4. 增加专注记录日期范围查询 API。
5. 增加前端 `calendar` 模块骨架和日历工具栏。
6. 实现月视图和列表视图。
7. 实现周视图时间轴、全天栏、拖拽排期、调整时长。
8. 实现基础显示设置和 localStorage 持久化。
9. 接入专注记录 overlay。
10. 补齐测试并跑全量验证。

## 风险

### 时间语义风险

当前项目只处理日期。引入时间段后，最容易出问题的是本地日期、ISO datetime 和浏览器时区之间的转换。设计要求：

- 日期字段继续使用 `YYYY-MM-DD`
- 时间字段使用 ISO datetime 字符串
- UI 层负责把时间槽转换为本地 datetime
- 后端只校验顺序和同日约束，不推断用户时区

### 拖拽复杂度风险

拖拽排期容易让 UI 状态和后端状态不一致。设计要求：

- 排期更新必须走单一 controller action
- 失败时回滚 UI
- 不在多个组件里各自调用 API

### 范围膨胀风险

日历功能天然容易膨胀。任何涉及批量操作、重复任务、农历节假日、辅助时区、标签优先级、订阅日历的需求都进入二期或后续，不混入一期。

## 验收标准

一期完成后应满足：

1. 用户可以进入“日历”tab。
2. 用户可以在月视图、周视图、列表视图之间切换。
3. 用户可以按分类过滤日历任务。
4. 用户可以切换是否显示已完成任务。
5. 任务块按分类颜色展示。
6. 用户可以切换是否显示专注记录。
7. 用户可以在月视图点击日期创建全天任务。
8. 用户可以把任务拖到月视图日期格改变日期。
9. 用户可以在周视图看到全天栏和时间轴。
10. 用户可以把日期任务拖到周视图时间轴，生成默认 60 分钟时间段。
11. 用户可以拖动时间段任务改变开始时间。
12. 用户可以调整时间段任务时长。
13. 旧任务数据不丢失，并默认作为全天日期任务展示。
14. 今日执行、任务库、专注、日报、周报现有测试继续通过。
