# 任务库日历去冗余设计

## Context

任务库当前可以通过“显示日历”在任务列表旁嵌入 `EmbeddedCalendarPanel`。这个设计来自日历排期二期：任务页同时显示日历，方便从任务库进入排期。

现在完整日历页已经具备周视图、月视图、列表视图、安排任务栏、拖拽排期、快速创建和周视图密度能力。继续在任务库中保留一个弱化版日历，会造成职责重叠：

- 任务库被迫承担排期视图职责。
- 完整日历页和任务库都在回答“怎么安排任务到时间上”。
- 任务库主空间被日历占用，但用户在这里真正需要的是快速管理任务。

本期目标不是削弱排期能力，而是收紧边界：任务库负责任务管理，日历页负责时间规划。

## Goals

1. 任务库保留全局仓库属性，支持快速查看今日、本周、未安排和全部任务。
2. 移除任务库内嵌日历，避免复制完整日历页能力。
3. 保留一个轻量“去日历安排”入口，用于进入完整日历页处理复杂排期。
4. 任务库继续支持快速新增、删除、编辑基础任务信息。
5. 保持今日执行、完整日历页、任务创建和非日期 metadata 筛选语义不变。

## Non-Goals

1. 不在任务库中显示周时间轴、月视图或列表日历视图。
2. 不在任务库中实现拖拽排期。
3. 不在任务库中编辑既有任务的排期字段，包括 `plannedDate`、`plannedEndDate`、`allDay`、`startAt` 和 `endAt`。
4. 不做日历容量概览。
5. 不把任务库筛选条件同步到日历页。
6. 不在任务库任务行中保留拖拽排期入口。

## Product Boundary

任务库定位为全局任务管理台。

任务库应该回答：

- 今天有哪些任务？
- 本周有哪些任务？
- 哪些任务还未安排？
- 全部任务中哪些满足当前筛选？
- 能否快速新增、删除或编辑基础信息？

完整日历页应该回答：

- 任务在一天或一周中的具体时间位置是什么？
- 哪些任务需要拖入时间轴？
- 如何调整全天、多日、具体时段任务？
- 当前周视图、月视图或列表视图如何呈现排期？

今日执行继续定位为执行态入口，关注开始专注、完成任务和当前行动。任务库的今日视图是管理态入口，关注筛选、增删改和整理。

## Proposed Approach

采用“移除嵌入日历 + 保留最小日历导航”的方案。

任务库移除：

- `calendarVisible` 本地状态。
- “显示日历 / 隐藏日历”按钮。
- `EmbeddedCalendarPanel` 在 `TasksPanel` 中的渲染。
- 任务库内的日历周/月/列表切换、时间轴和拖拽入口。

任务库保留或增强：

- 今日、本周、未安排、全部四个任务范围入口。
- 搜索、分类、状态、标签、优先级筛选。
- 快速创建任务。
- 删除任务。
- 编辑基础任务信息。
- “去日历安排”按钮，触发上层导航切到完整日历页。

第一版“去日历安排”不携带任务库筛选条件，避免任务库和日历页形成隐式耦合。它只负责进入完整日历页的安排语境：当前实现中 `CalendarPanel` 每次挂载时安排任务栏默认打开，因此 `AppShell` 切到 calendar tab 已满足要求；如果后续日历页改为跨 tab 保留挂载状态，`onOpenCalendar` 需要显式请求打开安排任务栏。

## Component Design

### `TasksPanel`

`TasksPanel` 回到单一任务管理布局：

- 删除 `calendarVisible` state。
- 删除 `EmbeddedCalendarPanel` import 和渲染。
- 保留 `TaskCreateForm` 和 `TaskList`。
- 接收上层传入的 `onOpenCalendar` 回调，用于“去日历安排”按钮。

`TasksPanel` 不直接引用 `useCalendarController`，也不调用排期 API。

“去日历安排”按钮第一版可以内联在现有 header 中，不强制新增 `TaskLibraryHeader`。只有当任务库头部继续承载更多状态时，才提取独立组件。

