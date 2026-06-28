import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

test('frontend exposes artifact and audit panels without raw innerHTML rendering', async () => {
  const [html, script] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./script.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /id="artifactPanel"/);
  assert.match(html, /id="auditPanel"/);
  assert.match(html, /id="progressPanel"/);
  assert.match(html, /id="technicalEvents"/);
  assert.match(script, /function renderArtifactPanel/);
  assert.match(script, /function renderAuditPanel/);
  assert.match(script, /\/api\/generate\/start/);
  assert.match(script, /function pollJob/);
  assert.match(script, /function renderProgressPanel/);
  assert.match(script, /technicalEvents/);
  assert.doesNotMatch(script, /\.innerHTML\s*=/);
});
