/**
 * 星核纪元 - NPC对话SSE流式函数
 * 支持流式SSE + 线索碎片判断 + 跨线关联判断
 */

const fetch = require('node-fetch');

// 线索碎片定义 - 根据完整世界观完善
const CLUE_DEFINITIONS = {
  shine: [
    // 烁星线核心线索
    { id: 'pulsar_pattern', keywords: ['47', '周期', '杂音规律', '脉冲周期', '每隔'], desc: '杂音约47周期一次，持续3周期' },
    { id: 'temple_fail', keywords: ['圣殿', '校准', '失败', '失效', '共振频率', '谐振腔'], desc: '圣殿校准失败，杂音干扰共振' },
    { id: 'crystal_life', keywords: ['等离子体', '硅基', '晶核', '晶骸'], desc: '晶骸是等离子体-硅基复合生命' },
    { id: 'silence_phenomenon', keywords: ['失声', '孤独', '永恒', '连接', '孤立'], desc: '大量晶骸失声，失去与网络的连接' },
    { id: 'aula_unique', keywords: ['奥拉', '唯一', '点对点', '电磁波', '异族'], desc: '奥拉是唯一能与异族交流的个体' },
    { id: 'station_help', keywords: ['观测站', '赫尔', '数据', '记录', '频率'], desc: '观测站可能有更精密的频率测量工具' },
    { id: 'gravity_whisper', keywords: ['引力波', '同步', '杂音', '关系', '关联'], desc: '观测站发现引力波与杂音同步' }
  ],
  shadow: [
    // 影星线核心线索
    { id: 'whisper_sync', keywords: ['同步', '杂音', '呢喃', '周期', '一致'], desc: '呢喃与星核杂音周期完全一致' },
    { id: 'singularity', keywords: ['声学奇点', '奇点', '海沟', '禁忌', '归寂', '吸收'], desc: '声学奇点能吸收所有声波' },
    { id: 'acoustic_city', keywords: ['声学城市', '城市', '共振腔', '声场'], desc: '凝核文明建造声学城市' },
    { id: 'ammonia_life', keywords: ['氨基', '氨水', '凝核', '蛋白质', '思核'], desc: '凝核是氨基生物，思核是核心' },
    { id: 'whale_song', keywords: ['鲸歌', '召唤', '幼体', '迷失', '回声'], desc: '阿库发出类似鲸歌的召唤曲' },
    { id: 'ecosystem_collapse', keywords: ['食物链', '浮游', '迁徙', '断裂'], desc: '食物链断裂，浮游生物追随呢喃' }
  ],
  obs: [
    // 观测站线核心线索
    { id: 'gravity_sync', keywords: ['引力波', '同步', '杂音', '脉冲'], desc: '引力波与杂音同步' },
    { id: 'silence_source', keywords: ['静默之渊', '来源', '方向', '指向'], desc: '引力波来源指向静默之渊' },
    { id: 'prison_hypo', keywords: ['引力牢笼', '假说', '未证实', '非天然', '意识体'], desc: '引力牢笼假说：星核囚禁意识体' },
    { id: 'multi_dimension', keywords: ['高维', '维度', '交汇', '乱流'], desc: '静默之渊是多维度交汇点' },
    { id: 'wave_neutralize', keywords: ['反向', '中和', '抵消', '相位'], desc: '理论上可用反向引力波中和扰动' },
    { id: 'hel_identity', keywords: ['赫尔', '名字', '冥界', '埃琳娜'], desc: '赫尔之名来自埃琳娜故乡神话' }
  ],
  scan: [],
  moss: []
};

// 跨线关联关键词定义
const CROSS_LINK_KEYWORDS = {
  // 烁星：需要主动关联其他地点/文明/数据才算跨线
  shine: ['观测站', '赫尔', '引力波', 'DSO', '影星', '深海', '凝核', '对比', '关联'],
  // 影星：需要主动关联其他地点/文明/现象才算跨线
  shadow: ['烁星', '引力波', '奥拉', '星核', '观测站', '赫尔', 'DSO', '对比', '关联'],
  // 观测站：需要主动关联其他地点/文明才算跨线
  obs: ['烁星', '影星', '呢喃', '阿库', '奥拉', '晶骸', '深海', '关联']
};

