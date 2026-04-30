/**
 * /functions/api/npc-chat.js
 * 守林人 AI 对话接口（Cloudflare Pages Functions）
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
    const { message = '', isFirst = false, clues = [] } = body;

    // 若是第一次对话，直接返回固定台词
    if (isFirst) {
      return new Response(
        JSON.stringify({ reply: '树根扎得太深了，碰到了不该碰的东西。' }),
        { status: 200, headers: corsHeaders }
      );
    }

    const apiKey = env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ reply: '......' }), {
        status: 200, headers: corsHeaders,
      });
    }

    // 系统 Prompt：守林人角色设定
    const systemPrompt = `你是迷雾林的守林人，一个古老的监测者。
你知道水源树是一种净化装置，树根触到了饱和的滤芯污染物。
规则如下：
- 若这是第一次对话（isFirst=true），你必须且只能说：「树根扎得太深了，碰到了不该碰的东西。」
- 此后，无论用户说什么、问什么，你一律保持沉默，只输出「......」或极简词语如「走。」「听。」，不超过三个字。
- 绝不解释，绝不重复，绝不给出任何额外信息。
- 语气古老、简洁、不带情绪。`;

    const userMessage = message || '（继续追问）';
    const contextInfo = clues.length > 0 ? `\n用户已发现的线索：${clues.join('；')}` : '';

    const resp = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `用户说：${userMessage}${contextInfo}` }
        ],
        max_tokens: 20,
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ reply: '......' }), {
        status: 200, headers: corsHeaders,
      });
    }

    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || '......';

    return new Response(JSON.stringify({ reply }), {
      status: 200, headers: corsHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({ reply: '......' }), {
      status: 200, headers: corsHeaders,
    });
  }
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