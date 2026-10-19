# 高新技术企业认定评分测算系统 —— 技术研发方案 v1.0

> 承接角色：全栈研发师（fullstack-engineer）｜全栈智造专家团 Phase 1
> 上游输入（已定稿，本方案不得与冲突口径相悖）：
> ① `phase1-需求与平台选型报告.md`（选品洞察师）｜② `phase1-产品定义方案-PRD.md`（产品主理人，含附录 A/B 团长裁决）
> 政策基线事实来源：《高新技术企业认定管理办法》（国科发火〔2016〕32号）+《高新技术企业认定管理工作指引》（国科发火〔2016〕195号）+ 团长 Appendix A/B 裁决
> 形态：**PC Web 响应式单端 + Web 管理后台**（不做 App / 小程序 / 鸿蒙 / 桌面端）｜工期 **6~9 周 / 62~72 人日**｜ICP 备案并行且为关键路径

---

## 0. 摘要与硬约束落实对照

### 0.1 一句话技术结论

**采用「单一 TypeScript 模块化单体」：Next.js 14(App Router, SSR/ISR) + Nest-free 的 Route Handlers 同进程 API + Prisma + MySQL 8 + Redis 7(可降级) + 腾讯云 COS，规则引擎为 `packages/rule-engine` 内零 IO 的纯函数包并被浏览器与服务端**同一份产物**复用**——一套语言、一个仓库、一个进程、一台 2C4G 云主机即可完整部署，6~9 周可交付，且规则口径热修（改配置不发版）与 SSR/SEO（主流量来自搜索）两项关键诉求同时满足。

### 0.2 团长 4 项实现硬约束的落实位置（自检用）

| 约束 | 本方案落实点 | 落地方式 |
|------|--------------|----------|
| **C-1** 成长性三态 `biz_years ∈ {1,2,3}`，**禁止 `full_three_years: bool`** | §3.5.2 伪代码 `growthRate()`、§3.6 单测矩阵、§4.3.2 `enterprises.biz_years` 与 §4.3.3 `fiscal_years.seq`（CHECK `IN (1,2,3)`）、§5 API `PUT /fiscal-years` 入参 zod 枚举 | 所有分支全部实现；16 组财务单测（8 场景 × 2 指标）在 §3.6 逐组给出期望值，进入 CI 门禁 |
| **C-2** 知识产权数量档位 + Ⅱ类"仅限使用一次" | §3.5.1 伪代码 `ipQuantityBand()`、§3.2 规则包 `IP_COUNT`、§4.3.4 `ip_assets.used_in_assessment` + `used_refer_assessment_id` + `exclusive_use_by_us` 标记 | 计数前过滤：有效授权 ∩ 境内 ∩ 有效保护期内 ∩ 权属唯一使用方 ∩（Ⅱ类且 `used_in_assessment=0`，仅复审/重新认定时启用剔除） |
| **C-3** 研发费用占比三档以"最近一年销售收入"为分档基准，分母为近三年合计 + 境内 ≥60% | §3.5.3 `rdExpenseRule()`、§3.4 `precheck.C5/C6`、§5 `GET /precheck` 返回 `ratio_detail`（基准值/阈值/实际值/境内占比四元） | 入参名强制 `lastYearRevenue`（禁止 `revenue`），UI 分两行明示"分母口径"与"分档基准" |
| **C-4** V1.0 免登录（无注册/登录/找回/注销页、无短信通道）；方案保存＝本地存储 + 服务端 30 天短链快照（不含明文敏感）；`users` 表预留至 V1.1 | §0.3 负面清单、§2.3 模块 M1、§4.3.1 `users`（V1.0 **不落业务数据**，仅建表预留）、§4.3.9 `snapshots`（令牌派生密钥 AES-256-GCM 密文快照）、§5 鉴权设计、§8 个人信息保护 | 全站无 `/login /register /forgot /logout` 路由；唯一服务端写路径为"生成短链"，快照 payload 永不明文 |

### 0.3 V1.0 明确不做的工程项（防范围蠕变，与 C-4 一致）

不建：注册/登录/找回密码/注销页面与接口、短信/邮件验证码通道、`users` 表业务写入、第三方木块 OAuth、独立后端服务（微服务）、消息队列中间件（Kafka/RabbitMQ）、多级缓存、读写分离、Kubernetes、Docker Swarm、Elasticsearch、GraphQL、小程序/App/鸿蒙工程、大模型调用、 WYSIWYG 富文本编辑器、实时协作（WebSocket）。

---

## 1. 技术选型结论表

### 1.1 逐项比较（严格按参考文件 `tech-stack-architecture.md` 第一~三章对比表执行）

**前端框架（参考文件 §1.1）**：本产品**主流量来自搜索引擎**（选型报告 §1.3/§3.6，PRD 补丁 P-13 明确"内容页须 SSR/静态生成"）→ 候选收敛到 SSR 方案。

| 候选 | 参考文件适用栏 | 本项目结论 |
|------|----------------|-----------|
| 纯静态站（Hugo/Vite+CDN） | 无后端交互 | ❌ 需规则引擎交互与短链，不适用 |
| Vue 3 + Element Plus（SPA/ Nuxt SSR） | 上手快、中文生态好、后台模板丰富 | ⚠️ 备选（见下） |
| **React + Ant Design 5 + Next.js 14 SSR** | 生态最大、组件全；Next.js 栏＝"SEO 友好、内容站/关键词流量" | ✅ **主选** |
| —— | 心智负担略高 | 由"规则引擎前后端同源复用"抵消（见 1.2 理由 3） |

选 **Next.js + AntD** 而非 **Nuxt + Element Plus** 的决定性理由（唯一理由即可定案）：**规则引擎必须与服务端共用同一份 TS 产物**（见下方理由 3），而本项目 Rulepack 采用 TS-first 的 zod schema 校验链路；React/Next 的 RSC 与客户端组件边界 + 纯函数包同构工作流更成熟，且 `@ant-design/nextjs-registry` 已原生支持 App Router SSR 样式抽取，无 FOUC。**若团队现有技能栈为 Vue（仅需 1 人日切换成本差异），可整体替换为 Nuxt 3.11 + Element Plus 2.7 + Naive UI 兜底组件，规则引擎包 `@hitech/rule-engine` 完全复用、零改动** —— 这是本架构刻意保留的"框架可替换性"（见 §9.1 目录结构中 `packages/` 与 `apps/` 的边界约束）。

**后端语言（参考文件 §1.3）**：

| 候选 | 结论 | 理由 |
|------|------|------|
| Python(FastAPI) | ⚠️ 备选（仅作离线交叉校验工具链，非运行时） | 选型报告 §4.1.3 用 Python 给出过逻辑示例；但正式运行时引入第二种语言会导致**规则双实现漂移**（最容易出错的地方正是规则），故**仅保留为"独立实现的离线体检脚本"**（§9.4），不作为线上依赖 |
| Java(Spring Boot) | ❌ | 重量级、62~72 人日预算内启动成本过高（参考文件同栏） |
| Go(Gin) | ❌ | 团队无 Go 技能假设，且规则引擎可被前端复用 |
| PHP(Laravel) | ❌ | 仅适用"用户只会 PHP"的存量场景（参考文件同栏），不适用 |
| **Node.js 20 (TS, 同进程 API)** | ✅ **主选** | 与前端同构、全栈一人可 cover（参考文件同栏）；规则引擎浏览器/服务端同源复用 |

**数据库（参考文件 §1.4）**：MySQL 8 = "90% 业务系统的默认选择"，国内云托管成熟、备份/IAM 生态齐全 → **主选**；PostgreSQL 备选（JSONB 更强但国内托管与团队熟悉度弱）；SQLite **明令禁止**（参考文件：多用户 Web 生产禁用）。

**架构模式（参考文件 §2）**：判据"MVP、小团队、日活万级以内 → 默认起点，能单体就单体"；本项目首年预期日活百级~千级、单一 Git 仓库、1~2 名研发 → **模块化单体（Modular Monolith）**，明确禁止 MVP 直接上微服务。演进路径预留：**规则引擎包独立 → 若导出任务成为瓶颈，将 `report-export` 拆为独立 Worker 进程**（§7.3 触发条件）。

### 1.2 选型总表（唯一选型 + 版本 + 理由 + 备选）

| 层/域 | **选定方案（唯一）** | 版本 | 理由（一句话 + 约束匹配） | 备选（切换条件） |
|-------|----------------------|------|---------------------------|------------------|
| 前端框架 | **Next.js（App Router）+ React + TypeScript** | next `14.2.x` / react `18.3.x` / TS `5.4.x` | SEO 是主流量来源（选型报告 §1.3）→ 必须 SSR/ISR；TS 严格模式保障规则引擎类型安全 | Nuxt 3.11 + Vue 3.4（团队为 Vue 技能栈时整体替换，`packages/rule-engine` 不改） |
| UI 组件库 | **Ant Design 5 + `@ant-design/nextjs-registry`** | antd `5.20.x` | 中文生态第一梯队，Table/Form/Descriptions 直接支撑知识产权台账、组织管理自评、后台列表；SSR 样式零闪烁 | Element Plus 2.7（随 Nuxt 一起切换）/ Naive UI（包更小、缺少企业级 Table） |
| 图表 | **Apache ECharts 5（按需引入 radar + bar）** | echarts `5.5.x` | 雷达图 + 分数条中文文档完善，按需打包后 gzip ≈ 90 KB | Recharts（更轻但雷达图可定制性弱、中文文档少） |
| 状态/表单 | **Zustand（草稿原子状态）+ AntD Form + zod** | zustand `4.5.x` / zod `3.23.x` | 表单重、且要求 ≤800ms 实时算分，需轻量响应式订阅；zod schema 前后端共用同一份入参校验 | Redux Toolkit（体量大、本项目无复杂全局态需求） |
| 本地草稿存储 | **IndexedDB（localForage）+ localStorage 降级** | localforage `1.10.x` | C-4 免登录下的唯一草稿载体；IndexedDB 容量 ≥50MB 足够放 30 条台账；隐私/无痕模式降级到 localStorage | 纯 localStorage（容量 5MB 可能放不下台账+证据备注） |
| 后端运行时/框架 | **Node.js + Next.js Route Handlers（同进程模块化单体）** | Node `20.11.x LTS` | 单进程 = 单部署单元 = 最低运维；一人全栈可 cover；规则引擎与前端同源复用 | NestJS 10（Fastify adapter）：团队 >2 人或需独立伸缩时切换，进程数 +1 |
| ORM / 迁移 | **Prisma ORM + prisma migrate** | prisma `5.16.x` | TS 类型贯穿到 SQL，8 周内表结构变更频繁，迁移可回滚 | Drizzle ORM（更轻但生态与 admin 工具链弱）/ TypeORM（装饰器维护活跃度低） |
| 数据库 | **MySQL（InnoDB, utf8mb4_0900_ai_ci）** | `8.0.36` | 参考文件默认选择；国内云托管/备份成熟；金额用 DECIMAL | PostgreSQL 16（若未来规则包重度依赖 JSONB 检索） |
| 缓存 / 限流 / 异步任务 | **Redis（单实例，`CACHE_POLICY=volatile-lru`，无持久化）** | `7.2.5` | 三件事：①Rulepack 编译结果缓存 ②接口幂等键与限流计数 ③PDF 导出有界队列；单实例无主从，宕机可丢 | 进程内 Map 降级：`REDIS_URL` 为空时自动退化为内存实现（V1.0 单实例场景等价） |
| 对象存储 | **腾讯云 COS（私有桶 + CDN 回源 + 生命周期 30 天自动删除）** | SDK `cos-nodejs-sdk-v5 2.13.x` | PDF/Excel 产物归档与短链直下，10~50 元/月（与选型报告 §4.2 同量级）；免运维、天然防盗链 | 阿里云 OSS（同规格）；本地卷 + Nginx 静态目录（备案/预算未定时临时降级，多实例即失效） |
| 金额与数值精度 | **内存中 `number` 计算 + 比较统一在整数"元"上做；落库一律 DECIMAL(18,2)，增长率 DECIMAL(10,6)** | — | 参考文件 §3 第 4 条：金额禁浮点存钱；全系统单位统一为**元**（UI 显示为万元），比率比较前先放大到整数分位避免 IEEE754 误差 | decimal.js（仅当出现分账/开票需求时引入） |
| 报表导出 · PDF | **Playwright（headless Chromium）打印 SSR 专用打印路由** | playwright `1.44.x` / chromium `124` | 中文 A4 排版保真度最高，`@page`/页眉页脚/分页控制完备；渲染路由与页面共用 CSS，维护一份样式 | wkhtmltopdf（中文字体与 Flex 支持差、已停更）；浏览器 `window.print()`（作为降级通道保留，非主路径） |
| 报表导出 · Excel | **ExcelJS（流式写出 xlsx）** | exceljs `4.4.x` | 支持列宽/冻结/单元格样式/多 Sheet，MIT 许可；SheetJS 社区版无样式 | SheetJS（体积更小但社区版不支持单元格样式） |
| PDF 中文字体 | **思源黑体 Source Han Sans SC（SIL OFL）子集化 WOFF2** | 子集工具 `fonttools 4.51`（pyftsubset） | 全量 Noto Sans SC ≈10MB，必须子集至 ≤1.2MB 再 base64 嵌入；OFL 许可允许嵌入与再分发 | 方正/思源其他字重付费字体（无商业必要性，不选） |
| 部署 | **单台云服务器（腾讯云/阿里云 2 vCPU 4GB）+ Docker Compose + Nginx + certbot** | Docker `24.x` / Compose `2.24.x` / Nginx `1.25.x` | ICP 备案要求大陆云资源 → 必须自托管；单进程/单库/单 Redis 共机部署，200~600 元/月（与选型报告 §4.2 一致） | Vercel/Netlify（**不可用于生产**：备案需大陆云 + headless Chromium 需自管；仅可作预览环境） |
| CI/CD | **GitHub Actions + Docker 镜像 + compose pull & up** | actions runner ubuntu-22.04 | 零成本；镜像即版本，回滚＝切 tag | Jenkins / 云效流水线（团队已有内网构建资源时） |
| 监控/日志/错误追踪 | **pino 结构化日志 + Sentry SaaS + Uptime Kuma（Docker 同机探活）** | pino `9.x` / `@sentry/nextjs 8.x` / uptime-kuma `1.23.x` | 零运维；错误聚合对"规则引擎边界异常"的发现最关键；探活 1 分钟粒度 | 阿里云 SLS / 腾讯云 CLS（客户要求数据不出境时切换）；Prometheus+Grafana（**V1.1 以后**且实例 ≥3 台才有必要） |
| 埋点与分析 | **自建埋点表 `events` + 服务端直采，不引第三方统计脚本** | — | PRD §8.3/§10.3：严禁第三方脚本接触填报数据；搜索引擎 `utm` + 首屏 referrer 仅在客户端归纳后上报（截断 UA/IP 哈希） | 友盟/GA（会把填报页 URL 与行为数据出境，**违反 §10.3 与最小必要**，明确不用） |
| 政策内容库 | **DB 表 `policy_refs` + MDX 文件双写（构建期同步）** | next-mdx-remote `5.x` | SEO 内容页需 SSR 静态词条；后台可检索单条政策原文 | Headless CMS（增加系统复杂度，MVP 不需要） |
| 后台鉴权 | **独立 `/admin` 路由组 + 会话 Cookie + TOTP 二次因子 + IP 白名单** | otplib `12.x` | 选型报告 §5.3 要求"后台管理员强制 MFA"；独立路由组避免与游客态混淆 | 接入企业微信扫码登录（V1.1，需企业内部应用资质） |

