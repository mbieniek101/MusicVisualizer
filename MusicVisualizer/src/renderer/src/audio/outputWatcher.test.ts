import { describe, expect, it } from 'vitest'
import { DefaultOutputWatcher, readableOutputName } from './outputWatcher'

/** A fake device list whose default device we can switch. */
function fakeSystem(initial: string): { lookup: () => Promise<string>; switchTo(l: string): void } {
  let current = initial
  return {
    lookup: async () => current,
    switchTo: (label) => (current = label)
  }
}

describe('DefaultOutputWatcher', () => {
  it('fires when the default output device changes', async () => {
    const system = fakeSystem('Default - Speakers (Realtek)')
    const changes: string[] = []
    const watcher = new DefaultOutputWatcher(system.lookup, (l) => changes.push(l))
    await watcher.remember()

    expect(await watcher.check()).toBe(false)
    system.switchTo('Default - Headphones (WH-1000XM4)')
    expect(await watcher.check()).toBe(true)
    expect(changes).toEqual(['Default - Headphones (WH-1000XM4)'])
  })

  it('fires once per switch, not on every check after it', async () => {
    const system = fakeSystem('Default - Speakers')
    let count = 0
    const watcher = new DefaultOutputWatcher(system.lookup, () => count++)
    await watcher.remember()
    system.switchTo('Default - Headphones')
    await watcher.check()
    await watcher.check()
    await watcher.check()
    expect(count).toBe(1)
  })

  it('does nothing until a capture has started, or after forget()', async () => {
    const system = fakeSystem('Default - Speakers')
    let count = 0
    const watcher = new DefaultOutputWatcher(system.lookup, () => count++)
    system.switchTo('Default - Headphones')
    await watcher.check()
    await watcher.remember()
    watcher.forget()
    system.switchTo('Default - Speakers')
    await watcher.check()
    expect(count).toBe(0)
  })
})

describe('readableOutputName', () => {
  it('drops the "Default - " prefix', () => {
    expect(readableOutputName('Default - Headphones (WH-1000XM4)')).toBe('Headphones (WH-1000XM4)')
    expect(readableOutputName('Speakers (Realtek)')).toBe('Speakers (Realtek)')
  })
})