### `TaskFilterBar`

`TaskFilterBar` 移除日历开关相关 props：

- 删除 `calendarVisible`。
- 删除 `onToggleCalendar`。
- 删除“显示日历 / 隐藏日历”按钮。

日期范围从下拉筛选升级为显性范围入口：

- 今日
- 本周
- 未安排
- 全部

“本周”必须是自然周，不是现有“未来 7 天”的改名。实现时应把现有 `seven-days` 语义替换或迁移为 `this-week` 语义：从真实今天所在周的起始日到结束日。不要保留 UI 文案“本周”但底层仍按未来 7 天过滤。

任务库的日期范围锚点必须是运行时真实今天，即 `toIsoDate(new Date())`。不要继续使用 `AppShell selectedDate` 作为任务库日期筛选锚点。`selectedDate` 属于今日执行、报表和部分旧任务控制器语境；任务库的“今日 / 本周”应该稳定指向真实今天和真实本周，否则用户在今日执行中切换日期后，任务库会显示另一天的“今日”，语义错误。

这些入口仍然写入任务筛选 controller，不新增与任务领域无关的页面状态。

日期范围入口可以作为 `TaskFilterBar` 内部的小组件实现，不强制新增顶层 `TaskScopeTabs`。如果提取，必须保持纯展示：输入当前范围，输出新范围，不读取任务数据，不计算日期范围。

### `TaskList`

`TaskList` 移除日历开关透传：

- 删除 `calendarVisible` prop。
- 删除 `onToggleCalendar` prop。
- 不再把日历开关传给 `TaskFilterBar`。

### `TaskListItem`

任务库任务行移除拖拽排期入口：

- 删除拖拽按钮。
- 删除 `writeCalendarDragPayload` 相关调用。
- 删除从 calendar module 引入的拖拽和时间段 helper。

任务库里的任务行只提供管理动作：状态、专注、编辑基础信息、删除。任务排期入口统一走完整日历页的安排任务栏。

### `AppShell`

`AppShell` 负责把任务库导航意图接到完整日历页：

```tsx
<TasksPanel
  controller={tasksPanelController}
  onOpenCalendar={() => setActiveTab('calendar')}
  ...
/>
```

不要把任务库筛选条件传给 `CalendarPanel`。

`AppShell` 也不应再把 `selectedDate` 作为任务库日期筛选锚点传入任务库 controller。任务库 controller 自己持有或计算 `today` 锚点。

## Data Flow

任务库数据流保持现有方向：

```text
AppShell
  -> useTasksPanelController
  -> TasksPanel
  -> TaskCreateForm / TaskFilterBar / TaskList
```

新增导航流：

```text
TasksPanel header
  -> onOpenCalendar
  -> AppShell setActiveTab('calendar')
  -> CalendarPanel mounts with scheduling sidebar open
```

任务库筛选、创建、删除、状态更新和基础信息编辑继续走现有 task actions。任务库不直接依赖 calendar module controller，也不再依赖 calendar drag helpers。

## Interaction Rules

默认范围使用“今日”。这是有意选择：任务库仍保留“全部”入口，但首屏优先让用户快速看到真实今日任务，符合任务库作为日常管理台的使用路径。不要额外引入 localStorage。

快速创建跟随当前范围设置默认值：

- 当前为今日：默认 `plannedDate` 为任务库日期锚点，即真实今天。
- 当前为本周：默认 `plannedDate` 为任务库日期锚点，即真实今天，避免猜测用户想放在本周哪一天。
- 当前为未安排：默认创建未安排任务。
- 当前为全部：沿用现有创建表单默认值。

当前 controller 不会自动根据筛选范围改创建草稿，因此实现时需要显式接入：当用户切换到“未安排”范围时，创建表单默认勾选不安排日期；当用户切回“今日 / 本周 / 全部”时，不强制覆盖用户已经手动修改过的创建表单。

任务库不提供既有任务的快速日期修改。既有任务如果需要改变排期，进入完整日历页处理。具体时间段、全天、多日和拖拽排期全部交给完整日历页。

