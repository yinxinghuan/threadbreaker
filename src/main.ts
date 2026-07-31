import './style.css';
import './narrow.css';
import { createModel, FIELD_H, FIELD_W, FIXED_DT, routeCurl, setPlayer, start, step, togglePause, type Model } from './core';
import { locale, t } from './i18n';
import { ThreadbreakerAudio } from './audio';
import { freezeInspection, inspectionAdvice, taskLabel, type InspectionSnapshot } from './inspection';
import { resolvePlayerIdentity, renderIdentity } from './identity.js';
import { PlatformLeaderboard } from './leaderboard.js';

const app = document.querySelector<HTMLElement>('#app')!;
const MEDIA = {
  contained: new URL('./media/thread-contained.jpg', document.baseURI).href,
  residue: new URL('./media/thread-residue.jpg', document.baseURI).href,
  breach: new URL('./media/thread-breach.jpg', document.baseURI).href,
};
document.documentElement.lang = locale;
app.innerHTML = `
  <section class="tb-shell crt-terminal" data-channel="program" aria-label="${t('title')}">
    <header class="tb-opbar">
      <div class="tb-lockup"><span class="tb-kicker">${t('job')}</span><span class="tb-task"><span>${t('task')}</span> <b id="taskCode">IC-PENDING</b></span></div>
      <span class="tb-status" id="status">${t('standby')}</span>
      <button class="tb-rank" id="rank" type="button">${t('rank')}</button>
      <button class="tb-sound" id="sound" type="button"></button>
      <button class="tb-icon" id="pause" type="button" aria-label="${t('ariaPause')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M17 5v14"/></svg></button>
    </header>
    <div class="tb-stage" id="stage">
      <canvas id="game" width="360" height="640"></canvas>
      <div class="tb-guide" id="guide"><strong>${t('ready')}</strong><span>${t('detail')}</span></div>
      <div class="tb-pause" id="pauseLayer" hidden><strong>${t('paused')}</strong><button id="resume" type="button">${t('resume')}</button></div>
      <div class="tb-result" id="result" data-return="locking" hidden>
        <header class="tb-return__head"><strong>${t('fieldReturn')}</strong><span id="returnTask"></span><span id="returnTime"></span></header>
        <div class="tb-evidence"><img id="cameraMedia" src="${MEDIA.contained}" alt="${t('evidence')}" draggable="false"><canvas id="inspection" width="720" height="410" aria-hidden="true" hidden></canvas><div class="tb-locking" id="locking">${t('locking')}</div><span class="tb-camera-label" id="cameraLabel">${t('cameraFeed')}</span></div>
        <div class="tb-return__summary"><div><span id="resultKicker"></span><h1 id="resultTitle"></h1></div><div class="tb-result__stats"><span>${t('score')} <b id="finalScore"></b></span><span>${t('splits')} <b id="finalSplits"></b></span><span>${t('residue')} <b id="finalResidue"></b></span></div></div>
        <p class="tb-reason" id="reason"></p><p class="tb-advice"><b>${t('advice')}</b><span id="advice"></span></p><div class="platform-player"><img data-player-avatar alt="" draggable="false"><span data-player-name>AlterU</span></div>
        <footer class="tb-return__actions"><button id="again" type="button">${t('again')}</button><button class="tb-result-sound" id="resultSound" type="button"></button></footer>
      </div>
    </div>
    <footer class="tb-telemetry" id="telemetry"><div><span>${t('time')}</span><strong id="time">45.0</strong></div><div><span>${t('score')}</span><strong id="score">0000</strong></div><div><span>${t('risk')}</span><strong id="risk">0%</strong></div></footer><section class="platform-rank" role="dialog" aria-modal="true" aria-labelledby="tb-rank-title" hidden><div class="platform-rank__panel"><header><small>THREADBREAKER / TOP 50</small><h2 id="tb-rank-title">${t('rank')}</h2></header><div class="platform-rank__list"></div><button class="platform-rank__close" type="button">${t('close')}</button></div></section><div class="crt-optics" aria-hidden="true"></div><div class="crt-vsync" aria-hidden="true"></div>
  </section>`;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d', { alpha: false })!;