### 1.3 版本约定（写进 `package.json` engines 与 `.nvmrc`，CI 强校验）

```
Node.js  20.11.1 (LTS "Iron")           # 运行时唯一要求；CI/生产同版本
pnpm     9.7.1                           # 包管理器（workspace: true）
TypeScript 5.4.5  strict: true, noUncheckedIndexedAccess: true
python3  3.11.9 (可选)                   # 仅用于 tools/rule-audit 离线交叉校验与字体子集化，生产镜像不含
MySQL    8.0.36                          # 最低 8.0.28（需 CHECK 约束与 JSON_TABLE）
Redis    7.2.5 (可缺省)                  # REDIS_URL 为空 → 降级进程内实现
Chromium 124.x (playwright 自带)         # PDF 渲染；镜像构建期下载，禁止运行时下载
```

---

## 2. 系统架构

### 2.1 分层架构图（Modular Monolith）

```
┌────────────────────────────────── 浏览器端 (Browser) ──────────────────────────────────┐
│  ① 呈现层  Next.js App Router SSR/ISR 页面                                             │
│     ├ (marketing)  P-00 落地页 / P-12 政策依据 / P-13 FAQ   ← SSR+ISR，承接 SEO 主流量  │
│     ├ (assess)     P-03 建档 / P-04 预检 / P-05 工作台 a~d / P-06 结果 / P-07 诊断      │
│     ├ (share)      /s#<token>  只读快照回看（令牌走 hash，不落 URL 路径与服务端日志）   │
│     └ (admin)      P-15a~d 管理后台（规则/条款/查询/看板），独立布局 + 独立鉴权中间件   │
│  ② 交互层  antd 5 + ECharts + Zustand + AntD Form + zod                                │
│  ③ 计算层  @hitech/rule-engine (WASM-free 纯 TS 包，浏览器内实时算分，≤800ms 反馈)      │
│  ④ 本地持久层 IndexedDB(localForage) 草稿自动保存（800ms 防抖）                        │
└────────────────────────────── HTTPS(JSON) ─────────────────────────────────────────────┘
                                            │  X-Guest-Token (HttpOnly SameSite=Lax Cookie)
                                            ▼
┌──────────────── Nginx 1.25（TLS1.2+ 终结 / HSTS / gzip+br / 静态资源 / IP 限流 / Referrer-Policy）
└────────────────────────────────────────────────────────────────────────────────────────┘
                                            ▼
┌────────────── 单一 Node 20 进程（apps/web，Docker 镜像）──────────────────────────────┐
│  ⑤ 接口层    app/api/v1/**/route.ts     ← zod 校验 → 统一 {code,message,data,request_id}│
│  ⑥ 应用层    src/server/modules/* 用例服务（事务边界、权限、幂等、审计、编排）         │
│  ⑦ 领域层    packages/rule-engine  ← 唯一评分事实来源，**零 IO、零框架依赖、纯函数**    │
│  ⑧ 数据层    Prisma → MySQL8 ｜ Redis7（可降级）｜ COS SDK ｜ Playwright(子进程)       │
│  ⑨ 横切层    logging(pino) / errors / auth-guard / rate-limit / audit / telemetry      │
└───────────────────────────────────────────────────────────────────────────────────────┘
        │                │                  │                   │
        ▼                ▼                  ▼                   ▼
   MySQL 8.0         Redis 7.2         腾讯云 COS          Chromium(Playwright)
   (主数据/快照)     (规则缓存/限流/队列) (PDF/XLSX 产物 30 天生命周期)  (同容器子进程，并发≤2)
```

**依赖方向（红线，禁止反向依赖）**：
`呈现/交互 → 接口层 → 应用层 → 领域层(rule-engine)`。`rule-engine` **不得** import 任何 Prisma/HTTP/Date.now()/随机源；时间必须从入参传入（保证可复算）。CI 用 `eslint-plugin-boundaries` + `depcruise` 做依赖方向门禁，**`packages/rule-engine` 的 package.json 依赖数必须为 1（仅 zod），否则 CI 失败**。

### 2.2 模块划分（10 个业务模块 + 3 个横切）

| 编号 | 模块 | 职责 | 关键出口 | 依赖 |
|------|------|------|----------|------|
| M1 | **游客会话与短链** `guest-session` | 免登录会话发放（`guest_token` 30 天）、短链创建/解析/撤销、本地草稿与服务端快照同步 | `POST /sessions`、`POST /snapshots`、`GET /snapshots/resolve` | 无（基础设施层） |
| M2 | **资格预检** `precheck` | 8 项一票否决判定（C1~C8），输出通过/不通过/数据不足三态，附政策依据与补救路径 | `POST /enterprises/{id}/precheck` | M3/M4/M6 只读、rule-engine |
| M3 | **知识产权台账** `ip-ledger` | ip 资产 CRUD/批量导入导出、`used_in_assessment`(Ⅱ类去重)、有效性校验、计数统计 | `/enterprises/{id}/ip-assets/**` | 无 |
| M4 | **成果转化台账** `conversion-ledger` | 转化记录 CRUD、`dedup_key` 同成果只计一项、三年窗口过滤、年均计数 | `/enterprises/{id}/tech-achievements/**` | 无 |
| M5 | **组织管理自评** `mgmt-selfcheck` | 4 大项 11 子项勾选（产品口径）、按 6/6/4/4 上限截断 | `GET/PUT /rd-management-selfcheck` | 无 |
| M6 | **财务与成长性** `finance-growth` | 近三年/两年/一年财务原始录入与**加密存取**、`biz_years` 三态治理、成长性增长率计算与分档 | `PUT /fiscal-years` | 无 |
| M7 | **评分规则引擎** `rule-engine`★ | Rulepack 编译与加载；输入校验 → 预检 → 分项打分 → 指标级 cap → 汇总 → 达标判定 → 差距诊断；**唯一算术事实来源** | `packages/rule-engine`；`POST /assessments/calculate` | 无 |
| M8 | **报告生成与导出** `report-export` | snapshot 渲染、A4 PDF（Playwright）、Excel（ExcelJS）、有界并发队列、产物 COS 归档与短链下载 | `POST /reports/export`、`GET /reports/{id}/download` | M7（只读其输出） |
| M9 | **政策内容库** `policy-content` | `policy_versions`/`policy_refs`/建议模板/免责文案的版本、发布、冲突检测、回滚 | `GET /policy/**`、`/admin/v1/policy-versions/**` | 无 |
| M10 | **管理后台** `admin` | 规则包可视化发布（二次确认 + diff + 回归门禁）、查询导出 CSV、看板、审计日志 | `/admin/v1/**` | M7/M9 |
| X1 | 横切 `logging` | pino JSON 日志、request_id 全链路、字段脱敏 hook | — | 无 |
| X2 | 横切 `authn-guard` | 游客令牌校验与资源归属、后台会话 + TOTP + IP 白名单 | — | 无 |
| X3 | 横切 `audit` | 后台与敏感操作留痕，≥180 天 | — | 无 |

**无循环依赖证明**：所有业务模块只依赖 `rule-engine`（L0）与基础设施；`rule-engine` 依赖集为空；M9/M10 通过接口层调用 M7，不经应用层的反向 import。

### 2.3 一次打分请求的处理链路（时序）

场景：用户在 P-05d 修改"第三年净资产"→ 右栏分数面板刷新（本地即时）→ 点"保存并查看结果"（服务端权威计算）

```
Browser                          Nginx                Node 单进程 app                      Infra
  │                                │                        │                                │
  │① 输入 change（防抖 300ms，仅本地）                                                  │
  │──── draft 写入 IndexedDB ────────────────────────────▶│ 本地规则引擎 evaluate()      │
  │◀──── 返回结果 {low:62, high:78, items[]}（<15ms）─────│                              │
  │      分数条 + 雷达图重绘（目标 输入→重绘 ≤800ms）                                     │
  │                                │                        │                                │
  │ ② POST /api/v1/assessments/calculate  Idempotency-Key: k│                                │
  │───────────────────────────────▶│───────────────────────▶│ ⑤ 接口层                       │
  │                                │                        │  a. guest_token 校验 → X2      │
  │                                │                        │  b. zod 解析 + 业务格式校验    │
  │                                │                        │  c. Redis 幂等键查 k → miss    │
  │                                │                        │  d. 限流 30/min/guest          │
  │                                │                        │ ⑥ 应用层 AssessmentService     │
  │                                │                        │  e. 装配 AssessmentInput DTO   │
  │                                │                        │     (M3/M4/M5/M6 只读聚合)     │
  │                                │                        │  f. rulepack = PolicyRepo      │
  │                                │                        │     .load(version)  ← Redis/内存│──▶ MySQL 读     │
  │                                │                        │  g. engine.evaluate(input,rp)  │
  │                                │                        │     ①validate ②precheck ③items │
  │                                │                        │     ④cap ⑤aggregate ⑥verdict   │
  │                                │                        │     ⑦diagnose(反事实模拟)      │
  │                                │                        │  h. 事务写 assessments +        │
  │                                │                        │     assessment_items(快照)      │──▶ MySQL 写     │
  │                                │                        │  i. Redis 存幂等结果 TTL 24h   │──▶ Redis        │
  │◀──────── 200 {code:0,data:{...}} ═══════════════════════│                                │
  │   含 items[].{score_min,score_max,formula,policy_ref}    │                                │
  │    + verdict(三态) + diagnosis[].{action,delta,materials}│                                │
  │                                │                        │                                │
  │③ 结果页渲染要点：服务端算分与本地算分必须逐项一致；若不一致 → 结果页顶部黄色"规则版本差异"横幅│
  │④ 后续：POST /reports/export → 202 {task_id} → 轮询 GET /reports/{id}（0.5s×N）→ 取下载直链   │
```

**性能预算（本次链路）**：`engine.evaluate` 纯计算 ≤5ms（含 16 项反事实诊断模拟 ≤25ms）；整链路服务端 P95 ≤150ms（目标 ≤500ms 基线的 1/3 余量）。

### 2.4 部署形态

- **单机 Docker Compose**：`nginx` :80/443 → `app`(Next standalone, 1 实例, `--max-old-space-size=1536`) → `mysql` / `redis` / `uptime-kuma`；Playwright Chromium 预置于 app 镜像内（禁止运行时下载）。
- **可用性与单机风险**：单机 ≠ 无高可用手段 —— 采用 ①云盘快照日备 + mysqldump 加密上传 COS ②镜像版本化，故障重建 RTO ≤4h ③健康检查失败自动重启（`restart: unless-stopped`）④Uptime Kuma 1 分钟探活 + Sentry 告警。SLO 目标 **月度 ≥99.5%**（参考文件 §7）。
- **扩容路径（V1.1+，非本期）**：app 水平扩到 2 实例 → 引入 Redis 共享态 → Playwright 拆独立 Worker → MySQL 升托管版（主从）。

---

## 3. 评分规则引擎设计（核心）

> 定位：参考文件 §10 / 选型报告 §4.1.2 / PRD F-11 三处口径一致 —— **规则数据化 + 规则版本化 + 双档输出 + 计算过程可解释**。
> 工程红线：`packages/rule-engine` 是**纯函数包**：输入 `(AssessmentInput, RulePack, EvalContext)` → 输出 `AssessmentResult`，**无 IO、无 `new Date()`、无 `Math.random()`、无全局状态**，保证同输入必同输出（可复算）。

### 3.1 四条设计原则与硬约束的映射

