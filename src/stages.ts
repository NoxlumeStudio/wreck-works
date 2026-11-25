export type Point = { x: number; y: number }
export const point = (x: number, y: number): Point => ({ x, y })
export const materials = {
  wood: { density: 530, depth: .21, elastic: 9e9, strength: 30e6, color: '#9f6651', friction: .64 },
  steel: { density: 7850, depth: .05, elastic: 200e9, strength: 250e6, color: '#66817d', friction: .42 },
  concrete: { density: 2350, depth: .16, elastic: 28e9, strength: 24e6, color: '#707a75', friction: .83 },
}
export const tools = {
  cut: { name: '切断機', desc: '支えを外して、上を落とす', price: 180, icon: 'scissors', hint: '丸い印で、切るつながりを選びます。', use: '残った支えが建物を持ちこたえることもあります。' },
  weight: { name: '重り', desc: '床に重さをかけて崩す', price: 300, icon: 'weight', hint: '床の上に出る印をクリックします。', use: '落としたい側に載せると、そちらに重さがかかります。' },
  wire: { name: 'ワイヤー', desc: '引っ張って、倒れる向きを変える', price: 340, icon: 'wire', hint: '地面の印を選び、次に引く建材を選びます。', use: '線が張ると、つないだ建材が地面の固定点へ引かれます。' },
  jack: { name: 'ジャッキ', desc: '下から押して、バランスを崩す', price: 380, icon: 'jack', hint: '地面の印を選び、次に真上の梁を選びます。', use: '下からゆっくり持ち上げて、建物の傾きを変えます。' },
  pad: { name: 'クッション材', desc: '落ちてくる物を受け止める', price: 240, icon: 'pad', hint: '地面の印を選び、点線の範囲で落下物を受けます。', use: '落ちてきた物がパッドに当たると、衝撃をやわらげます。' },
  blast: {name:'通常型ダイナマイト',desc:'広い範囲のつながりをゆるめる',price:480,icon:'blast',hint:'印に合わせ、オレンジの作用範囲を確認します。',use:'架空の範囲効果です。保護対象が範囲に入ると損傷することがあります。'},
  precise: {name:'精密型ダイナマイト',desc:'狭い範囲に作用を集中する',price:550,icon:'precise',hint:'印に合わせ、水色の作用範囲を確認します。',use:'密集したつながりを狙えます。範囲に入った保護対象には影響します。'},
} as const
export const padWidth = 2.09
export type Tool = keyof typeof tools
export type Member = Point & {
  id: string; w: number; h: number; angle: number; material: keyof typeof materials
  kind: 'post' | 'beam' | 'floor' | 'furniture' | 'safe' | 'partition'; tint?: string
}
export type Joint = Point & { id: string; a: string; b: string; kind: 'foot' | 'frame' | 'deck' }
export type SitePoint = Point & { id: string; body?: string; kind: 'ground' | 'beam' | 'body' }
export type Placement = { tool: Tool; target: string; anchor?: string }
export type ProtectedAsset = { id: string; name: string; tolerance: number; body?: string; obstacle?: Point & { w: number; h: number; style: 'house' | 'sign' | 'equipment' }; damageThreshold?: number }
export type StarRule = { cost?: number; rate?: number; tools?: number; undamaged?: boolean }
export type Stage = {
  name: string; location: string; brief: string; hints: readonly string[]; floors: number; savingsGoal: number
  client: { name: string; quote: string; pass: string; fail: string; excellent: string }
  budget: number; height: number; width: number; goal: number; allowed: Tool[]
  protection?: 'neighbor' | 'safe'; tolerance: number; neighborX?: readonly number[]
  assets?: ProtectedAsset[]; stars?: readonly [StarRule, StarRule]; supportStrength?: number; timeLimit?: number; roof?: 'pitched' | 'flat'; look?: number
  members: Member[]; joints: Joint[]; points: SitePoint[]
}

const configs = [
  {
    name: '古い木造住宅', location: '柏木町 1-04',
    client: { name: '古道具屋の坂本さん', quote: '明日ここに店の棚が届くんだ。家は今日中に、できれば安く片づけてくれ！', pass: 'これで棚を運び込める。帳簿にも載せられる値段だ！', fail: 'このままだと、棚より先に私が立ち往生だよ。', excellent: 'おつりまであるのか。君の名刺、店に置いとくよ！' },
    brief: '家屋の90％を解体。工事費を¥720以内に抑えると節約ボーナス。',
    hints: ['建物はどこで地面につながっているだろう？', '下の柱に注目。支えが一つ外れても、ほかの柱が踏ん張れます。', '足元が外れても形が残ったら、柱と床をつなぐ位置や重りを載せる側を変えてみましょう。'],
    floors: 2, budget: 1500, savingsGoal: 720, height: 2.6, width: 9, goal: 90, tolerance: 0, allowed: ['cut','weight'],
  },
  {
    name: '住宅密集地', location: '柿ノ木通り 2-07',
    client: { name: '町内会の井上さん', quote: '両隣には絶対当てないでよ。これ以上、町内会で肩身を狭くしたくないの！', pass: '両隣とも無事ね。これなら今夜の会合にも出られるわ。', fail: 'もう一度、敷地の中へ納める段取りを考えましょ。', excellent: 'こんなにきれいに片づくなんて。回覧板で紹介しようかしら！' },
    brief: '家屋の90％を敷地内で解体し、両隣を無傷で残す。',
    hints: ['左右にある敷地境界を見て、建物が傾いてよい方向を考えましょう。', 'ワイヤーを使うと、上の建材を地面の固定点へ引き寄せられます。', '結果で当たった側を確認し、その反対に固定点を移すと倒れ方を変えられます。'],
    floors: 2, budget: 1950, savingsGoal: 950, height: 2.6, width: 7.33, goal: 90, tolerance: 0, protection: 'neighbor',
    neighborX: [-9.4, 9.4], allowed: ['cut','weight','wire','jack','pad'],
  },
  {
    name: '金庫を守れ', location: '桐ヶ丘 3-12',
    client: { name: '大家の黒田さん', quote: '家は好きに壊してくれ。ただし金庫は守ってくれよ。中身？ それは聞かない約束だ。', pass: '金庫は回収できたな。受け取りのサインだけ頼むよ。', fail: 'ちょっと待った。その状態じゃ、金庫の引き取りはできないよ。', excellent: '傷ひとつない。君に頼んでよかった。中身のことは聞くなよ。' },
    brief: '家屋の90％を解体し、金庫を軽い傷までに抑えて回収。',
    hints: ['金庫が落ち始めるとき、下の床はどう傾くでしょう？', 'クッション材は、落ちた物が実際に当たったときに働きます。', '衝突の印を見て、金庫が最初に強くぶつかった辺りを次の試行で守ってみましょう。'],
    floors: 3, budget: 2500, savingsGoal: 1100, height: 3.1, width: 9.5, goal: 90, tolerance: 9, protection: 'safe',
    allowed: ['cut','weight','wire','jack','pad'],
  },
] satisfies Omit<Stage, 'members' | 'joints' | 'points'>[]

