import { type Stage } from './stages.ts'

export function cameraTestSite(): Stage {
  const stage: Stage = {
    name:'カメラ検証棟・20階', location:'開発用現場',
    brief:'全体表示と階移動、設置点への照準を確認できます。',
    hints:['上層階へ移動し、地面線が画面外へ出ることを確認できます。'],
    client:{name:'表示テスト',quote:'各階の接合部に道具を置いて、位置を確かめよう。',pass:'',fail:'',excellent:''},
    floors:20, savingsGoal:0, budget:10000, height:0, width:7, goal:0, tolerance:0,
    allowed:['cut','weight','wire','jack','pad'], members:[], joints:[], points:[],
  }
  const xs=[-4,0,4]
  for(let i=0;i<stage.floors;i++){
    const low=1+i*3
    const top=low+3
    for(const [bay,x] of [-2,2].entries()){
      const beam=`b${i}${bay}`
      stage.members.push({id:beam,kind:'beam',x,y:top,w:4,h:.26,angle:0,material:'steel',tint:'#a27759'})
      stage.members.push({id:`d${i}${bay}`,kind:'floor',x,y:top+.2,w:4,h:.13,angle:0,material:'concrete'})
      stage.points.push({id:beam,kind:'beam',body:beam,x,y:top+.27})
    }
    for(const [column,x] of xs.entries()){
      const id=`p${i}${column}`
      const bay=column===2?1:0
      stage.members.push({id,kind:'post',x,y:low+1.5,w:.26,h:2.74,angle:0,material:'steel',tint:'#a27759'})
      stage.joints.push({id:`upper${i}${column}`,a:id,b:`b${i}${bay}`,kind:'frame',x,y:top-.13})
      stage.joints.push({id:`lower${i}${column}`,a:id,b:i?`b${i-1}${bay}`:'ground',kind:i?'frame':'foot',x,y:low+.13})
      stage.points.push({id,kind:'body',body:id,x,y:low+1.5})
    }
    stage.joints.push({id:`seam${i}`,a:`b${i}0`,b:`b${i}1`,kind:'frame',x:0,y:top})
  }
  for (const [i,x] of [-6,-4,-2,0,2,4,6].entries()) stage.points.push({id:`g${i}`,kind:'ground',x,y:.13})
  return stage
}