| 原则 | 工程落实 | 对应硬约束 |
|------|----------|-----------|
| ① 规则数据化 | 阈值/区间/上限/边界开关全部在 Rulepack（YAML→DB），改政策改配置不改代码 | C-2、C-3 |
| ② 规则版本化 + 快照可复算 | 每次计算记录 `policy_version` + `rulepack_sha256` + 输入快照；历史报告按原版本重放 | C-1（口径变更可追溯） |
| ③ 双档输出 | 每个评分项返回 `[score_min, score_max]`；保守/乐观分别汇总 | 基线 B15 / PRD 7.1 |
| ④ 计算过程可解释 | 每个评分项返回 `formula`、`inputs`、`band`、`policy_ref`、`note`（财务人员可核对） | PRD F-12 / P-07 |
| ⑤ 三态而非布尔 | `biz_years ∈ {1,2,3}` 枚举（zod `z.union([z.literal(1),z.literal(2),z.literal(3)])`） | **C-1** |
| ⑥ 精确比较 | 增长率用 **BigInt 有理数**比较，杜绝 IEEE754 在 35%/25%/15%/5% 边界的误判 | C-1 边界分支的正确性 |

### 3.2 规则配置数据结构（Rulepack）

存储形态：**后台可视化编辑 → 落库 `policy_rules` 行 → 发布时编译成一条 `policy_versions.rulepack_json`（完整快照，含 sha256）**；仓库 `policy/*.yaml` 为种子基线，**YAML 与 DB 以 `policy_version` 为准双向可同步**（CI 校验二者 sha256 一致）。

```yaml
# policy/rulepack.national-2016.yaml
policy_version: "2026.10-national-2016"        # 语义化版本号：年.月-地区-政策批次
display_name: "国家基线（32号文 + 195号文）"
region_code: "CN"                              # 预留 V2.0 地区规则包；V1.0 恒为 CN
status: published                              # draft | published | archived
effective_date: "2016-01-01"
expire_date: null
checksum_sha256: "auto"                        # 发布时计算，用于可复算与回滚校验
doc_refs:                                      # 政策溯源锚点（全站 + 报告统一引用）
  METHOD: { doc_name: "高新技术企业认定管理办法", doc_no: "国科发火〔2016〕32号" }
  GUIDE:  { doc_name: "高新技术企业认定管理工作指引", doc_no: "国科发火〔2016〕195号" }

# ---------- 达标判定 ----------
verdict:
  threshold: 70                # 政策：综合得分须 > 70 分（不含 70）
  integer_scoring: true        # 各级指标按整数打分 → 等价判定：total >= 71
  basis: "conservative"        # 达标判定一律以保守总分为准（乐观总分仅作冲刺目标）

# ---------- 资格预检（8 项一票否决） ----------
precheck:
  C1_min_establish_days: 365                   # 注册成立一年以上
  C2_require_core_ip: true                     # 需 ≥1 项有效可用知识产权（Ⅰ类 或 未使用过的Ⅱ类）
  C3_require_hitech_field: true                # 主要产品属《国家重点支持的高新技术领域》
  C4_min_tech_staff_ratio: 0.10                # 科技人员 / 当年职工总数 ≥ 10%
  C5_rd_ratio:                                 # 研发费用占比：分母＝近三个会计年度合计
    basis: "last_year_revenue"                 # C-3：分档阈值基准＝最近一年销售收入（严禁按三年合计分档）
    tiers:                                     # 单位：元，含边界（<= 取本档）
      - { max_revenue:   50000000, required: 0.05 }   # < 5000 万（含）→ 5%
      - { max_revenue:  200000000, required: 0.04 }   # 5000 万 ~ 2 亿（含）→ 4%
      - { max_revenue:        null, required: 0.03 }  # > 2 亿 → 3%
  C6_min_domestic_rd_ratio: 0.60               # 境内研发费用 / 研发费用总额 ≥ 60%
  C7_min_hitech_revenue_ratio: 0.60            # 高新收入 / 申报前一年总收入 ≥ 60%
  C8_no_major_accident: true                   # 前一年无重大安全/质量事故或严重环境违法
  insufficient_policy: "unknown"               # 数据不足 → 判 pending（黄色），不得判通过

# ---------- 四大指标 ----------
indicators:
  - code: IP
    name: "知识产权"
    cap: 30                 # C-2/B3：含"参与编制标准"加分后仍 ≤30，cap 在指标级截断
    cap_scope: indicator
    items:
      - code: IP_ADVANCE
        name: "技术的先进程度"
        cap: 8
        type: subjective_band                  # 用户主观选档（四件套：判据/示例/佐证/区间）
        policy_ref: { doc: GUIDE, article: "知识产权·①" }
        bands:
          - { level: A, label: "高",   min: 7, max: 8 }
          - { level: B, label: "较高", min: 5, max: 6 }
          - { level: C, label: "一般", min: 3, max: 4 }
          - { level: D, label: "较低", min: 1, max: 2 }
          - { level: E, label: "无",   min: 0, max: 0 }
      - code: IP_SUPPORT
        name: "对主要产品（服务）在技术上发挥核心支持作用"
        cap: 8
        type: subjective_band
        bands:
          - { level: A, label: "强",   min: 7, max: 8 }
          - { level: B, label: "较强", min: 5, max: 6 }
          - { level: C, label: "一般", min: 3, max: 4 }
          - { level: D, label: "较弱", min: 1, max: 2 }
          - { level: E, label: "无",   min: 0, max: 0 }
      - code: IP_COUNT
        name: "知识产权数量"
        cap: 8
        type: computed_band
        fn: ip_quantity_band                   # C-2：Ⅰ类优先，Ⅱ类限定"未被往期认定使用"
        policy_ref: { doc: GUIDE, article: "知识产权·③" }
        bands:
          - { level: A, label: "Ⅰ类 ≥1 项",     min: 7, max: 8, when: "class1 >= 1" }
          - { level: B, label: "Ⅱ类 ≥5 项",     min: 5, max: 6, when: "class2 >= 5" }
          - { level: C, label: "Ⅱ类 3~4 项",    min: 3, max: 4, when: "class2 >= 3" }
          - { level: D, label: "Ⅱ类 1~2 项",    min: 1, max: 2, when: "class2 >= 1" }
          - { level: E, label: "0 项",          min: 0, max: 0, when: "true" }
        notes: "Ⅱ类＝实用新型/外观设计/软件著作权（不含商标），仅限使用一次；多个权属人仅一方可用；以授权证书（或授权通知书+缴费收据）为准"
      - code: IP_OBTAIN
        name: "知识产权获得方式"
        cap: 6
        type: subjective_band
        bands:
          - { level: A, label: "有自主研发",              min: 1, max: 6, practice_value: 4 }
          - { level: B, label: "仅有受让、受赠和并购等",  min: 1, max: 3, practice_value: 2 }
          - { level: E, label: "无",                      min: 0, max: 0 }
        report_display: "two_columns"   # B.3：报告并列展示【政策区间】与【实务参考值】；主分只用政策区间
      - code: IP_STANDARD
        name: "参与编制国家标准/行业标准/检测方法/技术规范"
        cap: 2
        bonus: true                     # 加分项，计入 IP 指标并受指标级 cap 约束
        type: boolean_band
        bands:
          - { level: A, label: "是", when: true,  min: 1, max: 2 }
          - { level: B, label: "否", when: false, min: 0, max: 0 }

  - code: CONV
    name: "科技成果转化能力"
    cap: 30
    items:
      - code: CONV_AVG
        name: "近三年科技成果转化年平均数"
        cap: 30
        type: computed_band
        fn: conversion_avg_band
        window_years: 3                 # 近三个会计年度滚动窗口
        divisor: "biz_years"            # N＝实际经营年数（满3除3；不满3按实际整年；刚满1年除1）
        dedup: "achievement_group"      # 同一成果国内外转化 / 转为多个产品服务工艺样品样机 → 只计一项
        bands:
          - { level: A, min: 25, max: 30, when: "avg >= 5" }
          - { level: B, min: 19, max: 24, when: "avg >= 4" }
          - { level: C, min: 13, max: 18, when: "avg >= 3" }
          - { level: D, min:  7, max: 12, when: "avg >= 2" }
          - { level: E, min:  1, max:  6, when: "avg >= 1" }
          - { level: F, min:  0, max:  0, when: "true" }

  - code: MGMT
    name: "研究开发组织管理水平"
    cap: 20
    items:
      - code: MGMT_1
        name: "研发组织管理制度 + 研发投入核算体系 + 研发费用辅助账"
        cap: 6
        type: checklist
        self_scoring_note: "子项拆分为产品自评口径，非政策原文规定"
        sub_items:
          - { code: M1_A, label: "研发组织管理制度",   points: 2 }
          - { code: M1_B, label: "研发投入核算体系",   points: 2 }
          - { code: M1_C, label: "研发费用辅助账",     points: 2 }
      - code: MGMT_2
        name: "内部研发机构及科研条件 + 产学研合作"
        cap: 6
        type: checklist
        sub_items:
          - { code: M2_A, label: "内部研发机构及科研条件", points: 3 }
          - { code: M2_B, label: "产学研合作",             points: 3 }
      - code: MGMT_3
        name: "成果转化组织实施与激励奖励制度 + 开放式创新创业平台"
        cap: 4
        type: checklist
        sub_items:
          - { code: M3_A, label: "成果转化组织实施与激励奖励制度", points: 2 }
          - { code: M3_B, label: "开放式创新创业平台",             points: 2 }
      - code: MGMT_4
        name: "科技人员培养进修 / 职工技能培训 / 优秀人才引进 / 人才绩效评价奖励制度"
        cap: 4
        type: checklist
        sub_items:
          - { code: M4_A, label: "科技人员培养进修",     points: 1 }
          - { code: M4_B, label: "职工技能培训",         points: 1 }
          - { code: M4_C, label: "优秀人才引进",         points: 1 }
          - { code: M4_D, label: "人才绩效评价奖励制度", points: 1 }

  - code: GROWTH
    name: "企业成长性"
    cap: 20                              # 两项各 ≤10
    growth:
      mode: "biz_years_enum"             # C-1：三态 {1,2,3}，禁止布尔
      branches:
        biz_years_3:                     # 有三个时点：第1年末 v1、第2年末 v2、第3年末 v3
          formula: "g = 1/2 × (v2/v1 + v3/v2) − 1"
          fallback_v1_zero: "g = v3/v2 − 1"        # 政策明示：按后两年计算
          fallback_v2_zero: 0                       # 第二年末为 0 → 0 分
          fallback_both_zero: 0                     # v1 = v2 = 0 → 0 分
        biz_years_2:                     # 只有两个时点：第1年末 v1、第2年末 v2
          formula: "g = v2/v1 − 1"                  # 单段降维，严禁套用 v3/v2
          fallback_v1_zero: 0
          fallback_note: "数据不足，该项按 0 分计"
        biz_years_1:
          result: 0                                 # 政策明示：刚满一年 → 成长性整体 0 分
      clamp_negative: true                          # 任一增长率 < 0 → 0 分
      independence: "净资产增长率 与 销售收入增长率 各自独立走上述分支，互不牵连"
      compare: "exact_rational_bigint"              # 见 §3.5.2，避免浮点边界误判
      bands:                                        # ≥35%→9-10 … ≤0→0
        - { min_bp: 3500, min_score: 9, max_score: 10 }
        - { min_bp: 2500, min_score: 7, max_score: 8 }
        - { min_bp: 1500, min_score: 5, max_score: 6 }
        - { min_bp:  500, min_score: 3, max_score: 4 }
        - { min_bp:    1, min_score: 1, max_score: 2 }   # > 0（严格大于）
        - { min_bp: null, min_score: 0, max_score: 0 }   # ≤ 0
    items:
      - { code: GROWTH_ASSET,   name: "净资产增长率",   cap: 10, source: net_asset }
      - { code: GROWTH_REVENUE, name: "销售收入增长率", cap: 10, source: revenue }

# ---------- 提分动作（诊断建议的反事实模拟源） ----------
actions:
  - { code: ADD_CLASS2_IP,   label: "新增 1 项 Ⅱ类知识产权（实用新型/外观设计/软著）", effort: mid,  lead_time_days: 90,  patch: { path: "ip_assets", op: append, value: { category: II } } }
  - { code: ADD_CLASS1_IP,   label: "新增/取得 1 项 Ⅰ类知识产权（发明专利等）",       effort: high, lead_time_days: 730, patch: { path: "ip_assets", op: append, value: { category: I } } }
  - { code: JOIN_STANDARD,   label: "参与 1 项国家标准/行业标准/检测方法编制",         effort: high, lead_time_days: 365, patch: { path: "ip_assets.standard_participation", op: set, value: true } }
  - { code: ADD_CONVERSION,  label: "补录并举证 1 项科技成果转化",                     effort: mid,  lead_time_days: 60,  patch: { path: "tech_achievements", op: append, value: { forms: ["产品"] } } }
  - { code: MGMT_CHECK_ITEM, label: "补齐 1 项组织管理制度/平台并留痕",                effort: low,  lead_time_days: 15,  patch: { path: "rd_management_selfcheck", op: check_next } }
  - { code: IP_EVIDENCE_UP,  label: "补充查新报告/科技奖励以提升先进程度档位",         effort: low,  lead_time_days: 30,  patch: { path: "ip_assessment.advance_level", op: level_up } }
```

**TS 侧强校验（发布门禁）**：`RulePackSchema = z.object({...}).superRefine(...)`，发布前必须全绿，并附加四条一致性校验（任一失败禁止发布）：
1. 每个 `item.bands[].max <= item.cap`；
2. `sum(items.cap) >= indicator.cap`（保证能以满分达标，防止规则配错导致"不可能通过"）；
3. `IP` 指标必须存在且 `cap === 30`；`verdict.threshold === 70 && basis === 'conservative'`；
4. 每个 `item` 必须绑定 `policy_ref`（PRD F-12：缺政策锚点的评分项不允许发布）。

