/* =============================================================================
 * 高新技术企业认定评分自评系统 · 应用层
 * 依赖：assets/rule-engine.js（window.HT）
 * 设计：PC 优先 / 免登录 / 本地草稿 + 分享链接 / 三处免责声明
 * ========================================================================= */
(function () {
  'use strict';
  var P = HT.POLICY;
  var $ = function (id) { return document.getElementById(id); };
  var STORE_KEY = 'hitech-assess-draft-v1';

  /* ---------------- 状态 ---------------- */
  var state = {
    entName: '', establishDate: '', declareType: 'first', bizYears: 3,
    employeeTotal: null, techStaff: null,
    revenueRecent: null, revenue3y: null, rdExpense3y: null,
    rdExpenseTotal: null, rdExpenseDomestic: null,
    totalRevenue: null, highTechRevenue: null,
    fieldOK: false, noAccident: false,
    assets: [], advanced: 'C', support: 'C', acquisition: '', standard: false,
    achievements: [], rdmgmt: { m1: 'C', m2: 'C', m3: 'C', m4: 'C' },
    finance: { netAsset1: null, netAsset2: null, netAsset3: null, revenue1: null, revenue2: null, revenue3: null }
  };

  var SIMPLE_FIELDS = ['entName', 'establishDate', 'declareType', 'bizYears', 'employeeTotal', 'techStaff',
    'revenueRecent', 'revenue3y', 'rdExpense3y', 'rdExpenseTotal', 'rdExpenseDomestic',
    'totalRevenue', 'highTechRevenue', 'advanced', 'support', 'acquisition'];
  var CHECK_FIELDS = ['fieldOK', 'noAccident', 'standard'];
  var FIN_FIELDS = ['netAsset1', 'netAsset2', 'netAsset3', 'revenue1', 'revenue2', 'revenue3'];

  /* ---------------- 初始化静态文案 ---------------- */
  function initPolicyText() {
    $('policyBadge').textContent = '政策版本 ' + P.policy_version + '（' + P.version_label + '）';
    $('policySource').textContent = P.source;
    $('disclaimerText').textContent = P.disclaimer;
    $('ipRuleNote').textContent = P.ip.items[2].rule_note;
    $('advancedTip').textContent = P.ip.items[0].tip;
    $('supportTip').textContent = P.ip.items[1].tip;
    $('standardTip').textContent = P.ip.items[4].tip;
    $('acqNote').textContent = P.ip.items[3].practice_note;

    // 下拉：先进程度 / 核心支持作用
    ['advanced', 'support'].forEach(function (k) {
      var cfg = P.ip.items.filter(function (i) { return i.key === k; })[0];
      fillSelect($(k), Object.keys(cfg.bands).map(function (b) {
        return { v: b, t: b + '档 · ' + cfg.labels[b] + '（' + cfg.bands[b][0] + '-' + cfg.bands[b][1] + '分）' };
      }));
    });
    // 下拉：获得方式（含自动）
    var acqCfg = P.ip.items[3];
    fillSelect($('acquisition'), [{ v: '', t: '自动判定（依据台账）' }].concat(
      Object.keys(acqCfg.bands).map(function (b) {
        return { v: b, t: b + '档 · ' + acqCfg.labels[b] + '（' + acqCfg.bands[b][0] + '-' + acqCfg.bands[b][1] + '分）' };
      })));

    // 研发组织管理四组
    var html = '';
    P.rdmgmt.items.forEach(function (cfg) {
      html += '<div class="field" style="margin-bottom:16px">' +
        '<label>' + esc(cfg.name) + '　<span class="unit">（≤' + cfg.max + ' 分）</span></label>' +
        '<select data-rm="' + cfg.key + '">' +
        Object.keys(P.rdmgmt.ratio_bands).map(function (b) {
          var r = HT.bandToRange(cfg.max, b);
          return '<option value="' + b + '">' + b + '档 · ' + P.rdmgmt.band_labels[b] + '（' + r[0] + '-' + r[1] + '分）</option>';
        }).join('') + '</select>' +
        '<div class="hint">佐证材料：' + esc(cfg.evidence) + '</div></div>';
    });
    $('rmContainer').innerHTML = html;

    $('bizHint').textContent = P.growth.biz_years_rule;
    $('footNote').innerHTML = '政策依据：' + esc(P.source) + '　|　政策版本：' + P.policy_version +
      '（' + P.version_label + '，生效日期 ' + P.effective_date + '）　|　达标口径：' + esc(P.pass_rule) +
      '<br>' + esc(P.disclaimer);
  }

  function fillSelect(el, opts) {
    el.innerHTML = opts.map(function (o) { return '<option value="' + o.v + '">' + esc(o.t) + '</option>'; }).join('');
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------------- 台账 ---------------- */
  function addAsset(a) {
    state.assets.push(a || { name: '', cls: 'II', authorized: true, selfDev: true, usedBefore: false });
    renderAssets(); compute();
  }
  function renderAssets() {
    var tb = $('ipTable').querySelector('tbody');
    tb.innerHTML = state.assets.map(function (a, i) {
      return '<tr>' +
        '<td><input type="text" data-a="name" data-i="' + i + '" value="' + esc(a.name) + '" placeholder="如：一种XXX装置（ZL2023...）"></td>' +
        '<td><select data-a="cls" data-i="' + i + '"><option value="I"' + (a.cls === 'I' ? ' selected' : '') + '>Ⅰ类</option>' +
        '<option value="II"' + (a.cls === 'II' ? ' selected' : '') + '>Ⅱ类</option></select></td>' +
        '<td><select data-a="authorized" data-i="' + i + '"><option value="1"' + (a.authorized ? ' selected' : '') + '>已授权</option>' +
        '<option value="0"' + (!a.authorized ? ' selected' : '') + '>未授权</option></select></td>' +
        '<td><select data-a="selfDev" data-i="' + i + '"><option value="1"' + (a.selfDev ? ' selected' : '') + '>自主研发</option>' +
        '<option value="0"' + (!a.selfDev ? ' selected' : '') + '>受让/受赠/并购</option></select></td>' +
        '<td><select data-a="usedBefore" data-i="' + i + '"><option value="0"' + (!a.usedBefore ? ' selected' : '') + '>否</option>' +
        '<option value="1"' + (a.usedBefore ? ' selected' : '') + '>是（复审剔除）</option></select></td>' +
        '<td><button class="btn sm danger" data-del-a="' + i + '">删除</button></td></tr>';
    }).join('') || '<tr><td colspan="6" style="color:#6b7280">暂无记录，点击「添加知识产权」录入</td></tr>';
  }
  function addAch(a) {
    state.achievements.push(a || { name: '', form: '自行投资实施转化', year: String(new Date().getFullYear()) });
    renderAch(); compute();
  }
  var ACH_FORMS = ['自行投资实施转化', '向他人转让该技术成果', '许可他人使用该科技成果',
    '以该科技成果作为合作条件与他人共同实施转化', '以该科技成果作价投资、折算股份或出资比例', '其他协商确定的方式'];
  function renderAch() {
    var tb = $('achTable').querySelector('tbody');
    tb.innerHTML = state.achievements.map(function (a, i) {
      return '<tr><td><input type="text" data-c="name" data-i="' + i + '" value="' + esc(a.name) + '" placeholder="如：XXX 控制系统 V1.0"></td>' +
        '<td><select data-c="form" data-i="' + i + '">' + ACH_FORMS.map(function (f) {
          return '<option' + (a.form === f ? ' selected' : '') + '>' + f + '</option>'; }).join('') + '</select></td>' +
        '<td><input type="text" data-c="year" data-i="' + i + '" value="' + esc(a.year) + '"></td>' +
        '<td><button class="btn sm danger" data-del-c="' + i + '">删除</button></td></tr>';
    }).join('') || '<tr><td colspan="4" style="color:#6b7280">暂无记录，点击「添加转化成果」录入</td></tr>';
  }

  /* ---------------- 采集与计算 ---------------- */
  function collect() {
    SIMPLE_FIELDS.forEach(function (k) {
      var v = $(k).value;
      if (['employeeTotal', 'techStaff', 'revenueRecent', 'revenue3y', 'rdExpense3y',
        'rdExpenseTotal', 'rdExpenseDomestic', 'totalRevenue', 'highTechRevenue'].indexOf(k) >= 0) {
        state[k] = v === '' ? null : parseFloat(v);
      } else if (k === 'bizYears') { state[k] = parseInt(v, 10); }
      else { state[k] = v; }
    });
    CHECK_FIELDS.forEach(function (k) { state[k] = $(k).checked; });
    FIN_FIELDS.forEach(function (k) {
      var v = $(k).value; state.finance[k] = v === '' ? null : parseFloat(v);
    });
    document.querySelectorAll('[data-rm]').forEach(function (el) { state.rdmgmt[el.getAttribute('data-rm')] = el.value; });
    return state;
  }

  function buildInput() {
    return {
      declareType: state.declareType, bizYears: state.bizYears, standard: state.standard,
      assets: state.assets, advanced: state.advanced, support: state.support, acquisition: state.acquisition,
      achievements: state.achievements, rdmgmt: state.rdmgmt, finance: state.finance,
      enterprise: {
        establishDate: state.establishDate, fieldOK: state.fieldOK, noAccident: state.noAccident,
        employeeTotal: state.employeeTotal, techStaff: state.techStaff,
        revenueRecent: state.revenueRecent, revenue3y: state.revenue3y, rdExpense3y: state.rdExpense3y,
        rdExpenseTotal: state.rdExpenseTotal, rdExpenseDomestic: state.rdExpenseDomestic,
        totalRevenue: state.totalRevenue, highTechRevenue: state.highTechRevenue
      }
    };
  }

  var last = null;
  function compute() {
    collect();
    var r = HT.assess(buildInput());
    last = r;
    render(r);
    save();
    return r;
  }

  /* ---------------- 渲染 ---------------- */
  function render(r) {
    // 资格预检
    var pc = r.precheck;
    $('precheckAlert').innerHTML = pc.passed
      ? '<div class="alert ok">✓ 资格预检 8 项全部满足，可进入评分环节</div>'
      : '<div class="alert bad">✕ 资格预检有 ' + pc.blocked.length + ' 项未满足 —— 属一票否决项，不解决则无法认定</div>';
    $('precheckList').innerHTML = pc.items.map(function (it) {
      return '<div class="precheck-item"><span class="pc-dot ' + (it.ok ? 'ok">✓' : 'no">!') + '</span>' +
        '<div><div>' + esc(it.name) + '</div><div class="pc-detail">' + esc(it.detail) + '　（口径：' + esc(it.rule) + '）</div></div></div>';
    }).join('');

    // 研发费用适用比例
    var revR = state.revenueRecent;
    var cfg = P.rd_ratio[2];
    if (revR !== null && !isNaN(revR)) {
      for (var i = 0; i < P.rd_ratio.length; i++) { if (revR <= P.rd_ratio[i].maxRevenue) { cfg = P.rd_ratio[i]; break; } }
      $('rdRatioText').value = (cfg.ratio * 100).toFixed(0) + '%　（' + cfg.label + '）';
    } else { $('rdRatioText').value = '请先填写最近一年销售收入'; }

    // 知识产权提示
    var eff = HT.effectiveAssets(state.assets, state.declareType);
    var cI = eff.filter(function (a) { return a.cls === 'I'; }).length;
    var cII = eff.filter(function (a) { return a.cls === 'II'; }).length;
    $('ipCountHint').innerHTML = '当前有效（已授权' + (state.declareType === 'review' ? '，且复审未用过' : '') + '）：Ⅰ类 <b>' + cI +
      '</b> 项、Ⅱ类 <b>' + cII + '</b> 项　→　数量档位 <b>' + r.indicators.ip.items[2].band + '</b> 档（' +
      r.indicators.ip.items[2].range[0] + '-' + r.indicators.ip.items[2].range[1] + ' 分）';

    // 成果转化
    var tf = r.indicators.transform;
    $('tfHint').innerHTML = '转化总数 <b>' + tf.total + '</b> 项 ÷ ' + tf.divisor + ' 年 ＝ 年均 <b>' +
      tf.average.toFixed(2) + '</b> 项/年　→　<b>' + tf.band + '</b> 档（' + tf.bandLabel + '，' +
      tf.scoreLo + '-' + tf.scoreHi + ' 分）';

    // 成长性明细
    $('growthDetail').innerHTML = r.indicators.growth.items.map(function (it) {
      return '<div class="precheck-item"><span class="pc-dot ' + (it.range[1] > 0 ? 'ok">' + it.band : 'no">0') + '</span>' +
        '<div><div>' + esc(it.name) + '：' + it.detail + '　→　' + it.band + ' 档（' + it.range[0] + '-' + it.range[1] + ' 分）</div>' +
        (it.note ? '<div class="pc-detail">' + esc(it.note) + '</div>' : '') + '</div></div>';
    }).join('');

    // 分数面板
    $('scoreNum').textContent = r.conservative;
    $('scoreNum').className = 'num ' + (r.qualified ? 'pass' : 'fail');
    $('verdict').className = 'verdict ' + (r.qualified ? 'pass' : 'fail');
    $('verdict').textContent = r.qualified
      ? '✓ 达标（保守总分 ' + r.conservative + ' ＞ 70）'
      : '✕ 未达标（保守总分 ' + r.conservative + '，距 ≥71 还差 ' + r.gap + ' 分）';
    $('optimisticText').textContent = '乐观总分 ' + r.optimistic + ' 分（各项目区间上界之和，仅作冲刺目标；达标判定一律以保守总分为准）';

    // 指标条
    $('bars').innerHTML = P.indicators.map(function (ind) {
      var v = r.indicators[ind.key];
      var pLo = Math.round(v.scoreLo / ind.max * 100), pHi = Math.round(v.scoreHi / ind.max * 100);
      return '<div class="bar-row"><div class="bar-top"><span>' + ind.name + '</span>' +
        '<span>' + v.scoreLo + '~' + v.scoreHi + ' / ' + ind.max + '</span></div>' +
        '<div class="bar-track"><div class="bar-fill lo" style="width:' + pHi + '%"></div></div>' +
        '<div class="bar-track" style="margin-top:2px"><div class="bar-fill" style="width:' + pLo + '%"></div></div></div>';
    }).join('');

    $('ipPill').textContent = r.indicators.ip.scoreLo + '~' + r.indicators.ip.scoreHi + ' / 30';
    $('tfPill').textContent = tf.scoreLo + '~' + tf.scoreHi + ' / 30';
    $('rmPill').textContent = r.indicators.rdmgmt.scoreLo + '~' + r.indicators.rdmgmt.scoreHi + ' / 20';
    $('grPill').textContent = r.indicators.growth.scoreLo + '~' + r.indicators.growth.scoreHi + ' / 20';

    renderRadar(r);
    renderDetail(r);
    renderSuggest(r);
    $('printHeader').innerHTML = '<h2>' + esc(state.entName || '（未填写企业名称）') + '　高新技术企业认定自评报告</h2>' +
      '<div>政策版本：' + P.policy_version + '（' + P.version_label + '）　生成时间：' + new Date().toLocaleString('zh-CN') + '</div>' +
      '<div>保守总分：<b>' + r.conservative + '</b> 分　乐观总分：' + r.optimistic + ' 分　结论：<b>' +
      (r.qualified ? '达标（＞70）' : '未达标（差 ' + r.gap + ' 分）') + '</b></div>' +
      '<div style="font-size:11px;color:#666">' + esc(P.disclaimer) + '</div>';
  }

  function renderRadar(r) {
    var size = 230, c = size / 2, R = 82;
    var axes = P.indicators;
    function pt(i, ratio) {
      var ang = -Math.PI / 2 + i * 2 * Math.PI / axes.length;
      return [c + Math.cos(ang) * R * ratio, c + Math.sin(ang) * R * ratio];
    }
    function poly(key, cls) {
      var pts = axes.map(function (ind, i) {
        var v = r.indicators[ind.key];
        var val = key === 'lo' ? v.scoreLo : v.scoreHi;
        return pt(i, val / ind.max).map(function (n) { return n.toFixed(1); }).join(',');
      }).join(' ');
      return '<polygon points="' + pts + '" class="' + cls + '"/>';
    }
    var grid = [0.25, 0.5, 0.75, 1].map(function (g) {
      var pts = axes.map(function (_, i) { return pt(i, g).map(function (n) { return n.toFixed(1); }).join(','); }).join(' ');
      return '<polygon points="' + pts + '" fill="none" stroke="#e2e8f0" stroke-width="1"/>';
    }).join('');
    var spokes = axes.map(function (_, i) {
      var p = pt(i, 1); return '<line x1="' + c + '" y1="' + c + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="#e2e8f0"/>';
    }).join('');
    var labels = axes.map(function (ind, i) {
      var p = pt(i, 1.22);
      var anchor = Math.abs(p[0] - c) < 6 ? 'middle' : (p[0] > c ? 'start' : 'end');
      return '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '" text-anchor="' + anchor +
        '" font-size="11" fill="#4b5563">' + ind.name.replace('研究开发组织管理水平', '组织管理').replace('科技成果转化能力', '成果转化') +
        '<tspan dx="4" fill="#6b7280">' + r.indicators[ind.key].scoreLo + '</tspan></text>';
    }).join('');
    $('radar').innerHTML = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      grid + spokes +
      '<polygon points="' + axes.map(function (ind, i) {
        return pt(i, r.indicators[ind.key].scoreHi / ind.max).map(function (n) { return n.toFixed(1); }).join(',');
      }).join(' ') + '" fill="#93b4f5" fill-opacity="0.35" stroke="#93b4f5" stroke-width="1"/>' +
      '<polygon points="' + axes.map(function (ind, i) {
        return pt(i, r.indicators[ind.key].scoreLo / ind.max).map(function (n) { return n.toFixed(1); }).join(',');
      }).join(' ') + '" fill="#1a56db" fill-opacity="0.30" stroke="#1a56db" stroke-width="1.5"/>' +
      labels + '</svg><div class="hint">深蓝＝保守分（判定依据）　浅蓝＝乐观分（冲刺目标）</div>';
  }

  function renderDetail(r) {
    var rows = [];
    P.indicators.forEach(function (ind) {
      var v = r.indicators[ind.key];
      rows.push('<tr style="background:#f8fafc"><td colspan="6"><b>' + ind.name + '</b>　指标得分 ' +
        v.scoreLo + '~' + v.scoreHi + ' / ' + ind.max + (v.capped ? '　<span class="hint warn">（已按指标上限 ' + ind.max + ' 截断）</span>' : '') + '</td></tr>');
      v.items.forEach(function (it) {
        rows.push('<tr><td style="padding-left:22px">' + esc(it.name) + '</td>' +
          '<td><span class="band-tag ' + it.band + '">' + it.band + '</span>' + (it.bandLabel ? ' ' + esc(it.bandLabel) : '') + '</td>' +
          '<td class="num range-cell">' + it.range[0] + '</td><td class="num range-cell">' + it.range[1] + '</td>' +
          '<td class="num">' + (it.max || ind.max) + '</td>' +
          '<td class="practice-note">' + esc(it.detail || it.note || (it.practice != null ? '实务参考值 ' + it.practice + ' 分（仅展示）' : '')) + '</td></tr>');
      });
    });
    rows.push('<tr style="background:#ebf2ff"><td colspan="2"><b>合计</b></td><td class="num"><b>' + r.conservative +
      '</b></td><td class="num"><b>' + r.optimistic + '</b></td><td class="num">100</td><td>' +
      (r.qualified ? '<b style="color:#057a3d">达标（保守总分 ＞70）</b>' : '<b style="color:#b91c1c">未达标，距 ≥71 还差 ' + r.gap + ' 分</b>') + '</td></tr>');
    $('detailTable').querySelector('tbody').innerHTML = rows.join('');
  }

  function renderSuggest(r) {
    $('suggestList').innerHTML = r.suggestions.length ? r.suggestions.map(function (s) {
      return '<div class="sug ' + s.level + '"><div class="t"><span class="lvl">' + s.level + '</span>' + esc(s.title) + '</div>' +
        '<div class="a">' + esc(s.action) + '</div><div class="g">预计收益：' + esc(s.gain) + '</div></div>';
    }).join('') : '<div class="alert ok">✓ 当前各项均已处于较优档位，无强制整改项。请核对佐证材料完整性。</div>';
  }

  /* ---------------- 规则包热更新 ---------------- */
  var PACK_KEY = 'hitech-rulepack-v1';
  var RULES_URL = 'rules/policy.json';      // 远端规则包路径（改政策只需替换这个文件）

  function refreshUI() { initPolicyText(); applyToForm(); renderAssets(); renderAch(); compute(); }

  function applyStoredPack(silent) {
    var pack = null;
    try { pack = JSON.parse(localStorage.getItem(PACK_KEY) || 'null'); } catch (e) {}
    if (pack && HT.applyRulePack(pack)) { refreshUI(); if (!silent) alert('已应用本机规则包：' + pack.policy_version); return true; }
    return false;
  }
  function savePack(pack) {
    try { localStorage.setItem(PACK_KEY, JSON.stringify(pack)); } catch (e) {}
  }
  function fetchRemotePack(manual) {
    if (location.protocol === 'file:') {
      if (manual) alert('本地打开（file://）无法拉取远端规则包。\n请用「导入规则包」选择 policy.json，或部署到服务器后使用「检查更新」。');
      return;
    }
    fetch(RULES_URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (pack) {
        var cur = HT.POLICY;
        var newer = (pack.policy_version !== cur.policy_version) ||
                    (pack.pack_updated_at && pack.pack_updated_at > cur.pack_updated_at);
        if (newer) {
          HT.applyRulePack(pack); savePack(pack); refreshUI();
          if (manual) alert('✓ 已更新到最新规则包\n版本：' + pack.policy_version + '\n更新日期：' + (pack.pack_updated_at || '—'));
        } else if (manual) {
          alert('当前已是最新规则包\n版本：' + cur.policy_version + '（' + (cur.pack_updated_at || '—') + '）');
        }
        renderPackInfo();
      })
      .catch(function (err) {
        if (manual) alert('未获取到远端规则包：' + err.message + '\n可改用「导入规则包」手动上传。');
      });
  }
  function renderPackInfo() {
    var p = HT.POLICY;
    var el = $('packInfo');
    if (!el) return;
    el.innerHTML = '<div class="grid c4">' +
      '<div class="field"><label>政策版本</label><input type="text" value="' + esc(p.policy_version) + '" readonly></div>' +
      '<div class="field"><label>版本说明</label><input type="text" value="' + esc(p.version_label) + '" readonly></div>' +
      '<div class="field"><label>生效日期</label><input type="text" value="' + esc(p.effective_date) + '" readonly></div>' +
      '<div class="field"><label>规则包更新日期</label><input type="text" value="' + esc(p.pack_updated_at || '—') + '" readonly></div>' +
      '</div><div class="hint" style="margin-top:8px">规则来源：' + esc(p.source) + '</div>';
  }
  function bindPackUI() {
    $('btnCheckUpdate').onclick = function () { fetchRemotePack(true); };
    $('btnExportPack').onclick = function () {
      download('policy_' + HT.POLICY.policy_version + '_' + dateStr() + '.json', JSON.stringify(HT.exportRulePack(), null, 2), 'application/json');
    };
    $('btnImportPack').onclick = function () { $('packFile').click(); };
    $('packFile').onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var pack = JSON.parse(rd.result);
          if (!HT.applyRulePack(pack)) throw new Error('缺少 policy_version 字段');
          savePack(pack); refreshUI(); renderPackInfo();
          alert('✓ 规则包已生效\n版本：' + pack.policy_version + '\n说明：本次仅改变评分规则，你的填报数据保持不变。');
        } catch (err) { alert('导入失败：' + err.message); }
      };
      rd.readAsText(f); e.target.value = '';
    };
    $('btnResetPack').onclick = function () {
      if (!confirm('恢复为出厂规则（' + HT.DEFAULT_POLICY.policy_version + '）？\n仅重置评分规则，不影响已填写的数据。')) return;
      HT.resetRulePack();
      try { localStorage.removeItem(PACK_KEY); } catch (e) {}
      refreshUI(); renderPackInfo();
      alert('已恢复出厂规则包');
    };
  }
  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 忽略 */ });
    }
  }

  /* ---------------- 持久化 ---------------- */
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式忽略 */ }
  }
  function load(obj) {
    if (!obj) return;
    Object.keys(obj).forEach(function (k) {
      if (k === 'finance' || k === 'rdmgmt') { Object.assign(state[k], obj[k] || {}); }
      else { state[k] = obj[k]; }
    });
    applyToForm(); renderAssets(); renderAch(); compute();
  }
  function applyToForm() {
    SIMPLE_FIELDS.forEach(function (k) { if ($(k)) $(k).value = state[k] == null ? '' : state[k]; });
    CHECK_FIELDS.forEach(function (k) { if ($(k)) $(k).checked = !!state[k]; });
    FIN_FIELDS.forEach(function (k) { if ($(k)) $(k).value = state.finance[k] == null ? '' : state.finance[k]; });
    document.querySelectorAll('[data-rm]').forEach(function (el) {
      el.value = state.rdmgmt[el.getAttribute('data-rm')] || 'C';
    });
  }

  /* ---------------- 导出 ---------------- */
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function sheetXml(name, rows) {
    return '<Worksheet ss:Name="' + name + '"><Table>' + rows.map(function (r) {
      return '<Row>' + r.map(function (cell) {
        var isNum = typeof cell === 'number';
        return '<Cell' + (cell && cell.bold ? ' ss:StyleID="h"' : '') + '><Data ss:Type="' +
          (isNum ? 'Number' : 'String') + '">' + esc(String(isNum ? cell : (cell && cell.t != null ? cell.t : cell))) + '</Data></Cell>';
      }).join('') + '</Row>';
    }).join('') + '</Table></Worksheet>';
  }
  function exportXls() {
    var r = last || compute();
    var s1 = [['高新技术企业认定自评 · 评分明细'], ['政策版本', P.policy_version + '（' + P.version_label + '）'],
      ['企业名称', state.entName || '（未填写）'], ['生成时间', new Date().toLocaleString('zh-CN')],
      ['保守总分', r.conservative], ['乐观总分', r.optimistic],
      ['达标判定', r.qualified ? '达标（保守总分＞70）' : '未达标（距≥71差' + r.gap + '分）'], [],
      ['指标', '评分项', '档位', '保守分', '乐观分', '上限', '说明']];
    P.indicators.forEach(function (ind) {
      var v = r.indicators[ind.key];
      v.items.forEach(function (it) {
        s1.push([ind.name, it.name, it.band, it.range[0], it.range[1], it.max || ind.max, it.detail || it.note || '']);
      });
      s1.push([ind.name + ' 小计', '', '', v.scoreLo, v.scoreHi, ind.max, '']);
    });
    s1.push(['合计', '', '', r.conservative, r.optimistic, 100, '']);

    var s2 = [['名称/编号', '类别', '已授权', '自主研发', '复审已用过']].concat(
      state.assets.map(function (a) {
        return [a.name, a.cls === 'I' ? 'Ⅰ类' : 'Ⅱ类', a.authorized ? '是' : '否', a.selfDev ? '是' : '否', a.usedBefore ? '是' : '否'];
      }));
    var s3 = [['成果名称', '转化形式', '年份']].concat(state.achievements.map(function (a) { return [a.name, a.form, a.year]; }));
    var s4 = [['整改建议', '优先级', '具体动作', '预计收益']].concat(
      r.suggestions.map(function (s) { return [s.title, s.level, s.action, s.gain]; }));
    var s5 = [['资格预检项', '结论', '说明', '政策口径']].concat(
      r.precheck.items.map(function (it) { return [it.name, it.ok ? '满足' : '未满足', it.detail, it.rule]; }));

    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
      '<Styles><Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#EEF2F7" ss:Pattern="Solid"/></Style></Styles>' +
      sheetXml('评分明细', s1) + sheetXml('知识产权台账', s2) + sheetXml('成果转化台账', s3) +
      sheetXml('整改建议', s4) + sheetXml('资格预检', s5) + '</Workbook>';
    download('高企自评评分明细_' + dateStr() + '.xls', xml, 'application/vnd.ms-excel;charset=utf-8');
  }

  function dateStr() { var d = new Date(); return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }

  function shareLink() {
    var json = JSON.stringify(state);
    var b64 = btoa(unescape(encodeURIComponent(json)));
    var url = location.href.split('#')[0] + '#d=' + b64;
    $('shareBox').style.display = 'block';
    $('shareUrl').value = url;
    try { navigator.clipboard.writeText(url); } catch (e) { /* 忽略 */ }
  }
  function loadFromHash() {
    var m = location.hash.match(/[#&]d=([^&]+)/);
    if (!m) return false;
    try { load(JSON.parse(decodeURIComponent(escape(atob(m[1]))))); return true; } catch (e) { return false; }
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    document.addEventListener('input', function (e) {
      var t = e.target;
      if (t.matches('[data-a]')) {
        var i = +t.getAttribute('data-i'), k = t.getAttribute('data-a'), a = state.assets[i];
        if (k === 'authorized' || k === 'selfDev' || k === 'usedBefore') a[k] = t.value === '1';
        else a[k] = t.value;
        compute(); return;
      }
      if (t.matches('[data-c]')) {
        var j = +t.getAttribute('data-i'), c = t.getAttribute('data-c');
        state.achievements[j][c] = t.value; compute(); return;
      }
      if (t.matches('[data-rm]')) { state.rdmgmt[t.getAttribute('data-rm')] = t.value; compute(); return; }
      if (SIMPLE_FIELDS.indexOf(t.id) >= 0 || FIN_FIELDS.indexOf(t.id) >= 0) { debounced(); return; }
    });
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (CHECK_FIELDS.indexOf(t.id) >= 0) { compute(); return; }
      if (t.matches('[data-a],[data-c],[data-rm]')) { compute(); return; }
      if (SIMPLE_FIELDS.indexOf(t.id) >= 0 || FIN_FIELDS.indexOf(t.id) >= 0) { compute(); return; }
    });
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t.matches('[data-del-a]')) { state.assets.splice(+t.getAttribute('data-del-a'), 1); renderAssets(); compute(); return; }
      if (t.matches('[data-del-c]')) { state.achievements.splice(+t.getAttribute('data-del-c'), 1); renderAch(); compute(); return; }
      if (t.matches('#nav a')) {
        document.querySelectorAll('#nav a').forEach(function (a) { a.classList.remove('active'); });
        t.classList.add('active');
      }
    });

    $('addIp').onclick = function () { addAsset(); };
    $('clearIp').onclick = function () { state.assets = []; renderAssets(); compute(); };
    $('addAch').onclick = function () { addAch(); };
    $('clearAch').onclick = function () { state.achievements = []; renderAch(); compute(); };
    $('btnPrint').onclick = function () { compute(); window.print(); };
    $('btnXls').onclick = exportXls;
    $('btnSave').onclick = function () { save(); alert('草稿已保存到本机浏览器（更换设备或清理缓存后不可恢复，建议同时用「备份 JSON」保存文件）。'); };
    $('btnBackup').onclick = function () { download('高企自评备份_' + dateStr() + '.json', JSON.stringify(state, null, 2), 'application/json'); };
    $('btnImport').onclick = function () { $('fileInput').click(); };
    $('fileInput').onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { try { load(JSON.parse(rd.result)); alert('导入成功'); } catch (err) { alert('导入失败：文件格式不正确'); } };
      rd.readAsText(f); e.target.value = '';
    };
    $('btnShare').onclick = shareLink;
    $('btnReset').onclick = function () {
      if (!confirm('确定清空全部填报数据？该操作不可撤销。')) return;
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      location.hash = ''; location.reload();
    };
  }

  var timer = null;
  function debounced() { clearTimeout(timer); timer = setTimeout(compute, 200); }

  /* ---------------- 启动 ---------------- */
  initPolicyText();
  bind();
  bindPackUI();
  applyStoredPack(true);                 // ① 应用本机已存的规则包（静默）
  if (!loadFromHash()) {                 // ② 载入填报数据（分享链接优先，其次本地草稿）
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) {}
    if (saved) { load(saved); }
    else { applyToForm(); renderAssets(); renderAch(); compute(); }
  }
  renderPackInfo();
  fetchRemotePack(false);                // ③ 后台静默检查规则包更新
  registerSW();                          // ④ 注册离线缓存（PWA 可安装）
})();
