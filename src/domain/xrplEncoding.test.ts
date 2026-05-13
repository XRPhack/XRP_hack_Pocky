import { describe, expect, it } from 'vitest'

import { buildMemo, hexDecode, hexEncode, isoTimeToRippleTime } from './xrplEncoding'

describe('xrplEncoding', () => {
  it('round-trips ASCII and Korean strings through hex encoding', () => {
    const samples = ['NomokDon', '임차인 보증']

    for (const sample of samples) {
      const encoded = hexEncode(sample)

      expect(encoded).toMatch(/^[0-9A-F]+$/)
      expect(hexDecode(encoded)).toBe(sample)
    }
  })

  it('converts Ripple epoch time deterministically', () => {
    expect(isoTimeToRippleTime('2000-01-01T00:00:00.000Z')).toBe(0)
    expect(isoTimeToRippleTime(new Date('2000-01-02T00:00:00.000Z'))).toBe(86_400)
  })

  it('builds a memo with hex fields only', () => {
    expect(buildMemo({ type: 'nomokdon-memo', data: 'hashed-value' })).toEqual({
      Memo: {
        MemoType: hexEncode('nomokdon-memo'),
        MemoData: hexEncode('hashed-value')
      }
    })
  })
})