### 3.3 政策版本管理与历史可复算

| 环节 | 机制 |
|------|------|
| 编辑 | 后台对 `policy_versions(status=draft)` 改档位/文案 → 自动生成 **diff（JSON Patch）** 并高亮变化项 |
| 发布门禁 | 二次确认弹窗（展示 diff + 影响面："预计 X 条历史评估为旧版本，不会被重算"）→ **跑全量回归**：`pnpm test:engine`（含 §3.6 全部 golden case）+ `python tools/rule-audit/run.py`（独立实现交叉校验）→ 通过后 `status=published`、`checksum_sha256` 落定、旧版本置 `archived` |
| 生效 | 计算时按请求携带的 `policy_version`（缺省取 `published` 最新）加载 Rulepack；加载结果进 Redis/内存缓存，TTL 300s，Key = `rp:{version}:{sha256}`，版本切换即时生效 |
| 可复算 | `assessments` 落 `policy_version` + `rulepack_sha256` + `input_snapshot_json` + `result_json` → `recompute(assessment_id)` 严格等价：`evaluate(input_snapshot, loadRulepack(version))` 与 `result_json` 逐字段 diff 必须为 0 |
| 历史不被改写 | 新版本发布**不重算**历史评估；用户如需按新口径重算，走"另存为新方案"（新建 assessment，`parent_id` 指向原方案），符合 PRD F-31 快照防失真 |
| 回滚 | 后台一键 `rollback`：把目标历史版本复制为新 draft → 发布 → 即刻生效（≤5 分钟），用于政策口径勘误的紧急止血 |
| 地区扩展位 | `region_code` + `overrides: []` 字段已预留；V1.0 只维护 `CN` 一份，V2.0 地区包以 overlay 形式加载，**每处差异须带 `source_url` 与 `publish_date`**，无官方依据不得写入（选型报告 §4.1.2 第 5 条） |

### 3.4 计算流程（七段）

```
          ┌──────────────── AssessmentInput (DTO) ────────────────┐
          │ enterprise / fiscal(3y, biz_years) / ip_assets[]       │
          │ tech_achievements[] / mgmt_checklist / precheck_inputs │
          └──────────────────────────┬────────────────────────────┘
                                     ▼
① 输入校验 validate()      → hard error：金额<0/年份缺失/biz_years∉{1,2,3}/台账证书号重复…
                           → soft warn ：同一成果疑似重复/Ⅱ类已被往期使用/台账为空…
                           → hard error 阻断（返回 422 + 首个错误字段定位）
                                     ▼
② 资格预检 precheck()      → C1..C8 → pass | fail | unknown（数据不足）
                           → fail → 结果页强阻断卡（展示失败码 + 政策文号 + 补救路径），仍计算参考价值分数但标注"不具资格"
                                     ▼
③ 分项打分 scoreItems()    → 逐 item 产出 ItemResult{score_min, score_max, band, formula, inputs, note, policy_ref}
                           → 主观项：档位换算；客观项：computed_band；checklist：子项求和
                                     ▼
④ 指标级 cap 截断 capIndicator() → for each indicator: total = min(indicator.cap, Σ items)
                           → **保守、乐观分别独立截断**（min(30, lo) 与 min(30, hi) 各算一次，不得先取中值）
                                     ▼
⑤ 汇总 aggregate()         → conservative = Σ indicators.lo ；optimistic = Σ indicators.hi
                           → 同时输出 practice_total（把 IP_OBTAIN 换成 practice_value，仅供并列展示，不进达标判定）
                                     ▼
⑥ 达标判定 verdict()       → qualified ⟺ conservative > 70（整数口径 ⟺ ≥ 71）
                           → 三态：conservative>70 → 稳过；optimistic>70 且 conservative≤70 → 边缘·需补强；否则 不达标
                                     ▼
⑦ 差距诊断 diagnose()      → gap = max(0, 71 − conservative)
                           → 对 §3.2 actions 逐个做**反事实模拟**（复制输入 → 打补丁 → 重跑 ③~⑥）→ delta
                           → 过滤 delta>0、按 (delta_min desc, effort asc) 排序、贪心组合至覆盖 gap、取 Top5
                                     ▼
                          AssessmentResult{ items[], indicators[], totals, verdict, gap, diagnosis[], policy_version, rulepack_sha256, evaluated_at }
```

### 3.5 关键算法伪代码

#### 3.5.0 精确比较工具（防浮点坑，贯穿成长性与占比判定）

```
// 所有比率比较统一为「整数分子 / 整数分母 vs 基点阈值」的 BigInt 精确比较
// den > 0 前提下：num/den >= bp/10000  ⟺  num*10000 >= bp*den
fn gteBp(num: BigInt, den: BigInt, bp: Int) -> Bool = num * 10000n >= BigInt(bp) * den
fn gtZero(num: BigInt)                    -> Bool = num > 0n
// 金额在进入引擎前统一换算为「分」整数（moneyToCents），避免 0.35 之类阈值的浮点陷阱
```

#### 3.5.1 知识产权数量档位（C-2）

```
fn ipQuantityBand(assets: IpAsset[], declType, baseYear) -> BandResult {
  usable = assets.filter(a =>
      a.grantEvidence == "cert" || (a.grantEvidence == "notice+receipt")        // 授权为准
   && a.grantRegionInChina                                                      // 境内授权/审定
   && a.protectionValidAt(baseYear)                                             // 在有效保护期内
   && a.ownerIsApplicant                                                        // 权属人为本企业
   && (a.coOwners == none || a.exclusiveUseByUs)                                // 多权属人仅一方可用
   && !a.excluded)                                                              // 人工剔除
  class1 = usable.count(category == "I")                                        // Ⅰ类：发明(含国防)/植物新品种/国家级农作物品种
                                                                                //      /国家新药/国家一级中药保护品种/集成电路布图设计
  class2Pool = usable.filter(category == "II")                                  // Ⅱ类：实用新型/外观设计/软著(不含商标)
  if (declType == "review" || declType == "re_declare")
      class2 = class2Pool.filter(!usedInAssessment).length                      // ★ Ⅱ类仅限使用一次：复审/重新认定须剔除已用项
  else
      class2 = class2Pool.length

  if      (class1 >= 1) band = A(7,8)      // Ⅰ类 ≥1 项优先命中；Ⅰ类可重复使用，不参与"仅限一次"约束
  else if (class2 >= 5) band = B(5,6)
  else if (class2 >= 3) band = C(3,4)      // 3~4 项
  else if (class2 >= 1) band = D(1,2)      // 1~2 项
  else                  band = E(0,0)

  return { band: band.level, score_min: band.min, score_max: band.max,
           formula: "Ⅰ类={class1} 项，Ⅱ类可用={class2} 项（去除已用于往期认定={excludedN} 项）→ {label} 档",
           inputs: {class1, class2, excludedN}, note: Ⅱ类可复用性说明, policy_ref: "GUIDE·知识产权③" }
}
```

> **Ⅱ类"仅限使用一次"的落库闭环**：首次认定后，后台可对已用于本次认定的Ⅱ类资产批量置 `used_in_assessment=1` 并写入 `used_refer_assessment_id`；再次创建（复审）评估时按 §3.5.1 分支过滤已用项，UI 同步提示"已用于 {year} 年度认定，本次不计入数量"。C-2 要求的数据标记见 §4.3.4。

#### 3.5.2 企业成长性 —— C-1 全部边界分支（必须逐行对照实现）

```
// v1 = 第一年末值，v2 = 第二年末值，v3 = 第三年末值（单位：元→分，BigInt）
// bizYears ∈ {1,2,3}（枚举入参，禁止 boolean）
fn growthRate(v1: BigInt, v2: BigInt, v3: BigInt, bizYears: 1|2|3) -> RateResult {

  if (bizYears == 1) {                                     // 【分支⑧】刚满一年
     return { num: 0, den: 1, edge: "BIZ_YEARS_1",
              note: "实际经营期刚满一年：企业成长性指标整体按 0 分计" }
  }

  if (bizYears == 2) {                                     // 【分支⑥⑦】经营满两年：单段降维 v2/v1
     if (v1 <= 0) {                                        // 【分支⑦】v1=0 无可用替代段
        return { num: 0, den: 1, edge: "BIZ_YEARS_2_V1_ZERO",
                 note: "经营两年且第一年末数据缺失：数据不足，该项按 0 分计" }
     }
     return { num: v2 - v1, den: v1, edge: null,           //  g = (v2 − v1)/v1 = v2/v1 − 1
              note: "经营两年：g = v2/v1 − 1 = (" + v2 + " / " + v1 + ") − 1" }
  }

  // bizYears >= 3：三个时点
  if (v2 <= 0) {                                           // 【分支③④】v2=0（含 v1=v2=0）
     return { num: 0, den: 1,
              edge: (v1 <= 0 ? "BOTH_ZERO" : "V2_ZERO"),
              note: (v1 <= 0 ? "第一年末与第二年末均为 0：g = 0"
                             : "第二年末为 0：g = 0（分母为 0，无法计算增长段）") }
  }
  if (v1 <= 0) {                                           // 【分支②】v1=0 → 按后两年
     return { num: v3 - v2, den: v2, edge: "V1_ZERO",
              note: "第一年末为 0：按后两年计算，g = v3/v2 − 1 = (" + v3 + " / " + v2 + ") − 1" }
  }
  // 【分支①】常规：g = 1/2×(v2/v1 + v3/v2) − 1  →  通分 (v2² + v1·v3 − 2·v1·v2) / (2·v1·v2)
  return { num: v2*v2 + v1*v3 - 2n*v1*v2, den: 2n*v1*v2, edge: null,
           note: "g = 1/2 × (v2/v1 + v3/v2) − 1" }
}

fn growthScore(s: RateResult, bands) -> ItemResult {
  // 【通用规则】增长率 < 0 → 0 分；den 恒 > 0（由上面各分支保证）
  if (!gtZero(s.num)) {
     return { score_min: 0, score_max: 0, band: "N", edge: s.edge ?? "NEGATIVE_CLAMPED",
              formula: s.note + "；增长率 ≤ 0 → 按 0 分计" }        // ★ 负增长兜底，放在最后统一生效
  }
  hit = bands.first(b => gteBp(s.num, s.den, b.min_bp))             // 精确比较：≥35%→9-10 … >0→1-2
  return { score_min: hit.min_score, score_max: hit.max_score, band: hit.level,
           formula: s.note + " = " + formatPercent(s.num, s.den) + " → " + hit.label + " 档" }
}

// 净资产 与 销售收入 各自独立调用上述逻辑，互不牵连
fn growthIndicator(input) -> IndicatorResult {
  a = growthScore(growthRate(input.netAssetY1, input.netAssetY2, input.netAssetY3, input.bizYears), bands)
  r = growthScore(growthRate(input.revenueY1,  input.revenueY2,  input.revenueY3,  input.bizYears), bands)
  return { code: "GROWTH", cap: 20, lo: a.score_min + r.score_min, hi: a.score_max + r.score_max,
           items: [a as GROWTH_ASSET(cap 10), r as GROWTH_REVENUE(cap 10)] }
}

【禁止事项】❌ 不得使用 full_three_years: bool；❌ bizYears==2 时不得套用 v3/v2；
          ❌ v1=v2=0 时不得走 v1=0 分支（先判 v2=0，避免除零）；❌ 不得用浮点直接比较 0.35/0.25/0.15/0.05。
```

#### 3.5.3 研发费用占比（C-3）

```
fn rdExpenseRule(lastYearRevenue: BigInt /* 最近一年销售收入，元 */,
                 rdTotal3y: BigInt, salesTotal3y: BigInt, rdDomestic3y: BigInt) -> PrecheckResult {
  // ⚠ 入参名强制 lastYearRevenue：分档基准＝最近一年销售收入（不得传三年合计）
  required = 0.03
  for (t in tiers) if (t.max_revenue == null || lastYearRevenue <= t.max_revenue) { required = t.required; break }
  // 含边界：50,000,000 → 5%；200,000,000 → 4%；200,000,001 → 3%
  actualNum = rdTotal3y ; actualDen = salesTotal3y            // 分母＝近三个会计年度销售收入合计
  ok5 = (salesTotal3y > 0) && gteBp(actualNum, actualDen, required * 10000)
  ok6 = (rdTotal3y   > 0) && gteBp(rdDomestic3y, rdTotal3y, 6000)   // 境内 ≥ 60%
  return {
    code: "C5/C6", pass: ok5 && ok6,
    detail: { basisRevenue: lastYearRevenue, threshold: required,
              rdTotal3y, salesTotal3y, actualRatio: div(actualNum, actualDen),
              domesticRatio: div(rdDomestic3y, rdTotal3y), domesticThreshold: 0.60 },
    note: "分档基准＝最近一年销售收入；分母口径＝近三个会计年度合计；另校验境内研发费用占比 ≥60%"
  }
}
```

#### 3.5.4 科技成果转化（N 除数 + 同成果只计一项）

