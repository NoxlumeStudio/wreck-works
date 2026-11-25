import assert from 'node:assert/strict'
import {test} from 'node:test'
import {campaign} from '../src/campaign.ts'
import {floorBands} from '../src/floors.ts'
import {nearbyTarget,targetLabels} from '../src/targets.ts'
import {loadLatest,loadProgress,resumeStage} from '../src/progress.ts'

test('all visible targets have unique stage-local identities and labels',()=>{
  for(const job of campaign){
    const ids=[...job.joints,...job.points].map(p=>p.id)
    assert.equal(new Set(ids).size,ids.length,job.name)
    const labels=targetLabels(job,floorBands(job))
    assert.equal(labels.size,ids.length)
    assert.equal(new Set(labels.values()).size,ids.length)
  }
})
test('near misses snap to one nearby target and ambiguous clicks do not place tools',()=>{
  const marks=[{point:{x:100,y:100},item:'left'},{point:{x:136,y:100},item:'right'}]
  assert.equal(nearbyTarget({x:120,y:100},marks),'right')
  assert.equal(nearbyTarget({x:118,y:100},marks),undefined)
  assert.equal(nearbyTarget({x:100,y:123},marks),undefined)
})
test('first launch and invalid data have no ratings; a failed last run preserves historical stars',()=>{
  assert.deepEqual(loadProgress(campaign,null,null),{})
  assert.deepEqual(loadLatest(campaign,'{bad'),{})
  const best=loadProgress(campaign,'{"version":2,"stars":{"job-1":3,"job-2":2}}',null)
  const latest=loadLatest(campaign,'{"version":1,"stars":{"job-1":0,"job-2":1,"job-3":4,"job-4":"3"}}')
  assert.deepEqual(best,{'job-1':3,'job-2':2})
  assert.deepEqual(latest,{'job-1':0,'job-2':1})
})

test('continue resumes an accessible saved stage or the next uncleared stage',()=>{
  const best={'job-1':3,'job-2':2}
  assert.equal(resumeStage(campaign,best,'job-2'),1)
  assert.equal(resumeStage(campaign,best,'job-9'),2)
  assert.equal(resumeStage(campaign,best,null),2)
  assert.equal(resumeStage(campaign,{},'job-1'),0)
  const completed=Object.fromEntries(campaign.map(job=>[job.id,3]))
  assert.equal(resumeStage(campaign,completed,null),14)
})
