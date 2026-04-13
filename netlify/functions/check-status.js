/**
 * check-status.js
 * 评分状态轮询接口 —— 双轨架构"轨道二"的状态查询端点
 *
 * 工作流程：
 *  1. score-background 完成评分后，将结果写入全局缓存 global.__scoreCache
 *  2. 前端每 3 秒轮询此接口，传入 jobId
 *  3. 此接口从缓存中读取结果并返回
 *
 * 注意：Netlify 同一函数实例会在短时间内复用（约几秒到数分钟），
 *       因此同一请求链路的 jobId 大概率能命中缓存。
 *       若函数实例被回收（冷启动），返回 processing 状态，
 *       前端会在 30 秒兜底计时器到期后降级到本地评分。
 */

// 全局评分缓存（跨调用共享，同一函数实例内有效）
if (!global.__scoreCache) {
  global.__scoreCache = {};
}

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // 从查询参数中提取 jobId
  const jobId = (event.queryStringParameters || {}).jobId || '';

  if (!jobId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ status: 'error', message: '缺少 jobId 参数' }),
    };
  }

  const cached = global.__scoreCache[jobId];

  if (cached) {
    // 命中缓存，返回完整评分结果
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'completed',
        scores: cached.scores,
        assessment: cached.assessment,
        conversationSummary: cached.conversationSummary,
        aiUsed: cached.aiUsed,
        timestamp: cached.timestamp,
      }),
    };
  }

  // 未命中缓存（函数实例可能已重启）
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: 'processing',
      message: '评分正在进行中，请稍后重试。',
    }),
  };
};
