/* =============================================================================
 * @hitech/rule-engine  ·  高新技术企业认定创新能力评分规则引擎
 * 政策依据：《高新技术企业认定管理办法》（国科发火〔2016〕32号）
 *          《高新技术企业认定管理工作指引》（2016版）
 * 规则配置化：所有档位、上限、边界条件均在 POLICY 中配置，改规则不改代码。
 * 纯 JS 无依赖，浏览器与 Node 双端复用（双端一致性是硬门禁）。
 * ========================================================================= */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------------------
   * 1. 政策规则配置（唯一事实来源）
   * ------------------------------------------------------------------------ */
  var POLICY = {
    policy_version: 'national-2016',
    version_label: '2016 版（国科发火〔2016〕32 号）',
    effective_date: '2016-01-01',
    pack_updated_at: '2026-10-09',
    source: '《高新技术企业认定管理办法》（国科发火〔2016〕32号）及《高新技术企业认定管理工作指引》',
    region_code: 'national',           // 地区规则包预留，V1.0 不启用
    pass_score: 70,
    pass_rule: '综合得分 >70 分（不含70分）为符合认定要求；各级指标按整数打分，整数口径即 ≥71 分',
    total: 100,

    // 指标定义
    indicators: [
      { key: 'ip',         name: '知识产权',             max: 30 },
      { key: 'transform',  name: '科技成果转化能力',      max: 30 },
      { key: 'rdmgmt',     name: '研究开发组织管理水平',  max: 20 },
      { key: 'growth',     name: '企业成长性',            max: 20 }
    ],

    /* 知识产权（≤30，加分后本指标总分不超过 30） */
    ip: {
      cap: 30,
      items: [
        { key: 'advanced', name: '技术的先进程度', max: 8,
          bands: { A: [7, 8], B: [5, 6], C: [3, 4], D: [1, 2], E: [0, 0] },
          labels: { A: '高', B: '较高', C: '一般', D: '较低', E: '无' },
          tip: '自主研发的发明专利（Ⅰ类）在此项通常更易获得高档；但技术特性只能申请实用新型的除外。' },
        { key: 'support', name: '对主要产品(服务)在技术上发挥核心支持作用', max: 8,
          bands: { A: [7, 8], B: [5, 6], C: [3, 4], D: [1, 2], E: [0, 0] },
          labels: { A: '强', B: '较强', C: '一般', D: '较弱', E: '无' },
          tip: '须对核心产品(服务)形成实际技术支撑，与主营产品无关的知识产权不予计分。' },
        { key: 'count', name: '知识产权数量', max: 8, computed: true,
          bands: { A: [7, 8], B: [5, 6], C: [3, 4], D: [1, 2], E: [0, 0] },
          rule_note: 'Ⅰ类≥1项→A档；无Ⅰ类时按Ⅱ类：≥5项→B档、3~4项→C档、1~2项→D档、0项→0分。Ⅱ类仅限使用一次（复审/重新认定须剔除已用项）；专利以授权证书为准。' },
        { key: 'acquisition', name: '知识产权获得方式', max: 6,
          bands: { A: [1, 6], B: [1, 3], E: [0, 0] },
          labels: { A: '有自主研发', B: '仅有受让、受赠和并购等', E: '无' },
          practice_note: '官方区间 A 档为 1-6 分、B 档为 1-3 分（下界均为 1）。实务参考：自主研发（权属清晰、首次使用、与主营产品相关）常见 4-6 分；受让/受赠/并购常见 1-2 分。实务参考值仅作展示，不进主分。',
          practice_value: { A: 4, B: 2, E: 0 } },
        { key: 'standard', name: '参与编制国家标准/行业标准/检测方法/技术规范（加分项）', max: 2,
          bands: { A: [1, 2], B: [0, 0] },
          labels: { A: '是', B: '否' },
          tip: '加分后"知识产权"总分不超过 30 分；相关标准、方法和规范须经国家有关部门认证认可。' }
      ],
      class_I: '发明专利（含国防专利）、植物新品种、国家级农作物品种、国家新药、国家一级中药保护品种、集成电路布图设计专有权',
      class_II: '实用新型专利、外观设计专利、软件著作权（不含商标）'
    },

    /* 科技成果转化能力（≤30） */
    transform: {
      cap: 30,
      bands: [
        { key: 'A', min: 5,      score: [25, 30], label: '转化能力强' },
        { key: 'B', min: 4,      score: [19, 24], label: '转化能力较强' },
        { key: 'C', min: 3,      score: [13, 18], label: '转化能力一般' },
        { key: 'D', min: 2,      score: [7, 12],  label: '转化能力较弱' },
        { key: 'E', min: 1,      score: [1, 6],   label: '转化能力弱' },
        { key: 'F', min: 0,      score: [0, 0],   label: '转化能力无' }
      ],
      divisor_rule: '年平均数 = 转化总数 ÷ N；N = 实际经营年数（满3年÷3，不满3年÷实际经营整年数，刚满1年÷1）',
      dedupe_rule: '同一科技成果在国内外转化，或转化为多个产品/服务/工艺/样品/样机的，只计为一项'
    },

    /* 研究开发组织管理水平（≤20）：按《工作指引》六档分数比例换算为整数区间 */
    rdmgmt: {
      cap: 20,
      ratio_bands: { A: [0.80, 1.00], B: [0.60, 0.79], C: [0.40, 0.59], D: [0.20, 0.39], E: [0.01, 0.19], F: [0, 0] },
      band_labels: { A: '完备（制度健全且有执行证据）', B: '较完备', C: '一般', D: '较薄弱', E: '薄弱', F: '无' },
      items: [
        { key: 'm1', max: 6, name: '制定研发组织管理制度 + 建立研发投入核算体系 + 编制研发费用辅助账', evidence: '研发管理制度文件、研发投入核算办法、研发费用辅助账' },
        { key: 'm2', max: 6, name: '设立内部研发机构并具备科研条件 + 开展多种形式产学研合作', evidence: '研发机构设立文件、设备清单、产学研合作协议' },
        { key: 'm3', max: 4, name: '建立科技成果转化组织实施与激励奖励制度 + 建立开放式创新创业平台', evidence: '成果转化激励制度、创新创业平台说明' },
        { key: 'm4', max: 4, name: '建立科技人员培养进修、职工技能培训、优秀人才引进及人才绩效评价奖励制度', evidence: '人才培养与绩效评价奖励制度文件' }
      ]
    },

    /* 企业成长性（≤20） */
    growth: {
      cap: 20,
      net_asset: { max: 10, name: '净资产增长率', formula: '1/2 ×（第二年末净资产÷第一年末净资产 ＋ 第三年末净资产÷第二年末净资产）− 1' },
      revenue:   { max: 10, name: '销售收入增长率', formula: '1/2 ×（第二年销售收入÷第一年销售收入 ＋ 第三年销售收入÷第二年销售收入）− 1' },
      bands: [
        { key: 'A', min: 0.35, score: [9, 10] },
        { key: 'B', min: 0.25, score: [7, 8] },
        { key: 'C', min: 0.15, score: [5, 6] },
        { key: 'D', min: 0.05, score: [3, 4] },
        { key: 'E', min: 0,    score: [1, 2] },
        { key: 'F', min: -Infinity, score: [0, 0] }
      ],
      biz_years_rule: 'biz_years ∈ {1,2,3} 三态；≥3 用两段公式，v1=0 按后两年（v3/v2−1），v2=0 记 0；=2 单段降维 g=v2/v1−1；=1 整体 0 分；增长率<0 按 0 分'
    },

    /* 前置资格预检（一票否决） */
    precheck: [
      { key: 'establish', name: '注册成立一年以上', rule: '须 ≥365 个日历天数' },
      { key: 'ip',        name: '拥有核心自主知识产权', rule: '不具备知识产权不能认定为高新技术企业' },
      { key: 'field',     name: '主要产品(服务)属于《国家重点支持的高新技术领域》', rule: '技术领域须在目录范围内' },
      { key: 'staff',     name: '科技人员占当年职工总数 ≥10%', rule: '科技人员须累计实际工作 ≥183 天' },
      { key: 'rd',        name: '研发费用占销售收入比例达标', rule: '最近一年销售收入<5000万(含)→5%；5000万~2亿(含)→4%；>2亿→3%（近三个会计年度合计口径）' },
      { key: 'rd_cn',     name: '境内研发费用占全部研发费用总额 ≥60%', rule: '境内外研发费用口径' },
      { key: 'hitech_rev',name: '高新技术产品(服务)收入占同期总收入 ≥60%', rule: '申报前一个年度口径' },
      { key: 'accident',  name: '申请前一年未发生重大安全/重大质量事故或严重环境违法行为', rule: '一票否决' }
    ],

    rd_ratio: [
      { maxRevenue: 50000000,     ratio: 0.05, label: '最近一年销售收入 <5000 万元（含）' },
      { maxRevenue: 200000000,    ratio: 0.04, label: '5000 万元 ~ 2 亿元（含）' },
      { maxRevenue: Infinity,     ratio: 0.03, label: '2 亿元以上' }
    ],

    disclaimer: '本系统依据公开发布的政策文件对创新能力评价指标进行自评测算，结果仅供参考，不构成官方认定结论，不承诺通过。最终以认定机构评审结论为准。'
  };

  /* ---------------------------------------------------------------------------
   * 2. 工具函数
   * ------------------------------------------------------------------------ */
  function num(v) { var n = typeof v === 'number' ? v : parseFloat(v); return isFinite(n) ? n : null; }
  function clampLo(v, max) { return Math.min(v, max); }
  function pct(v) { return (v * 100).toFixed(2) + '%'; }

  // 按比例档换算整数区间（用于研究开发组织管理水平）
  function bandToRange(max, band) {
    var rb = POLICY.rdmgmt.ratio_bands[band];
    if (!rb || rb[1] === 0) return [0, 0];
    var lo = Math.max(1, Math.floor(max * rb[0]));
    var hi = Math.max(lo, Math.floor(max * rb[1]));
    return [Math.min(lo, max), Math.min(hi, max)];
  }

  /* ---------------------------------------------------------------------------
   * 3. 企业成长性：三态 biz_years ∈ {1,2,3}（禁止布尔参数）
   * ------------------------------------------------------------------------ */
  function growthRate(v1, v2, v3, bizYears) {
    var a1 = num(v1), a2 = num(v2), a3 = num(v3);
    var biz = (bizYears === 1 || bizYears === 2) ? bizYears : 3;
    var g = 0, edge = '';

    if (biz === 1) {
      return { value: 0, band: 'F', score: [0, 0], edge: 'BIZ_1Y', note: '实际经营期刚满一年，成长性指标按 0 分计算' };
    }
    if (biz === 2) {
      if (!(a1 > 0)) {
        return { value: 0, band: 'F', score: [0, 0], edge: 'NO_BASE', note: '第一年基数缺失或为 0，无可用替代段，按 0 分计' };
      }
      if (a2 === null) {
        return { value: 0, band: 'F', score: [0, 0], edge: 'NO_DATA', note: '第二年数据缺失，按 0 分计' };
      }
      g = a2 / a1 - 1; edge = 'BIZ_2Y_SINGLE';
    } else {
      if (a1 === null || a2 === null || a3 === null) {
        return { value: 0, band: 'F', score: [0, 0], edge: 'NO_DATA', note: '三年数据不完整，按 0 分计' };
      }
      if (!(a1 > 0)) {
        if (a2 > 0) { g = a3 / a2 - 1; edge = 'FIRST_ZERO'; }
        else { return { value: 0, band: 'F', score: [0, 0], edge: 'NO_BASE', note: '第一年末与第二年末数据均不可用，按 0 分计' }; }
      } else if (!(a2 > 0)) {
        return { value: 0, band: 'F', score: [0, 0], edge: 'SECOND_ZERO', note: '第二年末数据为 0，按政策按 0 分计算' };
      } else {
        g = 0.5 * (a2 / a1 + a3 / a2) - 1; edge = 'NORMAL';
      }
    }
    if (g < 0) { g = 0; edge = 'NEGATIVE'; }

    // 政策口径：>0 才可能得 1-2 分，≤0 一律 0 分（g 恰为 0 时归 F 档）
    var band = 'F';
    if (g > 0) {
      for (var i = 0; i < POLICY.growth.bands.length; i++) {
        var bd = POLICY.growth.bands[i];
        if (bd.min === 0) { band = 'E'; break; }   // E 档：>0
        if (g >= bd.min) { band = bd.key; break; }
      }
      if (band === 'E') {
        for (var j = 0; j < POLICY.growth.bands.length; j++) {
          var b2 = POLICY.growth.bands[j];
          if (b2.min > 0 && g >= b2.min) { band = b2.key; break; }
        }
      }
    }
    var score = POLICY.growth.bands.filter(function (b) { return b.key === band; })[0].score.slice();
    score = [Math.min(score[0], 10), Math.min(score[1], 10)];
    return { value: g, band: band, score: score, edge: edge, note: '' };
  }

  /* ---------------------------------------------------------------------------
   * 4. 知识产权
   * ------------------------------------------------------------------------ */
  function effectiveAssets(assets, declareType) {
    var isReReview = declareType === 'review';
    return (assets || []).filter(function (a) {
      if (!a || !a.authorized) return false;
      if (isReReview && a.usedBefore) return false;   // Ⅱ类仅限使用一次
      return true;
    });
  }

  function ipCountBand(eff) {
    var cI = eff.filter(function (a) { return a.cls === 'I'; }).length;
    var cII = eff.filter(function (a) { return a.cls === 'II'; }).length;
    var band = 'E', detail = '';
    if (cI >= 1) { band = 'A'; detail = 'Ⅰ类 ' + cI + ' 项（Ⅱ类 ' + cII + ' 项）'; }
    else if (cII >= 5) { band = 'B'; detail = '无Ⅰ类；Ⅱ类 ' + cII + ' 项'; }
    else if (cII >= 3) { band = 'C'; detail = '无Ⅰ类；Ⅱ类 ' + cII + ' 项'; }
    else if (cII >= 1) { band = 'D'; detail = '无Ⅰ类；Ⅱ类 ' + cII + ' 项'; }
    else { band = 'E'; detail = '无有效知识产权'; }
    return { band: band, detail: detail, countI: cI, countII: cII };
  }

  function scoreIP(input) {
    var eff = effectiveAssets(input.assets, input.declareType);
    var cnt = ipCountBand(eff);
    var hasSelfDev = eff.some(function (a) { return a.selfDev; });
    var acq = input.acquisition || (eff.length === 0 ? 'E' : (hasSelfDev ? 'A' : 'B'));

    var items = [];
    var sumLo = 0, sumHi = 0;

    function push(cfgKey, band, extra) {
      var cfg = POLICY.ip.items.filter(function (it) { return it.key === cfgKey; })[0];
      var range = cfg.bands[band] || [0, 0];
      var lo = Math.min(range[0], cfg.max), hi = Math.min(range[1], cfg.max);
      sumLo += lo; sumHi += hi;
      var it = {
        key: cfgKey, name: cfg.name, max: cfg.max, band: band,
        bandLabel: (cfg.labels && cfg.labels[band]) || band,
        range: [lo, hi], practice: cfg.practice_value ? cfg.practice_value[band] : null
      };
      if (extra) { for (var k in extra) it[k] = extra[k]; }
      items.push(it);
    }

    push('advanced', input.advanced || 'E');
    push('support', input.support || 'E');
    push('count', cnt.band, { detail: cnt.detail, computed: true });
    push('acquisition', acq, { auto: !input.acquisition });
    push('standard', input.standard ? 'A' : 'B');

    // 指标级 cap = 30（加分后不超过 30）
    var cap = POLICY.ip.cap;
    var lo = clampLo(sumLo, cap), hi = clampLo(sumHi, cap);
    return {
      key: 'ip', name: '知识产权', max: cap, scoreLo: lo, scoreHi: hi,
      capped: sumHi > cap, rawLo: sumLo, rawHi: sumHi,
      items: items, countI: cnt.countI, countII: cnt.countII, effective: eff.length
    };
  }

  /* ---------------------------------------------------------------------------
   * 5. 科技成果转化能力
   * ------------------------------------------------------------------------ */
  function scoreTransform(input) {
    var total = (input.achievements || []).filter(function (a) { return a && a.name; }).length;
    var biz = (input.bizYears === 1 || input.bizYears === 2) ? input.bizYears : 3;
    var n = biz > 0 ? total / biz : 0;
    var band = POLICY.transform.bands[0];
    for (var i = 0; i < POLICY.transform.bands.length; i++) {
      if (n >= POLICY.transform.bands[i].min) { band = POLICY.transform.bands[i]; break; }
    }
    return {
      key: 'transform', name: '科技成果转化能力', max: POLICY.transform.cap,
      scoreLo: band.score[0], scoreHi: band.score[1],
      band: band.key, bandLabel: band.label, total: total, divisor: biz, average: n,
      items: [{ key: 'transform', name: '近 ' + biz + ' 年科技成果转化年平均数', band: band.key,
                detail: total + ' 项 ÷ ' + biz + ' 年 = ' + n.toFixed(2) + ' 项/年',
                range: band.score }]
    };
  }

  /* ---------------------------------------------------------------------------
   * 6. 研究开发组织管理水平
   * ------------------------------------------------------------------------ */
  function scoreRdmgmt(input) {
    var items = [], sumLo = 0, sumHi = 0;
    POLICY.rdmgmt.items.forEach(function (cfg) {
      var band = (input.rdmgmt && input.rdmgmt[cfg.key]) || 'F';
      var r = bandToRange(cfg.max, band);
      sumLo += r[0]; sumHi += r[1];
      items.push({
        key: cfg.key, name: cfg.name, max: cfg.max, band: band,
        bandLabel: POLICY.rdmgmt.band_labels[band], range: r, evidence: cfg.evidence
      });
    });
    return {
      key: 'rdmgmt', name: '研究开发组织管理水平', max: POLICY.rdmgmt.cap,
      scoreLo: clampLo(sumLo, POLICY.rdmgmt.cap), scoreHi: clampLo(sumHi, POLICY.rdmgmt.cap),
      items: items
    };
  }

  /* ---------------------------------------------------------------------------
   * 7. 企业成长性
   * ------------------------------------------------------------------------ */
  function scoreGrowth(input) {
    var f = input.finance || {};
    var biz = input.bizYears;
    var na = growthRate(f.netAsset1, f.netAsset2, f.netAsset3, biz);
    var rv = growthRate(f.revenue1, f.revenue2, f.revenue3, biz);
    return {
      key: 'growth', name: '企业成长性', max: POLICY.growth.cap,
      scoreLo: clampLo(na.score[0] + rv.score[0], POLICY.growth.cap),
      scoreHi: clampLo(na.score[1] + rv.score[1], POLICY.growth.cap),
      items: [
        { key: 'net_asset', name: POLICY.growth.net_asset.name, max: 10, value: na.value, band: na.band,
          range: na.score, edge: na.edge, note: na.note, detail: isFinite(na.value) ? pct(na.value) : '—' },
        { key: 'revenue', name: POLICY.growth.revenue.name, max: 10, value: rv.value, band: rv.band,
          range: rv.score, edge: rv.edge, note: rv.note, detail: isFinite(rv.value) ? pct(rv.value) : '—' }
      ],
      bizYears: biz
    };
  }

  /* ---------------------------------------------------------------------------
   * 8. 资格预检（一票否决）
   * ------------------------------------------------------------------------ */
  function precheck(input) {
    var e = input.enterprise || {};
    var eff = effectiveAssets(input.assets, input.declareType);
    var res = [];

    // 成立年限
    var days = null;
    if (e.establishDate) {
      days = Math.floor((Date.now() - new Date(e.establishDate + 'T00:00:00').getTime()) / 86400000);
    }
    res.push(mk('establish', days !== null, days !== null ? (days >= 365 ? '已成立 ' + days + ' 天，满足' : '仅成立 ' + days + ' 天，不足 365 天') : '未填写成立日期'));

    res.push(mk('ip', eff.length > 0, eff.length > 0 ? '有效知识产权 ' + eff.length + ' 项' : '无有效知识产权 —— 不能认定为高新技术企业'));

    res.push(mk('field', !!e.fieldOK, e.fieldOK ? '已确认属于国家重点支持的高新技术领域' : '未确认技术领域归属，须核对《国家重点支持的高新技术领域》'));

    var emp = num(e.employeeTotal), tech = num(e.techStaff);
    var staffRatio = (emp > 0 && tech !== null) ? tech / emp : null;
    res.push(mk('staff', staffRatio !== null && staffRatio >= 0.10,
      staffRatio !== null ? '科技人员 ' + tech + ' / 职工总数 ' + emp + ' = ' + pct(staffRatio) + (staffRatio >= 0.10 ? '，满足' : '，低于 10%') : '未填写人员数据'));

    // 研发费用占比
    var rd3 = num(e.rdExpense3y), rev3 = num(e.revenue3y), revRecent = num(e.revenueRecent);
    var ratioCfg = POLICY.rd_ratio[2];
    if (revRecent !== null) {
      for (var i = 0; i < POLICY.rd_ratio.length; i++) {
        if (revRecent <= POLICY.rd_ratio[i].maxRevenue) { ratioCfg = POLICY.rd_ratio[i]; break; }
      }
    }
    var rdRatio = (rd3 !== null && rev3 > 0) ? rd3 / rev3 : null;
    res.push(mk('rd', rdRatio !== null && rdRatio >= ratioCfg.ratio,
      rdRatio !== null ? '研发费用 ' + rd3 + ' ÷ 销售收入 ' + rev3 + ' = ' + pct(rdRatio) + '（适用档：' + ratioCfg.label + '，要求 ' + pct(ratioCfg.ratio) + '）' : '未填写近三年研发费用与销售收入'));

    var rdCn = num(e.rdExpenseDomestic), rdAll = num(e.rdExpenseTotal);
    var cnRatio = (rdCn !== null && rdAll > 0) ? rdCn / rdAll : null;
    res.push(mk('rd_cn', cnRatio !== null && cnRatio >= 0.60,
      cnRatio !== null ? '境内研发费用占比 ' + pct(cnRatio) + (cnRatio >= 0.60 ? '，满足' : '，低于 60%') : '未填写境内研发费用'));

    var ht = num(e.highTechRevenue), tt = num(e.totalRevenue);
    var htRatio = (ht !== null && tt > 0) ? ht / tt : null;
    res.push(mk('hitech_rev', htRatio !== null && htRatio >= 0.60,
      htRatio !== null ? '高新收入占比 ' + pct(htRatio) + (htRatio >= 0.60 ? '，满足' : '，低于 60%') : '未填写高新技术产品(服务)收入与总收入'));

    res.push(mk('accident', !!e.noAccident, e.noAccident ? '已确认申请前一年无重大安全/质量事故与严重环境违法' : '未确认；存在一票否决风险'));

    function mk(key, ok, detail) {
      var cfg = POLICY.precheck.filter(function (p) { return p.key === key; })[0];
      return { key: key, name: cfg.name, rule: cfg.rule, ok: ok, detail: detail };
    }
    return { items: res, passed: res.every(function (r) { return r.ok; }), blocked: res.filter(function (r) { return !r.ok; }) };
  }

  /* ---------------------------------------------------------------------------
   * 9. 整改建议（按可提升收益排序）
   * ------------------------------------------------------------------------ */
  function suggest(result, input) {
    var list = [];

    // 一票否决优先
    result.precheck.blocked.forEach(function (b) {
      list.push({ level: 'P0', title: '【一票否决】' + b.name, action: b.detail, gain: '不解决则无法认定', editable: 'precheck' });
    });

    // 知识产权数量
    var cntItem = result.indicators.ip.items.filter(function (i) { return i.key === 'count'; })[0];
    if (cntItem && cntItem.band !== 'A') {
      if (result.indicators.ip.countI === 0) {
        list.push({ level: 'P1', title: '布局Ⅰ类知识产权（发明专利等）', action: 'Ⅰ类知识产权 ≥1 项即可将"数量"子项提升至 [7,8] 档', gain: '+' + (7 - cntItem.range[0]) + ' ~ ' + (8 - cntItem.range[1]) + ' 分', editable: 'ip' });
      }
      var need = 5 - result.indicators.ip.countII;
      if (need > 0) {
        list.push({ level: 'P1', title: '补充Ⅱ类知识产权至 5 项（软著/实用新型）', action: '当前Ⅱ类 ' + result.indicators.ip.countII + ' 项，需再增 ' + need + ' 项；软件著作权登记周期 1~3 个月，可快速补齐', gain: '+' + Math.max(0, 5 - cntItem.range[0]) + ' ~ ' + Math.max(0, 6 - cntItem.range[1]) + ' 分', editable: 'ip' });
      }
    }
    // 知识产权主观项
    ['advanced', 'support'].forEach(function (k) {
      var it = result.indicators.ip.items.filter(function (i) { return i.key === k; })[0];
      if (it && (it.band === 'C' || it.band === 'D' || it.band === 'E')) {
        list.push({ level: 'P2', title: '强化' + (k === 'advanced' ? '技术先进程度' : '与主营产品的核心支持作用') + '论证', action: '准备查新报告、技术对比分析、专利与产品对应关系说明，形成"专利—技术—产品—收入"证据链', gain: '+2 ~ +4 分', editable: 'ip' });
      }
    });
    // 标准加分
    if (!input.standard) {
      list.push({ level: 'P2', title: '参与编制国家标准/行业标准/检测方法/技术规范', action: '作为参考条件加分项，须经国家有关部门认证认可', gain: '+1 ~ +2 分（加后知识产权总分不超 30）', editable: 'ip' });
    }
    // 成果转化
    var t = result.indicators.transform;
    if (t.band !== 'A') {
      var target = Math.ceil(5 * t.divisor) - t.total;
      list.push({ level: 'P1', title: '补充科技成果转化证据至年均 5 项', action: '当前 ' + t.total + ' 项 ÷ ' + t.divisor + ' 年 = ' + t.average.toFixed(2) + ' 项/年；需再补约 ' + Math.max(0, target) + ' 项（可用销售合同、检测报告、样品样机、用户报告等佐证；注意同一成果多形式转化只计 1 项）', gain: '+' + Math.max(0, 25 - t.scoreLo) + ' ~ ' + Math.max(0, 30 - t.scoreHi) + ' 分', editable: 'transform' });
    }
    // 组织管理（性价比最高）
    result.indicators.rdmgmt.items.forEach(function (it) {
      if (it.band === 'C' || it.band === 'D' || it.band === 'E' || it.band === 'F') {
        list.push({ level: 'P1', title: '补齐组织管理材料：' + it.name.slice(0, 18) + '…', action: it.evidence + '（本项满分 ' + it.max + ' 分，制度类材料补齐即可提档）', gain: '+' + (it.max - it.range[0]) + ' ~ ' + (it.max - it.range[1]) + ' 分', editable: 'rdmgmt' });
      }
    });
    // 成长性（不可短期改变）
    if (result.indicators.growth.scoreLo < 14) {
      list.push({ level: 'P3', title: '成长性指标短期难以改变', action: '净资产/销售收入增长率由近三年财务数据决定，申报当年无法改变；建议将精力投入知识产权与组织管理两项（合计 50 分）', gain: '—（说明项）', editable: 'growth' });
    }
    return list;
  }

  /* ---------------------------------------------------------------------------
   * 10. 主评估入口
   * ------------------------------------------------------------------------ */
  function assess(input) {
    input = input || {};
    var ip = scoreIP(input);
    var tf = scoreTransform(input);
    var rm = scoreRdmgmt(input);
    var gr = scoreGrowth(input);
    var pc = precheck(input);

    var indicators = { ip: ip, transform: tf, rdmgmt: rm, growth: gr };
    var cons = ip.scoreLo + tf.scoreLo + rm.scoreLo + gr.scoreLo;
    var opti = ip.scoreHi + tf.scoreHi + rm.scoreHi + gr.scoreHi;
    var qualified = cons > POLICY.pass_score;   // >70，整数口径即 ≥71

    var result = {
      policy_version: POLICY.policy_version,
      policy_label: POLICY.version_label,
      policy_source: POLICY.source,
      generated_at: new Date().toISOString(),
      indicators: indicators,
      conservative: cons,
      optimistic: opti,
      qualified: qualified,
      pass_score: POLICY.pass_score,
      gap: qualified ? 0 : (POLICY.pass_score + 1 - cons),   // 整数口径需 ≥71
      precheck: pc,
      suggestions: []
    };
    result.suggestions = suggest(result, input);
    return result;
  }

  /* ---------------------------------------------------------------------------
   * 11. 规则包热更新（remote pack / 本地导入，改政策不改代码）
   * ------------------------------------------------------------------------ */
  var DEFAULT_POLICY = JSON.parse(JSON.stringify(POLICY));   // 出厂基线，用于"恢复默认"

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function deepMerge(target, src) {
    Object.keys(src || {}).forEach(function (k) {
      var sv = src[k];
      if (isObj(sv) && isObj(target[k])) deepMerge(target[k], sv);
      else if (Array.isArray(sv)) target[k] = JSON.parse(JSON.stringify(sv));
      else if (sv !== undefined) target[k] = sv;
    });
    return target;
  }

  /** 应用规则包（增量覆盖）。pack 需含 policy_version；返回是否成功 */
  function applyRulePack(pack) {
    if (!pack || typeof pack !== 'object' || !pack.policy_version) return false;
    deepMerge(POLICY, pack);
    return true;
  }

  /** 导出当前生效规则包（可直接编辑后上传） */
  function exportRulePack() { return JSON.parse(JSON.stringify(POLICY)); }

  /** 恢复出厂规则（不影响填报数据） */
  function resetRulePack() {
    Object.keys(POLICY).forEach(function (k) { delete POLICY[k]; });
    deepMerge(POLICY, DEFAULT_POLICY);
    return exportRulePack();
  }

  /* ---------------------------------------------------------------------------
   * 12. 导出
   * ------------------------------------------------------------------------ */
  var API = {
    POLICY: POLICY,
    DEFAULT_POLICY: DEFAULT_POLICY,
    assess: assess,
    growthRate: growthRate,
    bandToRange: bandToRange,
    ipCountBand: ipCountBand,
    effectiveAssets: effectiveAssets,
    precheck: precheck,
    applyRulePack: applyRulePack,
    exportRulePack: exportRulePack,
    resetRulePack: resetRulePack
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
  root.HT = API;
})(typeof window !== 'undefined' ? window : globalThis);
