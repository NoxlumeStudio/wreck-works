import { Body, Box, Contact, ContactImpulse, Joint as PhysicsJoint, PrismaticJoint, Vec2, WeldJoint, World } from 'planck'
import { materials, padWidth, tools, validateStage, type Joint, type Member, type StarRule, type Placement, type Point, type Stage, type SitePoint } from './stages.ts'
import { burstJoints, burstReach, burstSites, bursts, isBurst, type Burst } from './bursts.ts'
import { connectedMembers, gravity, massOf, structural, survey } from './structure.ts'

export const dt = 1 / 60
const groundY = -.04
const maxTime = 17
const vec = (p: Point) => Vec2(p.x, p.y)
type BodyInfo = { kind: Member['kind'] | 'ground' | 'neighbor' | 'weight' | 'pad'; id: string }
export type Part = { data: Member; body: Body; quiet: number; counted: boolean; damage: number }
export type Tie = { data: Joint; joint: PhysicsJoint | null; stress: number; damage: number }
export type EventKind = 'cut' | 'break' | 'wire' | 'weight' | 'jack' | 'pad' | 'neighborHit' | 'safeHit' | Burst
export type SiteEvent = { kind: EventKind; target: string; time: number; at: Point; source?: string; impact?: number; damage?: number }
export type Remaining = { id: string; at: Point; mass: number; top: number; reason: 'supported' | 'high' | 'outside' | 'moving' | 'settling' }
export type Motion = { id: string; speed: number; spin: number }
export const stopSpeed=.29, stopSpin=.3
export type Result = {
  rate: number; cost: number; damage: number; success: boolean; timedOut: boolean
  reasons: string[]; stars: number; saved: number; assetDamage?: Record<string, number>; quality: boolean; economical: boolean; remaining: Remaining[]; ticks: number; elapsed: number; quiet: number; moving: Motion[]
}
type Wire = { target: string; body: Body; local: Vec2; anchor: Vec2; length: number; tension: number }
type Pad = { x: number; body: Body; spring: PrismaticJoint }

export const costOf = (placements: Placement[]) => placements.reduce((sum, p) => sum + tools[p.tool].price, 0)
export function jackFits(stage: Stage, target: SitePoint, anchor: SitePoint) {
  if(target.kind!=='beam'||anchor.kind!=='ground'||Math.abs(target.x-anchor.x)>.28)return false
  const lower=Math.min(...stage.points.filter(p=>p.kind==='beam').map(p=>p.y))
  return target.y<=Math.max(4.1,lower+.20)
}
export function placementError(stage: Stage, previous: Placement[], p: Placement) {
  if (!Object.hasOwn(tools, p.tool) || !stage.allowed.includes(p.tool)) return 'この現場では使えません。'
  if (costOf(previous) + tools[p.tool].price > stage.budget) return '予算が足りません。'
  if (previous.some(item => item.tool === p.tool && item.target === p.target)) return 'すでに設置済みです。'
  if (p.tool === 'cut') return stage.joints.some(j => j.id === p.target) ? '' : '接合部を選んでください。'
  if(isBurst(p.tool))return burstSites(stage,p.tool).some(s=>s.id===p.target)?'':'作用を与える印を選んでください。'
  const target = stage.points.find(j => j.id === p.target)
  if (p.tool === 'weight') return target?.kind === 'beam' ? '' : '梁の上を選んでください。'
  if (p.tool === 'pad') return target?.kind === 'ground' ? '' : '地面の印を選んでください。'
  const anchor = stage.points.find(j => j.id === p.anchor)
  if (anchor?.kind !== 'ground' || !target?.body) return '地面と建材の両方を選んでください。'
  if (p.tool === 'jack' && !jackFits(stage,target,anchor)) return '地面の真上にある1階の梁を選んでください。'
  if (p.tool === 'wire' && Math.abs(target.x - anchor.x) < 1.1) return '引く向きが分かるよう、離れた地面の印を選んでください。'
  return ''
}