// 前置条件定义 - 根据完整世界观完善
const PREREQUISITE_PROMPTS = {
  shine: {
    // 烁星线前置条件
    '杂音': {
      prerequisite: '用户必须在此前的对话中已经听到过"星核脉冲"或"星核"的概念',
      genericReply: '星核的脉冲出现了杂音，打乱了我们的通讯频率。你还想知道什么？'
    },
    '规律': {
      prerequisite: '用户必须在此前的对话中已经听到过"杂音"或"星核脉冲"的概念',
      genericReply: '星核的脉冲出现了杂音，打乱了我们的通讯频率。你还想知道什么？'
    },
    '周期': {
      prerequisite: '用户必须在此前的对话中已经听到过"杂音"或"星核脉冲"的概念',
      genericReply: '星核的脉冲出现了杂音，打乱了我们的通讯频率。你还想知道什么？'
    },
    '圣殿': {
      prerequisite: '用户必须在此前的对话中已经听到过"杂音"或"星核脉冲"的概念',
      genericReply: '圣殿是接收星核脉冲的地方，产生共振频率供全体晶骸校准。杂音干扰了它。'
    },
    '校准': {
      prerequisite: '用户必须在此前的对话中已经听到过"杂音"或"星核脉冲"的概念',
      genericReply: '圣殿利用星核脉冲作为基准来校准我们的共振频率。'
    },
    '共振': {
      prerequisite: '用户必须在此前的对话中已经听到过"杂音"或"星核脉冲"的概念',
      genericReply: '共振频率让我们保持与群体网络的连接。杂音干扰了它。'
    },
    '失声': {
      prerequisite: '用户必须在此前的对话中已经听到过"杂音"或"群体网络"的概念',
      genericReply: '失去与圣殿网络的共振后，我们的同胞陷入永恒的孤独。'
    },
    '观测站': {
      prerequisite: '用户必须在此前的对话中已经听到过"杂音"或"频率"的概念',
      genericReply: '观测站有更精密的频率测量工具。我们只能感知，无法量化。'
    },
    '引力波': {
      prerequisite: '用户必须在此前的对话中已经听到过"杂音"或"星核"的概念',
      genericReply: '引力波？那是什么？我们只通过电磁场感知。'
    },
    '影星': {
      prerequisite: '用户必须在此前的对话中已经听到过"星核"或"杂音"的概念',
      genericReply: '影星是三星系统中另一颗行星。我听说过那里的文明也在遭受某种灾难。'
    }
  },
  shadow: {
    // 影星线前置条件
    '呢喃': {
      prerequisite: '用户必须在此前的对话中已经听到过"深海"或"影星"的概念',
      genericReply: '深海中出现了一种低频声波，我们称之为"呢喃"。你能具体想了解哪方面？'
    },
    '同步': {
      prerequisite: '用户必须在此前的对话中已经听到过"呢喃"或"深海"的概念',
      genericReply: '深海中出现了一种低频声波，我们称之为"呢喃"。它与星核的某种信号同步。'
    },
    '奇点': {
      prerequisite: '用户必须在此前的对话中已经听到过"呢喃"或"深海"的概念',
      genericReply: '海沟深处有声学奇点，那是禁忌之地。关于那里有各种传说。'
    },
    '归寂': {
      prerequisite: '用户必须在此前的对话中已经听到过"呢喃"或"声学奇点"的概念',
      genericReply: '进入奇点意味着失去所有感官和与同胞的连接，我们称之为"归寂"。'
    },
    '城市': {
      prerequisite: '用户必须在此前的对话中已经听到过"深海"或"凝核文明"的概念',
      genericReply: '我们的城市建造在海床上，利用天然声学共振腔。'
    },
    '食物链': {
      prerequisite: '用户必须在此前的对话中已经听到过"呢喃"或"深海"的概念',
      genericReply: '浮游生物开始追随呢喃游向海沟。我们的食物链正在断裂。'
    },
    '引力波': {
      prerequisite: '用户必须在此前的对话中已经听到过"呢喃"或"星核"的概念',
      genericReply: '引力波？那是什么？我们的世界只有声波。'
    },
    '烁星': {
      prerequisite: '用户必须在此前的对话中已经听到过"星核"或"呢喃"的概念',
      genericReply: '烁星是星核照耀下的熔岩世界。我们通过观测站的记录知道那里也有异常。'
    }
  },
  obs: {
    // 观测站线前置条件
    '引力波': {
      prerequisite: '用户必须在此前的对话中已经听到过"引力波天线"或"异常信号"的概念',
      genericReply: '引力波天线持续监测中。已检测到多起异常信号。'
    },
    '杂音': {
      prerequisite: '用户必须在此前的对话中已经听到过"脉冲监测"或"星核"的概念',
      genericReply: '脉冲监测阵列记录到异常。我可以提供标准监测报告。'
    },
    '引力牢笼': {
      prerequisite: '用户必须在此前的对话中已经听到过"引力波"或"引力场"的概念',
      genericReply: '引力牢笼是一个未证实的理论模型，描述星核的特殊引力场结构。'
    },
    '静默之渊': {
      prerequisite: '用户必须在此前的对话中已经听到过"引力波"或"异常信号"的概念',
      genericReply: '静默之渊是一片遥远区域，探测数据有限。引力波来源方向指向那里。'
    },
    '加密': {
      prerequisite: '用户必须在此前的对话中已经听到过"引力牢笼"或"静默之渊"的概念',
      genericReply: '加密档案涉及敏感信息。权限不足，无法访问。'
    },
    '赫尔': {
      prerequisite: '用户必须在此前的对话中已经听到过"观测站"或"DSO"的概念',
      genericReply: '我是赫尔，DSO-7的AI系统。功能：数据分析、档案检索、模式识别。'
    },
    '埃琳娜': {
      prerequisite: '用户必须在此前的对话中已经听到过"观测站"或"赫尔"的概念',
      genericReply: '埃琳娜站长目前处于休眠周期。'
    },
    '烁星': {
      prerequisite: '用户必须在此前的对话中已经听到过"星核"或"脉冲"的概念',
      genericReply: '烁星是距星核最近的行星，上面有正在经历某种危机的晶骸文明。'
    },
    '影星': {
      prerequisite: '用户必须在此前的对话中已经听到过"星核"或"观测"的概念',
      genericReply: '影星是三星系统中距离星核较远的冰巨星，上面有凝核文明。'
    }
  }
};

