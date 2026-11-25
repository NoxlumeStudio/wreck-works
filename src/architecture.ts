import { type Stage } from './stages.ts'
import { type FloorBand } from './floors.ts'

type Look = {
  district:number; exterior:string; roof:string; trim:string
  silhouette: [number,number][]; feature:string; motif:string
}

const looks: Look[] = [
  {district:0,exterior:'#a87148',roof:'#725445',trim:'#d3ad79',silhouette:[[-.09,0],[.19,.77],[1.06,.23],[1.08,0]],feature:'縁側',motif:'porch'},
  {district:0,exterior:'#c5bab0',roof:'#526c83',trim:'#b5cddd',silhouette:[[-.06,0],[.24,.91],[.76,.91],[1.06,0]],feature:'昭和住宅',motif:'tiles'},
  {district:0,exterior:'#9d854e',roof:'#82724b',trim:'#ddbd82',silhouette:[[-.09,0],[-.02,.31],[.37,1.78],[.62,1.78],[1.03,.31],[1.09,0]],feature:'太梁の古民家',motif:'lattice'},
  {district:1,exterior:'#7c8c8a',roof:'#647d7c',trim:'#b1bfb1',silhouette:[[0,0],[0,.3],[.68,.3],[.68,1.24],[.94,1.24],[.94,.3],[1,.3],[1,0]],feature:'路地の住宅',motif:'narrow'},
  {district:1,exterior:'#977b62',roof:'#82694f',trim:'#d4a06a',silhouette:[[0,0],[0,.47],[1,.47],[1,0]],feature:'商店街',motif:'awning'},
  {district:1,exterior:'#718d87',roof:'#667779',trim:'#b8c3a6',silhouette:[[-.02,0],[.22,.65],[1.04,.65],[1.04,0]],feature:'外階段',motif:'stairs'},
  {district:2,exterior:'#8e8370',roof:'#857c6c',trim:'#d0b784',silhouette:[[-.04,0],[-.04,.29],[.10,.29],[.10,.59],[.90,.59],[.90,.29],[1.04,.29],[1.04,0]],feature:'旧銀行',motif:'bank'},
  {district:2,exterior:'#708b88',roof:'#536f73',trim:'#a3c2bc',silhouette:[[-.06,0],[.03,.65],[.96,.65],[1.05,0]],feature:'物流倉庫',motif:'shutter'},
  {district:2,exterior:'#7d867b',roof:'#596b60',trim:'#afbb89',silhouette:[[0,0],[.26,1],[.26,.15],[.53,1],[.53,.15],[.80,1],[.80,.15],[.87,.15],[.87,1.65],[.96,1.65],[.96,.15],[1,.15],[1,0]],feature:'町工場',motif:'factory'},
  {district:3,exterior:'#7d8b94',roof:'#637784',trim:'#aac6cf',silhouette:[[0,0],[0,.30],[.37,.30],[.37,.91],[.69,.91],[.69,.30],[1,.30],[1,0]],feature:'集合住宅',motif:'balcony'},
  {district:3,exterior:'#8d9289',roof:'#798681',trim:'#d1cda3',silhouette:[[0,0],[0,.21],[1,.21],[1,0]],feature:'立体駐車場',motif:'ramp'},
  {district:4,exterior:'#958587',roof:'#776783',trim:'#dac2cc',silhouette:[[-.12,0],[.16,.88],[.45,.6],[.45,1.0],[.64,1.82],[.81,1],[.81,.55],[1.09,0]],feature:'塔屋のある洋館',motif:'mansion'},
  {district:4,exterior:'#827d6b',roof:'#6d6f5e',trim:'#c4b991',silhouette:[[-.10,0],[.19,.74],[.47,.19],[.61,.20],[.72,1.02],[1.10,0]],feature:'継ぎ足し屋敷',motif:'crooked'},
  {district:5,exterior:'#7d968f',roof:'#587a76',trim:'#bad7c4',silhouette:[[0,0],[0,.42],[.18,.42],[.18,.64],[.83,.64],[.83,.29],[1,.29],[1,0]],feature:'店舗・事務所',motif:'atrium'},
  {district:5,exterior:'#768e98',roof:'#526e82',trim:'#9dcbd4',silhouette:[[0,0],[0,.36],[.33,.36],[.33,1.20],[.40,1.20],[.40,.36],[.76,.36],[.76,.59],[1,.59],[1,0]],feature:'難波再開発街区',motif:'tower'},
]

export function architecture(stage: Stage) { return looks[(stage.look??0)-1] }

export const districtSky=[
  ['#333f48','#505954'],['#303743','#5b504d'],['#283c40','#425a53'],
  ['#2b3950','#486172'],['#303344','#4e5451'],['#253746','#40556a'],
]

export function scenery(stage: Stage, bands: FloorBand[]) {
  const look=architecture(stage)
  if(!look||!bands.length)return
  const first=bands[0], last=bands.at(-1)!
  const span=last.right-last.left
  return {look,first,last,roof:look.silhouette.map(([x,y])=>({x:last.left+x*span,y:last.top+y}))}
}