const shell = document.querySelector<HTMLElement>('.tb-shell')!;
const stage = document.querySelector<HTMLElement>('#stage')!;
const guide = document.querySelector<HTMLElement>('#guide')!;
const pauseLayer = document.querySelector<HTMLElement>('#pauseLayer')!;
const result = document.querySelector<HTMLElement>('#result')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause')!;
const soundButton = document.querySelector<HTMLButtonElement>('#sound')!;
const resultSoundButton = document.querySelector<HTMLButtonElement>('#resultSound')!;
const cameraMedia = document.querySelector<HTMLImageElement>('#cameraMedia')!;
const timeNode = document.querySelector<HTMLElement>('#time')!;
const scoreNode = document.querySelector<HTMLElement>('#score')!;
const statusNode = document.querySelector<HTMLElement>('#status')!;
const riskNode = document.querySelector<HTMLElement>('#risk')!;
const taskCodeNode = document.querySelector<HTMLElement>('#taskCode')!;
let model = createModel();
let activePointer: number | null = null;
let accumulator = 0;
let last = performance.now();
let hiddenPause = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const audio = new ThreadbreakerAudio();
const leaderboard = new PlatformLeaderboard({modal:document.querySelector('.platform-rank'),list:document.querySelector('.platform-rank__list'),close:document.querySelector('.platform-rank__close'),triggers:[document.querySelector('#rank')],gameUuid:document.querySelector('meta[name="game-uuid"]')?.getAttribute('content')||'',locale});
type FeedbackMark = { x:number; y:number; life:number; maxLife:number; dx:number; dy:number; kind:'fracture'|'reverse'|'pressure' };
const feedbackMarks: FeedbackMark[] = [];
let pressureLife = 0;
let clearLife = 0;
let telemetry = {maxDepth:208,deepestX:180,dangerContact:false};
let terminalSnapshot:InspectionSnapshot|null=null;
let returnTimer=0;
taskCodeNode.textContent=taskLabel(model);

function worldFromPointer(ev: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  return { x: (ev.clientX - rect.left) / rect.width * FIELD_W, y: (ev.clientY - rect.top) / rect.height * FIELD_H };
}

function handleDown(ev: PointerEvent) {
  if (model.phase === 'cleared' || model.phase === 'overrun' || model.phase === 'paused') return;
  if (activePointer !== null) return;
  audio.unlock();
  activePointer = ev.pointerId;
  canvas.setPointerCapture(ev.pointerId);
  const p = worldFromPointer(ev);
  setPlayer(model, p.x, p.y);
  start(model);
  ev.preventDefault();
}
function handleMove(ev: PointerEvent) {
  if (activePointer !== ev.pointerId || model.phase !== 'playing') return;
  const p = worldFromPointer(ev); setPlayer(model, p.x, p.y); ev.preventDefault();
}
function release(ev: PointerEvent) {
  if (activePointer !== ev.pointerId) return;
  activePointer = null;
  if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
}
function cancelPointer(ev: PointerEvent) {
  if (activePointer === ev.pointerId && canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
  activePointer = null;
  audio.stopAll();
}
canvas.addEventListener('pointerdown', handleDown);
canvas.addEventListener('pointermove', handleMove);
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', cancelPointer);
canvas.addEventListener('lostpointercapture', () => { activePointer = null; audio.stopAll(); });

pauseButton.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); audio.unlock(); audio.ui(); togglePause(model); if (model.phase === 'paused') audio.stopAll(); syncOverlays(); });
soundButton.addEventListener('click', () => { audio.unlock(); audio.setMuted(!audio.muted); syncSoundButton(); if (!audio.muted) audio.ui(); });
resultSoundButton.addEventListener('click', () => { audio.unlock(); audio.setMuted(!audio.muted); syncSoundButton(); if (!audio.muted) audio.ui(); });
document.querySelector<HTMLButtonElement>('#resume')!.addEventListener('click', () => { audio.unlock(); togglePause(model); audio.ui(); syncOverlays(); });
document.querySelector<HTMLButtonElement>('#again')!.addEventListener('click', restart);