export class Simulation {
  readonly world = new World({ gravity: Vec2(0, -gravity), allowSleep: true })
  readonly ground = this.world.createBody()
  readonly parts = new Map<string, Part>()
  readonly ties = new Map<string, Tie>()
  readonly live = new Set<string>()
  readonly extras: { body: Body; w: number; h: number; kind: 'weight' | 'pad' }[] = []
  readonly wires: Wire[] = []
  readonly pads: Pad[] = []
  readonly jacks: { body: Body; x: number; h: number; target: Part }[] = []
  readonly dust: { x: number; y: number; time: number; strength: number }[] = []
  readonly events: SiteEvent[] = []
  readonly alerts: SiteEvent[] = []
  private eventKeys = new Map<string, SiteEvent>()
  readonly pendingCuts: string[] = []
  private pendingBursts: { kind:Burst; id:string; at:Point }[]=[]
  readonly initial: ReturnType<typeof survey>
  readonly total: number
  readonly cost: number
  readonly toolCount: number
  time = 0
  ticks = 0
  moving: Motion[] = []
  private recentMotion: Motion[] = []
  quiet = 0
  rate = 0
  damage = 0
  readonly assetDamage: Record<string, number> = Object.create(null)
  impacts = 0
  result: Result | null = null
  private shock = new Map<string, number>()
  private supported: Set<string>

  readonly stage: Stage

  constructor(stage: Stage, placements: Placement[] = []) {
    this.stage = stage
    validateStage(stage)
    this.initial = survey(stage)
    this.supported = this.initial.supported
    this.cost = costOf(placements)
    this.toolCount = placements.length
    this.ground.setUserData({ id: 'ground', kind: 'ground' })
    const limit = Math.max(13.15,stage.width+1.1)
    this.ground.createFixture(Box(Math.max(22,limit+1), .5, Vec2(0, groundY - .5)), { friction: .84 })
    for (const x of [-limit, limit]) this.ground.createFixture(Box(.2, 8, Vec2(x, 5)), { friction: .4 })
    for (const asset of stage.assets ?? []) {
      this.assetDamage[asset.id] = 0
      const rect = asset.obstacle
      if (!rect) continue
      const body = this.world.createBody({ position: vec(rect), userData: { kind: 'neighbor', id: asset.id } })
      body.createFixture(Box(rect.w/2,rect.h/2), {friction:.78})
    }
    if (!stage.assets && stage.protection === 'neighbor') for (const x of stage.neighborX ?? [-10.26, 10.26]) {
      const body = this.world.createBody({ position: Vec2(x, 1.7), userData: { kind: 'neighbor', id: `neighbor${x}` } })
      body.createFixture(Box(2.15, 1.74), { friction: .78 })
    }
    for (const m of stage.members) {
      const body = this.world.createDynamicBody({ position: vec(m), angle: m.angle, linearDamping: .09, angularDamping: .16, bullet: m.kind === 'safe', userData: { id: m.id, kind: m.kind } })
      body.createFixture(Box(m.w / 2, m.h / 2), { density: massOf(m) / (m.w * m.h), friction: materials[m.material].friction, restitution: .025 })
      this.parts.set(m.id, { data: m, body, quiet: 0, counted: false, damage: 0 })
    }
    for (const j of stage.joints) {
      const a = this.parts.get(j.a)!.body
      const b = this.parts.get(j.b)?.body ?? this.ground
      const joint = this.world.createJoint(new WeldJoint({ frequencyHz: j.kind === 'foot' ? 2.8 : 3.6, dampingRatio: .78 }, a, b, vec(j)))!
      this.ties.set(j.id, { data: j, joint, stress: 0, damage: 0 })
      this.live.add(j.id)
    }
    this.total = stage.members.filter(structural).reduce((sum, m) => sum + massOf(m), 0)
    this.world.on('post-solve', (contact, impulse) => this.contact(contact, impulse))
    for (const [i, p] of placements.entries()) {
      if (!placementError(stage, placements.slice(0, i), p)) this.install(p)
    }
  }

