import { stages as prototypes, type Joint, type Member, type ProtectedAsset, type Stage, type StarRule, type Tool } from './stages.ts'

export const chapters = ['駆け出し解体屋','ご近所トラブル','厄介な依頼','大型案件','ワケあり物件','伝説の解体業者']
export const toolUnlock: Record<Tool,number> = {cut:1,weight:2,wire:4,pad:7,jack:8,blast:9,precise:12}
export type Job = Stage & { id: string; chapter: number; number: number; unlockedTools: Tool[] }
type Frame = {
  levels: number[]; widths: number[]; base?: number; lean?: number[]; skins?: Member['material'][];
  inset?: Record<number,[number,number]>; braces?: [number,number][]; loads?: Member[]; reinforcedDeck?: [number,number];
}
type Geometry = Pick<Stage,'floors'|'members'|'joints'|'points'>
const wood = '#aa7153'
function frame(spec: Frame): Geometry {
  const members: Stage['members']=[], joints: Stage['joints']=[], points: Stage['points']=[]
  const {levels,widths}=spec
  const xs=[-widths.reduce((sum,w)=>sum+w,0)/2]
  for(const width of widths)xs.push(xs.at(-1)!+width)
  const add = (id:string, kind:Member['kind'], x:number,y:number,w:number,h:number,material:Member['material'],angle=0,tint?:string) => members.push({id,kind,x,y,w,h,material,angle,tint})
  const tie = (id:string,a:string,b:string,x:number,y:number,kind:Joint['kind']='frame') => joints.push({id,a,b,x,y,kind})
  let bottom=spec.base??1.18
  let previous:[number,number]=[0,widths.length-1]
  for(const [i,height] of levels.entries()){
    const top=bottom+height
    const material=spec.skins?.[i]??'wood'
    const [left,right]=spec.inset?.[i]??previous
    for(let bay=left;bay<=right;bay++){
      const x=(xs[bay]+xs[bay+1])/2, beam=`b${i}${bay}`, deck=`d${i}${bay}`
      add(beam,'beam',x,top,widths[bay],.24,material,0,material==='wood'?wood:undefined)
      const deckH=spec.reinforcedDeck?.[0]===i&&spec.reinforcedDeck[1]===bay?.16:.10
      add(deck,'floor',x,top+(deckH===.10?.17:.14),widths[bay]-.03,deckH,material)
      tie(`deck${i}${bay}`,beam,deck,x,top+.12,'deck')
      points.push({id:beam,kind:'beam',body:beam,x,y:top+.24})
      if(bay>left)tie(`join-${i}-${bay}`,`b${i}${bay-1}`,beam,xs[bay],top)
    }
    for(let j=left;j<=right+1;j++){
      const x=xs[j], lean=i===0?(spec.lean?.[j]??(j%2?.20:-.22)):0
      const post=`p${i}${j}`, bay=Math.min(j,right)
      add(post,'post',x+lean/2,(bottom+top+.115)/2,.24,Math.hypot(height-.375,lean),material,-Math.atan2(lean,height-.375))
      tie(`upper${i}${j}`,post,`b${i}${bay}`,x+lean,top-.12)
      tie(`lower${i}${j}`,post,i?`b${i-1}${Math.min(j,previous[1])}`:'ground',x,bottom+(i?.23:.12),i?'frame':'foot')
      points.push({id:post,kind:'body',body:post,x:x+lean/2,y:(bottom+top)/2})
    }
    for(const [,bay] of spec.braces?.filter(([level])=>level===i)??[]){
      const x=xs[bay]+.37, y=bottom+.31, xx=xs[bay+1]-.38, yy=top-.23, id=`brace-${i}-${bay}`
      add(id,'post',(x+xx)/2,(y+yy)/2,.12,Math.hypot(xx-x,yy-y),'wood',-Math.atan2(xx-x,yy-y),'#bd9c62')
      tie(`brace-top-${i}-${bay}`,id,`b${i}${bay}`,xx,yy)
      tie(`brace-base-${i}-${bay}`,id,i?`b${i-1}${bay}`:'ground',x,y,i?'frame':'foot')
    }
    previous=[left,right]
    bottom=top
  }
  const anchors=[xs[0]-1.75,xs.at(-1)!+1.75,...xs,...widths.map((_,i)=>(xs[i]+xs[i+1])/2)].sort((a,b)=>a-b)
  for (const [i,x] of anchors.entries()) points.push({id:`g${i}`,kind:'ground',x,y:.13})
  return {floors:levels.length,members:[...members,...(spec.loads??[])],joints,points}
}
function elevate(geometry: Geometry, dy: number): Geometry {
  return {
    ...geometry, members:geometry.members.map(p=>({...p,y:p.y+dy})),
    joints:geometry.joints.map(p=>({...p,y:p.y+dy})),
    points:geometry.points.map(p=>p.kind==='ground'?p:{...p,y:p.y+dy}),
  }
}
const load=(id:string,x:number,y:number,w:number,h:number,protectedBody=true): Member=>({id,kind:protectedBody?'safe':'furniture',x,y,w,h,angle:0,material:'steel',tint:protectedBody?'#557f71':'#9d784f'})
const neighbor=(id:string,name:string,x:number,tolerance=0):ProtectedAsset=>({id,name,tolerance,obstacle:{x,y:1.7,w:4.3,h:3.48,style:'house'}})
const sign=(x:number):ProtectedAsset=>({id:'sign',name:'商店街の看板',tolerance:0,damageThreshold:125,obstacle:{x,y:1.32,w:.36,h:2.72,style:'sign'}})
const cargo=(body:string,name:string,tolerance:number):ProtectedAsset=>({id:body,body,name,tolerance})
const ratings: ReadonlyArray<readonly [StarRule,StarRule]> = [
  [{tools:5},{tools:4,rate:98}],
  [{cost:1050},{cost:900,rate:98}],
  [{tools:6},{tools:5,rate:98}],
  [{cost:1150},{cost:920,rate:98,undamaged:true}],
  [{cost:1200},{cost:900,rate:98,undamaged:true}],
  [{cost:1250},{cost:940,rate:98,undamaged:true}],
  [{cost:1400},{cost:1050,rate:94,undamaged:true}],
  [{cost:1450},{cost:1150,rate:95,undamaged:true}],
  [{cost:1550},{cost:1120,rate:97,undamaged:true}],
  [{tools:7},{tools:6,cost:1050,rate:97}],
  [{cost:1700},{cost:1300,rate:97}],
  [{cost:1200},{cost:970,rate:97,undamaged:true}],
  [{tools:7},{tools:5,rate:98}],
  [{cost:1500},{cost:1150,undamaged:true}],
  [{cost:1700},{cost:1150,undamaged:true}],
]
const flatRoofs=new Set([5,8,9,10,11,14,15])
const cap=(number:number, name:string, geometry:Geometry, budget:number, goal:number, width:number, height:number, brief:string, hints:string[], details:Partial<Stage>={}):Job=>{
  const chapter=number<=3?1:number<=6?2:number<=9?3:number<=11?4:number<=13?5:6
  const allowed=(Object.keys(toolUnlock) as Tool[]).filter(tool=>toolUnlock[tool]<=number)
  return {
    id:`job-${number}`,look:number,chapter,number,name,floors:geometry.floors,members:geometry.members,joints:geometry.joints,points:geometry.points,budget,goal,width,height,allowed,
    unlockedTools:allowed.filter(tool=>toolUnlock[tool]===number),location:`難波・現場 ${String(number).padStart(2,'0')}`,
    brief,hints, tolerance:0,savingsGoal:Math.floor(budget*.85),
    client:{name:number<4?'ご近所の依頼主':number<7?'商店街の依頼主':number<10?'荷主':number<14?'現場の管理人':'元請けの担当者',quote:brief,pass:'おおきに、助かったで！',fail:'もうひと工夫、頼むわ。',excellent:'この仕上がり、文句なしや！'},
    stars:ratings[number-1],roof:flatRoofs.has(number)?'flat':'pitched',
    ...details,
  }
}
const old4={...prototypes[1]}
const old7={...prototypes[2]}
export const campaign: Job[] = [
  cap(1,'初仕事！ボロ家解体',prototypes[0],1500,90,9,2.6,'古い木造の家を片づけてほしいんや。まずは切断機を使ってみてな。',['切断機を選ぶと、切れる接合部が光ります。90%に届かなかったら、結果の「解体率に入らなかった建材」を見てみましょう。','切る場所が違うと、支えられなくなる建材も変わります。']),
  cap(2,'ケチケチ大家の空き家',elevate(frame({levels:[2.45,2.35],widths:[4.2,3.25],lean:[.27,-.15,.19]}),-0.16),1200,90,9,2.65,'出費はなるべく抑えてな。空き家の右と左、どっちの床に重さを載せる？',['重りを載せた床は下の支えに力を伝えます。','片側の落ち方を変えると、その反対にも影響します。']),
  cap(3,'しぶとい古民家',frame({levels:[2.3,2.45],widths:[3.0,2.65,3.7],lean:[.21,-.23,.14,-.16],braces:[[0,1]]}),1750,88,10,3.0,'増築した古民家や。中央にもう一本、斜めの支えが入ってるで。',['色の違う斜材にも接合部があります。','倒れたように見えても、地面とつながった部分は解体済みになりません。']),
  cap(4,'お隣さんが怖い！',old4,1550,90,7.33,2.6,'左の家は絶対に傷つけんといて。ワイヤーで引く場所を考えてな。',['固定点と建材をつなぐと、線が張った方向に引かれます。','当たる側を結果の記録で確かめてみましょう。'],{assets:[neighbor('left-house','左隣の住宅',-9.4)]}),
  cap(5,'商店街の大騒動',frame({levels:[2.65,2.25],widths:[3.6,3.4],lean:[-.17,.11,-.32],loads:[load('goods',1.6,4.377,.75,.65,false)]}),1550,90,6.6,2.9,'路地に名物看板があるんや。看板に当てずに古い店だけ片づけて。',['看板の細い支柱も衝突の対象です。','建物の外へ走る長い梁の向きに注目。'],{assets:[sign(5.8)]}),
  cap(6,'挟まれた三階建て',elevate(frame({levels:[2.5,2.5,2.15],widths:[3.7,3.25],lean:[.24,.08,-.23],inset:{2:[0,0]}}),-0.16),1750,90,7.4,3.2,'両隣が営業中や。背の高い側をどこに落とすか、先に考えといてな。',['左側だけ上に一階分あります。','違う高さや固定点にワイヤーを張ると、倒れる向きが変わります。'],{assets:[neighbor('left-house','左隣の住宅',-9.4),neighbor('right-house','右隣の住宅',9.4)]}),
  cap(7,'金庫だけは守って！',old7,2000,90,9.5,3.1,'家は壊してええ。でも金庫は傷を軽く済ませてな。',['クッション材が落下物を直接受けると衝撃をやわらげます。','金庫の真下だけでなく、建材が先に落ちる場所も考えてみましょう。'],{assets:[cargo('safe','金庫',9)]}),
  cap(8,'社長の秘密倉庫',frame({levels:[2.28,2.38],widths:[3.0,3.9],lean:[.22,.13,-.21],loads:[load('box',1.5,4.16,.91,.93)]}),1850,87,9,3.1,'奥の保管箱は持って帰るで。ジャッキで下から押すと、どない動くやろ？',['ジャッキは地面から真上の低い梁を押します。','持ち上げる側を変えると、積み荷の落ち先も変わります。'],{assets:[cargo('box','保管箱',13)]}),
  cap(9,'工場長の無茶振り',frame({levels:[2.58,2.18],widths:[3.5,3.8,3.1],lean:[.22,-.25,.16,-.29],inset:{1:[0,1]},reinforcedDeck:[0,2],loads:[load('machine',3.52,4.61,1.45,1.26)]}),2050,88,11,3.45,'右の作業台にある大型機械は、まだ使うねん。そいつを守って工場を解体や。',['機械は重く、周りの建材にも影響します。','通常型の範囲を機械から離して試せます。プレビューで重なりを確認しましょう。'],{assets:[cargo('machine','大型機械',16)]}),
  cap(10,'マンション解体大作戦',elevate(frame({levels:[2.52,2.43,2.32,2.38,2.1],widths:[3.25,3.7,2.9],inset:{2:[0,1],4:[1,1]},lean:[.19,-.27,.14,-.25]}),-0.32),2250,90,12,3.6,'上の階ほど床が小さいマンションや。階を切り替えて支えのつながりを見てな。',['上層の床がどの柱までつながっているかを観察。','全体表示と階移動で、残った場所を探せます。'],{supportStrength:1.25,timeLimit:22}),
  cap(11,'駐車場が崩れへん！',elevate(frame({levels:[2.65,2.55],widths:[3.55,4.0,3.55,3.75],lean:[.2,-.18,.1,-.23,-.13],inset:{1:[0,3]}}),0.62),2300,88,14.5,3.3,'横に長い立体駐車場や。柱が多いから、片側だけ崩しても終わらへんで。',['広い床のどこが続いているか、左右にパンして確認。','取り残された側にも、まだ支柱があるかもしれません。'],{timeLimit:21}),
  cap(12,'傾いた豪邸',elevate(frame({levels:[2.49,2.24,2.11],widths:[2.9,4.55],lean:[.27,.31,.39],inset:{2:[1,1]},loads:[load('wardrobe',2.38,6.7,.9,.84,false)]}),-0.32),1750,87,9,3.25,'右に張り出した豪邸や。塀の向こうに迷惑かけんようにな。',['上の増築と重量物が右に寄っています。','精密型の狭い範囲で、右隣の家を巻き込まずに接合部へ作用を集中できます。'],{assets:[neighbor('right-house','庭の隣家',9.7)]}),
  cap(13,'幽霊屋敷の怪事件',frame({levels:[2.39,2.25,2.3],widths:[3.65,3.8],lean:[.17,-.19,-.25],inset:{2:[0,0]},braces:[[0,0],[1,1]],loads:[load('bell',-1.8,6.5,.83,.68,false)]}),2050,90,10,3.25,'夜中に床が鳴る屋敷や。斜めに通った梁も見てから作業してな。',['金色の斜め材が、意外な場所へ荷重を伝えています。','上の斜材と地面につながる斜材を見分けましょう。'],{timeLimit:22}),
  cap(14,'会社存亡の大仕事',elevate(frame({levels:[2.55,2.34,2.21,2.25],widths:[3.05,3.45,3.4],lean:[.27,-.22,.12,-.31],inset:{2:[1,2],3:[1,1]},loads:[load('server',3.1,4.51,1.1,1.14)]}),-0.16),2400,90,11.2,3.6,'隣の事務所とサーバーの両方を守ってくれ。これは会社の看板がかかった仕事や。',['サーバーの落下先と隣の事務所は別々に守ります。','結果でどちらに当たったかを確かめられます。'],{assets:[neighbor('office','隣の事務所',-10.9),cargo('server','サーバー',15)],supportStrength:1.3,timeLimit:24}),
  cap(15,'難波最後の大解体',elevate(frame({levels:[2.42,2.32,2.35,2.26,2.31,2.24,2.18,2.14],widths:[3.05,3.25,3.1],lean:[.2,-.27,.22,-.17],inset:{2:[0,1],6:[1,1]},loads:[load('terminal',3.25,4.24,.82,.82)]}),.17),2800,90,12.5,4.15,'難波の高層ビルや。通りを傷つけず、1階脇の端末も回収して、最後まで仕事を決めよう。',['上が細く、下に張り出した床があります。','下の機器に先に落ちる建材と、外に飛び出る長い梁を見分けましょう。'],{assets:[neighbor('street','通り沿いの建物',-12.0),cargo('terminal','管理端末',20)],supportStrength:1.45,timeLimit:28}),
]