## Error Handling

- 创建失败：保留表单输入并显示错误提示。
- 删除失败：不乐观删除，显示错误提示。
- 编辑基础信息失败：保留旧任务状态并显示错误提示。
- 打开日历：只做本地 tab 切换，不需要异步错误处理。

## Testing

### Component Tests

`TasksPanel.test.tsx` 覆盖：

- 不再渲染 `EmbeddedCalendarPanel`。
- “去日历安排”按钮调用 `onOpenCalendar`。
- 今日、本周、未安排、全部范围入口能驱动日期范围变更。
- 不再出现“显示日历 / 隐藏日历”按钮。
- 不再出现任务行拖拽按钮。

`TaskFilterBar.test.tsx` 或现有筛选测试覆盖：

- 日期范围入口替代下拉后，筛选语义不变。
- 搜索、分类、状态、标签、优先级筛选继续可用。
- 不再出现“显示日历 / 隐藏日历”按钮。

`TaskList.test.tsx` 或 `TasksPanel.test.tsx` 覆盖：

- `TaskList` 不再接收和透传日历可见状态。
- `TaskListItem` 不再写 calendar drag payload。

### Controller Tests

现有仓库没有 `useTasksPanelController.test.ts` 时，应新增真实 hook 测试，覆盖：

- 今日、自然周、未安排、全部的过滤结果。
- 切换日期范围不清空搜索、分类、状态、标签和优先级筛选。
- 当前范围影响快速创建默认 schedule 的规则。

`useTaskFilterController.test.ts` 或纯函数测试覆盖：

- “本周”按自然周过滤，不按未来 7 天过滤。
- 今日和本周过滤使用真实今天锚点，不跟随 `AppShell selectedDate`。
- 无日期任务不出现在今日或本周范围。
- 未安排范围只包含无 `plannedDate` 的任务。

迁移时必须处理所有仍参与编译或测试的旧筛选实现，例如 `useTaskActions`、`useTasksController` 和 `taskFilters.test.ts` 中的 `seven-days` 语义。如果这些路径已经是死代码，应在实现计划中明确删除或停止测试；如果仍被引用，应同步迁移为自然周语义。

### Regression Tests

必须确认：

- 今日执行不受任务库改动影响。
- 完整日历页继续渲染并保留安排任务栏。
- 日历快速创建、拖拽排期和周视图能力不受影响。
- 任务创建、删除、编辑基础信息仍通过现有 mutation 链路。
- `AppShell` 装配测试覆盖任务库点击“去日历安排”后进入完整日历页。

## Implementation Notes

这个改动本质是职责收缩，不是新增日历功能。实现时应该优先删除冗余连接，再整理任务库入口。

不要把 `EmbeddedCalendarPanel` 删除出 calendar module。它仍可能作为历史能力或未来复用对象存在；本期只从任务库移除使用点。如果最终发现没有任何引用，再单独决定是否清理。

不要让“去日历安排”携带当前筛选条件。筛选同步看似方便，实际会让任务库和日历页互相理解对方的筛选语义，收益不足。

保留标签和优先级筛选不是本期新增需求。它们已经是任务库现有 metadata 筛选能力，本期只要求移除嵌入日历时不要破坏这些筛选。

## Acceptance Criteria

1. 任务库页面不再显示嵌入式日历。
2. 任务库页面不再出现“显示日历 / 隐藏日历”按钮。
3. 用户可以在任务库中切换今日、本周、未安排和全部范围。
4. “本周”按自然周过滤，不是未来 7 天。
5. 用户可以从任务库点击“去日历安排”进入完整日历页，并且安排任务栏默认可见。
6. 任务库仍支持搜索、分类、状态、标签和优先级筛选。
7. 任务库仍支持快速新增、删除和编辑基础任务信息。
8. 任务库不直接引用 `useCalendarController`。
9. 任务库不直接调用排期 API。
10. 任务库任务行不再依赖 calendar drag helper。
11. 完整日历页功能不退化。
12. 今日执行功能不退化。
