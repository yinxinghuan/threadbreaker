export const FIELD_W = 360;
export const FIELD_H = 640;
export const FIXED_DT = 1 / 120;
export const ROUND_SECONDS = 45;

export type Phase = 'ready' | 'playing' | 'paused' | 'cleared' | 'overrun';
export type Point = { x: number; y: number };
export type Segment = Point & { id: number; flash: number };
export type Chain = { id: number; segments: Segment[]; dir: -1 | 1; speedScale: number; lastDrop: number };
export type Shot = Point & { id: number };
export type Obstacle = Point & { id: number; hp: number };
export type Burst = Point & { life: number; dx: number; dy: number };

export type Model = {
  seed: number;
  phase: Phase;
  beforePause: Phase;
  elapsed: number;
  score: number;
  combo: number;
  comboAge: number;
  splits: number;
  player: Point;
  chains: Chain[];
  shots: Shot[];
  obstacles: Obstacle[];
  bursts: Burst[];
  shotClock: number;
  nextId: number;
  reinforcements: number;
  failure: 'belt' | 'collision' | null;
};

function hash(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** A deterministic, discrete divergence-like route bias. This is gameplay authority,
 * not the formal GPU curl-noise-spirit-field visual effect. */
export function routeCurl(seed: number, x: number, y: number, timeBucket: number): number {
  const c = Math.floor(x / 24);
  const r = Math.floor(y / 24);
  const a = hash(seed + c * 92821 + r * 68917 + timeBucket * 1013);
  const b = hash(seed + (c + 1) * 31337 + (r - 1) * 27179 + timeBucket * 1013);
  return (a - b) * 2;
}

function makeChain(model: Model, y: number, count: number, dir: -1 | 1): Chain {
  const headX = dir > 0 ? 188 : 172;
  const segments: Segment[] = [];
  for (let i = 0; i < count; i += 1) {
    segments.push({ id: model.nextId++, x: headX - dir * i * 18, y, flash: 0 });
  }
  return { id: model.nextId++, segments, dir, speedScale: 1, lastDrop: -1 };
}

export function createModel(seed = 1847): Model {
  const model: Model = {
    seed, phase: 'ready', beforePause: 'playing', elapsed: 0, score: 0,
    combo: 1, comboAge: 99, splits: 0, player: { x: 180, y: 590 },
    chains: [], shots: [], obstacles: [], bursts: [], shotClock: 0,
    nextId: 1, reinforcements: 0, failure: null,
  };
  model.chains.push(makeChain(model, 160, 9, 1), makeChain(model, 208, 9, -1));
  const spots = [[58,232],[137,218],[252,242],[311,286],[89,326],[186,304],[272,348],[44,410],[147,390],[234,426],[318,454],[112,478]];
  model.obstacles = spots.map(([x, y]) => ({ id: model.nextId++, x, y, hp: 3 }));
  return model;
}

export function start(model: Model): void {
  if (model.phase === 'ready') model.phase = 'playing';
}

export function setPlayer(model: Model, x: number, y: number): void {
  model.player.x = Math.max(24, Math.min(336, x));
  model.player.y = Math.max(552, Math.min(612, y));
}

function dropAndTurn(model: Model, chain: Chain, edge: boolean): void {
  const head = chain.segments[0];
  const bucket = Math.floor(model.elapsed / 3);
  const bias = routeCurl(model.seed + chain.id, head.x, head.y, bucket);
  if (edge) chain.dir = head.x < FIELD_W / 2 ? 1 : -1;
  else chain.dir = bias >= 0 ? 1 : -1;
  for (const s of chain.segments) { s.y += 24; s.x += chain.dir * 18; }
  chain.lastDrop = model.elapsed;
}

function hitObstacle(chain: Chain, obstacles: Obstacle[]): boolean {
  const h = chain.segments[0];
  return obstacles.some((o) => Math.abs(h.x - o.x) < 16 && Math.abs(h.y - o.y) < 14);
}

function splitChain(model: Model, chainIndex: number, segmentIndex: number): void {
  const chain = model.chains[chainIndex];
  const hit = chain.segments[segmentIndex];
  model.combo = model.comboAge <= 1.2 ? Math.min(4, model.combo + 1) : 1;
  model.comboAge = 0;
  model.score += 100 * model.combo;
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2;
    model.bursts.push({ x: hit.x, y: hit.y, life: 0.22, dx: Math.cos(angle) * 42, dy: Math.sin(angle) * 42 });
  }
  const front = chain.segments.slice(0, segmentIndex);
  const back = chain.segments.slice(segmentIndex + 1);
  const replacements: Chain[] = [];
  if (front.length) replacements.push({ ...chain, segments: front, speedScale: chain.speedScale * 1.08 });
  if (back.length) replacements.push({ id: model.nextId++, segments: back.reverse(), dir: chain.dir === 1 ? -1 : 1, speedScale: chain.speedScale * 1.08, lastDrop: chain.lastDrop });
  if (front.length && back.length) model.splits += 1;
  model.chains.splice(chainIndex, 1, ...replacements);
}