function restart() {
  audio.unlock(); audio.stopAll();
  if (returnTimer) window.clearTimeout(returnTimer);
  model = createModel(model.seed + 101);
  terminalSnapshot=null; telemetry={maxDepth:208,deepestX:180,dangerContact:false};
  activePointer = null; accumulator = 0; feedbackMarks.length = 0; pressureLife = 0; clearLife = 0; shell.dataset.ended='false'; taskCodeNode.textContent=taskLabel(model); syncOverlays();
  shell.dataset.channel='program';
}

function pauseForVisibility() {
  activePointer = null;
  audio.stopAll();
  if (model.phase === 'playing') { togglePause(model); hiddenPause = true; syncOverlays(); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseForVisibility(); });
window.addEventListener('blur', pauseForVisibility);
window.addEventListener('focus', () => { hiddenPause = false; });

function syncSoundButton() {
  for (const button of [soundButton,resultSoundButton]) {
    button.textContent=t(audio.muted?'soundOff':'soundOn');
    button.setAttribute('aria-label',t(audio.muted?'ariaSoundOff':'ariaSoundOn'));
    button.setAttribute('aria-pressed',audio.muted?'true':'false');
  }
}
syncSoundButton();

function syncOverlays() {
  guide.hidden = model.phase !== 'ready';
  pauseLayer.hidden = model.phase !== 'paused';
  const ended = model.phase === 'cleared' || model.phase === 'overrun';
  result.hidden = !ended;
  pauseButton.hidden = ended || model.phase === 'ready';
  pauseButton.setAttribute('aria-label', model.phase === 'paused' ? t('ariaResume') : t('ariaPause'));
  shell.dataset.ended=ended?'true':'false';
  if (ended && !terminalSnapshot) enterResult();
}

function enterResult() {
  terminalSnapshot=freezeInspection(model,telemetry);
  const mediaTier=terminalSnapshot.phase==='overrun'?'breach':(terminalSnapshot.splits>=4||terminalSnapshot.segmentCount>8)?'residue':'contained';
  cameraMedia.src=MEDIA[mediaTier];
  document.querySelector<HTMLElement>('#cameraLabel')!.textContent=`${t('cameraFeed')} · ${t('videoLock')}`;
  shell.dataset.channel='camera';
  document.querySelector<HTMLElement>('#returnTask')!.textContent=terminalSnapshot.task;
  document.querySelector<HTMLElement>('#returnTime')!.textContent=`T+${terminalSnapshot.elapsed.toFixed(1)}`;
  document.querySelector<HTMLElement>('#resultKicker')!.textContent=terminalSnapshot.phase==='cleared'?t('completeKicker'):t('cause');
  document.querySelector<HTMLElement>('#resultTitle')!.textContent=terminalSnapshot.phase==='cleared'?t('clear'):t('over');
  document.querySelector<HTMLElement>('#reason')!.textContent=terminalSnapshot.phase==='cleared'?t('survived'):t(terminalSnapshot.failure==='collision'?'collision':'belt');
  document.querySelector<HTMLElement>('#advice')!.textContent=inspectionAdvice(terminalSnapshot,locale);
  document.querySelector<HTMLElement>('#finalScore')!.textContent=String(terminalSnapshot.score);
  document.querySelector<HTMLElement>('#finalSplits')!.textContent=String(terminalSnapshot.splits);
  document.querySelector<HTMLElement>('#finalResidue')!.textContent=String(terminalSnapshot.segmentCount);
  leaderboard.submit(terminalSnapshot.score);
  result.dataset.return=reducedMotion?'evidence':'locking';
  const frozen=terminalSnapshot;
  if(reducedMotion){audio.returnComplete();return;}
  returnTimer=window.setTimeout(()=>{if(terminalSnapshot!==frozen)return;result.dataset.return='evidence';audio.returnComplete();},460);
}

