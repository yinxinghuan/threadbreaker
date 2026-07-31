import type { Model } from './core';
import type { Locale } from './i18n';

export type TerminalChain = {
  id: number;
  dir: -1 | 1;
  speedScale: number;
  segments: { id:number; x:number; y:number }[];
};

export type InspectionSnapshot = {
  task: string;
  phase: 'cleared' | 'overrun';
  failure: 'belt' | 'collision' | null;
  elapsed: number;
  score: number;
  splits: number;
  maxDepth: number;
  deepestX: number;
  dangerContact: boolean;
  chains: TerminalChain[];
  segmentCount: number;
  spawnedSegments: number;
  player: {x:number;y:number};
};

export function freezeInspection(model: Model, telemetry:{maxDepth:number;deepestX:number;dangerContact:boolean}): InspectionSnapshot {
  const chains = model.chains.map((chain) => ({
    id: chain.id,
    dir: chain.dir,
    speedScale: chain.speedScale,
    segments: chain.segments.map((segment) => ({id:segment.id,x:segment.x,y:segment.y})),
  }));
  const segmentCount = chains.reduce((sum, chain) => sum + chain.segments.length, 0);
  return {
    task:taskLabel(model),
    phase:model.phase === 'overrun' ? 'overrun' : 'cleared', failure:model.failure,
    elapsed:model.elapsed, score:model.score, splits:model.splits,
    maxDepth:Math.max(telemetry.maxDepth, ...chains.flatMap(chain => chain.segments.map(segment => segment.y)), 0),
    deepestX:telemetry.deepestX, dangerContact:telemetry.dangerContact,
    chains, segmentCount, spawnedSegments:18 + model.reinforcements * 8,
    player:{...model.player},
  };
}

export function taskLabel(model:Pick<Model,'seed'>):string {
  const taskSeed=((model.seed*2654435761)>>>0).toString(36).toUpperCase().padStart(6,'0').slice(-6);
  return `IC-${taskSeed}`;
}

export function inspectionAdvice(snapshot:InspectionSnapshot, locale:Locale): string {
  if (locale === 'zh') {
    if (snapshot.phase === 'overrun' && snapshot.failure === 'collision') return '炮塔与污染链同道相撞；下一次先横移出射击线，再切断最靠近炮塔的链头。';
    if (snapshot.phase === 'overrun' && snapshot.splits >= 3) return `本局制造 ${snapshot.splits} 次分裂，反向片段过多；下一次更早切头，减少中段断裂。`;
    if (snapshot.phase === 'overrun') return `最深侵入 ${Math.round(snapshot.maxDepth)}；在链头进入 500 刻度前优先截断下压片段。`;
    if (snapshot.splits >= 4) return `隔离成功，但 ${snapshot.splits} 次分裂留下更高污染负荷；下一次减少中段命中。`;
    if (snapshot.segmentCount > 10) return `管道已恢复，但仍有 ${snapshot.segmentCount} 节待检；下一次优先清理最深链头。`;
    return '流向已恢复；保持当前切头节奏，继续压低危险带接触。';
  }
  if (snapshot.phase === 'overrun' && snapshot.failure === 'collision') return 'The launcher shared a lane with the contaminant. Move clear, then cut the nearest head.';
  if (snapshot.phase === 'overrun' && snapshot.splits >= 3) return `${snapshot.splits} splits created too many reversing fragments. Cut heads earlier next run.`;
  if (snapshot.phase === 'overrun') return `Deepest ingress ${Math.round(snapshot.maxDepth)}. Cut descending heads before the 500 mark.`;
  if (snapshot.splits >= 4) return `Containment held, but ${snapshot.splits} splits raised residue load. Avoid middle cuts.`;
  if (snapshot.segmentCount > 10) return `Flow restored with ${snapshot.segmentCount} segments pending inspection. Clear the deepest head first.`;
  return 'Flow restored. Keep the head-cut rhythm and reduce danger-band contact.';
}

export function drawInspection(canvas:HTMLCanvasElement, snapshot:InspectionSnapshot, locale:Locale): void {
  const ctx = canvas.getContext('2d', {alpha:false});
  if (!ctx) throw new Error('inspection canvas unavailable');
  const w=720,h=410; canvas.width=w;canvas.height=h;
  ctx.fillStyle='#F1EEE4';ctx.fillRect(0,0,w,h);
  seededPaper(ctx,w,h,seedFrom(snapshot.task));
  ctx.strokeStyle='#171816';ctx.lineWidth=3;ctx.strokeRect(14,14,w-28,h-28);
  ctx.fillStyle='#171816';ctx.font='800 20px "Arial Narrow","PingFang SC",sans-serif';
  ctx.fillText(locale==='zh'?'污染管道剖面 / 显微巡检':'PIPE SECTION / MICRO INSPECTION',30,43);
  ctx.font='700 15px ui-monospace,monospace';ctx.textAlign='right';ctx.fillText(snapshot.task,w-30,42);ctx.textAlign='left';

  if (snapshot.phase === 'cleared') drawCleared(ctx,snapshot); else drawOverrun(ctx,snapshot);
  drawStamp(ctx,snapshot,locale);
  ctx.fillStyle='#171816';ctx.font='700 14px ui-monospace,monospace';
  ctx.fillText(`SPLIT ${String(snapshot.splits).padStart(2,'0')}  RESIDUE ${String(snapshot.segmentCount).padStart(2,'0')}  DEPTH ${Math.round(snapshot.maxDepth)}`,30,386);
}

