# 高新技术企业认定评分测算系统 —— 运维保障方案 v1.0

> 承接角色：运维守护师（ops-sre）｜全栈智造专家团 **Phase 4**
> 上游输入（已落盘，本方案不与之冲突）：
> ① `phase1-需求与平台选型报告.md`（选品洞察师）｜② `phase1-产品定义方案-PRD.md`（产品主理人）｜③ `phase1-技术研发方案.md`（全栈研发师）
> 参考文件：`skills/forge-orchestrator/references/ops-monitoring.md`（三层指标 / 分级告警 / 应急四步 / 备份演练 / 预算护栏 / SLA）
> 形态基线：**PC Web 响应式 + Web 管理后台**（无 App/小程序）｜**单机 2 vCPU 4GB + Docker Compose + Nginx + certbot**｜Node 20 + Prisma 5 + MySQL 8.0.36 + Redis 7（可降级）+ 腾讯云 COS（30 天生命周期）+ Playwright PDF + ExcelJS｜CI＝GitHub Actions｜观测＝pino + Sentry SaaS + Uptime Kuma
> 预算基线：**200 ~ 600 元/月**｜SLO 基线：**月度可用性 ≥99.5%（≈3.6 小时/月错误预算）**
> 脚本示例统一 **python3**；所有命令默认在 `/srv/hitech` 目录下以 `ops` 用户执行。

---

## 0. 摘要与运维结论（一页速览）

### 0.1 一句话运维结论

**这是一台 2C4G 单机承载全部有状态组件（MySQL / Redis / COS 网关 / Chromium）的"单故障域"部署，运维设计的核心不是消灭单点，而是：①把唯一不可重建的数据（MySQL + 规则包）做到 RPO ≤15 分钟 / RTO ≤60 分钟的异地加密备份并季度演练；②把最高危风险（规则包错误导致分数系统性算错）做成"发布前影子复算 + 发布后 30 分钟分布哨兵 + 自动回滚"的三道闸；③用三层监控（基础设施/应用/业务）覆盖掉"资源正常但业务静默故障"的盲区；④用 500 元/月硬预算 + 日账单护栏把季节性洪峰（申报季峰谷比 10:1）的成本失控关进笼子。**

### 0.2 五条不可妥协的运维红线

| # | 红线 | 落实手段 | 违反后果 |
|---|------|----------|----------|
| **R-1** | **分数不能算错**（误导申报决策比宕机更严重） | 规则包发布三重门禁（CI 回归 B1~B16 + 财务 16 组 + 双端一致性）→ 影子复算 diff 报告 → 发布后 30 分钟「平均总分偏移」哨兵，偏离 >2 分自动回滚；每日离线 golden-case 全量复算 diff=0 | 用户据此做出错误的申报/补强投入决策，产品信誉不可逆 |
| **R-2** | **监控不能只有 CPU/内存** | 三层 46 项指标（§3），其中业务层 9 项含 DAU 环比、自评完成率、导出次数、预检不通过率、平均分分布异常检测 | 典型的"资源全绿、业务已死"静默故障 |
| **R-3** | **每条告警必须有阈值 + 持续时长 + 渠道 + 负责人 + 动作** | §3.2~3.4 七列告警表，无"人工排查"式空动作 | 告警等于噪音，等于没有告警 |
| **R-4** | **没演练过的备份等于没有备份** | RPO ≤15min / RTO ≤60min 明文承诺；每月自动恢复校验 + 每季度全流程恢复演练，演练报告进存档 | 真出事才发现备份损坏 |
| **R-5** | **成本不能失控** | 月度预算 500 元 + 80%/100% 双护栏 + 单日 >50 元异常告警 + COS 外网流量日 >5GB 防盗链告警 | 一次盗刷/配置失误吃掉全年预算 |

### 0.3 与技术研发方案的关键口径核验（不冲突声明）

| 技术研发方案口径 | 本方案承接方式 | 是否冲突 |
|------------------|----------------|----------|
| §2.1 "Chromium 同容器子进程，**并发≤2**" | 2C4G 下实测内存预算仅够 **1 并发**；`PDF_CONCURRENCY=1` 为常态，**并发 2 仅在申报季升配至 4C8G 后启用**（§2.3）。即 2 为"4C8G 峰值参数"，2C4G 下不允许 | 否（本方案补齐了规格约束） |
| §2.4 "单机 ≠ 无高可用，故障重建 **RTO ≤4h**" | 沿用；本方案进一步区分：**整库恢复 RTO ≤60min**、**整机重建 RTO ≤4h** | 否（细化，未加严 conflicts） |
| §2.4 SLO **月度 ≥99.5%** | 沿用，并给出统计口径与错误预算机制（§7.1） | 否 |
| Redis "单实例无持久化，可降级进程内实现" | 承接为：**Redis 为可降级依赖，不得成为可用性单点**（§5.2）；多实例前不得从"可降级"升级为"强依赖" | 否（但标记为架构债，见 §11） |
| COS "生命周期 30 天自动删除" | **PDF/Excel 产物明确不备份**（可重算重建），需在 UI 明示到期日 | 否（需产品侧确认文案） |
| Uptime Kuma 同机部署 | ⚠ **冲突**：主机宕机时 Kuma 同时失联 → 无法告警。已给出替代方案（外部免费拨测 + 云厂商控制台告警），见 §1.5 与 §11 | **是（已上报团长，见 §11）** |

### 0.4 单页速查卡（故障时就地可用）

```
【故障第一动作】先看变更、再看依赖、后看资源 —— 15 分钟内必须给出初步判断
【一键止血】  ssh ops@<ip> 'cd /srv/hitech && python3 scripts/ops/fast_triage.py'
              # 输出：容器状态 / 磁盘 / 内存 top5 / 最近 20 条 ERROR / Nginx 5xx 近 5min / 最近一次规则包发布时间
【一键回滚】  cd /srv/hitech && IMAGE_TAG=<上一个稳定 tag> docker compose up -d
【规则包回滚】cd /srv/hitech && python3 scripts/ops/rulepack_rollback.py --to <version> --reason "<原因>"
【PDF 降级】  curl -X POST http://127.0.0.1:3000/api/v1/ops/feature-flags -d '{"pdf_service":"degraded"}'  # 或改 .env PDF_ENABLED=false 重启
【只读降级】  python3 scripts/ops/feature_flag.py set read_only true   # 关闭写入型接口，保住读流量
【人工旁路】  nginx 静态兜底页 /var/www/maintenance/index.html 已预置，切换：python3 scripts/ops/switch_maintenance.py on
【值班表】    OPS-1 主责 7×12（08:00-20:00 电话可达，其余短信），OPS-2 备份；升级路径见 §7.5
【外部拨测】  UptimeRobot 免费额度 + 云厂商两地拨测（主机宕机时仍能告警）
```

---

## 1. 部署架构与拓扑

### 1.1 资源清单（V1.0 生产基线）

| 资源 | 规格 | 数量 | 月成本（元） | 说明 |
|------|------|------|--------------|------|
| 云服务器 | 2 vCPU / 4GB / SSD 100GB / 固定带宽 5Mbps | 1 | 120~180（包年折月） | 大陆云（ICP 备案强制）；系统盘 30GB + 数据盘 100GB |
| 弹性公网 IP | 固定带宽 5Mbps | 1 | 含在主机 | 申报季可临时升 8Mbps（+60~80 元/月，部分按天结算） |
| 云盘快照 | 增量快照 100GB | 1 | 15~25 | 每日 1 次，保留 7 天 + 每月首快照保留 12 月 |
| 对象存储 COS | 标准存储 ~20GB + 归档 ~30GB | 2 桶（主/异地备份） | 8~20 | 私有桶 + CDN 回源 + 30 天生命周期 |
| 跨地域复制 | 主桶 → 异地桶（不同 region） | 1 | 已含 | 备份异地存放（§6.5） |
| CDN | 静态加速 50GB/月（可选，建议申报季开启） | 1 | 0~20 | 申报季开启，淡季关闭以省成本 |
| 域名 | .com/.cn | 1 | ~8（100 元/年） | ICP 备案主体必须一致 |
| TLS 证书 | Let's Encrypt（certbot） | 1 | 0 | 90 天自动续期，监控剩余天数（§3.2 A-08） |
| Sentry | SaaS Free 额度（5k errors/月 + 10k spans） | 1 | 0 | 超限先降采样，不盲目升级（§9.4） |
| 外部拨测 | UptimeRobot 免费（5 监视器/5min）+ 云厂商拨测免费额度 | 1 | 0 | **关键**：与业务不同故障域（§11 C-1） |
| 备份/运维脚本 | crontab + systemd timer | — | 0 | 全部自研 python3，纳入 Git 版本管理 |
| **合计** | | | **淡季 231~273 元/月｜申报季 351~573 元/月** | 落在 200~600 元预算带内 |

> **不适用/明确不采购**：负载均衡 SLB、托管数据库 RDS（≠演进触发后才引入，§1.6）、消息队列、K8s、Prometheus 商用版、WAF 商业版（用云厂商免费基础防护 + Nginx 限流替代，§8.3）、短信通道（V1.0 无）。

### 1.2 Docker Compose 编排、端口与网络

**容器清单与资源配额**（`docker-compose.prod.yml`）：

| 服务 | 镜像 | 对外端口 | 内部端口 | cpus | mem_limit | 重启策略 |
|------|------|----------|----------|------|-----------|----------|
| `nginx` | nginx:1.25-alpine | 80 / 443 | — | 0.5 | 256m | unless-stopped |
| `app` | ghcr.io/<org>/hitech-web:<tag> | **不对外**（仅 127.0.0.1:3000） | 3000 | 1.4 | **2048m**（Node `--max-old-space-size=1536`） | unless-stopped |
| `mysql` | mysql:8.0.36 | **不对外** | 3306 | 0.8 | 1024m | unless-stopped |
| `redis` | redis:7.2.5-alpine | **不对外** | 6379 | 0.2 | 384m | unless-stopped |
| `uptime-kuma` | louislam/uptime-kuma:1.23 | **不对外**（Nginx 反代 `/status/`，需 Basic 认证 + IP 白名单） | 3001 | 0.2 | 256m | unless-stopped |
| `certbot` | certbot/certbot:v2.10 | — | — | — | — | 由 systemd timer 触发（非长驻容器） |

**端口矩阵（安全组只放通 80/443）**：

| 端口 | 服务 | 暴露范围 | 说明 |
|------|------|----------|------|
| 80/tcp | Nginx | 0.0.0.0 | 仅用于 ACME 校验 + 301 跳 HTTPS |
| 443/tcp | Nginx | 0.0.0.0 | TLS 终结，HTTP/2 + brotli |
| 3000/tcp | app | **127.0.0.1 only** | 禁止公网；Nginx upstream |
| 3306 / 6379 / 3001 | MySQL / Redis / Kuma | **Docker 内网 bridge only**（`compose` 不写 ports） | 主机上 `--publish` 一律禁止；CI 静态检查（§8.4） |
| 20222/tcp | sshd | 仅运维固定 IP 段（或零暴露，走云控制台 VNC） | 见 §8.4 SSH 加固 |

**网络拓扑图**：

```
                                      Internet
                                          │ ① Cloud DNS / ICP 备案域名
                                          ▼
                    ┌──────────── 云安全组（仅 80/443 入站）────────────┐
                    │                                                   │
                    ▼                                                   │
        ┌──────────────────────────┐                                    │
        │   Nginx 1.25 (容器)      │  TLS1.2+ 终结 / HSTS / gzip+br /    │
        │  rate-limit / 安全响应头 │  静态资源 / maintain 兜底页         │
        └───────┬──────────────────┘                                    │
                │ proxy_pass http://app:3000 (127.0.0.1 映射)           │
                ▼                                                       │
   ┌─── Docker bridge: hitech-net (172.20.0.0/24) ─────────────────┐    │
   │                                                               │    │
   │  ┌─────────────── app (Node 20, Next standalone) ──────────┐  │    │
   │  │ Next App Router SSR/ISR + /api/v1 + /admin              │  │    │
   │  │ pino → stdout(jsonl) → /data/logs/app/*.jsonl           │  │    │
   │  │ @hitech/rule-engine（纯函数，零 IO）                     │  │    │
   │  │ ├─ Prisma → MySQL ├─ Redis(可降级进程内 Map)            │  │    │
   │  │ ├─ cos-sdk ────────────────────────────────────┐        │  │    │
   │  │ └─ Playwright Chromium（子进程，并发 ≤1@2C4G）  │        │  │    │
   │  └────────────────────────────────────────────────┘        │  │    │
   │        │              │                 │                  │  │    │
   │        ▼              ▼                 ▼                  │  │    │
   │  ┌──────────┐  ┌────────────┐  ┌──────────────────┐        │  │    │
   │  │ MySQL 8  │  │ Redis 7.2  │  │ healthz/readyz/  │        │  │    │
   │  │ /data/mysql│ │ maxmem 256m│  │ metrics 端点     │        │  │    │
   │  └──────────┘  └────────────┘  └──────────────────┘        │  │    │
   │  ┌──────────────────────────────────────────────────┐      │  │    │
   │  │ uptime-kuma（探活 + 证书到期监控 + 状态页）        │      │  │    │
   │  └──────────────────────────────────────────────────┘      │  │    │
   └───────────────────────────────────────────────────────────┘    │
                │                                  │  COS SDK 内网/公网│
                ▼                                  ▼                 │
   云盘快照（每日，本地可用区）            ┌──────────────────┐        │
   /data/mysql /data/logs /data/backups   │ 腾讯云 COS 私有桶 │◀───────┘
                                          │  (PDF/XLSX 产物   │
                                          │   30 天生命周期)  │
                                          └────────┬─────────┘
                                          cross-region replication
                                                   ▼
                                          ┌──────────────────┐
                                          │ 异地备份桶(另一   │
                                          │ region，含 DB 备 │
                                          │ 份/规则包快照)   │
                                          └──────────────────┘

   外部观测（与主机不同故障域，关键！）：
   UptimeRobot(5min) + 云厂商两地拨测(1min) + Sentry SaaS + 云监控 Agent
```

### 1.3 Nginx 反代与 TLS

**Nginx 关键配置要点**（配置源文件 Git 版本化，`/srv/hitech/nginx/conf.d/hitech.conf`）：

| 项 | 配置 | 理由 |
|----|------|------|
| TLS | `ssl_protocols TLSv1.2 TLSv1.3;` `ssl_ciphers HIGH:!aNULL:!MD5;` `ssl_session_cache shared:SSL:10m; ssl_session_timeout 1d;` | 安全基线，SSL Labs ≥A |
| HSTS | `Strict-Transport-Security: max-age=31536000; includeSubDomains`（首次审查后加 `preload`） | 合规 §5.3 全站 HTTPS |
| 安全头 | `X-Content-Type-Options: nosniff`、`X-Frame-Options: SAMEORIGIN`、`Referrer-Policy: strict-origin-when-cross-origin`、`Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'self'` | ⚠ **禁第三方统计脚本**（PRD §10.3），CSP 从架构上阻断引入 |
| 压缩 | gzip（text/js/css/json）+ brotli（静态资源） | 带宽成本（§9） |
| 静态缓存 | `/_next/static`、`/fonts/*` `expires 365d, immutable`；`/api/*` `no-store` | 降回源 QPS |
| 限流 | `limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;` burst=20 nodelay（`/api/v1/*`）；`zone=admin:1m rate=1r/s`（`/admin/*`）；`zone=export:1m rate=1r/3s`（`/api/v1/reports/export`） | 抗刷与洪峰（§5.10） |
| 单 IP 连接数 | `limit_conn_zone $binary_remote_addr zone=perip:10m;` `limit_conn perip 30;` | 抗爬虫 |
| 请求体 | `client_max_body_size 2m;`（导出请求体很小） | 防大 body 打爆内存 |
| 超时 | `proxy_connect_timeout 5s; proxy_read_timeout 60s;`（PDF 导出走异步 202，不占长连接） | PDF 慢任务走队列不阻塞 Nginx |
| upstream | 单实例；预留 `server app2:3000 backup;` 注释行（V1.1 多实例时启用） | 扩容无缝（§1.6） |
| 维护页 | `location @fallback` → `/var/www/maintenance/index.html`（含备案信息与恢复时间承诺） | §5 应急统一兜底 |
| 访问日志 | json_log 格式，rotate 按 100MB / 保留 30 天 | 日志规范（§4） |
| **禁止** | 不得在 Nginx 日志打印 query string 中的 token（`/s#token` 走 hash 天然不传服务端；下载接口 token 走 Header） | 短链令牌不落日志（C-4） |

**certbot 续期**：systemd timer 每日 03:33 与 15:33 两次尝试 `certbot renew --webroot` → 成功后 `nginx -s reload`；续期结果写入 `/data/logs/ops/certbot.log`，由 §3.2 A-08 证书剩余天数告警反向校验（双保险）。

### 1.4 数据与产物落盘路径

| 路径 | 内容 | 容量 | 备份 | 备注 |
|------|------|------|------|------|
| `/data/mysql/` | MySQL datadir（ibdata/ibd/redo） | 40GB | ✅ 每日全备 + binlog | bind mount，勿用 docker volume（便于主机层快照/校验） |
| `/data/mysql-binlog/` | binlog（`ROW` 格式，`expire_logs_days=3`） | 8GB | ✅ 每 15min 增量同步 COS（申报季 5min） | 用于 PITR，是 RPO 的实现基础 |
| `/data/redis/` | **空**（无持久化，不落盘；仅 `/tmp`） | — | ❌ | Redis 单实例无持久化是既定基线 |
| `/data/app-static/` | Next 静态产物、`/_next/static`（由镜像提供，只读） | — | ✅ 镜像内 | 升级随镜像滚动 |
| `/data/app-tmp/` | PDF 渲染中间产物（Chromium 临时 profile/打印 PDF） | 2GB | ❌ | **必须清理**：渲染完成即 delete；残留 >1GB 触发 P2（§3.2 A-05） |
| `/data/backup-local/` | 最近 3 天 mysqldump 密文 + policy_versions JSON 快照 | 12GB | ✅（本地滚动 3 天） | 异地副本在 COS 备份桶 |
| `/data/logs/app/` | pino jsonl（app，按 200MB rotate，保留 14 天） | 5GB | ✅ 归档 COS 90 天 | 见 §4.4 |
| `/data/logs/nginx/` | access json + error log（保留 30 天） | 2GB | ✅ 归档 COS 90 天 | |
| `/data/logs/ops/` | 备份/演练/定时任务/巡检脚本日志 | 1GB | ✅ 归档 COS 180 天 | 审计用途，含备份成功核验记录 |
| `/srv/hitech/` | compose 文件、`.env`（600 权限）、脚本、maintenance 页 | — | ✅ Git（`.env` 除外，走密码库） | **`/srv/hitech/.env` 严禁入库** |
| COS 主桶 `/reports/{yyyy}/{mm}/{report_id}.{pdf\|xlsx}` | 导出产物 | 30 天自动删 | ❌ 不备份（可重算） | 需在 UI 明示到期日 |
| COS 主桶 `/artifacts/events-archive/*.csv.gz` | events 月度归档 | 保留 12 个月 | ✅ 异地复制 | events 主表保留 6 个月 |

**磁盘分区方案（100GB 数据盘 + 30GB 系统盘）**：

| 挂载点 | 大小 | 用途 | 告警线 |
|--------|------|------|--------|
| `/` | 30GB | OS + Docker + 镜像缓存 | >80% P2 / >90% P1 |
| `/swap`（swapfile 2GB） | 2GB | OOM 缓冲（swappiness=10） | swap 使用 >200MB 持续 30min → P2 |
| `/data/mysql` | 40GB | MySQL 数据目录 | >75% P2 / >85% P1 |
| `/data/app-tmp` | 4GB | Chromium 临时 | >60% P2 / >80% P1（并触发强制清理） |
| `/data/backup-local` | 12GB | 近 3 天本地密文备份 | >70% P2（检查异地是否成功） |
| `/data/logs` | 8GB | 全部日志 | 见 §4.4 水位联动 |
| 余量 | ~4GB | 在线扩容缓冲 | — |