function drawRouteField() {
  ctx.save(); ctx.strokeStyle = '#45463f'; ctx.lineWidth = 1;
  const bucket = Math.floor(model.elapsed / 3);
  for (let y = 188; y < 520; y += 48) {
    for (let x = 24; x < 348; x += 48) {
      const c = routeCurl(model.seed, x, y, bucket);
      ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y + c * 5); ctx.lineTo(x + 2, y + c * 2); ctx.moveTo(x + 7, y + c * 5); ctx.lineTo(x + 3, y + c * 7); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawObstacle(x: number, y: number, hp: number) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = hp === 1 ? '#E35B38' : '#777568'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 3); ctx.moveTo(0, 3); ctx.lineTo(-8, 9); ctx.moveTo(0, 3); ctx.lineTo(8, 9); ctx.stroke(); ctx.restore();
}

function drawSegment(x: number, y: number, angle: number, danger: boolean, head: boolean, fractured: boolean, curl: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = danger ? '#E35B38' : '#EAE6D8';
  ctx.beginPath(); ctx.moveTo(head ? 10 : 8, 0); ctx.lineTo(4, -7); ctx.lineTo(-7, -6); ctx.lineTo(-9, 0); ctx.lineTo(-7, 6); ctx.lineTo(4, 7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#171814'; ctx.fillRect(-2, -2, 4, 4);
  if (fractured) {
    ctx.strokeStyle = danger ? '#171814' : '#E35B38'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-7,-5); ctx.lineTo(-2,-1); ctx.lineTo(-6,5); ctx.moveTo(1,-6); ctx.lineTo(5,-2); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = danger ? '#5f2c20' : '#45463f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - Math.sign(Math.cos(angle) || 1) * 14, y - curl * 2); ctx.lineTo(x - Math.sign(Math.cos(angle) || 1) * 23, y - curl * 4); ctx.stroke();
}

function addFracture(x:number, y:number, split:boolean) {
  const count = split ? 7 : 4;
  for (let i=0;i<count;i+=1) {
    const side = i % 2 ? 1 : -1;
    feedbackMarks.push({ x, y, life:split ? .32 : .2, maxLife:split ? .32 : .2, dx:side*(38+i*5), dy:-28+i*8, kind:split?'reverse':'fracture' });
  }
  feedbackMarks.splice(0, Math.max(0, feedbackMarks.length - 56));
}

function stepWithFeedback(dt:number) {
  const beforeSegments = new Map<number,{x:number;y:number}>();
  const beforeChains = new Map<number,{x:number;y:number;dir:number}>();
  const beforeShots = new Set(model.shots.map((shot) => shot.id));
  for (const chain of model.chains) {
    const head = chain.segments[0];
    if (head) beforeChains.set(chain.id, {x:head.x,y:head.y,dir:chain.dir});
    for (const segment of chain.segments) beforeSegments.set(segment.id, {x:segment.x,y:segment.y});
  }
  const beforeSplit = model.splits;
  const beforePhase = model.phase;
  step(model, dt);
  for(const chain of model.chains)for(const segment of chain.segments){
    if(segment.y>telemetry.maxDepth){telemetry.maxDepth=segment.y;telemetry.deepestX=segment.x;}
    if(segment.y>=500)telemetry.dangerContact=true;
  }
  const afterSegmentIds = new Set(model.chains.flatMap((chain) => chain.segments.map((segment) => segment.id)));
  const removed = [...beforeSegments.entries()].filter(([id]) => !afterSegmentIds.has(id));
  for (const [,position] of removed) addFracture(position.x, position.y, model.splits > beforeSplit);
  if (removed.length) audio.hit(model.combo);
  if (model.splits > beforeSplit) {
    audio.split(); audio.reverse();
    if ('vibrate' in navigator) navigator.vibrate?.(12);
  }
  if (model.shots.some((shot) => !beforeShots.has(shot.id))) audio.shot();
  for (const chain of model.chains) {
    const previous = beforeChains.get(chain.id); const head = chain.segments[0];
    if (!head) continue;
    const dropped = previous && head.y - previous.y > 18;
    if (dropped && head.y >= 452) {
      pressureLife = .36; audio.danger();
      feedbackMarks.push({x:head.x,y:head.y,life:.28,maxLife:.28,dx:chain.dir*34,dy:22,kind:'pressure'});
    }
  }
  if (beforePhase !== model.phase) {
    if (model.phase === 'overrun') { audio.playerHit(); if ('vibrate' in navigator) navigator.vibrate?.([18,30,28]); }
    if (model.phase === 'cleared') { clearLife = .7; audio.clear(); }
  }
}

function advanceFeedback(dt:number) {
  pressureLife = Math.max(0, pressureLife - dt); clearLife = Math.max(0, clearLife - dt);
  for (const mark of feedbackMarks) { mark.life -= dt; if (!reducedMotion) { mark.x += mark.dx*dt; mark.y += mark.dy*dt; } }
  for (let i=feedbackMarks.length-1;i>=0;i-=1) if (feedbackMarks[i].life <= 0) feedbackMarks.splice(i,1);
}

function drawFeedback() {
  for (const mark of feedbackMarks) {
    const late = mark.life < mark.maxLife*.45;
    ctx.save(); ctx.translate(mark.x,mark.y); ctx.rotate(Math.atan2(mark.dy,mark.dx));
    ctx.fillStyle = mark.kind === 'pressure' ? '#E35B38' : late ? '#777568' : '#EAE6D8';
    ctx.beginPath(); ctx.moveTo(0,-2); ctx.lineTo(mark.kind==='reverse'?11:7,0); ctx.lineTo(0,3); ctx.lineTo(-3,0); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  if (clearLife > 0) {
    const reach = reducedMotion ? 116 : (1-clearLife/.7)*116;
    ctx.strokeStyle='#6EC4A5';ctx.lineWidth=3;
    for(let i=0;i<4;i+=1){const y=220+i*54;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(reach,y);ctx.moveTo(FIELD_W,y);ctx.lineTo(FIELD_W-reach,y);ctx.stroke();}
  }
}

function draw() {
  ctx.fillStyle = '#171814'; ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  const danger = model.chains.some((chain) => chain.segments.some((segment) => segment.y > 500));
  const pulse = reducedMotion || !danger ? false : Math.floor(performance.now()/150)%2===0;
  ctx.fillStyle = danger && pulse ? '#33211C' : '#222C27'; ctx.fillRect(0, 548, FIELD_W, 92);
  if (danger || pressureLife > 0) {
    ctx.fillStyle='#E35B38';
    for(let x=-20;x<FIELD_W+20;x+=28){ctx.save();ctx.translate(x,558);ctx.rotate(-.65);ctx.fillRect(0,0,14,3);ctx.restore();}
  }
  ctx.strokeStyle = '#6EC4A5'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(0, 548); ctx.lineTo(FIELD_W, 548); ctx.stroke(); ctx.setLineDash([]);
  drawRouteField();
  for (const o of model.obstacles) drawObstacle(o.x, o.y, o.hp);
  for (const chain of model.chains) {
    for (let i = chain.segments.length - 1; i >= 0; i -= 1) {
      const s = chain.segments[i];
      const curl = routeCurl(model.seed + chain.id, s.x, s.y, Math.floor(model.elapsed/3));
      drawSegment(s.x, s.y, chain.dir > 0 ? 0 : Math.PI, s.y > 500, i === 0, chain.speedScale > 1.001, curl);
    }
  }
  ctx.fillStyle = '#EAE6D8';
  for (const s of model.shots) { ctx.fillRect(s.x - 1.5, s.y - 7, 3, 11); }
  ctx.fillStyle = '#E35B38';
  for (const b of model.bursts) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.dy, b.dx)); ctx.fillRect(0, -1, reducedMotion ? 3 : 7, 2); ctx.restore(); }
  drawFeedback();
  ctx.save(); ctx.translate(model.player.x, model.player.y); ctx.fillStyle = '#6EC4A5'; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(12, 10); ctx.lineTo(3, 7); ctx.lineTo(0, 11); ctx.lineTo(-3, 7); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#171814'; ctx.fillRect(-2, -4, 4, 8); ctx.restore();
}

