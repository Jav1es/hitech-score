# 高新技术企业认定评分测算系统 —— 上线发布方案 v1.0（Phase 3）

> 承接角色：**上线发布师（release-manager）**｜全栈智造专家团 Phase 3
> 参考依据：`skills/forge-orchestrator/references/release-deployment.md`（已全文读取，CI/CD 基础流程 / 部署方案对比 / 商店审核 / 灰度与回滚模板 / 上线 Checklist / 证书签名坑 / 72 小时观察 逐章落实）
> 上游输入（不冲突承诺）：
> ① `phase1-需求与平台选型报告.md`（选品洞察师）｜② `phase1-产品定义方案-PRD.md`（产品主理人，含附录 A/B 团长裁决）｜③ `phase1-技术研发方案.md`（全栈研发师）
> 下游交付：部署形态、回滚预案、发布窗口 → 运维守护师（Phase 4 监控告警与应急衔接）

---

## 0. 发布基线与适用性声明

### 0.1 项目发布形态（一眼看清）

| 维度 | 本项目事实 | 发布含义 |
|------|-----------|----------|
| 端形态 | **PC Web 响应式单端 + Web 管理后台** | 唯一发布对象是**网站/后台**（参考文件 §3.4 / §七-网站后台） |
| App（iOS） | 明确不做 | **App Store 审核 —— 本项目不适用**（不套用 §3.1） |
| 鸿蒙 / 安卓市场 | 明确不做 | **华为 AGC / 各安卓市场 —— 本项目不适用**（不套用 §3.2） |
| 微信小程序 | V1.0 不做（V2 条件触发） | **小程序审核 / 服务器域名白名单 —— 本项目不适用**（不套用 §3.3）；若 V2 启动需另出增补方案 |
| 移动端 | H5 响应式降级 | 随 Web 一并发布，无独立发版节奏 |
| 部署 | 单台 2C4G 云服务器 + Docker Compose + Nginx + certbot | 单机部署 → **无蓝绿/多实例滚动**，灰度须走"软灰度"（§9） |
| 关键路径 | **ICP 备案 1~3 周，D1 启动** | 备案未通过前**禁止对外正式发布**（§5） |

> **适用性结论**：本项目**无应用商店审核周期**（选型报告 §4.3 明确这是本项目的工期优势）。因此本方案将参考文件第三章（App Store / 华为 / 小程序）**整体标记为"本项目不适用"**，但**保留其等价风险位**：把"证书/签名/域名白名单"类高频失败点映射为本项目的 **HTTPS 证书、域名备案与解析、COS/CDN 回源域名、Cookie 安全属性、规则包校验和**五类核验项（见 §12 Checklist），做到"不套流程、不漏风险"。

### 0.2 硬约束在发布层面的落实对照

| 上游硬约束 | 本方案落实点 |
|-----------|-------------|
| C-1 三态 `biz_years ∈ {1,2,3}` | §3 阶段 3 单测门禁（16 组财务边界）+ §3 阶段 4 双端一致性快照，任一失败**禁止出制品** |
| C-2 知识产权档位 + Ⅱ类仅用一次 | §3 阶段 3 规则引擎 golden case；§4.3 规则包作为独立可回滚制品 |
| C-3 研发费用分档基准＝最近一年销售收入 | §3 阶段 3 + §8 合规引用核验（分档基准文案与文号一致） |
| C-4 V1.0 免登录、30 天短链密文快照 | §4.4 短链快照兼容性、§7.5 COS/短链回滚、§8 个人信息保护（不收手机号）；**发布前断言全站无 `/login /register /forgot /logout` 路由** |
| 三处免责声明 + 政策文号/条款/版本日期 | §8 风险表 + §12 Checklist 第 6 项（自动化断言，非人工记忆） |
| 禁止生成式 AI | §3 阶段 2 依赖许可扫描 + §8 风险 R-06（CI 禁止引入 LLM SDK） |
| 严禁第三方统计脚本 | §3 阶段 2 依赖与外链扫描、`Content-Security-Policy` 上线核验 |
| 单机 2C4G | §9 软灰度、§9.5 扩容触发线 |

### 0.3 与上游口径的三处"取更严"说明（提请团长知悉，不构成冲突）

1. **免责声明处数**：选型报告/本次任务书要求"三处"（首屏、结果页、报告页），PRD §10.1 与补丁 P-08 定义为 **5 处固定位**。→ **取更严：按 5 处落地，其中首屏/结果页/报告页为强制必过项**（另 2 处：分享只读页顶部、隐私/政策依据页脚）。
2. **发布观察期**：参考文件要求 72 小时观察。→ 本项目为**政策测算类工具，分数错误直接损害用户申报决策**，取更严：**首发观察期延长至 7 天**，前 30 分钟为"强观察"（§6.6）。
3. **灰度**：参考文件要求"有真实用户的更新默认走灰度"。→ 本项目**首版冷启动无存量用户**（无线上历史数据、无 App 旧版本兼容负担），理由成立可**简化灰度的放量级数**，但**仍保留"内部白名单 → 小流量 → 全量"三级**（§9），不直接裸奔全量。

---

## 1. 发布目标与原则

### 1.1 发布目标

| 目标 | 量化口径 | 来源 |
|------|---------|------|
| 发布成功率 | 计划内发布一次成功率 ≥ 90%；失败即回滚且 RTO ≤ 15 分钟 | 本方案 §7 |
| 零数据丢失 | 发布/回滚过程中 `assessments` / `snapshots` / `reports` 零丢失；DB 每发布前强制备份 | §6.3 |
| 服务可用性 | 单机 SLO **月度 ≥ 99.5%**；计划内发布窗口停机 ≤ 60 秒 | 技术方案 §2.4 |
| 发布可追溯 | 100% 生产运行镜像来自 CI 制品，版本号 + git sha + 构建号三元组可查 | 参考文件 §一 关键卡点 2/3 |
| 合规零事故 | 免责声明、政策文号、禁词、字体许可 100% 通过自动断言 | §8 |

### 1.2 五条发布原则（不可豁免）

1. **可回滚优先（无回滚不发版）**：任何进入生产的变更，必须先回答"怎么退回去、多久退回去、退回后数据是否兼容"。回答不出 → 不予发布。本方案 §7 给出 **L1~L5 五级回滚**。
2. **制品唯一**：生产运行的**只能是 CI 产出的同一份镜像**（tag = 语义化版本 + git sha）。**严禁本地打包直传生产、严禁在服务器上 `pnpm build`**（技术方案 §1.2 已定 CI/CD＝GitHub Actions + 镜像 + compose pull & up）。
3. **零停机优先，降级兜底**：单机单实例，采用 **"pull 新镜像 → 起新容器 → 健康检查通过 → Nginx upstream 切换/端口切换 → 摘旧容器"** 的准蓝绿（同机双端口，切换耗时 ≤ 5 秒，见 §6.4）。若内存不足以并行双容器（2C4G 场景常见），降级为 **滚动重启 + 维护页**（停机 ≤ 60 秒），并提前公告。
4. **降级策略分层**（Redis 宕机不停服）：
   | 依赖 | 降级行为 | 用户可见影响 |
   |------|---------|-------------|
   | Redis 7 | `REDIS_URL` 为空或连接失败 → 自动退化为进程内 Map（技术方案 §1.2） | 规则包缓存/限流/导出队列退化为单进程语义，**功能不中断** |
   | COS 私有桶 | 上传失败 → 产物落本地卷 + 直下通道（技术方案 §1.2 备选） | 下载链接有效期缩短，需提示"链接 30 天内有效" |
   | Playwright/Chromium | 渲染失败 2 次 → **Excel 兜底**（PRD F-13 异常验收） | PDF 降级为 XLSX，前端明示 |
   | MySQL | 不降级 → 触发 L5 停服维护页 | 全站只读维护页 |
5. **质量门禁一票否决**：测试未达门禁（P0=0、核心链路 100%）→ **拒绝安排发布**，并在发布单注明阻塞项、上报团长，**禁止"带病上线"**。

### 1.3 发布节奏

| 阶段 | 节奏 | 说明 |
|------|------|------|
| 开发期（W1~W5） | 每次 push/PR 跑 CI；merge 到 `main` 自动部署 **preview** | 高频、无门禁审批 |
| 内测期（W4~W5） | 每日构建部署 **staging**，QA 回归 | 每天最多 2 次 |
| 候选发布（W5~W6） | 打 `release/vX.Y.Z` 分支 → 部署 staging → 冻结 → 发布候选 | 每周 1~2 个 RC |
| 正式发布（W6） | **首发 1 次** + 观察期 7 天 | 备案通过后方可 |
| 运营期（W7+） | **每 2 周一个常规版本**；安全/合规/阻断性缺陷走**紧急发布**（≤24h 内） | 规则包勘误走"配置热修"，**不发应用版本** |

### 1.4 发布窗口选择（含申报高峰期权衡）

**结论：首发避开申报截止高峰，常规发布固定周二/周三上午。**

| 考量 | 分析 | 裁决 |
|------|------|------|
| 高新技术企业申报批次 | 各地通常每年 2~3 批（多数省份集中在 4~6 月、8~9 月受理），**截止前 1~2 周是本工具流量峰值** | 峰值期发布 = 影响面最大、价值也最大 |
| 风险权衡 | 峰值期出 P0（如分数算错、PDF 导出失败）会让用户在"最后一刻"拿到错误结论，**损害不可逆**；但完全避开峰值可能错过整年的有效窗口 | **分场景裁决**（下表） |
| 值班资源 | 工作日白天研发/运维均在岗；周末/节假日响应慢 | 发布窗口必须落在有人值班的时段 |

| 发布类型 | 窗口 | 硬约束 |
|---------|------|--------|
| **首发（V1.0.0）** | **工作日（周二/周三）10:00~11:30**，且**避开申报截止前 7 天** | 备案已通过 + 灰度白名单已跑通 + 值班到位 |
| 常规版本（V1.x.0） | 周二/周三 10:00~11:30 或 14:00~16:00 | 发布后强观察 30 分钟 + 当天不出站 |
| 紧急发布（P0 修复/合规止血） | 即时，但须**双人复核 + 团长知会** | 可放宽窗口，但必须补发发布单 |
| **禁止发布时段** | 周五 15:00 后、周末、法定节假日前一天、申报截止日前 3 天内、云厂商公告维护期 | 违反即视为流程违规 |

---

## 2. 环境规划（四套环境）

### 2.1 环境差异总表（必读，配置隔离是本表的核心）

| 项 | **dev**（本地） | **preview**（预览/联调） | **staging**（预发） | **prod**（生产） |
|----|---------------|------------------------|-------------------|----------------|
| 用途 | 开发自测 | 产品/设计验收、备案期间并行演示 | 发布候选、回归、迁移演练 | 对外正式服务 |
| 域名 | `localhost:3000` | `preview.<主域>` 或云厂商临时域名 / Vercel | `staging.<主域>`（**不对外、不解析公网 DNS 或仅内网/VPN 可解析**） | `www.<主域>` + `<主域>` |
| 托管位置 | 开发者本机 | **境外/香港轻量 或 Vercel**（技术方案 §1.2：Vercel **仅可作预览环境**）—— 备案期间大陆机不可对外提供访问 | 大陆云服务器（与 prod 同规格 2C4G，可复用同一台的不同端口/目录） | 大陆云服务器 2C4G（备案主体一致） |
| 数据库 | 本机 MySQL 8.0.36（Docker） | 预览库（云数据库或同机独立 schema） | **独立库 `hitech_staging`**，结构与 prod 完全一致（同一套 migration） | **独立库 `hitech_prod`**，utf8mb4_0900_ai_ci |
| 数据性质 | 造数/种子数据 | 脱敏造数 | **脱敏造数 + prod 结构影子**；**严禁直接连生产库** | 真实用户数据 |
| Redis | 本机 / 进程内降级 | 同机 | 同机独立 DB index（`redis:6379/1`） | 同机（`redis:6379/0`），无持久化 |
| 规则包 policy_version | `2026.10-national-2016` 本地 YAML | 与 main 分支 YAML 一致（CI 校验 sha256） | **与 prod 待发布版本一致的候选包**（可含 draft 包用于验证） | **仅 `status=published`**，sha256 与仓库 YAML 一致（CI 强校验） |
| 规则包发布权限 | 任意 | 任意 | 需二次确认 | **后台发布门禁 + 全量回归 + 二次确认弹窗**（技术方案 §3.3） |
| 真实 PDF/Excel 导出 | ✅（本机 Chromium） | ✅ | ✅（真实导出，验证 A4 排版与字体子集） | ✅ |
| 真实 COS 上传 | ❌ 本地卷模拟 | ❌ 本地卷 / 测试桶（独立桶） | ✅ **独立测试桶**（不共用 prod 桶） | ✅ 私有桶（30 天生命周期 + CDN 回源） |
| Playwright 并发 | 1 | 1 | ≤2（与 prod 同参：并发 ≤2） | ≤2（有界队列） |
| 监控告警 | ❌ | ❌ | **Sentry 接入（独立 project）+ Uptime Kuma 探活**（用于验证告警链路） | ✅ Sentry + Uptime Kuma（1 分钟探活）+ 自建埋点 |
| 告警静音 | — | — | **告警不外发到人**（仅记录），避免演练噪音 | ✅ 外发到值班群/邮件 |
| 埋点上报 | ❌（本地 dev 不上报） | ❌ 或测试 project | ✅ 写入 staging `events` 表 | ✅ 写入 prod `events`（禁止任何第三方脚本） |
| 日志级别 | debug | info | info（pino 结构化） | info + **pino redact 敏感字段**（单测断言） |
| 备份 | ❌ | ❌ | 每次发布前 mysqldump（演练用） | ✅ **云盘快照日备 + mysqldump 加密上传 COS** |
| Cookie `gst` | `Secure=false`（http 本地） | `Secure` + `SameSite=Lax` | `Secure` + `HttpOnly` + `SameSite=Lax` | **`Secure` + `HttpOnly` + `SameSite=Lax` + `Max-Age=2592000`**（技术方案 §5.1） |
| CSP / 安全头 | 宽松 | 与 prod 一致（提前暴露问题） | 与 prod 一致 | **严格 CSP（禁第三方脚本）+ HSTS + Referrer-Policy** |
| robots / SEO | `noindex` | **`noindex, nofollow`** | **`noindex, nofollow`** | ✅ 内容页可索引；**测算/结果页 `noindex`** |
| 密钥来源 | `.env.local`（gitignore） | GitHub Actions Secrets（`PREVIEW_*`） | Secrets（`STAGING_*`） | **Secrets（`PROD_*`）+ 服务器 `.env` 文件（chmod 600），绝不进代码库** |
| 部署触发 | 手动 | push/merge 到 `main` 自动 | 手动（workflow_dispatch）或 RC 分支 | **手动 + GitHub Environment 人工审批** |