### 1.5 单机故障域说明（必须让所有人知道）

| 故障域 | 内容 | 单点后果 | 兜底手段 |
|--------|------|----------|----------|
| **云主机**（最大故障域） | 全部容器 + 本地数据 | 全站不可用；本地备份丢失（COS 副本幸存） | COS 异地备份 + 云盘快照 + 镜像 tag → **整机重建 RTO ≤4h**（演练值）；外部拨测（不同故障域）保证告警可达 |
| **可用区** | 主机所在 AZ | AZ 故障 → 全站停 | **V1.0 无跨 AZ 能力**（成本不允许）；快照跨 AZ 复制 + 异地备份桶 → 可在另一 AZ 重建（≤4h）。对外 SLA 仅承诺 99.5% |
| **MySQL** | 全部持久化业务数据 | 写失败、页面 500 | 容器重启 + binlog PITR；**RTO ≤60min / RPO ≤15min** |
| **Redis** | 规则包缓存/幂等键/限流/导出队列 | 降级后功能可用、性能下降 | `REDIS_URL` 为空自动降级进程内 Map（既定基线）；⚠ **降级后队列为内存队列，重启丢任务** → 降级状态下 export 请求自动失败快返（§5.2） |
| **Chromium** | PDF 导出 | PDF 不可用，Excel/查看不受影响 | 队列有界 + 一键降级到浏览器 `window.print()`（§5.5） |
| **COS** | 产物下载 | 下载失败，算分/查看不受影响 | 本地临时目录兜底直下 24h（§5.8） |
| **Uptime Kuma** | 告警可达性 | ⚠ **同机部署 → 主机宕机时 Kuma 一并失联** | **外部拨测 + 云监控 Agent + Sentry**（§11 C-1，已上报团长） |
| **certbot/证书** | HTTPS 可用性 | 全站证书告警 | 21/7/3 天三级告警 + 手动 DV 证书应急签发路径 |

### 1.6 扩容触发条件（何时从单机演进到多实例 / 托管数据库）

> 原则：**不到阈值不扩容**（成本红线）；指标由 §3 监控持续供给，任一条连续满足 **7 天** 或单条严重突破 **2 小时** 即启动扩容评估（输出评估单提交团长）。

| # | 触发条件（阈值） | 动作 | 目标形态 | 预估月增成本 |
|---|------------------|------|----------|--------------|
| T-1 | CPU P95 >70% 持续 7 天，或 >90% 持续 2h（已排除异常任务） | 垂直升配 2C4G → 4C8G（申报季永久化） | 单机 4C8G，`PDF_CONCURRENCY=2`，MySQL buffer_pool 640M→2G | +150~260 元 |
| T-2 | PDF 队列长度 P95 >16 或日均导出 >800 份持续 7 天 | **先**升配 + 并发 2；**仍不足**才拆 Worker | `report-export` 拆独立 Worker 进程（同机另一容器，共享 COS → 无状态） | +0（同机）/ +80（加 1C2G） |
| T-3 | **`app` 无状态化完成**（session/幂等/队列全部外移到 Redis，本地磁盘零写）且 峰值 QPS >8 req/s 持续 7 天 | 水平扩容 app 到 2 实例 + Nginx upstream 负载均衡 + Redis 转强依赖 | 2×app + Nginx LB + Redis（开启 AOF） | +120~200 元（第二台 2C4G 或加 2C4G） |
| T-4 | MySQL 磁盘 >75% 或 连接数使用率 >80% 持续 7 天，或 需要 **10 分钟内自动故障切换** | 迁至云托管 MySQL（主从高可用版）+ 只读实例 | RDS MySQL 高可用版 1 主 1 备 | +150~400 元 |
| T-5 | 月内发生 ≥1 次 P0 停机且根因为单机故障，或 对外承诺需 ≥99.9% | 多可用区改造（LB + 2 AZ + 托管 DB + Redis 主从） | 标准高可用架构 | +600~1200 元（需团长与预算重议） |
| T-6 | 团队 ≥3 人 / 实例数 ≥3 | 引入 Prometheus + Grafana（替代 pino+脚本聚合）+ Loki | 完整可观测栈 | +0（自托管于新增机） |
| T-7 | DAU 超过 1 万 / 自评次数 >2000 次/日 | 全链路重估（含 CDN 全量静态化 + 规则包 CDN 分发） | — | 重出 capacity plan |

> **反向降配纪律**：扩容后连续 **14 天** 满足「CPU P95 <40% 且 内存 P95 <60% 且 DAU 回落至触发值 50% 以下」→ 强制评估降配，避免"扩上去下不来"。

---

## 2. 容量规划与性能基线

### 2.1 2C4G 内存预算（为什么不允许多于 1 个 Chromium 并发）

总量 4096MB，OS/内核预留 8% ≈ 320MB → **可用 ≈ 3766MB**。

| 占用方 | 限额(MB) | 依据 |
|--------|----------|------|
| Nginx | 256 | worker_processes=2，`worker_connections 1024`，每连接 ~30KB + 缓冲区 |
| **app（Node）** | 2048（硬限）/ 目标常驻 1200~1500 | `--max-old-space-size=1536` + V8 外部内存 + Prisma engine + Chromium 父子共享部分开销 |
| MySQL | 1024 | `innodb_buffer_pool_size=640M` + 每连接 2~4MB × max_connections=120 上界 + 排序/临时表缓冲 |
| Redis | 384 | `maxmemory=256mb` + 碎片 ~1.4× |
| Uptime Kuma | 256 | Node + SQLite |
| **已承诺小计** | **2968** | |
| **剩余（供 Chromium + page cache）** | **≈798** | ⚠ 单个 headless Chromium RSS 常态 **250~350MB**、复杂报告峰值 **500~700MB** |

**结论（写入基线配置）**：

- 2C4G 下 **`PDF_CONCURRENCY=1`**（硬编码默认），**允许 1 个 Chromium 常驻 + 1 个突发渲染**，突发总内存上限由 `app` 容器的 2GB mem_limit 兜住（超则 OOMKill 单个渲染，不拖垮进程）；
- **`PDF_CONCURRENCY=2` 仅在 4C8G（申报季临时升配）下启用**，配置随 spec 走环境变量模板，禁止在 2C4G 上手动改；
- `vm.swappiness=10` + 2GB swapfile 作为 OOM 缓冲，**但 swap 使用 >200MB 持续 30min 必须告警排查**（swap 只是争取重建时间，不是扩容方案）。

### 2.2 并发估算模型（给增长运营师的活动容量接口）

**请求构成假设**（单用户一次完整自评访问 ≈ 25 次 HTTP 请求）：

- 静态/`/\_next/static`／CDN：14 次 → **不打到 Node**
- SSR/ISR 内容页（政策百科、FAQ）：6 次 → CDN/ISR 缓存命中则不打到 Node；**回源打击力最大**
- 动态 API（算分、台账 CRUD、预检、导出状态轮询）：5 次 → 打到 Node + MySQL

**单能力基线（实测后回填，上线首月为估算）**：

| 能力项 | 2C4G 基线 | 推导 |
|--------|-----------|------|
| Nginx 静态/缓存转发 | ≈ 800~1200 req/s（受 5Mbps 带宽限制：平均响应 80KB → **实际 ≈ 6.4 req/s 出口上限 @5Mbps**） | ⚠ **带宽才是第一瓶颈**，见下方"带宽换算法" |
| SSR 动态页渲染 | ≈ 8~10 req/s | 2 核 ÷ P95 渲染 CPU 120ms，derate 40%（GC + PDF 争抢） |
| `/assessments/calculate`（persist=false，rulepack 缓存命中） | ≈ 40~60 req/s | 纯 CPU + Redis GET，engine.evaluate ≤5ms + 诊断 ≤25ms |
| `/assessments/calculate`（persist=true 事务写 25 行 items） | ≈ 25~35 req/s | 受云盘 IOPS 限制（每次自评 ≈ 30~40 IOPS；SSD 云盘基线 IOPS ≈ 1500~3000） |
| 台账 CRUD | ≈ 30~50 req/s | 单行写，受 IOPS 限制 |
| **PDF 导出吞吐** | **≈ 6~10 份/分钟（360~600 份/小时）** @并发 1 | 单份 ≈ 6~12s（Chromium 进程冷启动 ~1.5s + SSR 打印路由渲染 3~8s + PDF 转写 1~2s） |
| Excel 导出吞吐 | ≈ 30~60 份/分钟 | ExcelJS 流式写出，无浏览器开销 |
| MySQL 连接 | `max_connections=120`，Prisma `connection_limit=20`，`pool_timeout=10s` | 预留给备份/后台查询/临时分析 |

**带宽换算法（必须写进活动评估）**：
```
可支撑 QPS_bandwidth ≈ 带宽(Mbps) × 0.125 (MB/s) ÷ 平均响应体大小(MB)
 5Mbps / 平均 80KB ≈ 6.25 req/s   ← 无 CDN 时的真实天花板
12Mbps / 平均 80KB ≈ 15    req/s
启用 CDN 后：静态命中率按 85% 计 → 有效 QPS ≈ 6.25 ÷ (1-0.85) ≈ 41 req/s
```

**峰值换算（V1.0 首个申报季预测）**：

```
假设：平日 DAU 800；申报季峰值 DAU 8000（峰谷比 10:1，已按最坏给）
      人均 25 次请求；80% 流量集中在 6 小时（21600s）
平均 QPS   = 8000 × 25 × 0.8 / 21600            ≈ 7.4 req/s
其中动态 API = 8000 × 5  × 0.8 / 21600          ≈ 1.5 req/s  （×2 瞬时系数 ≈ 3 req/s）✅ 远低于 25~60 上限
其中 SSR 回源（假设 ISR 命中率 70%）= 8000×6×0.8×0.3/21600 ≈ 0.53 req/s ✅
静态（走 CDN 后不计带宽）= 8000 × 14 × 0.8 / 21600 ≈ 4.1 req/s → CDN 承担 85%+ ✅
PDF 需求 = DAU 8000 × 导出率 15% = 1200 份/日，集中在 6h → 200 份/小时
        ≥ 2C4G 并发 1 的 360~600 份/小时？→ 余量不足 2 倍 ⚠ → 申报季必须升 4C8G + 并发 2（720~1200 份/小时）
```

> **给增长运营师的容量接口（写进协作契约）**：任何投放/裂变/活动，**提前 7 天**提交预计 DAU 与峰值 QPS → OPS 用本模型核算 → 若 **预计峰值 QPS >25 req/s 或 日导出 >600 份**，则必须在活动前 5 个工作日完成升配（T-1/T-2）。临时加量不提前申报的，OPS 有权按「保障既有用户」原则启动限流（§5.10）。

### 2.3 PDF 导出：内存、并发、队列上限（本项目最脆弱环节）

| 参数 | 2C4G 常态 | 4C8G 申报季 | 说明 |
|------|-----------|-------------|------|
| `PDF_CONCURRENCY` | **1** | 2 | 渲染并发，超配必 OOM |
| 队列上限（`PDF_QUEUE_MAX`） | 32 | 64 | **有界队列**：超限直接 `429 + 错误码 42901`，不无限堆积 |
| 单任务软超时 | 45s | 45s | 超时即杀 Chromium 并标记 `failed`（error_code `50002`） |
| 单任务硬超时 | 60s | 60s | Nginx `proxy_read_timeout 60s` 对齐 |
| 单用户导出限流 | 3 次/分钟、10 次/小时 | 同 | 防单用户打爆队列 |
| 队列等待时间目标 | P95 ≤30s | P95 ≤30s | >90s → P1 告警（§3.3 P-06） |
| Chromium 启动参数 | `--no-sandbox` **禁用**（必须保留 sandbox），采用 `--disable-dev-shm-usage --disable-gpu` | 同 | 建议：`--disable-dev-shm-usage`（防 /dev/shm 64MB 打爆）+ `--font-render-hinting=none`；**禁用 `--no-sandbox`**（安全） |
| 单渲染内存上限 | cgroup 限制由 app mem_limit 兜底；每任务完成后 `browser.close()` + `rm -rf /data/app-tmp/*` | 同 | 不做 `context` 复用，防内存泄漏累积 |
| 泄漏防护 | app 每处理 200 个 PDF 任务或 RSS >1600MB 时触发**优雅自重启**（drain→SIGTERM→容器 restart） | 同 | 见 §5.5 处置步骤 5 |

### 2.4 Redis 内存上限与键空间

| 用途 | 键前缀 | TTL | 峰值数量 | 估算占用 |
|------|--------|-----|----------|----------|
| Rulepack 编译结果缓存 | `rp:{version}:{sha256}` | 24h（可刷新） | ≤20 | ≤2MB |
| 幂等键（24h） | `idem:{key}` | 24h | ≤5000/日（峰值） | ≤2MB |
| 游客限流计数 | `rl:{scope}:{hash}` | 60s | ≤10000 | ≤1.5MB |
| 导出队列（有界 List） | `queue:pdf` | 任务级 | ≤32（峰值 64） | ≤1MB |
| 导出任务状态 | `task:{id}` | 1h | ≤2000/日 | ≤1MB |
| 会话/OTP（后台） | `admin:sess:*` | 30min | ≤10 | 极小 |
| **合计** | | | | **常态 <10MB；峰值 <20MB** |

- **`maxmemory 256mb` + `maxmemory-policy volatile-lru`**：远超需求，留出 10× 余量吸收异常写入。
- 告警：`used_memory >200MB`（P2）、`evicted_keys` 30min 内增长 >0（P2，**说明开始淘汰 = 限流/幂等可能失效**）、`keyspace` 总数 >50 万（P2，疑似刷子）。
- **禁止**：向 Redis 写入任何财务数据 / IP 全文 / token 明文（§4.3 脱敏清单同样适用）。

### 2.5 磁盘增长预测

**假设**：`local_only` 模式（V1.0）财务数据不明文落库（`enterprises.storage_mode='local_only'`），落库主要为 input snapshot + result_json + items + events + audit_logs。

| 对象 | 单条大小 | 旺季量（4~8 月） | 淡季量 | 年增量 |
|------|----------|------------------|--------|--------|
| `assessments` + `assessment_items`（含 InnoDB 开销 ×1.6） | ≈ 90KB/次自评 | 峰值 800 次/日 → 72MB/日，90 天 ≈ 6.5GB | 30~80/日 → 7MB/日 | ≈ 6.5 + 1.9 ≈ **8.4GB** |
| `events`（埋点，含 16 个 P0 事件） | ≈ 0.4KB/事件 × 20 事件/会话 ≈ 8KB/会话 | 8000 会话/日 → 64MB/日 → 归档后在线保留 6 个月 | 800/日 → 6.4MB/日 | 在线保留上限 ≈ **3GB**；归档 COS ≈ 8GB/年 |
| `audit_logs` | ≈ 1KB/条 | ~200 条/日 | ~50/日 | ≈ **0.1GB** |
| `policy_*` + `advice_templates` | 每次发布 ~200KB | 12 次/年 | — | ≈ **0.05GB**（**永久保留，全部版本**） |
| `snapshots`（30 天 TTL，payload 到期置空） | 峰值 ~2KB（去 payload 后） | 500/日 × 30 天 | — | 稳态 ≤ **0.3GB** |
| MySQL binlog（ROW，expire 3 天） | 10~40MB/日 | 旺季 40MB/日 × 3 天 | | 稳态 ≈ **0.12GB** |
| 容器镜像与 node_modules | Next+Chromium 镜像 ≈ 750MB（解压 1.8GB） | — | 每次发版 +1 镜像 | **保留最近 5 个 tag（常驻 ~9GB）** |
| 日志（§4.4） | 旺季 300MB/日 | 本地 14 天 | | ≈ **4.2GB 峰值占用** |
| **合计年增（不含镜像）** | | | | **≈ 12GB/年** |

**结论**：数据盘 40GB 可支撑 **约 2.5~3 年**；但**系统盘 30GB 会因镜像累积先告警**（≤5 个 tag，每个 750MB → 3.75GB + 日志 5GB + OS 4GB ≈ 13GB，安全）。

**异常增长守卫**：MySQL 数据目录 **日增 >500MB 持续 3 天** → P2（排查机器人刷接口/异常循环写）；`events` 表 **日增 >150MB** → P2（埋点风暴）。

### 2.6 扩容触发阈值汇总（指标 → 动作）

| 指标 | 观察窗口 | 触发动作 | 级别 |
|------|----------|----------|------|
| CPU P95 >70% | 7 天 | 评估 T-1（升配） | P2 |
| CPU >90% | 2h | 立即评估 T-1 / 紧急临时升配按天计费 | P1 |
| 内存 app RSS >1600MB | 持续 30min | 强制优雅重启 + 排查泄漏 | P1 |
| 磁盘 `/data/mysql` >75% | 实时 | 归档 events / 扩容数据盘 | P2 |
| MySQL 连接数使用率 >80% | 10min | 调 Prisma pool / 查慢查询 | P1 |
| PDF 队列长度 >16 | 5min | 升并发/限流通知 | P2 |
| 带宽出口 >4.5Mbps（5Mbps 的 90%） | 10min | 开 CDN / 临时升带宽 | P1 |
| 源站 QPS（Nginx 动态+SSR 回源）>8 req/s | 5min | **说明 ISR/CDN 失效**，紧急查缓存 | P1 |

---

## 3. 监控指标体系与告警阈值（三层齐备）

> 角色代号（上线前必须替换为真实姓名与联系方式，写入 `/srv/hitech/ops/CONTACTS.md`）：
> **OPS-1** 运维主值班（本人角色）｜**OPS-2** 运维备份值班｜**DEV-1** 全栈研发负责人｜**RULE-1** 规则与政策内容负责人｜**PM-1** 项目负责人（团长接口人）
>
> 通知渠道代号：**【电话】**＝云电话 API 群呼轮询至有人认领｜**【短信】**＝云短信/云监控短信｜**【IM】**＝企业微信/飞书值班机器人 @负责人｜**【邮件】**＝每日/每周汇总邮件｜**【Sentry】**＝Sentry Issue → IM webhook

### 3.1 采集与存储全景（先看清楚"数据从哪来、放在哪、在哪看"）

| 层 | 采集方式 | 存储位置 | 看板入口 | 月成本 |
|----|----------|----------|----------|--------|
| 拨测 | **①Uptime Kuma（同机，1min）②外部 UptimeRobot 免费额度（5min，境外节点）③云厂商两地拨测（1min，免费额度）** | Kuma SQLite + 云控制台 | Kuma 状态页（`/status/`，IP 白名单）+ 云控制台 | 0 |
| 基础设施 | **云监控 Agent（非容器内，Agent 崩溃不影响容器）** + `python3 scripts/ops/host_metrics.py`（每 60s 采集 CPU/Mem/Disk/inode/docker stats → 推自定义监控 + 落 `/data/logs/ops/metrics.jsonl`） | 云厂商控制台（默认保留 31 天）+ 本地 jsonl 14 天 | 云控制台 + `/data/logs/ops/daily_report.html`（静态日报，Nginx 内网暴露） | 0 |
| 应用（容器/进程） | Docker healthcheck + `docker stats` API + app `/api/v1/healthz` `/readyz` `/metrics`（**需 DEV 提供，见 3.5 需求清单**） | 同上 | 同上 | 0 |
| 应用（错误/链路） | `@sentry/nextjs` 服务端 + 客户端；pino ERROR 级采样同步到 Sentry | Sentry SaaS Free | Sentry 项目面板 | 0 |
| 应用（接口/访问） | Nginx json access log + pino request log | 本地 jsonl（14 天）+ COS 归档 90 天 | `python3 scripts/ops/app_metrics.py` 生成日报 + Kuma | ~1 元 |
| 业务 | `python3 scripts/ops/business_metrics.py`（每 5 分钟查 `events`/`assessments`，每 10 分钟发一次告警窗口判定，每日 08:30 发日报） | `events_daily` 汇总表 + IM 推送 | IM 日报 + `/admin/v1/dashboard` | 0 |
| 规则正确性 | `python3 scripts/ops/rulepack_guard.py`（**每日 04:00 全量 golden-case 复算 + 每小时抽样 50 条线上 assessment 复算 diff**） | `/data/logs/ops/rulepack_guard.log` + `rulepack_guard` 表 | IM 即时告警（**最高优先级**） | 0 |

