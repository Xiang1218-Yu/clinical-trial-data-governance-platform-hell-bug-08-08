# 临床研究数据治理与药物安全信号分析平台

这是一个纯后端 Node.js + TypeScript 业务基线，面向药企、CRO 和研究中心管理多研究项目临床数据。系统覆盖研究项目、研究中心、受试者访视、不良事件、医学审核、数据质疑、安全信号分析和脱敏数据导出等核心领域，采用 REST API 暴露业务能力，当前使用内存数据仓库，后续可替换为 PostgreSQL、Redis、消息队列和对象存储。

## 已实现

- 研究项目与研究中心查询
- 受试者访视完成率与数据质量指标
- 不良事件登记、筛选和医学状态流转
- 数据质疑与严重事件统计
- 安全信号趋势摘要
- SDTM、Safety、Raw 导出任务创建与进度查询
- 导出任务异步状态推进
- 统一健康检查接口

## 启动

```bash
npm install
npm run dev
```

API 默认地址：`http://localhost:4000`

## 校验

```bash
npm run typecheck
npm run build
```

## 目录

- `apps/api/src/domain.ts`：领域类型
- `apps/api/src/store.ts`：演示数据仓库
- `apps/api/src/services.ts`：研究、事件和导出领域服务
- `apps/api/src/server.ts`：Fastify HTTP API
