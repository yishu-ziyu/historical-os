import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const port = 8897;
const baseUrl = `http://127.0.0.1:${port}`;

async function waitForServer(process, url = baseUrl) {
  const started = Date.now();
  let lastError;

  while (Date.now() - started < 5000) {
    if (process.exitCode !== null) {
      throw new Error(`server exited early with code ${process.exitCode}`);
    }

    try {
      const response = await fetch(`${url}/`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw lastError || new Error('server did not start');
}

async function waitForJob(statusUrl, expectedStatus = 'succeeded', url = baseUrl) {
  const started = Date.now();
  let snapshot;

  while (Date.now() - started < 5000) {
    const response = await fetch(`${url}${statusUrl}`);
    assert.equal(response.status, 200);
    snapshot = await response.json();
    if (snapshot.status === expectedStatus) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`job did not reach ${expectedStatus}; last status was ${snapshot?.status}`);
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test('high-risk fallback run still returns HistoryGuard flags, audit event, brief, and artifact', async () => {
  const home = await mkdtemp(join(tmpdir(), 'historical-runtime-home-'));
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: {
      ...process.env,
      HOME: home,
      PORT: String(port),
      ANTHROPIC_BASE_URL: '',
      ANTHROPIC_AUTH_TOKEN: '',
      ANTHROPIC_API_KEY: '',
      HISTORICAL_RUNTIME_MODEL_PROVIDER: '',
      MODEL_PROVIDER: '',
      MINIMAX_API_KEY: '',
      MINIMAX_BASE_URL: '',
      TOKEN_PLAN_API_KEY: '',
      TOKEN_PLAN_BASE_URL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(server);

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentTitle: '爱因斯坦仍在德国',
        currentStory: '测试故事',
        direction: '爱因斯坦被纳粹杀害',
        pathTitles: ['爱因斯坦仍在德国'],
      }),
    });

    assert.equal(response.status, 200);
    const data = await response.json();

    assert.equal(data.status, 'fallback');
    assert.equal(data.task.status, 'failed');
    assert.ok(data.historyFlags.includes('fictional_branch'));
    assert.ok(data.historyFlags.includes('sensitive_context'));
    assert.ok(data.historyReview.requiresHumanApproval);
    assert.ok(data.events.some((event) => event.type === 'history_review_completed'));
    assert.ok(data.events.some((event) => event.type === 'human_approval_required'));
    assert.ok(data.brief.risks.some((risk) => risk.includes('高风险') || risk.includes('审计')));
    assert.ok(data.artifacts.some((artifact) => artifact.type === 'risk_notice'));
  } finally {
    server.kill('SIGTERM');
    await rm(home, { recursive: true, force: true });
  }
});

