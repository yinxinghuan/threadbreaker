import assert from 'node:assert/strict';
import test from 'node:test';
import { createModel, FIXED_DT, routeCurl, setPlayer, start, step } from '../src/core';

function renderSchedule(fps: number, duration: number) {
  const m = createModel(1847); start(m);
  let acc = 0;
  for (let frame = 0; frame < fps * duration; frame += 1) {
    acc += 1 / fps;
    while (acc + 1e-12 >= FIXED_DT) {
      const t = m.elapsed;
      setPlayer(m, 180 + Math.sin(t * 1.7) * 110, 590 + Math.cos(t * 0.8) * 16);
      step(m, FIXED_DT); acc -= FIXED_DT;
    }
  }
  return { phase:m.phase, elapsed:m.elapsed, score:m.score, splits:m.splits, chains:m.chains.map(c=>({dir:c.dir,segments:c.segments.map(s=>[s.id,+s.x.toFixed(4),+s.y.toFixed(4)])})), shots:m.shots.map(s=>[+s.x.toFixed(4),+s.y.toFixed(4)]) };
}

test('30fps and 60fps render schedules produce identical authority', () => {
  assert.deepEqual(renderSchedule(30, 10), renderSchedule(60, 10));
});

test('route field is deterministic and spatially meaningful', () => {
  const a = routeCurl(1847, 80, 220, 2);
  assert.equal(a, routeCurl(1847, 80, 220, 2));
  assert.notEqual(a, routeCurl(1847, 128, 268, 2));
});

test('middle hit splits one chain into two authoritative fragments', () => {
  const m = createModel(); start(m);
  const target = m.chains[0].segments[4];
  m.shots.push({ id:9999, x:target.x, y:target.y });
  step(m, FIXED_DT);
  assert.equal(m.splits, 1);
  assert.equal(m.chains.length, 3);
  assert.equal(m.chains[0].segments.length + m.chains[1].segments.length, 8);
  assert.notEqual(m.chains[0].dir, m.chains[1].dir);
});

test('player remains clamped to the one-finger safe band', () => {
  const m = createModel();
  setPlayer(m, -500, 900); assert.deepEqual(m.player, {x:24,y:612});
  setPlayer(m, 900, 0); assert.deepEqual(m.player, {x:336,y:552});
});