**告警收敛规则（防风暴，必配）**：
1. 依赖抑制：MySQL/Redis/主机任一 P0 触发时，**自动静默其下游的应用层 P1/P2 告警** 30 分钟（用 Kuma「维护模式」+ 脚本 mute），只保留根因告警；
2. 同类聚合：同一 alertname + 同一 host 在 15 分钟窗口内合并为 1 条，间隔升级（15min 内同一告警第 3 次 → 自动升一级）；
3. 抖动抑制：除 P0 外，所有告警需满足「连续 N 个采集周期命中」才发（见各告警「持续时长」列），禁止单次即告警；
4. 静默窗口：计划内维护（升级/备份演练）提前在 Kuma 与脚本 mute 清单登记，超时自动解除；
5. **每月告警复盘**：误报率 >30% 的规则当月必须调优（§10.2 月度巡检）。

### 3.2 基础设施层告警（A 类，12 项）

| 编号 | 指标 | 采集方式 | 告警阈值 | 持续时长 | 级别 | 渠道 | 负责人 | 首动响应动作（必须可执行） |
|------|------|----------|----------|----------|------|------|--------|------------------------------|
| A-01 | 主机 CPU 使用率 | 云监控 Agent，60s | >80% | 10min | P2 | IM+邮件日报 | OPS-1 | 跑 `host_metrics.py --top-cpu` 定位进程；若 top1=chromium 且队列>16 → 执行 §5.5 降级；若 top1=node → 查 `/metrics` 的 qps 是否异常（可能爬虫，见 A-11） |
| A-02 | 主机 CPU 使用率（高危） | 同上 | >90% | 5min | P1 | 短信+IM | OPS-1 | 立即 `fast_triage.py`；判定为洪峰 → §5.10 限流 + 静态兜底；判定为异常任务 → 杀进程；30min 未降 → 升级 DEV-1 |
| A-03 | 内存可用量 | 云监控 Agent | <500MB | 10min | P1 | 短信+IM | OPS-1 | `fast_triage.py --mem`；若 app RSS>1600MB → 优雅重启 app（§5.5 步骤5）；若 MySQL OOM → 查 buffer_pool 与临时 SQL |
| A-04 | swap 使用量 | node_exporter 替代脚本 | >200MB | 30min | P2 | IM | OPS-1 | 说明已发生内存压力，24h 内排查并给出升配评估单（T-1） |
| A-05 | 数据盘使用率 `/data/mysql` | 云监控 + 脚本 | >75% / >85% | 实时（>75%）/ 5min（>85%） | P2 / **P1** | IM / 短信+IM | OPS-1 | >75%：归档 `events` 老分区；>85%：`SELECT table_schema,table_name,DATA_LENGTH` 找大表 → 归档/清理 → 72h 内提交扩容评估 |
| A-06 | 根分区使用率 `/` | 同上 | >80% / >90% / >95% | 30min / 5min / 实时 | P2 / P1 / **P0** | IM / 短信 / 电话+短信 | OPS-1 | >80%：`docker image prune -f --filter "until=240h"`；>90%：清 `/data/backup-local` 3 天前；>95%：**立即**执行 §5.4（磁盘写满应急），否则 MySQL 会挂 |
| A-07 | inode 使用率 | 脚本 60s | >85% | 10min | P2 | IM | OPS-1 | `find /data -xdev -type f | cut -d/ -f2-3 | sort | uniq -c | sort -rn | head`（多为日志小文件或 Chromium tmp profile）→ 清理 + 缩短保留期 |
| A-08 | **TLS 证书剩余天数** | Kuma 证书监控 + `cert_check.py` 每日双跑 | ≤21 天 / ≤7 天 / ≤3 天 / =0 | 当日 / 当日 / 当日 / **实时** | P2 / P1 / **P0** / **P0** | IM / 短信 / 电话+短信 / 电话 | OPS-1 | ≤21：查 certbot timer 是否 enabled（`systemctl status certbot.timer`）；≤7：手动 `certbot renew --force-renewal` 并验证；≤3：**连换 3 次失败则切换人工签发**,见 §5.9；=0：全站证书错误，**立即** §5.9 |
| A-09 | 容器非计划重启 | Docker events + 容器 `RestartCount` | RestartCount ≥2 次 | 10min 窗口 | P1 | 短信+IM | OPS-1 | `docker logs --tail 200 <svc>` 定位（OOMKilled 看 `docker inspect` ExitCode 137）→ 按 §5.6 处置；30min 未稳 → 回滚上一 IMAGE_TAG |
| A-10 | 容器健康检查失败 | Docker healthcheck | app 连续 3 次失败（90s） | 立即 | **P0** | 电话+短信 | OPS-1 | `docker compose ps` → 若 exited → `fast_triage.py` → 按 §5.6 恢复（重启/回滚）；<15min 未恢复 → 升级 DEV-1 并切维护页 |
| A-11 | MySQL 进程存活 | TCP 探活 + Kuma | 端口/容器 down | 连续 2 次（2min） | **P0** | 电话+短信 | OPS-1 | §5.1 数据库故障预案（先看主机资源，再看 error log，最后决定是否走备份恢复） |
| A-12 | MySQL 慢查询数 | 慢日志 >200ms 计数（每 5min） | >50 条/5min | 15min | P2 | IM+邮件 | DEV-1 | 导出 top10 慢 SQL → 加索引或改分页；结构变更走 §7.4 变更管理 |

### 3.3 应用层告警（P 类，16 项）

| 编号 | 指标 | 采集方式 | 告警阈值 | 持续时长 | 级别 | 渠道 | 负责人 | 首动响应动作 |
|------|------|----------|----------|----------|------|------|--------|------------------------------|
| P-01 | HTTP 5xx 错误率（全站） | Nginx json log 聚合，1min 窗口 | >1%（样本≥100 请求） | 5min | P1 | 短信+IM | OPS-1 | 看错误集中在哪个 route：若 `/api/v1/assessments/*` → 查 app 日志 `error_code` 与 MySQL；若 `/admin/*` → 查鉴权；>5% 立即升 P0 |
| P-02 | HTTP 5xx 错误率（高危） | 同上 | >5% | 2min | **P0** | 电话+短信 | OPS-1 | **先回滚**：`<上一 tag>` `docker compose up -d`（<5min 完成）；再查根因；同时切维护页对客告知 |
| P-03 | 算分接口 P95 延迟 `/api/v1/assessments/calculate` | Nginx `$upstream_response_time` + app pino 计时 | P95 >800ms（SLO 边界） | 10min | P1 | 短信+IM | DEV-1 | 分层定位：`/metrics` 看 `engine_evaluate_ms` 与 `db_write_ms`；若 DB 慢 → A-12；若 rulepack 未命中缓存 → 预热 Redis；>2s 立即通知 PM-1 |
| P-04 | 算分接口 P99 延迟 | 同上 | P99 >2000ms | 10min | P2 | IM | DEV-1 | 同 P-03 排查；夜间批处理窗口除外 |
| P-05 | **规则引擎 evaluate 耗时**（纯计算） | app 埋点计时，每请求记录 | P95 >25ms（含 16 项反事实模拟，基线 ≤25ms） | 10min | P2 | IM | DEV-1 | 说明规则包复杂度或实现退化；抓慢 case 进 golden 集；**不得因此关闭诊断**（属业务功能） |
| P-06 | PDF 导出队列长度 | Redis `LLEN queue:pdf` / `/metrics` | >16 / >32 | 5min / 5min | P2 / P1 | IM / 短信+IM | OPS-1 | >16：`fast_triage.py` 看是否在渲染；>32：**临时把 `PDF_CONCURRENCY` 提到 2 仅在 4C8G**，或执行 §5.5 降级并提示用户稍后重试 |
| P-07 | PDF 导出成功率 | `reports.status` 统计（15min 窗口，样本≥20） | <95% | 15min | P1 | 短信+IM | OPS-1 | 看 `error_code`：50002=超时（→5.5 查内存）；Chromium 相关 → 检查字体子集/内存；**<80% 立即降级**为浏览器打印并公告 |
| P-08 | PDF 导出失败率（严重） | 同上 | 成功率 <80% | 5min | **P0** | 电话+短信 | OPS-1 | 立即降级（§5.5 降级动作）+ 保留在线算分；30min 未恢复 → 回滚 |
| P-09 | PDF 导出任务耗时 P95 | 任务耗时埋点 | >15s | 15min | P2 | IM | DEV-1 | 查是否 SSR 打印路由慢（模板重 → 精简 DOM）；>30s 且队列增长 → 升 P1 |
| P-10 | Excel 导出成功率 | `reports.status` | <98%（样本≥20） | 15min | P1 | 短信+IM | DEV-1 | `docker logs app | grep xlsx`；多为内存或列宽异常；Excel 无重依赖，优先快速修复 |
| P-11 | 短链生成失败率 | `POST /snapshots` 非 2xx 率 | >2%（样本≥100） | 10min | P1 | 短信+IM | DEV-1 | 查加密密钥（`SNAPSHOT_MASTER_KEY` 是否轮换未同步）+ MySQL 写；见 §5.7 |
| P-12 | 短链解析失败率（排除正常过期） | `GET /snapshots/resolve` 40001/500xx（排除 40002 过期） | >5% | 10min | P1 | 短信+IM | DEV-1 | 多为密钥版本错位（新旧 `key_version` 未双写）→ 核对 §8.5 密钥轮换；见 §5.7 |
| P-13 | MySQL 连接池使用率 | Prisma pool 埋点 → `/metrics` | >80% | 10min | P1 | 短信+IM | DEV-1 | `SHOW PROCESSLIST` 找长事务；临时调低 Prisma `connection_limit`；>95% 立即升 P0（写接口会超时） |
| P-14 | MySQL 连接获取超时次数 | 同上 | >0 次 | 5min | **P0** | 电话+短信 | DEV-1+OPS-1 | 立即杀长事务 + 重启 app 释放连接；若频繁 → 触发 T-4（托管数据库）评估 |
| P-15 | Redis 连通性 | 探针 PING，30s | 连续 3 次失败 | 90s | P1 | 短信+IM | OPS-1 | 先确认降级是否生效（`REDIS_URL` 为空 → 进程内 Map）；**降级期间导出队列为内存队列，必须显式通知用户重试**；30min 未恢复 → §5.2 完整预案 |
| P-16 | Redis 淘汰/内存 | `INFO memory` | `used_memory`>200MB 或 `evicted_keys` 30min 内增长>0 | 10min | P2 | IM | OPS-1 | 说明缓存开始被淘汰（幂等/限流可能失效）→ 查是否有大 key 或异常写入；临时调 `maxmemory` 到 384MB |

### 3.4 业务层告警（B 类，9 项 —— 缺此项视为方案不合格）

> **为什么必须监控业务层**：本产品最坏的事故不是 500，而是"页面 200、CPU 正常、但分数系统性算错 5 分"或"PDF 静默失败但用户以为在排队"。这类故障资源层永远发现不了。

| 编号 | 指标 | 采集方式 | 告警阈值 | 持续时长 | 级别 | 渠道 | 负责人 | 首动响应动作 |
|------|------|----------|----------|----------|------|------|--------|------------------------------|
| B-01 | 日活 DAU（去重 guest_token_hash + events 计数） | `business_metrics.py` 每 10min + 日报 | 同时段环比昨日跌幅 >30%（节假日/周末用上周同日对比） | 2h | P1 | 短信+IM | PM-1+OPS-1 | 「静默故障」排查链：① Nginx 是否还有请求（无请求→DNS/入口问题）；② `landing_view` 事件是否入库（有请求无事件→埋点/前端崩）；③ 前端 JS 报错（Sentry）→ 按分支处置 |
| B-02 | DAU 归零 | 同上 | NTUC 连续 15min 无任何 `events` 写入 且 Nginx 请求数=0 | 15min | **P0** | 电话+短信 | OPS-1 | 立即 `fast_triage.py`；入口侧检查：DNS 解析/备案/证书/云主机状态；<15min 未恢复 → 切维护页 + 上报 PM-1 |
| B-03 | **自评完成率**（`score_result_view` ÷ `org_create`） | events 漏斗，每日 + 7 日均值 | <40% 且 较 7 日均值下降 >30%（相对） | 24h（日报）或 4h（突发） | P1 | 短信+IM | PM-1+DEV-1 | 按漏斗逐段对比（`org_create→precheck_submit→4×score_module_complete→score_result_view`）：某段断崖 → 该功能回归 + 前端兼容性；**重点排除规则包变更（见 B-06）** |
| B-04 | **导出次数**（`export_pdf`+`export_excel` 成功数） | events 计数 | 日环比跌幅 >50%（相对前 7 日同时段均值） | 4h | P1 | 短信+IM | OPS-1+DEV-1 | **优先怀疑 PDF 静默失败**（用户点导出无反应）→ 立即跑 `health_probe.py --full`（含真实导出一次）验证；失败则 §5.5 |
| B-05 | **资格预检不通过率**（`precheck_submit` 中 `pass=false` 占比） | events `failed_codes` 聚合 | >85% 或 较 30 日基线偏移 >±20 个百分点 | 24h | P1 | 短信+IM | RULE-1+DEV-1 | ① 若为表单元数据变更/浏览器兼容导致字段空 → `unknown` 暴增；② 若某单一 `failed_code` 占比异常突增（如 C5 从 30%→90%）→ **高度疑似规则包错误**，立即执行 §5.6 规则包判定流程 |
| B-06 | **平均保守总分分布**（`score_result_view.total_conservative` 日均值 + P10/P50/P90） | events + `assessments` 冗余列 | 日均值偏离 30 日基线 **±8 分**；或 P50 偏离 >±10 分 | 24h（日报）/ 4h（发布后哨兵，见 B-09） | P1（发布哨兵触发则 **P0**） | 短信+IM / 电话 | RULE-1+DEV-1 | **这是发现"分数系统性算错"的最快通道**：① 确认 24h 内是否有规则包发布/热修 → 有则 **立即回滚**（§5.6 步骤 3）；② 无发布却偏移 → 抽 20 个样本人工复算核对；③ 同时跑 `rulepack_guard.py --deep` |
| B-07 | 达效率（verdict=PASS 占比） | events `is_qualified` | 较 30 日基线偏移 >±15 个百分点 | 24h | P1 | 短信+IM | RULE-1 | 阈值/整体放水或收紧的最敏感指标；与 B-06 联合判定；若 PASS 比例异常高（用户本该不过却 PASS）→ **按最高危处理**，立即停服到 DISCLAIMER 页排查（§5.6） |
| B-08 | **前后端算分不一致率**（浏览器实时算分 vs 服务端权威算分逐项比对） | 前端每次结果页渲染上报 `consistent: bool`（仅上报 bool 与 item 差异数，**不上传明细数据**，避免敏感数据出境/入库） | 不一致率 >0.5%（样本≥200） | 1h | **P0** | 电话+短信 | DEV-1+RULE-1 | **零容忍红线**：同一份 `@hitech/rule-engine` 双端结果必须一致。出现即为规则包双端不同步/浮点数/环境差异 → 立即回滚最近规则包与 app 版本 → 全链路 diff 复算 → 复盘必做 |
| B-09 | **规则包发布后 30 分钟分布哨兵** | 发布脚本 hook → `rulepack_guard.py --watch 30m` | 发布后 30min 内新产生 assessment 的平均保守总分，与发布前 24h 基线相比偏差 >±2 分（样本数 ≥30 才判定） | 30min（若无样本则延至首个 30 样本） | **P0** | 电话+短信 | RULE-1+DEV-1+OPS-1 | 自动触发 `rulepack_rollback.py --to <上一版本>`；回滚后再次校验；**这是"规则包错误导致误导用户"的第一道自动闸**（§5.6） |

### 3.5 需研发侧提供的观测接口（本方案向 DEV 提出的需求清单）

| 接口/能力 | 用途 | 优先级 |
|-----------|------|--------|
| `GET /api/v1/healthz` | **Liveness**：进程存活即可返回 200，不查任何依赖；供 Docker healthcheck 与 Kuma 使用 | P0（上线前必须） |
| `GET /api/v1/readyz` | **Readiness**：查 MySQL PING + Redis PING（降级时不算失败）+ 磁盘可写；失败即摘流量 | P0 |
| `GET /api/v1/metrics`（仅内网，Basic 或 IP 白名单保护） | 暴露：`http_requests_total{route,status}`、`http_request_duration_ms` 分位数、`engine_evaluate_ms`、`db_query_ms`、`prisma_pool_in_use/max`、`pdf_queue_len`、`pdf_task_running`、`redis_degraded bool`、`rulepack_version`、`rulepack_sha256` | P0 |
| pino 请求中间件统一输出 `request_id` / `trace_id` / `guest_hash` / `policy_version` / `duration_ms` | 排障一查到底（参考文件 §8 trace_id 贯穿） | P0 |
| 前端「染色/inject」开关：URL `?__debug=1` 时打印 double-end 算分明细到 console 并上报一致性结果 | 支托 B-08 | P1 |
| `POST /api/v1/ops/feature-flags`（内网，密钥保护） | 运维降级开关：`pdf_service=off\|degraded`、`read_only=true`、`maintenance=true`、`export_queue_pause` | P0 |
| 规则包发布 hook（`onPublish`） | 触发 B-09 哨兵 + 自动回滚 | P0（最高危防线） |

### 3.6 Uptime Kuma 监视器清单（部署即导入）

| # | 监视器 | 类型 | 目标 | 间隔 | 判定 | 级别 |
|---|--------|------|------|------|------|------|
| 1 | 主站可用 | HTTP(s) 关键字 | `https://<domain>/` 期望 200 + 正文含「免责声明」关键句 | 60s | 连续 2 次失败 | P0 |
| 2 | 算分链路健康 | HTTP JSON 查询 | `/api/v1/readyz` → `$.status=="ok"` | 60s | 连续 2 次 | P0 |
| 3 | 内容页 SSR（SEO 命脉） | HTTP(s) 关键字 | `/policy/versions` → 含「国科发火〔2016〕32号」 | 5min | 连续 2 次 | P1 |
| 4 | 证书到期 | TLS 证书监控 | `<domain>` | 每日 | ≤21/7/3 天分级 | P2/P1/P0 |
| 5 | MySQL 端口（内网） | TCP | `mysql:3306` | 60s | 连续 2 次 | P0 |
| 6 | Redis 端口（内网） | TCP | `redis:6379` | 60s | 连续 3 次（可降级） | P1 |
| 7 | **合成链路拨测**（真实闭环） | HTTP 由脚本推送 | `python3 health_probe.py` 每 10min 跑「建档→预检→算分」全链路并把结果 push 到 Kuma push monitor | 10min | 连续 2 次失败 | P1 |
| 8 | **PDF 真实导出**（重路径） | Push | 每小时 08:00-22:00 跑一次完整 PDF 导出（用固定 fixture，产物 5min 后删除） | 60min | 单次失败 | P1 |
| 9 | 备份成功核验 | Push | 每日 05:00 校验「昨夜备份存在 + sha256 正确 + 异地副本存在」 | 每日 | 未收到 push | **P0**（备份是不可恢复的红线） |
| 10 | DNS/备案可用性 | HTTP(s) | 域名解析 + 主域名 301→HTTPS 正确 | 5min | 连续 2 次 | P1 |
| 11~13 | **外部拨测（不同故障域）** | UptimeRobot / 云厂商两地 | ① 主站 ② `/api/v1/healthz` ③ 证书 | 5min / 1min | 连续 2 次 | P1（与内部告警互为佐证；内部全静默时它仍会响） |

