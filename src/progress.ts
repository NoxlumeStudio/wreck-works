import { type Job } from './campaign.ts'
export const progressKey = 'wreck-works-campaign-v2'
export function loadProgress(jobs: Job[], current: string | null, legacy: string | null): Record<string,number> {
  const parse = (value: string | null): unknown => {
    try { return JSON.parse(value??'null') } catch { return null }
  }
  const saved=parse(current) as {version?:number;stars?:Record<string,unknown>} | null
  const old=parse(legacy)
  const source: Record<string,unknown>=saved?.version===2&&saved.stars ? saved.stars : Array.isArray(old) ? {'job-1':old[0],'job-4':old[1],'job-7':old[2]} : {}
  const result: Record<string,number>={}
  for(const {id} of jobs){
    const star=source[id]
    if(typeof star==='number'&&Number.isInteger(star)&&star>=1&&star<=3)result[id]=star
  }
  return result
}
export function available(jobs: Job[], index: number, stars: Record<string,number>) {
  const job=jobs[index]
  return !!job&&(!!stars[job.id]||jobs.slice(0,index).every(previous=>!!stars[previous.id]))
}

export function resumeStage(jobs: Job[], stars: Record<string,number>, lastJob: string | null) {
  const saved = jobs.findIndex(job=>job.id===lastJob)
  if(available(jobs,saved,stars))return saved
  const firstUnfinished = jobs.findIndex((job,index)=>available(jobs,index,stars)&&!stars[job.id])
  if(firstUnfinished>=0)return firstUnfinished
  return Math.max(0,jobs.length-1)
}

export const latestKey = 'wreck-works-latest-v1'
export function loadLatest(jobs: Job[], current: string|null): Record<string,number> {
  try {
    const data=JSON.parse(current??'null')
    if(data?.version!==1||!data.stars||typeof data.stars!=='object')return {}
    return Object.fromEntries(jobs.flatMap(({id})=>{
      const n=data.stars[id]
      return Number.isInteger(n)&&n>=0&&n<=3?[[id,n]]:[]
    }))
  } catch { return {} }
}

export type StageRating = { id: string; best: number; latest?: number; generation?: string }
const resetRecord='campaign-reset'
type ResetRecord = { id: typeof resetRecord; generation: string }

export class ProgressStore {
  private database: Promise<IDBDatabase>

  constructor(factory: IDBFactory) {
    this.database = new Promise((resolve,reject)=>{
      const request=factory.open('wreck-works-progress',1)
      request.onupgradeneeded=()=>request.result.createObjectStore('jobs',{keyPath:'id'})
      request.onsuccess=()=>resolve(request.result)
      request.onerror=()=>reject(request.error)
    })
  }

  async read(): Promise<{generation: string; ratings: StageRating[]}> {
    const db=await this.database
    return new Promise((resolve,reject)=>{
      const request=db.transaction('jobs').objectStore('jobs').getAll()
      request.onsuccess=()=>{
        const entries: (StageRating|ResetRecord)[]=request.result
        const generation=entries.find(entry=>entry.id===resetRecord)?.generation??''
        const ratings=entries.filter((entry):entry is StageRating=>
          entry.id!==resetRecord&&(entry.generation??'')===generation)
        resolve({generation,ratings})
      }
      request.onerror=()=>reject(request.error)
    })
  }

  async save(id: string, stars: number, legacyBest: number, generation: string): Promise<boolean> {
    const db=await this.database
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('jobs','readwrite')
      const jobs=transaction.objectStore('jobs')
      const marker=jobs.get(resetRecord)
      let saved=false
      marker.onsuccess=()=>{
        if((marker.result?.generation??'')!==generation)return
        const request=jobs.get(id)
        request.onsuccess=()=>{
          const current: StageRating|undefined=request.result
          const best=(current?.generation??'')===generation?current?.best??0:0
          jobs.put({id,best:Math.max(best,legacyBest,stars),latest:stars,generation})
          saved=true
        }
      }
      transaction.oncomplete=()=>resolve(saved)
      transaction.onabort=()=>reject(transaction.error)
    })
  }

  async reset(): Promise<string> {
    const db=await this.database
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('jobs','readwrite')
      const jobs=transaction.objectStore('jobs')
      const generation=crypto.randomUUID()
      jobs.clear()
      jobs.put({id:resetRecord,generation})
      transaction.oncomplete=()=>resolve(generation)
      transaction.onabort=()=>reject(transaction.error)
    })
  }
}