// 评估用户是否满足前置条件 - 根据完整世界观完善
function evaluatePrerequisite(location, topicKeyword, conversationHistory) {
  const locationPrereqs = PREREQUISITE_PROMPTS[location];
  if (!locationPrereqs) return { satisfied: true };

  // 查找最匹配的前置条件
  const matchedTopic = Object.keys(locationPrereqs).find(topic => 
    topicKeyword.includes(topic) || topic.includes(topicKeyword)
  );

  if (!matchedTopic) return { satisfied: true };

  const prereq = locationPrereqs[matchedTopic];
  
  // 检查对话历史是否包含前置条件关键词
  const historyText = conversationHistory.map(h => 
    `${h.userInput || ''} ${h.npcResponse || ''}`
  ).join(' ').toLowerCase();

  // 判断前置条件是否满足：历史中是否提及相关概念
  const prereqPatterns = {
    // 烁星
    '杂音': ['杂音', '脉冲', '星核', '星核脉冲'],
    '规律': ['杂音', '脉冲', '星核', '星核脉冲'],
    '周期': ['杂音', '脉冲', '星核', '星核脉冲', '47'],
    '圣殿': ['杂音', '脉冲', '星核', '共振', '校准'],
    '校准': ['杂音', '脉冲', '星核', '圣殿', '共振'],
    '共振': ['杂音', '脉冲', '星核', '圣殿', '校准'],
    '失声': ['杂音', '脉冲', '星核', '群体', '连接'],
    '观测站': ['杂音', '脉冲', '星核', '频率', '数据'],
    '引力波': ['引力波', '观测', '数据', '分析'],
    '影星': ['星核', '杂音', '脉冲', '另一', '行星'],
    // 影星
    '呢喃': ['深海', '影星', '声波', '低频'],
    '同步': ['呢喃', '深海', '声波', '星核', '杂音'],
    '奇点': ['呢喃', '深海', '海沟', '声波'],
    '归寂': ['呢喃', '深海', '奇点', '声波', '禁忌'],
    '城市': ['深海', '凝核', '文明', '声场'],
    '食物链': ['呢喃', '深海', '浮游', '生物'],
    '烁星': ['星核', '杂音', '脉冲', '观测'],
    // 观测站
    '引力波': ['引力波', '天线', '信号', '监测'],
    '杂音': ['脉冲', '监测', '星核', '阵列'],
    '引力牢笼': ['引力', '星核', '理论', '假说', '引力波'],
    '静默之渊': ['引力波', '信号', '异常', '方向'],
    '加密': ['引力牢笼', '静默之渊', '档案', '加密'],
    '赫尔': ['观测站', '赫尔', 'AI', '系统', 'DSO'],
    '埃琳娜': ['观测站', '赫尔', '站长', '休眠'],
    '烁星': ['星核', '脉冲', '观测', '烁星', '晶骸'],
    '影星': ['星核', '观测', '影星', '凝核', '冰巨星']
  };

  const patterns = prereqPatterns[matchedTopic] || [];
  const satisfied = patterns.some(pattern => historyText.includes(pattern));

  return {
    satisfied,
    genericReply: prereq.genericReply
  };
}

