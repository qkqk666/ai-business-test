/**
 * ===================================================================
 *  AI业务天赋速测系统 - 后端评分云函数（保密）
 *  部署到 Netlify Functions 后，用户无法在前端看到此文件内容
 * ===================================================================
 *
 *  五大核心人群画像（速成最快 · 价值最高）:
 *  1. 底层逻辑猎手型   — 天生抓商业本质，做业务拆解/AI方案核心输出
 *  2. 街头商业洞察型   — 懂线下真实生意，对接实体商家落地变现极快
 *  3. 反规效率优化型   — 天生爱用工具/抵触重复，AI上手速度远超常人
 *  4. 叛逆质疑型思考者 — 一眼找问题，挖商家隐性痛点，方案差异化极强
 *  5. 游戏策略思维型   — 策略拆解/路径规划本能反应，AI方案规划最强
 *
 *  评分维度:
 *    logic      → 逻辑深度    （映射：底层逻辑猎手型）
 *    business   → 商业嗅觉    （映射：街头商业洞察型）
 *    efficiency → 效率驱动    （映射：反规效率优化型）
 *    critical   → 质疑精神    （映射：叛逆质疑型思考者）
 *    strategy   → 策略思维    （映射：游戏策略思维型）
 * ===================================================================
 */

const https = require('https');

// ==================== AI 大模型调用（硅基流动 SiliconFlow） ====================

/**
 * 调用硅基流动 DeepSeek-V3 模型，为用户生成个性化 AI 评语
 * API 密钥从 Netlify 环境变量 SILICONFLOW_API_KEY 中读取
 * 如果密钥未配置或调用失败，将自动降级为模板评语
 */
