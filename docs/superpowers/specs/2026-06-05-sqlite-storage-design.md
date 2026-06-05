# PlanTode SQLite 双存储设计

## 背景

`PlanTode` 当前已经完成后端分层重构。业务服务依赖各领域的 repository contract，当前落地实现为 `server/storage/json` 下的 JSON 文件存储，默认数据文件为 `data/db.json`。

这说明现在具备切换数据库的基本前提：业务规则不应再直接依赖文件结构或 `fs`。下一步数据库开发应沿着现有边界补充 SQLite 存储实现，而不是重新改造业务服务。

## 目标

本轮目标是新增 SQLite 存储实现，并让运行时可在 JSON 和 SQLite 之间切换。

具体目标：

1. 保留现有 JSON 存储实现。
2. 新增基于 `better-sqlite3` 的 SQLite 存储实现。
3. 通过环境变量选择 `json` 或 `sqlite` 存储驱动。
4. SQLite repository 必须实现现有 repository contracts。
5. 启动时自动执行 SQLite schema migration。
6. 保持前端 API、后端 routes、services 的行为不变。
7. 用测试证明 JSON 与 SQLite 装配和核心仓储行为可用。

## 非目标

以下内容不属于本轮范围：

- 不删除 JSON 存储。
- 不做 JSON 数据到 SQLite 的自动迁移。
- 不引入 ORM。
- 不引入多用户鉴权或账号系统。
- 不改变 API 路由。
- 不改变前端行为。
- 不把 repository/service 接口改成异步。

数据迁移是下一阶段工作。把“接入 SQLite”和“导入历史 JSON 数据”绑在同一轮做，会扩大失败面。

## 技术选型

使用 `better-sqlite3`。

理由：

- 同步 API 和当前 repository/service 结构匹配。
- 本地单用户工具不需要异步数据库驱动带来的复杂性。
- 不引入 ORM，避免用抽象掩盖本项目很小的领域模型。
- 手写 SQL 更直接，迁移和查询行为更容易审查。

不选 `sqlite3`，因为异步 API 会迫使 repository/service 接口整体异步化，牵连过大。

不选 Drizzle/Prisma，因为当前模型简单，ORM 的收益低于引入成本。

## 环境变量

新增配置：

```txt
STORAGE_DRIVER=json
JSON_DB_PATH=data/db.json

STORAGE_DRIVER=sqlite
SQLITE_DB_PATH=data/plantode.sqlite
```

规则：

- 未设置 `STORAGE_DRIVER` 时默认使用 `json`。
- `STORAGE_DRIVER=json` 时读取 `JSON_DB_PATH`，默认 `data/db.json`。
- `STORAGE_DRIVER=sqlite` 时读取 `SQLITE_DB_PATH`，默认 `data/plantode.sqlite`。
- 其他 driver 值启动失败，返回明确错误。

## 目录结构

新增：

```txt
server/storage/createRepositories.ts
server/storage/sqlite/sqliteClient.ts
server/storage/sqlite/migrations.ts
server/storage/sqlite/repositories/categorySqliteRepository.ts
server/storage/sqlite/repositories/taskSqliteRepository.ts
server/storage/sqlite/repositories/focusSessionSqliteRepository.ts
server/storage/sqlite/repositories/reportSqliteRepository.ts
```

修改：

```txt
server/app/registerRoutes.ts
package.json
.env.example
README.md
```

`registerRoutes.ts` 不再直接创建 JSON store 和 JSON repositories。它只调用 repository factory，再装配 services 和 routes。

## 装配设计

新增 `createRepositoriesFromEnv()`，返回统一结构：

```ts
interface AppRepositories {
  categories: CategoryRepository;
  tasks: TaskRepository;
  focusSessions: FocusSessionRepository;
  reports: ReportRepository;
}
```

装配流程：

```txt
registerRoutes
  -> createRepositoriesFromEnv
    -> json repositories 或 sqlite repositories
  -> services
  -> routes
```

这样 routes 和 services 不知道当前使用哪种存储。

## SQLite Client

`sqliteClient.ts` 负责：

- 创建数据库目录。
- 打开 SQLite 文件。
- 设置 `PRAGMA foreign_keys = ON`。
- 执行 migrations。
- 暴露 `Database` 实例给 SQLite repositories。

SQLite 连接只应在 storage 层内部传播。业务 service 不接触数据库连接。

## Migration 设计

`migrations.ts` 使用手写 migration。

规则：

1. 创建 `schema_migrations` 表。
2. 查询已执行 migration。
3. 按版本顺序执行未执行 migration。
4. 每条 migration 在事务内执行。
5. migration 执行成功后记录版本号和执行时间。

初始 migration 创建以下表：

- `users`
- `categories`
- `tasks`
- `task_execution_sessions`
- `daily_reports`
- `weekly_reviews`
- `schema_migrations`

