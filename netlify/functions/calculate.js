/**
 * ===================================================================
 *  AI业务天赋速测系统 V2 - 后端云函数（保密）
 *  
 *  两步 AI 判定流程：
 *    第一步：调用 DeepSeek-V3 进行五维 + 全能布尔判定（返回 JSON）
 *    第二步：根据判定结果，再调用 AI 生成 150 字天赋速评
 *  
 *  加权计分：
 *    essence +2, logic +2, rebuild +2, street +1, efficiency +1
 *    总分 0-8
 *  
 *  分班规则：
 *    >= 7 且 allrounder  → SSS级 · 全能本质架构师 · 单独培养
 *    >= 6 且 !allrounder → S级  · 本质架构师     · 天才直通班
 *    3-5                 → A级  · 定向潜力型     · 潜力实战班
 *    0-2                 → B级  · 思维框架构建中 · 陪伴成长班
 * ===================================================================
 */

var https = require('https');

// ==================== AI 调用封装 ====================

function callAI(systemPrompt, userPrompt) {
  return new Promise(function(resolve, reject) {
    var apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) { reject(new Error('未配置 SILICONFLOW_API_KEY')); return; }

    var postData = JSON.stringify({
      model: 'deepseek-ai/DeepSeek-V3',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt }
      ],
      max_tokens: 800,
      temperature: 0.3
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
            reject(new Error('AI API: ' + (json.error.message || JSON.stringify(json.error))));
          } else {
            reject(new Error('AI 返回格式异常'));
          }
        } catch (e) { reject(new Error('AI 响应解析失败: ' + e.message)); }
      });
    });

    req.on('error', function(e) { reject(new Error('AI 网络失败: ' + e.message)); });
    req.setTimeout(25000, function() { req.destroy(); reject(new Error('AI 请求超时')); });
    req.write(postData);
    req.end();
  });
}

// ==================== 第一步：五维 + 全能布尔判定 ====================

function buildJudgmentPrompt(answers) {
  var a = {};
  for (var i = 0; i < answers.length; i++) {
    a[answers[i].questionId] = answers[i].answer;
  }

  var systemPrompt =
    '你是一位严格的人才评估专家。用户回答了六道开放式问题。请根据以下回答进行判断，只输出JSON，不要任何其他文字。';

  var userPrompt =
    '第1题（本质导向）：' + (a[1] || '') + '\n' +
    '第2题（强逻辑）：' + (a[2] || '') + '\n' +
    '第3题（体系重构）：' + (a[3] || '') + '\n' +
    '第4题（街头洞察）：' + (a[4] || '') + '\n' +
    '第5题（效率杠杆）：' + (a[5] || '') + '\n' +
    '第6题（附加题）：' + (a[6] || '') + '\n\n' +
    '判断标准：\n' +
    '- 本质导向(essence)：是否穿透"竞品抢客"表象，指出面馆自身结构问题（老客流失、产品老化、体验陈旧、成本结构等）。仅谈口味/价格/服务为false。\n' +
    '- 强逻辑(logic)：是否使用"第一步…第二步…"结构且逻辑清晰。笼统无序为false。\n' +
    '- 体系重构(rebuild)：是否指向改变系统规则或重塑流程（砍整段人工、平台化等）。仅为局部优化为false。\n' +
    '- 街头洞察(street)：是否包含具体线下商业细节（陈列、动线、话术等），并对消费心理有观察。无具体细节为false。\n' +
    '- 效率杠杆(efficiency)：是否明确提出使用工具/自动化/AI/脚本/宏等避免手工操作。手工做或找人帮忙为false。\n' +
    '- 全能验证(allrounder)（针对附加题）：必须同时满足(1)本质穿透（指出利润瓶颈结构性原因如客单价天花板、翻台率、供应链损耗、人效等）、(2)体系重构（改变收入模型如团餐/预制菜/会员，或成本模型如集中采购/中央厨房）、(3)其他三个信号（逻辑组织、街头洞察、效率杠杆）中至少两个为true。全部满足则true，否则false。\n\n' +
    '输出格式（只输出这个JSON，无任何其他文字）：\n' +
    '{"essence":true/false,"logic":true/false,"rebuild":true/false,"street":true/false,"efficiency":true/false,"allrounder":true/false}';

  return { systemPrompt: systemPrompt, userPrompt: userPrompt };
}

function parseJudgmentJSON(text) {
  // 提取 JSON（AI 可能在前后加文字）
  var match = text.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error('无法从AI响应中提取JSON');

  var obj = JSON.parse(match[0]);
  // 归一化为布尔
  return {
    essence:    obj.essence === true,
    logic:      obj.logic === true,
    rebuild:    obj.rebuild === true,
    street:     obj.street === true,
    efficiency: obj.efficiency === true,
    allrounder: obj.allrounder === true
  };
}

// ==================== 第二步：生成天赋速评 ====================

