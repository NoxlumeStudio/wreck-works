/// <reference types="vite/client" />
import { scenario } from './scenario.ts'
import { StoryPlayer, StoryProgress } from './story.ts'
import { toolGuides } from './tool-guides.ts'
import { burstReach, burstSites, isBurst } from './bursts.ts'
import './style.css'
import './title.css'
import { nearbyTarget, targetLabels } from './targets.ts'
import { icon } from './icons.ts'
import { gameArt, stageImage, useOptionalImage } from './game-art.ts'
import { equipment, visibleSegment } from './equipment.ts'
import { eventText, objectName, remainingAdvice, remainingReasonText } from './feedback.ts'
import { costOf, dt, jackFits, placementError, Simulation, type Result, type SiteEvent } from './physics.ts'
import { View, type Mark } from './render.ts'
import { campaign as stages, chapters, toolUnlock } from './campaign.ts'
import { available, ProgressStore, loadLatest, loadProgress, latestKey, progressKey, resumeStage } from './progress.ts'
import { tools, type Stage, type StarRule, type Placement, type Point, type Tool } from './stages.ts'

const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const button = (id: string) => get<HTMLButtonElement>(id)
const view = new View(get<HTMLCanvasElement>('scene'))
const title = get('title')
const toolNames = Object.keys(tools) as Tool[]
const yen = (cost: number) => `¥${cost.toLocaleString('ja-JP')}`
let level = 0
let records: Record<string,number> = {}
let latest: Record<string,number> = {}
let labels = new Map<string,string>()
let pointer: Point | undefined
let screenTargets: {point:Point;item:Mark}[] = []
try {
  latest=loadLatest(stages,localStorage.getItem(latestKey))
  records=loadProgress(stages,localStorage.getItem(progressKey),localStorage.getItem('wreck-works-v1'))
} catch { /* The game can run without persistent progress. */ }
const legacyRecords={...records}
const progress=typeof indexedDB==='undefined'?undefined:new ProgressStore(indexedDB)
const updates=typeof BroadcastChannel==='undefined'?undefined:new BroadcastChannel('wreck-works-progress')
let progressRead=0
let campaignGeneration=''
let storyReady=false
let endingPending=false
const storyPlayer=new StoryPlayer()
const storyProgress=new StoryProgress((()=>{
  try{return window.localStorage}catch{return undefined}
})())
let runGeneration=''
const pendingSaves=new Map<string,number>()
function applyNewCampaign(generation: string) {
  campaignGeneration=generation
  storyPlayer.close()
  endingPending=false
  records={}
  latest={}
  pendingSaves.clear()
  seenGuides.clear()
  if(storyReady)storyProgress.mark(generation,'initialized')
  switchStage(0)
}
async function syncProgress() {
  const read=++progressRead
  try {
    const saved=await progress?.read()
    if(read!==progressRead||!saved)return
    if(saved.generation!==campaignGeneration)applyNewCampaign(saved.generation)
    for(const item of saved.ratings){
      records[item.id]=Math.max(records[item.id]??0,item.best)
      if(item.latest!==undefined&&!pendingSaves.has(item.id))latest[item.id]=item.latest
    }
    tabs()
    refreshStoryMenu()
    refreshTitleControls()
  }catch{/* Progress remains usable within this tab. */}
}
updates?.addEventListener('message',()=>{if(storyReady)void syncProgress()})
window.addEventListener('focus',()=>{if(storyReady)void syncProgress()})

let stage: Stage = stages[level]
let floorSelection = 'all'
let state: 'edit' | 'running' | 'result' = 'edit'
let selected: Tool | null = null
let anchor: string | undefined
let inspected: number | null = null
let hoveredEquipment: number | null = null
let menuAt: Point | undefined
let placementPriority = false
let panMode = false
let drag: { pointerId: number; at: Point } | undefined
let placements: Placement[] = []
const seenGuides=new Set<Tool>()
const guideKey=(tool: Tool)=>tool==='cut'?'wreck-works-job1-guide-v1':`wreck-works-tool-guide-${tool}-v1`
const guideStamp=()=>campaignGeneration?`seen:${campaignGeneration}`:'seen'
function guideSeen(tool: Tool) {
  if(seenGuides.has(tool))return true
  try{return localStorage.getItem(guideKey(tool))===guideStamp()}catch{return false}
}
function unlockedGuide() {
  return stages[level].unlockedTools[0]
}
let guideActive=false
let guidePlaced: Placement|undefined
let guideTarget: HTMLElement|undefined
let guidePreview: Mark|undefined
let marks: Mark[] = []
let hovered: Mark | undefined
let focusedImpact: SiteEvent | undefined
let hintLevel = 0
let lastEventUpdate = -Infinity
let recentEvent: SiteEvent | undefined
let sim: Simulation | null = null
let speed = 1
let paused = false
let last = performance.now()
let accumulator = 0
let lastMetric = -Infinity
const sceneStatus = '道具を選んで現場に配置'
const status = get('status')
const dialog = get<HTMLDialogElement>('manual')
const newGameDialog=get<HTMLDialogElement>('new-game-dialog')
const scene = get('canvas-wrap')
const equipmentMenu = get('equipment-menu')
const game = get('game')
const titleScreen=get('title-screen')
const titleStoryDialog=get<HTMLDialogElement>('title-story-dialog')
const stageSaveKey=()=>`wreck-works-last-stage-v1:${campaignGeneration||'original'}`
function lastStage() {
  try{return localStorage.getItem(stageSaveKey())}catch{return null}
}
function hasGame() {
  const last=lastStage()
  return available(stages,stages.findIndex(job=>job.id===last),records)||
    Object.keys(records).length>0||Object.keys(latest).length>0||storyProgress.seen(campaignGeneration,'op')
}
function refreshTitleControls() {
  button('title-continue').disabled=!storyReady||!hasGame()
  button('title-new').disabled=!storyReady
  button('title-story').disabled=!storyReady
}
function enterGame() {
  titleScreen.hidden=true
  game.inert=false
}
const floorSelect = get<HTMLSelectElement>('floor-select')

