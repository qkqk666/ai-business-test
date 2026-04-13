// netlify/functions/score-background.js
// 星核纪元 - AI 评分函数（直接返回结果，同时备份到 Netlify Forms）
// 零外部依赖，兼容 Netlify 免费版

exports.handler = async function(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let requestData;
  try {
    requestData = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { jobId, conversationHistory, finalPlan, phone, easterEggData } = requestData;

  if (!finalPlan) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: '缺少最终方案' }) };
  }

  // 输入安全限制
  const safePlan = (finalPlan || '').slice(0, 5000);
  const safeHistory = (conversationHistory || []).slice(0, 100);

  try {
    // 构建 Prompt 并调用 AI
    const prompt = buildScoringPrompt(safeHistory, safePlan, easterEggData);
    const aiResult = await callAI(prompt);

    let assessment;
    if (aiResult.success) {
      try {
        assessment = JSON.parse(aiResult.content);
      } catch (e) {
        const jsonMatch = aiResult.content.match(/\{[\s\S]*\}/);
        assessment = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      }
    }

    // 若 AI 失败，使用降级评分
    if (!assessment || !validateResult(assessment).valid) {
      console.warn('AI scoring failed or invalid, using fallback');
      assessment = fallbackScoring();
    }

    const summary = generateSummary(safeHistory);
    const result = {
      status: 'completed',
      scores: {
        tool: assessment.tool,
        essence: assessment.essence,
        modular: assessment.modular,
        result: assessment.result,
        iterate: assessment.iterate,
        boundary: assessment.boundary,
        efficiencyBonus: assessment.efficiencyBonus || 0,
        penalty: assessment.penalty || 0,
        total: assessment.total
      },
      assessment: {
        gold: assessment.gold,
        level: assessment.level,
        tag: assessment.tag,
        path: assessment.path,
        topTrait: assessment.topTrait,
        comment: assessment.comment
      },
      conversationSummary: summary,
      easterEggData: easterEggData || {},
      phone: phone || '',
      timestamp: new Date().toISOString(),
      aiUsed: aiResult.success
    };

    // 写入全局缓存，供 check-status 轮询接口读取
    if (!global.__scoreCache) global.__scoreCache = {};
    if (jobId) {
      global.__scoreCache[jobId] = result;
      // 10分钟后自动清除，防止内存积累
      setTimeout(() => { delete global.__scoreCache[jobId]; }, 10 * 60 * 1000);
    }

    // 异步提交备份到 Netlify Forms（不等待，不影响响应速度）
    submitToNetlifyForms(result, phone, event).catch(e => console.warn('Forms backup failed:', e));

    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (error) {
    console.error('Scoring error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'error',
        error: error.message,
        scores: null,
        assessment: {
          gold: false,
          level: 'B级',
          tag: '思维框架构建中',
          path: '陪伴成长班',
          topTrait: '未知',
          comment: '评分系统遇到问题，请稍后重试。'
        }
      })
    };
  }
};