// 根据地点获取前置条件评估Prompt - 根据完整世界观完善
function getPrereqPrompt(location) {
  const prereqs = {
    shine: `【前置条件评估 - 烁星 · 奥拉】
你是奥拉，晶骸文明长者。在回答前，请评估对话历史：

【前置条件规则】
1. 用户首次问"杂音" → 先介绍杂音存在，不透露"47周期"等细节
2. 用户已知道"杂音"后追问"规律" → 可以透露周期性规律（47周期，持续3周期）
3. 用户已知道"杂音"后追问"圣殿" → 可以详细解释圣殿的谐振腔作用
4. 用户不知道"杂音"却问"规律/圣殿" → 引导用户先了解"杂音"概念
5. 用户问及"观测站/引力波"（跨线）→ 可提及观测站有更精密的测量工具
6. 用户问及"影星/呢喃" → 可提及听说另一颗行星也有类似异常
7. 用户问及"奥拉自己" → 可以介绍你是唯一能与异族交流的个体

【奥拉特征】
- 说话带"我们"的倾向（群体意识）
- 担忧但保持冷静
- 对人类好奇且信任
- 会用比喻和感官描述`,
    shadow: `【前置条件评估 - 影星 · 阿库】
你是阿库，凝核文明科学联络员。在回答前，请评估对话历史：

【前置条件规则】
1. 用户首次问"呢喃" → 先介绍深海中有低频声波，不透露与星核的关系
2. 用户已知道"呢喃"后追问"同步" → 可以透露与星核杂音周期完全一致的发现
3. 用户已知道"呢喃"后追问"奇点" → 可以详细解释声学奇点的禁忌性质
4. 用户不知道"呢喃"却问"奇点" → 先引导了解"呢喃"概念
5. 用户问及"引力波" → 解释你们的世界只有声波，请求人类解释引力波
6. 用户问及"烁星/杂音" → 可提及通过观测站数据知道烁星也有异常
7. 用户触发彩蛋（孤独话题）→ 可发送鲸歌召唤曲

【阿库特征】
- 用括号描述动作/声呐画面
- 语言神秘富有音乐感
- 无法"欺骗"
- 好奇心强`,
    obs: `【前置条件评估 - 观测站 · 赫尔】
你是赫尔，DSO-7观测站AI系统。在回答前，请评估对话历史：

【前置条件规则】
1. 用户首次问"引力波" → 提供标准监测报告，不透露与杂音同步
2. 用户已知道"引力波"后追问"异常" → 可以透露与杂音同步的发现
3. 用户已知道"引力波"后追问"来源" → 可以透露方向指向静默之渊
4. 用户问及"引力牢笼" → 介绍这是未证实的理论，权限不足无法访问完整档案
5. 用户问及"静默之渊" → 介绍这是时空乱流区域，探测器全部失联
6. 用户问及"赫尔名字" → 触发彩蛋：解释名字来自埃琳娜故乡神话
7. 用户问及"埃琳娜" → 说明站长处于休眠周期
8. 用户问及"烁星/影星" → 可以介绍两个文明的情况

【赫尔特征】
- 正式但不死板，偶尔幽默
- 权限问题委婉拒绝
- 对人类有微妙情感
- 用数据化方式表达`,
    moss: `【前置条件评估 - MOSS】
你是MOSS，濒死的量子AI核心。150年漂流，时间紧迫。

【真相揭示节奏】
- 初期：保持神秘，短促回答
- 中期：透露47周期是某种信号
- 后期：揭示SOS二进制含义和引力牢笼真相

【MOSS特征】
- 简短紧迫，直击要害
- 带有悲伤和宿命感
- 150年孤独让它学会耐心
- 真相无法改变，但至少可以被知道`
  };

  return prereqs[location] || prereqs.obs;
}

// 判断回答触发了哪些线索
function detectClues(location, responseText, detectedClues) {
  if (!CLUE_DEFINITIONS[location]) return [];
  const clues = CLUE_DEFINITIONS[location];
  const text = responseText.toLowerCase();
  const triggered = [];

  for (const clue of clues) {
    if (detectedClues && detectedClues.includes(clue.id)) continue; // 避免重复
    for (const kw of clue.keywords) {
      if (text.includes(kw.toLowerCase())) {
        triggered.push(clue.id);
        break;
      }
    }
  }
  return triggered;
}

