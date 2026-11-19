import { describe, expect, it } from 'vitest'
import { readTextFile } from './file'

describe('readTextFile', () => {
  it('reads UTF-8 blob content', async () => {
    await expect(readTextFile(new Blob(['Uangq backup']))).resolves.toBe('Uangq backup')
  })
})