  private install(p: Placement) {
    const spot = this.stage.points.find(s => s.id === p.target)!
    if (p.tool === 'cut') {
      this.pendingCuts.push(p.target)
      return
    }
    if (isBurst(p.tool)) {
      const at=burstSites(this.stage,p.tool).find(s=>s.id===p.target)!
      this.pendingBursts.push({kind:p.tool,id:p.target,at})
      return
    }
    if (p.tool === 'weight' || p.tool === 'pad') {
      const pad = p.tool === 'pad'
      const w = pad ? padWidth : .74
      const h = pad ? .37 : .48
      const body = this.world.createDynamicBody({ position: Vec2(spot.x, pad ? .72 : spot.y + h / 2 + .01), bullet: !pad, userData: { kind: p.tool, id: pad ? p.target : `weight:${p.target}` } })
      body.createFixture(Box(w / 2, h / 2), { density: (pad ? 36 : 390) / (w * h), friction: pad ? .96 : .62, restitution: .015 })
      this.extras.push({ body, w, h, kind: p.tool })
      if (pad) {
        const spring = this.world.createJoint(new PrismaticJoint({ enableLimit: true, lowerTranslation: -.52, upperTranslation: .02 }, this.ground, body, body.getPosition(), Vec2(0, 1)))!
        this.pads.push({ x: spot.x, body, spring })
      }
      return
    }
    const anchor = this.stage.points.find(s => s.id === p.anchor)!
    const target = this.parts.get(spot.body!)!
    if (p.tool === 'wire') {
      const fixed = vec(anchor)
      const attach = vec(spot)
      const initial = Vec2.distance(fixed, attach)
      this.wires.push({ target: target.data.id, body: target.body, local: target.body.getLocalPoint(attach), anchor: fixed, length: initial, tension: 0 })
    } else {
      const h = .3
      const x = anchor.x
      const body = this.world.createKinematicBody({ position: Vec2(x, spot.y - .54) })
      body.createFixture(Box(.32, h / 2), { friction: .9 })
      this.jacks.push({ body, x, h, target })
    }
  }

  private applyBursts() {
    for(const {kind,id,at} of this.pendingBursts.splice(0).sort((a,b)=>a.id.localeCompare(b.id)||a.kind.localeCompare(b.kind))){
      const effect=bursts[kind]
      this.record(kind,id,at)
      for(const joint of burstJoints(this.stage,at,kind)){
        const tie=this.ties.get(joint.id)!
        if(!tie.joint)continue
        const proximity=1-Math.hypot(joint.x-at.x,joint.y-at.y)/effect.range
        const weakness=effect.local+.72*proximity
        tie.damage+=joint.kind==='foot'?weakness*.58:weakness
        if(tie.damage>=1)this.sever(joint.id,'break')
      }
      for(const part of this.parts.values()){
        const reach=burstReach(at,part.data,kind)
        if(!reach)continue
        const delta=Vec2.sub(part.body.getPosition(),vec(at))
        if(delta.normalize()<.05)delta.set(0,1)
        const shift=effect.kick*reach
        part.body.applyLinearImpulse(Vec2.mul(shift*part.body.getMass(),delta),part.body.getWorldCenter(),true)
        if(part.data.kind==='safe'){
          const asset=this.stage.assets?.find(a=>a.body===part.data.id)
          this.protectionImpact('safeHit',part.data.id,part.body.getPosition(),kind,shift*part.body.getMass(),Math.max(0,shift*1.7-(asset?.damageThreshold??1.95))*7.2,asset?.id)
        }
      }
      for(const asset of this.stage.assets??[]){
        if(!asset.obstacle)continue
        const reach=burstReach(at,asset.obstacle,kind)
        if(!reach)continue
        const impact=effect.kick*reach*270
        this.protectionImpact('neighborHit',asset.id,asset.obstacle,kind,impact,Math.max(0,impact-(asset.damageThreshold??195))/26,asset.id)
      }
    }
  }

