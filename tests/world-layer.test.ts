import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createModel } from '../src/core';
import { freezeInspection, taskLabel } from '../src/inspection';

const CORE_SHA256 = '1f61937fbfdbbc524bfc3eb6ef0da3db3e347ad079e8b063ea4285e2c122a920';

test('field-return layer does not modify the authoritative engine', () => {
  const bytes = readFileSync(new URL('../src/core.ts', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), CORE_SHA256);
});

test('terminal inspection freezes a deterministic, detached result', () => {
  const model = createModel(1847);
  model.phase = 'overrun';
  model.failure = 'belt';
  model.splits = 3;
  const telemetry = { maxDepth: 558, deepestX: 173, dangerContact: true };
  const first = freezeInspection(model, telemetry);
  const second = freezeInspection(model, telemetry);
  assert.deepEqual(first, second);
  assert.equal(first.task, taskLabel(model));
  const originalX = first.chains[0].segments[0].x;
  model.chains[0].segments[0].x += 50;
  assert.equal(first.chains[0].segments[0].x, originalX);
});
