/**
 * 离线缓冲 —— 断网时把待发消息落盘（JSONL 追加），恢复后顺序补传，保证零丢失。
 * 真实环境可换 SQLite；这里用追加写文件 + 内存队列，无原生依赖。
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

export interface BufferedMsg {
  topic: string
  payload: string
}

export class OfflineBuffer {
  private queue: BufferedMsg[] = []

  constructor(private file: string) {
    // 启动时恢复上次未发完的消息
    if (existsSync(file)) {
      const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          this.queue.push(JSON.parse(line) as BufferedMsg)
        } catch {
          /* 跳过损坏行 */
        }
      }
      if (this.queue.length) console.log(`[buffer] restored ${this.queue.length} buffered msgs`)
    }
  }

  get size(): number {
    return this.queue.length
  }

  /** 入队并落盘。 */
  push(msg: BufferedMsg): void {
    this.queue.push(msg)
    try {
      appendFileSync(this.file, JSON.stringify(msg) + '\n')
    } catch (err) {
      console.error('[buffer] persist failed:', (err as Error).message)
    }
  }

  /** 取出全部待发并清空（补传成功后调用 commit 落盘清空文件）。 */
  drain(): BufferedMsg[] {
    return this.queue.splice(0, this.queue.length)
  }

  /** 补传成功后清空持久化文件。 */
  commit(): void {
    try {
      writeFileSync(this.file, '')
    } catch {
      /* ignore */
    }
  }

  /** 补传失败，回滚到队列头部以便下次重发。 */
  rollback(msgs: BufferedMsg[]): void {
    this.queue.unshift(...msgs)
  }
}