---

## 4. 日志与链路

### 4.1 日志三分类与职责

| 类别 | 内容 | 级别规范 | 保留 |
|------|------|----------|------|
| **访问日志** | Nginx json：来源 IP（**哈希化**）、UA（截断 64 字符）、method、path（**剔除 query 中的 token**）、status、bytes、duration_ms、upstream_time | — | 本地 30 天 + COS 归档 90 天 |
| **应用日志** | pino jsonl：`INFO`＝关键业务动作（建档/算分/导出/短链生成/规则包发布）；`WARN`＝可预期异常（资格预检不通过、幂等命中、限流触发、Redis 降级、PDF 超时重试）；`ERROR`＝需人处理（未捕获异常、DB 不可用、COS 不可用、PDF 渲染失败） | 见下 §4.2 | 本地 14 天 + COS 归档 90 天 |
| **审计日志** | `audit_logs` 表（DB）：后台登录/登出/TOTP 校验、规则包编辑与发布与回滚、敏感数据解密查看、CSV 导出、账号与 IP 白名单变更、短链撤销、tenant 数据删除 | 全量记录，**不可 DELETE**（应用层禁止写删除接口，到期由定时任务分区归档） | **DB ≥180 天**；归档 COS **2 年**（合规） |

### 4.2 pino 结构化日志字段规范（强制）

```jsonc
{
  "level": 30,                      // 10=trace 20=debug 30=info 40=warn 50=error 60=fatal
  "time": 1730000000000,            // epoch ms（UTC 存储，展示转 UTC+8）
  "service": "hitech-web",
  "env": "prod",
  "ver": "v1.4.2-g1a2b3c4",         // 镜像 tag + commit sha（回滚排查必需）
  "pid": 1,
  "hostname": "hitech-prod-01",
  "trace_id": "01J8ZK9X2N7M4W31T6P0",   // 一次请求唯一（ULID），贯穿 Nginx→Node→依赖
  "request_id": "01J8ZK9X2N7M4W31T6P0", // 与响应体 request_id 一致，用户可凭此投诉，客服可查
  "guest_hash": "a1b2c3d4e5f6",      // 游客令牌的 SHA-256 前 12 位（可逆推718? 否，仅用于串联同一用户日志）
  "admin_id": 3,                    // 后台操作专用；游客请求为 null
  "route": "POST /api/v1/assessments/calculate",
  "method": "POST", "path": "/api/v1/assessments/calculate", "status": 200,
  "duration_ms": 118,
  "policy_version": "2026.10-national-2016",
  "rulepack_sha256": "9c2f...e71a",
  "biz_context": {                  // 仅非敏感业务上下文
    "enterprise_public_id": "01J8...", "declare_year": 2026,
    "declare_type": "first", "biz_years": 3,
    "verdict": "FAIL", "total_conservative": 34, "total_optimistic": 49,
    "item_count": 25, "failed_precheck_codes": ["C4","C7"]
  },
  "error_code": null,               // 业务错误码（§5.2 规范 50001/50002...）
  "err": { "type": "PrismaClientKnownRequestError", "message": "...", "stack": "..." },
  "msg": "assessment.calculate.done"
}
```

**通用消息命名（便于 grep 与聚合）**：`<domain>.<action>.<result>`，例：`assessment.calculate.done`、`pdf.export.failed`、`policy.publish.succeeded`、`snapshot.create.ok`、`redis.degraded.active`。

### 4.3 敏感字段脱敏清单（**红线：以下任一字段出现在日志/埋点/Sentry/错误信息中，即视为合规事故**）

| # | 敏感字段 | 来源 | 脱敏规则 | 落日志形态 |
|---|----------|------|----------|------------|
| 1 | **企业名称** `enterprises.name` | 建档 | 生产环境**默认不打日志**；确需排障时用 `maskName()` → 「某**技有限公司」 | `masked_name` |
| 2 | **统一社会信用代码** `credit_code` | 建档 | **禁止进日志**（密文也不行） | 不出现；用 `public_id` 替代 |
| 3 | **财务金额**：净资产 `net_asset`、销售收入 `revenue`、研发费用 `rd_expense_*`、高新收入 `hitech_revenue` | 财务台账 | pino `redact` 屏蔽；排障只允许输出**数量级标记** `revenue_band:"10M-100M"` | 仅 `*_band` |
| 4 | **知识产权证书号** `ip_assets.cert_no` / 专利号 | 台账 | **禁止全文**；仅输出后 4 位用于人工定位 | `****1234` |
| 5 | 知识产权名称 / 权利人 / 发明人 | 台账 | 禁止进日志 | 不出现 |
| 6 | 短链 token / `X-Snapshot-Token` / `gst` Cookie / 下载 token | 会话 | **禁止**（the hash 只允许；后台定位用 `token_prefix` 8 位） | `token_hash`/`token_prefix` |
| 7 | 快照 payload（`local_only` 财务草稿 JSON） | `/snapshots` | 服务端只处理密文，**绝不打 payload 明文**，包括错误堆栈 | 不出现 |
| 8 | 后台 TOTP secret / 口令 / `password_hash` | `/admin/v1/auth/login` | 禁止；登录失败只记 `admin_login.failed username=***` | 不出现 |
| 9 | 用户 IP | Nginx/全部 | **哈希化**（HMAC-SHA256(key, ip) 前 16 位）；仅安保排查可从密钥反推 | `ip_hash` |
| 10 | User-Agent | Nginx | 截断 64 字符（去版本号防指纹追踪） | `ua_truncated` |
| 11 | 手机号/邮箱（V1.1 起） | V1.1 | 掩码 `138****8000` | 掩码 |
| 12 | 备注/自由文本（可能含敏感词） | 台账 remark | **默认不打**，仅在 volunteered debug 且负责人批准后临时开启 | — |

**pino 配置（禁止任何人改动 redact 列表而不走变更流程）**：

```js
// apps/web/src/server/logging/logger.ts（示例）
redact: {
  paths: [
    'req.headers.cookie', 'req.headers.authorization', 'req.headers["x-snapshot-token"]',
    '*.password', '*.totp', '*.cert_no', '*.credit_code', '*.creditCode',
    '*.net_asset', '*.netAsset', '*.revenue', '*.rd_expense', '*.rdExpense',
    '*.hitech_revenue', '*.amount', '*.token', '*.payload', '*.customer_name',
    'body.inputs.fiscal[*].*', 'body.inputs.ip_assets_snapshot[*].cert_no'
  ],
  censor: '[REDACTED]'
}
```

**CI 静态门禁**：`grep`-style 扫描禁止在 `logger.*` 调用中出现上述字段名的明文字面量（`scripts/ci/log_leak_scan.py`，fail 即 block PR）。

### 4.4 日志保留期与磁盘水位联动

| 日志 | 本地保留 | 单文件大小 | 本地上限 | 归档 | 触发清理 |
|------|----------|------------|----------|------|----------|
| app jsonl | **14 天**（要求：可在线检索） | rotate 200MB | 5GB | COS 归档 **90 天** | 本地 >5GB 或 >14 天自动删最老的 |
| nginx access json | 30 天 | rotate 100MB | 2GB | COS 90 天 | 同上 |
| nginx error | 30 天 | rotate 20MB | 0.5GB | COS 90 天 | 同上 |
| ops 脚本日志（备份/演练/巡检） | **180 天**（审计用途） | rotate 50MB | 1GB | COS **365 天** | — |
| MySQL slow log | 7 天 | rotate 50MB | 0.5GB | — | — |
| MySQL binlog | **3 天**（ROW，PITR 用） | 1GB 切 | 8GB | COS 增量同步 | — |
| audit_logs（DB 表） | **≥180 天在线** | — | — | COS 归档 **2 年** | 定时任务按月导出压缩归档后删老分区 |
| events（DB 表） | 主表 6 个月（按月分区） | — | — | COS 归档 12 个月 | 同上 |

**水位联动（防止日志写满磁盘引发新故障，参考文件 §8.5）**：当 `/data/logs` 使用率 >85%，脚本**自动**执行：删除超过 7 天的历史 rotate 文件 → 仍 >90% 则删除超过 3 天的 → 仍 >95% 则打开 `maintenance` 静态页并阻断写型接口（§5.4）。

### 4.5 Sentry 采样与告警规则

| 项 | 配置 | 理由 |
|----|------|------|
| `tracesSampleRate` | 常态 **0.1**；申报季（DAU >基线 3 倍）**0.05**；PDF 导出链路固定 **0.2**（慢任务更需观测） | Free 额度 10k spans/月 |
| `profilesSampleRate` | 0（Free 无 Profile） | 省额度 |
| 错误采样 | **全量捕获**，但 `beforeSend` 做：① 二次脱敏（与 §4.3 同清单）② **同 fingerprint 每分钟最多上报 10 条**（`allowUrls` 仅限本站域名，屏蔽第三方脚本误报）③ 剔除已知噪音（浏览器插件报错、爬虫 UA 的 ResizeObserver loop） | 防额度被单一异常打爆；5k errors/月足够 MVP |
| Release 关联 | 每次部署 `sentry-cli releases new <IMAGE_TAG>` + `set-commits` → **能直接定位到是哪次发版引入** | 回滚决策依据 |
| Environment | `prod` / `staging` 分开，告警只对 `prod` | 防止测试期噪声 |
| **告警规则 1** | **New Issue**（首次出现）→ IM 通知 DEV-1（P2，工作时段聚合 30min 一次，夜间不打扰） | 新错误类型是最有价值的信号 |
| **告警规则 2** | **Regression**（已解决重新出现）→ 短信 + IM（P1） | 说明回滚/修复未生效 |
| **告警规则 3** | 同一 Issue **15min 内事件数 >50** → P1 短信；**>100** → P0 电话 | 规模化故障 |
| **告警规则 4** | Issue 命中 `rulepack` / `assessments.calculate` / `RuleEngine` tag → **直接 P0 电话**（分数正确性优先于可用性） | 红线 R-1 |
| 每月检查 | Sentry 用量达 **80% 额度** → IM 提醒：**先降采样**，不得盲目升级到 Team 版（§9.4） | 成本护栏 |

### 4.6 trace_id 贯穿与排障路径

1. Nginx 生成 `X-Request-ID`（若无则由 app 生成）→ 透传给 Node → pino 写入每条日志 → 返回给前端 `request_id`；
2. **用户可见**：错误提示统一附 `request_id`（如"服务暂时不可用，错误码 50001，工单号 01J8ZK9X..."），客服凭此在日志中一查到底；
3. 关联搜索命令：`python3 scripts/ops/trace.py <request_id>` → 聚合 app/nginx/ops 三处日志按时间排序输出（无需跨机器对时间猜）。

---

## 5. 应急预案（逐条可执行）

> 通用处置纪律：**先止血后查因**；**15 分钟内给出初步判断**；**可确认是变更引起的直接回滚**（不在故障高峰期查根因）；**所有 P0 故障 48 小时内出复盘报告**（不追责、追流程）。
> 通用首查清单：`python3 scripts/ops/fast_triage.py` → 输出「最近变更 / 依赖健康 / 资源水位」三连答案。

### 5.1 数据库故障 / 数据损坏
| 项 | 内容 |
|----|------|
| **现象** | 页面 500、`/api/v1/*` 报错 `50004`、写接口全部失败、后台列表打不开；或查询结果明显异常（分数与历史记录对不上） |
| **判定标准** | MySQL 容器 exited / A-11 告警触发；或 `mysqladmin ping` 失败；或 P-14 连接池超时告警；或 `CHECK TABLE` 报告损坏；或备份恢复校验发现校验和不符 |
| **处置步骤** | 1) **先保护现场**：`docker compose stop app`（停写，防止二次损坏），只读页仍由 Nginx 缓存/静态页兜底；2) 查资源：`df -h /data/mysql`（磁盘满 → 转 §5.4）、`free -m`（OOM）、`docker logs mysql --tail 300` 看 InnoDB crash recovery；3) 尝试原地恢复：`docker compose restart mysql`，观察 error log 是否进入 recovery；4) recovery 失败或数据损坏 → **从备份恢复**（§6 流程）：把最近全备 + binlog 恢复到隔离实例 → 校验行数和抽样 checksum → 切 app 指向新实例 → 恢复服务；5) 若仅单表/单行损坏（如误删），优先用 binlog **闪回**或 PITR 到误操作前一刻，避免整库恢复 |
| **回滚/降级** | 无 DB 时的降级：`read_only=true`（前端只读快照/localStorage 草稿可用，服务端写型接口返回 42904 并提示"系统维护中，数据未丢失"）；同时挂 maintenance 兜底页 |
| **恢复验证** | ① `/api/v1/readyz` 返回 ok；② 合成拨测跑通「建档→预检→算分」（`health_probe.py --full`）；③ 抽查 20 个历史 assessment 的 `result_json` 能正确解析且 `rulepack_sha256` 与 `policy_versions` 一致；④ 确认 B-01/B-03 业务指标回到基线 |
| **复盘要求** | 48h 内出报告：含时间线、根因（区分：硬件/云盘故障 vs. 人为 DDL vs. 磁盘满引发的连锁 vs. 慢查询拖垮）、影响面（受影响自评次数、是否有 persist 数据丢失窗口＝实际 RPO）、改进项（含 PITR 演练补充、binlog 同步频率是否下调） |
| **指标目标** | **RTO ≤60min**（整库恢复）；**RPO ≤15min**（常态）/≤5min（申报季） |

### 5.2 Redis 不可用（必须可降级，不得成为可用性单点）
| 项 | 内容 |
|----|------|
| **现象** | Redis 容器 down / PING 失败；应用响应变慢；导出任务堆积或丢失；限流失效（刷量打穿）；可能出现幂等键失效导致重复写入 |
| **判定标准** | P-15 告警（连续 3 次 PING 失败 90s）；`docker compose ps redis` 非 Up；app 日志出现 `redis.degraded.active` |
| **处置步骤** | 1) 确认**自动降级是否生效**：app 应在 `REDIS_URL` 不可用时自动切进程内 Map，日志记录 `redis.degraded.active`；2) 尝试恢复：`docker compose restart redis`（无持久化 → 冷启动为空，可接受）；3) 10min 未恢复 → **显式降级通告**：运维在 IM 与（如必要）站点顶部提示"导出功能可能延迟"，因为 **降级后 PDF 队列为进程内存队列，app 重启会丢任务**；4) 暂停导出入口（feature-flag `export_queue_pause=true`）避免用户等待后失败；5) 检查是否有刷量：降级期间 Nginx 层限流（§8.3）是唯一防线，核对 A-11 与 Nginx 429 计数 |
| **回滚/降级** | 降级期间：rulepack 缓存走进程内（每进程编译一次，CPU 略升）、幂等退化为 DB 唯一键兜底（需 DEV 提前实现 `Idempotency-Key` 的唯一约束兜底，否则接受极小概率重复写）、导出队列暂停 |
| **恢复验证** | Redis 恢复后：① `INFO keyspace` 空且无报错；② `/api/v1/metrics` 中 `redis_degraded=false`；③ 重新开放导出，连续 5 个 PDF 任务成功（含 `rulepack_sha256` 一致性）；④ 观察 CPU 是否回落到降级前水平 |
| **复盘要求** | 记录降级期间丢失的导出任务数与用户投诉数；决策记录：**多实例改造（T-3）前，Redis 不得从"可降级"升级为"强依赖"**（写入架构债清单，§11） |
| **指标目标** | **业务 0 中断**（读链路不停）；导出功能降级时长 ≤30min 可接受 |

### 5.3 MySQL 数据误删 / 误更新（与 5.1 区分：是操作类事故，用 PITR）
| 项 | 内容 |
|----|------|
| **现象** | 某次批量操作（如Ⅱ类资产批量置 `used_in_assessment=1`、后台清理任务）误伤数据；用户反馈"我的方案没了/分数变了" |
| **判定标准** | `audit_logs` 出现非预期批量 action；或用户投诉 ≥3 起同一时间段；或 `events`/`assessments` 行数突降 |
| **处置步骤** | 1) **立即冻结写入**：`feature_flag set read_only true`；2) 定位操作时间点 T（从 audit_logs + binlog 位置）；3) 从全备恢复到隔离实例，回放 binlog 到 T-1 秒；4) **只导出受影响表/行**回灌生产（如 `UPDATE ... JOIN` 修正），而非整库覆盖；5) 回灌前对目标行做 **dry-run SELECT** 并由 PM-1 复核行数 |
| **回滚/降级** | 回灌失败则接受"丢失该批操作"：撤销该批量 action 的语义效果（如把 `used_in_assessment` 回滚为 0）并公告受影响用户 |
| **恢复验证** | 受影响用户抽样 5 人复算结果与历史 `result_json` 一致；`rulepack_sha256` 未变；行数核对差异表 output 为 0 |
| **复盘要求** | 必须产生一条改进项：**后台批量操作强制"dry-run 预览 + 二次确认 + 影响行数上限（如 >1000 行需 PM-1 审批）"**（写入 §7.4 变更管理） |
| **指标目标** | **RPO ≤15min → 实际可做到秒级**（binlog PITR） |

### 5.4 磁盘写满（最高频，也最容易演化为数据库损坏）
| 项 | 内容 |
|----|------|
| **现象** | 写接口失败、MySQL 崩溃或进入 read-only、容器无法启动、日志报 "No space left on device"、inode 告罄 |
| **判定标准** | A-05/A-06/A-07 任一告警；`df -h` 任一分区 >95%；`df -i` inode >95% |
| **处置步骤** | 1) `python3 scripts/ops/disk_guard.py --auto`（自动按优先级清理：① nginx/app 已 rotate 的旧日志 ② `docker image prune -f --filter "until=240h"` ③ `/data/app-tmp/*` Chromium 残留 ④ `/data/backup-local` 3 天前）；2) 若 MySQL 已挂：清理出 ≥2GB 空间后 `docker compose restart mysql`，观察 InnoDB recovery；3) 若 app-tmp 反复爆：`feature_flag set pdf_service off`（先停 PDF 保主链路）；4) 清理后仍未降到 <85%：`lsof -nP | grep deleted` 找被删未释放的句柄 → 重启对应进程；仍不行 → **在线扩容云盘**（§1.4 余量 4GB 是应急缓冲）；5) 全程保持 Nginx maintenance 页可切换 |
| **回滚/降级** | PDF 导出关闭（泄压最大来源）→ 仍不足则 `read_only=true` → 最后切 maintenance 静态页（只读公告） |
| **恢复验证** | 磁盘 <80%；MySQL 起来且能通过 readyz；合成拨测全链路通过；备份任务跑成功一次后再恢复 PDF |
| **复盘要求** | 必须回答"为什么水位告警没提前起作用"（大概率是告警阈值或脚本 mute 失效）；补齐：短期（延长/收紧轮转）、中期（扩容评估单） |
| **指标目标** | **从告警到清理完成 ≤15min**；目标：绝不让磁盘 >100% 发生 |

