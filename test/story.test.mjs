import assert from 'node:assert/strict'
import {test} from 'node:test'
import {scenario} from '../src/scenario.ts'
import {StoryProgress} from '../src/story.ts'

function storage(){
  const items=new Map()
  return { getItem:key=>items.get(key)??null, setItem:(key,value)=>items.set(key,value) }
}

test('story events match all chapter entries and the supplied dialogue counts',()=>{
  assert.deepEqual(scenario.map(e=>e.lines.length),[11,8,10,8,8,8,8,10])
  assert.deepEqual(scenario.flatMap(e=>e.cue.kind==='chapter'?[e.cue.job]:[]),[1,4,7,10,12,14])
  assert.equal(scenario.at(-1).lines.at(-1)[1],'―― おしまい ――')
})

test('fresh story starts in order, remembers opened scenes across reloads and resets with a new campaign',()=>{
  const saved=storage()
  let story=new StoryProgress(saved)
  story.migrate('',{},{},false)
  const entry=job=>story.entry('',job).map(e=>e.id)
  assert.deepEqual(entry(1),['op','chapter-1'])
  story.mark('','op')
  story=new StoryProgress(saved)
  assert.deepEqual(entry(1),['chapter-1'])
  story.mark('','chapter-1')
  assert.deepEqual(entry(1),[])
  for(const [i,job] of [4,7,10,12,14].entries()){
    assert.deepEqual(entry(job),[`chapter-${i+2}`])
    story.mark('',`chapter-${i+2}`)
    assert.deepEqual(entry(job),[])
  }
  assert.deepEqual(story.entry('new-game',1).map(e=>e.id),['op','chapter-1'])
})

test('existing saves can revisit past events without forced repeats, and one star unlocks the new ending',()=>{
  const story=new StoryProgress(storage())
  const best={'job-4':1,'job-15':1}, latest={'job-7':0}
  story.migrate('',best,latest,false)
  assert.deepEqual(story.entry('',1),[])
  assert.equal(story.seen('','chapter-6'),true)
  assert.equal(story.seen('','ed'),true)
  assert.deepEqual(best,{'job-4':1,'job-15':1})
  assert.deepEqual(latest,{'job-7':0})
  assert.equal(story.canOfferEnding('fresh',15,0),false)
  assert.equal(story.canOfferEnding('fresh',14,3),false)
  assert.equal(story.canOfferEnding('fresh',15,1),true)
  story.mark('fresh','ed')
  assert.equal(story.canOfferEnding('fresh',15,3),false)
})

test('all shipped images resolve from a GitHub Pages repository path', async () => {
  const { readFile, readdir, stat } = await import('node:fs/promises')
  const { gameArt } = await import('../src/game-art.ts')
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  const titleImage = html.match(/src="\/(game-art\/[^"]+\.webp)"/)[1]
  const links = [
    './' + titleImage,
    gameArt.logo, gameArt.header, gameArt.footer,
    ...Object.values(gameArt.tools),
    ...Array.from({length:6}, (_, i) => gameArt.stage(i+1)),
    ...Array.from({length:15}, (_, i) => gameArt.client(i+1)),
    ...scenario.map(event => event.still),
  ]
  const base = new URL('https://example.test/wreck-works/')
  const used = new Set(links.map(link => {
    const resolved = new URL(link, base)
    assert.ok(resolved.href.startsWith(base.href), link)
    return resolved.href.slice(base.href.length)
  }))
  const shipped = await readdir(new URL('../public/', import.meta.url), {recursive:true})
  assert.deepEqual([...used].sort(), shipped.filter(file => /\.webp$/.test(file)).sort())
  for (const file of used) assert.ok((await stat(new URL('../public/' + file, import.meta.url))).size > 0)
})
