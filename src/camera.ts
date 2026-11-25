import { architecture } from './architecture.ts'
import { type Point, type Stage } from './stages.ts'

export type ScreenArea = { x: number; y: number; w: number; h: number }

export type Bounds = { left: number; right: number; bottom: number; top: number }

export function stageBounds(stage: Stage): Bounds {
  const points = [...stage.points, ...stage.joints]
  const neighbors = stage.protection === 'neighbor' ? stage.neighborX ?? [-10.26, 10.26] : []
  const bounds = {
    left: Math.min(-.5, ...points.map(p => p.x - .5), ...neighbors.map(x => x - 2.25)),
    right: Math.max(.5, ...points.map(p => p.x + .5), ...neighbors.map(x => x + 2.25)),
    bottom: -.55,
    top: Math.max(4.3, ...points.map(p => p.y)),
  }
  for(const {obstacle:o} of stage.assets ?? []) {
    if (!o) continue
    bounds.left=Math.min(bounds.left,o.x-o.w/2-.25)
    bounds.right=Math.max(bounds.right,o.x+o.w/2+.25)
    bounds.top=Math.max(bounds.top,o.y+o.h/2+(o.style==='house'?.9:.35))
  }
  const roofHeight=Math.max(1.1,...(architecture(stage)?.silhouette.map(p=>p[1])??[]))
  for (const m of stage.members) {
    const sin = Math.abs(Math.sin(m.angle))
    const cos = Math.abs(Math.cos(m.angle))
    const hw = (m.w * cos + m.h * sin) / 2
    const hh = (m.w * sin + m.h * cos) / 2
    bounds.left = Math.min(bounds.left, m.x - hw)
    bounds.right = Math.max(bounds.right, m.x + hw)
    bounds.bottom = Math.min(bounds.bottom, m.y - hh)
    bounds.top = Math.max(bounds.top, m.y + hh + (m.kind === 'floor' ? roofHeight : 0))
  }
  return bounds
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

export class Camera {
  width = 1
  height = 1
  center: Point = { x: 0, y: 0 }
  zoom = 1
  area: ScreenArea = {x:0,y:0,w:1,h:1}
  private base = 1
  private fitted = true
  private bounds: Bounds = { left: -1, right: 1, bottom: 0, top: 2 }

  get scale() { return this.base * this.zoom }
  get maxZoom() { return Math.max(16, 105 / this.base) }
  get minZoom() { return .7 }
  get screenCenter() { return {x:this.area.x+this.area.w/2,y:this.area.y+this.area.h/2} }
  get isFitted() { return this.fitted }

  fit(bounds = this.bounds) {
    this.bounds = bounds
    this.base = this.fitScale()
    this.center = { x: (bounds.left + bounds.right) / 2, y: (bounds.bottom + bounds.top) / 2 }
    this.zoom = 1
    this.fitted = true
  }

  resize(width: number, height: number, area: ScreenArea = {x:0,y:0,w:width,h:height}) {
    const previousScale=this.scale
    this.area={...area,w:Math.max(1,area.w),h:Math.max(1,area.h)}
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    if (this.fitted) this.fit()
    else {
      this.base = this.fitScale()
      this.zoom = clamp(previousScale / this.base, this.minZoom, this.maxZoom)
      this.constrain()
    }
  }

  private fitScale() {
    return Math.min(
      this.area.w * .92 / (this.bounds.right - this.bounds.left),
      this.area.h * .94 / (this.bounds.top - this.bounds.bottom),
    )
  }

  focus(bounds: Bounds) {
    const scale = Math.min(this.area.w * .87 / (bounds.right-bounds.left), this.area.h * .56 / (bounds.top-bounds.bottom))
    this.zoom = clamp(Math.max(1.13,scale/this.base),this.minZoom,this.maxZoom)
    this.center = {x:(bounds.left+bounds.right)/2,y:(bounds.top+bounds.bottom)/2}
    this.constrain()
    this.fitted=false
  }

  private constrain() {
    const marginX = this.area.w / this.scale * .25
    const marginY = this.area.h / this.scale * .25
    this.center.x = clamp(this.center.x, this.bounds.left - marginX, this.bounds.right + marginX)
    this.center.y = clamp(this.center.y, this.bounds.bottom - marginY, this.bounds.top + marginY)
  }

  screen(p: Point): Point {
    const origin=this.screenCenter
    return { x: origin.x + (p.x - this.center.x) * this.scale, y: origin.y - (p.y - this.center.y) * this.scale }
  }

  world(p: Point): Point {
    const origin=this.screenCenter
    return { x: this.center.x + (p.x - origin.x) / this.scale, y: this.center.y - (p.y - origin.y) / this.scale }
  }

  zoomAt(p: Point, factor: number) {
    const next = clamp(this.zoom * factor, this.minZoom, this.maxZoom)
    if (next === this.zoom) return
    const before = this.world(p)
    this.zoom = next
    const after = this.world(p)
    this.center = { x: this.center.x + before.x - after.x, y: this.center.y + before.y - after.y }
    this.constrain()
    this.fitted = false
  }

  panBy(delta: Point) {
    this.center.x -= delta.x / this.scale
    this.center.y += delta.y / this.scale
    this.constrain()
    this.fitted = false
  }
}