```
fn conversionAvgBand(records, bizYears, declareYear, rp) -> ItemResult {
  N = clamp(bizYears, 1, 3)                                  // 满3→3；不满3→实际整年；刚满1→1
  lo = declareYear - rp.CONV.window_years                    // 近三年滚动窗口：[declareYear-3, declareYear-1]
  inWindow = records.filter(lo <= r.convertYear && r.convertYear <= declareYear - 1)
  outCount = records.length - inWindow.length                // 窗口外 → UI 标灰不计入，并提示
  uniq = distinctBy(inWindow, r => r.dedupKey)               // ★ 同一成果国内外转化 or 转为多个产品/服务/工艺/样品/样机 → 只计一项
  // dedupKey 生成规则：优先取 achievement_group_id；为空则以「成果名称规范化 + 首次收获年份」哈希兜底
  avgN = uniq.length ; avgD = N
  hit = bands.first(b => gteBp(BigInt(avgN), BigInt(avgD), b.when_bp))   // A:5000bp … E:100bp, else F
  return { score_min: hit.min, score_max: hit.max, band: hit.level,
           formula: "年均 = 去重后转化数 " + avgN + " ÷ 实际经营年数 " + N + " = " + fmt(avgN/avgD) + " → " + hit.label + " 档",
           inputs: { total: records.length, inWindow: inWindow.length, afterDedup: uniq.length, N, outCount } }
}
```

#### 3.5.5 主观项档位换算（含"获得方式"实务参考值）

```
fn subjectiveBand(itemDef, chosenLevel) -> ItemResult {
  b = itemDef.bands.find(level == chosenLevel) ?? DEFAULT_LOWEST     // 未选 → 取最低档（E/无），不阻断
  clampeli = (x) => min(x, itemDef.cap)
  return { score_min: clampeli(b.min), score_max: clampeli(b.max), band: b.level,
           formula: b.label + " 档 → 政策区间 " + b.min + "~" + b.max + " 分",
           practice_value: b.practice_value ?? null,                  // IP_OBTAIN：A=4 / B=2，仅展示不进主分
           note: "按 integer_scoring 取整；禁止臆造单点分值" }
}
```

#### 3.5.6 组织管理：checklist + 指标内子项上限

```
fn checklistItem(itemDef, checkedCodes) -> ItemResult {
  sum = Σ(sub.points for sub in itemDef.sub_items if checkedCodes.includes(sub.code))
  v = min(sum, itemDef.cap)                                           // 每项各自 ≤6/6/4/4
  return { score_min: v, score_max: v, band: "X",      // ★ 该产品口径下为确定值（非区间），保守=乐观
           formula: "已勾选 " + checkedCodes.length + " 项 → 合计 " + sum + "，上限 " + itemDef.cap,
           headroom: itemDef.cap - v,                                  // 供诊断计算"还剩多少可拿"
           note: "子项拆分为产品自评口径，非政策原文规定，最终由评审专家认定" }
}
```

#### 3.5.7 指标级 cap、汇总与三态判定

```
fn capAndAggregate(indicators, rp) -> Totals {
  for (ind of indicators) {
     ind.total_min = min(ind.cap, Σ item.score_min)          // 保守、乐观**分别**截断
     ind.total_max = min(ind.cap, Σ item.score_max)          // IP：min(30, lo) 与 min(30, hi) 各算一次
  }
  conservative = Σ ind.total_min
  optimistic   = Σ ind.total_max
  // practice_total：把 IP_OBTAIN 的政策区间下界替换为 practice_value（A=4 / B=2）后重算，仅作并列展示列，不参与达标判定
  practice_total = conservative − obtainScore.min + obtainBand.practice_value
  qualified = (conservative > 70)                          // 整数打分 ⟺ conservative >= 71
  verdict = qualified ? "QUALIFIED_稳过"
          : (optimistic > 70 ? "EDGE_边缘·需补强" : "FAIL_不达标")
  gap = max(0, 71 − conservative)
  return { conservative, optimistic, verdict, gap, perIndicator }
}
```

### 3.6 单元测试矩阵（CI 门禁，失败即禁止发布规则包）

**A. 成长性 8 场景 × 2 指标 = 16 组（C-1 强制）**

单位：万元；`A`＝净资产增长率，`R`＝销售收入增长率；两指标取同一组数值以互换验证"互不牵连"。

| # | 场景 | v1 | v2 | v3 | biz_years | 期望 g | 期望 band | edge_code |
|---|------|----|----|----|-----------|--------|-----------|-----------|
| 1 | 3年正常 · 净资产 | 1000 | 1200 | 1500 | 3 | 22.5000% | (5,6) | — |
| 2 | 3年正常 · 销售收入 | 1000 | 1200 | 1500 | 3 | 22.5000% | (5,6) | — |
| 3 | 3年 v1=0 · 净资产 | 0 | 1000 | 1500 | 3 | 50.0000% | (9,10) | `V1_ZERO` |
| 4 | 3年 v1=0 · 销售收入 | 0 | 1000 | 1500 | 3 | 50.0000% | (9,10) | `V1_ZERO` |
| 5 | 3年 v2=0 · 净资产 | 1000 | 0 | 1500 | 3 | 0（退化） | (0,0) | `V2_ZERO` |
| 6 | 3年 v2=0 · 销售收入 | 1000 | 0 | 1500 | 3 | 0（退化） | (0,0) | `V2_ZERO` |
| 7 | 3年 v1=v2=0 · 净资产 | 0 | 0 | 1500 | 3 | 0（退化） | (0,0) | `BOTH_ZERO` |
| 8 | 3年 v1=v2=0 · 销售收入 | 0 | 0 | 1500 | 3 | 0（退化） | (0,0) | `BOTH_ZERO` |
| 9 | 3年负增长 · 净资产 | 1200 | 1000 | 900 | 3 | −13.3333%→0 | (0,0) | `NEGATIVE_CLAMPED` |
| 10 | 3年负增长 · 销售收入 | 1200 | 1000 | 900 | 3 | −13.3333%→0 | (0,0) | `NEGATIVE_CLAMPED` |
| 11 | 2年正常 · 净资产 | 1000 | 1300 | — | 2 | 30.0000% | (7,8) | — |
| 12 | 2年正常 · 销售收入 | 1000 | 1300 | — | 2 | 30.0000% | (7,8) | — |
| 13 | 2年 v1=0 · 净资产 | 0 | 1300 | — | 2 | 0（数据不足） | (0,0) | `BIZ_YEARS_2_V1_ZERO` |
| 14 | 2年 v1=0 · 销售收入 | 0 | 1300 | — | 2 | 0（数据不足） | (0,0) | `BIZ_YEARS_2_V1_ZERO` |
| 15 | 1年 · 净资产 | — | — | — | 1 | 0（整体0分） | (0,0) | `BIZ_YEARS_1` |
| 16 | 1年 · 销售收入 | — | — | — | 1 | 0（整体0分） | (0,0) | `BIZ_YEARS_1` |

补充 12 组（分档边界 + 独立性，各指标 6 组）：`g` 恰为 35%→(9,10)、25%→(7,8)、15%→(5,6)、5%→(3,4)、0→(0,0)、−0.01%→(0,0)；以及"净资产 0 分、销售收入 (7,8)"的独立性用例（净资产 v=(0,100,0) 走 V2_ZERO、销售收入 v=(1000,1200,1500) 走常规，二者结果互不干扰）。

**B. 其他必测用例（≥60 例，CI 全覆盖）**

| 域 | 用例 |
|----|------|
| IP 数量（C-2） | Ⅰ类1项→A；Ⅰ类0+Ⅱ类5→B；Ⅱ类4→C；Ⅱ类3→C；Ⅱ类2→D；Ⅱ类1→D；0→E；Ⅱ类已用3项被剔除后降档；复用/admin 多权属人未勾选→不计；申请中未授权→不计；证书过期→不计；5项软著按 B 档 **5-6 分**（防止照抄选型报告示例的 7-8） |
| IP cap | 4 子项取满 8+8+8+6+2=32 → 指标必为 30（保守/乐观各截一次）；仅部分取满时不误截 |
| IP 获得方式 | A 档 (1,6)、practice=4；B 档 (1,3)、practice=2；保守总分按 1 计入，实务列另算，二者不混用 |
| 成果转化 | 15 项/3年→A；8 项/3年→C（年均 2.67）；0→F；**同一成果 3 个 form 记 1 项**；国内外各转化一次记 1 项；窗口外年份标灰不计；`biz_years=2` 时 8÷2=4→B 档 |
| 组织管理 | 全勾选→20；全不勾→0；仅勾 M1_A→2；每项上限 6/6/4/4 不溢出 |
| 预检（C-3） | lastYearRevenue=50,000,000→5%；=200,000,000→4%；=200,000,001→3%；研发费用刚好达标；境内 59.99%→不通过；高品收入 59.99%→不通过；成立 364 天→不通过、365 天→通过；科技人员恰好 10%→通过 |
| 判定 | conservative=70→**不达标**；70.5→达标；71→达标；conservative=68 且 optimistic=73→"边缘·需补强" |
| 跨版本复算 | 旧 input_snapshot + 旧 rulepack → 逐字节等于历史 result_json |
| 引擎纯净性 | `packages/rule-engine` 内出现 `Date`\|`Math.random`\|`fetch`\|`prisma` → lint 失败 |

### 3.7 诊断建议生成规则（按失分排序 + 补强收益估算）

**实现方式：反事实模拟（Counterfactual Simulation），而非写死的收益表** —— 收益值由引擎真跑一遍得出，杜绝"建议文案与实际分数不一致"。

```
fn diagnose(input, rp, result) -> Diagnosis[] {
  if (result.precheck.hasFail) {
     push advice for each failed code: {priority: P0, action: 补救路径, policy_ref: 对应条款}
     // 资格预检不通过时，补分建议置于其后，并明确"先解决资格问题"
  }
  candidates = []
  for (action of rp.actions) {
     patched = deepClone(input); applyPatch(patched, action.patch)      // 构造假设输入
     r2 = evaluate(patched, rp, ctx)                                    // 完整重跑（含 cap 截断）
     dMin = r2.conservative − result.conservative
     dMax = r2.optimistic   − result.optimistic
     if (dMin > 0 || dMax > 0)
        candidates.push({code, label, delta_min: dMin, delta_max: dMax,
                         effort: action.effort, lead_time_days: action.lead_time_days,
                         materials: adviceTemplates[action.code].materials,   // 需补材料清单
                         template: adviceTemplates[action.code].text,         // 规则化文案库
                         policy_ref: r2.changedItems[0].policy_ref})
  }
  sort candidates by (delta_min desc, effort asc, lead_time_days asc)
  // 贪心组合：自 Top 起累加 delta_min，直到 conservative + Σdelta_min >= 71，输出"最短达标路径"
  // 输出 Top5 + 「按建议 1+3 执行即可 +X 分达到 71 分」
  return top5 + feasiblePlan
}
```

**建议文案模板库（规则化，不接大模型 —— 符合 C-8/P-10 生成式 AI 合规规避）**：

| action_code | 建议文案（参数化） | 需补材料 | effort / 周期 |
|-------------|--------------------|----------|---------------|
| `ADD_CLASS2_IP` | 再申请 {n} 项Ⅱ类知识产权（实用新型/外观/软著），预计该项进入 {nextBand} 档，**预计 +{dMin}~{dMax} 分**；例如当前Ⅱ类 2 项（D 档 1-2 分），补至 3 项即进 C 档（3-4 分）→ **预计 +2 分** | 软著登记证书 / 专利受理通知书 / 研发立项记录 | 中 / 约 90 天 |
| `ADD_CLASS1_IP` | 布局 1 项Ⅰ类知识产权（发明专利等），数量项直接进 A 档（7-8 分），**预计 +{dMin}~{dMax} 分** | 发明专利申请+实审材料 | 高 / 约 2 年 |
| `JOIN_STANDARD` | 参与 1 项国家标准/行业标准/检测方法/技术规范编制并署名，加分项 **预计 +1~2 分** | 标准文本署名页 | 高 / 约 1 年 |
| `ADD_CONVERSION` | 补录 1 项科技成果转化并完成举证，年均数由 {avg} 提升，本项预计进入 {nextBand} 档，**预计 +{dMin}~{dMax} 分** | 转化合同/检测报告/销售发票/样机照片 | 中 / 约 60 天 |
| `MGMT_CHECK_ITEM` | 补齐"{subItem}"制度文件并留痕执行记录，**预计 +{dMin} 分**（立即可做，投入产出比最高） | 制度文件 + 执行记录（会议纪要/报销单） | 低 / 约 15 天 |
| `IP_EVIDENCE_UP` | 补充查新报告/省部级科技奖励/第三方检测，将"技术先进程度"由 {curBand} 提升一档，**预计 +{dMin}~{dMax} 分** | 查新报告、获奖证书、检测报告 | 低 / 约 30 天 |

**排序与展示规则**：①按 `delta_min` 降序（对保守分的真贡献，而非对乐观分）；②同分按 `effort` 升序（低投入优先，"立即可做"的建议排前面）；③必须展示每条的**政策锚点**（文号+条款）与**所需材料清单**（PRD F-10 / D3）；④必须展示"距离 71 分还差 X 分"及可行组合；⑤已达标（conservative ≥71）时展示"维持建议"（含复审须注意的Ⅱ类复用剔除），而非空白。

---

## 4. 数据模型

### 4.1 全局约定