function frame(now: number) {
  const delta = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  accumulator += delta;
  let guard = 0;
  while (accumulator >= FIXED_DT && guard < 20) { stepWithFeedback(FIXED_DT); accumulator -= FIXED_DT; guard += 1; }
  if (model.phase !== 'paused') advanceFeedback(delta);
  timeNode.textContent = Math.max(0, 45 - model.elapsed).toFixed(1);
  scoreNode.textContent = String(model.score).padStart(4, '0');
  const currentDepth=Math.max(0,...model.chains.flatMap(chain=>chain.segments.map(segment=>segment.y)));
  const risk=Math.max(0,Math.min(100,Math.round((currentDepth-160)/(548-160)*100)));
  riskNode.textContent=`${risk}%`;
  statusNode.textContent=model.phase==='ready'?t('standby'):model.phase==='paused'?t('paused'):model.phase==='playing'?(model.combo>1?`${t('combo')} ×${model.combo}`:t('active')):'';
  syncOverlays(); draw(); requestAnimationFrame(frame);
}

renderIdentity(app); resolvePlayerIdentity().then((identity:any)=>renderIdentity(app,identity));
syncOverlays(); requestAnimationFrame(frame);

declare global { interface Window { __THREADBREAKER__?: { snapshot: () => any; restart: () => void; simulate: (seconds: number) => void; cancelInput: () => void; forceResult: (phase: 'cleared'|'overrun', failure?: 'belt'|'collision', tier?: 'contained'|'residue'|'breach') => void; audio: () => ReturnType<ThreadbreakerAudio['debug']>; inspection: () => InspectionSnapshot|null; returnState: () => string|undefined; setMuted: (value:boolean) => void; triggerSound: (event:'shot'|'hit'|'split'|'reverse'|'danger'|'playerHit'|'clear') => void } } }
window.__THREADBREAKER__ = {
  snapshot: () => ({ ...JSON.parse(JSON.stringify(model)), inputActive: activePointer !== null }),
  restart,
  simulate: (seconds) => { start(model); for (let t = 0; t < seconds; t += FIXED_DT) stepWithFeedback(FIXED_DT); syncOverlays(); draw(); },
  cancelInput: () => { activePointer = null; audio.stopAll(); },
  forceResult: (phase, failure = 'belt', tier) => { if(returnTimer)window.clearTimeout(returnTimer);terminalSnapshot=null;model.phase=phase;model.failure=phase==='overrun'?failure:null;if(phase==='cleared'){if(tier==='contained'){model.chains=[];model.splits=1;}else if(tier==='residue'){model.splits=6;}clearLife=.7;audio.clear();}else{telemetry.maxDepth=Math.max(telemetry.maxDepth,552);telemetry.deepestX=model.player.x;telemetry.dangerContact=true;audio.playerHit();}syncOverlays();draw(); },
  audio: () => audio.debug(),
  inspection:()=>terminalSnapshot?JSON.parse(JSON.stringify(terminalSnapshot)):null,
  returnState:()=>result.dataset.return,
  setMuted: (value) => { audio.setMuted(value); syncSoundButton(); },
  triggerSound: (event) => { audio.unlock(); if (event === 'hit') audio.hit(model.combo); else audio[event](); },
};