test('async generation job exposes Historical OS progress and technical events', async () => {
  const home = await mkdtemp(join(tmpdir(), 'historical-runtime-home-'));
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: {
      ...process.env,
      HOME: home,
      PORT: String(port),
      ANTHROPIC_BASE_URL: '',
      ANTHROPIC_AUTH_TOKEN: '',
      ANTHROPIC_API_KEY: '',
      HISTORICAL_RUNTIME_MODEL_PROVIDER: '',
      MODEL_PROVIDER: '',
      MINIMAX_API_KEY: '',
      MINIMAX_BASE_URL: '',
      TOKEN_PLAN_API_KEY: '',
      TOKEN_PLAN_BASE_URL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(server);

    const startResponse = await fetch(`${baseUrl}/api/generate/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentTitle: '爱因斯坦仍在德国',
        currentStory: '测试故事',
        direction: '爱因斯坦被纳粹杀害',
        pathTitles: ['爱因斯坦仍在德国'],
      }),
    });

    assert.equal(startResponse.status, 200);
    const started = await startResponse.json();
    assert.equal(started.ok, true);
    assert.match(started.jobId, /^job-/);
    assert.equal(started.statusUrl, `/api/jobs/${started.jobId}`);

    const snapshot = await waitForJob(started.statusUrl);
    assert.equal(snapshot.ok, true);
    assert.equal(snapshot.status, 'succeeded');
    assert.equal(snapshot.stage, 'complete');
    assert.equal(snapshot.result.status, 'fallback');
    assert.ok(snapshot.events.some((event) => event.stage === 'story_weaving'));
    assert.ok(snapshot.events.some((event) => event.studentMessage.includes('叙事分析组')));
    assert.ok(snapshot.events.some((event) => event.studentMessage.includes('历史审计频道')));
    assert.ok(snapshot.events.some((event) => event.studentMessage.includes('值班系统')));
    assert.ok(snapshot.technicalEvents.some((event) => event.metadata?.agent === 'StoryWeaverAgent'));
    assert.ok(snapshot.technicalEvents.some((event) => event.technicalMessage.includes('MODEL_REQUEST_START')));
    assert.doesNotMatch(snapshot.events.map((event) => event.studentMessage).join('\n'), /StoryWeaverAgent|HistoryGuardAgent|RuntimeOrchestrator/);
  } finally {
    server.kill('SIGTERM');
    await rm(home, { recursive: true, force: true });
  }
});

test('async generation job falls back when the model provider times out', async () => {
  const appPort = 8900;
  const appBaseUrl = `http://127.0.0.1:${appPort}`;
  const home = await mkdtemp(join(tmpdir(), 'historical-runtime-home-'));
  const modelServer = createHttpServer((request, response) => {
    setTimeout(() => {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ content: [] }));
    }, 300);
  });
  const modelAddress = await listen(modelServer);
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: {
      ...process.env,
      HOME: home,
      PORT: String(appPort),
      HISTORICAL_RUNTIME_MODEL_PROVIDER: 'minimax',
      MINIMAX_API_KEY: 'sk-cp-test-token',
      MINIMAX_BASE_URL: `http://127.0.0.1:${modelAddress.port}/anthropic`,
      MODEL_REQUEST_TIMEOUT_MS: '50',
      ANTHROPIC_BASE_URL: '',
      ANTHROPIC_AUTH_TOKEN: '',
      ANTHROPIC_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(server, appBaseUrl);

    const startResponse = await fetch(`${appBaseUrl}/api/generate/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentTitle: '爱因斯坦仍在德国',
        currentStory: '测试故事',
        direction: '爱因斯坦自杀了',
        pathTitles: ['爱因斯坦仍在德国'],
      }),
    });

    assert.equal(startResponse.status, 200);
    const started = await startResponse.json();
    const snapshot = await waitForJob(started.statusUrl, 'succeeded', appBaseUrl);

    assert.equal(snapshot.status, 'succeeded');
    assert.equal(snapshot.result.status, 'fallback');
    assert.ok(snapshot.result.artifacts.some((artifact) => artifact.content.includes('模型请求超时')));
    assert.ok(snapshot.events.some((event) => event.stage === 'commit_review'));
    assert.ok(snapshot.events.some((event) => event.stage === 'complete'));
  } finally {
    server.kill('SIGTERM');
    await close(modelServer);
    await rm(home, { recursive: true, force: true });
  }
});

test('Anthropic fallback chain skips thinking-only responses and reaches text model', async () => {
  const appPort = 8904;
  const appBaseUrl = `http://127.0.0.1:${appPort}`;
  const home = await mkdtemp(join(tmpdir(), 'historical-runtime-home-'));
  const receivedModels = [];
  const modelServer = createHttpServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const prompt = body.messages?.[0]?.content || '';
    receivedModels.push(body.model);

    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    if (body.model === 'claude-sonnet-4-6' || body.model === 'claude-haiku-4-5-20251001') {
      response.end(JSON.stringify({
        content: [{ type: 'thinking', thinking: 'I can solve this but did not emit text.' }],
      }));
      return;
    }

    if (prompt.includes('态势分析系统')) {
      response.end(JSON.stringify({
        content: [{
          type: 'text',
          text: JSON.stringify({
            situationRoom: {
              anchor: { id: 'anchor', label: '异常锚点', type: 'anomaly_origin', status: 'active' },
              nodes: [{ id: 'node-planck', label: '普朗克渠道', type: 'person', status: 'monitored', statusLabel: '已监控', depth: 1 }],
              edges: [],
              riskIndicators: { overall: 2, max: 5, components: [{ label: '操作风险', value: 1 }] },
              nextDeadline: { type: 'newspaper_publication', label: '柏林日报出刊', date: '1933-04-20' },
            },
            actionOptions: [{
              id: 'action-planck',
              label: '通过普朗克渠道递送离境建议',
              icon: 'letter',
              historicalPlausibility: 'high',
              description: '以私人通信降低公开风险。',
              riskCost: 1,
              intelReturn: 'high',
              unlocksNodes: ['node-planck'],
              consequencePreview: '普朗克渠道将被点亮。',
            }],
            historyFlags: ['fictional_branch'],
          }),
        }],
      }));
      return;
    }

    response.end(JSON.stringify({
      content: [{
        type: 'text',
        text: JSON.stringify({
          intelCard: {
            classification: '绝密',
            header: {
              title: '柏林物理学会会员名录变动报告',
              documentId: 'B-DPG-1933-0417',
              date: '1933-04-17',
              source: '柏林物理学会秘书处',
              language: 'de-zh',
            },
            body: {
              text: '会员名录中保留了爱因斯坦的通信地址，但一处手写注记显示该地址已经被外部人员反复核验。',
              originalSnippet: 'Adresse erneut bestätigt',
              translation: '地址再次确认',
              handwrittenNotes: [{ location: '页边', text: 'Nicht streichen', translation: '不要划去', inkColor: 'blue' }],
            },
            contradictions: [{ id: 'c1', type: 'address', description: '公开名录仍保留地址，但注记显示地址正在被核验。', significance: 'high' }],
            clues: [{ id: 'clue-address', text: '地址被再次确认', category: '通信', confidence: 'verified' }],
            nextTimeNode: '1933-04-20',
            provenance: { type: 'generated', confidence: 0.8 },
            historyFlags: ['fictional_branch'],
          },
          historyFlags: ['fictional_branch'],
        }),
      }],
    }));
  });
  const modelAddress = await listen(modelServer);
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: {
      ...process.env,
      HOME: home,
      PORT: String(appPort),
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${modelAddress.port}`,
      ANTHROPIC_AUTH_TOKEN: 'test-token',
      ANTHROPIC_MODEL: 'claude-sonnet-4-6',
      HISTORICAL_RUNTIME_MODEL_PROVIDER: '',
      MODEL_PROVIDER: '',
      MINIMAX_API_KEY: '',
      MINIMAX_BASE_URL: '',
      TOKEN_PLAN_API_KEY: '',
      TOKEN_PLAN_BASE_URL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(server, appBaseUrl);

    const startResponse = await fetch(`${appBaseUrl}/api/turn/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        caseId: 'einstein-1933',
        turn: 1,
        caseTitle: '爱因斯坦未离开德国',
        historicalAnchors: ['Einstein 1933 年 10 月未离开柏林'],
        riskLevel: 1,
      }),
    });

    assert.equal(startResponse.status, 200);
    const started = await startResponse.json();
    const snapshot = await waitForJob(started.statusUrl, 'succeeded', appBaseUrl);

    assert.equal(snapshot.result.briefing.intelCard.header.title, '柏林物理学会会员名录变动报告');
    assert.deepEqual(receivedModels, [
      'claude-sonnet-4-6',
      'claude-opus-4-8',
      'claude-sonnet-4-6',
      'claude-opus-4-8',
    ]);
    assert.ok(snapshot.events.some((event) => event.technicalMessage.includes('模型返回空内容')));
  } finally {
    server.kill('SIGTERM');
    await close(modelServer);
    await rm(home, { recursive: true, force: true });
  }
});