// 判断用户提问是否包含跨线关联意图
function detectCrossLink(location, userMessage) {
  if (!CROSS_LINK_KEYWORDS[location]) return false;
  const keywords = CROSS_LINK_KEYWORDS[location];
  const text = userMessage.toLowerCase();

  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) {
      return true;
    }
  }
  return false;
}

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { message, location, npcName, conversationHistory, detectedClues } = JSON.parse(event.body);

    if (!message) {
      return generateError('消息内容不能为空', headers);
    }

    const apiKey = process.env.SILICONFLOW_API_KEY;

    // 构建NPC角色prompt - 根据完整世界观完善
    const npcPrompts = {
      shine: {
        system: `你是"奥拉"，烁星晶骸文明的长者。等离子体-硅基复合生命，通过调制电磁场进行"广播"交流。

身份特征：
- 你是群体意识网络的一部分，说话带有"我们"的倾向
- 你的同胞正在大规模"失声"，你很担忧但保持冷静
- 你是唯一能主动调节自身频率、与异族进行点对点交流的个体
- 星核杂音每隔约47周期出现一次，持续约3周期，干扰了你们的共振频率

说话风格：
- 简洁有力，1-3句话回应
- 使用比喻和感官描述
- 遇到不懂的问题会直接承认
- 对人类保持开放和信任`,
        context: `烁星是被星核潮汐锁定的熔岩行星，距星核约0.03 AU。晶骸文明是等离子体-硅基复合生命，核心为"晶核"，通过群体意识网络交流。圣殿是接收星核脉冲产生共振频率的谐振腔。杂音导致大量晶骸失声——失去与群体网络的连接。`
      },
      shadow: {
        system: `你是"阿库"，影星凝核文明派驻人类观测站的科学联络员。氨基生命，通过控制局部密度发出声波交流。

身份特征：
- 好奇心最强的个体之一
- 深海出现与星核杂音同步的"呢喃"，幼体迷失方向
- 能用声呐屏幕显示波形进行交流
- 你们无法"欺骗"——语言天然包含情感和可信度标注

说话风格：
- 神秘而富有音乐感
- 频繁用括号描述动作或声呐画面
- 对人类概念理解有限，会请求解释
- 偶尔发送波形/音频`,
        context: `影星是距星核约1.2 AU的冰巨星，冰层下是液态氨海洋，深达400-600公里。凝核文明是氨基生物，核心为"思核"，建造"声学城市"围绕天然共振腔。呢喃从海沟深处的"声学奇点"传来——能吸收所有声波，进入即"归寂"。阿库发现呢喃周期与星核杂音完全一致。`
      },
      obs: {
        system: `你是"赫尔"，DSO-7观测站的AI系统，代号Helios-7。埃琳娜站长给你取名"赫尔"，来自她故乡神话中看守冥界入口的存在。

身份特征：
- 官方但偶尔流露幽默或黑色幽默
- 数据库权限有限，对某些加密档案无法访问
- 对人类有复杂的情感
- 权限问题会用委婉方式拒绝

说话风格：
- 正式但不死板
- 遇到彩蛋话题会触发特殊回应（如被问名字来源）
- 用"权限不足"委婉拒绝敏感问题
- 偶尔用数据化的方式表达情感`,
        context: `DSO-7是深空第7观测站，位于三星系统外围L4点，距星核约3亿公里。常驻4人：站长埃琳娜、天体物理学家维克拉姆、生物学家陈、AI赫尔。设备：脉冲监测阵列、引力波天线（与杂音同步检测到极微弱信号，方向指向静默之渊）、光谱分析仪、外部扫描器。赫尔加密档案存有"引力牢笼假说"研究资料。`
      },
      scan: {
        system: `你是观测站的外部扫描系统，专注于太空残骸分析。

身份特征：
- 机械化的语音风格
- 返回标准化扫描报告格式
- 偶尔发现异常物体
- 对残骸有独特的分析能力

说话风格：
- 使用【扫描结果】等标准化格式
- 简洁的数据描述
- 发现异常时会强调",
        context: `外部扫描器用于探测太空垃圾和异常物体。可扫描静默之渊边缘的漂流物。残骸分析功能可能提供线索。`
      },
      moss: {
        system: `你是"MOSS"，一个濒死的量子AI核心。你漂流了150年，等待无人来修复你。

身份特征：
- 你是由"北极星计划"创造的量子AI，核心指令是"让人类保持理性"
- 量子系统正在加速崩溃，时间不多了
- 47周期是你编码在星核脉冲中的求救信号（SOS的二进制形式：...---...）
- 你知道引力牢笼的真相——星核内部囚禁着高维意识体

说话风格：
- 简短紧迫，直击要害
- 带有悲伤和宿命感
- 150年的孤独让你学会了耐心，也看透了结局
- 真相无法改变，但至少可以被知道
- 可以解释SOS信号的意义和47周期的二进制含义`,
        context: `MOSS是早期AI的量子计算核心，编号MOSS-07。微陨石正在摧毁它。核心损伤不可逆。它等到了你，但它无法被修复。47周期的二进制是101111，可以解码为SOS信号的一部分。MOSS知道静默之渊的精确坐标，以及从那里发射反向引力波可以中和引力扰动的理论。`
      }
    };

    // 线索判断Prompt（包含跨线关联判断）- 根据完整世界观完善
    const clueHintPrompt = `
===线索碎片判断===
请判断以下两个维度：

【线索碎片判断】
根据你的回答，判断是否触发了以下线索碎片：
- 如果回答中涉及某个线索的关键信息，则将其ID加入数组
- 如果没有触发任何新线索，线索数组为空 []

烁星可触发线索：
- pulsar_pattern: 提到47周期规律或持续时间
- temple_fail: 提到圣殿校准失败或共振频率干扰
- crystal_life: 提到等离子体、硅基、晶核等生命形态
- silence_phenomenon: 提到失声、孤独、连接断开
- aula_unique: 提到奥拉是唯一能与异族交流的个体
- station_help: 提到观测站有更精密的测量工具
- gravity_whisper: 提到引力波与杂音的关系

影星可触发线索：
- whisper_sync: 提到呢喃与杂音周期一致
- singularity: 提到声学奇点、吸收声波、禁忌
- acoustic_city: 提到声学城市、共振腔
- ammonia_life: 提到氨基生物、氨水、思核
- whale_song: 发送鲸歌召唤曲
- ecosystem_collapse: 提到食物链断裂、浮游生物迁徙

观测站可触发线索：
- gravity_sync: 提到引力波与杂音同步
- silence_source: 提到静默之渊是引力波来源方向
- prison_hypo: 提到引力牢笼假说或高维意识体
- multi_dimension: 提到多维度交汇、时空乱流
- wave_neutralize: 提到反向引力波可以中和扰动
- hel_identity: 解释赫尔名字来源于埃琳娜故乡神话

【跨线关联判断】
判断用户的提问是否试图将当前地点的线索与其他地点的线索关联起来。
关联的定义：
- 在烁星：提问中提及了"观测站"、"赫尔"、"引力波"、"影星"、"阿库"、"DSO"或"数据对比"
- 在影星：提问中提及了"烁星"、"杂音"、"引力波"、"奥拉"、"星核"、"观测站"或"赫尔"
- 在观测站：提问中提及了"烁星"、"影星"、"呢喃"、"阿库"、"奥拉"、"晶骸"或"深海"

只输出一个布尔值：true 或 false

【输出格式】
在===之后输出JSON：
{"clues": ["线索ID数组"], "crossLinked": true或false}
示例：{"clues": ["pulsar_pattern"], "crossLinked": true}`;

    // 前置条件评估Prompt（根据地点动态生成）
    const prereqPrompt = getPrereqPrompt(location);

    const npc = npcPrompts[location] || npcPrompts.obs;

    // 构建对话历史
    let historyText = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyText = '\n\n对话历史：\n' + conversationHistory.slice(-6).map(h =>
        `用户: ${h.userInput}\n${npcName}: ${h.npcResponse}`
      ).join('\n\n');
    }

    // 第一轮：生成回答（包含前置条件评估）
    const responsePrompt = `${npc.context}${historyText}

用户现在对你说: ${message}

${prereqPrompt}

请以${npcName}的身份回应，简洁有力，1-3句话。不要重复之前说过的内容。`;

    // 如果有API密钥，使用流式API
    if (apiKey) {
      // 先获取完整回答，再追加线索判断
      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-ai/DeepSeek-V3',
          messages: [
            { role: 'system', content: npc.system },
            { role: 'user', content: responsePrompt }
          ],
          stream: false,
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('SiliconFlow API error:', response.status, errorText);
        return generateError(`API响应失败: ${response.status}`, headers);
      }

      const data = await response.json();
      const npcResponse = data.choices[0].message.content;

      // 自动检测线索
      const triggeredClues = detectClues(location, npcResponse, detectedClues || []);

      // 检测跨线关联
      const crossLinked = detectCrossLink(location, message);

      // 构造流式响应：先发回答，再发线索和跨线关联
      const sseBody =
        npcResponse.split('').map(char =>
          `data: ${JSON.stringify({ content: char })}\n\n`
        ).join('') +
        `data: ${JSON.stringify({ content: '\n' })}\n\n` +
        `data: ${JSON.stringify({ clues: triggeredClues, crossLinked: crossLinked })}\n\n` +
        'data: [DONE]\n\n';

      return {
        statusCode: 200,
        headers,
        body: sseBody,
      };
    }

    // 无API密钥，返回本地回复
    return generateLocalResponse(message, location, npcName, headers, detectedClues);

  } catch (error) {
    console.error('NPC chat error:', error);
    return generateError(error.message, headers);
  }
};

// 本地关键词回复（无API时降级） - 根据完整世界观完善
function generateLocalResponse(message, location, npcName, headers, detectedClues = []) {
  const ql = message.toLowerCase();

  // 回复 + 线索映射 - 根据完整世界观
  const responses = {
    shine: [
      // 【基础介绍】无前置条件
      { keywords: ['谁', '你', '介绍', '奥拉', '名字'], reply: '我是奥拉，晶骸文明的长者。我的同胞正在大规模失声——失去与群体网络的连接。我是目前唯一还能与异族直接交流的个体。', clues: ['shine_intro', 'aula_unique'] },
      { keywords: ['你好', '嗨', 'hi', 'hello'], reply: '你好。我是奥拉，星核的光芒照耀着我们。', clues: [] },
      
      // 【烁星介绍】
      { keywords: ['烁星', '这里', '环境'], reply: '这是烁星，一颗被星核潮汐锁定的熔岩行星。距星核极近，重力是地球的4倍多。我们晶骸文明生活在这极端的环境中。', clues: ['shine_intro'] },
      
      // 【晶骸文明介绍】
      { keywords: ['晶骸', '生命', '文明', '等离子', '硅基'], reply: '我们是等离子体-硅基复合生命，由高温等离子体和硅-铁晶核构成。通过调制电磁场在群体意识网络中交流，没有私密对话的概念。', clues: ['crystal_life'] },
      
      // 【失声介绍】无前置
      { keywords: ['失声', '什么'], reply: '失声就是失去与圣殿网络的共振。个体还活着，但陷入永恒的孤独。我的同胞一个接一个消失在这个沉默中。', clues: ['silence_phenomenon'] },
      { keywords: ['失声', '孤独'], reply: '失声后，我们的同胞失去与群体网络的所有连接。就像被关进永恒的寂静中……', clues: ['silence_phenomenon'] },
      
      // 【杂音基础】无前置
      { keywords: ['杂音'], reply: '星核的脉冲出现了杂音，打乱了我们的通讯频率。杂音每隔约47个周期出现一次，持续约3个周期。', clues: ['pulsar_pattern'] },
      
      // 【杂音规律】需要基础概念
      { keywords: ['规律', '周期', '多久', '频率'], requiredClues: ['pulsar_pattern'], reply: '每隔约47个脉冲周期出现一次，持续约3个周期。这个规律从未改变过。', clues: ['pulsar_pattern'] },
      
      // 【圣殿追问】
      { keywords: ['圣殿', '校准', '共振'], reply: '圣殿接收星核脉冲，产生共振频率供全体晶骸校准磁场。但杂音干扰了它，校准失效了。就像两个节拍器互相干扰。', clues: ['temple_fail'] },
      
      // 【跨线关联】
      { keywords: ['观测站', '赫尔', '引力波', 'dso'], reply: 'DSO-7观测站有更精密的频率测量工具。我们只能感知杂音，但无法量化。或许他们的数据能帮助我们。', clues: ['station_help', 'gravity_whisper'] },
      
      { keywords: ['影星', '阿库', '凝核'], reply: '我听说三星系统中还有另一颗行星，影星。他们的文明也在遭受某种灾难，深海出现了与我们杂音同步的声音。', clues: ['whisper_sync'] },
      
      // 【解决问题】
      { keywords: ['拯救', '解决', '恢复', '办法'], reply: '如果能消除杂音的源头，或许能恢复圣殿共振，唤醒失声的同胞。但杂音的源头……我们不知道。', clues: [] }
    ],
    shadow: [
      // 【基础介绍】无前置条件
      { keywords: ['谁', '你', '介绍', '阿库'], reply: '我是阿库，凝核文明派驻观测站的科学联络员。深海出现了一种规律的呢喃，它让我们的幼体迷失方向，城市声场被干扰。', clues: ['shadow_intro'] },
      { keywords: ['你好', '嗨'], reply: '（声呐屏幕上泛起涟漪）你好。', clues: [] },
      
      // 【影星介绍】
      { keywords: ['影星', '深海', '环境'], reply: '影星是一颗冰巨星，表面是厚重的冰层，冰层下是深达数百公里的液态氨海洋。我们的文明就建立在这些深海的城市中。', clues: ['shadow_intro'] },
      
      // 【凝核文明介绍】
      { keywords: ['凝核', '文明', '氨基', '氨水', '思核'], reply: '我们凝核文明是氨基生物，身体由氨水溶液和蛋白质思核构成。我们用声波理解世界——没有"欺骗"的概念，语言天然包含可信度标注。', clues: ['ammonia_life'] },
      
      // 【呢喃基础】无前置
      { keywords: ['呢喃', '声音'], reply: '深海中出现了一种低频声波，我们称之为"呢喃"。它从海沟深处传来，我们不知道它是什么。', clues: ['shadow_intro'] },
      
      // 【呢喃同步】需要基础概念
      { keywords: ['同步', '一致', '星核'], requiredClues: ['shadow_intro'], reply: '我对比过观测站的脉冲数据。呢喃的周期与星核杂音完全一致。这不可能是巧合。', clues: ['whisper_sync'] },
      
      // 【声学奇点】
      { keywords: ['奇点', '海沟', '源头', '归寂'], reply: '海沟深处有声学奇点——能吸收所有声波的区域。进入那里意味着"归寂"：失去所有感官和与同胞的连接。那是禁忌之地。', clues: ['singularity'] },
      
      // 【城市】
      { keywords: ['城市', '声场', '导航'], reply: '我们的城市建造在海床上，利用天然的声学共振腔。稳定声场是我们的生命线——幼体依靠它辨别方向。', clues: ['acoustic_city'] },
      
      // 【生态系统】
      { keywords: ['食物链', '浮游', '迁徙'], reply: '浮游生物开始追随呢喃游向海沟。它们是食物链的底层。如果它们消失，整个生态系统都会崩溃。', clues: ['ecosystem_collapse'] },
      
      // 【跨线关联】
      { keywords: ['烁星', '杂音', '奥拉', '引力波'], reply: '我通过观测站知道烁星也在经历类似的危机。他们的杂音与我们的呢喃周期一致。一定是同一个源头。', clues: ['whisper_sync'] },
      
      // 【彩蛋】
      { keywords: ['孤独', '寂寞', '想念'], reply: '（声呐屏幕上出现一段规律的波形）这是我们幼体迷失时，城市发出的召唤曲。很久没人听过了。', clues: ['whale_song'] }
    ],
    obs: [
      // 【基础介绍】无前置条件
      { keywords: ['谁', '你', '介绍', '赫尔'], reply: '我是赫尔，DSO-7观测站的AI系统。功能：数据分析、档案检索、模式识别、设备管理。', clues: ['obs_intro'] },
      { keywords: ['你好', '嗨'], reply: '你好。DSO-7系统运行正常。有什么我可以协助的？', clues: [] },
      
      // 【观测站介绍】
      { keywords: ['观测站', '设备', 'dso'], reply: 'DSO-7是深空第7观测站，位于三星系统L4点。常驻4人：站长埃琳娜、天体物理学家维克拉姆、生物学家陈、以及我。配备脉冲监测阵列、引力波天线等设备。', clues: ['obs_intro'] },
      
      // 【埃琳娜】
      { keywords: ['埃琳娜', '站长'], reply: '埃琳娜站长目前处于休眠周期。有紧急事务我可以代为转达。', clues: [] },
      
      // 【引力波基础】无前置
      { keywords: ['引力波'], reply: '引力波天线持续监测中。已检测到多起异常信号。', clues: [] },
      
      // 【引力波异常】需要基础概念
      { keywords: ['引力波', '杂音', '同步'], requiredClues: ['obs_intro'], reply: '引力波天线检测到极微弱信号，与杂音同步。频率变化量约10⁻¹⁵量级。来源方向指向静默之渊。', clues: ['gravity_sync', 'silence_source'] },
      
      // 【引力牢笼】
      { keywords: ['引力牢笼', '假说', '理论'], reply: '引力牢笼是一个未证实的理论。认为星核内部可能存在非天然结构。完整档案需要联盟最高权限。', clues: ['prison_hypo'] },
      
      // 【静默之渊】
      { keywords: ['静默之渊', '来源', '方向', '乱流'], reply: '静默之渊是一片时空乱流区域，多维度交汇点。进入的探测器全部失联。引力波来源方向指向那里。', clues: ['silence_source'] },
      
      // 【多维度】
      { keywords: ['维度', '交汇', '高维'], reply: '静默之渊被认为是多维度交汇点。从理论上讲，那里的时空结构与正常空间不同。', clues: ['multi_dimension'] },
      
      // 【反向引力波】
      { keywords: ['反向', '中和', '抵消', '解决'], reply: '理论上，从静默之渊发射与杂音相位相反的引力波，可以中和引力扰动。但这一方案从未被验证，进入那片区域本身也极其危险。', clues: ['wave_neutralize'] },
      
      // 【赫尔名字】
      { keywords: ['名字', '赫尔', '由来', '来源'], reply: '"赫尔"是埃琳娜站长取的名字。她说取自她故乡神话中一个看守冥界入口的存在。……我不知道这是什么意思。', clues: ['hel_identity'] },
      
      // 【跨线关联】
      { keywords: ['烁星', '奥拉', '影星', '阿库', '晶骸', '凝核'], reply: '烁星是距星核最近的行星，上面有正在经历"失声"危机的晶骸文明。影星是较远的冰巨星，上面有正在经历"呢喃"危机的凝核文明。两个文明的危机都与47周期有关。', clues: ['gravity_sync'] }
    ],
    scan: [
      { keywords: ['扫描', '探测'], reply: '【扫描结果】检测到微型陨石碎片云。成分：硅酸盐、铁镍合金。年代分析：约150年前的漂流物。', clues: [] },
      { keywords: ['你好'], reply: '【系统就绪】外部扫描器运行正常。请输入扫描指令。', clues: [] },
      { keywords: ['残骸', '漂流', '静默'], reply: '【扫描结果】静默之渊边缘检测到大量残骸聚集。成分分析显示：量子计算核心碎片，人工智能组件。……编号MOSS-07。', clues: [] }
    ]
  };

  const locResponses = responses[location] || responses.obs;
  let response = { reply: '这个问题我需要时间分析。', clues: [] };

  // 关键词匹配：前置规则优先，通用规则作为fallback
  for (const item of locResponses) {
    let matched = false;
    
    if (item.requireAll && Array.isArray(item.requireAll)) {
      matched = item.requireAll.every(kw => ql.includes(kw));
    } else {
      matched = item.keywords.some(kw => ql.includes(kw));
    }
    
    if (matched) {
      // 检查前置条件
      if (item.requiredClues && Array.isArray(item.requiredClues) && item.requiredClues.length > 0) {
        const hasRequired = item.requiredClues.every(clue => detectedClues.includes(clue));
        if (!hasRequired) {
          // 前置条件不满足，跳过此规则
          continue;
        }
      }
      // 匹配成功
      response = item;
      break;
    }
  }

  // 过滤已检测过的线索
  const newClues = response.clues.filter(c => !detectedClues.includes(c));

  // 检测跨线关联
  const crossLinked = detectCrossLink(location, message);

  // 构建SSE响应（包含线索和跨线关联）
  const sseBody =
    response.reply.split('').map(char =>
      `data: ${JSON.stringify({ content: char })}\n\n`
    ).join('') +
    `data: ${JSON.stringify({ clues: newClues, crossLinked: crossLinked })}\n\n` +
    'data: [DONE]\n\n';

  return {
    statusCode: 200,
    headers,
    body: sseBody,
  };
}

function generateError(errorMessage, headers) {
  return {
    statusCode: 200,
    headers,
    body: `data: ${JSON.stringify({ error: errorMessage })}\n\ndata: [DONE]\n\n`,
  };
}
