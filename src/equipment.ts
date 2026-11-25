import { burstSites, isBurst } from './bursts.ts'
import { padWidth, type Placement, type Point, type Stage } from './stages.ts'

export type Equipment = { at: Point; anchor?: Point; size?: Point }

export function equipment(stage: Stage, placed: Placement): Equipment {
  if(isBurst(placed.tool))return {at:burstSites(stage,placed.tool).find(p=>p.id===placed.target)!}
  const target = (placed.tool === 'cut' ? stage.joints : stage.points).find(p => p.id === placed.target)!
  const anchor = stage.points.find(p => p.id === placed.anchor)
  if (placed.tool === 'weight') return { at: { x: target.x, y: target.y + .25 }, size: { x: .74, y: .48 } }
  if (placed.tool === 'pad') return { at: { x: target.x, y: .72 }, size: { x: padWidth, y: .37 } }
  if (placed.tool === 'jack') return { at: { x: target.x, y: target.y - .39 }, anchor }
  return { at: target, anchor }
}

export function visibleSegment(a: Point, b: Point, width: number, height: number) {
  // Clip to the viewport before creating a hit region with a clickable center.
  const dx = b.x - a.x
  const dy = b.y - a.y
  let start = 0
  let end = 1
  for (const [direction, edge] of [[-dx, a.x], [dx, width - a.x], [-dy, a.y], [dy, height - a.y]]) {
    if (!direction) {
      if (edge < 0) return undefined
      continue
    }
    const t = edge / direction
    if (direction < 0) start = Math.max(start, t)
    else end = Math.min(end, t)
    if (end <= start) return undefined
  }
  return [{ x: a.x + dx * start, y: a.y + dy * start }, { x: a.x + dx * end, y: a.y + dy * end }] as const
}