test('MiniMax Token Plan config defaults to Anthropic-compatible messages', async () => {
  const appPort = 8898;
  const appBaseUrl = `http://127.0.0.1:${appPort}`;
  const home = await mkdtemp(join(tmpdir(), 'historical-runtime-home-'));
  const received = {};
  const modelServer = createHttpServer(async (request, response) => {
    received.url = request.url;
    received.authorization = request.headers.authorization;
    received.apiKey = request.headers['x-api-key'];
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received.body = JSON.parse(Buffer.concat(chunks).toString('utf8'));

    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({
      content: [
        { type: 'thinking', thinking: 'Validate the story runtime contract.' },
        {
          type: 'text',
          text: JSON.stringify({
            story: 'MiniMax 生成故事：一封来自苏黎世的密信改变了救援网络的节奏。',
            choices: [
              { title: '继续核验', hint: '查看密信来源是否可靠。' },
              { title: '联系救援网络', hint: '降低行动风险。' },
              { title: '观察宣传机器', hint: '识别官方叙事。' },
            ],
            brief: {
              summary: 'MiniMax 路径已接入。',
              keyChanges: ['模型提供了结构化故事。'],
              risks: ['仍需 HistoryGuard 审查。'],
              suggestedNextActions: ['核验来源。'],
            },
            artifacts: [{
              type: 'risk_notice',
              title: 'MiniMax Token Plan 调用',
              content: '通过 Anthropic-compatible 接口返回。',
              provenance: 'generated',
              confidence: 0.7,
            }],
            historyFlags: ['fictional_branch'],
          }),
        },
      ],
    }));
  });
  const modelAddress = await listen(modelServer);
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: {
      ...process.env,
      HOME: home,
      PORT: String(appPort),
      HISTORICAL_RUNTIME_MODEL_PROVIDER: 'minimax',
      MINIMAX_API_KEY: 'sk-cp-test-token',
      MINIMAX_BASE_URL: `http://127.0.0.1:${modelAddress.port}/anthropic`,
      MINIMAX_MODEL: 'MiniMax-M2.7',
      ANTHROPIC_BASE_URL: '',
      ANTHROPIC_AUTH_TOKEN: '',
      ANTHROPIC_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(server, appBaseUrl);

    const response = await fetch(`${appBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentTitle: '爱因斯坦仍在德国',
        currentStory: '测试故事',
        direction: '使用 MiniMax Token Plan 继续生成',
        pathTitles: ['爱因斯坦仍在德国'],
      }),
    });

    assert.equal(response.status, 200);
    const data = await response.json();

    assert.equal(data.status, 'generated');
    assert.match(data.story, /MiniMax 生成故事/);
    assert.equal(received.url, '/anthropic/v1/messages');
    assert.equal(received.authorization, undefined);
    assert.equal(received.apiKey, 'sk-cp-test-token');
    assert.equal(received.body.model, 'MiniMax-M2.7');
    assert.equal(received.body.messages[0].role, 'user');
  } finally {
    server.kill('SIGTERM');
    await close(modelServer);
    await rm(home, { recursive: true, force: true });
  }
});

test('MiniMax can still use OpenAI-compatible chat completions when explicitly requested', async () => {
  const appPort = 8899;
  const appBaseUrl = `http://127.0.0.1:${appPort}`;
  const home = await mkdtemp(join(tmpdir(), 'historical-runtime-home-'));
  const received = {};
  const modelServer = createHttpServer(async (request, response) => {
    received.url = request.url;
    received.authorization = request.headers.authorization;
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received.body = JSON.parse(Buffer.concat(chunks).toString('utf8'));

    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            story: 'MiniMax OpenAI 兼容路径生成故事。',
            choices: [
              { title: '继续核验', hint: '查看密信来源是否可靠。' },
              { title: '联系救援网络', hint: '降低行动风险。' },
              { title: '观察宣传机器', hint: '识别官方叙事。' },
            ],
            brief: {
              summary: 'OpenAI-compatible 路径仍可用。',
              keyChanges: ['模型提供了结构化故事。'],
              risks: ['仍需 HistoryGuard 审查。'],
              suggestedNextActions: ['核验来源。'],
            },
            artifacts: [{
              type: 'risk_notice',
              title: 'MiniMax OpenAI-compatible 调用',
              content: '通过显式配置返回。',
              provenance: 'generated',
              confidence: 0.7,
            }],
            historyFlags: ['fictional_branch'],
          }),
        },
      }],
    }));
  });
  const modelAddress = await listen(modelServer);
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: {
      ...process.env,
      HOME: home,
      PORT: String(appPort),
      HISTORICAL_RUNTIME_MODEL_PROVIDER: 'minimax',
      MINIMAX_API_FORMAT: 'openai',
      MINIMAX_API_KEY: 'sk-cp-test-token',
      MINIMAX_BASE_URL: `http://127.0.0.1:${modelAddress.port}/v1`,
      MINIMAX_MODEL: 'MiniMax-M2.7',
      ANTHROPIC_BASE_URL: '',
      ANTHROPIC_AUTH_TOKEN: '',
      ANTHROPIC_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(server, appBaseUrl);

    const response = await fetch(`${appBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentTitle: '爱因斯坦仍在德国',
        currentStory: '测试故事',
        direction: '使用 MiniMax OpenAI-compatible 继续生成',
        pathTitles: ['爱因斯坦仍在德国'],
      }),
    });

    assert.equal(response.status, 200);
    const data = await response.json();

    assert.equal(data.status, 'generated');
    assert.match(data.story, /OpenAI 兼容路径/);
    assert.equal(received.url, '/v1/chat/completions');
    assert.equal(received.authorization, 'Bearer sk-cp-test-token');
    assert.equal(received.body.model, 'MiniMax-M2.7');
    assert.equal(received.body.messages[0].role, 'user');
  } finally {
    server.kill('SIGTERM');
    await close(modelServer);
    await rm(home, { recursive: true, force: true });
  }
});