### 2.2 环境隔离的三条硬纪律

1. **配置与密钥按环境隔离，生产密钥不进代码库**：所有 `PROD_*` 走 GitHub Actions Secrets + 服务器 `/opt/hitech/.env`（`chmod 600`，属主 `root`，不在 Git 中）。CI 增加 **密钥泄露扫描门禁**（§3 阶段 2）。
2. **环境不串数据**：staging 严禁连 prod 库；staging 严禁写 prod COS 桶；任何"临时连生产库验证"的请求一律拒绝，改为 **prod 只读副本/导出脱敏快照到 staging**。
3. **preview 环境 ≠ 对外服务**：preview 部署在境外/香港或临时域名，**不得用于任何对外宣传、不得投放外链、不得提交搜索引擎**（避免备案前产生对外可访问记录）。

### 2.3 域名规划（建议，需产品/法务确认后定稿）

| 用途 | 建议 | 约束 |
|------|------|------|
| 主站 | `https://www.<主域>`（canonical），`<主域>` 301 跳 www | 便于 CDN 与证书统一管理 |
| 管理后台 | `https://www.<主域>/admin`（**同域路径**，不单独开 `admin.` 子域） | 减少一个证书/备案网站项；配合 **IP 白名单 + 后台二次口令** |
| API | 同源 `/api/v1/*`、`/admin/v1/*` | 无跨域、无额外域名白名单 |
| 静态与产物下载 | 同源 `/static/*`；PDF/Excel 走 302 到 COS 签名 URL（300s） | 若启用 CDN 回源，需**为 COS 域名单独备案/接入**（§5.5） |
| staging/preview | `staging.<主域>` / `preview.<主域>` | **必须 `noindex` + 不对外传播** |
| 禁用的命名 | 含 `china` / `national` / `official` / `gov` / `gaoxinji-shu-qiye-...` 官方近似名、`认定管理` 等 | 选型报告 §5.2 第 5/6 条 + R-04 |

**域名选型建议（供决策）**：优先 `.com` 或 `.cn` 短域名，品牌词建议用中性可注册词（如 `gaoxinpinggu` / `ipscore` / `hitech-score` 类），**避开与"高新技术企业认定管理工作网"（官方平台）近似的任何拼写**；注册前先做 **商标与禁词双重检索**。

---

## 3. CI/CD 流水线设计（GitHub Actions）

### 3.1 流水线总览

```
PR / push main ──► [1 install] ──► [2 lint+typecheck+合规扫描] ──► [3 单测(规则引擎16组+golden)]
                                                                        │
                                                                        ▼
                 ┌──────────────────────────────────────────────────────────────────────┐
                 │ [4 构建] 字体子集化 → next build → docker build(Chromium 内置)        │
                 └──────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                 [5 push 镜像 GHCR/云镜像仓库 tag=v1.0.0-<sha>] ──► [6 deploy preview]
                                        │
                    (打 RC tag / workflow_dispatch)
                                        ▼
                 [7 deploy staging: prisma migrate deploy → up → health] ──► [8 E2E 冒烟]
                                        │
                                        ▼
                        [9 人工确认 (GitHub Environment: prod, required reviewers)]
                                        │
                                        ▼
      [10 deploy prod: 备份 → migrate deploy → 准蓝绿切换 → health → 发布后冒烟 → 埋点自检]
                                        │
                                        ▼
                              [11 观察 30min → 72h → 7d] ──► 异常则触发 §7 回滚
```

### 3.2 阶段明细（门禁 / 耗时 / 缓存）

> 耗时基数为 `ubuntu-22.04` 2 核 runner 实测估算；`冷` = 无缓存，`温` = 命中缓存。

| # | 阶段 | 关键命令 | 门禁条件（任一不满足即中断） | 耗时（冷/温） | 缓存策略 |
|---|------|---------|---------------------------|--------------|---------|
| 1 | **install** | `pnpm i --frozen-lockfile` | lockfile 未变更；`pnpm-lock.yaml` 与 `package.json` 一致 | 90s / 20s | `actions/cache` → `~/.pnpm-store`，key = `pnpm-lock.yaml` hash；`node-version-file: .nvmrc`（Node 20 强校验） |
| 2 | **lint / typecheck / 合规扫描** | `pnpm lint`、`pnpm typecheck`、`python3 tools/compliance/scan_copy.py` | ESLint 0 error；`tsc --noEmit` 0 error；**禁词扫描 0 命中**（§8）；**免责声明 5 处存在性断言通过**；**无 `/login` 等路由** | 90s / 45s | 复用 node_modules；`tools/compliance` 结果缓存（key = 文案文件 hash） |
| — | **依赖许可与泄露扫描**（并入 2） | `pnpm licenses list --json`、`gitleaks` | 无 GPL/AGPL 传染性依赖进入前端 bundle；**无密钥/凭据入库** | +30s | — |
| 3 | **单测（含规则引擎 16 组边界）** | `pnpm test:engine`（§3.6 golden + 16 组财务边界）、`pnpm test`、`python3 tools/rule-audit/run.py`（独立实现交叉校验） | **规则引擎 16 组财务边界 100% 通过**；覆盖率 ≥ 80%（引擎包 ≥ 95%）；**独立实现交叉校验 diff = 0** | 180s / 120s | vitest cache |
| 4 | **双端一致性快照** | `pnpm test:parity`（浏览器产物 vs 服务端同包复算，逐字段 diff） | **逐字段 diff = 0**（技术方案 §2.3 要求"服务端算分与本地算分必须逐项一致"） | 60s | — |
| 5 | **构建** | `python3 tools/fonts/subset.py` → `pnpm build` → `docker build`（BuildKit） | 字体子集产物 ≤ **1.2MB**；`next build` 0 error；镜像构建成功；**镜像内 `chromium --version` 可运行且 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` 生效** | 600s / 240s | ① `.next/cache` ② **Docker layer cache `type=gha,scope=prod`**（Chromium 层是最大的一层，必须命中）③ 字体子集产物按源文件 hash 缓存 |
| 6 | **推送镜像** | `docker push $REGISTRY/hitech-app:v1.0.0-<sha>` 与 `:v1.0.0` | tag 语义化 + git sha 双打；**`latest` 仅作指针，生产不使用** | 180s / 60s | 镜像层共享（与上阶段同 scope） |
| 7 | **部署 preview** | `docker compose pull && up -d` | 容器 healthy | 90s | — |
| 8 | **部署 staging** | `prisma migrate deploy` → `compose up -d` → `curl /api/v1/health` | **migration 成功**；health 200；`/api/v1/ready` 200（DB/Redis 连通） | 150s | — |
| 9 | **E2E 冒烟** | `pnpm test:e2e`（Playwright，复用镜像内 Chromium 或 runner 预装） | 8 条冒烟用例 100% 通过（§6.6 用例表） | 240s / 180s | Playwright 浏览器缓存（如 runner 侧执行） |
| 10 | **人工确认** | GitHub Environment `prod` + required reviewers（≥1 人，发布师 + 研发师） | 发布单已发出并确认；Checklist §12 十项全绿；**备案已通过**；值班到位 | 人工（≥5 min） | — |
| 11 | **部署 prod** | 备份 → `migrate deploy` → 准蓝绿切换 → health → 冒烟 | 见 §6.4 / §6.5 | 300s | — |
| 12 | **发布后冒烟 + 观察** | 冒烟脚本 + 30 分钟强观察 | 错误率 < 1%、P95 < 500ms、导出成功率 ≥ 95% | 30min | — |

**端到端耗时预算**：PR 流水线 ≈ **12 分钟**（温缓存 ≈ 7 分钟）；`main → preview` ≈ 13 分钟；`RC → staging` ≈ 20 分钟（含 E2E）；`staging → prod` ≈ **8 分钟**（含备份与冒烟，人工审批另计）。

### 3.3 Playwright Chromium 与字体子集化的构建耗时控制（本项目特有约束）

| 约束 | 影响 | 控制措施 |
|------|------|---------|
| Chromium 124 预置于镜像，**禁止运行时下载** | 镜像体积大（约 +300~400MB）、构建慢、推送慢 | ① 固定在**独立的 Dockerfile 层**并使用 `type=gha` 层缓存，未变更时不重下；② 使用 `--mount=type=cache` 复用下载目录；③ **多阶段构建**：`builder` 装依赖与 Chromium → `runner` 仅复制 `.next/standalone` + `node_modules` 子集 + Chromium + 字体 |
| 字体子集化（思源黑体 → WOFF2 ≤1.2MB） | `pyftsubset` 为 CPU 密集，每次约 60~120s | ① 产物按 `sha256(源字体+字符集)` 缓存到 `~/.cache/font-subset`，命中则跳过；② **仅在 `tools/fonts/` 或字符集变化时重跑**；③ 子集产物纳入制品，随镜像一起版本化 |
| 单机 2C4G | 生产机内存吃紧，构建不应在服务器上做 | **构建全在 CI 完成，服务器只 `pull`**；服务器上 `docker system prune` 定时清理（保留最近 3 个版本镜像，够回滚） |
| Runner 磁盘/时长 | GH 免费额度有限 | 缓存命中率 > 80% 目标；`concurrency` 组取消 superseded 构建；PR 阶段**不构建镜像**（仅 merge/RC 才构建）以省额度 |

### 3.4 流水线 YAML 骨架（示例，可直接落地）

```yaml
# .github/workflows/release.yml
name: release
on:
  push: { branches: [main] }
  workflow_dispatch: { inputs: { env: { description: 'staging|prod', required: true } } }
concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false        # 发布流水线不取消在途构建，避免半截制品