function resolveShots(model: Model): void {
  for (let si = model.shots.length - 1; si >= 0; si -= 1) {
    const shot = model.shots[si];
    let consumed = false;
    for (let ci = model.chains.length - 1; ci >= 0 && !consumed; ci -= 1) {
      const chain = model.chains[ci];
      for (let gi = 0; gi < chain.segments.length; gi += 1) {
        const seg = chain.segments[gi];
        const dx = seg.x - shot.x; const dy = seg.y - shot.y;
        if (dx * dx + dy * dy < 15 * 15) {
          splitChain(model, ci, gi);
          model.shots.splice(si, 1); consumed = true; break;
        }
      }
    }
    if (consumed) continue;
    for (let oi = model.obstacles.length - 1; oi >= 0; oi -= 1) {
      const o = model.obstacles[oi]; const dx = o.x - shot.x; const dy = o.y - shot.y;
      if (dx * dx + dy * dy < 13 * 13) {
        o.hp -= 1; model.shots.splice(si, 1); consumed = true;
        if (o.hp <= 0) { model.score += 60; model.obstacles.splice(oi, 1); }
        break;
      }
    }
  }
}

export function step(model: Model, dt: number): void {
  if (model.phase !== 'playing') return;
  model.elapsed += dt;
  model.comboAge += dt;
  model.shotClock += dt;
  if (model.shotClock >= 0.24) {
    model.shotClock -= 0.24;
    model.shots.push({ id: model.nextId++, x: model.player.x, y: model.player.y - 14 });
  }
  if (model.reinforcements < 1 && model.elapsed >= 12) { model.chains.push(makeChain(model, 72, 8, -1)); model.reinforcements = 1; }
  if (model.reinforcements < 2 && model.elapsed >= 26) { model.chains.push(makeChain(model, 72, 8, 1)); model.reinforcements = 2; }
  const speed = 58 + Math.min(34, model.elapsed * 0.76);
  for (const chain of model.chains) {
    for (const s of chain.segments) { s.x += chain.dir * speed * chain.speedScale * dt; s.flash = Math.max(0, s.flash - dt); }
    const head = chain.segments[0];
    const atEdge = head.x < 18 || head.x > FIELD_W - 18;
    const atObstacle = hitObstacle(chain, model.obstacles);
    if ((atEdge || atObstacle) && model.elapsed - chain.lastDrop > 0.18) dropAndTurn(model, chain, atEdge);
    for (const s of chain.segments) {
      if (s.y >= 548) { model.phase = 'overrun'; model.failure = 'belt'; }
      const dx = s.x - model.player.x; const dy = s.y - model.player.y;
      if (dx * dx + dy * dy < 17 * 17) { model.phase = 'overrun'; model.failure = 'collision'; }
    }
  }
  for (const shot of model.shots) shot.y -= 520 * dt;
  model.shots = model.shots.filter((s) => s.y > -8);
  resolveShots(model);
  for (const b of model.bursts) { b.x += b.dx * dt; b.y += b.dy * dt; b.life -= dt; }
  model.bursts = model.bursts.filter((b) => b.life > 0).slice(-48);
  if (model.phase === 'playing' && model.chains.length === 0 && model.reinforcements >= 2) model.phase = 'cleared';
  if (model.phase === 'playing' && model.elapsed >= ROUND_SECONDS) model.phase = 'cleared';
}

export function togglePause(model: Model): void {
  if (model.phase === 'playing') { model.beforePause = model.phase; model.phase = 'paused'; }
  else if (model.phase === 'paused') model.phase = 'playing';
}
