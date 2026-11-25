import { architecture, districtSky, scenery } from './architecture.ts'
import { burstJoints, burstReach, bursts, isBurst, type Burst } from './bursts.ts'
import { floorBands, type FloorBand } from './floors.ts'
import { Camera, stageBounds, type ScreenArea } from './camera.ts'
import { equipment } from './equipment.ts'
import { type Simulation, type SiteEvent } from './physics.ts'
import { materials, padWidth, type Member, type Placement, type Point, type Stage, type Tool } from './stages.ts'

const anchorLabel = '#85a9a4'
const timber = '#e2ac78'
type Mark = { id: string; at: Point; source?: Point; label: string }
export type { Mark }

export class View {
  private context: CanvasRenderingContext2D
  private backdrop?: HTMLImageElement
  readonly camera = new Camera()
  floors: FloorBand[] = []
  readonly canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.context = canvas.getContext('2d')!
  }

  get w() { return this.camera.width }
  get h() { return this.camera.height }
  get scale() { return this.camera.scale }
  get originY() { return this.xy({ x: 0, y: 0 }).y }

  resize(area: ScreenArea) {
    this.camera.resize(this.canvas.clientWidth, this.canvas.clientHeight, area)
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    const width = Math.round(this.w * ratio)
    const height = Math.round(this.h * ratio)
    if (this.canvas.width !== width) this.canvas.width = width
    if (this.canvas.height !== height) this.canvas.height = height
  }

  load(stage: Stage, backdrop?: HTMLImageElement) {
    this.backdrop = backdrop
    this.floors = floorBands(stage)
    this.camera.fit(stageBounds(stage))
  }
  xy(p: Point): Point { return this.camera.screen(p) }

  private line(c: CanvasRenderingContext2D, a: Point, b: Point) {
    const p = this.xy(a), q = this.xy(b)
    c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x,q.y); c.stroke()
  }

  private background(stage: Stage, sim: Simulation | null) {
    const c = this.context
    const sky = c.createLinearGradient(0, 0, 0, this.h)
    const look=architecture(stage)
    const palette=look?districtSky[look.district]:['#263842','#344952']
    sky.addColorStop(0,palette[0]);sky.addColorStop(1,palette[1])
    c.fillStyle = sky; c.fillRect(0, 0, this.w, this.h)
    const image = this.backdrop
    if (image?.complete && image.naturalWidth && this.w > 0 && this.h > 0) {
      const skylineBase = Math.round(this.h * .65)
      const scale = Math.max(this.w / image.naturalWidth, skylineBase / image.naturalHeight)
      const width = image.naturalWidth * scale, height = image.naturalHeight * scale
      const left = (this.w - width) / 2
      c.save()
      c.globalAlpha = .32
      c.drawImage(image, left, skylineBase - height, width, height)
      // Extend the bottom edge behind the ground as the camera moves.
      c.drawImage(image, 0, image.naturalHeight - 1, image.naturalWidth, 1,
        left, skylineBase, width, this.h - skylineBase)
      c.restore()
    } else if(look){
      c.fillStyle='#101c2747'
      const district=look.district
      for(let i=-5;i<=5;i++){
        const x=i*3.7+district*.27, w=district>=3?2.8:2.1
        const h=(district>=3?2.2:1.0)+((i*i+district*3)%5)*(district>=3?.63:.29)
        const a=this.xy({x,y:h})
        c.fillRect(a.x,a.y,w*this.scale,h*this.scale)
        if(district<3){
          const b=this.xy({x:x+w*.54,y:h+.62}), d=this.xy({x:x+w,y:h})
          c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineTo(d.x,d.y);c.fill()
        }
      }
    }
    const upperLeft = this.camera.world({x:0,y:0})
    const lowerRight = this.camera.world({x:this.w,y:this.h})
    let gridUnit = .5
    while (gridUnit * this.scale < 14) gridUnit *= 2
    c.lineWidth = 1
    for (let i = Math.floor(upperLeft.x / gridUnit); i * gridUnit <= lowerRight.x; i++) {
      const x = Math.round(this.xy({x:i*gridUnit,y:0}).x) + .5
      c.strokeStyle = i % 4 === 0 ? '#78949b36' : '#6c899624'
      c.beginPath(); c.moveTo(x,0); c.lineTo(x,this.h); c.stroke()
    }
    for (let i = Math.floor(lowerRight.y / gridUnit); i * gridUnit <= upperLeft.y; i++) {
      const y = Math.round(this.xy({x:0,y:i*gridUnit}).y) + .5
      c.strokeStyle = i % 4 === 0 ? '#78949b36' : '#6c899624'
      c.beginPath(); c.moveTo(0,y); c.lineTo(this.w,y); c.stroke()
    }
    const ground = Math.max(0, this.originY)
    if (ground < this.h) {
      c.fillStyle = '#25343a'; c.fillRect(0,ground,this.w,this.h-ground)
      c.strokeStyle = '#384b51'; c.lineWidth = 1
      for (let x = ground - this.h; x < this.w + 13; x += 13) {
        c.beginPath(); c.moveTo(x,this.h); c.lineTo(x + this.h - ground,ground); c.stroke()
      }
      if (this.originY >= 0) {
        c.strokeStyle = '#8ca8a6'; c.lineWidth = 1.2
        c.beginPath(); c.moveTo(0,this.originY); c.lineTo(this.w,this.originY); c.stroke()
      }
    }
    const left = this.xy({x:-stage.width,y:0}).x
    const right = this.xy({x:stage.width,y:0}).x
    c.fillStyle = '#93aaa0'; c.fillRect(left,this.originY-1,right-left,2)
    if(look){
      c.strokeStyle=look.district===4?'#a8bb8766':'#e6c39265';c.lineWidth=2
      c.setLineDash(look.district<2?[4,6]:[12,8])
      this.line(c,{x:-24,y:-.33},{x:24,y:-.33});c.setLineDash([])
      for(const side of [-1,1]){
        const x=side*(stage.width+.9)
        const h=look.district===4?1.25:look.district===2?2.5:3.1
        this.line(c,{x,y:0},{x,y:h})
        this.line(c,{x,y:h},{x:x-side*.65,y:h+(look.district===4?-.12:.1)})
      }
    }
    c.font = '600 10px monospace'; c.fillStyle = '#bdd2cc'; c.textAlign = 'left'
    c.fillText('SITE SECTION / A–A', this.camera.area.x + 9, this.camera.area.y + 16)
    if(this.originY > 30 && this.originY < this.h){c.textAlign = 'right'; c.fillText('GROUND ±0.00', this.camera.area.x + this.camera.area.w - 9, this.originY - 10)}
    c.textAlign = 'left'
    let ruler = 2
    while (ruler * this.scale > 103) ruler /= 2
    while (ruler * this.scale < 32) ruler *= 2
    const scaleX = this.camera.area.x + 10, scaleY = this.camera.area.y + 34, scaleW = this.scale * ruler
    c.strokeStyle = '#9bb6b3'; c.lineWidth = 1
    c.beginPath(); c.moveTo(scaleX, scaleY-3); c.lineTo(scaleX,scaleY+3); c.moveTo(scaleX,scaleY); c.lineTo(scaleX+scaleW,scaleY); c.lineTo(scaleX+scaleW,scaleY-3); c.lineTo(scaleX+scaleW,scaleY+3); c.stroke()
    c.fillText(`${ruler} m`, scaleX + scaleW + 6, scaleY+3)
    for(const asset of stage.assets ?? []) {
      const o=asset.obstacle
      if(!o)continue
      const damaged=(sim?.assetDamage[asset.id]??0)>asset.tolerance
      if(o.style==='house')this.neighbor(c,o.x,asset.name,damaged)
      else {
        const a=this.xy({x:o.x-o.w/2,y:o.y+o.h/2}), b=this.xy({x:o.x+o.w/2,y:o.y-o.h/2})
        c.fillStyle=damaged?'#985849':'#527b70';c.strokeStyle=damaged?'#ff9d8b':'#a7d0bb'
        c.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);c.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y)
        c.fillStyle=damaged?'#ffb098':'#c9ece0';c.font='700 12px sans-serif';c.textAlign='center'
        c.fillText(asset.name,(a.x+b.x)/2,a.y-8);c.textAlign='left'
      }
    }
    if (stage.protection === 'neighbor' || stage.assets?.some(a=>a.obstacle)) {
      if(!stage.assets)for (const x of stage.neighborX ?? [-10.26, 10.26]) this.neighbor(c, x)
      c.setLineDash([5,5]); c.strokeStyle = '#ddbd81a0'
      for (const x of [-stage.width, stage.width]) this.line(c,{x,y:0},{x,y:5.7})
      c.setLineDash([])
    }
  }

  private neighbor(c: CanvasRenderingContext2D, x: number, label='保護対象', damaged=false) {
    const a = this.xy({x:x-2.15,y:3.44}), b = this.xy({x:x+2.15,y:0})
    const w = b.x-a.x, h = b.y-a.y
    c.fillStyle = damaged?'#694a43':'#375050'; c.strokeStyle = damaged?'#f1a18d':'#91ada4'; c.lineWidth = 1.2
    c.fillRect(a.x,a.y,w,h); c.strokeRect(a.x,a.y,w,h)
    c.setLineDash([4,4])
    c.beginPath(); c.moveTo(a.x-4,a.y); c.lineTo((a.x+b.x)/2,a.y-this.scale*.85); c.lineTo(b.x+4,a.y); c.stroke()
    c.setLineDash([])
    c.fillStyle = '#263e41'
    for(const xx of [.17,.61]) { c.fillRect(a.x+w*xx,a.y+h*.24,w*.22,h*.26); c.strokeRect(a.x+w*xx,a.y+h*.24,w*.22,h*.26) }
    c.fillRect(a.x+w*.45,a.y+h*.63,w*.18,h*.37);c.strokeRect(a.x+w*.45,a.y+h*.63,w*.18,h*.37)
    c.fillStyle = '#c6dbd1'; c.font = '700 12px sans-serif'; c.textAlign = 'center'; c.fillText(label, (a.x+b.x)/2,a.y-9); c.textAlign='left'
  }

  private shell(stage: Stage) {
    const c = this.context
    const levels = this.floors
    if (!levels.length) return
    const site=scenery(stage,levels)
    if(site){this.facade(site);return}
    const base = levels[0].bottom
    const roof = levels.at(-1)!.top
    const left = Math.min(...levels.map(b=>b.left))
    const right = Math.max(...levels.map(b=>b.right))
    const width = right-left
    if (width <= 0) return
    const roofLeft=stage.roof==='flat'?levels.at(-1)!.left:left
    const roofRight=stage.roof==='flat'?levels.at(-1)!.right:right
    const roofShape=stage.roof==='flat'
      ? [{x:roofLeft-.18,y:roof},{x:roofLeft-.18,y:roof+.24},{x:roofRight+.18,y:roof+.24},{x:roofRight+.18,y:roof}]
      : [{x:left-.42,y:roof-.04},{x:(left+right)/2,y:roof+1.1},{x:right+.42,y:roof-.04}]
    const a = this.xy({x:left,y:roof}), b = this.xy({x:right,y:base})
    c.fillStyle='#e1c9aa13'
    if(stage.roof!=='flat')c.fillRect(a.x,a.y,b.x-a.x,b.y-a.y)
    else for(const band of levels){
      const p=this.xy({x:band.left,y:band.top})
      c.fillRect(p.x,p.y,(band.right-band.left)*this.scale,(band.top-band.bottom)*this.scale)
    }
    c.beginPath()
    roofShape.forEach((p,i)=>{const {x,y}=this.xy(p);if(i)c.lineTo(x,y);else c.moveTo(x,y)})
    c.closePath();c.fillStyle='#526765';c.fill();c.strokeStyle='#a4b0a0';c.lineWidth=1.3;c.stroke()
    for (const [i,band] of levels.entries()) {
      const {top,bottom:low}=band
      const story=top-low
      if(story<=0) continue
      const screen=this.xy({x:left,y:top})
      if(screen.y>this.h || screen.y+story*this.scale<0) continue
      const h=story*.38*this.scale, w=(band.right-band.left)*.15*this.scale
      for(const column of [.24,.76]){
        const span=band.right-band.left
        const p=this.xy({x:band.left+span*column-span*.075,y:low+story*.63})
        c.fillStyle='#83aca026';c.strokeStyle='#99b3a470';c.lineWidth=1
        c.fillRect(p.x,p.y,w,h);c.strokeRect(p.x,p.y,w,h)
        c.beginPath();c.moveTo(p.x+w/2,p.y);c.lineTo(p.x+w/2,p.y+h);c.moveTo(p.x,p.y+h/2);c.lineTo(p.x+w,p.y+h/2);c.stroke()
      }
      if(i<levels.length-1){
        c.strokeStyle='#c4ab8968';c.lineWidth=1
        for(let step=0;step<8;step++){
          const x=left+width*(.28+step*.031), y=low+story*(.08+step*.109)
          this.line(c,{x,y},{x:x+width*.031,y})
          this.line(c,{x:x+width*.031,y},{x:x+width*.031,y:y+story*.109})
        }
      }
      const label=this.xy({x:left-.7,y:low+story*.34})
      c.font='600 10px monospace';c.fillStyle='#b5c8c1'
      if(label.x>18)c.fillText(`${i+1}F`,label.x-12,label.y)
    }
  }

  private supports(stage: Stage) {
    const c = this.context
    for (const j of stage.joints.filter(j=>j.kind==='foot')) {
      const p = this.xy(j), d = this.scale
      c.fillStyle='#536967';c.strokeStyle='#90a6a0';c.lineWidth=1
      c.beginPath();c.moveTo(p.x-.47*d,this.originY);c.lineTo(p.x-.36*d,p.y);c.lineTo(p.x-.04*d,p.y);c.lineTo(p.x-.15*d,this.originY);c.closePath();c.fill();c.stroke()
      c.fillStyle='#81928a';c.fillRect(p.x-.53*d,this.originY-3,.51*d,3)
    }
  }

  private part(m: Member, at: Point, angle: number, damage: number, counted: boolean, debug: boolean) {
    const c = this.context
    const p = this.xy(at), w = m.w*this.scale, h = m.h*this.scale
    c.save();c.translate(p.x,p.y);c.rotate(-angle)
    c.fillStyle=m.tint ?? (m.kind==='floor'?'#b68b66':materials[m.material].color)
    c.strokeStyle=damage>.46?'#e7a16e':m.kind==='safe'?'#accbbc':m.kind==='furniture'?'#d4b89a':timber
    c.lineWidth=m.kind==='floor' ? 1 : 1.25
    c.fillRect(-w/2,-h/2,w,h); c.strokeRect(-w/2,-h/2,w,h)
    if(m.kind==='post'||m.kind==='beam'){
      c.strokeStyle='#6a413a77';c.lineWidth=.8
      c.beginPath()
      if(m.kind==='post'){c.moveTo(-w*.15,-h*.48);c.lineTo(-w*.23,h*.4)}
      else{c.moveTo(-w*.48,h*.22);c.lineTo(w*.4,h*.1)}
      c.stroke()
    }
    if (m.id==='couch') {
      c.strokeStyle='#f3bb88';c.beginPath();c.moveTo(-w*.38,-h*.27);c.lineTo(-w*.38,h*.15);c.lineTo(w*.38,h*.15);c.lineTo(w*.38,-h*.27);c.moveTo(0,-h*.29);c.lineTo(0,h*.14);c.stroke()
    }
    if (m.id==='cabinet' || m.id==='crate') {
      c.strokeStyle='#d8c59b';c.strokeRect(-w*.35,-h*.37,w*.7,h*.74)
      c.beginPath();c.moveTo(w*.08,-h*.23);c.lineTo(w*.29,-h*.23);c.moveTo(w*.08,h*.22);c.lineTo(w*.29,h*.22);c.stroke()
    }
    if(m.kind==='safe'){
      c.strokeStyle='#cbe2d1';c.strokeRect(-w*.34,-h*.37,w*.68,h*.74)
      c.beginPath();c.arc(0,0,Math.min(w,h)*.17,0,Math.PI*2);c.stroke()
      c.beginPath();c.moveTo(-w*.17,0);c.lineTo(w*.17,0);c.moveTo(0,-w*.17);c.lineTo(0,w*.17);c.stroke()
    }
    if(damage>.28){
      c.strokeStyle='#572d28';c.beginPath();c.moveTo(-w*.17,-h*.48);c.lineTo(w*.1,-h*.15);c.lineTo(-w*.11,h*.08);c.lineTo(w*.17,h*.43);c.stroke()
    }
    if(debug&&counted){c.strokeStyle='#9bf0be';c.lineWidth=2;c.strokeRect(-w/2,-h/2,w,h)}
    c.restore()
  }

  private point(at: Point, color: string, radius: number, solid: boolean) {
    const c=this.context, p=this.xy(at)
    c.beginPath();c.arc(p.x,p.y,radius,0,Math.PI*2);c.fillStyle=solid?color:'#263a41';c.strokeStyle=color;c.lineWidth=1.55;c.fill();c.stroke()
  }

  private facade(site: NonNullable<ReturnType<typeof scenery>>) {
    const c=this.context
    const {look,first,roof}=site
    const early=['porch','tiles','lattice'].includes(look.motif)
    const rect=(x:number,y:number,w:number,h:number,fill:boolean)=>{
      const p=this.xy({x,y:y+h})
      if(fill)c.fillRect(p.x,p.y,w*this.scale,h*this.scale)
      else c.strokeRect(p.x,p.y,w*this.scale,h*this.scale)
    }
    c.fillStyle=look.exterior+'31';c.strokeStyle=look.trim+'88';c.lineWidth=1.3
    for(const [i,f] of this.floors.entries()){
      const w=f.right-f.left,h=f.top-f.bottom, x=f.left,y=f.bottom
      if(w<=0||h<=0)continue
      const {y:sy}=this.xy({x,y:f.top})
      if(sy>this.h||sy+h*this.scale<0)continue
      rect(x,y,w,h,true)
      if(early){
        this.houseFacade(f,i,look,rect)
        continue
      }
      const rail=['stairs','balcony','atrium','tower'].includes(look.motif)
      const open=['factory','shutter','ramp','atrium','tower'].includes(look.motif)
      if(rail){
        const start=look.motif==='stairs'?.48:.08
        rect(x+w*start,y+h*.11,w*(.92-start),h*.19,false)
        for(let post=1;post<8;post++){
          const q=x+w*(start+post*(.92-start)/8)
          this.line(c,{x:q,y:y+h*.11},{x:q,y:y+h*.30})
        }
      }
      const lanes=look.motif==='narrow'?1:['lattice','bank','balcony','tower'].includes(look.motif)?3:2
      for(let k=0;k<lanes;k++){
        const start=x+w*(k+.5)/lanes
        const width=w*(look.motif==='shutter'?.33:look.motif==='lattice'?.19:.22)
        const low=y+h*(open?.18:.33), height=h*(open?.60:.49)
        if(!(look.motif==='tower'&&k===Math.floor(lanes/2))&&!(look.motif==='atrium'&&i>0&&k===0)){
          rect(start-width/2,low,width,height,false)
          if(look.motif==='shutter'||look.motif==='factory'){
            for(let j=1;j<5;j++)this.line(c,{x:start-width/2,y:low+j*height/5},{x:start+width/2,y:low+j*height/5})
          }else if(look.motif!=='ramp'){
            this.line(c,{x:start,y:low},{x:start,y:low+height})
          }
        }
      }
      if(look.motif==='stairs'||look.motif==='ramp'){
        const a={x:x+w*.08,y:y+h*.15},b={x:x+w*.8,y:y+h*.78}
        this.line(c,a,b);this.line(c,{...a,y:a.y+h*.12},{...b,y:b.y+h*.12})
      }
      const label=this.xy({x:x-.35,y:y+h*.48})
      c.font='700 10px monospace';c.fillStyle='#c3d2cb';c.fillText(`${i+1}F`,label.x-13,label.y)
      c.fillStyle=look.exterior+'31'
    }
    c.beginPath()
    for(const [i,p] of roof.entries()){const q=this.xy(p);if(i)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y)}
    c.closePath();c.fillStyle=look.roof;c.fill();c.strokeStyle=look.trim;c.stroke()
    const {left,right,bottom}=first,w=right-left
    if(early){
      c.save();c.clip()
      const a=roof[0],b=roof.at(-1)!,top=Math.max(...roof.map(p=>p.y))
      c.strokeStyle=look.trim+'73';c.lineWidth=1
      for(let y=a.y+.15;y<top;y+=look.motif==='lattice'?.16:.21){
        this.line(c,{x:a.x,y},{x:b.x,y})
      }
      if(look.motif==='tiles'){
        for(let x=a.x;x<b.x;x+=.42)this.line(c,{x,y:a.y},{x:x+.27,y:top})
      }
      c.restore()
      c.strokeStyle=look.trim+'a4';c.fillStyle='#314445'
      if(look.motif==='porch'){
        rect(left-.32,bottom-.06,w+.64,.23,false)
        rect(left-.75,.20,1.14,.18,true);rect(left-.75,.20,1.14,.18,false)
        rect(left-.61,.04,.11,.16,false);rect(left+.14,.04,.11,.16,false)
      }else if(look.motif==='tiles'){
        rect(right+.24,.03,.51,1.02,true);rect(right+.24,.03,.51,1.02,false)
        rect(right+.17,1.05,.66,.28,true);rect(right+.17,1.05,.66,.28,false)
      }else{
        rect(left-1.05,.04,.72,.27,true);rect(left-1.05,.04,.72,.27,false)
        rect(left-1.11,.31,.84,.12,false)
      }
    }
    if(look.motif==='awning'){
      c.fillStyle=look.trim+'70'
      rect(left-.22,bottom+1.45,w+.44,.41,true)
      for(let i=0;i<9;i+=2){c.fillStyle='#674b4c';rect(left+w*i/9,bottom+1.46,w/9,.39,true)}
    }
    if(look.motif==='bank'||look.motif==='awning'||look.motif==='ramp'||look.motif==='factory'){
      const label=this.xy({x:(left+right)/2,y:first.top-.30})
      c.textAlign='center';c.font='700 12px sans-serif';c.fillStyle=look.trim
      c.fillText(look.feature,label.x,label.y);c.textAlign='left'
    }
  }

  private houseFacade(f: FloorBand,i: number,look: NonNullable<ReturnType<typeof scenery>>['look'],
    rect: (x:number,y:number,w:number,h:number,fill:boolean)=>void) {
    const c=this.context, {left:x,bottom:y}=f, w=f.right-x,h=f.top-y
    c.save()
    c.strokeStyle=look.trim+'79'
    if(look.motif==='porch'){
      for(let row=1;row<8;row++)this.line(c,{x,y:y+h*row/8},{x:x+w,y:y+h*row/8})
      c.fillStyle='#3f5047';rect(x+w*.14,y+h*.29,w*.43,h*.46,true)
      rect(x+w*.14,y+h*.29,w*.43,h*.46,false)
      for(let j=1;j<4;j++)this.line(c,{x:x+w*(.14+.43*j/4),y:y+h*.29},{x:x+w*(.14+.43*j/4),y:y+h*.75})
    }else if(look.motif==='tiles'){
      for(const u of [.20,.62]){
        c.fillStyle='#37556a';rect(x+w*u,y+h*.32,w*.19,h*.50,true)
        rect(x+w*u,y+h*.32,w*.19,h*.50,false)
        this.line(c,{x:x+w*(u+.095),y:y+h*.32},{x:x+w*(u+.095),y:y+h*.82})
      }
      if(i===1){
        c.strokeStyle='#9abec2';rect(x+w*.49,y+h*.11,w*.44,h*.23,false)
        for(let j=1;j<8;j++)this.line(c,{x:x+w*(.49+.44*j/8),y:y+h*.11},{x:x+w*(.49+.44*j/8),y:y+h*.34})
      }
    }else{
      c.fillStyle='#544a37';rect(x+w*.32,y+h*.20,w*.36,h*.60,true)
      rect(x+w*.32,y+h*.20,w*.36,h*.60,false)
      for(let j=1;j<8;j++)this.line(c,{x:x+w*(.32+.36*j/8),y:y+h*.20},{x:x+w*(.32+.36*j/8),y:y+h*.80})
      this.line(c,{x:x+w*.32,y:y+h*.52},{x:x+w*.68,y:y+h*.52})
      this.line(c,{x,y:y+h*.86},{x:x+w,y:y+h*.86})
    }
    const label=this.xy({x:x-.35,y:y+h*.48})
    c.font='700 10px monospace';c.fillStyle='#c3d2cb';c.fillText(`${i+1}F`,label.x-13,label.y)
    c.restore()
  }

  private burstPreview(stage: Stage, at: Point, tool: Burst) {
    const c=this.context, {range,color}=bursts[tool], screen=this.xy(at)
    c.strokeStyle=color;c.fillStyle=color+'28';c.lineWidth=2;c.setLineDash([6,4])
    c.beginPath();c.arc(screen.x,screen.y,range*this.scale,0,Math.PI*2);c.fill();c.stroke();c.setLineDash([])
    for(const joint of burstJoints(stage,at,tool))this.point(joint,color,5,true)
    for(const asset of stage.assets??[]){
      const shape=asset.obstacle??stage.members.find(m=>m.id===asset.body)
      if(shape&&burstReach(at,shape,tool)>0)this.rectangle(shape,shape,'angle' in shape?shape.angle:0,'#ff8e84',2.4)
    }
  }

  private preview(stage: Stage, placements: Placement[], selected: number | null, hovered: number | null) {
    const c=this.context
    for(const [i,p] of placements.entries()){
      const {at,anchor,size} = equipment(stage,p)
      const active = i===selected || i===hovered
      const color = active ? '#fff0ae' : '#ffb668'
      const a = this.xy(at)
      c.strokeStyle=color;c.lineWidth=active?3:2
      if(anchor){
        this.line(c,anchor,at)
        this.point(anchor,color,active?5:3,true)
        if(p.tool==='jack'){
          const start=this.xy(anchor)
          c.strokeRect(a.x-4,Math.min(a.y,start.y),8,Math.abs(start.y-a.y))
        }
      }
      if(isBurst(p.tool)){
        const color=bursts[p.tool].color
        if(active)this.burstPreview(stage,at,p.tool)
        c.strokeStyle=color;c.fillStyle='#27383e';c.lineWidth=2
        c.beginPath();c.moveTo(a.x,a.y-10);c.lineTo(a.x+9,a.y);c.lineTo(a.x,a.y+10);c.lineTo(a.x-9,a.y);c.closePath();c.fill();c.stroke()
        if(p.tool==='blast')this.point(at,color,3,true)
      }else if(p.tool==='cut'){
        c.beginPath();c.moveTo(a.x-6,a.y-6);c.lineTo(a.x+6,a.y+6);c.moveTo(a.x+6,a.y-6);c.lineTo(a.x-6,a.y+6);c.stroke()
        if(active)this.point(at,color,11,false)
      }else if(size){
        const w=Math.max(15,size.x*this.scale), h=Math.max(8,size.y*this.scale)
        c.fillStyle=active?'#fff0ae':'#f7b567'
        c.fillRect(a.x-w/2,a.y-h/2,w,h);c.strokeRect(a.x-w/2,a.y-h/2,w,h)
      }else this.point(at,color,active?6:4,true)
    }
  }

  private rectangle(m: Pick<Member,'w'|'h'>, p: Point, angle: number, color: string, pad: number) {
    const c = this.context
    const at = this.xy(p)
    c.save();c.translate(at.x,at.y);c.rotate(-angle)
    const w=m.w*this.scale+pad*2, h=m.h*this.scale+pad*2
    c.lineWidth=2;c.strokeStyle=color;c.strokeRect(-w/2,-h/2,w,h)
    c.restore()
  }

  private arrow(a: Point, b: Point, color: string) {
    const c=this.context
    const p=this.xy(a), q=this.xy(b)
    const angle=Math.atan2(q.y-p.y,q.x-p.x)
    c.strokeStyle=color;c.lineWidth=2.1
    this.line(c,a,b)
    c.beginPath();c.moveTo(q.x-9*Math.cos(angle-.46),q.y-9*Math.sin(angle-.46))
    c.lineTo(q.x,q.y);c.lineTo(q.x-9*Math.cos(angle+.46),q.y-9*Math.sin(angle+.46));c.stroke()
  }

  private hover(stage: Stage, mark: Mark, tool: Tool | null, anchor: Point | undefined) {
    const c=this.context
    const at=mark.source ?? mark.at
    if(isBurst(tool)){this.burstPreview(stage,at,tool);return}
    const joint=stage.joints.find(j=>j.id===mark.id)
    const spot=stage.points.find(p=>p.id===mark.id)
    const targets=tool==='cut'&&joint ? [joint.a, joint.b] : spot?.body ? [spot.body] : []
    for(const id of targets){
      const m=stage.members.find(part=>part.id===id)
      if(m)this.rectangle(m,m,m.angle,'#f6cf8c',2)
    }
    const gold='#ffce81'
    if(tool==='weight'){
      const box=this.xy({x:at.x,y:at.y+.27})
      c.fillStyle='#ffce8152';c.strokeStyle=gold;c.lineWidth=1.4
      c.fillRect(box.x-.37*this.scale,box.y-.24*this.scale,.74*this.scale,.48*this.scale)
      c.strokeRect(box.x-.37*this.scale,box.y-.24*this.scale,.74*this.scale,.48*this.scale)
      this.arrow({x:at.x+.62,y:at.y+.62},{x:at.x+.62,y:at.y-.02},gold)
    }
    if(tool==='wire'&&anchor){
      this.arrow(at,anchor,gold)
    }
    if(tool==='jack'&&anchor){
      this.arrow({x:anchor.x,y:.27},{x:at.x,y:at.y-.48},gold)
    }
    if(tool==='pad'){
      const p=this.xy({x:at.x-padWidth/2,y:1.45})
      c.fillStyle='#ffce8129';c.strokeStyle=gold;c.lineWidth=1.4;c.setLineDash([5,4])
      c.fillRect(p.x,p.y,padWidth*this.scale,1.45*this.scale)
      c.strokeRect(p.x,p.y,padWidth*this.scale,1.45*this.scale)
      c.setLineDash([])
    }
    this.point(mark.at,gold,8,true)
  }

  private eventMarker(event: SiteEvent, radius: number, alpha: number) {
    const c=this.context, p=this.xy(event.at)
    const hit=event.kind==='neighborHit'||event.kind==='safeHit'
    c.save();c.globalAlpha=alpha;c.strokeStyle=hit?'#ff8168':'#ffd18c';c.lineWidth=2
    c.beginPath();c.arc(p.x,p.y,radius,0,Math.PI*2);c.stroke()
    c.beginPath()
    c.moveTo(p.x-radius-5,p.y);c.lineTo(p.x-radius+4,p.y)
    c.moveTo(p.x+radius-4,p.y);c.lineTo(p.x+radius+5,p.y)
    c.moveTo(p.x,p.y-radius-5);c.lineTo(p.x,p.y-radius+4)
    c.moveTo(p.x,p.y+radius-4);c.lineTo(p.x,p.y+radius+5)
    c.stroke();c.restore()
  }

  private protectedLoads(stage: Stage, sim: Simulation | null) {
    const c=this.context
    c.textAlign='center';c.font='700 12px sans-serif'
    for(const asset of stage.assets ?? []){
      if(!asset.body)continue
      const member=stage.members.find(m=>m.id===asset.body)
      if(!member)continue
      const p=sim?.parts.get(asset.body)?.body.getPosition()??member
      const q=this.xy({x:p.x,y:p.y+member.h/2})
      c.fillStyle=(sim?.assetDamage[asset.id]??0)>asset.tolerance?'#ff9f85':'#c5f0dc'
      c.fillText(asset.name,q.x,q.y-7)
    }
    c.textAlign='left'
  }

  draw(stage: Stage, sim: Simulation | null, placements: Placement[], marks: Mark[], anchor: Point | undefined, active: number | null, debug: boolean,
    options: { hovered?: Mark; pointer?: Point; hoveredEquipment: number | null; placementPriority: boolean; tool: Tool | null; outline: boolean; focused?: SiteEvent },
  ) {
    const c=this.context
    c.setTransform(this.canvas.width/this.w,0,0,this.canvas.height/this.h,0,0)
    this.background(stage,sim)
    if(!sim||options.outline){
      c.save();c.globalAlpha=sim?.time ? .23 : 1;this.shell(stage);c.restore()
    }
    this.supports(stage)
    if(!sim) {
      for(const m of stage.members)this.part(m,m,m.angle,0,false,debug)
      this.protectedLoads(stage,null)
      for(const j of stage.joints)this.point(j,j.kind==='foot'?'#dbb877':anchorLabel,j.kind==='foot'?4.2:3.25,false)
      if(options.placementPriority)this.preview(stage,placements,active,options.hoveredEquipment)
      for(const mark of marks){
        if(mark.source && Math.hypot(mark.source.x-mark.at.x,mark.source.y-mark.at.y)>.1) {
          c.strokeStyle='#b4d2baaa';c.lineWidth=1;this.line(c,mark.source,mark.at)
        }
        this.point(mark.at,isBurst(options.tool)?bursts[options.tool].color:'#b2e3cf',4.35,false)
      }
      if(!options.placementPriority)this.preview(stage,placements,active,options.hoveredEquipment)
      if(anchor){
        if(options.tool==='wire'&&options.pointer&&!options.hovered){
          c.strokeStyle='#f3c188';c.lineWidth=1.5;c.setLineDash([5,5])
          this.line(c,anchor,options.pointer)
          c.setLineDash([])
        }
        this.point(anchor,'#ffd17d',7,true)
      }
      if(options.hovered)this.hover(stage,options.hovered,options.tool,anchor)
      return
    }
    const remaining = new Set(sim.result?.remaining.map(p=>p.id))
    for(const {data,body,damage,counted} of sim.parts.values()){
      const at=body.getPosition()
      this.part(data,at,body.getAngle(),damage,counted,debug)
      if(remaining.has(data.id))this.rectangle(data,at,body.getAngle(),'#efd184',2)
    }
    this.protectedLoads(stage,sim)
    for(const t of sim.ties.values()){
      if(t.joint)this.point(t.joint.getAnchorA(),t.damage>.32?'#ffb06e':anchorLabel,3.15,false)
    }
    for(const e of sim.extras){
      const at=e.body.getPosition()
      this.part({id:'equipment',x:at.x,y:at.y,angle:0,kind:'furniture',material:'steel',w:e.w,h:e.h,tint:e.kind==='pad'?'#bc9359':'#596c74'},at,e.body.getAngle(),0,false,debug)
    }
    for(const w of sim.wires){c.strokeStyle=w.tension>140?'#ffc07d':'#a3aca4';c.lineWidth=w.tension>140?2:1;this.line(c,w.anchor,w.body.getWorldPoint(w.local))}
    for(const j of sim.jacks){
      const pos=j.body.getPosition()
      c.strokeStyle='#edaa69';c.lineWidth=2
      this.line(c,{x:j.x-.27,y:0},{x:j.x+.27,y:pos.y})
      this.line(c,{x:j.x+.27,y:0},{x:j.x-.27,y:pos.y})
      this.line(c,{x:j.x-.32,y:pos.y},{x:j.x+.32,y:pos.y})
    }
    if(sim.time<.65 && !matchMedia('(prefers-reduced-motion: reduce)').matches)for(const event of sim.events){
      if(event.kind!=='blast'&&event.kind!=='precise')continue
      const p=this.xy(event.at), effect=bursts[event.kind]
      c.strokeStyle=effect.color;c.lineWidth=2;c.globalAlpha=1-sim.time/.65
      c.beginPath();c.arc(p.x,p.y,Math.max(2,effect.range*this.scale*Math.min(1,sim.time*5)),0,Math.PI*2);c.stroke()
      c.globalAlpha=1
    }
    if(options.focused)this.eventMarker(options.focused,15,1)
    if(!sim.result){
      for(const event of sim.alerts){
        const age=sim.time-event.time
        if(age<1.2)this.eventMarker(event,9+age*13,1-age/1.2)
      }
    }
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) for(const dust of sim.dust){
      const age=sim.time-dust.time,p=this.xy(dust)
      if(dust.strength>.7 && age<.44){
        c.fillStyle=`rgba(248,187,124,${.72*(1-age/.44)})`
        for(let i=0;i<5;i++){
          const dx=(i-2)*age*65
          const dy=-age*(55-i*7)+age**2*140
          c.fillRect(p.x+dx,p.y+dy,2+i%2,2)
        }
      }
      for(let i=0;i<4;i++){
        c.fillStyle=`rgba(232,204,172,${Math.max(0,.19*(1-age/.72))})`
        c.beginPath();c.arc(p.x+(i-1.5)*age*35,p.y-(age*23)*(1+i*.21),2+(1+i*.2)*age*16*dust.strength,0,Math.PI*2);c.fill()
      }
    }
  }
}
