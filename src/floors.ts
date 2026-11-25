import { type Stage, type Point } from './stages.ts'

export type FloorBand = { left: number; right: number; bottom: number; top: number; number: number }

export function floorBands(stage: Stage): FloorBand[] {
  const decks = stage.members.filter(m=>m.kind==='floor').sort((a,b)=>a.y-b.y)
  const groups: typeof decks[] = []
  for (const deck of decks) {
    const last = groups.at(-1)
    if (last && Math.abs(last[0].y-deck.y)<.1) last.push(deck)
    else groups.push([deck])
  }
  let bottom = Math.min(decks[0]?.y ?? 0, ...stage.members.filter(m=>m.kind==='post').map(m=>m.y-m.h/2))
  return groups.map((group,index)=>{
    const band = {
      left:Math.min(...group.map(m=>m.x-m.w/2)),
      right:Math.max(...group.map(m=>m.x+m.w/2)),
      bottom,
      top:Math.max(...group.map(m=>m.y)),
      number:index+1,
    }
    bottom=band.top
    return band
  })
}

export function floorAt(floors: FloorBand[], p: Point) {
  return (floors.find(b=>p.y<=b.top+.1) ?? floors.at(-1))?.number ?? 1
}
