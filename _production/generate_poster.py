#!/usr/bin/env python3
import json, subprocess, time
from pathlib import Path
API='https://chat.aiwaves.tech/aigram/api/gen-image'
ROOT=Path(__file__).resolve().parents[1]
REF='https://cdn.aiwaves.tech/prod/telegram/avatar/0/1785518316602030.webp'
PROMPT='''Edit this square THREADBREAKER poster while preserving the sealed industrial facility, long segmented black chain organism, red safety boundary, compact inspection emitter, distant operator silhouette, hard screen-print texture, palette and exact title THREADBREAKER. Remove every other letter, number, pseudo-text, resolution label, microtype, HUD glyph, warning icon, interface border annotation and decorative symbol. The only visible text anywhere must be the exact title THREADBREAKER. Reconstruct removed areas as natural pipes, wall, floor, monitor glow or darkness. Keep the title fully legible in the top 20 percent and preserve strong 160x160 readability. No logo, watermark, modern dashboard, phone frame or identifiable face.'''
def main():
  payload=json.dumps({'prompt':PROMPT,'ref_url':REF})
  result=subprocess.run(['curl','--silent','--show-error','--fail-with-body','--max-time','420','-H','Content-Type: application/json','-H','Origin: https://aigram.app','-H','Referer: https://aigram.app/','--data-binary',payload,API],check=True,capture_output=True,text=True)
  response=json.loads(result.stdout); url=response['url']; source=ROOT/'public/poster.source.webp'; output=ROOT/'public/poster.png'
  subprocess.run(['curl','--silent','--show-error','--fail','--location',url,'--output',str(source)],check=True)
  subprocess.run(['sips','-s','format','png',str(source),'--out',str(output)],check=True,capture_output=True); source.unlink()
  (ROOT/'doc/poster-provenance.md').write_text(f'# 海报制作来源\n\n- 制作方式：Aigram 平台 transit 生图接口。\n- 请求时间：{time.strftime("%Y-%m-%d %H:%M:%S %z")}\n- Endpoint：`{API}`\n- 请求头：`Origin: https://aigram.app`。\n- 返回 URL：{url}\n- 输出：`public/poster.png`，1024×1024 raster PNG。\n- 未使用 ComfyUI、本地 workflow、SVG/Canvas 或游戏截图。\n\n## Prompt\n\n```text\n{PROMPT}\n```\n',encoding='utf-8')
  print(json.dumps({'url':url,'output':str(output)},ensure_ascii=False))
if __name__=='__main__': main()