for (const el of document.querySelectorAll<HTMLElement>('[data-icon]')) el.innerHTML = icon(el.dataset.icon!)
useOptionalImage(get<HTMLImageElement>('menu-logo'), gameArt.logo)
document.querySelector<HTMLElement>('.hud')!.style.setProperty('--game-art', `url("${gameArt.header}")`)
document.querySelector<HTMLElement>('.bottom-ui')!.style.setProperty('--game-art', `url("${gameArt.footer}")`)
function message(text: string, error = false) {
  status.textContent = text
  status.dataset.error = String(error)
}
function targetLabel(id: string) { return labels.get(id)??id }
const placementLabel = (p: Placement) => {
  const target = isBurst(p.tool)?burstLabel(p.target):targetLabel(p.target)
  return `${tools[p.tool].name}・${p.anchor ? `${targetLabel(p.anchor)} → ` : ''}${target}`
}
function protectionText(damage: number, tolerance: number) {
  if (!damage) return '無傷'
  return damage <= Math.max(7,tolerance) ? '少し傷ついた' : '大破'
}
function meters() {
  get('clock').hidden=state!=='running'
  if(sim&&state==='running')get('clock').textContent=`作業時間 ${(sim.ticks/60).toFixed(1)} / ${stage.timeLimit??17}秒`
  const rate = sim?.result?.rate ?? sim?.rate ?? 0
  const rateLabel=state==='running'?'暫定解体率':state==='result'?'確定解体率':'解体率'
  get('rate-label').textContent=rateLabel
  get('panel-rate-label').textContent=rateLabel
  get('placed-count').textContent=`配置済み ${placements.length}点`
  const spent = sim?.cost ?? costOf(placements)
  get('rate').textContent = `${rate}%`
  get('panel-rate').innerHTML = `${rate}<small>%</small>`
  get('rate-meter').style.width = `${rate}%`
  get('budget').textContent = yen(stage.budget - spent)
  get('panel-budget').textContent = yen(stage.budget - spent)
  get('budget-meter').style.width = `${100*(stage.budget-spent)/stage.budget}%`
  get('spent').textContent = `使用 ${yen(spent)} ／ 上限 ${yen(stage.budget)}`
  const assets=stage.assets??[]
  get('protection').hidden=!assets.length
  get('hud-protection').hidden=!assets.length
  if(assets.length){
    let safe=0
    get('protection').innerHTML=assets.map(asset=>{
      const damage=sim?.assetDamage[asset.id]??0
      if(damage<=asset.tolerance)safe++
      const range=Math.max(20,asset.tolerance*2)
      return `<div class="asset" data-damaged="${damage>asset.tolerance}"><div><span>${asset.name}</span><b>${protectionText(damage,asset.tolerance)}</b></div><div class="meter damage-meter" aria-label="${damage>asset.tolerance?'許容範囲を超えています':'許容範囲内です'}"><i style="width:${Math.min(100,damage/range*100)}%"></i><em style="left:${asset.tolerance/range*100}%"></em></div></div>`
    }).join('')
    get('hud-protection').textContent=assets.length===1?`｜ ${assets[0].name} ${protectionText(sim?.assetDamage[assets[0].id]??0,assets[0].tolerance)}`:`｜ 保護条件 ${safe}/${assets.length}`
  }
}
function ruleText(rule: StarRule) {
  return [rule.cost!==undefined?`費用 ${yen(rule.cost)}以内`:'',
    rule.rate!==undefined?`解体率 ${rule.rate}%以上`:'',rule.tools!==undefined?`道具 ${rule.tools}点まで`:'',
    rule.undamaged?'保護対象すべて無傷':''].filter(Boolean).join('・')
}
function conditions() {
  const assets=stage.assets??[]
  get('goal-text').textContent = `目標 ${stage.goal}%以上${assets.length?'・保護条件あり':''}`
  get('conditions').innerHTML = `<div class="condition"><span>${icon('target')}解体率</span><b>${stage.goal}%以上</b></div><div class="condition"><span>工事費</span><b>${yen(stage.budget)}以内</b></div>${assets.map(a=>`<div class="condition"><span>${icon('shield')}${a.name}</span><b>${a.tolerance?'許容損傷 '+a.tolerance+'点まで':'無傷'}</b></div>`).join('')}${(stage.stars??[]).map((r,i)=>`<div class="star-rule"><b>★${i+2}</b> ${ruleText(r)}${i===1?' ＋ ★2の条件':''}</div>`).join('')}`
}
function tabs() {
  const sections=chapters.map((name,chapter)=>{
    const group=document.createElement('section')
    group.className='chapter'
    const heading=document.createElement('h3')
    heading.textContent=`第${chapter+1}章 ${name}`
    group.append(heading)
    for (const s of stages.filter(job=>job.chapter===chapter+1)) {
      const i=s.number-1
      const el = document.createElement('button')
      el.type='button';el.className='stage-tab';el.dataset.job=String(s.number)
      el.setAttribute('aria-current',String(i===level))
      el.disabled=!available(stages,i,records)
      const rating=records[s.id]??0
      el.innerHTML=`<b>${String(s.number).padStart(2,'0')}</b><span>${s.name}</span>${el.disabled?icon('lock'):rating?`<small class="tab-stars" aria-label="最高 星${rating}つ">${'★'.repeat(rating)}${'☆'.repeat(3-rating)}</small>`:''}`
      if(latest[s.id]!==undefined){
        const label=document.createElement('small')
        label.className='last-rating'
        label.textContent=latest[s.id]===0?'直近 未達成':`直近 ★${latest[s.id]}`
        el.append(label)
      }
      if(el.disabled)el.title='前の現場をクリアすると解放'
      el.addEventListener('click',()=>{if(i!==level)switchStage(i);setMenu(false)})
      group.append(el)
    }
    return group
  })
  get('stages').replaceChildren(...sections)
  const stars = records[stages[level].id] ?? 0
  const badge = get('job-stars')
  badge.hidden = !stars
  badge.textContent = '★'.repeat(stars)+'☆'.repeat(3-stars)
  badge.setAttribute('aria-label',`最高評価 星${stars}つ`)
}
for(const [group,title] of [['base','基本道具'],['burst','爆発系']] as const){
 const details=document.createElement('details')
 details.className='tool-group';details.open=true
 details.addEventListener('toggle',updateGuide)
 const summary=document.createElement('summary');summary.textContent=title
 details.append(summary,...toolNames.filter(t=>isBurst(t)===(group==='burst')).map(tool => {
  const i=toolNames.indexOf(tool)
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'tool'
  el.dataset.tool = tool
  el.innerHTML = `<span class="tool-top">${icon(tools[tool].icon)}<kbd>${i+1}</kbd></span><strong>${tools[tool].name}</strong><span class="price">${yen(tools[tool].price)}</span><small class="tool-lock"></small>`
  const image = new Image()
  image.alt = ''
  image.className = 'tool-art'
  useOptionalImage(image, gameArt.tools[tool])
  el.querySelector('.tool-top')!.prepend(image)
  el.addEventListener('click',()=>choose(tool))
  return el
 }))
 get('tools').append(details)
}
function toolsState() {
  for (const el of document.querySelectorAll<HTMLButtonElement>('button[data-tool]')) {
    const tool = el.dataset.tool as Tool
    el.disabled = state !== 'edit' || !stage.allowed.includes(tool)
    const label=el.querySelector<HTMLElement>('.tool-lock')!
    label.hidden=!isBurst(tool)||stage.allowed.includes(tool)
    label.textContent=label.hidden?'':`依頼${toolUnlock[tool]}で解放`
    el.title = stage.allowed.includes(tool) ? `${tools[tool].desc}。 ${tools[tool].hint} ${tools[tool].use}` : `依頼${toolUnlock[tool]}で解放`
    el.setAttribute('aria-pressed', String(tool === selected))
  }

}
function inWorkArea(p: Point, padding = 0) {
  const a = view.camera.area
  return p.x>=a.x-padding && p.x<=a.x+a.w+padding && p.y>=a.y-padding && p.y<=a.y+a.h+padding
}