function house(config: typeof configs[number], index: number): Stage {
  const members: Member[] = []
  const joints: Joint[] = []
  const points: SitePoint[] = []
  const xs = [-4.35, 0, 4.35]
  const base = 1.15
  const story = 2.45
  const add = (id: string, kind: Member['kind'], x: number, y: number, w: number, h: number, material: Member['material'] = 'wood', angle = 0, tint?: string) => {
    members.push({ id, kind, x, y, w, h, material, angle, tint })
  }
  const link = (id: string, a: string, b: string, x: number, y: number, kind: Joint['kind'] = 'frame') => {
    joints.push({ id, a, b, x, y, kind })
  }
  for (let floor = 0; floor < config.floors; floor++) {
    const bottom = base + floor * story
    const top = bottom + story
    // A continuous beam is assembled from two rigid bays and connected at the center.
    for (let bay = 0; bay < 2; bay++) {
      const x = (xs[bay] + xs[bay + 1]) / 2
      const beam = `b${floor}${bay}`
      const deck = `d${floor}${bay}`
      add(beam, 'beam', x, top, 4.35, .26)
      add(deck, 'floor', x, top + .19, 4.32, .12)
      link(`deck${floor}${bay}`, beam, deck, x, top + .13, 'deck')
      points.push({ id: beam, x, y: top + .26, body: beam, kind: 'beam' })
    }
    link(`seam${floor}`, `b${floor}0`, `b${floor}1`, 0, top)
    for (let post = 0; post < 3; post++) {
      const x = xs[post]
      const lean = floor === 0 ? (index === 1 ? [ .16, .11, -.24 ] : [ .24, -.17, -.26 ])[post] : 0
      const id = `p${floor}${post}`
      const bay = post === 2 ? 1 : 0
      add(id, 'post', x + lean / 2, (bottom + top) / 2, .26, Math.hypot(story - .28, lean), 'wood', -Math.atan2(lean, story - .28))
      link(`upper${floor}${post}`, id, `b${floor}${bay}`, x + lean, top - .13)
      link(`lower${floor}${post}`, id, floor ? `b${floor - 1}${bay}` : 'ground', x, bottom + (floor ? .26 : .12), floor ? 'frame' : 'foot')
      points.push({ id, x: x + lean / 2, y: (top + bottom) / 2, body: id, kind: 'body' })
    }
  }
  add('couch', 'furniture', -2.7, base + story + .59, 1.61, .66, 'wood', 0, '#cb693f')
  add('cabinet', 'furniture', 2.9, base + story + .89, .68, 1.25, 'wood', 0, '#79918a')
  if (index === 1) add('crate', 'furniture', 1.18 - .39, base + 2 * story + .57, .7 * 1.6, .63, 'steel', 0, '#b78f51')
  if (index === 2) add('safe', 'safe', 2.15, base + (config.floors - 1) * story + .78, .88, 1.04, 'steel', 0, '#557f71')
  for (const [i, x] of [-6.45, -4.25, -2.15, 0, 2.15, 4.25, 6.45].entries()) {
    points.push({ id: `g${i}`, x, y: .13, kind: 'ground' })
  }
  return { ...config, members, joints, points }
}

export const stages = configs.map(house)
export function validateStage(stage: Stage) {
  const ids = new Set(stage.members.map(m => m.id))
  const finite = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y)
  if (ids.size !== stage.members.length || stage.members.some(m => !finite(m) || !Number.isFinite(m.angle) || !(m.w > 0 && m.h > 0) || !materials[m.material])) throw Error('Invalid member')
  if (new Set(stage.joints.map(j => j.id)).size !== stage.joints.length || stage.joints.some(j => !finite(j) || !ids.has(j.a) || (j.b !== 'ground' && !ids.has(j.b)) || j.a === j.b)) throw Error('Invalid joint')
  if (new Set(stage.points.map(p => p.id)).size !== stage.points.length || stage.points.some(p => !finite(p) || (p.body && !ids.has(p.body)))) throw Error('Invalid placement point')
}