### 5.5 PDF 导出队列积压 / Chromium OOM（本项目最脆弱链路）
| 项 | 内容 |
|----|------|
| **现象** | 用户点导出一直转圈/超时；`GET /reports/{id}` 长期 `queued`；PDF 成功率下降；app 容器 RSS 飙升甚至 OOMKilled（ExitCode 137） |
| **判定标准** | P-06（队列 >16/>32）、P-07（成功率 <95%）、P-08（<80%）、A-03（内存 <500MB）、A-09（容器重启 ≥2 次）任一触发 |
| **处置步骤** | 1) `fast_triage.py` 看 `pdf_task_running` 与内存 top1 是否 chromium；2) **立即泄压**：暂停新导出入队（`export_queue_pause=true`），已排队任务给用户明确"预计等待 X 分钟"或直接失败快返并提示稍后重试；3) 杀掉卡死渲染：`docker compose exec app pkill -f chrome_crashpad\|headless_shell`（不要杀 app 本体）；4) 清理 `/data/app-tmp/*` 与 `--disable-dev-shm-usage` 确认生效；5) **内存泄漏防护**：若同一进程已渲染 >200 份或 RSS >1600MB → 优雅重启（`docker compose restart app`，drain 队列先落 DB 状态）；6) 若持续积压且已升配至 4C8G → 临时 `PDF_CONCURRENCY=2`；7) 若仍无法在 45s 内完成单份 → **降级到浏览器 `window.print()`**（技术预留的降级通道），前端引导用户用浏览器打印为 PDF |
| **回滚/降级** | 三级降级：① 排队可等待 → ② `pdf_service=degraded`（仅允许 ≤4 页精简版报告）→ ③ `pdf_service=off`（前端切 `window.print()` + 提示"服务端导出维护中"） |
| **恢复验证** | 连续 10 次导出全部 `ready` 且 P95 耗时 <15s；队列长度回落至 0；内存 RSS 回落 <1200MB；B-04 导出次数回到基线 |
| **复盘要求** | 记录积压根因（申报季洪峰 vs. 模板变重 vs. 泄漏）；若因洪峰 → 触发 §2.6 的 T-1/T-2 扩容；若因模板 → DEV 精简 DOM 并加 golden PDF 大小基线（>3MB 告警） |
| **指标目标** | 队列等待 P95 ≤30s；单任务 ≤45s；**2C4G 硬约束 `PDF_CONCURRENCY=1`（并发 2 必须 4C8G）** |

### 5.6 ⚠ 规则包错误导致分数系统性算错（**最高危：会误导用户申报决策**）
| 项 | 内容 |
|----|------|
| **现象** | 用户普遍反馈"分数不对/和上周不一样/和官方口径不一致"；B-06 平均总分偏移 >±8 分；B-07 达效率异常；B-08 前后端不一致；B-05 某项预检失败率异常突增；或内容/顾问团队发现政策引用错误 |
| **判定标准（任一即成立，立即停损）** | ① 规则包发布后 30min 哨兵（B-09）触发：新样本平均分偏离基线 >±2 分；② 离线 golden-case 全量复算（`rulepack_guard.py --deep`）出现 **diff ≠ 0**；③ 发现阈值方向错误导致本应 FAIL 判为 PASS（或反之），即已系统性影响 `verdict`；④ 政策文号/条款引用错误（合规风险）；⑤ B-08 不一致率 >0.5% |
| **处置步骤（先停损，后定位）** | 1) **立即回滚规则包**：`python3 scripts/ops/rulepack_rollback.py --to <上一版本> --reason "<原因>"`（30 秒内生效，rulepack 走 Redis/内存缓存，需同步清缓存 key `rp:*`）；2) **同时冻结新发布**：后台 `/publish` 入口 `feature_flag set policy_publish_lock true`，防止二次误发；3) **停损范围判定**：用 `assessments.policy_version` 与 `rulepack_sha256` 精确定位受影响区间（哪段时间、多少次自评、涉及多少不同 guest_token_hash）；4) **对客行动**：① 结果页/站点横幅对该规则的更正公告 + 受影响用户主动触达（若有联系方式则邮件/站内，无则公告）② 提供"一键重新计算"入口 5) 人工交叉验证：用 Python 离线独立实现（技术 §9.4 的 `tools/rule-audit`）对同一批 golden case 复算，**两个独立实现交叉验证**（这是规则类产品的最后防线）；6) 修复后必须重过完整门禁（16 组财务 + B1~B16 + 双端一致性 + 影子复算 diff 报告）才允许重新发布 |
| **回滚/降级** | 规则包回滚即为回滚；若规则包本身是首次发布（无上一版本）→ **直接将该页面的算分功能降级为"仅展示政策原文 + 提示稍后恢复"，不得输出任何分数 |
| **恢复验证** | ① 回滚后 `rulepack_guard.py --deep` diff=0；② 抽 50 条历史 assessment 用回滚版本重算，与原结果 `policy_version` 一致；③ B-06/B-07 在 2h 内回到 30 日基线 ±3 分内；④ 公告已发布且 audit_logs 有记录 |
| **复盘要求（加严）** | **24h 内**出专项复盘（非 48h）：① 为什么 CI 门禁没拦住（缺哪个 golden case → 立即补进 case 库并作为永久回归）② 为什么影子复算 diff 报告被放行（谁签发）③ 政策顾问复核环节是否缺失 → 补齐「规则变更必经 RULE-1 + 外部顾问双签」 |
| **指标目标** | **检测时延 ≤30min**（靠 B-09 哨兵 + 每日 deep）；**回滚时延 ≤5min**；**对外误导窗口最小化** |

### 5.7 短链服务异常
| 项 | 内容 |
|----|------|
| **现象** | 生成短链失败/返回 500；老短链打不开（排除已过期 30 天）；快照解密失败或内容错乱 |
| **判定标准** | P-11（生成失败率 >2%）或 P-12（解析失败率 >5%，排除 40002 过期）；用户投诉 ≥2 起 |
| **处置步骤** | 1) 判定类型：生成失败（多为 MySQL 写或加密）vs. 解析失败（多为密钥/密文损坏）；2) **解析失败优先查密钥**：是否刚做过 `SNAPSHOT_MASTER_KEY` 轮换但未保留旧版 → 密钥必须支持多版本共存（`key_version`），轮换期新旧密钥都能解密；3) 若密钥文件损坏 → 从离线密码库取回密钥，重启 app 后验证；4) 若 MySQL 中 `snapshots.payload` 损坏 → **不可恢复**（因为密钥由 token 派生，token 不落库，设计上无法离线解密）→ 该批短链判定作废，主动告知受影响用户并引导重新生成（这是 C-4 的安全代价，需在 UI 明示"请自行保存短链"）；5) 若大量生成失败 → 查 MySQL 写是否受磁盘/连接限制（转 §5.1/§5.4） |
| **回滚/降级** | 生成能力关闭时，前端降级提示"改用本地保存/浏览器书签"；快照功能依赖 token + 服务端加密，无完全旁路方案 → 降级为"提示用户导出 PDF 自行保管" |
| **恢复验证** | 生成一条新短链 → 用无痕窗口 + 异设备 hash-token 访问成功且分数与生成时一致（false positive 校验）；连续 5 次成功 |
| **复盘要求** | 若因密钥轮换导致 → 修订密钥轮换 Runbook（强制双版本共存 ≥90 天 + 轮换后校验脚本）；若因容量 → 查 TTL 清理任务是否正常（§5.11） |
| **指标目标** | 生成/解析成功率 ≥99%（P-11/P-12 阈值之上） |

### 5.8 COS 对象存储不可用
| 项 | 内容 |
|----|------|
| **现象** | 导出完成后下载 404/超时；`GET /reports/{id}/download` 302 失败；app 日志大量 `50003`；新导出全部 `failed` |
| **判定标准** | 15min 内 COS 相关失败率 >5%（建议在 P 类补一条 `P-17`：**COS 上传失败率 >5% 持续 10min → P1，负责人 OPS-1+DEV-1**）；或云厂商状态页公告故障 |
| **处置步骤** | 1) 确认是"全网"还是"本账号/本桶"：`coscli ls` + 云控制台；若是 AK/SK 失效或被禁（常见于密钥轮换/安全策略误伤）→ 走密钥恢复；2) **降级到本机兜底**：`feature_flag set storage_fallback local` → 产物改写到 `/data/app-tmp/reports/` 并由 Nginx 直下（限 ≤24h 有效期 + Size cap 2GB），明示用户"请及时下载"；3) 已排队的历史导出：`status=generating` 但 COS 写失败的，允许本地重跑一次；4) 若是云厂商故障 → 挂公告 + 停新导出（避免堆积），等厂商恢复后批量补跑（用 `reports` 表 `queued/failed` 记录回放） |
| **回滚/降级** | 本地磁盘兜底直下 → 仍不可则暂停导出入口，保留算分与查看（已生成的旧报告若 COS 丢失则**不备份，需重算**，UI 应明示 30 天有效期） |
| **恢复验证** | 端到端导出一次并成功下载（含签名 URL 300s 有效期校验）；`GET /reports/{id}` 状态机闭环，无遗漏步骤 |
| **复盘要求** | 补:`storage_fallback` 模式下的磁盘水位告警（`/data/app-tmp` >60% → P2）；评估是否给 COS 加 CDN + 重试退避（已有则核对是否生效） |
| **指标目标** | 下载可用性 ≥99.5%；**导出产物明确不备份，重算可重建** |

### 5.9 TLS 证书过期 / HTTPS 不可用
| 项 | 内容 |
|----|------|
| **现象** | 浏览器告警"证书已过期/不受信任"；A-08 告警；全站访问被拦截（用户侧等于全站宕机） |
| **判定标准** | A-08 任一分级触发；`openssl s_client -connect <domain>:443 2>/dev/null \| openssl x509 -noout -dates` 显示剩余 ≤3 天或已过期 |
| **处置步骤** | 1) 查 certbot timer：`systemctl status certbot.timer` 与 `/data/logs/ops/certbot.log`（最常见：webroot 校验路径被 Nginx 规则拦截，或 80 端口被安全组封）；2) 临时放通 `/.well-known/acme-challenge/` 并 `nginx -t && nginx -s reload`；3) `certbot renew --force-renewal --webroot -w /var/www/certbot` → `nginx -s reload`；4) 连续 3 次失败 → **切换应急**：用 DNS-01 手动签发（需 API 密钥，提前在密码库备好）或临时部署一张云厂商免费 DV 证书（1 年期，¥0）；5) 恢复后必须核对 `nginx -T \| grep ssl_certificate` 指向新证书且 A-08 归零 |
| **回滚/降级** | 证书无法即时修复时：**不得**降级到 HTTP（合规禁止明文传输财务数据）；只能挂 maintenance 页并用 IM/公告告知预计恢复时间 |
| **恢复验证** | ① `openssl x509 -noout -dates` 剩余 ≥60 天；② SSL Labs / `ssllabs` 内部脚本评分 ≥A；③ 外部拨测 Kuma #4 与 #11 恢复绿；④ 多浏览器（Chrome/Edge/Firefox）无告警 |
| **复盘要求** | 必须回答"为什么 ≤21 天的 P2 告警没被处理"（大概率是告警渠道失效或无人认领）→ 补一条硬约束：**证书有效期相关的 P2 告警若在 7 天内未被认领，自动升级为 P1 短信** |
| **指标目标** | 剩余天数永不低于 21 天（certbot 应在 30 天自动续） |

### 5.10 DDoS / 爬虫暴刷（季节性洪峰，叠加政策新规发布期的流量尖峰）
| 项 | 内容 |
|----|------|
| **现象** | 带宽打满（>4.5Mbps）、源站 QPS 突增、大量 429、Nginx 连接数满、`iftop` 显示某几个 IP 段高频请求算分/导出接口；或 SEO 内容页被抓取导致 ISR 回源打爆 |
| **判定标准** | A-02（CPU>90% 5min）或 带宽 >90% 持续 10min 或 **单 IP 请求 >300 次/分钟** 或 **Nginx 429 占比 >20%** 或 源站 QPS >8 req/s 持续 5min（说明缓存失效回源）|
| **处置步骤（分级）** | **L1（Nginx 层自动）**：`limit_req` + `limit_conn` 已在运行中，刷量被 429 挡住；**L2（脚本封禁）**：`python3 scripts/ops/anti_abuse.py --auto-ban`（自动把 5 分钟内请求 >500 次或非正常 UA 的 IP 加入 iptables/安全组黑名单，封 24h，并记录到 `/data/logs/ops/ban.log` 每日复核防误封）；**L3（静态化 + CDN）**：开启 CDN 全站静态 + robots.txt  crawl-delay（大陆云可用厂商基础 CC 防护，¥0 档）；**L4（限核心）**：把导出接口限到 1 次/3s/人，算分接口加 `42901` 友好提示；**L5（极端）**：切 maintenance 页 + 只放行白名单 IP（申报季极端情况下保护已有用户的查看能力） |
| **回滚/降级** | 优先降级**非写型链路**：先关 ISR 回源（延长 ISR revalidate 到 1h）、再关导出、算分保留（核心业务）| 
| **恢复验证** | 带宽回落到 <70%；CPU <70%；429 占比 <5%；真实用户合成拨测（来自白名单 IP）成功；B-01 DAU 未持续下滑（确认没误伤真人） |
| **复盘要求** | 区分"恶意攻击"vs."正常申报季洪峰"vs."自己投放带来的流量"：若是后者 → 追究未提前 7 天报备的责任（§2.2容量接口）；补齐 Nginx 层 CC 规则与 robots.txt 策略 |
| **指标目标** | 攻击期间**核心算分链路不中断**（允许导出降级）；误封率 <0.1%（每日复核 ban 清单） |

### 5.11 快照/报告 TTL 清理任务异常
| 项 | 内容 |
|----|------|
| **现象** | 过期短链仍可访问（合规风险）或未到期被误删（用户体验）；`snapshots.payload` 未按 30 天置空；磁盘增长异常 |
| **判定标准** | 每日 03:00 定时任务连续 2 天未成功；或 `snapshots` 表中 `expire_at < NOW()` 且 `status!='expired'` 的行 >1000；或 `events` 分区归档失败 |
| **处置步骤** | 1) `python3 scripts/ops/ttl_cleanup.py --dry-run` 查看应清理行数；2) 确认后 `--execute`（先物理置空 payload，再置 status）；3) 检查定时任务：`crontab -l` 与 systemd timer；4) 核对 mysql event scheduler 是否被关（若实现在 DB 层）|
| **回滚/降级** | 误删不可逆 → 若误删了未到期数据，从备份 + binlog 恢复该批行（§5.3）|
| **恢复验证** | dry-run 显示待处理=0；`snapshots` 过期行数为 0；磁盘增长回到预测值（§2.5）|
| **复盘要求** | 定时任务必须纳入监控（本条即补充告警 **B-10：每日 TTL 清理任务未成功 → P1（每日 03:30 检查，负责人 OPS-1）**，因为合规性要求"留存最小化" |
| **指标目标** | 每日清理成功率 100% |

### 5.12 疑似敏感数据泄露事件（合规最高级别）
| 项 | 内容 |
|----|------|
| **现象** | ① 日志/错误信息/Sentry 中出现企业名、信用代码、证书号、财务金额（§4.3 任一字段）；② 疑似库被拖（异常大量导出/后台查询）；③ 快照链接被猜测/批量访问成功；④ 第三方通知/用户投诉称在某处看到自己的测算数据 |
| **判定标准** | 日志脱敏扫描（`scripts/ops/log_leak_scan.py`，每日 05:00 全量扫当日日志）**命中 ≥1 条**；或 `admin_users.last_login_ip` 出现白名单外 IP（P0）；或 `/admin/v1/assessments/export.csv` 单日内被同一账号执行 >5 次（P1）；或单 IP 短链解析成功率异常高（疑似枚举）|
| **处置步骤（72 小时合规时钟）** | 1) **立即止损**：① 若为日志泄露 → `logrotate` 强制轮转并**隔离当日日志**（移到 `0600` 权限的隔离区），必要时从 Sentry 删除事件（`sentry-cli` 批量 purge）；② 若为账号异常 → 立即禁用该 admin 账号 + 吊销会话 + 重置 TOTP 种子；③ 若为缺陷 → `feature_flag set read_only true` 并下掉对应功能；2) **取证与定界**：`trace.py` 与 `audit_logs` 还原时间线；确认涉及的数据类别、条数、涉及用户数（用 `guest_token_hash` 去重）；3) **评估是否需向监管报告**：按《个人信息保护法》第 57 条，发生或可能发生个人信息泄露、篡改、丢失的，**应立即采取补救措施并通知履行个人信息保护职责的部门和个人**（涉及 V1.1 手机号后必报）；涉及重要数据/等保二级以上另有报告义务；由 PM-1 在 **1 小时内召集**（含团长）决定对外口径；4) **通知受影响个人**：若涉及可识别个人信息，按法规及时告知（本产品 V1.0 无手机号，**识别难度大**，但短链 token 持有者可视为可识别 → 需在站点显著公告）；5) 修复+消除：清缓存/清日志/轮换所有相关密钥（`SNAPSHOT_MASTER_KEY`、加密主密钥 `key_version` 晋级、admin TOTP、COS AK/SK）|
| **回滚/降级** | 涉及功能直接下掉，不在隐患未除时恢复；必要时整站 maintenance |
| **恢复验证** | ① 重新扫描当日全量日志 + Sentry，敏感字段命中 = 0；② 密钥轮换后老数据仍可正常解密（多版本共存校验）；③ 白名单外的 admin 登录尝试全部被拒且入 `audit_logs`；④ 法规要求的时间窗内完成通知/报告动作并有留痕 |
| **复盘要求** | **24h 内**专项复盘 + 合规整改项清单；必须回答"为什么 pino redact / CSP / 脱敏 CI 门禁三层防线都没拦住"；若属重复发生，按重大合规事件上报团长（§11） |
| **指标目标** | 日志敏感字段**零命中**（日常扫描保障）；事件响应：**1h 内止损** |

### 5.13 免责声明 / 政策内容错误引发的合规投诉
| 项 | 内容 |
|----|------|
| **现象** | 用户/机构投诉"误导宣称包过""与官方口径不一致""引用政策错误"；或自查发现免责声明未在首屏/结果页/报告页三处展示；或出现涉及"中国/国家/官方"字样的表述（选型报告 §4.4 命名红线）|
| **判定标准** | 收到任一投诉；或每日内容巡检脚本（`content_guard.py`）发现：三处免责声明缺失/政策版本号未显示/存在禁用词 |
| **处置步骤** | 1) **立即**：若为页面缺失 → 通过后台内容模块紧急补发（属 §7.4 的**内容紧急变更**，走绿色通道：RULE-1 起草 + PM-1 复核，无需 CI 全量门禁）；2) 若为规则/政策引用错误 → **同 §5.6 最高危处理**（内容正确性等同分数正确性）；3) 对外：统一由 PM-1 出具书面回复口径，**禁止任何人私自回复用户承诺性表述**；4) 全站自查：历史产生的 PDF 报告若含错误表述且仍在 30 天有效期内 → 主动提示用户重新导出；5) 若误导已发生且有用户据此决策 → 上报团长并评估是否需要法律/公关介入 |
| **回滚/降级** | 内容回滚到上一版本（内容表有版本，支持回滚）；极端情况整站 maintenance 直到内容修正 |
| **恢复验证** | `content_guard.py` 全站扫描 0 命中；三处免责声明可见；政策版本号与 `policy_versions` 一致；回复口径已归档 |
| **复盘要求** | 补齐"内容变更的 CI 检查"（禁用词扫描进 CI）与"发布必读免责声明 checklist"；重复发生则纳入 RULE-1 的流程改进项 |
| **指标目标** | 内容合规**零投诉**为红线目标；发现到修正 ≤4h |

### 5.14 应用进程崩溃 / 容器反复重启
| 项 | 内容 |
|----|------|
| **现象** | A-09 RestartCount ≥2 / A-10 健康检查失败；Sentry 大量同一异常；部分或全部路由 502 |
| **判定标准** | 连续 2 次健康检查失败（60s）；或 Sentry Rule-4 告警 |
| **处置步骤** | 1) `docker inspect <cid> --format '{{.State.ExitCode}}'`：**137=OOM**（→§5.5 内存）、**1=未捕获异常**（→看 Sentry release 定位是否新版本引入）、**0=主动退出**（→查流量/feature flag）；2) **已确认是新版本引入 → 立即回滚到上一 IMAGE_TAG**（<5min），这是首选动作，不要先查根因；3) 回滚后仍崩 → 检查依赖（MySQL/Redis/COS）与环境变量（`.env` 是否被误改）；4) 内存型（137）按 §5.5 第 5 步优雅重启 + 降并发；5) 若单机无法恢复 → 走整机重建（≤4h，依赖 §6 备份与镜像）|
| **回滚/降级** | 镜像回滚为首选；次选 `read_only=true`；最后 maintenance 页 |
| **恢复验证** | `/healthz` 连续 5min 绿；Kuma #1/#2/#7 全绿；业务指标 B-01 恢复；错误率 P-01 <1% |
| **复盘要求** | 48h 内复盘；重点：为什么 CI/staging 没发现（缺压测？缺边界用例？）→ 补进回归库 |
| **指标目标** | **P0 响应 ≤15min，恢复 ≤30min**（错误预算允许月度 3.6h，单次不得超过 1h） |

