/**
 * ===================================================================
 *  AI业务天赋速测系统 V2.1 - 后端云函数（保密）
 *  
 *  单次 AI 调用：同时输出五维布尔判定 + 天赋速评
 *  (合并为一次调用以避免 Netlify 10s 超时)
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
    if (!apiKey) { reject(new Error('MISSING_API_KEY')); return; }

    var postData = JSON.stringify({
      model: 'deepseek-ai/DeepSeek-V3',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt }
      ],
      max_tokens: 1200,
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
            reject(new Error('API_ERROR: ' + (json.error.message || JSON.stringify(json.error))));
          } else {
            reject(new Error('UNEXPECTED_FORMAT: ' + data.substring(0, 200)));
          }
        } catch (e) { reject(new Error('PARSE_FAIL: ' + e.message + ' | raw: ' + data.substring(0, 200))); }
      });
    });

    req.on('error', function(e) { reject(new Error('NETWORK_FAIL: ' + e.message)); });
    req.setTimeout(20000, function() { req.destroy(); reject(new Error('TIMEOUT_20s')); });
    req.write(postData);
    req.end();
  });
}

// ==================== 合并 Prompt：一次性完成判定 + 评语 ====================

function buildCombinedPrompt(answers) {
  var a = {};
  for (var i = 0; i < answers.length; i++) {
    a[answers[i].questionId] = answers[i].answer;
  }

  var systemPrompt =
    '你是一位严格的商业人才评估专家。用户回答了六道开放式问题。你需要完成两个任务：先进行六维布尔判定，再写一段天赋速评。严格按照指定格式输出。';

  var userPrompt =
    '=== 用户回答 ===\n' +
    '第1题（本质导向）：' + (a[1] || '') + '\n' +
    '第2题（强逻辑）：' + (a[2] || '') + '\n' +
    '第3题（体系重构）：' + (a[3] || '') + '\n' +
    '第4题（街头洞察）：' + (a[4] || '') + '\n' +
    '第5题（效率杠杆）：' + (a[5] || '') + '\n' +
    '第6题（附加题）：' + (a[6] || '') + '\n\n' +
    '=== 任务一：六维判定 ===\n' +
    '判断标准：\n' +
    '- essence（本质导向）：是否穿透"竞品抢客"表象，指出面馆自身结构问题（老客流失、产品老化、体验陈旧、成本结构等）。仅谈口味/价格/服务为false。\n' +
    '- logic（强逻辑）：是否使用"第一步…第二步…"结构且逻辑清晰。笼统无序为false。\n' +
    '- rebuild（体系重构）：是否指向改变系统规则或重塑流程（砍整段人工、平台化等）。仅为局部优化为false。\n' +
    '- street（街头洞察）：是否包含具体线下商业细节（陈列、动线、话术等），并对消费心理有观察。无具体细节为false。\n' +
    '- efficiency（效率杠杆）：是否明确提出使用工具/自动化/AI/脚本/宏等避免手工操作。手工做或找人帮忙为false。\n' +
    '- allrounder（全能验证，针对附加题）：必须同时满足(1)本质穿透（指出利润瓶颈结构性原因）、(2)体系重构（改变收入或成本模型）、(3)其他三个信号中至少两个为true。全部满足则true，否则false。\n\n' +
    '加权计分规则：essence +2, logic +2, rebuild +2, street +1, efficiency +1，满分8。\n' +
    '分班：>=7且allrounder→SSS级，>=6→S级，3-5→A级，0-2→B级。\n\n' +
    '=== 任务二：天赋速评 ===\n' +
    '根据判定结果和分班等级，写150字以内的天赋速评：\n' +
    '- SSS级：以"极为罕见。"开头，点出五项全能，结论"建议纳入单独培养计划，给予专属资源与导师"。\n' +
    '- S级：点出"具备稀缺的体系建构能力"，给出岗位方向。\n' +
    '- A级：指出最强特质和可打磨方向。\n' +
    '- B级：指出思维盲区并给练习建议。\n' +
    '语气干脆，不用虚词。\n\n' +
    '=== 输出格式（严格遵守） ===\n' +
    '第一行输出JSON：{"essence":true/false,"logic":true/false,"rebuild":true/false,"street":true/false,"efficiency":true/false,"allrounder":true/false}\n' +
    '第二行空行\n' +
    '第三行开始输出天赋速评纯文本。\n' +
    '除此之外不要输出任何其他内容。';

  return { systemPrompt: systemPrompt, userPrompt: userPrompt };
}

// ==================== 解析合并响应 ====================

function parseCombinedResponse(text) {
  // 提取 JSON 部分
  var jsonMatch = text.match(/\{[^}]*"essence"[^}]*\}/);
  if (!jsonMatch) {
    // 尝试更宽松的匹配
    jsonMatch = text.match(/\{[\s\S]*?\}/);
  }
  if (!jsonMatch) throw new Error('NO_JSON_FOUND');

  var obj = JSON.parse(jsonMatch[0]);
  var dims = {
    essence:    obj.essence === true,
    logic:      obj.logic === true,
    rebuild:    obj.rebuild === true,
    street:     obj.street === true,
    efficiency: obj.efficiency === true,
    allrounder: obj.allrounder === true
  };

  // 提取评语部分（JSON 之后的文本）
  var jsonEnd = text.indexOf(jsonMatch[0]) + jsonMatch[0].length;
  var evalText = text.substring(jsonEnd).trim();

  // 清理可能的多余标记
  evalText = evalText.replace(/^[\n\r\s]+/, '').replace(/^===.*===[\n\r\s]*/g, '');

  return { dims: dims, evaluation: evalText };
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

  var debugInfo = { aiCalled: false, aiSuccess: false, aiError: null, usedFallback: false };

  try {
    var data = JSON.parse(event.body);
    var answers = data.answers;

    if (!answers || !Array.isArray(answers) || answers.length < 5) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: '答案不完整' }) };
    }

    // ===== 单次 AI 调用：判定 + 评语 =====
    var dims, evaluation;
    try {
      debugInfo.aiCalled = true;
      var cp = buildCombinedPrompt(answers);
      var rawResponse = await callAI(cp.systemPrompt, cp.userPrompt);
      console.log('AI原始响应:', rawResponse);

      var parsed = parseCombinedResponse(rawResponse);
      dims = parsed.dims;
      evaluation = parsed.evaluation;
      debugInfo.aiSuccess = true;

      // 如果评语为空，用模板兜底
      if (!evaluation || evaluation.length < 10) {
        var tempScore = calculateScore(dims);
        var tempCls = classify(tempScore, dims.allrounder);
        evaluation = fallbackEvaluation(dims, tempScore, tempCls);
        debugInfo.usedFallback = true;
      }

    } catch (aiErr) {
      console.error('AI调用失败，全量降级:', aiErr.message);
      debugInfo.aiError = aiErr.message;
      debugInfo.usedFallback = true;
      dims = { essence: false, logic: false, rebuild: false, street: false, efficiency: false, allrounder: false };
      evaluation = null; // 下面会生成
    }

    // ===== 加权计分 + 分班 =====
    var totalScore = calculateScore(dims);
    var cls = classify(totalScore, dims.allrounder);

    // 如果评语还没有，使用模板
    if (!evaluation) {
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
        evaluation: evaluation,
        _debug: debugInfo
      })
    };

  } catch (err) {
    console.error('云函数出错:', err);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: '服务器内部错误', _debug: debugInfo }) };
  }
};