function buildEvaluationPrompt(dims, totalScore, level) {
  var systemPrompt = '你是一位商业天赋评估专家，语气干脆，不用虚词。';

  var userPrompt =
    '用户在五个维度和附加题的表现：\n' +
    '- 本质导向：' + dims.essence + '\n' +
    '- 强逻辑：' + dims.logic + '\n' +
    '- 体系重构：' + dims.rebuild + '\n' +
    '- 街头洞察：' + dims.street + '\n' +
    '- 效率杠杆：' + dims.efficiency + '\n' +
    '- 附加题全能验证：' + dims.allrounder + '\n' +
    '加权总分：' + totalScore + '/8，最终等级：' + level + '。\n\n' +
    '请生成一段150字以内的"天赋速评"。要求：\n' +
    '1. 若等级为SSS级，以"极为罕见。"开头，点出五项全能，结论"建议纳入单独培养计划，给予专属资源与导师"。\n' +
    '2. 若等级为S级，点出"具备稀缺的体系建构能力"，给出岗位方向（商业模式设计、业务SOP架构、AI方案规划）。\n' +
    '3. 若等级为A级，指出最强特质和可打磨方向。\n' +
    '4. 若等级为B级，指出思维盲区并给练习建议（如：每天追问一个身边服务的运转逻辑）。\n' +
    '5. 语气干脆，不用虚词。\n\n' +
    '输出纯文本，无格式。';

  return { systemPrompt: systemPrompt, userPrompt: userPrompt };
}

// ==================== 加权计分 + 分班 ====================

function calculateScore(dims) {
  var score = 0;
  if (dims.essence)    score += 2;
  if (dims.logic)      score += 2;
  if (dims.rebuild)    score += 2;
  if (dims.street)     score += 1;
  if (dims.efficiency) score += 1;
  return score;
}

function classify(totalScore, allrounder) {
  if (totalScore >= 7 && allrounder) {
    return { level: 'SSS级', label: '全能本质架构师', path: '单独培养' };
  } else if (totalScore >= 6) {
    return { level: 'S级', label: '本质架构师', path: '天才直通班' };
  } else if (totalScore >= 3) {
    return { level: 'A级', label: '定向潜力型', path: '潜力实战班' };
  } else {
    return { level: 'B级', label: '思维框架构建中', path: '陪伴成长班' };
  }
}

// ==================== 降级兜底评语 ====================

function fallbackEvaluation(dims, totalScore, cls) {
  if (cls.level === 'SSS级') {
    return '极为罕见。你在本质洞察、逻辑组织、体系重构、街头观察和效率杠杆五个维度全面达标，并在附加题中展现出完整的商业操盘思维。建议纳入单独培养计划，给予专属资源与导师。';
  } else if (cls.level === 'S级') {
    return '你具备稀缺的体系建构能力，在本质洞察和逻辑组织方面表现突出。适合商业模式设计、业务SOP架构、AI方案规划等方向，经过系统训练后可快速承接企业级项目。';
  } else if (cls.level === 'A级') {
    var strong = [];
    if (dims.essence) strong.push('本质洞察');
    if (dims.logic) strong.push('逻辑组织');
    if (dims.rebuild) strong.push('体系重构');
    if (dims.street) strong.push('街头洞察');
    if (dims.efficiency) strong.push('效率杠杆');
    return '你在' + (strong.join('、') || '部分维度') + '方面有明确优势。建议针对性强化薄弱维度，通过实战案例打磨即可快速提升综合能力。';
  } else {
    return '你目前的商业思维框架正在构建中。建议从日常观察入手：每天追问一个身边服务的运转逻辑，比如便利店为什么这样摆货、外卖平台为什么这样排序。坚持两周你会发现自己的思维维度明显拓宽。';
  }
}

// ==================== Netlify Function 入口 ====================

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: '仅支持 POST' }) };
  }

  try {
    var data = JSON.parse(event.body);
    var answers = data.answers;

    if (!answers || !Array.isArray(answers) || answers.length < 5) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: '答案不完整' }) };
    }

    // ===== 第一步：AI 五维判定 =====
    var dims;
    try {
      var jp = buildJudgmentPrompt(answers);
      var judgmentRaw = await callAI(jp.systemPrompt, jp.userPrompt);
      console.log('AI判定原始响应:', judgmentRaw);
      dims = parseJudgmentJSON(judgmentRaw);
    } catch (aiErr1) {
      console.error('AI 五维判定失败，使用全 false 降级:', aiErr1.message);
      dims = { essence: false, logic: false, rebuild: false, street: false, efficiency: false, allrounder: false };
    }

    // ===== 加权计分 + 分班 =====
    var totalScore = calculateScore(dims);
    var cls = classify(totalScore, dims.allrounder);

    // ===== 第二步：AI 生成评语 =====
    var evaluation;
    try {
      var ep = buildEvaluationPrompt(dims, totalScore, cls.level);
      evaluation = await callAI(ep.systemPrompt, ep.userPrompt);
      console.log('AI评语生成成功');
    } catch (aiErr2) {
      console.error('AI 评语生成失败，使用模板降级:', aiErr2.message);
      evaluation = fallbackEvaluation(dims, totalScore, cls);
    }

    // ===== 返回 =====
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalScore: totalScore,
        level: cls.level,
        label: cls.label,
        path: cls.path,
        dimensions: dims,
        evaluation: evaluation
      })
    };

  } catch (err) {
    console.error('云函数出错:', err);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: '服务器内部错误' }) };
  }
};