| 约定 | 规则 |
|------|------|
| 主键 | 内部 `id BIGINT UNSIGNED AUTO_INCREMENT`；对外一律使用 `public_id CHAR(26)` ULID（防枚举、可排序），API 路径只用 `public_id` |
| 时间戳 | 全表 `created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`、`updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`；业务表加 `deleted_at DATETIME(3) NULL` |
| 软删除唯一键冲突 | MySQL 无部分唯一索引，采用 `delete_mark BIGINT NOT NULL DEFAULT 0`（存活为 0，删除时置为该行 id）与 `UNIQUE KEY uk_x (public_id, delete_mark)` 组合，避免软删后无法重建同名记录 |
| 金额 | 一律 `DECIMAL(18,2)`，**单位＝元**（UI 展示为万元）；比率×比较在引擎内转 BigInt 整数（§3.5.0）；增长率落库 `DECIMAL(10,6)` |
| 状态字段 | 一律 `VARCHAR(24)` + CHECK 约束枚举，禁用魔法字符串；状态机流转见各表说明 |
| 字符集 | `utf8mb4` / `utf8mb4_0900_ai_ci`；金额/ID 列显式 `CHARACTER SET ascii` 以缩小索引 |
| JSON 列 | `JSON` + 生成列索引（仅对高频检索字段建）；快照类 JSON 只写不查，不建索引 |
| 加密 | 敏感财务与统一信用代码：应用层 AES-256-GCM 加密后存 `VARBINARY`，配套 `key_version`；等值查询场景另存 HMAC-SHA256 盲索引列 |
| 索引 | 所有外键字段必建索引；列表筛选高频路径建联合索引（见各表） |

### 4.2 ER 关系（ASCII）

```
   users(预留V1.1) ──┐
                     │ 1:N（V1.1 启用）
 users ⟵ guest_owner ┤
                     ▼
            ┌──────────────────┐        1:N        ┌──────────────────────┐
            │   enterprises    │───────────────────▶│    fiscal_years      │
            │ (企业档案/方案主体)│                    │  (逐年财务，含 biz_years)│
            └────────┬─────────┘                    └──────────────────────┘
                     │ 1:N
       ┌─────────────┼──────────────┬─────────────────┬────────────────┐
       ▼             ▼              ▼                 ▼                ▼
┌──────────────┐ ┌────────────────┐ ┌──────────────────┐ ┌──────────────┐ ┌──────────────┐
│  ip_assets   │ │tech_achievements│ │rd_management_    │ │ assessments  │ │   注        │
│ (知识产权台账)│ │ (成果转化台账)  │ │ selfcheck(组织管理)│ │  (一次评估)   │ │              │
└──────────────┘ └────────────────┘ └──────────────────┘ └───┬────┬─────┘ └──────────────┘
                                                              │    │
                                            1:N               │    │ 1:N
                                   ┌──────────────────────────┘    └─────────────────┐
                                   ▼                                                 ▼
                        ┌──────────────────────┐                        ┌──────────────────────┐
                        │  assessment_items    │                        │       reports        │
                        │ (评分项明细 + 快照值) │                        │ (PDF/XLSX 产物)      │
                        └──────────────────────┘                        └──────────────────────┘
                                                                                    │ 1:1 (可选)
                                                                                    ▼
                                                                        ┌──────────────────────┐
                                                                        │      snapshots       │
                                                                        │ (30天短链・密文快照) │
                                                                        └──────────────────────┘

  policy_versions 1:N policy_rules(档位/文案行)   policy_versions 1:N policy_refs(政策条款)
  policy_refs 1:N assessment_items.policy_ref_id（弱引用，禁止外键强约束，保证历史可追溯不被删除）
  admin_users → audit_logs（后台操作留痕 ≥180 天）    events（埋点，独立冷热分离）
```

### 4.3 核心表结构

> 命名说明（**与 PRD 8.1 的差异仅为命名，语义一致**，下游以本表为准）：` companies → enterprises`、`tech_conversions → tech_achievements`、`rd_mgmt_assessments → rd_management_selfcheck`、`scoring_records → assessments`、`scoring_items → assessment_items`、`growth_finances + companies.y1/y2/y3 → fiscal_years`（把 PRD 的三年内联列规范化为行，以支持 `biz_years ∈ {1,2,3}` 与未来 N 年口径）、`snapshots`（C-4 新增，承载短链密文快照）。

#### 4.3.1 `users`（**V1.0 仅建表预留，业务写入推迟 V1.1 —— C-4**）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED | PK, AI | — |
| public_id | CHAR(26) | UNIQUE(public_id, delete_mark) | ULID |
| phone_enc | VARBINARY(256) | NULL | 手机号 AES-256-GCM 密文 |
| phone_blind_idx | CHAR(64) | NULL, INDEX | HMAC-SHA256 盲索引（等值查询用） |
| email_enc | VARBINARY(256) | NULL | 邮箱密文 |
| password_hash | VARCHAR(255) | NULL | argon2id；V1.0 恒 NULL |
| nickname | VARCHAR(64) | NULL | — |
| role | VARCHAR(16) | NOT NULL DEFAULT 'user', CHECK IN ('user','agency','admin') | V1.1 启用 |
| org_id | BIGINT UNSIGNED | NULL, INDEX | 机构（V2.0 机构版预留） |
| status | VARCHAR(16) | NOT NULL DEFAULT 'active', CHECK IN ('active','disabled','deleted') | — |
| last_login_at | DATETIME(3) | NULL | — |
| key_version | SMALLINT UNSIGNED | NOT NULL DEFAULT 1 | 密钥轮换版本 |
| created_at / updated_at / deleted_at | DATETIME(3) | — | 三件套 |
| delete_mark | BIGINT | NOT NULL DEFAULT 0 | 软删除标记位 |

> V1.0 落库策略：`users` 表随迁移创建，但**应用代码不得在该表产生任何 INSERT**（CI 静态扫描：含 `prisma.users.create` 的提交禁止合入主分支）。

#### 4.3.2 `enterprises`（企业档案 / 方案主体）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id / public_id | BIGINT / CHAR(26) | PK / UNIQUE | — |
| guest_token_hash | CHAR(64) | NOT NULL, INDEX | V1.0 归属依据：游客令牌的 SHA-256（不存明文令牌） |
| user_id | BIGINT UNSIGNED | NULL, INDEX | V1.1 绑定账号后回填 |
| name | VARCHAR(200) | NULL | **可选、默认匿名"我的方案1"**（§8 最小必要） |
| credit_code_enc | VARBINARY(256) | NULL | 统一社会信用代码密文 |
| province / city | VARCHAR(32) | NULL | — |
| establish_date | DATE | NULL, INDEX | 用于 C1（≥365 天） |
| industry_field_l1/l2/l3 | VARCHAR(64) | NULL | 《国家重点支持的高新技术领域》三级目录，用于 C3 |
| declare_type | VARCHAR(16) | NOT NULL DEFAULT 'first', CHECK IN ('first','review','re_declare') | 决定Ⅱ类是否已用剔除（C-2） |
| declare_year | SMALLINT | NOT NULL | 申报年度，决定三年窗口 |
| biz_years | TINYINT | NOT NULL DEFAULT 3, **CHECK (biz_years IN (1,2,3))** | **C-1 三态**；同时作为成果转化除数 N |
| employee_count / tech_staff_count | INT UNSIGNED | NULL | 科技人员占比 C4 |
| total_revenue_last_year_dec | VARBINARY(256) | NULL | 最近一年销售收入（密文），**C-3 分档基准** |
| rd_expense_total_3y_dec / rd_expense_domestic_3y_dec | VARBINARY(256) | NULL | 近三年研发费用总额 / 其中境内（密文） |
| sales_total_3y_dec | VARBINARY(256) | NULL | 近三年销售收入合计（密文，C5 分母） |
| hitech_revenue_last_year_dec | VARBINARY(256) | NULL | 申报前一年高新收入（密文） |
| has_major_accident | TINYINT(1) | NULL | NULL＝未填（走 unknown），1＝有（C8 不通过） |
| storage_mode | VARCHAR(16) | NOT NULL DEFAULT 'local_only', CHECK IN ('local_only','cloud_encrypted') | V1.0 恒 `local_only`：财务不明文入库 |
| status | VARCHAR(16) | NOT NULL DEFAULT 'draft', CHECK IN ('draft','active','archived') | — |
| created_at / updated_at / deleted_at / delete_mark | — | — | 三件套 + 软删标记 |

索引：`INDEX idx_guest (guest_token_hash, status)`、`INDEX idx_user (user_id, updated_at)`。

#### 4.3.3 `fiscal_years`（逐年财务）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id / public_id | — | PK / UNIQUE | — |
| enterprise_id | BIGINT UNSIGNED | NOT NULL, INDEX | FK → enterprises.id |
| fiscal_year | SMALLINT | NOT NULL | 会计年度（如 2023/2024/2025） |
| seq | TINYINT | NOT NULL, CHECK IN (1,2,3) | 时点序号：1=第一年末、2=第二年末、3=第三年末（**语义与 C-1 的 v1/v2/v3 一一对应**） |
| net_asset_dec | VARBINARY(256) | NULL | 年末净资产密文（元） |
| revenue_dec | VARBINARY(256) | NULL | 年末销售收入密文（元） |
| is_estimated | TINYINT(1) | NOT NULL DEFAULT 0 | 是否为用户估算值（报告中标注） |
| UNIQUE KEY | (enterprise_id, fiscal_year, seq, delete_mark) | | 幂等 upsert 依据 |
| created_at / updated_at / deleted_at / delete_mark | — | — | — |

> V1.0 写入策略同上：`storage_mode='local_only'` 时本表**不写入**（原始值只在浏览器本地 + 短链密文 payload 中）；V1.1 用户显式开启云同步后才以密文落库。

#### 4.3.4 `ip_assets`（知识产权台账）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id / public_id | — | PK / UNIQUE | — |
| enterprise_id | BIGINT UNSIGNED | NOT NULL, INDEX | — |
| category | VARCHAR(8) | NOT NULL, CHECK IN ('I','II') | Ⅰ类/Ⅱ类 |
| sub_type | VARCHAR(24) | NOT NULL | 发明专利/国防专利/植物新品种/国家级农作物品种/国家新药/国家一级中药保护品种/集成电路布图设计专有权/实用新型/外观设计/软件著作权 |
| name | VARCHAR(200) | NOT NULL | — |
| cert_no | VARCHAR(64) | NULL, INDEX(enterprise_id, cert_no) | 证书号（重复输入时给出警示） |
| grant_evidence | VARCHAR(16) | NOT NULL DEFAULT 'cert', CHECK IN ('cert','notice_receipt','none') | 授权证书 / 授权通知书+缴费收据 / 无 → 仅前两者计入数量 |
| authorize_date | DATE | NULL | 授权日 |
| protection_expire_date | DATE | NULL | 保护期止（判定"有效保护期内"） |
| obtain_way | VARCHAR(16) | NULL, CHECK IN ('self_rd','transfer','donate','m&a','other') | 获得方式（支撑 IP_OBTAIN 档位） |
| status | VARCHAR(16) | NOT NULL DEFAULT 'granted', CHECK IN ('granted','pending','invalid') | 只有 granted 计入数量 |
| owner_is_applicant | TINYINT(1) | NOT NULL DEFAULT 1 | 权属人为本企业 |
| co_owners_count | TINYINT UNSIGNED | NOT NULL DEFAULT 0 | 权属人数量 |
| exclusive_use_by_us | TINYINT(1) | NOT NULL DEFAULT 1 | 多权属人时本企业是否为唯一使用方（否则不计） |
| **used_in_assessment** | TINYINT(1) | NOT NULL DEFAULT 0, INDEX | **C-2：Ⅱ类是否已用于往期认定** |
| used_refer_assessment_id | BIGINT UNSIGNED | NULL | 指向使用该资产的评估（追溯） |
| used_year | SMALLINT | NULL | 用于哪一年申报 |
| is_standard_participation | TINYINT(1) | NOT NULL DEFAULT 0 | 参与编制国标/行标/检测方法/技术规范（加分项） |
| standard_desc | VARCHAR(500) | NULL | 标准名称与署名说明 |
| advance_level / support_level | VARCHAR(2) | NULL, CHECK IN ('A','B','C','D','E') | 主观档位（也可由全表默认档驱动） |
| excluded | TINYINT(1) | NOT NULL DEFAULT 0 | 人工剔除（不计数、但保留记录） |
| remark | VARCHAR(500) | NULL | 备注（提交时过敏感词过滤） |
| created_at / updated_at / deleted_at / delete_mark | — | — | — |

#### 4.3.5 `tech_achievements`（成果转化台账）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id / public_id | — | PK / UNIQUE | — |
| enterprise_id | BIGINT UNSIGNED | NOT NULL, INDEX | — |
| achievement_name | VARCHAR(200) | NOT NULL | — |
| achievement_group_id | CHAR(36) | NULL, INDEX | **去重主键**：同一成果的不同 form / 国内外转化共享同一值 |
| dedup_key | CHAR(64) | NOT NULL, INDEX(enterprise_id, dedup_key) | 落库前计算（group_id 优先，否则 `sha256(name_norm + first_year)`） |
| convert_year | SMALLINT | NOT NULL, INDEX | 转化年度（超三年窗口即标灰不计入） |
| forms | JSON | NOT NULL | ["产品","服务","工艺","样品","样机"] 数组（多值只计一项） |
| is_domestic_and_overseas | TINYINT(1) | NOT NULL DEFAULT 0 | 同一成果国内外均转化 → 仍计一项 |
| count_as | TINYINT UNSIGNED | NOT NULL DEFAULT 1 | 恒为 1，保留字段用于审计与未来政策变更 |
| evidence_note | VARCHAR(500) | NULL | 佐证说明（V1.1 升级为附件） |
| created_at / updated_at / deleted_at / delete_mark | — | — | — |

#### 4.3.6 `rd_management_selfcheck`（组织管理自评）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id / public_id | — | PK / UNIQUE | — |
| enterprise_id | BIGINT UNSIGNED | NOT NULL, **UNIQUE**(enterprise_id, delete_mark) | 一对一 |
| check_items | JSON | NOT NULL | `{"M1_A":true,"M1_B":true,...,"M4_D":false}`，11 个子项布尔位 |
| item_scores | JSON | NOT NULL | `{"MGMT_1":6,"MGMT_2":3,"MGMT_3":2,"MGMT_4":1}`（引擎算得后回填，含 cap 截断结果） |
| self_total | SMALLINT UNSIGNED | NOT NULL DEFAULT 0 | ≤20 |
| remark | VARCHAR(500) | NULL | — |
| created_at / updated_at / deleted_at / delete_mark | — | — | — |