  private protectionImpact(kind: 'neighborHit'|'safeHit', target: string, at: Point|undefined, source:string, impulse:number, damage:number, asset?:string) {
    if(asset)this.assetDamage[asset]=Math.min(100,this.assetDamage[asset]+damage)
    this.damage=Math.min(100,this.damage+damage)
    if(damage>0&&at)this.record(kind,target,at,source,impulse,damage)
  }

  private contact(contact: Contact, impulse: ContactImpulse) {
    const aBody = contact.getFixtureA().getBody()
    const bBody = contact.getFixtureB().getBody()
    const a = aBody.getUserData() as BodyInfo | undefined
    const b = bBody.getUserData() as BodyInfo | undefined
    const impulseN = impulse.normalImpulses.reduce((sum, n) => sum + n, 0)
    if (impulseN < 25) return
    const pos = contact.getWorldManifold(null)?.points[0]
    if (!a || !b) {
      const jack = this.jacks.find(j => j.body === aBody || j.body === bBody)
      const hit = a ?? b
      if (jack && hit?.id === jack.target.data.id && pos && this.time <= 2.4) {
        this.record('jack', hit.id, pos, undefined, impulseN)
      }
      return
    }
    if (impulseN > 100) {
      if (pos && this.dust.length < 30) this.dust.push({ x: pos.x, y: pos.y, time: this.time, strength: Math.min(1.3, impulseN / 500) })
      this.impacts++
    }
    for (const [item, other] of [[a, b], [b, a]]) {
      const part = this.parts.get(item.id)
      if (part && structural(part.data)) {
        this.shock.set(item.id, Math.max(this.shock.get(item.id) ?? 0, impulseN / part.body.getMass()))
      }
      if (pos && item.kind === 'weight' && impulseN >= 34 && this.parts.has(other.id)) {
        this.record('weight', item.id, pos, other.id, impulseN)
      }
      if (pos && item.kind === 'pad' && this.parts.has(other.id)) {
        this.record('pad', item.id, pos, other.id, impulseN)
      }
      if (item.kind === 'neighbor') {
        const asset=this.stage.assets?.find(a=>a.id===item.id)
        const damage = Math.max(0, impulseN - (asset?.damageThreshold ?? 195)) / 26
        this.protectionImpact('neighborHit',item.id,pos,other.id,impulseN,damage,asset?.id)
      }
      if (item.kind === 'safe') {
        const asset=this.stage.assets?.find(a=>a.body===item.id)
        const speedChange = impulseN / this.parts.get(item.id)!.body.getMass()
        const threshold = other.kind === 'pad' ? 4.2 : asset?.damageThreshold ?? 1.95
        const damage = Math.max(0, speedChange - threshold) * (other.kind === 'pad' ? 2.6 : 7.2)
        this.protectionImpact('safeHit',item.id,pos,other.id,impulseN,damage,asset?.id)
      }
    }
    this.damage = Math.min(100, this.damage)
  }

  private record(kind: EventKind, target: string, at: Point, source?: string, impact?: number, damage?: number) {
    const key = `${kind}:${target}:${source ?? ''}`
    const prior = this.eventKeys.get(key)
    const event = { kind, target, at: { x: at.x, y: at.y }, time: this.time, source, impact, damage }
    if ((kind === 'neighborHit' || kind === 'safeHit') && (!prior || (damage ?? 0) > (prior.damage ?? 0))) {
      this.alerts.push(event)
      if (this.alerts.length > 18) this.alerts.shift()
    }
    if (prior) {
      // Keep the most consequential damaging contact for each pair.
      if (damage && damage > (prior.damage ?? 0)) Object.assign(prior, event)
      return
    }
    this.events.push(event)
    this.eventKeys.set(key, event)
  }

