import { materials, type Member, type Stage } from './stages.ts'

export const gravity = 9.81
export const massOf = (m: Member) => m.w * m.h * materials[m.material].depth * materials[m.material].density
export const structural = (m: Member) => m.kind === 'beam' || m.kind === 'post' || m.kind === 'floor'

// Linear elastic checks for idealized horizontal beams under uniform loading.
// The live solver uses only rigid-body reactions for breakage.
export function beamEstimate(span: number, loadPerMeter: number, stiffness: number, cantilever = false) {
  return {
    reaction: span * loadPerMeter / (cantilever ? 1 : 2),
    moment: loadPerMeter * span ** 2 / (cantilever ? 2 : 8),
    deflection: loadPerMeter * span ** 4 / stiffness * (cantilever ? 1 / 8 : 5 / 384),
  }
}

export function connectedMembers(stage: Stage, live: Set<string>) {
  const adjacent = new Map<string, string[]>()
  for (const { id, a, b } of stage.joints) {
    if (!live.has(id)) continue
    if (!adjacent.has(a)) adjacent.set(a, [])
    if (!adjacent.has(b)) adjacent.set(b, [])
    adjacent.get(a)!.push(b)
    adjacent.get(b)!.push(a)
  }
  const seen = new Set(['ground'])
  const queue = ['ground']
  for (const id of queue) for (const neighbor of adjacent.get(id) ?? []) {
    if (seen.has(neighbor)) continue
    seen.add(neighbor)
    queue.push(neighbor)
  }
  return seen
}

export function survey(stage: Stage) {
  const ties = new Set(stage.joints.map(j => j.id))
  const supported = connectedMembers(stage, ties)
  const beams = stage.members.filter(m => m.kind === 'beam').map(m => {
    const above = stage.members.filter(item => item.id !== m.id && Math.abs(item.x - m.x) < m.w / 2 && item.y > m.y && item.y - m.y < 1.7)
    const load = (massOf(m) + above.reduce((sum, item) => sum + massOf(item), 0)) * gravity
    const material = materials[m.material]
    const inertia = material.depth * m.h ** 3 / 12
    return { id: m.id, ...beamEstimate(m.w, load / m.w, material.elastic * inertia) }
  })
  return { supported, beams }
}