function drawCleared(ctx:CanvasRenderingContext2D,s:InspectionSnapshot):void {
  ctx.strokeStyle='#8D8A80';ctx.lineWidth=2;
  const left=36,top=74,cellW=104,cellH=112;
  for(let row=0;row<2;row+=1)for(let col=0;col<6;col+=1){ctx.strokeRect(left+col*cellW,top+row*cellH,cellW-8,cellH-8);ctx.font='700 11px ui-monospace,monospace';ctx.fillStyle='#8D8A80';ctx.fillText(`B${row+1}-${col+1}`,left+col*cellW+7,top+row*cellH+16);}
  ctx.strokeStyle='#6CA99E';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(42,323);ctx.bezierCurveTo(180,284,338,348,674,304);ctx.stroke();
  ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(48,323);ctx.lineTo(666,304);ctx.stroke();
  for(const chain of s.chains){
    const cell=(chain.id+s.splits)%12,row=Math.floor(cell/6),col=cell%6;
    const baseX=left+col*cellW+45,baseY=top+row*cellH+55;
    chain.segments.slice(0,7).forEach((segment,index)=>drawMicroSegment(ctx,baseX+(index%3-1)*18,baseY+(Math.floor(index/3)-1)*18,chain.dir,segment.id%2===0,'#171816'));
  }
  const removed=Math.max(0,s.spawnedSegments-s.segmentCount);
  ctx.fillStyle='#6CA99E';ctx.fillRect(42,337,Math.min(610,removed/Math.max(1,s.spawnedSegments)*610),8);
  ctx.fillStyle='#171816';ctx.font='800 16px "Arial Narrow",sans-serif';ctx.fillText(`COLLECTED ${removed}/${s.spawnedSegments}`,42,365);
}

function drawOverrun(ctx:CanvasRenderingContext2D,s:InspectionSnapshot):void {
  const left=38,top=70,width=644,height=270;
  ctx.strokeStyle='#171816';ctx.lineWidth=4;ctx.strokeRect(left,top,width,height);
  ctx.strokeStyle='#8D8A80';ctx.lineWidth=1;
  for(let x=left+46;x<left+width;x+=46){ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+height);ctx.stroke();}
  for(let y=top+45;y<top+height;y+=45){ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(left+width,y);ctx.stroke();}
  const beltY=top+(548/640)*height;
  ctx.strokeStyle='#C94B32';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(left,beltY);ctx.lineTo(left+width,beltY);ctx.stroke();
  for(const chain of s.chains)for(const segment of chain.segments){
    const x=left+clamp(segment.x/360,0,1)*width,y=top+clamp(segment.y/640,0,1)*height;
    drawMicroSegment(ctx,x,y,chain.dir,chain.speedScale>1.001,segment.y>=500?'#C94B32':'#171816');
  }
  const breachX=left+clamp(s.deepestX/360,0,1)*width;
  ctx.strokeStyle='#C94B32';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(breachX-15,beltY-14);ctx.lineTo(breachX+16,beltY+15);ctx.moveTo(breachX+15,beltY-14);ctx.lineTo(breachX-16,beltY+15);ctx.stroke();
  ctx.fillStyle='#C94B32';ctx.font='900 17px "Arial Narrow",sans-serif';ctx.fillText(`BREACH X${Math.round(s.deepestX)} / Y${Math.round(s.maxDepth)}`,Math.max(42,Math.min(505,breachX-70)),beltY+35);
  ctx.strokeStyle='#171816';ctx.lineWidth=3;ctx.strokeRect(left+s.player.x/360*width-12,top+s.player.y/640*height-8,24,16);
}

function drawMicroSegment(ctx:CanvasRenderingContext2D,x:number,y:number,dir:-1|1,fractured:boolean,color:string):void {
  ctx.save();ctx.translate(x,y);ctx.scale(dir,1);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(4,-6);ctx.lineTo(-8,-5);ctx.lineTo(-10,0);ctx.lineTo(-8,5);ctx.lineTo(4,6);ctx.closePath();ctx.fill();
  if(fractured){ctx.strokeStyle='#F1EEE4';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,-5);ctx.lineTo(-1,0);ctx.lineTo(-5,5);ctx.stroke();}
  ctx.restore();
}

function drawStamp(ctx:CanvasRenderingContext2D,s:InspectionSnapshot,locale:Locale):void {
  ctx.save();ctx.translate(565,92);ctx.rotate(s.phase==='cleared'?-0.055:0.07);ctx.strokeStyle=s.phase==='cleared'?'#6CA99E':'#C94B32';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=5;ctx.strokeRect(-10,-28,125,62);ctx.font='900 23px "Arial Narrow","PingFang SC",sans-serif';ctx.textAlign='center';ctx.fillText(s.phase==='cleared'?(locale==='zh'?'已隔离':'CONTAINED'):(locale==='zh'?'已突破':'BREACHED'),52,9);ctx.restore();
}

function seedFrom(value:string):number {let out=2166136261;for(let i=0;i<value.length;i+=1){out^=value.charCodeAt(i);out=Math.imul(out,16777619);}return out>>>0;}
function seededPaper(ctx:CanvasRenderingContext2D,w:number,h:number,seed:number):void {let x=seed||1;ctx.fillStyle='#D8D4C9';for(let i=0;i<210;i+=1){x=(Math.imul(x,1664525)+1013904223)>>>0;const px=x%w;x=(Math.imul(x,1664525)+1013904223)>>>0;const py=x%h;ctx.fillRect(px,py,(x%3)+1,1);}}
function clamp(value:number,min:number,max:number):number{return Math.max(min,Math.min(max,value));}