  sever(id: string, kind: 'cut' | 'break' = 'cut') {
    const tie = this.ties.get(id)!
    if (!tie.joint) return
    const anchor = tie.joint.getAnchorA()
    this.record(kind, id, anchor)
    this.world.destroyJoint(tie.joint)
    tie.joint = null
    tie.damage = 1
    this.live.delete(id)
    this.supported = connectedMembers(this.stage, this.live)
    this.parts.get(tie.data.a)!.body.setAwake(true)
    this.parts.get(tie.data.b)?.body.setAwake(true)
    if (this.dust.length < 30) this.dust.push({ x: anchor.x, y: anchor.y, time: this.time, strength: .48 })
  }

  step() {
    if (this.result) return
    for (const id of this.pendingCuts.splice(0)) this.sever(id, 'cut')
    this.applyBursts()
    this.shock.clear()
    this.ticks++
    this.time += dt
    for (const wire of this.wires) {
      const pos = wire.body.getWorldPoint(wire.local)
      const direction = Vec2.sub(wire.anchor, pos)
      const distance = direction.normalize()
      const rest = wire.length - Math.min(wire.length * .30, this.time * .7)
      const speed = -Vec2.dot(wire.body.getLinearVelocityFromWorldPoint(pos), direction)
      wire.tension = distance > rest ? Math.min(5400, Math.max(0, 4300 * (distance - rest) + 650 * speed)) : 0
      if (wire.tension > 0) wire.body.applyForce(Vec2.mul(wire.tension, direction), pos, true)
      if (wire.tension > 140) this.record('wire', wire.target, pos)
    }
    for (const pad of this.pads) {
      const force = Math.min(27000, Math.max(0, 360 - pad.spring.getJointTranslation() * 14500 - pad.body.getLinearVelocity().y * 3450))
      if (pad.body.isAwake()) pad.body.applyForceToCenter(Vec2(0, force), false)
    }
    for (const jack of this.jacks) {
      jack.body.setLinearVelocity(Vec2(0, this.time <= 2.4 ? .37 : 0))
    }
    this.world.step(dt, 12, 7)
    const failed: string[] = []
    for (const tie of this.ties.values()) {
      if (!tie.joint) continue
      const reaction = tie.joint.getReactionForce(60).length()
      const torque = Math.abs(tie.joint.getReactionTorque(60))
      const a = this.parts.get(tie.data.a)!
      const b = this.parts.get(tie.data.b)
      const forceLimit = tie.data.kind === 'foot' ? 21500 : tie.data.kind === 'deck' ? 9700 : 15400
      const torqueLimit = tie.data.kind === 'foot' ? 6700 : tie.data.kind === 'deck' ? 3200 : 5200
      const ratio = Math.max(reaction / forceLimit, torque / torqueLimit)/(this.stage.supportStrength ?? 1)
      tie.stress += (ratio - tie.stress) * .22
      const shock = Math.max(this.shock.get(a.data.id) ?? 0, b ? this.shock.get(b.data.id) ?? 0 : 0)
      if (this.time > .12) {
        const weakened = 1 - .28 * tie.damage
        tie.damage += Math.max(0, tie.stress / weakened - .76) * dt * 2.6 + Math.max(0, shock - 2.6) * .24
        if (tie.damage >= 1) failed.push(tie.data.id)
      }
      a.damage = Math.max(a.damage, Math.min(1, tie.damage))
      if (b) b.damage = Math.max(b.damage, Math.min(1, tie.damage))
    }
    for (const id of failed) this.sever(id, 'break')
    let cleared = 0
    this.moving = []
    for (const part of this.parts.values()) {
      const { data, body } = part
      const speed = body.getLinearVelocity().length()
      const spin = Math.abs(body.getAngularVelocity())
      const still = speed < .2 && spin < .2
      if (speed > stopSpeed || spin > stopSpin) this.moving.push({id:data.id,speed,spin})
      if (!structural(data)) continue
      const qualifies = this.remainingReason(part) === 'moving'
      part.quiet = qualifies && still ? part.quiet + dt : 0
      if (!qualifies || speed > .48 || spin > .5) part.counted = false
      if (part.quiet >= .48) part.counted = true
      if (part.counted) cleared += massOf(data)
    }
    for (const extra of this.extras) {
      const speed=extra.body.getLinearVelocity().length()
      if(speed<=.34)continue
      // At the compression stop the pad can register one-step solver velocity spikes.
      // The load itself and any contact damage are still evaluated normally.
      const spring=extra.kind==='pad'?this.pads.find(p=>p.body===extra.body)?.spring:undefined
      if(spring && spring.getJointTranslation() <= spring.getLowerLimit()+.12)continue
      const info=extra.body.getUserData() as BodyInfo
      this.moving.push({id:info.id,speed,spin:0})
    }
    if(this.moving.length)this.recentMotion=this.moving
    this.rate = Math.max(0, Math.min(100, Math.floor(100 * cleared / this.total + 1e-7)))
    this.quiet = this.moving.length ? 0 : this.quiet + dt
    while (this.dust.length && this.time - this.dust[0].time > .72) this.dust.shift()
    const deadline = this.stage.timeLimit ?? maxTime
    const stable=this.quiet>=1.25 && this.ticks>=Math.ceil(3.2/dt)
    const atLimit=this.ticks>=Math.ceil(deadline/dt)
    if(stable||atLimit)this.finish(!stable)
  }