### 5.15 整机宕机 / 可用区故障（兜底预案）
| 项 | 内容 |
|----|------|
| **现象** | 云控制台显示主机 stopped/故障；SSH + Kuma + 业务全部不可达；**只有外部拨测还在告警**（印证 §1.5 与 §11 C-1 的必要性）|
| **判定标准** | 外部拨测（UptimeRobot + 云厂商两地）连续 3 次失败（3~15min）；云控制台主机状态异常 |
| **处置步骤** | 1) 控制台尝试重启/强制重启；2) 15min 未恢复 → **启动 rebuild**：新开同规格主机（同 AZ 或另一 AZ）→ 挂载最新云盘快照或从 COS 备份恢复 MySQL → `docker compose pull && up -d`（IMAGE_TAG 取最后的稳定 tag）→ 切域名解析（TTL 提前设为 300s）；3) 期间用 maintenance 静态页（可托管在免费静态服务上，保留备案信息）对外告知；4) 数据核对：用最新 binlog 补齐到故障前，核对 RPO 实际值并记录；5) 无额外步骤 |
| **回滚/降级** | 无法回滚（基础设施故障），只能重建；IP 白名单（后台/admin）需同步更新为新 IP，否则管理员被锁在门外 → **这是必须提前准备的变更清单** |
| **恢复验证** | 全 Kuma 监视器绿；`health_probe.py --full` 通过；数据行数与故障前核对差异在 RPO 窗口内；业务指标恢复基线 |
| **复盘要求** | 48h 复盘 + 重建过程写入 Runbook R-13（含 IP 白名单变更、DNS TTL 调整等易遗忘项）；每年至少 1 次**整机重建演练**（§6.6）|
| **指标目标** | **整机重建 RTO ≤4h**（技术基线 §2.4 已承诺）|


---

## 6. 备份与恢复（没有验证过可恢复的备份等于没有备份）

### 6.1 备份对象与策略总表

| # | 对象 | 怎么丢 | 备份方式 | 频率 | 保留期 | 存放 | 加密 |
|---|------|--------|----------|------|--------|------|------|
| B1 | **MySQL 全库**（含 assessments/items/policy_*/snapshots/audit_logs/events/admin_users） | 误删、损坏、主机故障 | `mysqldump --single-transaction --quick --routines --set-gtid-purged=OFF` + gzip | **每日 03:10**（避开 03:00 TTL 清理） | 本地 3 天，**COS 30 天**，每月首日副本 **12 个月** | 主桶 `/backup/mysql/` + 异地桶（跨 region 复制） | AES-256-GCM，备份专用密钥（与业务密钥隔离） |
| B2 | **MySQL binlog（增量）** | 上次全备到故障点之间的数据 | `mysqlbinlog` 增量拉取 + 上传 | **每 15 分钟**（常态）／**每 5 分钟**（申报季） | COS **7 天**（足够覆盖任意 PITR） | 同上 | 同上 |
| B3 | **规则包与政策内容**（`policy_versions` / `policy_rules` / `policy_refs` / `advice_templates`） | 规则错误后的回滚依据、合规溯源 | 独立于全备的 `JSON` 快照导出，**每次发布都导一份** | 每次规则包发布时触发 + 每日兜底 1 次 | **永久保留**（不可删除） | COS（开启**版本控制 + 合规保留 WORM** 7 天最小留存期） | 明文 + sha256 清单（内容合规需可审计，但不含用户数据） |
| B4 | 快照短链（`snapshots`）与报告产物（`reports`） | 30 天 TTL 自然到期 | **不备份** | — | — | — | ⚠ **设计决策**：token 派生密钥加密，token 不落库 → 技术上无法离线解密；产物可重算。**UI 必须明示到期日与"请自行下载保存"** |
| B5 | 配置与密钥 | 误改、主机丢失 | ① `docker-compose.prod.yml` / Nginx conf / crontab / systemd timer → **Git 仓库**（`.env` 除外）② `.env` 与密钥 → **离线密码库** + 加密副本入 COS | 每次变更 | Git 永久；密码库按版本 | Git（私有）+ 密码库 + COS 加密副本 | 离线库 + AES |
| B6 | 容器镜像与版本 | 镜像仓库不可用/误删 | GitHub Actions 构建 → 打 `IMAGE_TAG`（含 commit sha） | 每次发版 | **保留最近 20 个 tag**（本机只留 5 个省磁盘） | GHCR + 云厂商镜像仓库（可选双写） | — |
| B7 | 云盘快照（整机级） | 云盘损坏、勒索、文件系统级故障 | 云厂商自动快照策略 | 每日 04:00 | 保留 7 天 + 每月首快照 12 个月 | 云平台（建议开启跨 AZ 复制） | 平台侧加密 |
| B8 | events / audit_logs 归档 | DB 体量增长 | 按月导出 `csv.gz` 删老分区 | 每月 1 日 | `events` 12 个月；`audit_logs` **2 年** | COS 归档存储 | 脱敏后归档（events 本就无敏感字段） |

### 6.2 RPO 与 RTO（明文承诺值）

| 场景 | **RPO（数据丢失窗口）** | **RTO（恢复耗时目标）** | 依据 |
|------|------------------------|------------------------|------|
| 常态整库丢失 | **≤15 分钟**（binlog 增量同步间隔） | **≤60 分钟** | 全备 + ≤15min binlog 回放 |
| **申报季（4~8 月）** | **≤5 分钟**（binlog 同步频率提升） | **≤45 分钟** | 预算已含此项（binlog 上传频率提升带来的请求成本 <2 元/月） |
| 单表/单行误操作（PITR） | **≤秒级**（可精确到误操作前一刻） | **≤30 分钟** | 全备 + binlog 点到秒恢复，仅回灌受影响行 |
| 规则包错误回滚（非数据丢失，属正确性） | 0 | **≤5 分钟**（含缓存清理） | `rulepack_rollback.py` 自动执行 |
| 整机重建（含 AZ 故障） | ≤15 分钟 | **≤4 小时**（技术研发方案 §2.4 承诺值） | 云盘快照/COS 恢复 + `docker compose up` + DNS 切换（TTL 300s） |
| 单点容器/进程级故障 | 0 | **≤10 分钟**（`restart: unless-stopped` + 健康检查） | Docker 自愈 |

### 6.3 备份作业时间窗与互斥

| 时间 | 任务 | 互斥要求 |
|------|------|----------|
| 03:00 | TTL 清理（快照过期、events 老分区归档） | 与全备互斥（先后串行） |
| **03:10** | **MySQL 全量备份**（低峰期） | 与 TTL 清理相隔 10min；禁止与发版同时进行 |
| 每 15min / 5min | binlog 增量上传 | 单任务 <30s，不阻塞主业务 |
| 04:00 | 云盘快照（平台侧） | ⚠ 与全备错开 50min，避免 IO 抖动叠加 |
| 03:30 | **备份成功核验**（存在性 + sha256 + 异地副本存在） | 失败即 P1（§3.6 监视器 #9 是 P0 兜底） |
| 05:00 | 日志脱敏扫描 + 备份完整性清单入库 | — |
| 每月 1 日 02:00 | events/audit_logs 归档导出 | — |

### 6.4 备份脚本（`scripts/ops/backup_mysql.py`，python3）

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MySQL 全量备份：dump -> gzip -> AES-256-GCM 加密 -> 本地滚动 -> COS -> 异地复制 -> 校验留痕
用法: python3 scripts/ops/backup_mysql.py --retention-days 30 [--dry-run]
失败必须非零退出并被 systemd timer 的 OnFailure 捕获后推送 P1 告警。
"""
import argparse, hashlib, gzip, os, subprocess, datetime, pathlib, json, hmac

BACKUP_DIR = pathlib.Path("/data/backup-local")
LOG_DIR = pathlib.Path("/data/logs/ops")
RETENTION_LOCAL_DAYS = 3

def now():
    return datetime.datetime.now()

def dump(host="127.0.0.1", port=3306):
    """mysqldump 全量：--single-transaction 保证一致性不锁表"""
    ts = now().strftime("%Y%m%d-%H%M%S")
    sql_path = BACKUP_DIR / f"mysql-{ts}.sql.gz"
    cmd = ["mysqldump", f"-h{host}", f"-P{port}", "-uops_backup", "-p"+os.environ["MYSQL_BACKUP_PWD"],
           "--single-transaction", "--quick", "--routines", "--triggers",
           "--default-character-set=utf8mb4", "--all-databases"]
    with gzip.open(sql_path, "wb") as fh:
        p = subprocess.run(cmd, stdout=fh, stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise SystemExit(f"mysqldump failed: {p.stderr.decode()[-500:]}")
    return sql_path

def encrypt_and_digest(src: pathlib.Path, key: bytes):
    """AES-256-GCM：密文 + nonce + tag；同时输出明文 sha256 供还原校验"""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = os.urandom(12)
    data = src.read_bytes()
    ct = AESGCM(key).encrypt(nonce, data, None)
    out = src.with_suffix(".sql.gz.enc")
    out.write_bytes(nonce + ct)
    digest = hashlib.sha256(data).hexdigest()
    (LOG_DIR / "backup-manifest.jsonl").open("a").write(json.dumps({
        "ts": now().isoformat(), "file": str(out), "bytes": out.stat().st_size,
        "sha256_plain": digest, "alg": "AES-256-GCM"
    }, ensure_ascii=False) + "\n")
    return out, digest

def upload_cos(local: pathlib.Path, key: str, cross_region: bool = True):
    """上传至 COS 备份桶；cross_region 依赖桶级别跨地域复制配置"""
    subprocess.run(["coscli", "cp", str(local), f"cos://hitech-backup/{key}", "--recursive"], check=True)
    return f"cos://hitech-backup/{key}"

def rotate_local():
    cutoff = (now() - datetime.timedelta(days=RETENTION_LOCAL_DAYS)).timestamp()
    for f in BACKUP_DIR.glob("mysql-*"):
        if f.stat().st_mtime < cutoff:
            f.unlink()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--retention-days", type=int, default=30)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    key = bytes.fromhex(os.environ["BACKUP_KEY_HEX"])   # 32 字节，来自离线密码库，绝不入库
    sql = dump()
    enc, digest = encrypt_and_digest(sql, key)
    sql.unlink()                                       # 落盘密文后立刻删明文
    if not args.dry_run:
        upload_cos(enc, f"mysql/{now():%Y/%m}/{enc.name}")
    rotate_local()
    print(f"OK {enc.name} sha256={digest[:16]}... size={enc.stat().st_size/1024/1024:.1f}MB")

if __name__ == "__main__":
    main()
```

**binlog 增量（同目录 `backup_binlog.py`）**：每 15min（申报季 5min）执行 `mysqladmin flush-logs` 后把上一批 binlog 上传 COS `binlog/{yyyy}/{mm}/`，并记录 manifest 用于 PITR 回放。

### 6.5 异地与加密

- **异地原则**：至少 **3 副本**：① 本机 `/data/backup-local`（3 天，快速恢复）② COS 主桶不同对象前缀（30 天）③ **跨地域复制桶**（不同 region，30 天 + 月副本 12 月）。任一份丢失不影响可恢复性。
- **WORM/合规保留**：规则包快照（B3）开启存储桶「版本控制 + 最小保留期」，防止误删与勒索删除。
- **密钥隔离**：备份加密密钥 ≠ 业务加密密钥；存放于**离线密码库**（如 KeePass 加密文件存 3 个负责人本地 + 1 份纸质打印封存），**禁止**与备份文件同处一地；密钥本身每 **12 个月**轮换（§8.5）。
- **传输**：全链路 HTTPS（COS SDK 默认）；禁止明文 SDK 配置。

### 6.6 恢复演练与校验方法（**最重要的运维动作**）

| 频次 | 演练类型 | 方法 | 通过标准 | 记录 |
|------|----------|------|----------|------|
| **每月**（自动） | 备份可恢复性校验 | `python3 scripts/ops/restore_verify.py` → 拉最新全备到隔离 MySQL 容器 → 起库 → 校验：① 表数量一致 ② 关键表行数 ±0 ③ 抽 200 条 assessment 重算 `rulepack_sha256` 一致 ④ 随机 5 条 `result_json` 可 JSON 解析且与 items 行数一致 | **全部通过**；失败即 P0 | `/data/logs/ops/restore_verify_YYYYMM.log` |
| **每季度**（人工执行） | 全流程恢复演练（含 PITR） | ① 记录演练开始 DB 状态；② 模拟删表/误更新；③ 从全备 + binlog 恢复到误操作前 1 秒；④ 切读到演练实例验证；⑤ **计时**：记录实际 RTO；⑥ 用灾难当天数据校验实际 RPO | **RTO ≤60min、RPO ≤15min**（申报季 ≤45min/≤5min） | 演练报告（含截图 + 时长 + 偏差项）→ 归档 + 上报团长 |
| **每半年** | 异地副本恢复演练 | 只用**异地 COS 副本**（不用本地/主桶）恢复到全新主机，验证"异地真的能恢复" | 全流程可拉起并通过 `health_probe.py --full` | 同上 |
| **每年**（申报季前，建议 3 月） | **整机重建演练**（演练 §5.15） | 新建云主机 → 从零 `compose up` → 恢复数据 → 切流量验证 → 记录耗时 | **≤4h** | Runbook R-13 更新（含踩过的坑） |

**校验 `restore_verify.py` 关键逻辑**（示意）：

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""月度备份可恢复性自动校验：恢复 -> 结构/行数/checksum 三重比对 -> 不通过即非零退出(触发 P0)"""
import subprocess, mysql.connector, json, datetime, sys

def decompress_and_decrypt(enc_path, key_hex):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    raw = open(enc_path, "rb").read()
    nonce, ct = raw[:12], raw[12:]
    return AESGCM(bytes.fromhex(key_hex)).decrypt(nonce, ct, None)   # GCM 自带完整性校验：密文被篡改会直接抛异常

def main():
    latest = subprocess.check_output(
        ["ls", "-t", "/data/backup-local/mysql-*.enc"]).decode().split()[0]
    sql = decompress_and_decrypt(latest, os.environ["BACKUP_KEY_HEX"])
    subprocess.run(["docker", "exec", "-i", "mysql-verify", "mysql", "-uroot", "-p$pwd"],
                   input=sql, check=True)

    prod = mysql.connector.connect(**PROD_RO)      # 只读账号
    ver  = mysql.connector.connect(**VERIFY)
    problems = []
    for t in ["assessments", "assessment_items", "policy_versions", "policy_rules",
              "snapshots", "enterprises", "ip_assets", "audit_logs"]:
        c1, c2 = prod.cursor(), ver.cursor()
        c1.execute(f"SELECT COUNT(*) FROM {t}"); c2.execute(f"SELECT COUNT(*) FROM {t}")
        n1, n2 = c1.fetchone()[0], c2.fetchone()[0]
        if abs(n1 - n2) > (n1 * 0.001):            # 恢复时间点晚于备份，允许 0.1% 增量差
            problems.append(f"{t}: prod={n1} restored={n2}")
    c = ver.cursor()
    c.execute("SELECT id, rulepack_sha256 FROM assessments ORDER BY id DESC LIMIT 200")
    bad = [r for r in c.fetchall() if r[1] not in KNOWN_SHAS]       # 规则包版本必须在 policy_versions 中存在
    if bad:
        problems.append(f"unknown rulepack_sha256 count={len(bad)}")
    if problems:
        print("FAIL", json.dumps(problems, ensure_ascii=False)); sys.exit(1)
    print("PASS", datetime.datetime.now().isoformat())

if __name__ == "__main__":
    main()
