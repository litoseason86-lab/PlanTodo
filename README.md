# PlanTode

PlanTode 是一个本地单用户计划管理工具，当前采用 `React + Express`。

## 开发命令

1. 安装依赖：
   `npm install`
2. 启动开发环境：
   `npm run dev`
3. 运行测试：
   `npm test`
4. 执行类型检查：
   `npm run lint`
5. 构建生产产物：
   `npm run build`

## 当前目录结构

- `shared/`：前后端共享领域模型与基础工具
- `server/app/`：服务装配与启动
- `server/modules/`：后端业务模块
- `server/storage/`：本地存储装配与 JSON/SQLite 存储实现
- `src/app/`：前端应用入口与装配
- `src/modules/`：前端业务模块
- `src/shared/`：前端共享请求层与通用能力

## 持久化说明

SQLite 是事实来源。业务逻辑通过仓储接口访问数据，不直接依赖底层存储结构。

## 存储驱动

默认使用 SQLite 文件存储：

```bash
STORAGE_DRIVER=sqlite
SQLITE_DB_PATH=data/plantode.sqlite
```

JSON 只是辅助，主要用于历史数据迁移、导入导出或本地 fallback 校验。确需调试 JSON 存储时可以显式切换：

```bash
STORAGE_DRIVER=json
JSON_DB_PATH=data/db.json
```

SQLite 使用 `better-sqlite3`，启动时会自动执行 schema migration。JSON 到 SQLite 的历史数据迁移可通过 `scripts/importJsonToSqlite.ts` 独立执行。
