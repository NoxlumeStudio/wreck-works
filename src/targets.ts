import { floorAt, type FloorBand } from './floors.ts'
import { type Point, type Stage } from './stages.ts'

export function targetLabels(stage: Stage, floors: FloorBand[]) {
  const members = new Map(stage.members.map(m=>[m.id,m]))
  const side = (x: number) => x < -.8 ? '左' : x > .8 ? '右' : '中央'
  const grounds = stage.points.filter(p=>p.kind==='ground').sort((a,b)=>a.x-b.x)
  const entries = [
    ...stage.joints.map(j=>{
      const m=members.get(j.a)
      const floor=floorAt(floors,m??j)
      const prefix=`${floor}階・${side(j.x)}`
      const label=j.id.startsWith('brace')?`${prefix}の斜め支え${j.id.includes('base')?'下端':'上端'}`
        :j.kind==='foot'?`1階・${side(j.x)}柱の根元`
        :j.id.startsWith('join')||j.id.startsWith('seam')?`${prefix}の梁継ぎ目`
        :j.kind==='deck'?`${prefix}の床接合部`
        :`${prefix}柱の${j.id.startsWith('upper')?'上端':'下端'}`
      return {id:j.id,x:j.x,y:j.y,label}
    }),
    ...stage.points.map(p=>({...p,label:p.kind==='ground'?`地面 ${grounds.indexOf(p)+1}（左から）`
      :`${floorAt(floors,p)}階・${side(p.x)}の${p.kind==='beam'?'梁':'柱'}`})),
  ]
  const groups=new Map<string,typeof entries>()
  for(const entry of entries){
    const group=groups.get(entry.label)??[]
    group.push(entry)
    groups.set(entry.label,group)
  }
  const labels=new Map<string,string>()
  for(const [label,group] of groups){
    group.sort((a,b)=>a.x-b.x||a.y-b.y||a.id.localeCompare(b.id))
    group.forEach((p,i)=>labels.set(p.id,group.length===1?label:`${label}（左から${i+1}）`))
  }
  return labels
}

export function nearbyTarget<T>(cursor: Point, targets: readonly { point: Point; item: T }[], radius=21) {
  let first: T|undefined
  let best=Infinity
  let second=Infinity
  for(const {point,item} of targets){
    const distance=Math.hypot(cursor.x-point.x,cursor.y-point.y)
    if(distance<best){second=best;best=distance;first=item}
    else if(distance<second)second=distance
  }
  return best<=radius&&second-best>=4?first:undefined
}
