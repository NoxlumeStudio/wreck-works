import { cameraTestSite } from '../src/camera-test-site.ts'
import { floorBands, floorAt } from '../src/floors.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Camera, stageBounds } from '../src/camera.ts'
import { visibleSegment } from '../src/equipment.ts'
import { Box, Vec2, World } from 'planck'
import { Simulation, costOf, dt, placementError } from '../src/physics.ts'
import { beamEstimate, gravity } from '../src/structure.ts'
import { stages, validateStage } from '../src/stages.ts'

const cuts = (...ids) => ids.map(target => ({ tool: 'cut', target }))
const feet = cuts('lower00', 'lower01', 'lower02')
const neighborCuts = cuts('lower00','lower01','upper02')
const safeCuts = [...feet, ...cuts('seam2')]
const winning = [
  [...feet, ...cuts('upper01')],
  [...neighborCuts, { tool: 'wire', target: 'b10', anchor: 'g5' }],
  [...safeCuts, { tool: 'pad', target: 'g3' }],
]
function complete(stage, plan) {
  const simulation = new Simulation(stage, plan)
  for (let i = 0; i < 1030 && !simulation.result; i++) simulation.step()
  assert.ok(simulation.result, 'every run ends within the time cap')
  return simulation
}
function near(actual, expected, epsilon) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} vs ${expected}`)
}

test('beam reactions balance the load and match standard elastic deflections', () => {
  const simple = beamEstimate(4, 1000, 1000000)
  const cantilever = beamEstimate(4, 1000, 1000000, true)
  assert.deepEqual(simple, { reaction: 2000, moment: 2000, deflection: 1 / 300 })
  assert.deepEqual(cantilever, { reaction: 4000, moment: 8000, deflection: .032 })
})

test('Planck gravity uses fixed-step motion and a falling box settles on a collider', () => {
  const world = new World({ gravity: Vec2(0,-gravity) })
  const floor = world.createBody(Vec2(0,-.5))
  floor.createFixture(Box(8,.5), { friction:.8 })
  const body = world.createDynamicBody({ position:Vec2(0,5), angle:.2, bullet:true })
  body.createFixture(Box(.4,.4), { density:160, friction:.8 })
  for(let i=0;i<30;i++) world.step(dt)
  near(body.getLinearVelocity().y, -4.905, .00001)
  near(body.getPosition().y, 5-gravity*dt**2*30*31/2, .00001)
  for(let i=0;i<210;i++) world.step(dt)
  near(body.getPosition().y, .4, .035)
  near(body.getLinearVelocity().length(),0,.03)
})

test('each unmodified building is initially supported and remains intact', () => {
  for (const stage of stages) {
    validateStage(stage)
    const sim = complete(stage, [])
    assert.equal(sim.rate,0)
    assert.equal(sim.damage,0)
    assert.equal(sim.live.size,stage.joints.length)
    for(const b of stage.members.filter(m=>['post','beam','floor'].includes(m.kind))) {
      assert.ok(sim.initial.supported.has(b.id))
      near(sim.parts.get(b.id).body.getPosition().y,b.y,.12)
    }
  }
})

test('each job has a reproducible solution within budget', () => {
  for (const [i, stage] of stages.entries()) {
    const sim = complete(stage, winning[i])
    const retry = complete(stage, winning[i])
    assert.ok(sim.result.success, JSON.stringify(sim.result))
    assert.equal(sim.result.rate,[100,100,96][i])
    assert.equal(sim.result.damage,0)
    assert.equal(sim.result.stars,3)
    assert.equal(sim.cost,costOf(winning[i]))
    assert.ok(sim.impacts > 0)
    assert.ok(sim.live.size < stage.joints.length - feet.length)
    assert.deepEqual(retry.result, sim.result)
    assert.deepEqual(retry.events, sim.events)
  }
})

test('partial collapse and damage to either kind of protected object can fail a job', () => {
  const partial = complete(stages[0], feet)
  assert.ok(partial.rate > 0 && partial.rate < 90)
  assert.ok(partial.result.remaining.some(p=>p.reason==='high'))
  const neighbor = complete(stages[1], neighborCuts)
  assert.ok(neighbor.damage > 0)
  assert.ok(neighbor.result.reasons.includes('隣家に被害が出ました。'))
  assert.ok(neighbor.events.some(e=>e.kind==='neighborHit'&&e.source==='b10'&&e.at.x<0))
  assert.equal(complete(stages[1], feet).result.success,false)
  const safe = complete(stages[2], [...feet,...cuts('lower11')])
  assert.ok(safe.damage > stages[2].tolerance)
  assert.ok(safe.result.reasons.includes('金庫の損傷が許容範囲を超えました。'))
  assert.ok(safe.events.some(e=>e.kind==='safeHit'&&e.time>0&&e.damage>0))
})

test('wire anchor and impact cushioning change outcomes without changing the cut plan', () => {
  const wire = { tool:'wire', target:'b10', anchor:'g4' }
  const otherAnchor = complete(stages[1], [...neighborCuts,wire])
  assert.equal(otherAnchor.rate,94)
  assert.equal(otherAnchor.result.stars,2)
  assert.ok(otherAnchor.events.some(e=>e.kind==='wire'&&e.target===wire.target))
  const noCushion = complete(stages[2],safeCuts)
  assert.equal(noCushion.rate,74)
  assert.ok(noCushion.events.some(e=>e.kind==='safeHit'&&e.source==='p01'))
  const cushion = complete(stages[2],winning[2])
  assert.equal(cushion.damage,0)
  assert.ok(cushion.events.some(e=>e.kind==='pad'&&e.source==='p01'))
})

test('weight has mass, wire pulls, jack lifts, and cushion compresses under impact', () => {
  const sim = new Simulation(stages[1], [
    {tool:'weight',target:'b00'},
    {tool:'wire',target:'b11',anchor:'g0'},
    {tool:'jack',target:'b00',anchor:'g2'},
  ])
  const y = sim.parts.get('b00').body.getPosition().y
  let tension = 0
  let lift = 0
  for(let i=0;i<100;i++){
    sim.step()
    tension = Math.max(tension,sim.wires[0].tension)
    lift = Math.max(lift,sim.parts.get('b00').body.getPosition().y-y)
    assert.ok(sim.wires[0].tension >= 0)
  }
  near(sim.extras[0].body.getMass(),390,.00001)
  assert.ok(tension > 100)
  assert.ok(lift > .25)
  assert.ok(sim.events.some(e=>e.kind==='jack'&&e.target==='b00'))
  const weighted = complete(stages[0],[{tool:'weight',target:'b00'}])
  assert.ok(weighted.events.some(e=>e.kind==='weight'&&e.source==='d00'))
  const cushion = new Simulation(stages[2],winning[2])
  let compression = 0
  while(!cushion.result){
    cushion.step()
    compression = Math.min(compression,cushion.pads[0].spring.getJointTranslation())
  }
  assert.ok(compression < -.05)
  assert.ok(cushion.result.success)
})

test('placement validation rejects missing anchors, invalid targets, duplicates and overspending', () => {
  const [first,second] = stages
  assert.ok(placementError(first, [], {tool:'pad',target:'g3'}))
  assert.ok(placementError(second, [], {tool:'wire',target:'b11'}))
  assert.ok(placementError(second, [], {tool:'jack',target:'b11',anchor:'g2'}))
  assert.ok(placementError(first, feet, feet[0]))
  const current = first.joints.slice(0,8).map(j=>({tool:'cut',target:j.id}))
  assert.equal(placementError(first,current,{tool:'weight',target:'b00'}),'予算が足りません。')
  assert.throws(()=>validateStage({...first,joints:[...first.joints,{...first.joints[0],id:'broken',a:'unknown'}]}))
})


test('camera fits every stage and a synthetic tall structure at desktop sizes', () => {
  const tall = { ...stages[2], members: [...stages[2].members, {
    id:'test-floor', kind:'floor', x: 1, y: 54, w: 10, h: .24, angle: 0, material:'wood',
  }] }
  for (const stage of [...stages,tall]) {
    const bounds = stageBounds(stage)
    for (const [width,height] of [[995,505],[1220,625],[1510,810],[400,280]]) {
      const camera = new Camera()
      camera.resize(width,height)
      camera.fit(bounds)
      const tl = camera.screen({x:bounds.left,y:bounds.top})
      const br = camera.screen({x:bounds.right,y:bounds.bottom})
      assert.ok(tl.x > 0 && tl.y > 0 && br.x < width && br.y < height)
    }
  }
})

test('zoom preserves the world point under the cursor, and pan and fit preserve placement coordinates', () => {
  const camera = new Camera()
  const stage = stages[2]
  const joint = stage.joints[0]
  camera.resize(920,500)
  camera.fit(stageBounds(stage))
  const cursor = camera.screen(joint)
  camera.zoomAt(cursor,3)
  near(camera.screen(joint).x,cursor.x,1e-8)
  near(camera.screen(joint).y,cursor.y,1e-8)
  camera.panBy({x:70,y:-45})
  near(camera.screen(joint).x,cursor.x+70,1e-8)
  near(camera.screen(joint).y,cursor.y-45,1e-8)
  camera.resize(980,540)
  const world = camera.world(camera.screen(joint))
  near(world.x,joint.x,1e-8)
  near(world.y,joint.y,1e-8)
  camera.panBy({x:1e8,y:-1e8})
  const bounds = stageBounds(stage)
  assert.ok(camera.world({x:0,y:0}).x < bounds.right)
  assert.ok(camera.world({x:920,y:500}).x > bounds.left)
  camera.fit()
  camera.resize(920,500)
  near(camera.screen(joint).x,cursor.x,1e-8)
  near(camera.screen(joint).y,cursor.y,1e-8)
})

test('wire hit regions remain selectable when the endpoints are offscreen', () => {
  assert.deepEqual(visibleSegment({x:-24,y:40},{x:140,y:40},120,90),[{x:0,y:40},{x:120,y:40}])
  assert.deepEqual(visibleSegment({x:40,y:110},{x:40,y:-20},120,90),[{x:40,y:90},{x:40,y:0}])
  assert.equal(visibleSegment({x:-20,y:0},{x:-20,y:60},120,90),undefined)
})


test('full-screen fit puts all three jobs and the 20-floor fixture inside the overlay margins', () => {
  const fixture=cameraTestSite()
  validateStage(fixture)
  assert.equal(stages.length,3)
  const camera=new Camera()
  for (const [width,height] of [[1366,768],[1600,900],[1920,1080]]) {
    const area={x:130,y:94,w:width-480,h:height-241}
    camera.resize(width,height,area)
    for (const stage of [...stages,fixture]) {
      const bounds=stageBounds(stage)
      camera.fit(bounds)
      const top=camera.screen({x:bounds.left,y:bounds.top})
      const bottom=camera.screen({x:bounds.right,y:0})
      assert.ok(top.x>area.x && top.y>area.y)
      assert.ok(bottom.x<area.x+area.w && bottom.y<area.y+area.h)
    }
  }
})

test('floor jumps center every floor, move the world ground offscreen at upper floors, and retain click coordinates', () => {
  const fixture=cameraTestSite()
  const floors=floorBands(fixture)
  assert.equal(floors.length,20)
  const camera=new Camera()
  const area={x:132,y:94,w:875,h:527}
  camera.resize(1366,768,area)
  camera.fit(stageBounds(fixture))
  assert.ok(camera.screen({x:0,y:0}).y<768)
  for(const band of floors) {
    camera.focus(band)
    const center={x:(band.left+band.right)/2,y:(band.top+band.bottom)/2}
    const screen=camera.screen(center)
    near(screen.x,camera.screenCenter.x,1e-8)
    near(screen.y,camera.screenCenter.y,1e-8)
    assert.equal(floorAt(floors,camera.world(screen)),band.number)
  }
  const ground=camera.screen({x:0,y:0})
  assert.ok(ground.y>768)
  const joint=fixture.joints.find(j=>j.id==='upper191')
  const previousScale=camera.scale
  camera.resize(1366,768,{...area,w:area.w+320})
  near(camera.scale,previousScale,1e-8)
  near(camera.world(camera.screen(joint)).y,joint.y,1e-8)
  camera.fit()
  assert.ok(camera.screen({x:0,y:0}).y<768)
})