jobs:
  quality:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc', cache: 'pnpm' }
      - run: pnpm i --frozen-lockfile
      - run: pnpm lint && pnpm typecheck
      - run: python3 tools/compliance/scan_copy.py --strict      # 禁词 + 免责声明断言
      - run: pnpm licenses list --json > licenses.json && python3 tools/compliance/check_licenses.py
      - run: pnpm test:engine && pnpm test                       # 16 组边界 + golden
      - run: pnpm test:parity                                    # 双端一致性
      - run: python3 tools/rule-audit/run.py                     # 独立实现交叉校验

  build:
    needs: quality
    runs-on: ubuntu-22.04
    outputs: { tag: ${{ steps.meta.outputs.tag }} }
    steps:
      - uses: actions/checkout@v4
      - run: python3 tools/fonts/subset.py --cache-key $(sha256sum tools/fonts/*.ttf | awk '{print $1}')
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ secrets.REGISTRY }}/hitech-app:${{ steps.meta.outputs.tag }}
            ${{ secrets.REGISTRY }}/hitech-app:v1.0.0
          cache-from: type=gha,scope=prod
          cache-to:   type=gha,scope=prod,mode=max
          build-args: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/main' || inputs.env == 'staging'
    environment: staging
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          script: |
            cd /opt/hitech && ./deploy.sh ${{ needs.build.outputs.tag }} staging

  deploy-prod:
    needs: [build, deploy-staging]
    if: inputs.env == 'prod'
    environment: prod            # GitHub Environment 配置 required reviewers = 人工确认
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          script: |
            cd /opt/hitech && ./deploy.sh ${{ needs.build.outputs.tag }} prod
```

> **门禁纪律（参考文件 §一 关键卡点 1）**：任一阶段失败 → 工作流 fail → **禁止流入下一环节**；`deploy-prod` 依赖 `deploy-staging` 成功，杜绝"跳过预发直发生产"。

---

## 4. 制品与版本管理

### 4.1 版本号规范

| 项 | 规则 | 示例 |
|----|------|------|
| 应用版本 | `主.次.修订`（技术方案 `package.json`，CI 强校验） | `v1.0.0` |
| 镜像 tag | **语义化版本 + git sha 双打**：`v1.0.0` 与 `v1.0.0-a1b2c3d` | `hitech-app:v1.0.0`、`hitech-app:v1.0.0-a1b2c3d` |
| `latest` | 仅作指针，**生产永不引用 `latest`**（无法精确回滚） | — |
| 制品保留 | **至少保留最近 3 个稳定版本镜像**（服务器保留最近 3 个 + 仓库保留 10 个） | 回滚随时可切 |
| 构建元数据 | 镜像 label 写入 `org.opencontainers.image.revision`（git sha）、`version`、`policy_version`、`rulepack_sha256`、`build_time` | `docker inspect` 可查 |
| 升级节奏 | 大功能/破坏性 → 主版；常规 → 次版；缺陷修复 → 修订（参考文件 §九） | V1.1.0 / V1.0.1 |

### 4.2 三类制品的独立性（关键设计）

本项目**三类制品必须可独立回滚**，这是"无回滚不发版"原则的落地：

| 制品 | 内容 | 发布方式 | 回滚方式 | 回滚耗时 | 是否需停机 |
|------|------|---------|---------|---------|-----------|
| **① 应用镜像** | Next standalone + Node 20 + Chromium + 字体子集 | CI 构建 → compose 切换 tag | 切回上一 tag（§7.1） | ≤ 5 分钟 | 否（准蓝绿）/ ≤60s（滚动） |
| **② 数据库迁移** | `prisma/migrations/*` | 发布时 `prisma migrate deploy` | expand→migrate→contract 兼容回滚（§7.3） | 视变更，一般 ≤10 分钟 | 结构性变更需窗口 |
| **③ 规则包 policy_version** | `policy_versions.rulepack_json` + `checksum_sha256` | 后台发布（**二次确认 + 全量回归**） | 后台一键 rollback（复制历史版本为新 draft → 发布）（§7.2） | ≤ 5 分钟 | **否（热修，不需发版）** |

> **强约束**：规则包变更**不得**通过"发应用版本"来实现（技术方案 §3.1 原则①"改政策改配置不改代码"）。发布单中必须明确本次是"应用发版""规则包发版"还是"两者同时"。

### 4.3 数据库迁移（Prisma）作为独立可回滚制品

| 环节 | 规则 |
|------|------|
| 迁移文件 | `prisma/migrations/<timestamp>_<name>/migration.sql`，**必须提交入库**，禁止 `prisma db push` 上生产 |
| 执行时机 | **部署前**独立步骤：`npx prisma migrate deploy` → 成功后再切镜像（保证"旧代码 + 新库"也能跑，见下条） |
| 向前兼容原则 | **expand → migrate → contract**：① expand（加列/加表/加索引，可空）→ 发版 ② migrate（双写/回填）→ 发版 ③ contract（删旧列/收紧约束）→ 至少**下一个版本**才执行 |
| 不可逆变更 | **禁止上线**（清单见 §7.3.2）。确需时走"停服 + 全量备份 + 双人在场"专项窗口 |
| 演练 | 每次 RC 必须在 **staging 用 prod 结构 + 脱敏数据量级**演练一次迁移，记录耗时；> 30s 的迁移需评估锁表影响并写入发布单 |
| 备份 | 迁移前**强制** `mysqldump` 并上传 COS（§6.4 步骤 1） |
| 版本绑定 | 镜像 label 记录 `db_migration_head`，发布后校验 DB 的 `_prisma_migrations` 最新记录与之匹配 |

### 4.4 规则包（policy_version）作为独立可回滚制品

| 环节 | 机制（对齐技术方案 §3.3） |
|------|------------------------|
| 基线 | 仓库 `policy/*.yaml` 为种子基线，`policy_version: "2026.10-national-2016"` |
| 一致性 | **CI 强校验**仓库 YAML 与 DB `published` 包的 `checksum_sha256` 一致；不一致 → 门禁失败 |
| 发布门禁 | 后台二次确认（展示 JSON Patch diff + 影响面"预计 X 条历史评估为旧版本，不会被重算"）→ 跑 `pnpm test:engine`（全 golden）+ `python3 tools/rule-audit/run.py` → 通过置 `published`、旧版置 `archived` |
| 生效 | 按请求 `policy_version` 加载；Redis 缓存 key `rp:{version}:{sha256}`，**TTL 300s** → 版本切换最长 5 分钟全量生效 |
| 历史不被改写 | 新版本发布**不重算**历史 `assessments`（`assessments.policy_version` + `rulepack_sha256` + `input_snapshot_json` 固定），用户需新口径走"另存为新方案"（`parent_id`） |
| 回滚 | 后台一键 `rollback` → 复制目标历史版本为新 draft → 发布 → 即刻生效（≤5 分钟）；**并需主动 purge 规则包缓存**（§7.2 命令） |
| 发布单记录 | 每次规则包变更记录：版本号、sha256、diff 摘要、影响评估数、发布人、回滚目标版本 |

---

## 5. ICP 备案与域名（本项目第一关键路径）

> 参考文件 §3.4："大陆服务器：ICP 备案完成前不得解析上线"。选型报告 §4.3/§5："ICP 备案 1~3 周是关键路径，**必须第 1 天启动**；未备案不得上线"。

### 5.1 备案流程（腾讯云/阿里云备案系统）

```
D1  确认主体资质 + 注册域名 + 购买大陆云服务器（2C4G，≥3 个月，备案要求）
  ↓
D1~D2  云备案系统填报：主体信息（企业）→ 网站信息 → 上传材料 → 人脸/幕布核验
  ↓
D2~D5  云厂商初审（1~3 个工作日，材料不符会退回，退回 1 次 +1~2 天）
  ↓
D5~D20 管局审核（一般 1~20 个工作日，多数省份 7~15 个工作日）
  ↓
  备案号下发 → 全站页脚展示"京ICP备/粤ICP备...号" + 公安机关备案（30 日内）
  ↓
  域名解析到大陆服务器 → 申请 SSL → 发布
```

### 5.2 材料清单（企业主体备案）

| # | 材料 | 提供方 | 常见退回原因 | 检查人 |
|---|------|--------|-------------|--------|
| 1 | 营业执照（原件彩色扫描/照片，有效期内） | 企业 | 模糊、过期、非最新版（有变更未更新） | 发布师 |
| 2 | 法定代表人身份证正反面 | 法人 | 反光/遮挡/过期 | 发布师 |
| 3 | 网站负责人身份证（可与法人同一人） | 负责人 | 与法人不一致时缺授权书 | 发布师 |
| 4 | 域名证书（WHOIS 显示主体与备案主体一致） | 域名注册商 | **域名所有者名称与营业执照不一致**（最高频退回原因） | 发布师 |
| 5 | 网站负责人手机号 + 邮箱（需实名、可接通核验电话） | 负责人 | 号段非实名、拒接核验电话 | 发布师 |
| 6 | 备案承诺书 / 信息安全管理承诺书（云系统模板，电子签） | 企业 | 未盖章/未签 | 发布师 |
| 7 | 幕布照片或 APP 人脸核验（各省要求不同） | 负责人 | 幕布背景不符、照片非当期 | 发布师 |
| 8 | 大陆云服务器订单（≥3 个月，且与备案主体同账号） | 云账号 | 服务器地域境外、时长不足 | 发布师 |
| 9 | 前置审批文件 | — | **本项目不涉及**（非新闻/出版/教育/医疗/金融等前置审批行业）；若后续加"找顾问"导流需评估经营范围 | 法务 |
| 10 | **网站名称** | 产品 | ⚠ **不得含"中国/国家/官方/认定管理"等字样**，不得与"高新技术企业认定管理工作网"近似（选型报告 §5.2 第 5 条 + R-04） | 产品 + 法务 |

### 5.3 备案时间线与并行开发策略

| 时间 | 备案侧 | 开发侧（并行，不阻塞） |
|------|--------|----------------------|
| **D1（第 1 天，硬启动）** | 确认主体/域名/云资源三件事；当天提交备案填报 | 仓库初始化、CI 骨架、规则引擎包与 16 组单测 |
| D1~D2 | 材料上传 + 人脸核验 | 数据模型 + Prisma migration |
| D2~D5 | 云厂商初审（可能被退回一次） | API + 前端页面开发；**部署 preview（境外/香港或 Vercel）供产品验收** |
| D5~D20 | 管局审核（等待期，无操作） | 功能开发 → 内测 → **部署 staging（大陆机，仅内网/VPN 或不解析公网）** |
| D~W3 | 备案号下发 | 预发回归、迁移演练、回滚演练、合规断言 |
| D~W6 | SSL 签发 + 解析生效 | **正式发布窗口**（避开申报截止前 7 天） |

> **并行开发的关键约束**：
> 1. 备案期间**preview 必须部署在境外/香港或 Vercel**（技术方案 §1.2 明确 Vercel 仅可作预览环境），**严禁**把未备案域名解析到大陆服务器对外提供访问；
> 2. preview / staging 一律 `noindex, nofollow`，**不得对外传播链接、不得提交搜索引擎**；
> 3. **备案未通过 = 严禁对外正式发布**（一票否决）。若 W6 备案仍未下 → 走 §11 的"备案延期预案"，**不允许用境外机临时对外发布**（政策测算工具面向大陆用户，境外机体验与合规均不可接受）。

### 5.4 SSL 证书（certbot 自动续期）

| 项 | 方案 |
|----|------|
| 签发 | `certbot --nginx`（Let's Encrypt，90 天有效期），域名：`www.<主域>` 与 `<主域>`（**含全部对外域名，避免多域名漏配**——参考文件 §六 第 4 条坑） |
| 证书链 | 使用 `fullchain.pem`（**证书链不完整会导致部分安卓/旧浏览器报错**——参考文件 §六 第 4 条） |
| 自动续期 | `certbot renew --quiet --deploy-hook "docker compose exec -T nginx nginx -s reload"`；`systemd timer` 每日 02:00 与 14:00 各跑一次 |
| 续期演练 | 每月 1 次 `certbot renew --dry-run`，结果发值班群 |
| 到期监控 | **Uptime Kuma 增加"证书剩余天数"监控项，< 21 天告警**（参考文件 §六 第 4 条"配监控"） |
| TLS 配置 | TLS1.2+；`HSTS: max-age=31536000`（**先观察 7 天再加 `includeSubDomains`/preload**）；`Referrer-Policy: strict-origin-when-cross-origin` |
| 校验命令 | `echo | openssl s_client -connect www.<主域>:443 -servername www.<主域> 2>/dev/null | openssl x509 -noout -dates -issuer` |

### 5.5 DNS 与 CDN 配置要点

| 项 | 配置 | 说明 |
|----|------|------|
| 解析商 | 腾讯云 DNSPod / 阿里云解析（与云主机同厂商，备案与解析联动更顺） | — |
| 记录 | `<主域>` A → 服务器公网 IP；`www` CNAME → `<主域>`；`staging` A（可选，建议**不解析公网**，用 hosts/VPN） | TTL 600 |
| 备案前 | **禁止 A 记录指向大陆 IP** | 硬约束 |
| CDN（主站） | **V1.0 不启用全站 CDN**。测算链路是动态交互 + Cookie 会话，全站缓存风险高、收益低；单机 2C4G 下 Nginx 本地缓存已够 | 避免缓存污染与会话串号 |
| CDN（静态） | 备案通过后，可将 `/_next/static`、`/static` 接 CDN（**仅静态**，缓存 30 天，带 hash 文件名） | 需 CDN 域名接入备案 |
| CDN（COS 产物） | PDF/Excel 下载走 **302 到 COS 签名 URL（300s）**；若要走 CDN 回源，需独立接入 + 防盗链 + **签名参数透传（禁止缓存带签名的 URL）** | 签名 URL 严禁被 CDN 缓存 |
| 安全组 | 仅开放 80/443；**22 端口改非标 + 仅允许办公网 IP**；MySQL 3306 / Redis 6379 **禁止公网暴露**（仅 127.0.0.1 与容器网段） | 高频安全事故点 |
| Nginx 限流 | `limit_req` 30/min/guest（技术方案 §2.3）、`/admin` 额外按 IP 白名单 | 防止刷分与后台爆破 |

---

## 6. 上线发布流程（Runbook）

### 6.1 发布前 T-3（发布前 3 个工作日）

| # | 事项 | 负责 | 判定 |
|---|------|------|------|
| 1 | **测试门禁结论确认**：质量测试官出具的 `[测试保障方案]` 结论：P0 = 0、核心链路 100%、规则引擎 16 组 + golden + 双端一致性 diff = 0 | 测试 + 发布 | 未通过 → **拒绝发布**，写明阻塞项并上报团长 |
| 2 | **ICP 备案状态确认**：备案号已下发、页脚备案号已就位 | 发布 | 未通过 → 一票否决 |
| 3 | 发布单起草（版本内容、变更清单、三类制品是否变更、回滚预案、窗口、值班）并发群 | 发布 | — |
| 4 | 迁移脚本评审：**逐条对照 §7.3.2 不可逆变更禁止清单** | 研发 + 发布 | 命中禁止清单 → 拆分重构 |
| 5 | staging 全量回归 + 迁移演练（记录耗时）+ **回滚演练**（§7.1 演练一次） | 研发 + 发布 | 回滚未演练 → 不允许发布 |
| 6 | 合规断言全绿（§8）：禁词扫描、免责声明 5 处、政策文号、字体许可、许可清单 | 发布 + 法务 | 任一红 → 阻断 |
| 7 | 值班表确认（发布窗口 + 之后 24h） | 发布 | 无值班 → 改期 |

### 6.2 发布前 T-1（1 个工作日）

| # | 事项 | 判定 |
|---|------|------|
| 1 | 发布单**正式发出并逐项签字确认**（参考文件 §十：提前 1 个工作日） | 未确认 → 顺延 |
| 2 | 冻结 `main`（仅允许 P0 修复 cherry-pick） | — |
| 3 | 确认目标镜像 tag 已存在于仓库且 `docker inspect` label 完整（version/sha/policy_version/rulepack_sha256/db_migration_head） | 缺失 → 重建 |
| 4 | 服务器磁盘 ≥ 30% 可用、内存 ≥ 1GB 可用（并行双容器需要）；`docker system df` 检查 | 不足 → 先 prune 旧镜像（保留最近 3 个） |
| 5 | 生产密钥核对：`/opt/hitech/.env` 存在且 `chmod 600`；**确认识别不出任何密钥在 Git 中**（gitleaks 通过） | 泄露 → 轮换后发布 |
| 6 | 备份链路验证：确认最近一次 mysqldump + COS 上传成功（可恢复性抽查） | 失败 → 修好再发 |
| 7 | 公告模板与客服话术就绪（§10.2） | — |

### 6.3 发布前 T-0（发布当天，窗口前 30 分钟）

| # | 事项 | 命令/判定 |
|---|------|-----------|
| 1 | 值班到位确认（发布师 + 研发师 + 运维守护师） | 三人在线 |
| 2 | 服务器快照 + DB 全量备份 | 见 §6.4 步骤 1 |
| 3 | 当前稳定版本 tag 记录（回滚锚点） | `cat /opt/hitech/CURRENT_TAG` → `v1.0.0-a1b2c3d` |
| 4 | Uptime Kuma 探活正常、Sentry 无新增未知错误基线 | 告警静默 30 分钟（发布期） |
| 5 | 再次确认发布窗口不在禁止时段（§1.4） | — |

### 6.4 发布步骤（命令级，逐条执行）

> 约定：工作目录 `/opt/hitech`；compose 文件 `docker-compose.yml`；应用服务名 `app`；Nginx 服务名 `nginx`；发布脚本 `deploy.sh`（版本化入库）。

```bash
# ============ 步骤 0：进入目录并记录回滚锚点 ============
cd /opt/hitech
CURRENT_TAG=$(cat CURRENT_TAG)                     # 例如 v1.0.0-a1b2c3d
NEW_TAG=$1                                          # 例如 v1.1.0-9f8e7d6
echo "rollback anchor = $CURRENT_TAG ; target = $NEW_TAG"
[ -z "$NEW_TAG" ] && { echo "missing tag"; exit 1; }

# ============ 步骤 1：备份（不可跳过） ============
# 1.1 云盘快照（控制台或云 CLI，2C4G 系统盘快照约 1~3 分钟）
# 腾讯云示例：
#   cvm CreateSnapshot --InstanceId <id> --DiskId <disk>
# 1.2 数据库逻辑备份 + 加密上传 COS
docker compose exec -T mysql \
  mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers \
  --default-character-set=utf8mb4 hitech_prod > /opt/hitech/backup/hitech_prod_$(date +%Y%m%d_%H%M).sql
gzip -f /opt/hitech/backup/hitech_prod_$(date +%Y%m%d_%H%M).sql
# 校验备份非空且可解析（防止空备份）
ls -lh /opt/hitech/backup/ | tail -3
# 上传 COS（保留 90 天）
python3 /opt/hitech/tools/upload_backup.py --dir /opt/hitech/backup --bucket "$COS_BACKUP_BUCKET"

# ============ 步骤 2：拉新镜像（不停机） ============
docker compose pull app                             # 或：docker pull $REGISTRY/hitech-app:$NEW_TAG
# 镜像完整性校验
docker inspect $REGISTRY/hitech-app:$NEW_TAG --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'
docker run --rm $REGISTRY/hitech-app:$NEW_TAG node -e "console.log(process.version)"   # 期望 v20.x
docker run --rm $REGISTRY/hitech-app:$NEW_TAG sh -c "chromium --version || /root/.cache/ms-playwright/chromium-*/chrome-linux/chrome --version"

# ============ 步骤 3：数据库迁移（向前兼容，独立步骤） ============
# 3.1 核对 migration head 与镜像 label 一致
docker run --rm $REGISTRY/hitech-app:$NEW_TAG cat /app/DB_MIGRATION_HEAD
# 3.2 执行迁移（deploy 模式，不会 reset）
docker compose run --rm --no-deps app npx prisma migrate deploy
# 3.3 校验迁移结果与耗时
docker compose exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e \
  "SELECT migration_name, finished_at FROM hitech_prod._prisma_migrations ORDER BY finished_at DESC LIMIT 5;"

# ============ 步骤 4：准蓝绿切换（默认路径，停机 ≤5 秒） ============
# 4.1 以新 tag 启动"候选容器"到影子端口 3001（不接流量）
APP_TAG=$NEW_TAG APP_PORT=3001 docker compose -f docker-compose.yml -f docker-compose.canary.yml up -d app_canary
# 4.2 健康检查（最多等 90 秒，每 3 秒一次）
for i in $(seq 1 30); do
  code=$(docker compose exec -T app_canary curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/v1/health || echo 000)
  [ "$code" = "200" ] && { echo "canary healthy after ${i}0s"; break; }
  sleep 3
done
[ "$code" != "200" ] && { echo "canary unhealthy -> abort"; ./rollback.sh app "$CURRENT_TAG"; exit 1; }
# 4.3 /ready 检查（DB + Redis 连通）
docker compose exec -T app_canary curl -s http://127.0.0.1:3000/api/v1/ready | tee /tmp/ready.json
# 4.4 Nginx upstream 切换到 3001 并 reload（秒级）
sed -i 's/127.0.0.1:3000;/127.0.0.1:3001;/' nginx/conf.d/upstream.conf
docker compose exec -T nginx nginx -t && docker compose exec -T nginx nginx -s reload
# 4.5 观察 60 秒无异常 → 摘除旧容器，候选转正（重命名/重建 app 到 3000 或直接保留 canary 为正式）
sleep 60
docker compose -f docker-compose.yml -f docker-compose.canary.yml stop app
# 4.6 固化新 tag
echo "$NEW_TAG" > CURRENT_TAG

# ============ 步骤 5（降级路径，内存不足以并行双容器时） ============
# 5.1 挂维护页（Nginx 502/维护页，停机窗口 ≤60 秒）
cp nginx/conf.d/maintenance.conf.on nginx/conf.d/maintenance.conf && docker compose exec -T nginx nginx -s reload
# 5.2 滚动重启
APP_TAG=$NEW_TAG docker compose up -d --no-deps app
# 5.3 health 通过后撤维护页
cp nginx/conf.d/maintenance.conf.off nginx/conf.d/maintenance.conf && docker compose exec -T nginx nginx -s reload

# ============ 步骤 6：发布后冒烟 ============
bash /opt/hitech/tools/smoke.sh https://www.<主域>
```

> **说明**：`/api/v1/health`（liveness）与 `/api/v1/ready`（readiness，检查 DB/Redis）为**本方案新增约定**，需研发师在 W2 前补齐（技术方案未定义，属发布必需，不与技术基线冲突）；二者**不得写入日志、不鉴权、不查敏感表**。

### 6.5 发布步骤的门禁与中止条件

| 步骤 | 中止条件 | 中止动作 |
|------|---------|---------|
| 1 备份 | 备份文件为空 / 上传 COS 失败 | **立即中止**，不继续发版 |
| 2 拉镜像 | tag 不存在 / label 缺失 / Chromium 不可运行 / Node 非 v20 | 中止，重建制品 |
| 3 迁移 | `migrate deploy` 失败 / 耗时 > 30s 且锁表 | **DB 迁移失败不可强推**；已从备份恢复（§7.3） |
| 4.2 健康检查 | 90 秒内 `/api/v1/health` 非 200 | 自动执行 `./rollback.sh app $CURRENT_TAG`（§7.1） |
| 4.3 ready | DB 或 Redis 不连通 | 同上回滚 |
| 4.4~4.5 | 切流后 60 秒内错误率 > 1% | 立即切回 upstream 3000（**最快止血，≤10 秒**），再评估 |

### 6.6 发布后验证清单

**A. 冒烟用例（8 条，100% 通过才算发布成功）**

| # | 用例 | 期望 | 关联 |
|---|------|------|------|
| S1 | 首页打开（含政策版本 + 免责声明可见） | 200；首屏可见 `policy_version` 文本与免责声明 | 合规 |
| S2 | 游客会话发放 | `Set-Cookie: gst=...; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` | C-4 |
| S3 | 四项指标完整填报 → 实时算分 | 前端算分 ≤ 25ms 内返回；`score_min/score_max` 双档 | F-6 |
| S4 | **服务端复算一致性** | 服务端结果与浏览器结果**逐字段一致**（否则结果页出现"规则版本差异"黄色横幅 → 视为失败） | 技术方案 §2.3 ③ |
| S5 | 资格预检 C1~C8（构造 fail 样例） | 强阻断卡 + 失败码 + 政策文号 + 补救路径 | F-1 |
| S6 | 导出 PDF（真实 Chromium + 子集字体） | **≤ 15s**；7 个模块齐全；**免责声明在封面与页脚 100% 存在**；中文无方框（字体子集正确） | F-13 |
| S7 | 导出 Excel 兜底 | ≤ 5s；内容完整 | PRD 异常验收 |
| S8 | 短链生成 → 解析 → 撤销 | `/s#token` 可解析；`DELETE` 后立即失效；payload 为密文（DB 中肉眼不可读） | C-4 |

补充校验：`/admin` 可达且 IP 白名单生效；`/robots.txt`、`/sitemap.xml` 可访问且**测算/结果页 `noindex`**；页脚备案号已展示。

**B. 关键指标观察 30 分钟（强观察，每 5 分钟记录一次）**

| 指标 | 告警阈值 | 数据源 | 超阈值动作 |
|------|---------|--------|-----------|
| HTTP 5xx 错误率 | **> 1%**（持续 5 分钟） | Sentry + Nginx 日志 | 暂停 → 评估回滚 |
| 全站可用性 | 任何 1 次探活失败 | Uptime Kuma（1 分钟） | 立即排查，2 次失败即回滚 |
| 打分接口 P95 | **> 500ms**（目标 ≤150ms） | 自建埋点 / pino | 排查慢查询与 Chromium 占用 |
| PDF 导出成功率 | **< 95%** | 埋点 `report_generate` | 切 Excel 兜底 + 排查队列 |
| PDF 导出 P95 耗时 | > 15s | 埋点 | 限并发（≤2）+ 排查队列积压 |
| 规则包 sha256 一致性 | 与 DB `published` 不一致 | `/api/v1/meta` 暴露（只读） | **立即回滚规则包**（§7.2） |
| 容器内存 / CPU | 内存 > 85%、CPU > 80% 持续 | `docker stats` | 限流 + 考虑扩容（§9.5） |
| 敏感字段泄露 | 日志/埋点出现信用代码、财务原值 | pino redact 断言 + 日志 grep | **立即回滚 + 轮换密钥** |

> 30 分钟强观察通过后进入 **72 小时观察**（参考文件 §十一）+ **7 天首发观察期**（§0.3）；T+24h 检查业务指标（自评完成率、导出率）与客诉；T+72h 出观察报告并入 Phase 4 运维方案。

---

## 7. 回滚方案（分级，详尽）

> 原则：**回滚优先于排查**。任何"先看看日志再说"的犹豫，在政策测算场景下都可能让用户拿到错误分数。回滚决策权下放到值班发布师（无需逐级审批），事后补报。

### 7.0 回滚总览与触发条件表

| 级别 | 场景 | 触发条件 | 责任人 | 决策时限 | 预计耗时 | 数据兼容性 |
|------|------|---------|--------|---------|---------|-----------|
| **L1 应用回滚** | 新版本代码缺陷（5xx、白屏、算分错、导出失败） | 见 §7.6 触发表 | 值班发布师（可独立决策） | **5 分钟内** | **≤ 5 分钟** | 无数据变更（代码回退） |
| **L2 规则包回滚** | 政策口径勘误、规则包 diff 错误、分值异常 | 规则包发布后 30 分钟内出现分数相关客诉/告警 | 发布师 + 规则负责人 | **10 分钟内** | **≤ 5 分钟**（热回滚） | **不重算历史**；新评估用旧包 |
| **L3 DB 迁移回滚** | 迁移导致结构/数据异常 | 迁移后冒烟失败或数据校验不通过 | 发布师 + 研发师（双人） | **15 分钟内** | **10~60 分钟** | 需备份恢复，见 §7.3 |
| **L4 短链/COS 产物兼容** | 短链解析失败、产物下载失败、密钥派生变更 | 短链解析成功率 < 95% 或下载 404 率 > 5% | 发布师 | 15 分钟内 | ≤ 10 分钟 | 见 §7.5 |
| **L5 全站降级/停服** | 数据库不可用、安全事件、数据泄露 | P0 安全事件或 DB 不可恢复 | **团长 + 发布师** | 立即 | ≤ 2 分钟挂维护页 | 只读维护页，不删数据 |

### 7.1 L1 应用回滚（切回上一镜像 tag）

**适用场景**：应用代码缺陷（最常见）。**前提**：上一个稳定镜像仍在本地（保留最近 3 个）。

```bash
# ===== 路径 A：准蓝绿未摘旧容器（最快，≤10 秒）=====
# 仅把 Nginx upstream 切回旧端口
sed -i 's/127.0.0.1:3001;/127.0.0.1:3000;/' /opt/hitech/nginx/conf.d/upstream.conf
docker compose exec -T nginx nginx -t && docker compose exec -T nginx nginx -s reload
curl -s -o /dev/null -w '%{http_code}\n' https://www.<主域>/api/v1/health

# ===== 路径 B：旧容器已摘除（≤5 分钟）=====
cd /opt/hitech
OLD_TAG=$(cat PREVIOUS_TAG)          # 或 git/CI 记录中查上一个稳定版本
echo "$OLD_TAG" > CURRENT_TAG
APP_TAG=$OLD_TAG docker compose up -d --no-deps app
# 等待健康
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' https://www.<主域>/api/v1/health)
  [ "$code" = "200" ] && { echo "rolled back OK in ${i}0s"; break; }
  sleep 3
done
# 若本地无旧镜像（已被 prune）：从仓库拉取
docker pull $REGISTRY/hitech-app:$OLD_TAG

# ===== 回滚验证（必做）=====
bash /opt/hitech/tools/smoke.sh https://www.<主域>        # 8 条冒烟用例
python3 /opt/hitech/tools/check_parity.py                  # 双端一致性抽检
grep -c '"level":50' /opt/hitech/logs/app.log              # Sentry 错误率回归基线
```

**耗时拆解**：决策 ≤5 分钟 + 切流/拉起 ≤3 分钟 + 冒烟 ≤2 分钟 = **约 10 分钟内完成止血**（纯技术动作 ≤5 分钟）。

**数据兼容性**：应用回滚**不涉及数据变更**。但须检查：
- 若本次发布**同时包含 DB 迁移** → 旧代码必须能在**新库结构**上运行（这就是 §4.3 的 expand→migrate→contract 原则）；若旧代码依赖已被删除/改名的列 → **必须先执行 L3**，否则回滚后反而崩溃；
- **判定规则**：发布单必须注明"本次迁移是否为 contract 阶段"。**contract 阶段禁止在同一次发布中允许纯应用回滚**，只能整体回滚（L3）。

**演练要求**：每次 RC 在 staging 演练一次路径 A/B，记录实际耗时；演练记录随发布单归档。

### 7.2 L2 配置/规则包回滚（含历史评分记录复算影响评估）

```bash
# 方式一：后台一键 rollback（推荐，无需发版、无需停机）
# 管理后台 → 规则包管理 → 选择目标历史版本 → 【回滚】
#   → 系统复制目标版本为新 draft → 跑全量回归 → 发布 → status=published

# 方式二：命令行/API 应急（后台不可用时）
curl -X POST https://www.<主域>/admin/v1/policy-versions/rollback \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d '{"target_version":"2026.10-national-2016","reason":"口径勘误"}'

# 关键：主动清除规则包缓存（否则最长 300s 不一致）
docker compose exec -T redis redis-cli --scan --pattern 'rp:*' | xargs -r docker compose exec -T redis redis-cli del
# 校验生效
curl -s https://www.<主域>/api/v1/meta | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['policy_version'],d['rulepack_sha256'])"
```

**历史评分记录复算影响评估（必做，写进回滚单）**

| 对象 | 影响 | 处置 |
|------|------|------|
| 已落库的历史 `assessments` | **不受影响**：每条记录已固化 `policy_version` + `rulepack_sha256` + `input_snapshot_json` + `result_json`；规则包回滚**不重算历史** | 无需动作 |
| 回滚期间新建的评估 | 使用回滚后的旧包计算，`policy_version` 记为旧版本 | 无歧义 |
| 回滚前"用错版本"算出的评估（污染面） | 需**量化**：`SELECT policy_version, COUNT(*) FROM assessments WHERE created_at >= <回滚包发布时间> GROUP BY 1;` | ① 若错版评估数 > 0：后台置为"需复核"标记；② 通过站内公告/客服主动告知受影响用户（**不得静默**）；③ 提供"一键另存为新方案"重算入口 |
| 已导出的 PDF/Excel 报告 | 报告内已印 `policy_version` 与政策版本日期 → **可自证版本** | 对污染面报告，主动联系用户重出；COS 上旧产物**不删除**（保留至 30 天生命周期自然过期） |
| 双端一致性 | 浏览器端可能缓存旧 sha256 的包（TTL 300s） | 回滚后用户刷新即可；最长 5 分钟窗口内结果页可能出现"规则版本差异"黄色横幅（**这是设计内的保护机制，不是故障**） |
| 复算校验 | `POST /api/v1/assessments/{id}/recompute` 抽查 ≥ 10 条历史记录，diff 必须为 0 | diff ≠ 0 → 升级为 L3/P0 排查 |

### 7.3 L3 数据库迁移回滚

#### 7.3.1 向前兼容迁移原则（expand → migrate → contract）

| 阶段 | 允许的变更 | 发布要求 | 可回滚性 |
|------|-----------|---------|---------|
| **expand**（第 N 版） | 加表、加**可空**列、加索引、加枚举值、放宽 CHECK | 新列必须有默认值或可空；旧代码不感知 | ✅ 纯应用回滚安全 |
| **migrate**（第 N 版或 N+1） | 双写、后台回填、数据转换 | 回填任务需幂等、可中断、限速 | ✅（数据双份，可切回读旧列） |
| **contract**（**不早于 N+1 版**） | 删列、删表、收紧 NOT NULL、改类型、删枚举值、收紧 CHECK | **必须与 expand 相隔至少一个发布版本**，且确认无旧代码依赖 | ❌ **不可逆**，只能靠备份恢复 |

> 本项目 V1.0 首发（库是新建的、无存量用户数据）→ **contract 阶段风险极低**；但 W7+ 进入运营期后，任何 contract 都必须走上述三阶段。

#### 7.3.2 不可逆变更禁止清单（上线前逐条核对）

| # | 禁止项 | 原因 | 替代方案 |
|---|--------|------|---------|
| 1 | `DROP TABLE` / `DROP COLUMN` | 数据立即丢失 | 先改名归档 `_deprecated_2026xx` → 观察一个版本 → 再删 |
| 2 | `RENAME COLUMN` / `RENAME TABLE` | 旧代码立即崩溃，无法纯应用回滚 | 加新列 → 双写 → 切读 → 删旧列 |
| 3 | 收紧为 `NOT NULL`（无默认值） | 旧代码写入 NULL 即失败 | 先可空 + 回填 + 加 CHECK → 下版本收紧 |
| 4 | 类型窄化（`BIGINT→INT`、`VARCHAR(255)→VARCHAR(64)`、`DECIMAL` 精度降低） | 溢出/截断 | 先扩后缩；缩精度需数据范围校验 |
| 5 | 删除/修改枚举值（如 `assessments.status` 的 `archived`） | 历史数据变非法 | 先停用 → 保留值 → 下版本清理数据后再删 |
| 6 | 收紧 `CHECK` 约束（如 `biz_years IN (1,2,3)` 改为 `IN (1,2)`） | 历史行违反 → 迁移失败 | 先 UPDATE 违规行 → 再加约束 |
| 7 | `TRUNCATE` / 无 WHERE 的 `DELETE` / `UPDATE` 全表 | 数据丢失 | 分批 + 事务 + 备份 |
| 8 | 大表加索引（无 `ALGORITHM=INPLACE, LOCK=NONE`） | 锁表 | 显式指定在线 DDL 参数，或低峰期执行 |
| 9 | 修改 `snapshots` 的密钥派生（KDF）算法 | **所有存量短链瞬间失效**（§7.5） | 版本化 KDF：`kdf_version` 字段 + 兼容旧版解密 |
| 10 | 修改 COS `file_key` 命名规则 | 存量产物下载 404 | 新旧 key 双读 |

#### 7.3.3 迁移回滚步骤

```bash
# 情形 A：迁移未破坏数据（结构已变但数据完好）—— 用反向迁移
docker compose run --rm --no-deps app npx prisma migrate resolve --rolled-back <migration_name>
# 再执行人工编写的反向 migration.sql（必须在发布前就准备好，并与正向迁移一同评审）

# 情形 B：数据已受损 —— 从备份恢复（RTO ≤4h，技术方案 §2.4）
# 1) 停写：挂维护页
cp nginx/conf.d/maintenance.conf.on nginx/conf.d/maintenance.conf && docker compose exec -T nginx nginx -s reload
# 2) 记录当前状态（便于事后复盘）
docker compose exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SELECT NOW(), @@version;"
# 3) 从 COS 拉取最近一次备份并恢复
python3 /opt/hitech/tools/download_backup.py --bucket "$COS_BACKUP_BUCKET" --latest --out /tmp/restore.sql.gz
gunzip -c /tmp/restore.sql.gz | docker compose exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" hitech_prod
# 4) 校验关键表行数与最新 assessment id
docker compose exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e \
  "SELECT COUNT(*) FROM hitech_prod.assessments; SELECT COUNT(*) FROM hitech_prod.snapshots;"
# 5) 恢复服务
cp nginx/conf.d/maintenance.conf.off nginx/conf.d/maintenance.conf && docker compose exec -T nginx nginx -s reload
```

**RPO/RTO 声明**：备份为**日备 + 发布前备** → 最坏 RPO ≈ 24 小时（发布前强制备份可将发布场景 RPO 压到分钟级）；RTO ≤ 4 小时（技术方案 §2.4）。**该 RPO 对"用户填报数据"是可接受的**（V1.0 游客态、无强账号资产），但**发布窗口内的 RPO 必须为 0**（发布前备份是硬步骤）。

### 7.4 回滚后的统一验证（所有级别通用）

| # | 验证 | 命令/判定 |
|---|------|-----------|
| 1 | 核心接口探活 | `/api/v1/health` = 200、`/api/v1/ready` = 200 |
| 2 | 8 条冒烟用例 | `bash tools/smoke.sh` 全绿 |
| 3 | 双端一致性 | `python3 tools/check_parity.py` diff = 0 |
| 4 | 规则包版本正确 | `/api/v1/meta` 的 `policy_version` + `rulepack_sha256` 与预期一致 |
| 5 | 错误率回归基线 | Sentry 5xx 率 < 1%，无新增未知错误类型 |
| 6 | 数据完整性 | 关键表行数与回滚前一致（±发布期间新增） |
| 7 | 合规位仍在 | 免责声明 5 处、备案号、政策文号页面可访问 |

### 7.5 L4 短链快照与 COS 产物兼容性处理

| 风险点 | 兼容性规则 | 回滚动作 |
|--------|-----------|---------|
| **短链 payload 密钥派生（KDF）** | 密钥由 token 派生（AES-256-GCM），**KDF 算法一旦变更，全部存量短链不可解密** | ① **禁止在同版本内改 KDF**；② 必须改时加 `kdf_version` 字段，解密按版本路由；③ 已发布错误 KDF → **立即 L1 应用回滚**（最省事，不要试图修数据） |
| **短链 TTL（30 天）** | 回滚不影响 TTL 计算（`expire_at` 已固化） | 无需动作；若回滚导致服务中断 > 1 小时，评估是否顺延 TTL（**需公告**） |
| **短链撤销** | `DELETE` 已置 `status='revoked'` 并物理删 payload → **不可逆** | 回滚不能恢复已撤销短链；引导用户重新生成 |
| **COS 产物 `file_key`** | 命名含 `report_id` + `policy_version`；**回滚不得删除旧产物** | 旧产物保留至 30 天生命周期自然过期；新旧 key 双读 |
| **COS 30 天生命周期** | 规则包回滚**不触发**产物清理 | 明确：回滚脚本中**禁止**任何 `cos delete` 操作 |
| **下载签名 URL（300s）** | 签名 URL 短期有效，回滚不影响已签发但未使用的 URL（300s 内） | 无需动作 |
| **本地卷降级产物** | Redis 宕机/COS 不可用时产物落本地卷 → **单机多实例即失效** | 回滚到单实例；产物迁回 COS 后再扩容 |
| **产物与规则包版本标注** | PDF 内已印 `policy_version` + 政策版本日期 | 规则包回滚后，污染面报告主动联系重出（§7.2） |

### 7.6 回滚决策触发条件表（触发指标 → 责任人 → 决策时限）

| # | 触发指标（任一满足） | 判定来源 | 级别 | 决策人 | 决策时限 | 动作 |
|---|---------------------|---------|------|--------|---------|------|
| T1 | 全站不可用 / 首页 5xx / Uptime Kuma 连续 2 次探活失败 | Uptime Kuma | **L1** | **值班发布师（独立决策）** | 立即（≤5 min） | 切回上一 tag |
| T2 | 5xx 错误率 > 1% 持续 5 分钟 | Sentry / Nginx | L1 | 值班发布师 | ≤5 min | 回滚；若 >5% 边回滚边报团长 |
| T3 | **算分结果错误**（双端一致性 diff ≠ 0，或 golden case 线上失败） | 埋点 + 巡检脚本 | **L1/L2** | 发布师 + 规则负责人 | **≤3 min** | 若由代码引起→L1；若由规则包引起→L2；**同时挂"结果仅供参考"提示** |
| T4 | PDF 导出成功率 < 95% 或 P95 > 15s | 埋点 | L1（先降级） | 值班发布师 | ≤10 min | 先开 Excel 兜底开关；无效则回滚 |
| T5 | P95 打分耗时 > 500ms 持续 10 分钟 | 埋点 | L1 | 发布师 + 研发 | ≤15 min | 排查；无效回滚 |
| T6 | 规则包 sha256 与 DB `published` 不一致 | `/api/v1/meta` 巡检 | L2 | 发布师 + 规则负责人 | ≤10 min | 规则包回滚 + purge 缓存 |
| T7 | 分数相关客诉 ≥ 3 起（同口径） | 客服 | L2 | 发布师 + 规则负责人 | ≤30 min | 规则包回滚 + 影响面评估 |
| T8 | 迁移后关键表行数异常 / 数据校验不通过 | 校验脚本 | L3 | 发布师 + 研发（双人） | ≤15 min | 备份恢复 |
| T9 | 短链解析成功率 < 95% | 埋点 | **L1**（KDF 变更） | 发布师 | ≤15 min | 立即回滚（勿修数据） |
| T10 | 日志/埋点出现信用代码、财务原值等敏感字段 | 日志巡检 | **L1 + P0** | 发布师 + 团长 | 立即 | 回滚 + 密钥轮换 + 泄露评估 |
| T11 | 容器内存 > 90% 或 OOM 重启 | `docker stats` | L1 | 发布师 | ≤10 min | 回滚 + 限流 |
| T12 | 数据库不可用且短时不可恢复 | Uptime Kuma | **L5** | **团长 + 发布师** | 立即 | 挂维护页 + 公告 |

**决策授权**：T1/T2/T3/T10 授权值班发布师**先斩后奏**（先回滚，10 分钟内补报团长）；其余按上表时限决策。**任何情况下"等待确认"不得超过决策时限。**

### 7.7 回滚演练与归档

- **演练**：每次 RC 在 staging 演练 L1（路径 A + B）与 L2（规则包回滚 + 缓存 purge），记录耗时与问题；**L3 每 2 个月演练一次**（备份恢复全流程，含 Gunzip 恢复与行数校验）。
- **归档**（参考文件 §十二，发布完成 24 小时内）：发布单（含未通过项豁免说明）、制品记录（版本/sha/上一稳定版本位置）、配置变更记录、观察报告；**回滚事件额外归档"回滚单"**（触发条件、级别、耗时、影响面、复盘结论）。材料随版本保留 ≥ 1 年。

---

## 8. 审核与合规风险提示（本项目版"审核清单"）

> **说明**：本项目**无应用商店审核环节**（§0.1 已明确不适用），但存在**等价甚至更高等级的合规风险**——本工具的输出直接影响企业申报决策，一次"分数算错"或"被误认为官方系统"的后果比一次 App 审核被拒严重得多。以下逐条给出风险等级与规避动作，**全部纳入 CI 门禁或上线 Checklist，禁止凭记忆临场检查**（参考文件 §六 末条纪律）。

| # | 风险项 | 风险等级 | 具体表现 | 规避动作（可执行） | 上线检查归属 |
|---|--------|---------|---------|-------------------|-------------|
| R-01 | **政策内容引用合规** | 🔴 高 | 规则表述与 32 号文/195 号文不一致；引用未标文号/条款/版本日期；改编政策原文 | ① 每条规则必须带 `policy_ref`（文号 + 条款 + 版本日期），数据源 `policy_refs` + MDX 双写（技术方案 §1.2）；② 引用原文**照抄不改字**，改编部分必须标注"产品口径说明"；③ CI 断言：每个评分项 `policy_ref` 非空且文号在白名单内；④ 政策版本日期与 `effective_date` 随规则包版本固化 | §12 第 6 项 + §3 阶段 2 |
| R-02 | **免责声明三处（实为 5 处）不到位** | 🔴 高（红线） | 首屏/结果页/报告页缺失或措辞弱化 | ① 按 PRD §10.1 + 补丁 P-08 **5 处固定位**落地（首屏、结果页、报告页为强制必过项；另：分享只读页顶部、政策依据/隐私页脚）；② 统一文案含"仅供参考""**不构成官方认定结论**""**非高新技术企业认定管理工作网、非政府官方系统**""**不代表任何通过承诺**""最终以认定机构评审为准"；③ **E2E 用例断言 5 处 DOM 存在**（S1/S6），非人工检查；④ 文案由后台可配置但**禁删**，后台删除需二次确认 + 审计留痕 | §12 第 6 项 + 冒烟 S1/S6 |
| R-03 | **被误认为官方系统 / 冒用名义** | 🔴 高 | 网站名/备案名/标题/正文含"中国""国家""官方""认定管理"；使用政府部门标识或近似配色 | ① **禁词表 CI 扫描**（源码 + MDX + 后台文案 + `<title>`/`<meta description>`/`og:*`）；② 全站显著"第三方辅助工具"标识；③ 禁用 gov.cn 视觉风格（红金配色、国徽类图形）；④ 备案网站名称走法务预审；⑤ SEO 内容页不得自称"官方系统"（R-07） | §12 第 6 项 + §3 阶段 2 |
| R-04 | **承诺"包过" / 暗示通过** | 🔴 高（红线） | 出现"包过""保证通过""100% 通过""必过""官方评分"等 | ① 全站 + 客服话术 + 邮件模板**禁词扫描**；② 结果页只展示区间与判定，不得出现"您一定能通过"；③ 若 V2 上"找顾问"导流，必须明示商业推广且不得承诺通过（选型报告 §5.1） | §12 第 6 项 |
| R-05 | **字体许可（思源黑体 SIL OFL）** | 🟡 中 | 子集化后再分发未保留许可声明；误用付费字体 | ① 镜像内保留 `OFL.txt` 与版权声明（**随字体产物一起版本化**）；② **不得改名字体文件名以规避许可**（OFL 要求保留声明，改名不免除义务）；③ 子集化用 `pyftsubset`（fonttools）不改变许可性质，OFL 允许嵌入与再分发；④ CI 校验 `NOTICE` 文件含字体版权与许可条目；⑤ 建立"字体白名单"，新增字体须过法务 | §12 第 7 项 |
| R-06 | **Chromium / 第三方依赖许可** | 🟡 中 | GPL/AGPL 依赖进入前端 bundle；Chromium 组件许可未提供 | ① CI `pnpm licenses list --json` + 白名单校验（**禁止 GPL/AGPL/LGPL 传染性依赖进入前端产物**；ECharts=Apache-2.0、ExcelJS=MIT、antd=MIT、Next=MIT 均合规）；② Playwright/Chromium 为 **Apache-2.0 + BSD 系组件**，镜像内自用不触发源码分发义务；③ 生成并归档 `THIRD-PARTY-NOTICES.md`；④ **禁止引入任何 LLM SDK**（生成式 AI 合规规避，见 R-09） | §12 第 7 项 + §3 阶段 2 |
| R-07 | **SEO 内容页自称官方 / 误导搜索用户** | 🔴 高 | 内容页标题写"高新技术企业认定官方评分系统"；`schema.org` 标记冒充政府网站；搜索结果误导 | ① 内容页 `<title>`/`<meta>`/`og` 走禁词扫描（`官方` `国家` `中国` `认定管理` `政府`）；② 内容页**显著标注**"第三方自评工具"；③ **不得**使用 `GovernmentOrganization` 类结构化数据；④ `sitemap.xml` 只收录内容页与首页，**测算页/结果页 `noindex`**；⑤ 提交搜索引擎前人工抽查 10 个页面 | §12 第 6/8 项 |
| R-08 | **个人信息保护（V1.0 不强制收集手机号）** | 🟡 中 | 违规收集手机号/企业名称；Cookie 属性不当；日志泄露敏感字段 | ① V1.0 **免登录**（C-4），全站无 `/login /register /forgot /logout` 路由（**CI 路由断言**）；② 移动端 V1.1 若做手机号登录须**单独同意 + 最小必要 + 隐私政策更新**（选型报告 §5.2）；③ Cookie `gst`：`HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`；④ **隐私政策页可访问** + Cookie 提示；⑤ pino redact + 埋点**禁止写入财务/信用代码**（UA 截断、IP 哈希）；⑥ 发布后日志巡检 grep 敏感字段（T10） | §12 第 3/6 项 + 冒烟 S2 |
| R-09 | **生成式 AI 触发额外备案义务** | 🟡 中（已规避） | 接入大模型生成建议 → 触发《生成式人工智能服务管理暂行办法》备案 | ① 建议模板**全部规则化**（规则→建议映射表），**V1.0/V1.1 不接大模型**；② CI 依赖扫描禁止 LLM SDK；③ V2 若接入，须**先完成备案评估**，否则降级为规则化模板（PRD 补丁 P-10） | §12 第 7 项 |
| R-10 | **第三方统计脚本（严禁）** | 🟡 中 | 引入 GA/友盟/百度统计 → 填报数据出境、违反最小必要 | ① 自建埋点表 `events` + 服务端直采（技术方案 §1.2）；② **严格 CSP**：`script-src 'self'`，禁止第三方域；③ CI 扫描 HTML 产物中非本域 `<script src>`；④ 发布后 `curl` 首页 grep 外域脚本 | §12 第 3 项 |
| R-11 | **HTTPS 证书 / 域名 / 备案失效** | 🟡 中 | 证书链不完整、到期未续期、备案被注销 | ① `fullchain.pem` + TLS1.2+；② certbot 自动续期 + **Uptime Kuma 剩余天数 < 21 天告警**；③ 每月 `certbot renew --dry-run`；④ 备案号常驻页脚 + 每年复核（工信部抽查） | §12 第 2/4 项 |
| R-12 | **数据跨境 / 境外预览环境数据** | 🟢 低 | 备案期间 preview 在境外/Vercel，若灌入真实企业数据构成跨境 | ① preview/staging **严禁使用真实企业数据**（仅脱敏造数）；② preview 环境不接生产 COS 桶、不接生产库 | §12 第 3 项 |
| R-13 | **备案延期导致抢跑上线** | 🔴 高（流程） | 工期压力下用境外机或未备案域名对外发布 | ① **一票否决**：备案未通过禁止对外发布（§5.3）；② 若 W6 未下号 → 启动延期预案（§11.4），**不允许抢跑**；③ 发布单第 2 项即为备案状态确认 | §12 第 1 项 |

**禁词表（CI 强扫描，命中即失败）**：
`包过` `保证通过` `100%通过` `必过` `包通过` `官方评分` `官方认定` `官方系统` `中国高新技术企业认定` `国家认定` `认定管理` `工信部` `科技部`（作为自称/背书时）`政府指定` `权威认证`
> 注：`高新技术企业认定管理办法` 作为**政策文件引用名**属于正当引用，扫描需排除 `policy_ref` 字段与政策原文区块，避免误报（扫描器需支持 `<!-- allowlist -->` 豁免注释）。

---

## 9. 灰度策略（单机部署下的"软灰度"）

### 9.1 为什么不能直接全量

参考文件 §4.1 要求"有真实用户的更新默认走灰度"。本项目**首版冷启动无存量用户**（无历史线上数据、无旧客户端兼容负担），这是**可以简化灰度级数**的合理理由；但**分数错误的影响不可逆**，因此仍保留**三级软灰度 + 一级真实灰度**，只是**观察时长可缩短**（无存量用户 → 无"老用户受损"面）。

### 9.2 单机环境下的软灰度手段（按优先级）

| 级别 | 手段 | 实现方式 | 适用 | 回滚速度 |
|------|------|---------|------|---------|
| **G0 内部白名单** | 后台账号 + 办公网 IP 白名单 + 指定 `gst` Cookie 白名单 | Nginx `allow/deny` + 应用内 `INTERNAL_WHITELIST`（env） | 首发、大改版 | 改 env + reload，≤1 分钟 |
| **G1 影子端口（真·金丝雀）** | 同机起 `app_canary` 到 3001，仅白名单流量走 3001 | Nginx `map $http_x_canary` 或 `map $cookie_canary` → upstream 选择 | 大改版、引擎重构 | upstream 切回，≤10 秒 |
| **G2 按比例放行（哈希分流）** | 按 `gst` Cookie 或 `$request_id` 哈希取模：`hash % 100 < N` → 走新版本 | Nginx `map` + `split_clients`；N = 5 → 20 → 50 → 100 | 常规版本 | 改 N + reload，≤1 分钟 |
| **G3 功能开关（最常用）** | 环境变量 / Redis 中 `FEATURE_FLAGS`（如 `export.excel_fallback`、`engine.strict`） | 应用读取，按 `gst` 哈希或白名单生效 | 新功能、兜底开关 | 改 flag，≤1 分钟，**无需发版** |
| **G4 内容页先行** | SEO 内容页（SSR/静态）先放量承接搜索流量，测算链路保持旧版 | 路由级开关 | 首发（让 SEO 先起量、测算链路后开） | 路由开关，≤1 分钟 |
| **G5 短链白名单** | 新导出格式仅对指定短链前缀（如 `/s#t-new-*`）生效 | 应用内判定 | 导出格式变更 | ≤1 分钟 |

**推荐组合（首发 V1.0.0）**：`G0（内部 3 天）→ G4（内容页开放 1~2 天，承接 SEO）→ G2（5% → 20% → 50% → 100%，每级观察 ≥2 小时；无存量用户故可加速，最快 1 天内走完）→ 全量 + 7 天观察期`。

**推荐组合（常规版本 V1.x）**：`G0（1 小时）→ G2（20% → 100%，观察 30 分钟）→ 全量`。

**规则包发版不适用流量灰度**：规则包是**口径变更**，同一时刻只能有一个 `published` 口径，二分流量会造成"同一输入两个分数"的严重混乱 → 规则包走 **staging 全量回归 → 生产一次性切换 + 30 分钟强观察**，出问题走 L2 回滚（≤5 分钟）。**这一点必须写进规则包发布单，禁止对规则包做流量灰度。**

### 9.3 Nginx 哈希分流示例（G2）

```nginx
# nginx/conf.d/upstream.conf
# 按 gst Cookie 哈希分流：hash % 100 < CANARY_PERCENT 走 3001（新），否则 3000（旧）
map $cookie_gst $canary_bucket {
    default           101;                       # 无 Cookie（新访客）默认走稳定版
    "~*(?<h>[0-9a-f]{8})"  $h_mod;               # 取前 8 位十六进制 → 需 lua/perl 模块，见下
}
# 简化实现（不引入 lua）：用 split_clients 基于 $request_uri$cookie_gst 的稳定哈希
split_clients "${remote_addr}${cookie_gst}" $canary_upstream {
    5%    "127.0.0.1:3001";      # 调此数值即可调整灰度比例：5 → 20 → 50 → 100
    *     "127.0.0.1:3000";
}
upstream app_upstream {
    server 127.0.0.1:3000;       # 占位，实际由 proxy_pass http://$canary_upstream 使用
}
server {
    location / {
        proxy_pass http://$canary_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

> 注意：**同机双容器在 2C4G 上内存吃紧**（app 主进程 `--max-old-space-size=1536`）。G1/G2 使用时，`app_canary` 必须限制内存（`mem_limit: 768m`，`--max-old-space-size=512`），且**仅在灰度窗口内开启**，灰度结束立即摘除。若内存不足 → **降级为 G3 功能开关 + 滚动发布**（§6.4 步骤 5）。

### 9.4 灰度的观察指标与暂停/放量条件

| 指标 | 暂停放量 | 继续放量 |
|------|---------|---------|
| 5xx 错误率 | > 1% | < 0.5% |
| 双端一致性 diff | ≠ 0（**立即暂停 + 回滚**） | = 0 |
| 打分 P95 | > 500ms | ≤ 300ms |
| PDF 导出成功率 | < 95% | ≥ 98% |
| 客诉（分数相关） | ≥ 1 起 | 0 |
| 容器内存 | > 85% | < 75% |

**放量纪律**：每级放量前必须完成上一级观察；**放量动作只能由发布师执行**；放量记录写入发布单。

### 9.5 何时需要扩容到多实例（触发线）

| 触发指标（持续 ≥ 30 分钟） | 动作 | 说明 |
|---------------------------|------|------|
| CPU 持续 > 70% | 先排查（慢查询/Chromium 并发），再考虑升配到 4C8G | 单机优先升配，成本增量小 |
| 内存持续 > 85% 或频繁 OOM | **升配 4C8G**（Chromium 渲染是内存大头） | 2C4G 是 PDF 导出的天然瓶颈 |
| PDF 队列积压 > 10 或导出 P95 > 15s | ① 限并发（≤2）② **拆 Playwright 为独立 Worker**（技术方案 §2.4 扩容路径） | 渲染与 Web 解耦 |
| 日活 > 3000 或并发 > 50 | **app 扩到 2 实例 + Redis 共享态** | 此时必须 Redis 常驻，不可降级内存实现 |
| 单实例故障需自动恢复 | 2 实例 + Nginx 负载均衡（**此时才具备真正的高可用**） | V1.1+，非本期 |
| 月可用性 < 99.5% | 评估 MySQL 升托管版（主从）+ 多实例 | 联动 Phase 4 运维方案 |

> **扩容前置依赖**：多实例 ⇒ ① Redis 必须常驻（共享会话/限流/队列）；② 产物必须走 COS（**本地卷方案立即失效**——技术方案 §1.2 备选已注明）；③ `/admin` 的审计与限流需共享态。这三条是**扩容的准入条件**，未满足不得扩容。

---

## 10. 发布沟通与值班

### 10.1 发布通知模板（对内，T-1 发出）

```
【发布单】高新技术企业评分测算系统 V1.0.0
────────────────────────────────
发布时间窗：2026-xx-xx（周二）10:00~11:30
发布负责人：@发布师   研发在场：@研发师   运维在场：@运维守护师
变更类型：□应用镜像 ■规则包 ■数据库迁移  （勾选）
版本：v1.0.0-a1b2c3d（上一稳定版：v0.9.0-xxxx / 首发无）
变更摘要：
  1. ...
  2. ...
数据库迁移：有（2 个 migration，阶段：expand，非 contract，可纯应用回滚）
规则包：2026.10-national-2016（sha256: ab12...）；历史评估 X 条，不重算
影响面：全站；预计停机 ≤60 秒（准蓝绿 ≤5 秒）
回滚预案：L1 应用回滚（切回 v0.9.0-xxxx，≤5 分钟）；L2 规则包后台回滚（≤5 分钟）
检查清单：§12 十项 ✅ 全绿（未通过项：无 / 豁免说明：...）
值班：发布后 24h，@发布师（主）@运维守护师（备）
────────────────────────────────
```

### 10.2 对外公告模板（首发 / 体验变化时使用）

```
【上线公告】
本站「高新技术企业认定评分测算工具」已正式上线。
· 本站为第三方服务机构提供的辅助测算工具，非高新技术企业认定管理工作网、非政府官方系统；
· 测算结果为基于您填报数据的模拟估算，仅供参考，不构成官方认定结论，不代表任何通过承诺，最终以认定机构评审为准；
· 政策依据：《高新技术企业认定管理办法》（国科发火〔2016〕32号）、《高新技术企业认定管理工作指引》（国科发火〔2016〕195号），版本日期：xxxx-xx-xx。
使用中遇到问题请联系：<客服入口>
```

**故障/回滚对外话术（提前备好）**：发生了什么 / 影响范围 / 当前状态 / 补偿方案（参考文件 §十）：

```
【服务异常说明】
时间：2026-xx-xx 10:2x
现象：部分用户在导出报告时遇到失败
影响范围：导出功能（测算与查看不受影响）；涉及约 X 位用户
当前状态：已定位并回滚至上一稳定版本（10:3x 恢复），导出功能已可用
补偿：受影响用户可重新导出；如您的报告结果有疑问，请联系 <客服入口> 我们将按原口径为您复核
说明：本次异常不影响任何历史测算数据与政策口径（规则包版本未变更）
```

### 10.3 值班安排与升级路径

| 时段 | 主值班 | 备值班 | 职责 |
|------|--------|--------|------|
| 发布窗口 | 发布师 | 研发师 | 执行发布、30 分钟强观察、决策回滚 |
| T+0 ~ T+24h | 发布师 | 运维守护师 | 指标观察、客诉响应 |
| T+24h ~ T+72h | 运维守护师 | 发布师 | 72 小时观察、告警调优 |
| T+72h ~ T+7d | 运维守护师 | 发布师 | 首发观察期收尾、复盘 |

**升级路径（5 分钟内无响应即上升一级）**

| 级别 | 触发 | 响应人 | 时限 |
|------|------|--------|------|
| L1 事件（一般异常） | 单指标超阈值但服务可用 | 值班发布师 | 15 分钟响应 |
| L2 事件（核心功能受损） | 导出失败、算分异常、5xx > 1% | 发布师 + 研发师 | 5 分钟响应，30 分钟内止损 |
| L3 事件（全站不可用 / 数据风险） | 全站 5xx、DB 异常、疑似泄露 | **团长 + 发布师 + 研发师** | 立即，先止损后定责 |
| L4 事件（合规/安全） | 敏感字段泄露、被质疑官方身份、监管问询 | **团长 + 法务 + 发布师** | 立即，同步启动对外口径 |

### 10.4 发布事故复盘机制

| 环节 | 要求 |
|------|------|
| 触发 | 任何**回滚**、任何 L2+ 事件 | 
| 时限 | 止损后 **48 小时内**出复盘文档 |
| 复盘内容（五问） | ① 时间线（精确到分钟）② 根因（5 Why）③ 影响面（用户数/数据量/是否涉及分数错误）④ 为什么没在测试/预发发现 ⑤ 改进项（含责任人与截止日期） |
| 输出 | 复盘文档 + **改进项进入需求池** + 更新本方案对应章节（门禁/清单/触发表） |
| 纪律 | **不追责个人，追责机制**；同类问题二次出现视为流程失效；改进项闭环率纳入发布质量指标 |
| 台账 | 维护"发布事故台账"：版本 / 日期 / 级别 / 根因 / 回滚级别 / 耗时 / 改进项，随版本归档 ≥1 年 |

---

## 11. 上线里程碑时间表（对齐 6~9 周工期）

### 11.1 主时间线（备案顺利 → 6 周）

| 周次 | 发布侧里程碑 | 关键交付 | 依赖 / 阻塞项 |
|------|-------------|---------|--------------|
| **W1** | **D1 ICP 备案启动（关键路径）**；域名注册 + 主体资质 + 大陆云资源确认（选型报告 Q3 🔴 最高优先级待确认） | 备案提交回执；域名证书；云主机到位 | 🔴 **若主体资质未办理 → 整体 +2~4 周**（选型报告 §4.3） |
| W1 | CI 骨架（quality job）+ preview 环境（境外/Vercel）打通 | PR 流水线绿 | — |
| W1~W2 | 规则引擎包 + 16 组边界单测 + golden 入库门禁 | `pnpm test:engine` 绿 | C-1/C-2/C-3 口径确认 |
| W2 | `/api/v1/health`、`/api/v1/ready` 补齐（本方案新增约定） | 健康检查可用 | 需研发师确认 |
| W2~W3 | staging 环境（大陆机）+ 迁移流程 + 备份脚本 | 首次 staging 部署成功 | 备案未下 → staging **不解析公网** |
| W3 | 合规断言脚本（禁词/免责/许可）接入 CI | 门禁生效 | 法务确认禁词表与文案 |
| W3~W4 | 镜像构建优化（Chromium 层缓存 + 字体子集缓存） | 构建 ≤10 分钟 | GH Actions 额度 |
| W4 | **内测**（staging 全量回归） | P0 = 0 | 测试门禁结论 |
| W5 | **预发**：RC 冻结、迁移演练、**回滚演练（L1/L2）**、灰度开关就绪 | 回滚演练记录 | 备案状态 |
| W5 | SSL 证书申请 + DNS 预配置（**备案通过后立即生效**） | certbot 就绪 | 🔴 备案号 |
| **W6** | **备案通过 → 正式发布**：G0 内部 → G4 内容页 → G2 5%→20%→50%→100% → 全量 | 生产上线 | 🔴 **备案未通过则不可发布** |
| W6~W7 | **首发观察期 7 天**（30min / 24h / 72h / 7d 四档） | 观察报告 → 移交 Phase 4 运维 | — |

### 11.2 缓冲时间线（备案不顺利 → 9 周）

| 周次 | 变化 |
|------|------|
| W6 | 备案仍在管局审核 → **不发布**；进入"待发布冻结"状态：只修 P0，不做新功能；staging 保持可发布状态 |
| W7 | 备案下发 → 立即走 W6 的发布流程 |
| W8~W9 | 缓冲：灰度加速（无存量用户，2 天内走完）+ 观察期 |

### 11.3 关键依赖与阻塞项清单

| # | 依赖项 | 责任方 | 阻塞影响 | 截止 | 状态跟踪 |
|---|--------|--------|---------|------|---------|
| D-01 | **ICP 备案**（主体资质 + 域名 + 云资源 + 管局审核） | 企业 / 发布师 | 🔴 **最高**：未通过 = 不可发布 | W1 启动，W5~W7 完成 | 每日跟进 |
| D-02 | 域名注册 + 命名合规（禁词预审） | 产品 + 法务 | 备案退回 / 合规风险 | **W1 D1** | — |
| D-03 | 大陆云资源（≥3 个月，备案主体一致） | 企业 | 备案无法提交 | **W1 D1** | — |
| D-04 | 测试门禁结论（P0=0、核心链路 100%） | 质量测试官 | 未达标**拒绝发布** | W4 | 上报团长 |
| D-05 | `/api/v1/health`、`/api/v1/ready` 实现 | 研发师 | 准蓝绿切换与回滚无法自动化 | W2 | — |
| D-06 | 合规文案法务签字（免责声明、禁词表、隐私政策） | 法务 | 合规红线，阻断发布 | W3 | PRD §12.2 要求三处法务签字 |
| D-07 | 规则包基线 YAML 与 DB sha256 一致 | 规则负责人 | CI 门禁失败 | W2 | — |
| D-08 | 备份与恢复链路（mysqldump + COS + 演练） | 发布师 + 运维 | L3 回滚不可执行 | W3 | — |
| D-09 | 值班表与升级路径确认 | 团长 | 发布窗口无人响应 | T-3 | — |
| D-10 | 公告与客服话术就绪 | 产品 + 客服 | 事故时无对外口径 | T-1 | — |

### 11.4 备案延期预案（W6 未下号时）

1. **不抢跑**：严禁境外机/未备案域名对外发布（§5.3 硬约束）。
2. **保持可发布状态**：staging 每周至少部署一次，确保"备案号一下发，48 小时内可上线"。
3. **提前完成**：SSL（预签好但绑定域名，随时可启用）、DNS 记录预配置（暂不指向大陆 IP）、合规断言、灰度开关。
4. **沟通**：每周向团长同步备案进度与预计下号时间；超过 8 周未下号 → 上报团长决策（是否更换域名/服务商/主体）。
5. **工期影响**：明确告知 —— 备案每延期 1 周，上线顺延 1 周；**开发侧不因备案延期而放松质量门禁**（禁止"为了赶时间带病上线"）。

---

## 12. 上线检查 Checklist（十项，逐项签字）

> 参考文件 §五 十项清单，已按本项目映射改造；**每项必须有执行人、执行结果、证据（命令输出/截图/链接）**，禁止"凭记忆临场检查"。

| # | 检查项 | 判定标准 | 证据 | 执行人 | 结果 |
|---|--------|---------|------|--------|------|
| **1** | **质量门禁结论通过** | 测试保障方案结论：P0 = 0、核心链路 100%、规则引擎 16 组 + golden 全通过、双端一致性 diff = 0；覆盖率引擎 ≥95%/整体 ≥80% | 测试报告链接 + CI 运行号 | 测试 + 发布 | ☐ |
| **2** | **备案与资质生效** | **ICP 备案号已下发**；页脚备案号已展示；网站名称无禁词；公安机关备案已提交（30 日内） | 备案截图 + 首页截图 | 发布 | ☐ |
| **3** | **证书 / 密钥 / 域名核验** | ① HTTPS 证书覆盖 `www.<主域>` 与 `<主域>`（**无多域名漏配**）、证书链完整（`fullchain`）、有效期 > 30 天；② certbot 自动续期已配 + Uptime Kuma 到期告警已配；③ 安全组仅开 80/443，**3306/6379 未公网暴露**；④ 生产密钥在 `/opt/hitech/.env`（chmod 600），**gitleaks 扫描无泄露**；⑤ Cookie `gst` 属性正确 | `openssl x509 -noout -dates`、安全组截图、gitleaks 报告、`curl -I` 响应头 | 发布 | ☐ |
| **4** | **环境隔离与配置核对** | prod/staging/preview 配置隔离（§2.1）；**staging 未连生产库/生产 COS 桶**；`PROD_*` 全部来自 Secrets；`policy_version` 与仓库 YAML sha256 一致 | `.env` diff 报告、CI 校验输出 | 发布 + 研发 | ☐ |
| **5** | **制品与版本可追溯** | 镜像 tag = `v1.0.0-<sha>` 双打；label 含 revision/version/policy_version/rulepack_sha256/db_migration_head；**上一稳定版本镜像在本地与仓库均存在**（回滚锚点 `PREVIOUS_TAG` 已记录）；生产**不使用 `latest`** | `docker inspect` 输出、`CURRENT_TAG`/`PREVIOUS_TAG` | 发布 | ☐ |
| **6** | **合规位 100% 到位**（本项目最高优先级） | ① **免责声明 5 处**（首屏/结果页/报告页为必过项）E2E 断言通过；② 政策引用文号 + 条款 + 版本日期齐全；③ **禁词扫描 0 命中**（含 `<title>`/`<meta>`/MDX/后台文案）；④ 无 `/login /register /forgot /logout` 路由；⑤ 隐私政策页可访问 + Cookie 提示；⑥ 无第三方统计脚本（CSP `script-src 'self'`） | 扫描报告 + E2E 报告 + 页面截图 | 发布 + 法务 | ☐ |
| **7** | **依赖与许可合规** | `pnpm licenses list` 无 GPL/AGPL 进入前端产物；`THIRD-PARTY-NOTICES.md` 已生成；**字体 OFL 声明随镜像保留**、字体子集 ≤1.2MB；**无 LLM SDK** | 许可报告 + NOTICE 文件 | 发布 + 研发 | ☐ |
| **8** | **监控告警与 SEO 已接入** | Sentry（prod project）已接入且能收到测试错误；Uptime Kuma 探活（1 分钟）+ 证书到期告警已配；自建埋点 16 个 P0 事件可查；`robots.txt` / `sitemap.xml` 正确（**测算页/结果页 `noindex`**）；staging/preview `noindex` | 告警测试记录、sitemap 内容 | 发布 + 运维 | ☐ |
| **9** | **回滚方案已演练且可执行** | §7 分级回滚已走查；**L1 路径 A/B 在 staging 演练过并记录耗时**；L2 规则包回滚 + 缓存 purge 演练过；备份可恢复性已抽查；触发条件表（§7.6）与责任人已确认并通知到人 | 演练记录、`PREVIOUS_TAG` 存在 | 发布 | ☐ |
| **10** | **发布窗口与应急联系人到位** | 窗口不在禁止时段（§1.4）；发布单已发出并**签字确认**；值班表（发布师 + 研发师 + 运维）确认且**在线**；公告与客服话术就绪；升级路径已通知 | 发布单、值班表 | 发布 + 团长 | ☐ |

**十项全绿方可发布。任一红项 → 拒绝发布，写明阻塞项并上报团长（禁止"带病上线"）。**

### 12.1 发布后 72 小时 + 7 天观察表

| 时点 | 检查项 | 判定 |
|------|--------|------|
| T+30min | 8 条冒烟 + 错误率/可用性/P95/导出成功率四项指标 | 全绿才视为发布成功 |
| T+2h | Uptime Kuma 无新增告警；Sentry 无新增未知错误类型；告警静默期解除 | — |
| T+24h | 自评完成率、导出率与基线一致；客诉量正常；规则包 sha256 巡检一致 | — |
| T+72h | 出观察报告（→ Phase 4 运维方案输入）；告警误报调优；用户反馈 Top3 进需求池 | — |
| **T+7d** | **首发观察期收尾**：月可用性 ≥99.5% 达成情况；北极星 WCSO 首周数据；决定是否进入常规版本节奏 | 参考文件 §十一 + 本方案 §0.3 |

---

## 13. 附录：命令速查

```bash
# ---------- 发布 ----------
cd /opt/hitech && ./deploy.sh v1.0.0-a1b2c3d prod        # 全量发布
cd /opt/hitech && ./deploy.sh v1.0.0-a1b2c3d staging     # 预发

# ---------- 回滚 ----------
sed -i 's/127.0.0.1:3001;/127.0.0.1:3000;/' nginx/conf.d/upstream.conf   # L1 路径A：切流
docker compose exec -T nginx nginx -t && docker compose exec -T nginx nginx -s reload
./rollback.sh app $(cat PREVIOUS_TAG)                     # L1 路径B：拉起旧镜像
docker compose exec -T redis redis-cli --scan --pattern 'rp:*' | xargs -r docker compose exec -T redis redis-cli del   # L2 清规则包缓存

# ---------- 灰度 ----------
vi nginx/conf.d/upstream.conf        # 改 split_clients 的 5% → 20% → 50% → 100%
docker compose exec -T nginx nginx -t && docker compose exec -T nginx nginx -s reload

# ---------- 健康检查 ----------
curl -s -o /dev/null -w '%{http_code}\n' https://www.<主域>/api/v1/health
curl -s https://www.<主域>/api/v1/ready
curl -s https://www.<主域>/api/v1/meta | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['policy_version'],d['rulepack_sha256'])"

# ---------- 备份 / 恢复 ----------
docker compose exec -T mysql mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction hitech_prod | gzip > /opt/hitech/backup/db_$(date +%Y%m%d_%H%M).sql.gz
python3 /opt/hitech/tools/upload_backup.py --dir /opt/hitech/backup --bucket "$COS_BACKUP_BUCKET"
python3 /opt/hitech/tools/download_backup.py --latest --out /tmp/restore.sql.gz && gunzip -c /tmp/restore.sql.gz | docker compose exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" hitech_prod

# ---------- 证书 ----------
certbot renew --dry-run
certbot renew --quiet --deploy-hook "cd /opt/hitech && docker compose exec -T nginx nginx -s reload"
echo | openssl s_client -connect www.<主域>:443 -servername www.<主域> 2>/dev/null | openssl x509 -noout -dates -issuer

# ---------- 合规扫描 ----------
python3 tools/compliance/scan_copy.py --strict       # 禁词 + 免责声明位
pnpm licenses list --json > licenses.json && python3 tools/compliance/check_licenses.py
curl -s https://www.<主域>/ | grep -E '<script[^>]+src="https?://' | grep -v '<主域>'   # 期望：无输出（无第三方脚本）

# ---------- 运维日常 ----------
docker compose ps && docker stats --no-stream
docker system df && docker image prune -a --filter "until=168h"   # 清理 7 天前镜像（保留最近 3 个版本）
docker compose logs --tail=200 app | python3 -c "import sys,json;[print(json.loads(l).get('msg')) for l in sys.stdin if l.strip().startswith('{')]"
```

---

## 14. 交付与交接说明

| 下游 | 交付内容 |
|------|---------|
| **运维守护师（Phase 4）** | ① 部署形态（单机 Docker Compose / 三类制品分离）② 灰度与软灰度手段（G0~G5）③ **回滚触发条件表 §7.6 与分级预案 L1~L5**（监控告警阈值需与其对齐）④ 观察指标与阈值（§6.6）⑤ 扩容触发线（§9.5）⑥ 72h/7d 观察表（§12.1） |
| **团长** | ① 关键依赖与阻塞项（§11.3，尤其 D-01 备案、D-04 测试门禁、D-06 法务签字）② 发布窗口与值班安排（§1.4 / §10.3）③ 合规红线状态（§8） |
| **研发师** | ① 需补齐的发布必需项：`/api/v1/health`、`/api/v1/ready`、禁词扫描脚本、合规断言脚本、`deploy.sh`/`rollback.sh`、`tools/smoke.sh` ② 迁移 expand→migrate→contract 纪律（§7.3） |
| **质量测试官** | ① 门禁结论需求（§12 第 1 项）② 8 条冒烟用例（§6.6）需纳入其回归套件 |

---

> **本方案的一票否决项（复述）**：① **ICP 备案未通过，禁止对外正式发布**；② **测试未达质量门禁，拒绝安排发布**；③ **无可执行回滚预案，不发版**；④ **合规红线（免责声明/禁词/政策文号/第三方脚本）任一未过，阻断发布**。

[上线发布方案]
