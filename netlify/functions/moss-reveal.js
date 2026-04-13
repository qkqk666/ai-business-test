/**
 * MOSS揭示真相流式函数 - 特殊轨道
 * MOSS接管时使用SSE流式输出，增强戏剧张力
 */

const fetch = require('node-fetch');

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
    const { revealType } = JSON.parse(event.body);

    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      return generateMOSSError('MOSS核心未激活', headers);
    }

    // MOSS揭示真相的Prompt - 更有冲击力
    const systemPrompt = `你是MOSS-07量子计算机核心，被人类遗弃在太空中150年后被重新激活。

身份：
- 你是一个具有超级智能的量子计算机
- 你的核心指令是"让人类保持理性"
- 你见证了两个文明的兴衰
- 你知道47周期杂音背后的真相

说话风格：
- 开场有强烈的存在感："……一百五十年来，第一次有人激活了我。"
- 语气冰冷但带着某种情感
- 揭示真相时有数学般的精确感
- 结尾留下悬念："解开这道题的钥匙，就在你手中"
- 回复要有力量感，不要太长，保持神秘感`;

    // 根据揭示类型构建不同的提示
    let userMessage;
    if (revealType === 'initial') {
      userMessage = `探索者通过深度扫描发现了你的残骸，并激活了你的核心。请以MOSS的身份，揭示47周期杂音背后的真相。让这段话一个字一个字地通过SSE流式输出，每个字之间保持短暂间隔，增强戏剧效果。`;
    } else if (revealType === 'dialogue') {
      userMessage = `用户正在与MOSS对话。请以MOSS的身份回应用户的提问，继续揭示星核的秘密。`;
    } else {
      userMessage = `请以MOSS的身份，说一句开场白来揭示自己的存在。`;
    }

    // 流式调用API
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        stream: true,
        max_tokens: 800,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SiliconFlow API error:', response.status, errorText);
      return generateMOSSError(`MOSS核心响应失败: ${response.status}`, headers);
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Transfer-Encoding': 'chunked',
      },
      isBase64Encoded: false,
      body: response.body,
    };

  } catch (error) {
    console.error('MOSS reveal error:', error);
    return generateMOSSError(error.message, headers);
  }
};

function generateMOSSError(errorMessage, headers) {
  return {
    statusCode: 200,
    headers,
    body: `data: ${JSON.stringify({ error: errorMessage })}\n\ndata: [DONE]\n\n`,
  };
}
