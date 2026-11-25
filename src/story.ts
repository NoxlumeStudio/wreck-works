import { scenario } from './scenario.ts'

const prefix='wreck-works-story-v1'
export class StoryProgress {
  private memory = new Set<string>()
  private storage?: Pick<Storage,'getItem'|'setItem'>
  constructor(storage?: Pick<Storage,'getItem'|'setItem'>) { this.storage=storage }
  private key(generation: string, id: string) {
    return `${prefix}:${generation||'original'}:${id}`
  }
  seen(generation: string,id:string) {
    const key=this.key(generation,id)
    try { return this.memory.has(key)||this.storage?.getItem(key)==='1' } catch { return this.memory.has(key) }
  }
  mark(generation:string,id:string) {
    const key=this.key(generation,id)
    this.memory.add(key)
    try{this.storage?.setItem(key,'1')}catch{/* Continue within this browser tab. */}
  }
  migrate(generation:string, best:Record<string,number>, latest:Record<string,number>, playedTutorial:boolean) {
    if(this.seen(generation,'initialized'))return
    const visited=Math.max(0,...Object.keys({...best,...latest}).map(id=>Number(id.replace('job-',''))||0))
    for(const event of scenario){
      const cue=event.cue
      if(cue.kind==='opening'?visited>0||playedTutorial
        :cue.kind==='chapter'?visited>=cue.job||(cue.job===1&&playedTutorial)
        :best['job-15']>0)this.mark(generation,event.id)
    }
    this.mark(generation,'initialized')
  }
  canOfferEnding(generation:string,job:number,stars:number) {
    return scenario.some(e=>e.cue.kind==='ending'&&e.cue.job===job&&stars>=1&&!this.seen(generation,e.id))
  }
  entry(generation:string,job:number) {
    return scenario.filter(e=>!this.seen(generation,e.id)&&
      (e.cue.kind==='opening'?job===1:e.cue.kind==='chapter'&&e.cue.job===job))
  }
}

export class StoryPlayer {
  private dialog=document.querySelector<HTMLDialogElement>('#story-player')!
  private still=document.querySelector<HTMLImageElement>('#story-still')!
  private copy=document.querySelector<HTMLElement>('.story-copy')!
  private speaker=document.querySelector<HTMLElement>('#story-speaker')!
  private line=document.querySelector<HTMLElement>('#story-line')!
  private next=document.querySelector<HTMLButtonElement>('#story-next')!
  private skip=document.querySelector<HTMLButtonElement>('#story-skip')!
  private finish?:()=>void

  constructor(){
    this.still.addEventListener('load',()=>this.showLoadedStill())
    this.still.addEventListener('error',()=>this.hideStill())
    this.dialog.addEventListener('cancel',event=>event.preventDefault())
    this.skip.addEventListener('click',()=>this.finish?.())
    this.dialog.addEventListener('keydown',event=>{
      if(event.key==='ArrowRight'&&!event.repeat){
        event.preventDefault()
        this.next.click()
      }
    })
  }
  get open(){return this.dialog.open}

  private hideStill(){
    this.still.hidden=true
    this.dialog.style.removeProperty('--still-image')
  }

  private showLoadedStill(){
    if(!this.still.complete||!this.still.naturalWidth)return
    this.dialog.style.setProperty('--still-image',`url(${JSON.stringify(this.still.currentSrc)})`)
    this.still.hidden=false
  }

  play(event:(typeof scenario)[number],done:()=>void){
    let index=0
    this.finish=()=>{
      this.finish=undefined
      this.dialog.close()
      done()
    }
    this.hideStill()
    if(event.still){
      this.still.src=event.still
      this.showLoadedStill()
    }else this.still.removeAttribute('src')
    const render=()=>{
      const [speaker,text]=event.lines[index]
      this.speaker.hidden=!speaker
      this.speaker.textContent=speaker
      this.line.textContent=text
      this.copy.scrollTop=0
      this.next.textContent=index===event.lines.length-1?'閉じる':'次へ'
    }
    this.next.onclick=()=>{
      if(index+1===event.lines.length)this.finish?.()
      else {index++;render()}
    }
    this.dialog.onclick=event=>{
      if(!(event.target as HTMLElement).closest('button')&&!window.getSelection()?.toString())this.next.click()
    }
    render()
    this.dialog.showModal()
    this.next.focus({preventScroll:true})
  }

  close(){
    this.finish=undefined
    if(this.dialog.open)this.dialog.close()
  }
}
