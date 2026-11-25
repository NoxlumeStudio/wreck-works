import { type Point, type Stage, type Tool } from './stages.ts'

export const bursts = {
  blast: { range: 2.25, kick: 1.55, color: '#ffa66f', local: .60 },
  precise: { range: 1.08, kick: 1.35, color: '#83d8ef', local: .84 },
} as const
export type Burst = keyof typeof bursts
export function isBurst(tool: Tool|null): tool is Burst {
  return tool==='blast'||tool==='precise'
}

export function burstSites(stage: Stage, kind: Burst) {
  const sites=stage.joints.filter(j=>j.kind!=='deck')
  if(kind==='precise')return sites
  const roots=sites.filter(j=>j.kind==='foot').sort((a,b)=>a.x-b.x)
  return [...sites,...roots.slice(1).flatMap((b,i)=>{
    const a=roots[i]
    const distance=Math.hypot(a.x-b.x,a.y-b.y)
    return distance>2.1 && distance<=4.15?[{...a,id:`between-${a.id}-${b.id}`,x:(a.x+b.x)/2,y:(a.y+b.y)/2}]:[]
  })]
}

export function burstJoints(stage: Stage, center: Point, kind: Burst) {
  return stage.joints.filter(j=>Math.hypot(j.x-center.x,j.y-center.y)<=bursts[kind].range)
}

export function burstReach(center: Point, shape: Point & {w:number;h:number;angle?:number}, kind: Burst) {
  const x=center.x-shape.x,y=center.y-shape.y
  const angle=shape.angle??0
  const c=Math.cos(angle),s=Math.sin(angle)
  const dx=Math.max(0,Math.abs(x*c+y*s)-shape.w/2)
  const dy=Math.max(0,Math.abs(-x*s+y*c)-shape.h/2)
  return Math.max(0,1-Math.hypot(dx,dy)/bursts[kind].range)
}

