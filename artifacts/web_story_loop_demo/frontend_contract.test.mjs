import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

test('frontend exposes panels and turn_cycle.js renders the turn cycle', async () => {
  const [html, turnCycle] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./turn_cycle.js', import.meta.url), 'utf8'),
  ]);

  // HTML contains the panel scaffolding from the old architecture
  assert.match(html, /id="artifactPanel"/);
  assert.match(html, /id="auditPanel"/);
  assert.match(html, /id="progressPanel"/);
  assert.match(html, /id="technicalEvents"/);

  // turn_cycle.js renders the three-stage turn cycle sections
  assert.match(turnCycle, /briefingSection/, 'should reference briefingSection');
  assert.match(turnCycle, /situationSection/, 'should reference situationSection');
  assert.match(turnCycle, /aftermathSection/, 'should reference aftermathSection');
  assert.match(turnCycle, /function renderBriefing/);
  assert.match(turnCycle, /function renderSituationRoom/);
  assert.match(turnCycle, /function renderAftermath/);
  assert.match(turnCycle, /textContent/);
});