function callAI(systemPrompt, userPrompt) {
  return new Promise(function(resolve, reject) {
    var apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      reject(new Error('未配置 SILICONFLOW_API_KEY'));
      return;
    }

    var postData = JSON.stringify({
      model: 'deepseek-ai/DeepSeek-V3',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt }
      ],
      max_tokens: 600,
      temperature: 0.7
    });

    var options = {
      hostname: 'api.siliconflow.cn',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    var req = https.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          var json = JSON.parse(data);
          if (json.choices && json.choices[0] && json.choices[0].message) {
            resolve(json.choices[0].message.content.trim());
          } else if (json.error) {
            reject(new Error('AI API 错误: ' + (json.error.message || JSON.stringify(json.error))));
          } else {
            reject(new Error('AI 返回格式异常'));
          }
        } catch (e) {
          reject(new Error('AI 响应解析失败: ' + e.message));
        }
      });
    });

    req.on('error', function(e) {
      reject(new Error('AI 网络请求失败: ' + e.message));
    });

    // 15秒超时
    req.setTimeout(15000, function() {
      req.destroy();
      reject(new Error('AI 请求超时'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 构建 AI 评测提示词，让 AI 根据用户的实际回答生成个性化评语
 */
function buildAIPrompt(basicAnswers, advancedAnswers, dims, totalScore, talentTags) {
  var systemPrompt =
    '你是一位资深商业教练和AI业务天赋评估专家。你的任务是根据用户的答题内容，撰写一段个性化的天赋评语。\n\n' +
    '要求：\n' +
    '1. 评语150-250字，语气温暖、专业、有洞察力\n' +
    '2. 必须基于用户回答中展现的具体思维特点来点评，不要说空话套话\n' +
    '3. 指出用户最突出的1-2个思维优势，并举出回答中的具体表现\n' +
    '4. 给出一句鼓励性的成长建议\n' +
    '5. 不要透露评分算法、关键词权重等内部机制\n' +
    '6. 不要使用markdown格式，纯文字即可';

  // 拼接用户答题内容
  var answersText = '';
  for (var i = 0; i < basicAnswers.length; i++) {
    var item = basicAnswers[i];
    if (item.answer && item.answer.trim()) {
      answersText += '基础题' + (i + 1) + '：' + item.question + '\n回答：' + item.answer.trim() + '\n\n';
    }
  }
  for (var j = 0; j < advancedAnswers.length; j++) {
    var adv = advancedAnswers[j];
    if (adv.answer && adv.answer.trim()) {
      answersText += '进阶题：' + adv.question + '\n回答：' + adv.answer.trim() + '\n\n';
    }
  }

  var dimLabels = {
    logic: '逻辑深度', business: '商业嗅觉', efficiency: '效率驱动',
    critical: '质疑精神', strategy: '策略思维'
  };
  var dimsText = '';
  for (var key in dims) {
    dimsText += dimLabels[key] + ': ' + dims[key] + '/3  ';
  }

  var userPrompt =
    '以下是一位用户的商业天赋测评答题记录：\n\n' +
    answersText +
    '系统评分结果：总分 ' + totalScore + '/10，' + dimsText + '\n' +
    '匹配天赋类型：' + talentTags.join('、') + '\n\n' +
    '请基于以上回答内容，为该用户撰写个性化天赋评语。';

  return { systemPrompt: systemPrompt, userPrompt: userPrompt };
}


// ==================== 关键词权重表（保密） ====================

const KEYWORD_MAP = {
  logic: {
    high: ['本质', '核心', '底层', '根本', '逻辑', '因果', '规律', '原理', '结构', '框架', '模型', '归因', '深层', '系统性'],
    mid:  ['原因', '分析', '判断', '推理', '思考', '拆解', '剖析', '追问', '根源', '关键'],
    low:  ['为什么', '了解', '研究', '弄清', '看看']
  },
  business: {
    high: ['客户', '需求', '市场', '竞争', '利润', '成本', '定价', '选址', '口碑', '复购', '客单价', '供应链', '渠道', '毛利', '获客'],
    mid:  ['客流', '流量', '转化', '用户', '消费', '购买', '品类', '差异化', '定位', '目标人群', '竞品', '痛点'],
    low:  ['生意', '赚钱', '卖', '买', '店', '顾客', '价格']
  },
  efficiency: {
    high: ['自动化', '工具', 'AI', '人工智能', '效率', '系统', '批量', '模板', '流程优化', '脚本', '机器人', '低代码'],
    mid:  ['优化', '简化', '节省时间', '减少重复', '讨厌重复', '受不了', '烦死了', '浪费时间', '无聊透顶', '抵触'],
    low:  ['快', '省事', '方便', '不喜欢重复', '想办法', '找方法']
  },
  critical: {
    high: ['质疑', '挑战', '不合理', '反思', '独立判断', '批判', '不盲从', '不服', '凭什么', '有问题'],
    mid:  ['好奇', '为什么', '不理解', '不同意', '自己想', '想清楚', '验证', '求证', '存疑', '疑问'],
    low:  ['觉得不对', '想问', '有意见', '不太对', '有想法']
  },
  strategy: {
    high: ['策略', '路径', '规划', '阶段', '步骤', '计划', '路线图', '优先级', '排兵布阵', '全局', '战略', '节奏', '分阶段'],
    mid:  ['方案', '目标', '第一步', '然后', '接下来', '先做', '后做', '分步', '推进', '布局', '安排'],
    low:  ['计划', '想好', '准备', '思路', '顺序', '做法']
  }
};

// ==================== 评分引擎 ====================

function scoreText(text, dimension) {
  var keywords = KEYWORD_MAP[dimension];
  if (!keywords || !text) return 0;

  var score = 0;
  var lower = text.toLowerCase();

  for (var i = 0; i < keywords.high.length; i++) {
    if (lower.includes(keywords.high[i].toLowerCase())) score += 3;
  }
  for (var j = 0; j < keywords.mid.length; j++) {
    if (lower.includes(keywords.mid[j].toLowerCase())) score += 2;
  }
  for (var k = 0; k < keywords.low.length; k++) {
    if (lower.includes(keywords.low[k].toLowerCase())) score += 1;
  }

  return score;
}

function countReasons(text) {
  if (!text) return 0;
  var parts = text.split(/[，,。；;、\n]/);
  var count = 0;
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].trim().length > 2) count++;
  }
  return Math.min(count, 5);
}

function analyzeAllAnswers(basicAnswers, advancedAnswers) {
  var dims = { logic: 0, business: 0, efficiency: 0, critical: 0, strategy: 0 };
  var dimNames = Object.keys(dims);

  // ---------- 分析基础题 ----------
  for (var a = 0; a < basicAnswers.length; a++) {
    var text = (basicAnswers[a].answer || '').trim();
    if (!text) continue;

    var reasons = countReasons(text);
    dims.logic += Math.min(reasons, 3);

    for (var d = 0; d < dimNames.length; d++) {
      dims[dimNames[d]] += scoreText(text, dimNames[d]);
    }

    if (text.length > 50) dims.strategy += 1;
    if (text.length > 100) dims.logic += 1;
  }

  // ---------- 分析进阶题（权重更高） ----------
  for (var b = 0; b < advancedAnswers.length; b++) {
    var advText = (advancedAnswers[b].answer || '').trim();
    if (!advText) continue;

    for (var e = 0; e < dimNames.length; e++) {
      dims[dimNames[e]] += Math.round(scoreText(advText, dimNames[e]) * 1.5);
    }

    if (advText.length > 30) { dims.strategy += 2; dims.logic += 1; }
    if (advText.length > 80) { dims.business += 1; dims.strategy += 1; }
    if (advText.length > 150) { dims.logic += 2; }
  }

  // ---------- 归一化到 0-3 ----------
  for (var f = 0; f < dimNames.length; f++) {
    var dim = dimNames[f];
    if (dims[dim] > 18) dims[dim] = 3;
    else if (dims[dim] > 10) dims[dim] = 2;
    else if (dims[dim] > 4) dims[dim] = 1;
    else dims[dim] = Math.min(dims[dim], 1);
    dims[dim] = Math.min(dims[dim], 3);
  }

  return dims;
}

// ==================== 人群分类 ====================

function classifyPersona(dims) {
  var mapping = [
    { dim: 'logic',      tag: '底层逻辑猎手型' },
    { dim: 'business',   tag: '街头商业洞察型' },
    { dim: 'efficiency', tag: '反规效率优化型' },
    { dim: 'critical',   tag: '叛逆质疑型思考者' },
    { dim: 'strategy',   tag: '游戏策略思维型' }
  ];

  var sorted = mapping
    .map(function(m) { return { tag: m.tag, score: dims[m.dim] }; })
    .sort(function(a, b) { return b.score - a.score; });

  var tags = [];
  if (sorted[0].score >= 2) tags.push(sorted[0].tag);
  if (sorted.length > 1 && sorted[1].score >= 2) tags.push(sorted[1].tag);

  if (tags.length === 0) {
    var total = Object.values(dims).reduce(function(a, b) { return a + b; }, 0);
    if (total >= 8) tags.push('商业潜力型');
    else if (total >= 4) tags.push('基础逻辑型');
    else tags.push('待开发型');
  }

  return tags;
}

// ==================== 模板评语（AI 调用失败时的兜底） ====================

function generateFallbackSummary(totalScore, tags, dims) {
  var summary = '';

  if (totalScore >= 8) {
    summary = '您展现出卓越的商业思维天赋，具备多维度分析问题的能力。';
  } else if (totalScore >= 5) {
    summary = '您具备良好的商业思维基础，有清晰的逻辑分析能力。';
  } else {
    summary = '您有基础的商业感知能力，需要更多实践来提升思维维度。';
  }

  var tagComments = {
    '底层逻辑猎手型':   '您天生善于抓取商业本质，无需大量理论灌输即可快速上手业务拆解和AI方案核心输出。',
    '街头商业洞察型':   '您对线下真实生意有敏锐的直觉，对接实体商家的落地变现速度将远超同龄人。',
    '反规效率优化型':   '您天生爱用工具、抵触重复劳动，AI上手速度远超常人，7天即可独立出活。',
    '叛逆质疑型思考者': '您不套模板、一眼发现问题，诊断能力自带天赋，擅长挖掘商家隐性痛点。',
    '游戏策略思维型':   '策略拆解、路径规划是您的本能反应，AI方案规划和商业步骤设计的成型速度最快。',
    '商业潜力型':       '您具备综合商业潜力，通过系统训练可快速提升商业拆解能力。',
    '基础逻辑型':       '您有基本的逻辑分析框架，通过针对性案例学习可以快速建立商业分析思维。',
    '待开发型':         '您的商业思维尚在萌芽阶段，通过陪伴式教学和实践训练将逐步开发潜力。'
  };

  for (var i = 0; i < tags.length; i++) {
    if (tagComments[tags[i]]) summary += ' ' + tagComments[tags[i]];
  }

  var dimLabels = { logic: '逻辑深度', business: '商业嗅觉', efficiency: '效率驱动', critical: '质疑精神', strategy: '策略思维' };
  var maxDim = 'logic'; var maxVal = 0;
  for (var key in dims) {
    if (dims[key] > maxVal) { maxVal = dims[key]; maxDim = key; }
  }
  if (maxVal >= 2) summary += ' 您在「' + dimLabels[maxDim] + '」维度表现最为突出。';

  return summary;
}

// ==================== 班级推荐 ====================

function recommendClass(totalScore) {
  if (totalScore >= 8) {
    return { name: '天才直通班', desc: '展现顶尖商业思维天赋，适合直接对接企业项目。', color: 'genius', icon: 'fas fa-crown', action: '0学费，高额分成' };
  } else if (totalScore >= 5) {
    return { name: '潜力实战班', desc: '具备良好商业逻辑基础，有显著提升空间。', color: 'potential', icon: 'fas fa-chart-line', action: '前3天免费，399元实战费' };
  } else {
    return { name: '陪伴成长班', desc: '需要更多引导与陪伴式教学。', color: 'growth', icon: 'fas fa-hands-helping', action: '599元全程陪伴' };
  }
}

// ==================== Netlify Function 入口 ====================

exports.handler = async function(event, context) {
  // 只接受 POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: '仅支持 POST 请求' }) };
  }

  try {
    var data = JSON.parse(event.body);
    var basicAnswers = data.basicAnswers;
    var advancedAnswers = data.advancedAnswers || [];
    var phone = data.phone;

    if (!basicAnswers || !Array.isArray(basicAnswers)) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: '缺少基础题答案' }) };
    }

    // ----- 第一步：关键词算法评分（稳定可靠，始终执行） -----
    var dims = analyzeAllAnswers(basicAnswers, advancedAnswers);
    var totalScore = Math.min(
      Object.values(dims).reduce(function(a, b) { return a + b; }, 0),
      10
    );
    var talentTags = classifyPersona(dims);
    var classRec = recommendClass(totalScore);

    // ----- 第二步：调用 AI 生成个性化评语 -----
    var talentSummary = '';

    try {
      var prompts = buildAIPrompt(basicAnswers, advancedAnswers, dims, totalScore, talentTags);
      talentSummary = await callAI(prompts.systemPrompt, prompts.userPrompt);
      console.log('AI 评语生成成功');
    } catch (aiErr) {
      // AI 调用失败，降级为模板评语（用户无感知）
      console.log('AI 调用降级，使用模板评语。原因:', aiErr.message);
      talentSummary = generateFallbackSummary(totalScore, talentTags, dims);
    }

    // ----- 返回结果 -----
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalScore: totalScore,
        dimensions: dims,
        talentTags: talentTags,
        talentSummary: talentSummary,
        classRecommendation: classRec
      })
    };

  } catch (err) {
    console.error('评分函数出错:', err);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: '服务器内部错误，请稍后再试' }) };
  }
};