function positionMenu() {
  if (inspected === null || !menuAt) return
  const p = view.xy(menuAt)
  const area = view.camera.area
  if (!inWorkArea(p,8)) { closeMenu(); return }
  const w = equipmentMenu.offsetWidth
  const h = equipmentMenu.offsetHeight
  const x = Math.max(area.x, Math.min(area.x+area.w-w, p.x+15))
  const y = Math.max(area.y, Math.min(area.y+area.h-h, p.y-h-12))
  equipmentMenu.style.left = `${x}px`
  equipmentMenu.style.top = `${y}px`
}

function closeMenu(restoreFocus = false) {
  const index = inspected
  inspected = null
  menuAt = undefined
  equipmentMenu.hidden = true
  if (index === null) return
  get('equipment-layer').querySelectorAll(`[data-equipment="${index}"]`).forEach(el=>el.setAttribute('aria-expanded','false'))
  if (restoreFocus) get('equipment-layer').querySelector<HTMLButtonElement>(`[data-equipment="${index}"]`)?.focus()
}

function equipmentTargets() {
  hoveredEquipment = null
  const layer = get('equipment-layer')
  if (state !== 'edit') { layer.replaceChildren(); return }
  const buttons: HTMLButtonElement[] = []
  for (const [index, placement] of placements.entries()) {
    const geometry = equipment(stage, placement)
    const to = view.xy(geometry.at)
    const from = geometry.anchor && view.xy(geometry.anchor)
    const add = (center: Point, w: number, h: number, part: string, angle = 0) => {
      if (center.x+w/2 < 0 || center.x-w/2 > view.w || center.y+h/2 < 0 || center.y-h/2 > view.h) return
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'equipment-target'
      el.dataset.equipment = String(index)
      el.dataset.equipmentPart = part
      el.style.left = `${center.x}px`
      el.style.top = `${center.y}px`
      el.style.width = `${w}px`
      el.style.height = `${h}px`
      el.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`
      const role=placement.tool==='wire'?({line:'本体',anchor:'地面側の固定点',target:'建材側の接続点'} as Record<string,string>)[part]:undefined
      el.setAttribute('aria-label', `設置済み ${placementLabel(placement)}${role?`・${role}`:''}`)
      el.setAttribute('aria-controls','equipment-menu')
      el.setAttribute('aria-expanded',String(inspected===index))
      if (buttons.some(b=>b.dataset.equipment===String(index))) el.tabIndex = -1
      for (const event of ['pointerenter','focus']) el.addEventListener(event,()=>{
        hoveredEquipment = index
        setHover({id:placement.target, at: view.camera.world(center), label:placementLabel(placement)})
      })
      for (const event of ['pointerleave','blur']) el.addEventListener(event,()=>{
        if (hoveredEquipment === index) { hoveredEquipment = null; setHover() }
      })
      el.addEventListener('click', event => inspect(index, event.detail ? view.camera.world(pointerAt(event)) : view.camera.world(center)))
      buttons.push(el)
    }
    if (geometry.size) add(to,Math.max(32, geometry.size.x*view.scale+10),Math.max(32,geometry.size.y*view.scale+10),'body')
    else add(to,32,32,'target')
    if (from) {
      add(from,32,32,'anchor')
      const {x,y,w,h} = view.camera.area
      const segment = visibleSegment({x:from.x-x,y:from.y-y},{x:to.x-x,y:to.y-y},w,h)
      if (segment) {
        const [a,b] = segment
        const dx=b.x-a.x, dy=b.y-a.y
        add({x:x+(a.x+b.x)/2,y:y+(a.y+b.y)/2},Math.hypot(dx,dy),placement.tool==='jack'?26:19,'line',Math.atan2(dy,dx))
      }
    }
  }
  layer.replaceChildren(...buttons)
}
function protectedInBurst(mark: Mark, tool: 'blast'|'precise') {
  const at=mark.source??mark.at
  return (stage.assets??[]).filter(a=>{
    const shape=a.obstacle??stage.members.find(m=>m.id===a.body)
    return shape&&burstReach(at,shape,tool)>0
  })
}
function setHover(mark?: Mark) {
  hovered = mark
  const label = get('hover-label')
  label.hidden = !mark
  if (mark) {
    const tool = selected
    const risks=isBurst(tool)?protectedInBurst(mark,tool):[]
    label.textContent = risks.length?`${mark.label}｜範囲内：${risks.map(a=>a.name).join('・')}`:mark.label
    const p = view.xy(mark.at)
    const half = Math.min(view.w / 2, label.offsetWidth / 2 + 6)
    label.style.left = `${Math.max(half, Math.min(view.w - half, p.x))}px`
    label.style.top = `${p.y < 58 ? p.y + 26 : p.y - 42}px`
  }
}
const targetSpread = Array.from({length:7},(_,row)=>
  Array.from({length:7},(_,column)=>[column-3,row-3]),
).flat().sort(([ax,ay],[bx,by])=>ax*ax+ay*ay-bx*bx-by*by)

function burstLabel(id: string) {
  if(!id.startsWith('between-'))return targetLabel(id)
  const first=stage.joints.filter(j=>j.kind==='foot').find(j=>id.startsWith(`between-${j.id}-`))
  return first?`${targetLabel(first.id)}と${targetLabel(id.slice(first.id.length+9))}の間`:id
}

function targetMarkers() {
  setHover()
  screenTargets=[]
  let raw: Mark[] = []
  if (isBurst(selected)) raw=burstSites(stage,selected).map(at=>({id:at.id,at,label:burstLabel(at.id)}))
  else if (selected === 'cut') raw = [...stage.joints].sort((a,b) => Number(b.kind === 'foot') - Number(a.kind === 'foot')).map(at=>({id:at.id,at,label:targetLabel(at.id)}))
  else if (selected) {
    const tool = selected
    raw = stage.points.filter(p => {
      if (tool==='weight') return p.kind==='beam'
      if (tool==='pad') return p.kind==='ground'
      if (!anchor) return p.kind==='ground' && (tool==='wire' || stage.points.some(b=>jackFits(stage,b,p)))
      const start=stage.points.find(s=>s.id===anchor)!
      if (tool==='jack') return jackFits(stage,p,start)
      return !!p.body && Math.abs(p.x-start.x)>=1.1
    }).map(at=>({id:at.id,at,label:targetLabel(at.id)}))
  }
  const shown: Mark[] = []
  const taken: Point[] = []
  const buttons: HTMLButtonElement[] = []
  const spread = targetSpread
  for (const mark of raw) {
    const origin = view.xy(mark.at)
    if (!inWorkArea(origin,20)) continue
    const candidate = spread.map(([dx,dy]) => ({x:origin.x+dx*34,y:origin.y+dy*34}))
      .find(p=>inWorkArea(p,-17)&&taken.every(t=>Math.hypot(t.x-p.x,t.y-p.y)>=34))
    if (!candidate) continue
    const p = candidate
    taken.push(p)
    const displayed = {...mark,source:mark.at,at:view.camera.world(p)}
    shown.push(displayed)
    screenTargets.push({point:p,item:displayed})
    const el=document.createElement('button')
    el.type='button';el.className='target';el.dataset.target=mark.id
    el.style.left=`${p.x}px`;el.style.top=`${p.y}px`
    el.setAttribute('aria-label',mark.label)
    for (const event of ['pointerenter','focus']) el.addEventListener(event,()=>setHover(displayed))
    for (const event of ['pointerleave','blur']) el.addEventListener(event,()=>{if(hovered===displayed)setHover()})
    el.addEventListener('click',()=>place(mark.id))
    buttons.push(el)
  }
  marks=shown
  get('target-list').replaceChildren(...buttons)
}
function updateGuide() {
  const tool=unlockedGuide()
  const replay=button('replay-guide')
  replay.hidden=!tool
  replay.disabled=state==='running'
  const panel=get('quick-guide')
  panel.hidden=!tool||state!=='edit'||!guideActive||!storyReady||storyPlayer.open
  let target: HTMLElement|undefined
  guidePreview=undefined
  if(tool&&!panel.hidden){
    const guide=toolGuides[tool]
    const pair=tool==='wire'||tool==='jack'
    const steps=pair?4:3
    const placed=guidePlaced&&placements.includes(guidePlaced)
    let heading=`1 / ${steps}　${tools[tool].name}を選ぶ`
    let line=tool==='cut'?'ミキ「まずは道具箱の切断機を選んで、ゲンさん。」':`ミキ「${tools[tool].name}が使えるよ。道具箱から選んでみよう。」`
    target=document.querySelector<HTMLElement>(`[data-tool="${tool}"]`)??undefined
    if(placed){
      heading=`${steps} / ${steps}　解体開始`
      line=guide.run
      target=button('run')
    }else if(selected===tool){
      const first=pair&&!anchor
      const preferred=first&&'anchor' in guide?guide.anchor:guide.target
      const choices=screenTargets.filter(({item})=>
        (first||!placementError(stage,placements,{tool,target:item.id,anchor}))
        &&(!isBurst(tool)||!protectedInBurst(item,tool).length))
      const mark=(choices.find(({item})=>item.id===preferred)??choices[0])?.item
      const node=mark&&document.querySelector<HTMLElement>(`[data-target="${mark.id}"]`)
      heading=first?'2 / 4　地面の固定点を選ぶ':`${pair?3:2} / ${steps}　${pair?'つなぐ建材を選ぶ':tool==='cut'?'接合部に配置する':'現場に配置する'}`
      target=panMode?button('pan'):node??button('fit')
      if(panMode)line='ミキ「移動をオフにすると、現場の印を選べるよ。」'
      else if(costOf(placements)+tools[tool].price>stage.budget){
        target=undefined
        line='ミキ「予算が足りないね。置いた道具を取り外せば、その分の予算が戻るよ。」'
      }else if(!mark)line='ミキ「印が見えないときは全体表示に戻してね。」'
      else if(first)line=`ミキ「まずは${mark.label}を選ぼう。${tool==='wire'?'引っ張る方向を決めるよ。':'持ち上げる位置を決めるよ。'}」`
      else {
        line=guide.place(mark.label)
        guidePreview=mark
      }
    }
    const group=target?.closest<HTMLDetailsElement>('details.tool-group')
    if(group&&!group.open){
      target=group.querySelector('summary')??undefined
      line='ミキ「道具のグループを開いてみよう。」'
    }
    if(get('guide-heading').textContent!==heading)get('guide-heading').textContent=heading
    if(get('guide-line').textContent!==line)get('guide-line').textContent=line
  }
  if(guideTarget!==target){
    guideTarget?.classList.remove('guide-focus')
    target?.classList.add('guide-focus')
    guideTarget=target
    if(target?.closest('.tools'))target.scrollIntoView({block:'nearest'})
  }
}
function finishGuide() {
  const tool=unlockedGuide()
  if(!tool)return
  guideActive=false
  seenGuides.add(tool)
  try{localStorage.setItem(guideKey(tool),guideStamp())}catch{/* The choice still applies in this tab. */}
  updateGuide()
}

function sceneTargets() {
  scene.dataset.placementPriority = String(placementPriority || (selected==='wire' && !!anchor))
  const source = anchor && selected && state==='edit'
  button('cancel-link').hidden=!source
  get('link-state').hidden=!source
  if(source)get('link-state').textContent=`1/2 固定点：${targetLabel(anchor!)}　2/2 接続先を選択`
  button('placement-priority').hidden = !(state === 'edit' && selected && placements.length)
  button('placement-priority').setAttribute('aria-pressed',String(placementPriority))
  button('placement-priority').title = placementPriority ? '優先を解除すると、設置済みの道具を先に選べます。' : '道具と重なった設置点をクリックしたいときに使います。'
  if (state === 'edit') { targetMarkers(); equipmentTargets(); positionMenu() }
  else {
    get('target-list').replaceChildren()
    get('equipment-layer').replaceChildren()
  }
  updateGuide()
}
function refreshEdit(text?: string) {
  toolsState(); sceneTargets(); meters()
  get('scene-status').textContent = selected ? `${tools[selected].name}を配置中` : sceneStatus
  if (text !== undefined) message(text)
}
function choose(tool: Tool) {
  if (state !== 'edit' || !stage.allowed.includes(tool)) return
  selected = selected === tool ? null : tool
  anchor = undefined
  placementPriority = false
  closeMenu()
  setPan(false)
  refreshEdit(selected ? tools[selected].hint : sceneStatus)
}
function inspect(i: number, location?: Point) {
  const placement = placements[i]
  if (!placement || state !== 'edit' || panMode) return
  closeMenu()
  if(anchor){anchor=undefined;sceneTargets();message('接続を中止しました。')}
  inspected = i
  menuAt = location ?? equipment(stage, placement).at
  get('equipment-name').textContent = placementLabel(placement)
  equipmentMenu.hidden = false
  get('equipment-layer').querySelectorAll(`[data-equipment="${i}"]`).forEach(el=>el.setAttribute('aria-expanded','true'))
  positionMenu()
  if (!equipmentMenu.hidden) button('remove-equipment').focus()
}
function removeEquipment() {
  if (state !== 'edit' || inspected === null || !placements[inspected]) return
  const [item] = placements.splice(inspected,1)
  closeMenu()
  placementPriority = false
  refreshEdit(`${tools[item.tool].name}を取り外しました。 ${yen(tools[item.tool].price)} を予算に戻しました。`)
  document.querySelector<HTMLButtonElement>(`[data-tool="${item.tool}"]`)?.focus()
}
function place(id: string) {
  if (state !== 'edit' || !selected || panMode) return
  closeMenu()
  if ((selected === 'wire' || selected === 'jack') && !anchor) {
    if(costOf(placements)+tools[selected].price>stage.budget){message('予算が足りません。',true);return}
    if(stage.points.find(p=>p.id===id)?.kind!=='ground'){message('先に地面の固定点を選んでください。',true);return}
    anchor=id
    sceneTargets()
    message(selected==='jack'?'地面を選びました。真上の梁をクリックしてください。':'地面を選びました。引っ張る建材をクリックしてください。')
    return
  }
  if (placements.some(p=>p.tool===selected&&p.target===id)) {
    message(`${targetLabel(id)}には同じ道具が設置済みです。`,true)
    return
  }
  const item={tool:selected,target:id,anchor}
  const error=placementError(stage,placements,item)
  if (error) { message(error,true); return }
  placements.push(item)
  if(guideActive&&item.tool===unlockedGuide())guidePlaced=item
  anchor=undefined
  refreshEdit(`${placementLabel(item)}を配置しました（${placements.length}点）。`)
}
function edit(keep: boolean) {
  if (!keep) {placements=[];guidePlaced=undefined}
  state='edit';sim=null;selected=null;anchor=undefined;placementPriority=false
  closeMenu();setPan(false)
  paused=false;speed=1;accumulator=0;focusedImpact=undefined;recentEvent=undefined;lastEventUpdate=-Infinity
  get('outline-control').hidden=true;get('result-toggle').hidden=true
  get('mode').dataset.state='edit';get('mode').textContent='配置モード'
  get('run-text').textContent='解体開始';button('run').disabled=false
  get('playback').hidden=true;get('result').hidden=true
  refreshEdit(keep ? '前回の配置を引き継ぎました。道具を置き直せます。' : sceneStatus)
}
function playStories(events: (typeof scenario)[number][], returnFocus:()=>void) {
  const [event,...rest]=events
  if(!event){updateGuide();returnFocus();return}
  storyProgress.mark(campaignGeneration,event.id)
  storyPlayer.play(event,()=>playStories(rest,returnFocus))
  updateGuide()
  refreshStoryMenu()
}
function playEntryStories() {
  if(!storyReady||!titleScreen.hidden)return
  const entry=storyProgress.entry(campaignGeneration,level+1)
  if(entry.length)playStories(entry,()=>button('game-menu').focus())
}
function refreshStoryMenu() {
  const fromTitle=titleStoryDialog.open
  get('story-list').replaceChildren(...scenario.map(event=>{
    const item=document.createElement('button')
    item.type='button'
    item.className='stage-tab'
    const seen=storyProgress.seen(campaignGeneration,event.id)
    item.disabled=!seen&&(fromTitle||!(event.cue.kind==='ending'&&records['job-15']>0))
    item.textContent=fromTitle&&!seen?`${event.title}（未解放）`:event.title
    item.dataset.storyId=event.id
    item.addEventListener('click',()=>{
      const focusItem=()=>get('story-list').querySelector<HTMLButtonElement>(`[data-story-id="${event.id}"]`)?.focus()
      if(fromTitle){
        storyPlayer.play(event,focusItem)
        return
      }
      setMenu(false)
      playStories([event],()=>{
        setMenu(true)
        focusItem()
      })
    })
    return item
  }))
}
function playEnding() {
  endingPending=false
  const ending=scenario.find(event=>event.cue.kind==='ending')!
  if(!storyProgress.seen(campaignGeneration,ending.id))
    playStories([ending],()=>button('result-toggle').focus())
}

function switchStage(index: number, showEntry = true) {
  endingPending=false
  level=index;stage=stages[level]
  const guide=unlockedGuide()
  guideActive=!!guide&&!guideSeen(guide)
  guidePlaced=undefined
  get('job-number').textContent=`依頼 ${String(level+1).padStart(2,'0')} / ${String(stages.length).padStart(2,'0')}`
  // The old placements are cleared by edit() before it rebuilds scene targets.
  measureView()
  pointer=undefined
  const job = stages[level]
  view.load(stage, stageImage(job.chapter))
  labels=targetLabels(stage,view.floors)
  floorSelection='all'
  buildFloorControls()
  updateCameraControls()
  title.textContent=stage.name
  get('location').textContent=stage.location
  get('client-name').textContent=stage.client.name
  get('client-line').textContent=`「${stage.client.quote}」`
  useOptionalImage(get<HTMLImageElement>('client-portrait'), gameArt.client(job.number))
  get<HTMLDetailsElement>('client').open=true
  hintLevel=0
  get('hint').hidden=true
  button('next-hint').disabled=false;button('next-hint').textContent='ヒントを表示'
  conditions();tabs();edit(false)
  if(stages[level].unlockedTools.length){
    const intro=stages[level].unlockedTools.map(tool=>`${tools[tool].name}を解放。 ${tools[tool].desc}`).join('。')
    message(intro)
  }
  if(storyReady&&titleScreen.hidden){
    try{localStorage.setItem(stageSaveKey(),job.id)}catch{/* Progress remains usable within this tab. */}
  }
  if(showEntry)playEntryStories()
}
function begin() {
  if(storyPlayer.open)return
  if(state==='result'){edit(true); return}
  if(state!=='edit')return
  if(anchor){message('接続先が未選択です。接続を完了するか、接続を中止してください。',true);return}
  if(!placements.length){message('先に道具を1つ以上置いてください。',true);return}
  if(costOf(placements)>stage.budget){message('予算を超えています。',true);return}
  runGeneration=campaignGeneration
  sim=new Simulation(stage,placements)
  state='running';selected=null;anchor=undefined;placementPriority=false;marks=[]
  if(guideActive&&guidePlaced&&placements.includes(guidePlaced))finishGuide()
  closeMenu();setPan(false);sceneTargets()
  setHover()
  get('outline-control').hidden=false
  get<HTMLInputElement>('outline').checked=false
  get('target-list').replaceChildren()
  get('mode').dataset.state='running';get('mode').textContent='解体中'
  get('run-text').textContent='解体中';button('run').disabled=true
  get('playback').hidden=false
  get('scene-status').textContent='解体中'
  button('pause').textContent='一時停止';button('pause').setAttribute('aria-pressed','false')
  for(const el of document.querySelectorAll<HTMLButtonElement>('[data-speed]'))el.setAttribute('aria-pressed',String(Number(el.dataset.speed)===speed))
  toolsState();meters();message('現場が静まるまで見守りましょう。')
}
function setResultOpen(open: boolean) {
  get('result').hidden = !open
  button('result-toggle').hidden = open
  button('result-toggle').textContent = '結果に戻る'
  button('result-toggle').setAttribute('aria-expanded', String(open))
  if (!open) button('result-toggle').focus()
}
function showResult(result: Result) {
  state='result';paused=false;accumulator=0
  updateGuide()
  get('mode').dataset.state='result';get('mode').textContent='結果確認'
  get('playback').hidden=true
  button('run').disabled=false;get('run-text').textContent='配置編集へ'
  button('result-toggle').hidden=false
  const id=stages[level].id
  endingPending=runGeneration===campaignGeneration
    &&storyProgress.canOfferEnding(campaignGeneration,level+1,result.success?result.stars:0)
  if(runGeneration===campaignGeneration){
    latest[id]=result.stars
    if(result.success)records[id]=Math.max(records[id]??0,result.stars)
    ++progressRead
    if(progress){
      pendingSaves.set(id,(pendingSaves.get(id)??0)+1)
      const generation=runGeneration
      void progress.save(id,result.stars,generation?0:(legacyRecords[id]??0),generation).then(saved=>{
        if(saved)updates?.postMessage(id)
      }).catch(()=>{/* Progress remains usable within this tab. */}).finally(()=>{
        if(generation===campaignGeneration){
          const pending=(pendingSaves.get(id)??1)-1
          if(pending)pendingSaves.set(id,pending)
          else pendingSaves.delete(id)
        }
        void syncProgress()
      })
    }
    tabs()
    refreshStoryMenu()
  }
  const panel=get('result')
  const heading=result.success?(level===stages.length-1?'最後の依頼、完了！':'依頼完了！'):result.timedOut?'時間切れ':'依頼未達成'
  const comment=result.success?(result.stars===3?stage.client.excellent:stage.client.pass):stage.client.fail
  const events=sim?.events ?? []
  const hits=events.filter(e => e.kind==='neighborHit'||e.kind==='safeHit').sort((a,b)=>(b.damage??0)-(a.damage??0))
  focusedImpact=hits[0]
  const key = [result.remaining.length ? '黄：残った建材' : '', hits.length ? '赤：損傷した衝突' : ''].filter(Boolean)
  get('scene-status').textContent = key.join('　') || '解体後の現場'
  const observations = [
    ...hits.slice(0,2),
    ...events.filter(e=>['wire','weight','jack','pad','blast','precise'].includes(e.kind)).slice(0,5),
    ...events.filter(e=>e.kind==='cut'||e.kind==='break').slice(0,3),
  ].sort((a,b)=>a.time-b.time)
  const advice = []
  if(result.rate < stage.goal) advice.push(remainingAdvice(result.remaining))
  if(hits[0]) advice.push(`${hits[0].time.toFixed(1)}秒、${eventText(stage,hits[0])}。${hits[0].kind==='safeHit'?'落ちた先を確認し、受け止める位置を見直せます。':'当たった側を確認し、引く方向を変えられます。'}`)
  const protection=(stage.assets??[]).map(a=>{
    const damage=result.assetDamage?.[a.id]??0
    const detail=a.tolerance?` · 損傷 ${damage.toFixed(1)} / 許容 ${a.tolerance}点`:damage>0?' · 許容外':' · 条件内'
    return `<dt>${a.name}</dt><dd>${protectionText(damage,a.tolerance)}${detail}</dd>`
  }).join('')
  const bonuses=(stage.stars??[]).map((rule,i)=>`<p class="bonus">${result.stars>=i+2?'達成':'未達成'}・★${i+2} ${ruleText(rule)}</p>`).join('')
  const failures=result.reasons.map(reason=>reason==='まだ建物が残っています。'?`解体率があと${stage.goal-result.rate}ポイント足りません。`:reason)
  const best=records[id]
  const ratings=`<p>今回 ${result.stars?`★${result.stars}`:'未達成'} ／ 最高 ${best?`★${best}`:'記録なし'}</p>`
  const next=result.success&&available(stages,level+1,records)
  const remainder=[...result.remaining].sort((a,b)=>b.mass-a.mass)
  const leftover=remainder.length?`<details class="timeline" ${result.rate<stage.goal?'open':''}><summary>解体率に入らなかった建材（${remainder.length}点）</summary><ol>${remainder.slice(0,8).map(p=>`<li>${objectName(stage,p.id)}・${remainingReasonText[p.reason]}${p.reason==='high'?`（上端 ${p.top.toFixed(1)}m ／ 基準 ${stage.height.toFixed(1)}m）`:''}</li>`).join('')}${remainder.length>8?`<li>ほか ${remainder.length-8}点</li>`:''}</ol></details>`:''
  const motion=result.timedOut?`<p>静止確認 ${result.quiet.toFixed(2)} / 1.25秒</p>${result.moving.length?`<p>最後に動いていた部材・道具</p><ul class="advice">${result.moving.slice(0,4).map(p=>`<li>${objectName(stage,p.id)}（移動 ${p.speed.toFixed(2)}m/s・回転 ${p.spin.toFixed(2)}rad/s）</li>`).join('')}</ul>`:''}`:''
  const timeline = observations.length ? `<details class="timeline"><summary>現場記録</summary><ol>${observations.map((e,i)=>`<li><button type="button" data-event="${i}"><time>${e.time.toFixed(1)}秒</time> ${eventText(stage,e)}</button></li>`).join('')}</ol></details>` : ''
  panel.innerHTML=`<h2>${heading}</h2>${result.success ? `<span class="stars" aria-label="星${result.stars}つ">${'★'.repeat(result.stars)}${'☆'.repeat(3-result.stars)}</span>` : `<p>${failures.join(' ')}</p>`}${ratings}<details class="client result-client" open><summary>${stage.client.name}</summary><p>「${comment}」</p></details><dl><dt>解体率</dt><dd>${result.rate}% / ${stage.goal}%</dd><dt>作業時間</dt><dd>${result.elapsed.toFixed(1)}秒 ／ ${result.ticks}更新</dd><dt>使用予算</dt><dd>${yen(result.cost)} / ${yen(stage.budget)}</dd><dt>使わずに済んだ予算</dt><dd>${yen(result.saved)}</dd>${protection}</dl>${bonuses}${advice.length ? `<ul class="advice">${advice.map(text=>`<li>${text}</li>`).join('')}</ul>` : ''}<div class="result-actions"><button class="button secondary" type="button" id="result-retry">配置を修正</button><button class="button secondary" type="button" id="result-inspect">現場を確認</button><button class="button secondary" type="button" id="result-repeat">同じ配置で再挑戦</button>${next?'<button class="button primary" type="button" id="result-next">次の依頼</button>':''}${endingPending?'<button class="button primary" type="button" id="result-ending">エンディングへ</button>':''}</div>${leftover}${motion}${timeline}`
  button('result-retry').addEventListener('click',()=>edit(true))
  button('result-repeat').addEventListener('click',()=>{edit(true);begin()})
  const leaveResult=()=>{
    setResultOpen(false)
    if(endingPending)playEnding()
    document.getElementById('result-ending')?.remove()
  }
  button('result-inspect').addEventListener('click',leaveResult)
  document.getElementById('result-ending')?.addEventListener('click',leaveResult)
  if(next)button('result-next').addEventListener('click',()=>switchStage(level+1))
  for (const el of panel.querySelectorAll<HTMLButtonElement>('[data-event]')) {
    el.addEventListener('click',()=>{
      focusedImpact=observations[Number(el.dataset.event)]
      get('scene-status').textContent=eventText(stage,focusedImpact)
      setResultOpen(false)
      const at=focusedImpact.at
      if(!inWorkArea(view.xy(at),-18)){
        view.camera.focus({left:at.x-3,right:at.x+3,bottom:at.y-1.25,top:at.y+1.25})
        floorSelection='custom'
        cameraChanged()
      }
    })
  }
  setResultOpen(true)
  panel.scrollTop=0
  meters();message(heading)
}
function runningNote() {
  if (!sim || sim.time - lastEventUpdate < 1.1) return
  const priority = [...sim.alerts].reverse().find(e=>e.time >= lastEventUpdate)
  const latest = priority ?? [...sim.events].reverse().find(e=>e.time >= lastEventUpdate && e.kind !== 'cut')
  if (!latest || recentEvent === latest) return
  recentEvent = latest
  lastEventUpdate = sim.time
  message(`${latest.time.toFixed(1)}秒　${eventText(stage, latest)}`)
}
function pause() {
  if(state!=='running')return
  paused=!paused;accumulator=0
  button('pause').textContent=paused?'再開':'一時停止'
  button('pause').setAttribute('aria-pressed',String(paused))
  get('scene-status').textContent=paused?'一時停止中':'解体中'
}
button('pause').addEventListener('click',pause)
for(const el of document.querySelectorAll<HTMLButtonElement>('[data-speed]'))el.addEventListener('click',()=>{
  speed=Number(el.dataset.speed)
  for(const b of document.querySelectorAll<HTMLButtonElement>('[data-speed]'))b.setAttribute('aria-pressed',String(b===el))
})
button('run').addEventListener('click',()=>begin())
button('result-toggle').addEventListener('click',()=>setResultOpen(get('result').hidden))
button('next-hint').addEventListener('click',()=>{
  get('hint').hidden=false
  get('hint').textContent=stage.hints[hintLevel++]
  button('next-hint').disabled=hintLevel >= stage.hints.length
  button('next-hint').textContent=hintLevel >= stage.hints.length?'すべて表示済み':'次のヒント'
})
button('reset').addEventListener('click',()=>edit(false))
button('help').addEventListener('click',()=>{cancelLink();dialog.showModal()})
button('close-help').addEventListener('click',()=>dialog.close())
function confirmNewGame() {
  get('new-game-error').hidden=true
  newGameDialog.showModal()
}
button('title-continue').addEventListener('click',()=>{
  enterGame()
  switchStage(resumeStage(stages,records,lastStage()),false)
  button('game-menu').focus()
})
button('title-new').addEventListener('click',()=>{
  if(hasGame()){confirmNewGame();return}
  enterGame()
  switchStage(0)
})
button('title-story').addEventListener('click',()=>{
  get('title-story-list').append(get('story-list'))
  titleStoryDialog.showModal()
  refreshStoryMenu()
})
titleStoryDialog.addEventListener('close',()=>{
  get('story-menu').append(get('story-list'))
  refreshStoryMenu()
})
button('title-options').addEventListener('click',()=>get<HTMLDialogElement>('title-options-dialog').showModal())
button('cancel-new-game').addEventListener('click',()=>newGameDialog.close())
newGameDialog.addEventListener('cancel',event=>{
  if(button('confirm-new-game').disabled)event.preventDefault()
})
button('confirm-new-game').addEventListener('click',async()=>{
  const confirm=button('confirm-new-game'), cancel=button('cancel-new-game')
  confirm.disabled=cancel.disabled=true
  try {
    if(!progress)throw new Error('Storage unavailable')
    const generation=await progress.reset()
    ++progressRead
    newGameDialog.close()
    setMenu(false)
    enterGame()
    applyNewCampaign(generation)
    void syncProgress()
    updates?.postMessage('reset')
    if(!storyPlayer.open)button('new-game').focus()
  } catch {
    const error=get('new-game-error')
    error.textContent='保存した記録を消去できませんでした。'
    error.hidden=false
  } finally {
    confirm.disabled=cancel.disabled=false
  }
})
function setMenu(open: boolean) {
  if(open)cancelLink()
  get('menu-panel').hidden = !open
  button('game-menu').setAttribute('aria-expanded',String(open))
  if(open)refreshStoryMenu()
}
button('game-menu').addEventListener('click',()=>setMenu(get('menu-panel').hidden))
function returnToTitle() {
  setMenu(false)
  edit(false)
  game.inert=true
  titleScreen.hidden=false
  refreshTitleControls()
  button(hasGame()?'title-continue':'title-new').focus()
}
button('return-title').addEventListener('click',returnToTitle)
button('new-game').addEventListener('click',returnToTitle)
button('skip-guide').addEventListener('click',()=>{
  const focus=guideTarget
  finishGuide()
  focus?.focus()
})
button('replay-guide').addEventListener('click',()=>{
  const tool=unlockedGuide()
  if(!tool||state==='running')return
  dialog.close()
  setMenu(false)
  guideActive=true
  guidePlaced=undefined
  if(state==='result')edit(true)
  else if(selected===tool)choose(tool)
  else updateGuide()
  guideTarget?.focus()
})
document.addEventListener('pointerdown',event=>{
  if (!newGameDialog.open && !(event.target as HTMLElement).closest('#menu-panel, #game-menu')) setMenu(false)
})
function setMission(open: boolean) {
  game.dataset.mission = String(open)
  get('mission-content').hidden=!open
  button('mission-toggle').setAttribute('aria-expanded',String(open))
  get('mission-toggle-label').textContent=open?'閉じる':'開く'
  resizeView()
}
button('mission-toggle').addEventListener('click',()=>setMission(get('mission-content').hidden))

function measureView() {
  const canvas = scene.getBoundingClientRect()
  const safe = get('safe-area').getBoundingClientRect()
  view.resize({x:safe.left-canvas.left, y:safe.top-canvas.top, w:safe.width, h:safe.height})
}

function resizeView() {
  measureView()
  cameraChanged()
}

function jump(value: string) {
  if (value === 'all') view.camera.fit()
  else {
    const band = value==='roof' ? view.floors.at(-1) : view.floors[Number(value)-1]
    if (!band) return
    view.camera.focus(value==='roof' ? { ...band, bottom:band.top-1, top:band.top+1.3 } : band)
  }
  floorSelection=value
  cameraChanged()
}
function buildFloorControls() {
  const options = view.floors.map(b=>({value:String(b.number),label:`${b.number}F`}))
  const many = options.length>4
  const buttons = get('floor-buttons')
  buttons.replaceChildren()
  floorSelect.replaceChildren()
  buttons.hidden=many
  floorSelect.hidden=!many
  get('floor-controls').hidden=!options.length
  if(many){
    floorSelect.replaceChildren(...[{value:'all',label:'全体'},...options,{value:'roof',label:'屋上'}].map(o=>new Option(o.label,o.value)))
  }else{
    buttons.replaceChildren(...[...options,{value:'all',label:'全体'}].map(o=>{
      const el=document.createElement('button')
      el.type='button'
      el.dataset.floor=o.value
      el.textContent=o.label
      el.addEventListener('click',()=>jump(o.value))
      return el
    }))
  }
}
floorSelect.addEventListener('change',()=>jump(floorSelect.value))
function pointerAt(event: MouseEvent): Point {
  const box = view.canvas.getBoundingClientRect()
  return { x: (event.clientX - box.left) * view.w / box.width, y: (event.clientY - box.top) * view.h / box.height }
}
function updateCameraControls() {
  get('zoom-level').textContent = `${Math.round(view.camera.zoom * 100)}%`
  button('zoom-in').disabled = view.camera.zoom >= view.camera.maxZoom
  button('zoom-out').disabled = view.camera.zoom <= view.camera.minZoom
  for (const el of document.querySelectorAll<HTMLButtonElement>('[data-floor]')) el.setAttribute('aria-pressed',String(el.dataset.floor===floorSelection))
  if(!floorSelect.hidden) {
    if(floorSelection==='custom' && !floorSelect.querySelector('[value=custom]')) {
      const custom=new Option('手動表示','custom')
      custom.disabled=true
      floorSelect.add(custom,0)
    }
    floorSelect.value=floorSelection
  }
}
function cameraChanged() {
  updateCameraControls()
  pointer=undefined
  if (state === 'edit') sceneTargets()
}
function setPan(enabled: boolean) {
  panMode = enabled
  scene.dataset.pan = String(enabled)
  button('pan').setAttribute('aria-pressed', String(enabled))
}
function zoomBy(factor: number, at: Point = view.camera.screenCenter) {
  view.camera.zoomAt(at,factor)
  floorSelection='custom'
  cameraChanged()
}
button('zoom-in').addEventListener('click',()=>zoomBy(1.25))
button('zoom-out').addEventListener('click',()=>zoomBy(1/1.25))
button('fit').addEventListener('click',()=>jump('all'))
button('pan').addEventListener('click',()=>{
  closeMenu()
  setPan(!panMode)
  if (panMode) {cancelLink();message('現場をドラッグして移動。もう一度「移動」を押すと道具操作に戻ります。')}
  else if (state==='edit') message(selected ? tools[selected].hint : sceneStatus)
  updateGuide()
})
button('placement-priority').addEventListener('click',()=>{
  if (state !== 'edit' || !selected) return
  closeMenu();setPan(false)
  placementPriority = !placementPriority
  sceneTargets()
  message(placementPriority ? '重なった印を優先します。もう一度押すと道具を優先します。' : tools[selected].hint)
})
button('remove-equipment').addEventListener('click',removeEquipment)
button('close-equipment').addEventListener('click',()=>closeMenu(true))
scene.addEventListener('wheel',event=>{
  if ((event.target as HTMLElement).closest('#result, #equipment-menu') || event.ctrlKey) return
  event.preventDefault()
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.h : 1)
  zoomBy(Math.exp(-Math.max(-390,Math.min(390,delta))*.002),pointerAt(event))
}, {passive:false})
scene.addEventListener('pointerdown',event=>{
  if ((event.target as HTMLElement).closest('#result, #equipment-menu')) return
  if (event.button !== 1 && !(panMode && event.button === 0)) return
  event.preventDefault()
  closeMenu()
  drag = { pointerId: event.pointerId, at: pointerAt(event) }
  scene.dataset.dragging = 'true'
  scene.setPointerCapture(event.pointerId)
})
scene.addEventListener('pointermove',event=>{
  if (drag?.pointerId !== event.pointerId) {
    pointer=undefined
    if(state==='edit'&&selected&&!panMode&&event.target===view.canvas){
      const p=pointerAt(event)
      pointer=view.camera.world(p)
      setHover(nearbyTarget(p,screenTargets))
    }
    return
  }
  const at = pointerAt(event)
  view.camera.panBy({x:at.x-drag.at.x,y:at.y-drag.at.y})
  drag.at = at
  floorSelection='custom'
  cameraChanged()
})
for (const type of ['pointerup','pointercancel','lostpointercapture']) {
  scene.addEventListener(type,event=>{
    if ((event as PointerEvent).pointerId !== drag?.pointerId) return
    drag = undefined
    delete scene.dataset.dragging
  })
}
scene.addEventListener('auxclick',event=>{if(event.button===1)event.preventDefault()})
function cancelLink() {
  if(!anchor)return
  anchor=undefined
  pointer=undefined
  sceneTargets()
  message('接続を中止しました。固定点から選び直せます。')
}
button('cancel-link').addEventListener('click',cancelLink)
scene.addEventListener('pointerleave',()=>{pointer=undefined;setHover()})
view.canvas.addEventListener('click',event=>{
  closeMenu()
  if(state!=='edit'||!selected||panMode)return
  const p=pointerAt(event)
  const target=nearbyTarget(p,screenTargets)
  if(target){place(target.id);return}
  const invalid=nearbyTarget(p,stage.points.filter(t=>inWorkArea(view.xy(t))).map(t=>({point:view.xy(t),item:t})),14)
  if(anchor&&invalid){
    const error=placementError(stage,placements,{tool:selected,target:invalid.id,anchor})
    if(error){message(error,true);return}
  }
  message(anchor?'接続先を選べません。光っている対象の印をクリックしてください。':'設置点から外れています。光っている印を選んでください。',true)
})
window.addEventListener('keydown',event=>{
  if(!titleScreen.hidden||storyPlayer.open||dialog.open||newGameDialog.open||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return
  if(event.key==='Escape'){
    if(!get('menu-panel').hidden){setMenu(false);button('game-menu').focus();return}
    if(inspected!==null){closeMenu(true);return}
    if(panMode){setPan(false);updateGuide();return}
    if(anchor){cancelLink();return}
    if(state==='edit'){selected=null;anchor=undefined;placementPriority=false;refreshEdit(sceneStatus)}
    return
  }
  if(event.key==='Delete'&&inspected!==null){event.preventDefault();removeEquipment();return}
  if(event.target instanceof HTMLSelectElement)return
  const digit=Number(event.key)
  if(digit>=1&&digit<=toolNames.length)choose(toolNames[digit-1])
  if(event.code==='Space'&&state==='running'&&!(event.target instanceof HTMLButtonElement)){event.preventDefault();pause()}
})
document.addEventListener('visibilitychange',()=>{accumulator=0;last=performance.now()})
const resize = new ResizeObserver(resizeView)
resize.observe(scene)
resize.observe(get('safe-area'))
window.addEventListener('resize',resizeView)
function frame(now: number) {
  const elapsed=Math.min(.25,(now-last)/1000)
  last=now
  if(sim&&state==='running'&&!paused&&!document.hidden&&!storyPlayer.open){
    accumulator=Math.min(.5,accumulator+elapsed*speed)
    for(let i=0;i<16&&accumulator>=dt&&!sim.result;i++){sim.step();accumulator-=dt}
    if(now-lastMetric>=100){meters();runningNote();lastMetric=now}
    if(sim.result)showResult(sim.result)
  }
  view.draw(stage,sim,placements,marks,stage.points.find(p=>p.id===anchor),inspected,{
    hovered: hoveredEquipment===null?hovered??guidePreview:undefined, hoveredEquipment, pointer, placementPriority:placementPriority||(selected==='wire'&&!!anchor), tool: selected, outline: get<HTMLInputElement>('outline').checked, focused: focusedImpact,
  })
  requestAnimationFrame(frame)
}
setMission(!matchMedia('(max-width:850px)').matches)
switchStage(0)
void syncProgress().finally(()=>{
  storyProgress.migrate(campaignGeneration,records,latest,guideSeen('cut'))
  storyReady=true
  refreshStoryMenu()
  refreshTitleControls()
  updateGuide()
})
requestAnimationFrame(frame)