```

---

## 7. 稳定性保障：SLO/SLI、错误预算、变更管理与值班

### 7.1 SLO / SLI 定义（承诺值 + 统计口径 + 度量方式）

| # | SLI（如何测） | **SLO 承诺值** | 统计口径 | 度量方式（谁的数据为准） | 窗口 |
|---|---------------|----------------|----------|--------------------------|------|
| S1 | **核心服务可用性**：`/api/v1/healthz` + `/api/v1/assessments/calculate` + 落地页 + 结果页 的成功率 | **≥99.5%** | 用户侧错误率：HTTP 5xx 与拨测失败均计为不可用分钟；**计划内维护窗口（≤30min/次，月度≤2 次）不计入** | Uptime Kuma + **外部拨测（UptimeRobot/云厂商两地）**，取两者交集（防止同机 Kuma 失联漏报）；争议时以外部拨测为准 | 自然月滚动 |
| S2 | **算分接口延迟** `/api/v1/assessments/calculate` | **P95 ≤800ms**（内控目标 P95 ≤150ms） | 服务端 `$upstream_response_time`，排除客户端网络耗时；样本剔除 4xx | Nginx access log + `/api/v1/metrics` | 滚动 28 天 |
| S3 | SSR 首屏内容页 | LCP P75 ≤2.5s | 合成拨测（脚本模拟，固定网络档位） | `health_probe.py` 合成数据 | 滚动 28 天 |
| S4 | **PDF 导出成功率** | **≥98%**（月度） | `status=ready` ÷ 全部导出请求（不含用户主动取消） | `reports` 表 | 自然月 |
| S5 | **PDF 导出耗时** | P95 ≤15s（排队 + 渲染总时长） | 从 `queued` 到 `ready` 的墙钟时间 | `reports` 表 + 埋点 | 滚动 28 天 |
| S6 | Excel 导出成功率 | ≥99% | 同上 | `reports` 表 | 自然月 |
| S7 | **前后端算分一致性** | **100%（diff = 0）** | 逐项比对 `score_min/score_max/verdict` | 前端上报 `consistent` + 每日 `rulepack_guard.py --deep` 全量离线复算 | 持续（零容忍） |
| S8 | 短链生成/解析成功率 | ≥99% | 成功数 ÷ 请求数（解析排除正常过期 40002） | Nginx + 埋点 | 滚动 28 天 |
| S9 | **数据可恢复性** | RPO ≤15min / RTO ≤60min（申报季 ≤5min / ≤45min） | 恢复演练实测值 | 季度演练报告 + 月度自动校验 | 季度 |
| S10 | 后台可用性（内部） | ≥99.0% | `/admin` 登录与查询可用 | Kuma + 管理员反馈 | 自然月 |

**对外承诺口径（必须写进用户可见条款，且承诺值低于实际能力）**：
> 本站承诺**月度可用性不低于 99.5%**（约合每月最多 3.6 小时不可用），测算结果仅供自评参考，不构成官方认定结论。**因不可抗力、基础电信运营商故障、计划内维护（提前公告）导致的中断不计入**。V1.0 为免费工具，**不提供赔偿条款**；V2.0 若涉付费，再另行约定 SLA 与补偿。

### 7.2 错误预算（Error Budget）与应用规则

| 项 | 数值 |
|----|------|
| 月度预算（99.5%） | **≈3.6 小时/月**不可用额度（对应 43200 分钟 × 0.5% ≈ 216 分钟） |
| 触发线 1 | 预算消耗 **>50%（1.8h）** → **冻结非必要变更**（仅允许 P0/P1 缺陷修复与安全补丁），并由 PM-1 在周会说明消耗原因 |
| 触发线 2 | 预算消耗 **>80%（2.9h）** → 发布窗口关闭，全员优先做稳定性改进；所有新功能需求排队至下月 |
| 触发线 3 | 预算**耗尽（3.6h）** → **变更冻结至月底**；必须提交"稳定性改进计划"经团长批准后才可解冻 |
| 度量 | 每月 1 日 09:00 自动出《SLO 与错误预算月报》（`python3 scripts/ops/slo_report.py`），推送 IM + 邮件 |
| 单次上限 | **任何单次 P0 故障不得超过 1 小时**（超出即触发 24h 内专项复盘，而非 48h） |

### 7.3 发布执勤与变更窗口

| 变更类型 | 窗口 | 前置条件 | 执勤要求 |
|----------|------|----------|----------|
| 常规版本发布 | **周二 / 周四 20:00-22:00**（避开申报季 09:00-18:00 高峰） | CI 全绿 + staging 验证 + 回滚版本已确定 + 不在错误预算冻结期 | DEV-1 + OPS-1 双人在岗；发布后 **72 小时**重点观察（对齐上线发布方案） |
| 紧急修复（P0/P1） | 随时 | PM-1 批准（可先口头后补单） | 至少 2 人在岗；30min 内完成回滚验证 |
| **规则包热修** | 同常规窗口，**另加要求：必须在低峰期发布**（20:00 后），且发布次日在岗观察 ≥4h | 见 §7.4 三级审批 | RULE-1 + DEV-1 + OPS-1 三人到齐 |
| 基础设施变更（升配/扩容/内核重启） | **周日 22:00-24:00**，申报季（4~8 月）**原则上禁止需要重启的变更** | 提前 24h 公告 + 备份完成 + 回滚方案 | OPS-1 在岗；需要重启主机的操作须 PM-1 批准 |
| 内容/文案紧急变更 | 随时（绿色通道，无需全量 CI） | RULE-1 起草 + PM-1 复核；**但合规类内容（免责声明/政策引用）必须同步通知 OPS-1 归档** | 单人可执行，事后补变更单 |

### 7.4 变更管理细则

**（1）通用规则**：所有变更必须有变更单（Issue/PR/运维单三选一），含「变更内容 / 影响面 / 回滚方式 / 验证方法 / 执勤人」五要素；无变更单的操作视为违规变更。

**（2）规则包热修（最高危，三级审批 + 影子复算 + 自动回滚）**：

| 步骤 | 责任人 | 动作 | 卡点 |
|------|--------|------|------|
| 1. 起草 | RULE-1 | 编辑 draft 规则包，附**政策依据原文**（文号 + 条款 + 链接） | 无依据的差异**不写入**（选型报告 §5.3 第 7 条） |
| 2. 自动门禁 | CI | ① 16 组财务边界 + B1~B16 全部通过 ② 双端一致性（Node + jsdom 同 golden case）③ **影子复算**：用新规则包对近 30 天 ≤500 条真实 assessment 离线复算，输出 diff 报告 | **任一 golden case diff ≠ 0 → 禁止发布** |
| 3. 双人复核 | PM-1（业务）+ 外部政策顾问（内容） | 逐条确认 diff 报告中**每一处分数变化的合理性**并在 diff 报告签字（电子留痕入 `audit_logs`） | 无人签发 → 禁止发布 |
| 4. 发布 | OPS-1 | 低峰期执行；自动清 rulepack 缓存；`audit_logs` 记录发布前后 `rulepack_sha256` | 必须能一键回滚到上一版本 |
| 5. **发布后哨兵** | 自动脚本 | `rulepack_guard.py --watch 30m`：监控 B-06 平均分偏移、B-07 达效率、B-08 一致性 | **平均分偏移 >±2 分 → 自动回滚 + P0 电话**（B-09） |
| 6. 观察期 | RULE-1 | 发布后 **72 小时**内每日核对 B-06/B-07 是否稳定在基线 ±3 分内 | 异常即回滚，不允许"先观察几天" |

**（3）数据库结构变更**：只允许通过 `prisma migrate`；**禁止在线手工 DDL**；破坏性变更（删列/改类型）必须采用「扩列→双写→回填→切读→删旧列」五步法，跨 2 个发布周期；大表操作前必须先在备份恢复实例上验证耗时。

**（4）批量数据操作**：后台批量操作强制 **dry-run 预览 + 二次确认 + 影响行数 >1000 需 PM-1 审批**（源自 §5.3 复盘要求）；执行前自动触发一次额外全备。

### 7.5 值班表与 on-call 升级路径

**角色与值班（上线前必须替换为真实姓名电话，写入 `/srv/hitech/ops/CONTACTS.md` 并置顶 IM 群）**：

| 角色 | 代号 | 值班时间 | 联系方式用途 |
|------|------|----------|--------------|
| 运维主值班（本人角色） | **OPS-1** | 7×12（08:00-20:00 电话可达；20:00-08:00 短信 + 电话轮询可达） | 所有告警第一响应人；P0 电话群呼第一顺位 |
| 运维备份值班 | **OPS-2** | OPS-1 失联 10min 后自动接管 | 电话群呼第二顺位；休假日互备 |
| 全栈研发负责人 | **DEV-1** | 工作日 + P0/P1 随时 | 代码/依赖/架构类故障第二响应人 |
| 规则与政策内容负责人 | **RULE-1** | 规则包发布期 + B 类业务告警 | 规则正确性第一责任人 |
| 项目负责人（团长接口人） | **PM-1** | 24h（重大事件） | 对外口径、升级决策、合规上报 |

**升级路径（严格按时长自动升级，不需要人工判断）**：

| 级别 | 触发 | 第一响应 | 升级条件 | 目标响应/恢复 |
|------|------|----------|----------|----------------|
| **P0** | 服务不可用、正确性错误（规则/数据）、疑似泄露、金额/资金类 | OPS-1，**15 分钟内响应并认领** | 15min 未认领 → 电话群呼 OPS-2 → 30min 未恢复 → DEV-1 → 1h 未恢复 → PM-1 → 涉 PR/合规 → 立即上报**团长** | 响应 ≤15min；**恢复 ≤60min**（单次上限 1h） |
| **P1** | 核心功能降级、错误率/延迟超阈、业务指标异常 | OPS-1/DEV-1 | 工作时间 **30 分钟**内响应；夜间（22:00-08:00）**次晨 10:00 前**处理（除非升级为 P0） | 响应 ≤30min；当日解决 |
| **P2** | 资源水位、证书临期、慢查询、归档/清理类 | OPS-1 | — | 当日或次日工作窗口处理；周会跟踪 |

**值班纪律**：
1. 每次告警必须有人**认领**（IM 回复「我处理」），未认领自动升级，不允许"看到了但没认领"；
2. P0 处理期间，处理人**只做一件事**，其他需求/询问由 PM-1 挡掉；
3. 值班交接：每周一 10:00 交接，交接内容包括「未闭环告警 / 进行中故障 / 待观察变更」三项；
4. P0 预案（本文 §0.4 速查卡 + §5 各流程）**打印并贴在工位**，故障时不需要现想。

---

## 8. 安全运维

### 8.1 系统与镜像补丁

| 项 | 策略 | 窗口/频率 |
|----|------|-----------|
| OS 包更新（安全类） | `apt update && apt upgrade -y`（仅 security 源优先） | **每月第一个周二 22:00-24:00**；申报季（4~8 月）**禁止**需要重启的更新，除非 CVE 评分 ≥7.0 |
| 内核重启 | 仅在 CVE ≥7.0 或厂商强制时；需 PM-1 批准 + 提前公告 | 季度 ≤1 次 |
| Docker / compose | 跟随 OS 更新；不在生产跑 `latest` | 同上 |
| 基础镜像（node:20-alpine、nginx:1.25-alpine、mysql:8.0.36） | **每月重建一次**（digest 固定 + 月度刷新），由 CI 流水线自动 PR 升级 digest | 每月第二个周二 |
| **镜像漏洞扫描** | CI 内 `trivy image --severity HIGH,CRITICAL --exit-code 1` | 每次构建必须过；CRITICAL 一律阻断，HIGH 需 DEV-1 书面豁免且给出修复期限 ≤14 天 |
| 运行期扫描 | 每周一 `trivy image <running image>`；结果入周报 | 每周 |

### 8.2 依赖漏洞扫描（CI 内）

| 工具 | 触发 | 门禁 |
|------|------|------|
| `pnpm audit --audit-level=high` | 每次 PR / 每日定时 | HIGH 及以上 fail；中危记录但不阻断 |
| `npm outdated` 周报 | 每周一 | 输出 Top10 待升级清单给 DEV-1 |
| Dependabot | GitHub 开启，每周 PR | 自动 PR → CI → DEV-1 review |
| **日志脱敏静态扫描** `scripts/ci/log_leak_scan.py` | 每次 PR | 命中 §4.3 敏感字段明文字面量 → fail（这是防泄露的第一道 CI 闸） |
| **Secret 扫描** `gitleaks` | 每次 push + pre-commit | 有任何密钥字串入库 → fail 并要求轮换该密钥 |
| SAST（可选，¥0） | `semgrep --config p/default` 每周 | 仅告警不阻断，逐步收紧 |

### 8.3 端口、防火墙与抗刷

| 项 | 措施 |
|----|------|
| 云安全组 | **入站仅放行 80/443**；20222（SSH）**仅放通运维固定 IP 段**，或干脆零暴露改用云控制台 VNC/串口；出站默认放行（限制不必要的外连） |
| 主机防火墙 | `ufw default deny incoming`；仅 allow 80/443/20222（限制来源 IP） |
| 容器端口 | MySQL 3306 / Redis 6379 / Kuma 3001 **绝不 publish 到宿主**；仅 Docker bridge 内互通；CI 检查 `compose` 文件中不得出现这几项的 `ports:` |
| Nginx 限流 | `zone=api:10m rate=10r/s burst=20 nodelay`；`zone=admin:1m rate=1r/s`；`zone=export:1m rate=1r/3s`；`limit_conn perip 30` |
| CC / 爬虫 | `anti_abuse.py --auto-ban`（5min 内请求 >500 次或非正常 UA → 封 24h），每日人工复核 ban 清单防误封；robots.txt 声明 `Crawl-delay` + 禁止抓取 `/admin` 与 `/api` |
| WAF | V1.0 不采购商业 WAF：用云厂商免费基础 CC 防护 + Nginx 规则 + CSP 兜底（§1.3）；若出现真实攻击再评估升级（列入 §11 待决策） |
| 后台管理面 | `/admin` 仅内网/I P白名单可访问；路径不在 robots/sitemap 暴露；无外部链接入口 |

### 8.4 SSH 加固

| 项 | 要求 |
|----|------|
| 认证 | **仅 ed25519 公钥**；`PasswordAuthentication no`；`PermitRootLogin no`；`AllowUsers ops` |
| 端口 | 改 `20222`（**仅为减少噪音，不构成安全边界**）；或直接 0 暴露走 VNC |
| 爆破防护 | fail2ban：`maxretry=3`、`bantime=3600`、`findtime=600`；连续封禁 ≥3 次同来源 → 上报 PM-1 |
| 会话 | `ClientAliveInterval 300`、`ClientAliveCountMax 2`；sudo 需密码且入 `/var/log/auth.log` 并同步到 ops 日志 |
| 审计 | 所有 sudo 操作记录；每季度导出核对一次；**禁止共享账号**（每人一个 ops 账号，离职即删） |
| 容器内 | **不安装 sshd**；排障一律 `docker compose exec`（操作记录进 shell history 归档） |

### 8.5 后台 IP 白名单、TOTP 与密钥管理

| 项 | 要求 |
|----|------|
| 后台鉴权 | `/admin` + 会话 Cookie（`HttpOnly/Secure/SameSite=Lax`）+ **TOTP 二次因子** + **IP 白名单**；失败 5 次锁 15 分钟（技术研发方案 §5.3 M10） |
| IP 白名单变更 | **双人复核**（申请 + OPS-1 执行 + PM-1 复核）+ 写变更单 + `audit_logs` 留痕；**每次主机重建后必须第一时间更新白名单**（否则管理员被锁在门外，见 §5.15） |
| TOTP 泄露应急 | 立即禁用账号 → 吊销会话 → 重置 TOTP 种子 → 全量复核 `audit_logs` → 按 §5.12 疑似泄露预案处理 |
| 账号生命周期 | 离职/转岗当日禁用并回收；**每半年权限盘点**（参考文件 §9） |
| 密钥清单 | 建立《密钥资产清单》：① `SNAPSHOT_MASTER_KEY`（短链快照派生）② 财务/信用代码 AES 主密钥（带 `key_version`）③ `BACKUP_KEY`（备份加密）④ COS AK/SK ⑤ Sentry DSN/auth token ⑥ 管理员 TOTP 种子 ⑦ Nginx basic auth（Kuma 面） |
| 存储 | **绝不入库**：生产用 `/srv/hitech/.env`（`chmod 600`、属主 root）+ 离线密码库双备份；CI/CD 用 GitHub Secrets；COS AK/SK 优先用**云角色/临时凭证**而非长期 AK |
| 轮换 | 常规密钥**每 6 个月**轮换一次；遇到泄露疑似（§5.12）**立即全量轮换**；轮换必须支持**多版本共存 ≥90 天**（`key_version` 双写），并有"轮换后旧数据仍可解密"的校验脚本 |
| 禁止 | 禁止把密钥写进镜像、写进 Git、写进日志、写进 Sentry、贴在 IM 群聊永久消息里（如需临时共享，用完即删并轮换） |

### 8.6 数据导出脱敏与权限

| 场景 | 规则 |
|------|------|
| 后台列表 `/admin/v1/assessments` | **默认脱敏**：信用代码、财务字段默认打码，仅显示 `masked_name` 与派生指标 |
| 明文查看 | 需 `sensitive_view` 权限 + **二次确认** + 每次查看写 `audit_logs`（含 actor、目标、时间、IP） |
| CSV 导出 | **强制脱敏**（技术研发方案 §5.3 M10 已定）；导出行为写审计日志；**同一账号单日 >5 次导出 → P1 告警**（§5.12 判定标准） |
| 用户侧报告 PDF/Excel | `share_masked=1` 默认脱敏（企业名/信用代码打码）；"一键删除"功能可删除产物 + 撤销下载令牌 |
| 生产数据流入测试环境 | **禁止**。测试用造数脚本；确需复现问题时，用脱敏后的子集且需 PM-1 批准 |

### 8.7 等保与个人信息保护合规要点

| 合规项 | 现状 | 运维侧要求 |
|--------|------|------------|
| ICP 备案 | 必需且为上线关键路径 | 域名/主体/云资源三者一致；每年核对备案信息有效性；更换 IP/域名须重新备案或变更 |
| 网络安全法：日志留存 ≥6 个月 | 满足 | 访问日志/审计日志留存 ≥180 天（§4.4 已落实）；不得擅自缩短 |
| 个人信息保护法 | V1.0 **最小必要**：不收集手机号，游客 token + IndexedDB | ① 出现泄露按 §5.12 在规定时限内报告/通知 ② V1.1 引入手机号后必须单独同意 + 加密 + 盲索引 ③ 用户删除请求须在 **15 个工作日内**完成（含"删除名单"机制，防止备份恢复时数据复活，见 §10.3） |
| 企业敏感商业数据（高） | 库内加密、传输 HTTPS、日志脱敏 | 最小可见 + 一键删除 + 明示用途承诺；§4.3 脱敏清单为硬红线 |
| 等保定级 | V1.0 建议按**二级**自查（非强制但不备案不建议省略） | 自查项：身份鉴别（MFA）、访问控制（白名单/权限）、安全审计（≥180 天审计）、数据完整性与保密性（加密/脱敏）、备份与恢复（§6）——本文均已给出落地项；正式测评由甲方决策 |
| 内容合规 | 免责声明三处 + 政策溯源 + 禁用词 | §5.13 预案 + `content_guard.py` 每日巡检 |
| 第三方脚本（PRD §10.3） | **严禁**引入任何第三方统计/广告脚本 | CSP 白名单 + CI 检查：仓库中不得出现 GA/友盟/神策等外域 script 引用；违反视为合规事故 |


---

## 9. 成本监控与优化

### 9.1 月度成本拆解表（预算 500 元 / 硬上限 600 元）

| # | 成本项 | 规格/用量 | **淡季（9 月~次年 3 月）** | **申报季（4~8 月）** | 说明 |
|---|--------|-----------|--------------------------|----------------------|------|
| C-1 | 云服务器 | 淡季 2C4G；旺季临时升 4C8G | **150** | **380** | 包年包月折月；升配按差额按天/按月结算，季末即降 |
| C-2 | 云盘 | 系统盘 30GB SSD + 数据盘 100GB SSD | 35 | 35 | 年增 ~12GB（§2.5），2 年内无需扩容 |
| C-3 | 公网带宽 | 淡季 5Mbps；旺季 8Mbps | 0（含在主机套餐） | **+80** | 见 §2.2 带宽换算；CDN 命中后可下调 |
| C-4 | 云盘快照 | 100GB 增量，7 天滚动 + 月副本 | 20 | 25 | 必选项（§6 B7） |
| C-5 | COS 主桶 | 存储 ~20GB + 请求 + 30 天产物 | 8 | 15 | 产物自然过期，存储不累积 |
| C-6 | COS 备份桶 + 跨地域复制 | ~40GB + 跨地域流量 | 12 | 18 | 必选项（§6 B1/B2/B3） |
| C-7 | CDN | 静态加速 | 0（关闭） | **20** | 申报季开启降回源与带宽 |
| C-8 | 域名 | .com/.cn 续费 | 8 | 8 | 100 元/年 |
| C-9 | TLS 证书 | Let's Encrypt | 0 | 0 | certbot 自动化 |
| C-10 | Sentry | SaaS Free（5k errors/10k spans） | 0 | 0 | 超量**先降采样**，不盲目升级 |
| C-11 | 外部拨测 | UptimeRobot 免费 + 云厂商免费额度 | 0 | 0 | **不可省**（§11 C-1 告警可达性） |
| C-12 | 备份校验用的临时实例 | 每月校验/季度演练 | 3 | 3 | 恢复演练放在同一台机器隔离容器即可，近乎零成本 |
| **合计** | | | **≈ 236 元/月** | **≈ 584 元/月** | 落在既定 200~600 元/月预算带内 |

> 若出现 Year 1 新客优惠，实际可能低至 100~180 元/月，差额**不挪作他用**，留作旺季突发缓冲。

### 9.2 成本护栏告警（防止一次失误吃掉全年预算）

| # | 护栏 | 阈值 | 持续 | 级别 | 渠道 | 负责人 | 动作 |
|---|------|------|------|------|------|------|------|
| G-1 | 日账单异常 | 单日消费 >**50 元**（≈月预算 10%） | 当日 | P1 | 短信+IM | OPS-1 | 云控制台查费用明细：若是带宽/COS 流量突增 → 按 G-3/G-4 查是否被盗刷；若是误开按量资源 → 立即释放 |
| G-2 | 月度进度 | 自然月累计达 **400 元（80%）** | 实时 | P2 | IM | OPS-1 | 对比预算表找超项；暂停可选支出（CDN/暂缓升配） |
| G-3 | 月度封顶 | 累计达 **500 元（100%）** | 实时 | P1 | 短信+IM | PM-1+OPS-1 | **24h 内出成本复盘**：什么变了；并形成优化动作清单 |
| G-4 | 严重超支 | 累计 >**600 元** 或 环比上月 >**150%** | 实时 | **P0** | 电话+短信 | PM-1 + **团长** | 立即止损：降配/关 CDN/降 Sentry 采样/查异常流量；48h 内出报告 |
| G-5 | COS 外网流出流量 | 日 >**5GB**（常态基线 <1GB） | 当日 | P1 | 短信+IM | OPS-1 | **优先怀疑被盗链**：开启 Referer 防盗链 + 临时把桶改私有 + 检查 CDN 回源策略 |
| G-6 | CDN 流量 | 日 >**6GB** | 当日 | P1 | 短信+IM | OPS-1 | 缩小 CDN 加速范围 / 提高缓存命中 / 下限流 |
| G-7 | Sentry 额度 | 用量达 **80%** | 周检查 | P2 | IM | DEV-1 | **先降采样**（0.1→0.05），仍不足才评估升级付费版（需 PM-1 批准） |
| G-8 | 闲置资源（月度盘点） | 见 §9.4 | 每月 1 日 | P2 | 邮件周报 | OPS-1 | 输出闲置清单并当周清理 |

### 9.3 季节性扩容 / 降配策略（峰谷比 10:1 的核心成本动作）

| 阶段 | 时间 | 动作 | 触发依据 |
|------|------|------|----------|
| **旺季前准备** | **每年 3 月 15 日前**（各地申报多集中 4~8 月） | ① 云主机 2C4G → **4C8G** ② 带宽 → 8Mbps ③ 开启 CDN ④ `PDF_CONCURRENCY=1→2`、队列 32→64 ⑤ MySQL `buffer_pool 640M→2G`、Redis `maxmemory 256M→512M` ⑥ binlog 增量频率 15min→**5min**（RPO 收紧） ⑦ **完成一次季度恢复演练 + 一次压测** | 日历驱动 + 上一季度 §2.6 指标确认；无需等指标突破才动手 |
| 旺季保障期 | 4~8 月 | ① **变更窗口收紧**：仅每周四 21:00-22:00，且只放行 P2 以下修复 ② 严禁需要重启主机的变更 ③ PDF 队列与内存指标进入每日巡检 ④ 值班升级为 7×12 双人 | — |
| **降配回落** | 旺季结束后连续 **14 天** 同时满足：CPU P95 <40% 且 内存 P95 <60% 且 DAU 回落至旺季峰值 30% 以下 | 逐项回落：4C8G→2C4G、带宽→5Mbps、CDN 关闭、`PDF_CONCURRENCY→1`、binlog→15min | 防止"扩上去下不来" |
| 突发峰值（政策新规发布导致内容页尖峰） | 事件驱动 | ① 先延 ISR revalidate 到 1h、开 CDN ② 资源仍吃紧 → 临时按天升配（成本 +15~25 元/天，可接受） ③ 峰值过后当天降回 | A-02 + B-01 联合判定 |

### 9.4 闲置回收策略（每月 1 日执行，输出《闲置与环境月度盘点清单》）

| 检查项 | 动作 | 预估节省 |
|--------|------|----------|
| 超过保留期的云盘快照（>7 天，除月副本） | 删除 | 10~20 元/月 |
| 未绑定的弹性公网 IP / 闲置负载均衡 | 释放 | 0~30 元/月（本项目通常无，但须核对） |
| 本机 Docker 悬空镜像与构建缓存 | `docker image prune -f --filter "until=240h"` + `docker builder prune -f` | 省磁盘（间接省云盘扩容） |
| 超过 20 个的旧镜像 tag（GHCR） | 删除旧 tag | 省仓库存储/拉取流量 |
| 本地 `/data/backup-local` 超 3 天的备份 | 自动轮转（脚本已含） | 省 12GB 数据盘 |
| 日志超保留期未归档的文件 | 归档后删除 | 省磁盘 |
| 未在用的第三方套餐 / 免费额度转付费项 | 关闭（如 Sentry 超限先降采样而非付费） | 0~200 元/月 |
| 非工作时段的测试/预发环境 | **本项目无独立测试云环境**（开发本地跑，V1.1 若引入则 22:00-08:00 定时关机） | 预留 60% 环境成本节省空间 |

### 9.5 成本优化补充项

1. **静态资源全量 CDN 化**：`/_next/static`、`/fonts`、PDF 常用封面图 → 回源带宽是隐藏大头；
2. **ISR 而非 SSR**：政策内容页与 FAQ 用 ISR（`revalidate=3600`），把回源 QPS 压到最低，直接等于省 CPU 与带宽；
3. **PDF 产物 30 天 TTL**：避免 COS 存储无限累积（设计已自带）；
4. **按量与包年组合**：主机用包年包月（便宜 30%+），突发用按天升配，避免全量按量；
5. **带宽与 CDN 二选一的决策点**：当 CDN 月流量费用 > 带宽升级费用时，优先升带宽；反之用 CDN（每月 G-5/G-6 数据支撑该决策）。

---

## 10. 运维 Runbook 清单与巡检清单

### 10.1 Runbook 清单（与 §5 应急预案一一对应，打印置顶）

| Runbook | 名称 | 对应预案 | 核心第一条命令 | 目标恢复 |
|---------|------|----------|----------------|----------|
| R-01 | 数据库故障/损坏 | §5.1 | `docker compose stop app && docker logs mysql --tail 300` | ≤60min |
| R-02 | Redis 不可用降级 | §5.2 | `docker compose restart redis` → 确认 app 日志 `redis.degraded.active` | 业务 0 中断 |
| R-03 | 数据误删 PITR | §5.3 | `feature_flag set read_only true` → 定位 T → binlog 回放 | ≤30min |
| R-04 | 磁盘写满 | §5.4 | `python3 scripts/ops/disk_guard.py --auto` | ≤15min |
| R-05 | PDF 队列积压/OOM | §5.5 | `export_queue_pause=true` → 杀 Chromium → 清 tmp | ≤30min |
| **R-06** | **规则包错误（最高危）** | §5.6 | `python3 scripts/ops/rulepack_rollback.py --to <ver>` | **≤5min 停损** |
| R-07 | 短链服务异常 | §5.7 | 查 `SNAPSHOT_MASTER_KEY` 多版本共存 | ≤30min |
| R-08 | COS 不可用 | §5.8 | `feature_flag set storage_fallback local` | ≤20min |
| R-09 | 证书过期 | §5.9 | `certbot renew --force-renewal --webroot -w /var/www/certbot` | ≤30min |
| R-10 | DDoS/爬虫暴刷 | §5.10 | `python3 scripts/ops/anti_abuse.py --auto-ban` | 核心链路不断 |
| R-11 | TTL 清理任务异常 | §5.11 | `ttl_cleanup.py --dry-run` → `--execute` | 当日 |
| **R-12** | **疑似数据泄露** | §5.12 | 隔离日志 → 禁用账号 → **1h 内止损** → 合规时钟启动 | ≤1h 止损 |
| R-13 | 合规投诉/内容错误 | §5.13 | `content_guard.py` → 内容回滚 + PM-1 统一口径 | ≤4h |
| R-14 | 应用崩溃/反复重启 | §5.14 | 看 ExitCode → 回滚 `<上一 IMAGE_TAG>` | ≤30min |
| R-15 | 整机重建 | §5.15 | 新建主机 → 快照/COS 恢复 → `compose up` → **更新 IP 白名单** → 切 DNS | ≤4h |

### 10.2 巡检清单（日 / 周 / 月 / 季 / 半年）

**每日（OPS-1，建议 09:00 前完成，耗时 ≤10min）**

| # | 检查项 | 方法 | 通过标准 | 不通过怎么办 |
|---|--------|------|----------|--------------|
| 1 | 昨夜备份成功 | 看 Kuma #9 + `tail /data/logs/ops/backup-manifest.jsonl` | 有昨日记录且 sha256 存在 | **按 P0 处理**：立刻补跑一次备份 |
| 2 | 备份已上传异地 | `coscli ls cos://hitech-backup/mysql/$(date +%Y/%m)` | 存在对应对象 | 同上 |
| 3 | 全站拨测绿灯 | Kuma #1/#2 + 外部拨测 | 全绿 | 按 R-14 → R-15 |
| 4 | 昨日告警是否有未闭环 | IM 值班群 | 无未认领告警 | 立即补认领并处理 |
| 5 | 错误率与延迟 | `app_metrics.py --daily` | 5xx <1%，算分 P95 <800ms | 按 P-01/P-03 处置 |
| 6 | Sentry 新增 issue | Sentry 面板 | 无非预期 New Issue | 派单给 DEV-1 |
| 7 | 磁盘/内存水位 | `python3 scripts/ops/host_metrics.py` | 磁盘 <80%，内存可用 >500MB | 按 A-05/A-03 |
| 8 | **规则正确性（红线）** | `rulepack_guard.py --deep` 日报 | **diff = 0** | **按 R-06 最高危处理** |
| 9 | 日志脱敏扫描 | `log_leak_scan.py` 结果 | 命中 0 | 按 R-12 |
| 10 | TTL 清理任务 | B-10 告警状态 | 已成功 | 按 R-11 |
| 11 | 昨日业务指标 | IM 日报（DAU/完成率/导出数/预检通过率/平均分） | 在基线 ±阈值内 | 按 B 类告警逐条查 |