  private remainingReason(part: Part): Remaining['reason'] {
    if (this.supported.has(part.data.id)) return 'supported'
    const { x } = part.body.getPosition()
    if (Math.abs(x) >= this.stage.width) return 'outside'
    return this.partTop(part) > this.stage.height ? 'high' : 'moving'
  }

  private partTop(part: Part) {
    const angle = part.body.getAngle()
    const { w, h } = part.data
    return part.body.getPosition().y + (Math.abs(Math.sin(angle)) * w + Math.abs(Math.cos(angle)) * h) / 2
  }

  private finish(timedOut: boolean) {
    const reasons: string[] = []
    if (timedOut) reasons.push('作業時間の上限までに、現場の静止を確認できませんでした。')
    if (this.rate < this.stage.goal) reasons.push('まだ建物が残っています。')
    for (const asset of this.stage.assets ?? []) {
      if (this.assetDamage[asset.id] > asset.tolerance) reasons.push(`${asset.name}の損傷が許容範囲を超えました。`)
    }
    if (!this.stage.assets && this.damage > this.stage.tolerance) reasons.push(this.stage.protection === 'safe' ? '金庫の損傷が許容範囲を超えました。' : '隣家に被害が出ました。')
    if (this.cost > this.stage.budget) reasons.push('予算を超えました。')
    const success = reasons.length === 0
    const economical = this.cost <= this.stage.savingsGoal
    const quality = this.stage.protection === 'safe' ? this.damage === 0 : this.rate >= 98
    const fits = (rule: StarRule) => this.cost <= (rule.cost ?? Infinity) && this.rate >= (rule.rate ?? 0)
      && this.toolCount <= (rule.tools ?? Infinity) && (!rule.undamaged || this.damage === 0)
    const rules=this.stage.stars
    const stars = success ? rules ? 1 + Number(fits(rules[0])) + Number(fits(rules[0]) && fits(rules[1])) : 1 + Number(quality) + Number(economical) : 0
    const remaining = Array.from(this.parts.values()).filter(p => structural(p.data) && !p.counted).map(part => ({
      id: part.data.id, at: { x: part.body.getPosition().x, y: part.body.getPosition().y },
      mass: massOf(part.data), top: this.partTop(part),
      reason: this.remainingReason(part)==='moving'&&part.body.getLinearVelocity().length()<.2&&Math.abs(part.body.getAngularVelocity())<.2?'settling' as const:this.remainingReason(part),
    }))
    this.result = { rate: this.rate, cost: this.cost, damage: this.damage, timedOut, success, reasons, stars, quality, economical, saved: this.stage.budget - this.cost, remaining, ticks:this.ticks, elapsed:this.ticks*dt, quiet:this.quiet, moving:timedOut?this.recentMotion:[], assetDamage: {...this.assetDamage} }
  }
}
