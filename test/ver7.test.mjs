import assert from 'node:assert/strict'
import {test} from 'node:test'
import {architecture,scenery} from '../src/architecture.ts'
import {bursts,burstJoints,burstReach,burstSites} from '../src/bursts.ts'
import {campaign} from '../src/campaign.ts'
import {floorBands} from '../src/floors.ts'
import {Simulation,dt,placementError,costOf} from '../src/physics.ts'
import {plans} from './campaign-plans.mjs'

const cuts=(...ids)=>ids.map(target=>({tool:'cut',target}))
const run=(stage,placements)=>{
  const sim=new Simulation(stage,placements)
  while(!sim.result)sim.step()
  return sim
}

test('the deadline ignores a compressed pad spike while still requiring sustained rest',()=>{
  const stage=campaign[14]
  const placement=[...cuts('upper00','lower01','lower02','lower03'),{tool:'pad',target:'g1'}]
  const result=run(stage,placement).result
  assert.ok(result.rate>=90)
  assert.equal(result.assetDamage.street,0)
  assert.ok(result.assetDamage.terminal<=20)
  assert.equal(result.timedOut,false)
  assert.equal(result.success,true)
  assert.ok(result.quiet>=1.25)
  assert.ok(result.elapsed<stage.timeLimit)
  const limited=run({...stage,timeLimit:1},plans[14]).result
  assert.equal(limited.timedOut,true)
  assert.equal(limited.success,false)
  assert.equal(limited.ticks,Math.ceil(1/dt))
  assert.ok(limited.moving.length>0)
})

test('architectural profiles have unique outlines and cover each campaign district',()=>{
  const styles=campaign.map(architecture)
  assert.equal(new Set(styles.map(x=>JSON.stringify(x.silhouette))).size,15)
  assert.equal(new Set(styles.map(x=>x.district)).size,6)
  for(const stage of campaign){
    const {roof,last}=scenery(stage,floorBands(stage))
    assert.ok(roof.every(p=>Number.isFinite(p.x)&&p.y>=last.top))
  }
})

test('burst tools have separate gates, costs, previews and deterministic physics',()=>{
  const ordinary={tool:'blast',target:'upper01'}
  const narrow={tool:'precise',target:'upper01'}
  assert.ok(placementError(campaign[7],[],ordinary))
  assert.ok(placementError(campaign[10],[],narrow))
  assert.equal(placementError(campaign[8],[],ordinary),'')
  assert.equal(placementError(campaign[11],[],narrow),'')
  assert.ok(placementError(campaign[11],[narrow],narrow))
  assert.ok(placementError({...campaign[11],budget:400},[],narrow))
  assert.ok(costOf([narrow])>costOf([ordinary]))
  assert.ok(bursts.blast.range>bursts.precise.range)
  const stage=campaign[11]
  const center=burstSites(stage,'blast').find(p=>p.id==='upper01')
  assert.ok(burstJoints(stage,center,'blast').length>burstJoints(stage,center,'precise').length)
  assert.equal(burstReach(center,{x:center.x+10,y:center.y,w:1,h:1},'blast'),0)
  const withBoth=[ordinary,narrow]
  assert.deepEqual(run(stage,withBoth).result,run(stage,[...withBoth].reverse()).result)
  for(const placement of withBoth)assert.ok(run(stage,[placement]).events.some(e=>e.kind===placement.tool))
})

test('each unlock guide demonstrates a legal placement on its own stage',async()=>{
  const {toolGuides}=await import('../src/tool-guides.ts')
  const seen=[]
  for(const stage of campaign){
    for(const tool of stage.unlockedTools){
      const {target,anchor}=toolGuides[tool]
      assert.equal(placementError(stage,[],{tool,target,anchor}),'',stage.name)
      if(tool==='blast'||tool==='precise'){
        const demo=burstSites(stage,tool).find(p=>p.id===target)
        for(const asset of stage.assets??[]){
          const shape=asset.obstacle??stage.members.find(m=>m.id===asset.body)
          assert.equal(burstReach(demo,shape,tool),0,asset.name)
        }
      }
      seen.push(tool)
    }
  }
  assert.equal(new Set(seen).size,7)
})
