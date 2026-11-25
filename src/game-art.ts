import type { Tool } from './stages.ts'

const artPath = (name: string) => `./game-art/${name}.webp`
const numbered = (prefix: string, number: number) => artPath(prefix + String(number).padStart(2, '0'))

export const gameArt = {
  logo: artPath('ui_logo'),
  header: artPath('ui_header_bg'),
  footer: artPath('ui_footer_bg-optimized'),
  stage: (chapter: number) => numbered('stage_bg_ch', chapter),
  client: (stage: number) => numbered('client_', stage === 15 ? 14 : stage),
  tools: {
    cut: artPath('tool_cutter'),
    weight: artPath('tool_weight'),
    wire: artPath('tool_wire'),
    jack: artPath('tool_jack'),
    pad: artPath('tool_cushion'),
    blast: artPath('tool_dynamite'),
    precise: artPath('tool_precision'),
  } satisfies Record<Tool, string>,
}

const stageImages = new Map<string, HTMLImageElement>()

export function stageImage(chapter: number) {
  const url = gameArt.stage(chapter)
  let image = stageImages.get(url)
  if (!image) {
    image = new Image()
    image.src = url
    stageImages.set(url, image)
  }
  return image
}

export function useOptionalImage(image: HTMLImageElement, url?: string) {
  if (url && image.getAttribute('src') === url) return
  image.hidden = true
  image.onload = () => { image.hidden = !image.naturalWidth }
  image.onerror = () => { image.hidden = true }
  if (url) image.src = url
  else image.removeAttribute('src')
}