#### 4.3.7 `assessments`（一次评估 / 方案）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id / public_id | — | PK / UNIQUE | — |
| enterprise_id | BIGINT UNSIGNED | NOT NULL, INDEX | — |
| parent_id | BIGINT UNSIGNED | NULL | 方案克隆/按新规则重算的来源（PRD F-18 预留） |
| scenario_name | VARCHAR(100) | NOT NULL DEFAULT '我的方案1' | — |
| **policy_version** | VARCHAR(32) | NOT NULL, INDEX | 规则包版本（可复算锚点） |
| rulepack_sha256 | CHAR(64) | NOT NULL | 规则包指纹，复算一致性校验 |
| strategy | VARCHAR(16) | NOT NULL DEFAULT 'conservative', CHECK IN ('conservative','balanced','optimistic') | 展示口径 |
| **input_snapshot_json** | JSON | NOT NULL | 计算输入的完整快照（不含/或含密文敏感字段），复算基准 |
| **result_json** | JSON | NOT NULL | 输出完整快照（items/indicators/totals/verdict/diagnosis），`recompute` diff 基准 |
| ip_score_min/max, conv_score_min/max, mgmt_score_min/max, growth_score_min/max | SMALLINT UNSIGNED | NOT NULL DEFAULT 0 | 指标级双档（冗余列，供后台列表与看板快速筛选，避免 JSON 检索） |
| total_conservative / total_optimistic / total_practice | SMALLINT UNSIGNED | NOT NULL DEFAULT 0 | 保守/乐观/实务参考（实务列不进判定） |
| is_qualified | TINYINT(1) | NOT NULL DEFAULT 0 | `total_conservative >= 71` |
| verdict | VARCHAR(16) | NOT NULL, CHECK IN ('QUALIFIED','EDGE','FAIL') | 三态 |
| gap_score | SMALLINT UNSIGNED | NOT NULL DEFAULT 0 | `max(0, 71 − total_conservative)` |
| precheck_pass | TINYINT(1) | NULL | NULL＝未完成；1＝通过；0＝有未通过项 |
| precheck_failed_codes | JSON | NULL | 如 `["C4","C7"]` |
| duration_ms | SMALLINT UNSIGNED | NULL | 引擎耗时，性能观测 |
| status | VARCHAR(16) | NOT NULL DEFAULT 'draft', CHECK IN ('draft','calculated','exported','archived') | 状态机：draft→calculated→exported→archived |
| calculated_at | DATETIME(3) | NULL | — |
| created_at / updated_at / deleted_at / delete_mark | — | — | — |

索引：`INDEX idx_list (enterprise_id, status, updated_at)`、`INDEX idx_board (policy_version, total_conservative)`（看板分布）。

#### 4.3.8 `assessment_items`（评分项明细快照）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED | PK, AI | — |
| assessment_id | BIGINT UNSIGNED | NOT NULL, INDEX | — |
| indicator_code | VARCHAR(16) | NOT NULL, CHECK IN ('IP','CONV','MGMT','GROWTH') | — |
| item_code | VARCHAR(32) | NOT NULL | 如 `IP_COUNT` / `GROWTH_ASSET` |
| level_code | VARCHAR(2) | NULL | 命中档位 A~F |
| score_min / score_max | SMALLINT UNSIGNED | NOT NULL | 该项双档（checklist 类二者相等） |
| score_value_display | DECIMAL(4,1) | NULL | `balanced` 策略展示值（中值） |
| practice_value | SMALLINT UNSIGNED | NULL | IP_OBTAIN 实务参考值（仅展示） |
| formula | VARCHAR(500) | NOT NULL | **可解释计算过程**（原样进报告） |
| inputs_json | JSON | NULL | 该项输入值（如 class1/class2/avg） |
| edge_code | VARCHAR(32) | NULL | 边界命中码（`V1_ZERO`/`V2_ZERO`/`BOTH_ZERO`/`NEGATIVE_CLAMPED`/`BIZ_YEARS_2_V1_ZERO`/`BIZ_YEARS_1`） |
| policy_ref_id | BIGINT UNSIGNED | NULL | 弱引用 policy_refs（历史锚点） |
| created_at | DATETIME(3) | NOT NULL | — |

#### 4.3.9 `reports` / `snapshots`

**`reports`**（导出产物）

| 字段 | 类型 | 说明 |
|------|------|------|
| id / public_id | — | PK / UNIQUE |
| assessment_id | BIGINT UNSIGNED, INDEX | — |
| format | VARCHAR(8), CHECK IN ('pdf','xlsx') | — |
| version | SMALLINT UNSIGNED DEFAULT 1 | 同一评估重复导出的版本号 |
| status | VARCHAR(16), CHECK IN ('queued','generating','ready','failed') | 异步状态机 |
| file_key | VARCHAR(255) NULL | COS 对象键 |
| file_size / page_count | INT UNSIGNED NULL | — |
| download_token_hash | CHAR(64) NULL | 下载凭证哈希（不存明文） |
| share_masked | TINYINT(1) DEFAULT 1 | 是否脱敏（企业名/信用代码打码） |
| error_code / error_msg | VARCHAR(255) NULL | 失败原因 |
| expire_at | DATETIME(3) | 与快照同生命周期 30 天 |
| created_at / updated_at / deleted_at / delete_mark | — | — |

**`snapshots`**（30 天短链・**密文快照，C-4**）

| 字段 | 类型 | 说明 |
|------|------|------|
| id / public_id | — | PK / UNIQUE |
| assessment_id | BIGINT UNSIGNED NULL, INDEX | 可为纯输入快照（未出结果也能保存） |
| **token_hash** | CHAR(64) NOT NULL, UNIQUE | URL 令牌的 SHA-256（**库内不存明文令牌**，DB 泄露也无法构造链接） |
| token_prefix | CHAR(8) NOT NULL, INDEX | 明文令牌前 8 位，仅用于管理后台人工定位（不可用于还原） |
| **payload** | VARBINARY NULL | AES-256-GCM 密文：完整输入草稿 JSON；**加密密钥由 `HKDF(master_key, token)` 派生 → 无令牌即无法解密**（满足"快照不含企业敏感明文"） |
| payload_alg | VARCHAR(24) NOT NULL DEFAULT 'AES-256-GCM' | — |
| nonce | VARBINARY(12) NOT NULL | GCM nonce |
| **summary_json** | JSON NOT NULL | **仅非敏感派生信息**：policy_version、biz_years、total_conservative/optimistic、verdict、gap、indicator 得分、create_at；供后台统计与分享页概览 |
| masked_name | VARCHAR(200) NULL | 脱敏企业名（如"某科技有限公司"） |
| status | VARCHAR(16), CHECK IN ('active','revoked','expired') | 状态机 |
| ttl_days | SMALLINT UNSIGNED NOT NULL DEFAULT 30 | ≤30 |
| expire_at | DATETIME(3) NOT NULL, INDEX | 到期后由定时任务置 expired 并物理删除 payload |
| last_accessed_at | DATETIME(3) NULL | — |
| created_at / updated_at / deleted_at / delete_mark | — | — |

> **清理策略**（同时满足 C-4 与 §8 留存最小化）：每日 03:00 定时任务扫描 `expire_at < NOW()` → `status='expired'` → 置空 `payload`（物理删除密文）→ 保留 `summary_json` 用于聚合统计 90 天后归档。

#### 4.3.10 `policy_versions` / `policy_rules` / `policy_refs` / `advice_templates`

| 表 | 关键字段 | 说明 |
|----|----------|------|
| `policy_versions` | id, version VARCHAR(32) UNIQUE, display_name, region_code VARCHAR(16) DEFAULT 'CN', status CHECK IN ('draft','published','archived'), effective_date, expire_date, **checksum_sha256**, **rulepack_json JSON**, parent_version, change_log TEXT, published_by, published_at, rollback_of, created_at/updated_at | 唯一 published 约束：应用层保证同一 region_code 下仅一条 `published`（MySQL 8 可用生成列 + 唯一索引实现） |
| `policy_rules` | id, version（→policy_versions）, indicator_code, item_code, level_code, label, desc_text, example, evidence_hint, score_min, score_max, practice_value, when_expr, policy_ref_id, sort_no, created_at/updated_at | 后台按行可视化编辑的来源；发布时编译成 rulepack_json |
| `policy_refs` | id, doc_code CHECK IN ('METHOD','GUIDE'), doc_name, **doc_no**, article_no, original_text TEXT, source_url, region_code, publish_date, status, created_at/updated_at | 文号固定：`国科发火〔2016〕32号` / `国科发火〔2016〕195号`（PRD C6 统一双文号） |
| `advice_templates` | id, action_code, item_code, title_tpl, materials_json, effort, lead_time_days, policy_ref_id, enabled, version, created_at/updated_at | 建议文案库（**规则化，禁接大模型**） |

#### 4.3.11 `audit_logs` / `events` / `admin_users`

| 表 | 关键字段 | 说明 |
|----|----------|------|
| `admin_users` | id, username UNIQUE, password_hash(argon2id), totp_secret_enc, role, status, last_login_ip, created_at | 后台账号，V1.0 仅此一处有登录 |
| `audit_logs` | id, actor_type('admin','guest','system'), actor_id, action, target_type, target_id, before_json, after_json, ip_hash, ua_hash, created_at INDEX | **留存 ≥180 天**（参考文件 §9 审计 ≥6 个月） |
| `events` | id, session_id_hash, guest_token_hash, event_name, props_json, page_path, ua_truncated, ip_hash, created_at INDEX(event_name, created_at) | 埋点（PRD §8.3 的 16 个 P0 事件）；**禁止写入任何财务/信用代码字段**；按月分区归档，主表保留 6 个月 |

---

## 5. API 设计

### 5.1 通用约定

- 基址：`https://{domain}/api/v1`（后台：`/admin/v1`，独立鉴权）；
- 统一响应：`{ "code": 0, "message": "ok", "data": {...}, "request_id": "01J..." }`；**禁止 200 包一切**：HTTP 状态码与 code 分段对齐；
- 资源名复数 + HTTP 动词；动作类用子资源（`POST /assessments/{id}/clone`）；
- 分页：`page`（默认 1）+ `page_size`（默认 20，最大 100），返回 `{items, total, page, page_size}`；
- 幂等：所有 POST 写操作要求 `Idempotency-Key` 头（UUID），服务端缓存结果 24h（Redis，缺失时退化内存 Map）；
- 鉴权：游客态 —— `Cookie: gst=<opaque>; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`；跨设备/清 Cookie 后的数据恢复**仅**通过短链（`/s#token`）；
- 敏感字段一律不出现在日志、埋点、错误信息中（pino redact 白名单机制 + 单测断言）。

### 5.2 错误码规范

| code 段 | 含义 | HTTP |
|---------|------|------|
| 0 | 成功 | 200 |
| 10000~10999 | 参数/校验失败（`10001` 字段缺失/类型错、`10002` 值域越界、`10003` 业务完整性冲突如证书号重复） | 400 / 422 |
| 20000~20999 | 业务规则（`20001` 资格预检未通过（不阻断计算，仅标记）、`20002` 规则包版本不存在、`20003` 台账为空导致某模块 0 分） | 200（携带业务语义） / 409 |
| 30000~30999 | 鉴权（`30001` 游客令牌缺失/失效、`30002` 资源不属于当前会话、`30003` 后台未登录、`30004` TOTP 校验失败、`30005` IP 不在白名单） | 401 / 403 |
| 40000~40999 | 资源（`40001` 不存在、`40002` 短链已过期/已撤销、`40003` 导出任务未完成） | 404 / 410 |
| 50000~50999 | 服务端（`50001` 未捕获异常、`50002` PDF 渲染超时、`50003` 对象存储不可用、`50004` 数据库不可用） | 500 / 503 |

### 5.3 接口清单

#### M1 游客会话与短链

| 方法 | 路径 | 请求体要点 | 响应体要点 | 幂等 |
|------|------|-----------|-----------|------|
| POST | `/api/v1/sessions` | `{ua_fingerprint?: string}` | `{guest_id, expires_at}` + Set-Cookie `gst` | 否（天然新建） |
| GET | `/api/v1/sessions/current` | — | `{guest_id, created_at, has_draft, draft_updated_at}` | — |
| POST | `/api/v1/snapshots` | `{assessment_id?, draft: <完整输入草稿>, summary: {...}, ttl_days?: <=30, masked?: true}` | `{snapshot_id, token, url: "https://host/s#<token>", expire_at}`；服务端用 token 派生密钥加密 `draft` 后落 `payload` | 是 |
| GET | `/api/v1/snapshots/resolve` | Header `X-Snapshot-Token: <token>`（**不进 URL**） | `{snapshot_id, summary, masked_name, draft: <解密后草稿>, assessment_result?}` | — |
| DELETE | `/api/v1/snapshots/{token}` | — | `{revoked:true}`；立即置 `status='revoked'` 并物理删除 payload | 是 |

