import { type Remaining, type SiteEvent } from './physics.ts'
import { type Member, type Stage } from './stages.ts'

export function sectionName(x: number) {
  return x < -1.15 ? '左側' : x > 1.15 ? '右側' : '中央'
}

export function objectName(stage: Stage, id?: string) {
  if(id==='blast')return '通常型の作用'
  if(id==='precise')return '精密型の作用'
  const asset=stage.assets?.find(a=>a.id===id||a.body===id)
  if(asset)return asset.name
  const m = stage.members.find(part => part.id === id)
  if (!m) {
    if (id === 'ground') return '地面'
    if (id?.startsWith('weight:')) return '重り'
    if (id?.startsWith('g')) return 'クッション材'
    if (id?.startsWith('neighbor')) return '隣家'
    return '建材'
  }
  const names: Record<Member['kind'], string> = {
    post: '柱', beam: '梁', floor: '床', furniture: '荷物', safe: '金庫', partition: '壁',
  }
  return ['post','beam','floor'].includes(m.kind) ? `${sectionName(m.x)}の${names[m.kind]}` : names[m.kind]
}

export function eventText(stage: Stage, event: SiteEvent) {
  const target = objectName(stage, event.target)
  const source = objectName(stage, event.source)
  switch (event.kind) {
    case 'blast': return '通常型が広い範囲に作用'
    case 'precise': return '精密型が狭い範囲に作用'
    case 'cut': return `${sectionName(event.at.x)}のつながりを切断`
    case 'break': return `${sectionName(event.at.x)}のつながりが衝撃や負荷で外れた`
    case 'wire': return `ワイヤーが張り、${target}を引いた`
    case 'weight': return `重りが${source}に荷重をかけた`
    case 'jack': return `ジャッキが${target}を下から押した`
    case 'pad': return `クッション材が${source}を受け止めた`
    case 'neighborHit': if(event.source==='blast'||event.source==='precise')return `${target}が${source}で損傷`; return `${source}が${stage.assets ? target : sectionName(event.at.x)+'の隣家'}に当たった`
    case 'safeHit': if(event.source==='blast'||event.source==='precise')return `${target}が${source}で損傷`; return `${target}が${source}とぶつかった`
  }
}

export function remainingAdvice(remaining: Remaining[]) {
  const supported = remaining.filter(p => p.reason === 'supported')
  if (supported.length) {
    const posts = supported.filter(p => p.id.startsWith('p'))
    const zones = new Set((posts.length ? posts : supported).map(p => sectionName(p.at.x)))
    const location = zones.size === 1 ? `${Array.from(zones)[0]}の` : ''
    return `${location}支えが地面につながったままです。残った柱の周りを見てみましょう。`
  }
  const outside = remaining.find(p => p.reason === 'outside')
  if (outside) return `${sectionName(outside.at.x)}に敷地を出た建材があります。倒れる方向を変えてみましょう。`
  if (remaining.some(p => p.reason === 'high')) return '低い位置まで落ちていない建材があります。つながった部分や、下に積もった建材を見てみましょう。'
  return 'まだ動いている建材があります。崩れ方を変えて、敷地内で早く静まる位置を探してみましょう。'
}

export const remainingReasonText: Record<Remaining['reason'],string> = {
  supported:'地面とつながっている', outside:'敷地の外にある', high:'解体基準より高い',
  moving:'動いている', settling:'静止の確認中',
}
