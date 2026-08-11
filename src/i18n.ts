export type Locale = 'zh' | 'en';

declare global { interface Window { __AIGRAM_LOCALE__?: string; AW?: { locale?: string; language?: string } } }

function normalize(value: unknown): Locale | null {
  if (typeof value !== 'string') return null;
  const v = value.toLowerCase();
  if (v.startsWith('zh')) return 'zh';
  if (v.startsWith('en')) return 'en';
  return null;
}

export function detectLocale(): Locale {
  const host = normalize(window.__AIGRAM_LOCALE__) || normalize(window.AW?.locale) || normalize(window.AW?.language);
  if (host) return host;
  const params = new URLSearchParams(location.search);
  const query = normalize(params.get('lang') || params.get('locale'));
  if (query) return query;
  const stored = normalize(alteruLocalStorage.getItem('game_locale'));
  if (stored) return stored;
  return normalize(navigator.language) || 'en';
}

const copy = {
  zh: { title:'断线者', job:'程序 CH-03 · 污染控制', task:'任务', standby:'待执行', active:'控制中', time:'时间', score:'分数', risk:'链风险', ready:'拖动炮塔 · 自动射击', detail:'切断链体，但每次断裂都会制造新威胁', pause:'暂停', resume:'继续', paused:'已冻结', clear:'管道已隔离', over:'安全带已突破', belt:'链体压入安全带', collision:'链体撞上炮塔', survived:'坚持到最后', completeKicker:'全部污染波已清除', clearTip:'下一局少制造断裂，争取更高分', cause:'失败原因', again:'再次执行', combo:'连击', splits:'断裂', residue:'残片', depth:'侵入', fieldReturn:'外部摄像输入', locking:'继电器切换 / 视频同步', evidence:'封闭设施巡检摄像', cameraFeed:'管道巡检摄像机', videoLock:'信号锁定', advice:'检修建议', ariaPause:'暂停游戏', ariaResume:'继续游戏', soundOn:'声音\n开', soundOff:'声音\n关', ariaSoundOn:'关闭声音', ariaSoundOff:'打开声音', rank:'排行', close:'关闭' },
  en: { title:'THREADBREAKER', job:'PROGRAM CH-03 · CONTAINMENT', task:'TASK', standby:'STANDBY', active:'CONTAINING', time:'TIME', score:'SCORE', risk:'CHAIN RISK', ready:'DRAG TO MOVE · AUTO FIRE', detail:'Cut the chain. Every split creates a new threat.', pause:'PAUSE', resume:'RESUME', paused:'FROZEN', clear:'PIPE CONTAINED', over:'SAFETY BELT BREACHED', belt:'The chain reached your safe band', collision:'The chain struck your launcher', survived:'You held until the end', completeKicker:'ALL CONTAMINANT WAVES CLEARED', clearTip:'Replay with fewer splits for a higher score.', cause:'FAILURE CAUSE', again:'RUN AGAIN', combo:'CHAIN', splits:'SPLITS', residue:'RESIDUE', depth:'INGRESS', fieldReturn:'EXTERNAL CAMERA INPUT', locking:'RELAY CUT / VIDEO SYNC', evidence:'Sealed facility inspection camera', cameraFeed:'PIPE INSPECTION CAMERA', videoLock:'VIDEO LOCK', advice:'MAINTENANCE NOTE', ariaPause:'Pause game', ariaResume:'Resume game', soundOn:'SOUND\nON', soundOff:'SOUND\nOFF', ariaSoundOn:'Mute sound', ariaSoundOff:'Enable sound', rank:'RANK', close:'CLOSE' },
} as const;

export type CopyKey = keyof typeof copy.en;
export const locale = detectLocale();
export const t = (key: CopyKey): string => copy[locale][key];
