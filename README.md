# PlanTode

PlanTode 是一个本地单用户计划管理工具，当前采用 `React + Express + JSON 文件存储`。

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
- `server/storage/`：JSON 文件存储实现
- `src/app/`：前端应用入口与装配
- `src/modules/`：前端业务模块
- `src/shared/`：前端共享请求层与通用能力

## 持久化说明

当前默认持久化方案为 `data/db.json`。重构后业务逻辑通过仓储接口访问数据，不再直接依赖底层 JSON 结构。