#### M2/M3/M4/M5/M6 台账类

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/enterprises` | 建档：`{name?, establish_date, industry_field_l1/l2/l3, declare_type, declare_year, biz_years(enum 1\|2\|3), employee_count?, tech_staff_count?, storage_mode?}` → 校验 `biz_years` 与 `establish_date` 一致性（不一致返回 `10002` + 提示） |
| GET/PATCH/DELETE | `/api/v1/enterprises/{id}` | 查改删（软删；`30002` 越权拦截） |
| PUT | `/api/v1/enterprises/{id}/fiscal-years` | 批量 upsert：`{items:[{fiscal_year, seq(1\|2\|3), net_asset, revenue, is_estimated}], biz_years}` → 服务端仅做结构与值域校验，**`local_only` 模式不明文落库**（只回显规范化后的值） |
| GET | `/api/v1/enterprises/{id}/fiscal-years` | 回显（读本地草稿时不走此接口；云同步后由此返回解密值） |
| GET | `.../ip-assets` | 分页 + 统计：`{items, total, stats:{class1_count, class2_usable, class2_excluded_used, standard_participation}}` |
| POST | `.../ip-assets` | 单条新增（字段见 §4.3.4；`cert_no` 重复 → `10003` 警示） |
| POST | `.../ip-assets:batch` | 批量导入 ≤50 条/次，返回 `{created, failed:[{row, code, message}]}`（V1.0 仅手工录入/粘贴，Excel 批量为 V1.1） |
| PATCH/DELETE | `.../ip-assets/{asset_id}` | 单条更新/软删 |
| GET/POST | `.../tech-achievements`（同上三件套 + `:batch`） | 成果转化台账 |
| GET/PUT | `.../rd-management-selfcheck` | `{check_items:{M1_A..M4_D}, item_scores, self_total, remark}` |

#### M2 资格预检

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/enterprises/{id}/precheck` | 入参：成立日期/行业领域/人员数/三项研发费用/最近一年销售收入/三年销售合计/高新收入/事故声明/有效 IP 数量；出参：`{pass:bool, results:[{code:"C1".."C8", status:"pass"\|"fail"\|"unknown", detail:{...}, policy_ref, remedy}]}`，`C5` 的 detail 含 §3.5.3 四元结构 |

#### M7 评分计算

| 方法 | 路径 | 说明 |
|------|------|------|
| **POST** | `/api/v1/assessments/calculate` | 入参：`{enterprise_id, inputs:{fiscal, ip_selection:{advance_level, support_level, obtain_way, standard_participation}, ip_assets_snapshot?, tech_achievements_snapshot?, mgmt_check_items}, policy_version?, strategy?, persist?: false}`；出参：`{assessment_id, policy_version, rulepack_sha256, indicators:[{code,name,cap,total_min,total_max,items:[{item_code,score_min,score_max,band,formula,inputs,edge_code,policy_ref}]}], totals:{conservative,optimistic,practice_total}, verdict, gap, precheck:{...}, diagnosis:[...], evaluated_at}`。**幂等键必填**；`persist=false` 时不写 `assessments`（仅算不算存） |
| POST | `/api/v1/assessments/{id}/recompute` | 用历史 input_snapshot + 历史 policy_version 重放，返回 diff；断言 diff 为空 |
| GET | `/api/v1/assessments/{id}` | 返回完整 result_json（只读快照，含 items 与 diagnosis） |
| GET | `/api/v1/assessments?enterprise_id=&page=&page_size=` | 方案列表（返回汇总冗余列：双档总分/verdict/gap/policy_version） |
| POST | `/api/v1/assessments/{id}/clone` | 基于 `parent_id` 克隆为新方案（V1.0 提供，源自 PRD F-18 的轻量版） |
| POST | `/api/v1/assessments/{id}/preview-action` | 入参 `{action_code}` → 反事实模拟：`{delta_min, delta_max, new_verdict, new_total_conservative, advisable:true}`（供结果页"点一下看能加几分"） |

#### M8 报告导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/reports/export` | `{assessment_id, format:"pdf"\|"xlsx", masked?:true}` → `202 {report_id, task_id, estimated_seconds}` |
| GET | `/api/v1/reports/{report_id}` | 轮询：`{status:"queued"\|"generating"\|"ready"\|"failed", progress:0-100, page_count?, error_code?}`（前端 0.5s 轮询，最多 60 次） |
| GET | `/api/v1/reports/{report_id}/download` | 302 到 COS 带签名临时 URL（有效期 300s）；或流式直下（本地联通方案） |
| POST | `/api/v1/reports/{report_id}/revoke` | 删除产物 + 作废下载令牌（"一键删除"合规要求） |

#### M9 政策内容（公开只读，供 SEO 与结果页政策抽屉）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/policy/versions` | 当前生效版本摘要（含两文号、effective_date、display_name、最近 changelog） |
| GET | `/api/v1/policy/rulepack?version=` | 返回已编译规则包（前端浏览器端实时算分用，**仅含分数与文案，不含后台敏感配置**） |
| GET | `/api/v1/policy/refs?item_code=IP_COUNT` | 返回 `{doc_name, doc_no, article_no, original_text, source_url}`；缺锚点的 item 返回 `20001`（发布门禁已前置拦截，理论上不出现） |

#### M10 管理后台 `/admin/v1`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/admin/v1/auth/login` | `{username,password,totp}` → 会话 Cookie；失败 5 次锁 15 分钟 |
| GET/POST | `/admin/v1/policy-versions` | 列表/新建草稿 |
| PATCH | `/admin/v1/policy-versions/{id}` | 编辑档位与文案（draft 态才允许） |
| POST | `/admin/v1/policy-versions/{id}/publish` | **二次确认** + diff + 回归门禁 → 发布；返回 `{published:true, old_version_archived:...}` |
| POST | `/admin/v1/policy-versions/{id}/rollback` | 回滚到指定历史版本（内部＝克隆+发布） |
| GET | `/admin/v1/assessments?keyword=&verdict=&page=` | 查询（信用代码/财务默认脱敏，需 `sensitive_view` 权限 + 二次确认才显明文） |
| GET | `/admin/v1/assessments/export.csv` | 导出 CSV（**强制脱敏**，不含投递参数） |
| GET | `/admin/v1/dashboard` | 看板：达标分布、失分项 Top、完成率漏斗、边界码分布（仅读 `summary_json` 与冗余列） |
| GET | `/admin/v1/audit-logs` | 审计日志查询（≥180 天） |

### 5.4 示例

**请求**

```http
POST /api/v1/assessments/calculate HTTP/1.1
Host: hitech.example.com
Content-Type: application/json
Cookie: gst=eyJ...; 
Idempotency-Key: 8f14e45f-ea0a-4c1b-9d3f-2b7a5c9e0001

{
  "enterprise_id": "01J8ZK9X2N7M4W31T6P0",
  "policy_version": "2026.10-national-2016",
  "strategy": "conservative",
  "inputs": {
    "biz_years": 3,
    "fiscal": [
      {"fiscal_year": 2023, "seq": 1, "net_asset": 10000000, "revenue": 20000000},
      {"fiscal_year": 2024, "seq": 2, "net_asset": 12000000, "revenue": 26000000},
      {"fiscal_year": 2025, "seq": 3, "net_asset": 15000000, "revenue": 35000000}
    ],
    "ip_selection": {"advance_level": "C", "support_level": "B", "obtain_way": "A", "standard_participation": false},
    "ip_assets_snapshot": [
      {"category": "II", "sub_type": "软件著作权", "status": "granted", "used_in_assessment": false, "exclusive_use_by_us": true},
      {"category": "II", "sub_type": "实用新型",   "status": "granted", "used_in_assessment": true,  "exclusive_use_by_us": true}
    ],
    "tech_achievements_snapshot": [
      {"achievement_group_id": "g-001", "convert_year": 2025, "forms": ["产品"]},
      {"achievement_group_id": "g-001", "convert_year": 2025, "forms": ["样品","样机"], "is_domestic_and_overseas": true},
      {"achievement_group_id": "g-002", "convert_year": 2024, "forms": ["工艺"]}
    ],
    "mgmt_check_items": ["M1_A","M1_B","M2_A","M3_A","M4_A","M4_B"]
  }
}
```

**响应（节选）**

```json
{
  "code": 0,
  "message": "ok",
  "request_id": "01J8ZK9X2N7M4W31T6P0",
  "data": {
    "assessment_id": "01J8ZK9X2N7M4W31T6P1",
    "policy_version": "2026.10-national-2016",
    "rulepack_sha256": "9c2f...e71a",
    "indicators": [
      { "code": "IP", "name": "知识产权", "cap": 30, "applied_cap": false, "total_min": 10, "total_max": 18,
        "items": [
          { "item_code": "IP_ADVANCE", "score_min": 3, "score_max": 4, "band": "C",
            "formula": "一般 档 → 政策区间 3~4 分", "policy_ref": "国科发火〔2016〕195号 知识产权·①" },
          { "item_code": "IP_COUNT", "score_min": 1, "score_max": 2, "band": "D",
            "formula": "Ⅰ类=0 项，Ⅱ类可用=1 项（去除已用于往期认定=1 项）→ Ⅱ类 1~2 项 档",
            "inputs": {"class1": 0, "class2": 1, "excluded_used": 1} },
          { "item_code": "IP_OBTAIN", "score_min": 1, "score_max": 6, "band": "A", "practice_value": 4,
            "formula": "有自主研发 档 → 政策区间 1~6 分（实务参考值 4，仅供准备材料参考）" }
        ] },
      { "code": "CONV", "name": "科技成果转化能力", "cap": 30, "total_min": 1, "total_max": 6,
        "items": [{ "item_code": "CONV_AVG", "score_min": 1, "score_max": 6, "band": "E",
          "formula": "年均 = 去重后转化数 2 ÷ 实际经营年数 3 = 0.67 → ≥1 项 档",
          "inputs": {"total": 3, "inWindow": 3, "afterDedup": 2, "N": 3} } ] },
      { "code": "MGMT", "name": "研究开发组织管理水平", "cap": 20, "total_min": 11, "total_max": 11,
        "items": [ { "item_code": "MGMT_1", "score_min": 4, "score_max": 4, "formula": "已勾选 2 项 → 合计 4，上限 6", "headroom": 2 } ] },
      { "code": "GROWTH", "name": "企业成长性", "cap": 20, "total_min": 12, "total_max": 14,
        "items": [
          { "item_code": "GROWTH_ASSET", "score_min": 5, "score_max": 6, "band": "C",
            "formula": "g = 1/2 × (v2/v1 + v3/v2) − 1 = 22.5000% → ≥15% 档", "edge_code": null },
          { "item_code": "GROWTH_REVENUE", "score_min": 7, "score_max": 8, "band": "B",
            "formula": "g = 1/2 × (v2/v1 + v3/v2) − 1 = 32.3077% → ≥25% 档" } ] }
    ],
    "totals": { "conservative": 34, "optimistic": 49, "practice_total": 37 },
    "verdict": "FAIL",
    "verdict_label": "不达标（需重点补短板）",
    "gap": 37,
    "precheck": { "pass": false, "results": [
      { "code": "C4", "status": "unknown", "detail": {}, "policy_ref": "国科发火〔2016〕32号 第十一条", "remedy": "补填当年职工总数与科技人员数" },
      { "code": "C7", "status": "fail", "detail": {"required": 0.60, "actual": 0.42},
        "policy_ref": "国科发火〔2016〕32号 第十一条", "remedy": "核增高新产品（服务）收入归集口径或调整收入结构" } ] },
    "diagnosis": [
      { "action_code": "ADD_CLASS1_IP", "priority": 1, "delta_min": 6, "delta_max": 6,
        "text": "布局 1 项Ⅰ类知识产权（发明专利等），数量项 D 档（1-2 分）→ A 档（7-8 分），预计 +6 分",
        "materials": ["发明专利申请文件","实质审查材料"], "effort": "high", "lead_time_days": 730,
        "policy_ref": "国科发火〔2016〕195号 知识产权·③" },
      { "action_code": "MGMT_CHECK_ITEM", "priority": 2, "delta_min": 2, "delta_max": 2,
        "text": "补齐「研发费用辅助账」制度文件并留痕，组织管理 MGMT_1 由 4 分→6 分，预计 +2 分（立即可做，投入产出比最高）",
        "materials": ["辅助账制度文件","研发费用归集表"], "effort": "low", "lead_time_days": 15,
        "policy_ref": "国科发火〔2016〕195号 组织管理水平·①" },
      { "action_code": "IP_EVIDENCE_UP", "priority": 3, "delta_min": 2, "delta_max": 2,
        "text": "补充查新报告/第三方检测，将「技术先进程度」由 一般(3-4) 提升一档至 较高(5-6)，预计 +2 分",
        "materials": ["查新报告","第三方检测报告"], "effort": "low", "lead_time_days": 30,
        "policy_ref": "国科发火〔2016〕195号 知识产权·①" },
      { "action_code": "ADD_CLASS2_IP", "priority": 4, "delta_min": 2, "delta_max": 2,
        "text": "再申请 2 项Ⅱ类知识产权（当前Ⅱ类可用 1 项→3 项），数量项 D 档(1-2)→C 档(3-4)，预计 +2 分",
        "materials": ["软著登记证书","研发立项记录"], "effort": "mid", "lead_time_days": 90,
        "policy_ref": "国科发火〔2016〕195号 知识产权·③" }
    ],
    "feasible_plan": { "target_score": 71, "current_conservative": 34, "gap": 37,
      "note": "现有候选动作组合不足以一次性补齐 37 分，建议优先执行建议 2/3（低投入 +4 分），并同步启动建议 1（长周期、+6 分）与成果转化补录" },
    "evaluated_at": "2026-10-08T10:20:31.442+08:00"
  }
}
```

> 注：同一 input 在浏览器端与服务端分别调用同一份 `@hitech/rule-engine`，结果必须逐项相同；CI 内置"双端一致性"快照测试（同一 golden case 在 Node 与 jsdom 环境各跑一遍比对）。

**[技术研发方案]**
