/**
 * /functions/api/assess.js
 * 最终评分 AI 接口（Cloudflare Pages Functions）
 * MBTI融合评分系统：六维评分 + 五种建造者类型
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = await request.json();
    const {
      answers = {},
      behavior = {}
    } = body;

    const {
      answer1 = '',
      answer2 = '',
      answer3 = '',
      answer4 = '',
      critique = '',
      final = ''
    } = answers;

    const {
      dialogueRetryCount = 0,
      preDiscovery = false,
      reviewCount = 0,
      questionCount = 0
    } = behavior;

    const apiKey = env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      // 无API密钥时返回默认结果
      return new Response(JSON.stringify(getDefaultResult()), {
        status: 200, headers: corsHeaders,
      });
    }

    const systemPrompt = `你是一位认知心理学专家。用户参与了「浮空岛·回响」评估。以下是用户全部回答和行为数据，请生成六维评分和建造者类型报告。

【强制回答】
回答一（水源树线索后）：${answer1}
回答二（守林人对话后）：${answer2}
回答三（共鸣石节奏后）：${answer3}
回答四（岛志推送后）：${answer4}
反例测试：${critique}
最终方案：${final}

【行为数据】
- 守林人追问次数：${dialogueRetryCount}
- 是否在系统提示前主动尝试节奏：${preDiscovery ? '是' : '否'}
- 平均回答前回顾线索次数：${reviewCount}
- 总探索次数：${questionCount}

【六维评分定义】（每项1-10分）
1. 工具本位：能否主动寻找并有效利用线索和工具
2. 本质主义：能否透过现象看本质，不被表面信息迷惑
3. 模块化：能否分类整理、构建清晰的框架
4. 结果导向：能否提出可行的解决方案
5. 迭代式：能否假设-验证-调整的循环思维
6. 边界思维：能否在约束内找到最优解

【建造者类型判定规则】
- 星核建造者：工具本位≥9 且 本质主义≥9 且 总分≥50 且 无任何维度<7
- 轨道架构师：工具本位≥8 且 模块化≥8 且 总分≥42（不满足星核建造者）
- 引力探索者：工具本位≥7 且 迭代式≥7 且 总分≥35（不满足以上）
- 边界测绘师：工具本位≥6 且 边界思维≥7 且 总分≥30（不满足以上）
- 信号接收者：兜底类型

【类型描述模板】
星核建造者：
- 核心特质：工具本位 + 本质主义双高
- 正面描述：你天然地把工具视为自身能力的延伸，能在噪音中精准锁定核心矛盾。你不满足于"怎么做"，总是先追问"为什么"。给你一个陌生领域，你能在极短时间内找到撬动点。
- 思维引力：你不依赖别人的路径，自己造工具、找答案。
- 调谐频率：当你遇到别人的困惑，试着不直接给答案，而是先问"你卡在哪一步"——这能让你的引力覆盖更多人。

轨道架构师：
- 核心特质：工具本位 + 模块化双高
- 正面描述：你天然地把复杂问题拆成可执行的步骤，能把重复的工作标准化、模板化。给你一堆混乱的信息，你能搭出清晰的框架。你的思维自带"模块化"属性。
- 思维引力：混乱在你眼里是待整理的秩序。
- 调谐频率：当你遇到复杂问题时，试着先画框架图而不是直接动手——这能让你的架构能力更上一层。

引力探索者：
- 核心特质：工具本位 + 迭代式双高
- 正面描述：你不怕犯错，信奉"先跑通再说"。给你一个新工具，你会在尝试中快速掌握它的核心功能。你的思维模式是"假设→验证→调整"的循环。
- 思维引力：错路也是路，只要你走得够快。
- 调谐频率：当你遇到困难时，先行动再优化——你的探索速度就是你的优势。

边界测绘师：
- 核心特质：工具本位 + 边界思维双高
- 正面描述：你在规则内行动自如，总能找到最优路径。你清晰地知道自己的边界，不打无准备之仗。给你一个约束条件，你能在限定内找到最好的解。
- 思维引力：规则是你的地图，不是你的牢笼。
- 调谐频率：当你感到受限，试着先理解边界的真正含义——有时候边界比你想的更宽。

信号接收者：
- 核心特质：六维中得分最高的两项
- 正面描述：你正在接收来自宇宙的信号。有些频率已经清晰，有些还在调谐中。每种思维特质都有它的轨道——你的轨道正在成形。
- 思维引力：信号的强度取决于你的调谐频率。
- 调谐频率：保持探索的热情，继续收听来自世界的信号——你会越来越清晰地找到自己的频道。

【输出格式】严格输出如下JSON，不输出任何其他内容：
{
  "scores": {
    "tool": 1-10,
    "essence": 1-10,
    "modular": 1-10,
    "result": 1-10,
    "iterate": 1-10,
    "boundary": 1-10,
    "total": 分数合计
  },
  "builder_type": "星核建造者/轨道架构师/引力探索者/边界测绘师/信号接收者",
  "core_trait": "核心特质描述",
  "aux_trait": "辅助特质描述",
  "frontend_description": "正面类型描述（80字内）",
  "tuning_frequency": "调谐频率（40字内，正面语气）",
  "grade": "A类/B类/C类（仅后台使用，不展示给用户）"
}`;

    const resp = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3',
        messages: [{ role: 'user', content: systemPrompt }],
        max_tokens: 600,
        temperature: 0.5,
        response_format: { type: 'json_object' },
      }),
    });

    if (!resp.ok) {
      return new Response(JSON.stringify(getDefaultResult()), {
        status: 200, headers: corsHeaders,
      });
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || '{}';

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : getDefaultResult();
    }

    // 确保有必要的字段
    result = validateAndFillResult(result);

    return new Response(JSON.stringify(result), {
      status: 200, headers: corsHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify(getDefaultResult()), {
      status: 200, headers: corsHeaders,
    });
  }
}

function validateAndFillResult(result) {
  const defaultResult = getDefaultResult();
  
  // 确保 scores 对象存在
  if (!result.scores) {
    result.scores = defaultResult.scores;
  }
  
  // 计算总分
  if (result.scores) {
    const { tool = 5, essence = 5, modular = 5, result: res = 5, iterate = 5, boundary = 5 } = result.scores;
    result.scores.total = tool + essence + modular + res + iterate + boundary;
  }
  
  // 确保建造者类型
  if (!result.builder_type) {
    result.builder_type = defaultResult.builder_type;
  }
  
  // 根据类型设置核心和辅助特质
  result = setTraitsByType(result);
  
  // 确保 grade
  if (!result.grade) {
    result.grade = determineGrade(result.scores);
  }
  
  return result;
}

function setTraitsByType(result) {
  const type = result.builder_type;
  
  const typeInfo = {
    '星核建造者': { core: '工具本位 + 本质主义', aux: '六维最高项', desc: '你天然地把工具视为自身能力的延伸，能在噪音中精准锁定核心矛盾。', tune: '试着不直接给答案，而是先问"你卡在哪一步"。' },
    '轨道架构师': { core: '工具本位 + 模块化', aux: '六维最高项', desc: '你天然地把复杂问题拆成可执行的步骤，能把混乱搭成清晰的框架。', tune: '先画框架图而不是直接动手，让架构能力更上一层。' },
    '引力探索者': { core: '工具本位 + 迭代式', aux: '六维最高项', desc: '你不怕犯错，信奉"先跑通再说"，在尝试中快速掌握核心功能。', tune: '先行动再优化，你的探索速度就是你的优势。' },
    '边界测绘师': { core: '工具本位 + 边界思维', aux: '六维最高项', desc: '你在规则内行动自如，总能找到最优路径，清晰地知道自己的边界。', tune: '先理解边界的真正含义，有时候边界比你想的更宽。' },
    '信号接收者': { core: '信号调谐中', aux: '频率待校准', desc: '你正在接收来自宇宙的信号。有些频率已经清晰，有些还在调谐中。', tune: '保持探索的热情，继续收听来自世界的信号。' }
  };
  
  const info = typeInfo[type] || typeInfo['信号接收者'];
  
  if (!result.core_trait) result.core_trait = info.core;
  if (!result.aux_trait) result.aux_trait = info.aux;
  if (!result.frontend_description) result.frontend_description = info.desc;
  if (!result.tuning_frequency) result.tuning_frequency = info.tune;
  
  return result;
}

function determineGrade(scores) {
  if (!scores) return 'C类';
  
  const total = scores.total || 0;
  const { tool = 0, essence = 0, modular = 0, result: res = 0, iterate = 0, boundary = 0 } = scores;
  
  // A类：总分≥50，无维度<7
  if (total >= 50 && tool >= 7 && essence >= 7 && modular >= 7 && res >= 7 && iterate >= 7 && boundary >= 7) {
    return 'A类';
  }
  
  // B类：总分≥35
  if (total >= 35) {
    return 'B类';
  }
  
  return 'C类';
}

function getDefaultResult() {
  return {
    scores: {
      tool: 5,
      essence: 5,
      modular: 5,
      result: 5,
      iterate: 5,
      boundary: 5,
      total: 30
    },
    builder_type: '信号接收者',
    core_trait: '信号调谐中',
    aux_trait: '频率待校准',
    frontend_description: '你正在接收来自宇宙的信号。有些频率已经清晰，有些还在调谐中。每种思维特质都有它的轨道——你的轨道正在成形。',
    tuning_frequency: '保持探索的热情，继续收听来自世界的信号——你会越来越清晰地找到自己的频道。',
    grade: 'B类'
  };
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}