**每周（每周一 10:00，OPS-1 + DEV-1，≤30min）**

1. 值班交接：未闭环告警 / 进行中故障 / 待观察变更；
2. 安全补丁与 CVE 通告核对（`apt list --upgradable` + `trivy image <running>`）；
3. 异常登录/暴力破解日志抽查（`grep "Failed password" /var/log/auth.log` + fail2ban 封禁清单复核 **防误封**）；
4. 错误预算消耗核对（`slo_report.py --weekly`）；
5. Sentry 额度用量核对（>80% 即降采样）；
6. `pnpm audit` 结果 review + Dependabot PR 清理；
7. **成本周报**（当前累计 vs 预算进度）。

**每月（每月 1 日，OPS-1 + PM-1，≤1h）**

1. **资源与账单盘点 + 闲置回收**（§9.4），输出清单并当周清理；
2. **告警规则调优**：统计上月告警数、误报率，**误报率 >30% 的规则必须调整**；
3. **证书/域名有效期核对**（≤30 天即排期）；
4. **备份恢复性自动校验**（`restore_verify.py`）结果归档；
5. **SLO 与错误预算月报**（`slo_report.py --monthly`），未达标须附改进计划；
6. 全流程盘点：备份/演练/权限/密钥清单/联系方式有效性（人员变动立即更新 `CONTACTS.md`）；
7. 容量复核：对照 §2.6 阈值判断是否触发扩容评估。

**每季度（OPS-1 主导，2~3h）**

1. **全流程恢复演练（含 PITR）**，实测 RTO/RPO 并记录（§6.6）；
2. **P0 应急桌面推演**：至少推演 R-06（规则包错误）与 R-15（整机重建）两个场景；
3. 告警有效性验证：人为触发性地验证至少 3 条告警（如临时起一个占 CPU 的任务验证 A-01/A-02），确认"告警真的会响、能到正确的渠道和人"；
4. 权限盘点：admin 账号、SSH 账号、IM 群成员；
5. 依赖/PDF/节假日容量预案更新（为下个申报季做准备）。

**每半年 / 每年**

- 每半年：密钥轮换（§8.5）+ 权限盘点 + 异地副本恢复演练；
- 每年（**建议 3 月，申报季之前**）：整机重建演练 + 容量压测 + 本方案年度复审。

### 10.3 V1.1 引入账号体系后的运维增量

| 维度 | V1.0 | **V1.1 增量（账号/会话/可能的短信）** | 增量工作 |
|------|------|--------------------------------------|----------|
| **依赖强度** | Redis **可降级** | 若会话存 Redis → **Redis 升级为强依赖** | **必须先做**：Redis 开启 AOF + 监控升级；或会话存 DB/JWT，保持可降级。二者必选其一，不可"既强依赖又无持久化" |
| 新监控项 | — | ① **注册/登录成功率**（<95% → P1；<80% → P0，等同"支付成功率"级别）② 短信发送成功率（<95% → P1）+ **通道余额告警**（余额 <3 天用量 → P2；<1 天 → P1）③ 验证码请求量异常（>基线 3 倍 → P1，疑似短信轰炸）④ 会话失效/踢线率 ⑤ 账号删除请求量与完成时长 | 新增 ≥6 条告警，全部要有阈值/时长/渠道/负责人 |
| 成本护栏 | 500 元/月 | 短信按条计费是**最易失控**项 | 增加：**单日短信 >300 条（≈预算 10%）→ P1**；单账号单日验证码 ≤5 次；同一 IP 单日 ≤20 次；图形验证码前置 |
| 安全 | 无登录 | 引入**撞库/爆破/批量注册**风险 | Nginx 登录接口 `rate=1r/10s` + IP 限流 + 失败锁定 + **异地登录提醒** + 密码找回链路的枚举攻击防护 |
| 个人信息合规 | 无手机号 | 手机号 = 个人信息 | ① 单独同意 + 最小必要 ② `phone_enc` + HMAC 盲索引（schema 已预留）③ **删除名单（tombstone）机制**：用户注销后把 `phone_blind_idx` 写入删除名单，**恢复数据时不得让已注销用户复活**（这是最容易被忽略的合规 bug）④ 删除请求 **15 个工作日内**完成并留痕 |
| 备份与恢复 | RPO ≤15min | 用户表纳入备份；**恢复流程必须核验删除名单** | 更新 `restore_verify.py`：加"恢复后删除名单内的用户不得重新出现"一条断言 |
| 审计 | 后台操作 | 增加用户登录/登出/改绑/注销全量审计 | `audit_logs` 留存不变（≥180 天），但可考虑在线保留延长至 1 年 |
| 多实例 | 无 | 会话共享是多实例化的前置 | 与 T-3（水平扩容）合并评估：先做"无状态化 + Redis 强依赖"，再谈扩容 |
| SLA | 99.5% | 登录链路建议 ≤99.5%（内部）；对外承诺保持 99.5% 不变 | — |

---

## 11. 需上报团长决策的冲突与遗留风险

> 按职责要求：发现部署形态与监控/保障方案冲突时，给出替代观测方案并**明确上报团长**。以下 6 项需团长裁决或至少知悉。

| # | 冲突/风险 | 影响 | 本方案已给的替代方案 | 建议决策 |
|---|-----------|------|----------------------|----------|
| **C-1** | **Uptime Kuma 与业务同机部署**：主机宕机时 Kuma 一并失联，告警不可达（§1.5） | 最坏情况：全站挂了但没人知道，用户先于运维发现 | 已补齐 **UptimeRobot 免费额度（境外节点，5min）+ 云厂商两地拨测（1min，免费）** + 云监控 Agent + Sentry，**成本 0 元** | **请团长确认采纳**并批准"外部拨测为可用性 SLO 的最终裁定数据源"（§7.1 S1） |
| **C-2** | Redis 单实例无持久化且无主从，多实例前不得变为强依赖（架构债） | V1.1 若把会话放进 Redis 会成为新单点 | 已给：保持"可降级"设计 + 降级期间导出队列暂停 + 明确写入**架构债清单**；V1.1 账号体系上线前必须解决（§10.3） | **请团长把这一条作为 V1.1 的前置条件**（建议会话不落 Redis，或同时开启 AOF） |
| **C-3** | 单机无法承载 ≥99.9% SLA；可用区故障只能靠重建（RTO ≤4h） | 对外不能承诺更高等保 | 已给：对外只承诺 **99.5%**（≈3.6h/月错误预算），并写清"计划内维护/不可抗力不计入" | **请团长确认对外文案口径**，避免市场侧过度承诺 |
| **C-4** | 无 Prometheus/Grafana，指标靠 pino + python3 脚本聚合 | 排障效率与图形化弱于标准栈 | 已给：脚本化日报 + 云控制台 + Sentry + Kuma；触发条件 T-6（≥3 实例或 ≥3 人团队）后引入 | 建议 V1.1 评估是否提前引入轻量 Prometheus（成本 0，占用 ~300MB 内存 —— **2C4G 下不建议**，需升配） |
| **C-5** | 规则包发布无原生灰度能力（单机单版本） | 规则一旦发布即影响 100% 用户，属于本项目最高危操作 | 已给替代方案：**影子复算 diff 报告（双签）+ 发布后 30min 分布哨兵 + 自动回滚**（§7.4 / B-09），等于用"离线灰度 + 在线秒级回滚"替代传统灰度 | **请团长批准"规则变更必须 RULE-1 + 外部政策顾问双签"**这一流程约束（会带来响应时间成本，但这是防止误导用户决策的必要代价） |
| **C-6** | COS 产物 30 天生命周期自动删除且**不备份**；快照短链 token 不落库导致密文**技术上不可离线恢复** | 用户可能误以为"云端永久保存" | 已给：UI 必须明示到期日 + 引导下载 PDF 自存 + 一键删除 | **请团长推动产品侧确认 UI 文案与免责说明**（属 PRD 职责，运维已提示） |

### 11.1 给下游与协作方的输出（交付接口）

| 输出对象 | 交付内容 | 用途 |
|----------|----------|------|
| **增长运营师** | ① 容量模型与换算公式（§2.2）② 活动报备契约：**提前 7 天**、峰值 QPS >25 或 日导出 >600 份必须提前 5 个工作日扩容 ③ 季节性日历（3/15 前完成旺季扩容） | 大促/投放前的容量评估依据 |
| **全栈研发师（DEV）** | 观测接口需求清单（§3.5：healthz/readyz/metrics/feature-flags/发布 hook）、脱敏字段清单（§4.3）、日志字段规范（§4.2）、CI 安全门禁（§8.2） | 反哺 Phase 1 架构演进；这些是**上线前必须完成**的 P0 项 |
| **上线发布师** | 变更窗口（§7.3）、回滚预案衔接（`IMAGE_TAG` 回滚 <5min）、发布后 72h 观察期 | 与 Phase 3 发布方案对齐 |
| **团长** | 本节 6 项待决策 + 月度 SLO/成本报告 + 季度演练报告 | 决策与风险控制 |

---

## 12. 上线前运维就绪清单（Go / No-Go）

> 以下任一项未完成，**运维侧不出具上线同意意见**。

| # | 就绪项 | 负责角色 | 完成判定 |
|---|--------|----------|----------|
| 1 | `healthz` / `readyz` / `metrics` 三个端点可用且有保护 | DEV-1 | 本地调用返回正确 |
| 2 | pino 结构化日志 + redact 清单落地，`log_leak_scan.py` CI 通过 | DEV-1 | PR 上 CI 绿 |
| 3 | Uptime Kuma 13 个监视器 + 外部拨测（≥2 地）配置完成 | OPS-1 | 人为触发验证告警可达 |
| 4 | A/P/B 三类共 37 条告警规则全部配置并**逐条做过触发验证** | OPS-1 | 验证记录表签字 |
| 5 | 联系人与值班表真实填充（`CONTACTS.md` 置顶 IM） | PM-1 | — |
| 6 | 备份链路跑通：全备 + binlog + 异地 + 加密 + manifest | OPS-1 | 连续 3 天成功且 sha256 可校验 |
| 7 | **`restore_verify.py` 至少通过 1 次**（含异地副本） | OPS-1 | 输出 PASS |
| 8 | 规则包三重门禁就绪：CI 回归 + 影子复算 + 30min 哨兵自动回滚 | DEV-1 + RULE-1 | 演练一次：故意注入错误 -> 哨兵触发 -> 自动回滚成功 |
| 9 | 降级开关可用：`read_only` / `pdf_service` / `maintenance` / `storage_fallback` | DEV-1 | 逐个演练生效 |
| 10 | 安全基线核对：安全组、SSH 加固、后台 TOTP + IP 白名单、`.env` 600 权限、密钥清单归档 | OPS-1 | 逐项打勾 |
| 11 | 成本护栏 8 条配置完成（含日账单与月预算告警） | OPS-1 | 控制台截图 |
| 12 | 15 份 Runbook 打印并张贴 / 文档置顶 | OPS-1 | — |
| 13 | 压测：验证 §2.2 容量模型，2C4G 下 `PDF_CONCURRENCY=1` 稳定 | DEV-1 + OPS-1 | 压测报告 |
| 14 | 日志保留期与磁盘水位联动脚本生效 | OPS-1 | 模拟写满验证自动清理 |

---

> 本方案与 Phase 1《技术研发方案》口径一致，未引入冲突架构；所有对外承诺值（99.5% 可用性、P95 ≤800ms、RPO ≤15min、RTO ≤60min）均**低于或等于实际能力**，且均可通过脚本度量。
> 月度运维报告模板：`python3 scripts/ops/slo_report.py --monthly`（含 SLO 达成、错误预算消耗、告警统计、故障清单、成本明细、容量趋势六部分）。

[运维保障方案]
