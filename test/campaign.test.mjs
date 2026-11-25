import assert from 'node:assert/strict'
import {test} from 'node:test'
import {campaign,chapters,toolUnlock} from '../src/campaign.ts'
import {Simulation,placementError} from '../src/physics.ts'
import {validateStage} from '../src/stages.ts'
import {available,loadProgress} from '../src/progress.ts'
import {plans} from './campaign-plans.mjs'

const simulate = (stage, plan=[]) => {
  const sim = new Simulation(stage,plan)
  for(let i=0;i<1800&&!sim.result;i++)sim.step()
  assert.ok(sim.result, stage.name)
  return sim
}
test('six chapters contain fifteen jobs with progressive tool unlocks',()=>{
  assert.equal(campaign.length,15)
  assert.equal(chapters.length,6)
  assert.deepEqual(chapters.map((_,i)=>campaign.filter(job=>job.chapter===i+1).length),[3,3,3,2,2,2])
  for(const job of campaign){
    validateStage(job)
    assert.deepEqual(job.allowed,Object.keys(toolUnlock).filter(tool=>toolUnlock[tool]<=job.number))
    assert.deepEqual(job.unlockedTools,job.allowed.filter(tool=>toolUnlock[tool]===job.number))
  }
})
test('new profiles advance in order and the prototype stars migrate without skipping new jobs',()=>{
  assert.deepEqual(loadProgress(campaign,'{no',null),{})
  const saved=loadProgress(campaign,null,'[3,2,1]')
  assert.deepEqual(saved,{'job-1':3,'job-4':2,'job-7':1})
  assert.deepEqual(campaign.filter((_,i)=>available(campaign,i,saved)).map(s=>s.number),[1,2,4,7])
  assert.equal(available(campaign,2,{'job-1':1}),false)
  assert.equal(available(campaign,2,{'job-1':1,'job-2':1}),true)
})
for(const [i,stage] of campaign.entries())test(`job ${i+1}: stable, legal, reproducible three-star solution`,()=>{
  const plan=plans[i]
  const initial=simulate(stage)
  assert.equal(initial.rate,0)
  assert.equal(initial.damage,0)
  assert.equal(initial.live.size,stage.joints.length)
  for(const [j,p] of plan.entries())assert.equal(placementError(stage,plan.slice(0,j),p),'')
  const actual=simulate(stage,plan)
  assert.equal(actual.result.stars,3,JSON.stringify(actual.result))
  assert.deepEqual(simulate(stage,plan).result,actual.result)
  assert.equal(actual.damage,0)
  assert.ok(actual.events.some(e=>e.kind==='break'))
  const allFeet=stage.joints.filter(j=>j.kind==='foot').map(j=>({tool:'cut',target:j.id}))
  assert.ok(simulate(stage,allFeet).result.stars<3,'base cuts alone do not yield the top rating')
})
test('weight, wire, cushion and jack affect the simulated result after the same cuts',()=>{
  for(const id of [2,4,6,7,8,9]){
    const stage=campaign[id-1],plan=plans[id-1]
    const without=simulate(stage,plan.slice(0,-1))
    const withTool=simulate(stage,plan)
    assert.ok(without.rate<withTool.rate||without.damage>withTool.damage)
    assert.ok(withTool.events.some(e=>e.kind===plan.at(-1).tool))
  }
})
test('storefront sign damage and separate final assets are recorded from collisions',()=>{
  const sign=simulate(campaign[4],['upper00','lower01','lower02'].map(target=>({tool:'cut',target})))
  assert.ok(sign.result.assetDamage.sign>0)
  assert.ok(sign.events.some(e=>e.target==='sign'&&e.damage>0))
  assert.ok(sign.result.reasons.some(reason=>reason.includes('商店街の看板')))
  const final=campaign[14]
  const falling=simulate(final,final.joints.filter(j=>j.kind==='foot').map(j=>({tool:'cut',target:j.id})))
  assert.ok(falling.result.assetDamage.terminal>final.assets[1].tolerance)
  assert.equal(falling.result.assetDamage.street,0)
})