状态字段使用字符串，不单独拆 enum 表。

当前系统仍使用固定 `DEMO_USER_ID = 1`。SQLite 开启外键后，migration 必须插入默认用户：

```txt
id: 1
username: demo
display_name: Demo User
```

这不是新增账号系统，只是让现有固定用户上下文在关系模型中成立。

## 表结构

### `users`

- `id integer primary key`
- `username text not null`
- `display_name text not null`
- `created_at text not null`

### `categories`

- `id integer primary key`
- `user_id integer not null`
- `name text not null`
- `color text not null`
- `sort_order integer not null`
- `created_at text not null`
- `updated_at text not null`
- `foreign key (user_id) references users(id)`

分类名称冲突继续由 `CategoriesService` 按当前规则校验。SQLite 不增加分类名唯一约束，避免数据库约束和现有 service 错误消息产生双重规则。

### `tasks`

- `id integer primary key`
- `user_id integer not null`
- `category_id integer not null`
- `title text not null`
- `planned_date text not null`
- `status text not null`
- `created_at text not null`
- `updated_at text not null`
- `foreign key (user_id) references users(id)`
- `foreign key (category_id) references categories(id)`

索引：

- `(user_id, planned_date)`
- `(user_id, status)`
- `(user_id, category_id)`

### `task_execution_sessions`

- `id integer primary key`
- `task_id integer not null`
- `user_id integer not null`
- `started_at text not null`
- `ended_at text`
- `duration_seconds integer`
- `status text not null`
- `created_at text not null`
- `task_title text`
- `foreign key (task_id) references tasks(id)`
- `foreign key (user_id) references users(id)`

索引：

- `(user_id, status)`
- `(user_id, started_at)`
- `(task_id)`

### `daily_reports`

- `id integer primary key`
- `user_id integer not null`
- `report_date text not null`
- `content text not null`
- `generator_type text not null`
- `created_at text not null`
- `updated_at text not null`
- `foreign key (user_id) references users(id)`
- `unique(user_id, report_date)`

### `weekly_reviews`

- `id integer primary key`
- `user_id integer not null`
- `week_start_date text not null`
- `week_end_date text not null`
- `content text not null`
- `generator_type text not null`
- `created_at text not null`
- `updated_at text not null`
- `foreign key (user_id) references users(id)`
- `unique(user_id, week_start_date)`

## Repository 实现约束

SQLite repositories 必须实现现有 contracts：

- `CategoryRepository`
- `TaskRepository`
- `FocusSessionRepository`
- `ReportRepository`

转换规则：

- 数据库列使用 snake_case。
- 领域对象继续使用 camelCase。
- 时间字段继续使用 ISO string。
- 状态字段继续使用现有字符串 union。
- repository 内部负责 row 和 domain entity 的映射。

禁止：

- service 拼 SQL。
- route 读数据库连接。
- SQLite repository 修改业务规则。
- 为 SQLite 单独改变 API 返回结构。

## 测试策略

新增测试：

1. migration 能创建完整 schema。
2. `CategorySqliteRepository` 支持创建、列表、更新、删除、名称查询。
3. `TaskSqliteRepository` 支持创建、筛选、状态更新、按用户和 ID 查询。
4. `FocusSessionSqliteRepository` 支持运行中 session 查询、创建、结束、按日期范围查询。
5. `ReportSqliteRepository` 支持日报和周报 upsert/get。
6. `createRepositoriesFromEnv()` 能按 `STORAGE_DRIVER` 装配 JSON 或 SQLite。

测试使用临时 SQLite 文件，不写入项目 `data/`。

保留现有 JSON repository 测试。双存储并存不是口号，必须有测试证明两条路径都能工作。

## 验证命令

实施完成后必须通过：

```bash
npm run lint
npm test
npm run build
```

另外需要用 SQLite driver 启动一次服务并访问基础 API：

```bash
STORAGE_DRIVER=sqlite SQLITE_DB_PATH=data/test-plantode.sqlite npm run dev
```

至少验证：

- `GET /api/categories`
- `GET /api/tasks`
- `GET /api/task-sessions/running`

## 风险

主要风险不在 SQL，而在行为一致性。

JSON 存储是数组模型，SQLite 是关系模型。若 repository 查询和映射不严格对齐，就会出现“测试通过但界面数据口径变了”的问题。因此本轮必须优先测 repository 行为，而不是只测 migration 建表。

另一个风险是启动时 migration 失败。SQLite client 应该让启动失败暴露为明确错误，而不是静默回退 JSON。静默回退会掩盖配置错误。

## 后续工作

本轮完成后，下一阶段可做 JSON 到 SQLite 的导入工具：

```txt
npm run db:migrate-json -- --from data/db.json --to data/plantode.sqlite
```

该工具不属于本轮范围。