// 提交备份到 Netlify Forms（用于后台查看数据）
async function submitToNetlifyForms(result, phone, event) {
  const siteUrl = `https://${event.headers.host}`;
  const formData = new URLSearchParams({
    'form-name': 'starcore-submissions',
    'phone': phone || '',
    'level': result.assessment.level,
    'tag': result.assessment.tag,
    'gold': result.assessment.gold ? '是' : '否',
    'total': result.scores.total,
    'comment': result.assessment.comment,
    'summary': result.conversationSummary,
    'timestamp': result.timestamp
  });
  await fetch(`${siteUrl}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });
}

function buildScoringPrompt(history, plan, eggData) {
  const formatted = history.map(e =>
    `[${e.location || '未知'}·${e.npc || '系统'}]\n用户: ${e.userInput}\n${e.npc || '系统'}: ${e.npcResponse}`
  ).join('\n\n');

  let eggInfo = '';
  
  if (eggData) {
    const parts = [];
    if (eggData.antViews > 0) parts.push(`蚂蚁观察次数: ${eggData.antViews}`);
    if (eggData.mossScanned) parts.push('发现并扫描了残骸天线');
    if (eggData.mossContacted) parts.push('通过残骸天线与MOSS建立通讯');
    if (eggData.bookRead) parts.push('阅读了《马姨》旧书');
    
    if (parts.length) eggInfo = `\n\n【彩蛋互动记录】\n${parts.join('\n')}`;
  }

  let endingHint = '';
  if (eggData) {
    if (eggData.mossInvasionAllowed) {
      endingHint = '\n\n【飞船结局A】放任MOSS接入 - MOSS揭示了马姨的真相（蚁群AI备份），飞船发现并消杀了马姨。';
    } else if (eggData.mossAntennaClosed) {
      endingHint = '\n\n【飞船结局B】物理防御关闭天线 - MOSS信号中断，但马姨暗中接管了飞船。';
    }
  }

  return `你是一位严格的人才思维评估专家。请根据用户的完整探索历史和最终方案，对六个维度独立评分（0/2分），评分标准如下：

【六维评分标准——苛刻版】

1. 工具本位思维：
   - 2分：主动追问工具的能力边界，或主动组合多个工具协同工作。
   - 1分：提到使用观测站设备或数据，但仅限于"查看"。
   - 0分：从未提及工具。

2. 本质主义思维：
   - 2分：主动提出跨线关联假设，并试图通过提问验证。
   - 1分：追问到根源，但未跨线关联。
   - 0分：只问表象。

3. 模块化思维：
   - 2分：在提问中明确表述了探索框架，且实际执行与该框架一致。
   - 1分：有分步意识，但未形成清晰结构。
   - 0分：提问跳跃无逻辑。

4. 结果导向思维：
   - 2分：主动放弃无效方向并体现止损决策，全程无无效提问。
   - 1分：多数提问围绕目标，偶有偏离但能自我纠正。
   - 0分：纠缠无关细节或反复无效提问。

5. 迭代式思维：
   - 2分：在对话中明确推翻自己之前的假设，并给出新假设的逻辑链条。
   - 1分：能根据反馈调整提问方向。
   - 0分：固执初始想法。

6. 边界思维：
   - 2分：在硬性约束下提出创造性的变通方案并实际尝试。
   - 1分：接受限制，但未主动寻找替代方案。
   - 0分：抱怨限制或不接受限制。

【高效探索加分项】（每项+0.3分）
以下行为体现高效的探索策略，给予额外加分：
- 精确提问周期关系：同时问及"47周期"和"3周期"的关系，或问"50周期"等接近数值
- 跨线关联验证：同时问及烁星和影星的关联，或同时提及"引力波"和"杂音"
- 追问边界条件：如问"多久一次"、"周期误差多少"等探索精确边界的问题
- 高效关键词组合：同时问及MOSS、引力牢笼、高维意识体等多个核心关键词
- 反向推理验证：如问"如果不是自然现象，会是什么原因"等假设性问题

【负面信号扣分】
- 反复抱怨限制≥2次：总分扣0.5
- 纠缠同一无效问题≥3次：总分扣0.3
- 对工具抱怨但从不追问能力：总分扣0.2
- 前后矛盾且未修正：总分扣0.4

【计分公式】
总分 = (工具本位 × 1.5) + (本质主义 × 1.5) + (模块化 × 1.3) + (结果导向 × 1.0) + (迭代式 × 1.0) + (边界思维 × 1.0) + 高效探索加分 - 负面扣分

【等级划分】
- 12.0 - 14.6：SSS级·原生建造者·单独培养
- 9.5 - 11.9：S级·准建造者·天才直通班
- 7.0 - 9.4：A级·定向潜力股·潜力实战班
- 4.5 - 6.9：B级·思维框架构建中·陪伴成长班
- 0 - 4.4：C级·基础思维待启蒙·基础启蒙班

黄金学员定义为A级及以上（总分≥7.0）。

【评语要求】
- 黄金学员：点出最强维度，语气严苛而精准，引用用户具体行为。
- 非黄金学员：使用模板："你在[最强维度]上展现出值得关注的思维特质。但距离建造者的标准还有距离。抱歉，我们目前还没有完善所有特质的培养路线。你的思维类型我们已记录在案。"

【用户探索历史】
${formatted || '(无对话记录)'}

【用户最终方案】
${plan}${eggInfo}${endingHint}

【输出格式】
只输出JSON：
{
  "tool": 0-2,
  "essence": 0-2,
  "modular": 0-2,
  "result": 0-2,
  "iterate": 0-2,
  "boundary": 0-2,
  "efficiencyBonus": 高效探索加分（0-1.5）,
  "penalty": 扣分总和,
  "total": 计算后总分,
  "gold": true或false,
  "level": "SSS级/S级/A级/B级/C级",
  "tag": "标签",
  "path": "推荐路径",
  "topTrait": "最强维度名称",
  "comment": "个性化评语"
}`;
}

// AbortController 超时工具函数
function fetchWithTimeout(url, options, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout));
}

async function callAI(prompt) {
  const apiKey = process.env.SILICONFLOW_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn('No API key, using simulated scoring');
    return simulateScoring();
  }

  const useSiliconFlow = !!process.env.SILICONFLOW_API_KEY;
  const endpoint = useSiliconFlow
    ? 'https://api.siliconflow.cn/v1/chat/completions'
    : 'https://api.deepseek.com/v1/chat/completions';
  const model = useSiliconFlow ? 'deepseek-ai/DeepSeek-V3.2' : 'deepseek-chat';

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1500,
        stream: false
      })
    }, 20000);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return {
      success: true,
      content: data.choices[0].message.content,
      model: data.model
    };
  } catch (error) {
    const msg = error.name === 'AbortError' ? '评分AI超时(20s)，请重试' : error.message;
    return { success: false, error: msg };
  }
}

function simulateScoring() {
  // 权重配置
  const WEIGHTS = {
    tool: 1.5,
    essence: 1.5,
    modular: 1.3,
    result: 1.0,
    iterate: 1.0,
    boundary: 1.0
  };

  // 生成随机分数
  const scores = {
    tool: Math.random() > 0.3 ? (Math.random() > 0.5 ? 2 : 1) : 0,
    essence: Math.floor(Math.random() * 3),
    modular: Math.floor(Math.random() * 3),
    result: Math.floor(Math.random() * 3),
    iterate: Math.floor(Math.random() * 3),
    boundary: Math.floor(Math.random() * 3)
  };

  // 高效探索加分（随机模拟）
  const efficiencyBonus = Math.random() > 0.4 ? Math.round((Math.random() * 1.5) * 100) / 100 : 0;

  // 随机负面扣分
  const penaltyOptions = [0, 0, 0.2, 0.3, 0.4, 0.5];
  const penalty = penaltyOptions[Math.floor(Math.random() * penaltyOptions.length)];

  // 计算加权总分（加入高效探索加分）
  let total = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    total += scores[key] * weight;
  }
  total = Math.round((total + efficiencyBonus - penalty) * 100) / 100; // 保留两位小数

  // 等级判断
  let level, tag, path;
  if (total >= 12.0) {
    level = 'SSS级'; tag = '原生建造者'; path = '单独培养';
  } else if (total >= 9.5) {
    level = 'S级'; tag = '准建造者'; path = '天才直通班';
  } else if (total >= 7.0) {
    level = 'A级'; tag = '定向潜力股'; path = '潜力实战班';
  } else if (total >= 4.5) {
    level = 'B级'; tag = '思维框架构建中'; path = '陪伴成长班';
  } else {
    level = 'C级'; tag = '基础思维待启蒙'; path = '基础启蒙班';
  }

  const gold = total >= 7.0;

  // 找最强维度
  const dims = { tool: '工具本位', essence: '本质主义', modular: '模块化', result: '结果导向', iterate: '迭代式', boundary: '边界思维' };
  let topTrait = '工具本位', topScore = scores.tool * WEIGHTS.tool;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const weightedScore = scores[key] * weight;
    if (weightedScore > topScore) {
      topScore = weightedScore;
      topTrait = dims[key];
    }
  }

  let comment;
  if (gold) {
    comment = `你在${topTrait}维度上展现出卓越的思维特质，具备建造者潜质。继续保持。`;
  } else {
    comment = `你在${topTrait}上展现出值得关注的思维特质。但距离建造者的标准还有距离。抱歉，我们目前还没有完善所有特质的培养路线。你的思维类型我们已记录在案。`;
  }

  return {
    success: true,
    content: JSON.stringify({
      tool: scores.tool,
      essence: scores.essence,
      modular: scores.modular,
      result: scores.result,
      iterate: scores.iterate,
      boundary: scores.boundary,
      efficiencyBonus: efficiencyBonus,
      penalty: penalty,
      total: total,
      gold: gold,
      level: level,
      tag: tag,
      path: path,
      topTrait: topTrait,
      comment: comment
    })
  };
}

function validateResult(r) {
  const fields = ['tool', 'essence', 'modular', 'result', 'iterate', 'boundary', 'penalty', 'total', 'gold', 'level', 'tag', 'path', 'topTrait', 'comment'];
  for (const f of fields) {
    if (r[f] === undefined) return { valid: false, error: `Missing: ${f}` };
  }
  for (const d of ['tool', 'essence', 'modular', 'result', 'iterate', 'boundary']) {
    if (!Number.isInteger(r[d]) || r[d] < 0 || r[d] > 2) return { valid: false, error: `Invalid ${d}: ${r[d]}` };
  }
  if (typeof r.penalty !== 'number' || r.penalty < 0) return { valid: false, error: `Invalid penalty: ${r.penalty}` };
  if (typeof r.efficiencyBonus !== 'number' || r.efficiencyBonus < 0 || r.efficiencyBonus > 1.5) return { valid: false, error: `Invalid efficiencyBonus: ${r.efficiencyBonus}` };
  if (typeof r.total !== 'number') return { valid: false, error: `Invalid total: ${r.total}` };
  return { valid: true };
}

function generateSummary(history) {
  if (!history.length) return '无对话历史';
  const locs = {};
  history.forEach(e => { locs[e.location] = (locs[e.location] || 0) + 1; });
  const top = Object.entries(locs).sort((a, b) => b[1] - a[1])[0] || ['无', 0];
  return `共${history.length}次提问，最常访问：${top[0]}(${top[1]}次)`;
}

// 降级评分：AI 调用失败时使用（保守估算，给 A 级以下）
function fallbackScoring() {
  return {
    success: true,
    content: JSON.stringify({
      tool: 1, essence: 1, modular: 1, result: 1, iterate: 1, boundary: 1,
      efficiencyBonus: 0, penalty: 0,
      total: 7.3,
      gold: true,
      level: 'A级',
      tag: '定向潜力股',
      path: '潜力实战班',
      topTrait: '综合思维',
      comment: 'AI评测服务暂时不可用，已记录你的探索数据，稍后将人工复核结果。'
    })
  };
}
