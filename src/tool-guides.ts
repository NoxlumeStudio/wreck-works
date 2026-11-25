import { type Tool } from './stages.ts'

export const toolGuides = {
  cut: {
    target: 'lower01',
    place: (label: string) => `ミキ「まずは輪で光る${label}に置いてみて。」`,
    run: 'ゲンさん「これで切断機を1点置いたで。ほかの支えも見て、準備ができたら解体開始や！」',
  },
  weight: {
    target: 'b01',
    place: (label: string) => `ミキ「輪で光る${label}に置いてみて。下の支えに重さがかかるよ。」`,
    run: 'ゲンさん「重りで床に荷重をかけるで。ほかの道具も配置できたら解体開始や！」',
  },
  wire: {
    anchor: 'g4', target: 'b10',
    place: (label: string) => `ミキ「次は${label}を選ぼう。固定点の方へ引っ張るよ。」`,
    run: 'ゲンさん「線が張る向きに注目や。ほかの配置も決まったら解体開始！」',
  },
  pad: {
    target: 'g3',
    place: (label: string) => `ミキ「${label}に置こう。当たった落下物の衝撃をやわらげるよ。」`,
    run: 'ゲンさん「落ちてくる先を考えるんやな。ほかの配置も決まったら解体開始！」',
  },
  jack: {
    anchor: 'g2', target: 'b00',
    place: (label: string) => `ミキ「次は真上の${label}を選ぼう。下から持ち上げるよ。」`,
    run: 'ゲンさん「持ち上がる側に注目や。ほかの配置も決まったら解体開始！」',
  },
  blast: {
    target: 'join-0-1',
    place: () => 'ミキ「オレンジの円が作用範囲。大型機械が円に入らない印を選んでね。」',
    run: 'ゲンさん「周りの建材がどう動くか見てみよか。ほかの配置も決まったら解体開始！」',
  },
  precise: {
    target: 'lower02',
    place: () => 'ミキ「水色の円が作用範囲。狭くても保護対象と重ならない印を選んでね。」',
    run: 'ゲンさん「狙った辺りの動きに注目や。ほかの配置も決まったら解体開始！」',
  },
} satisfies Record<Tool, {target:string; anchor?:string; place:(label:string)=>string; run:string}>
