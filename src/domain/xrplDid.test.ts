import { beforeEach, describe, expect, it, vi } from 'vitest'

const submitAndWaitMock = vi.hoisted(() => vi.fn())

vi.mock('./xrplClient', () => ({
  submitAndWait: submitAndWaitMock
}))

import {
  DID_SET_DATA_MAX_BYTES,
  buildDidSet,
  getDidDocumentUrl,
  submitDidSet
} from './xrplDid'
import { hexDecode, hexEncode } from './xrplEncoding'

const account = 'rNomokDonTenantTestnetAccount'
const purpose = 'nomokdon-housing-trust-pass'

function decodeDidSetData(tx: ReturnType<typeof buildDidSet>): Record<string, unknown> {
  return JSON.parse(hexDecode(tx.Data ?? '')) as Record<string, unknown>
}

describe('xrplDid', () => {
  beforeEach(() => {
    submitAndWaitMock.mockReset()
  })

  it('returns the mock DID document URL for a Testnet account', () => {
    expect(getDidDocumentUrl(account)).toBe(
      'https://nomokdon.app/did/rNomokDonTenantTestnetAccount.json'
    )
  })

  it('builds a DIDSet draft with hex URI and minimal hex Data', () => {
    const tx = buildDidSet({ account, purpose })
    const dataPayload = hexDecode(tx.Data ?? '')

    expect(tx).toEqual({
      TransactionType: 'DIDSet',
      Account: account,
      URI: hexEncode(getDidDocumentUrl(account)),
      Data: hexEncode(JSON.stringify({ purpose, version: 1 }))
    })
    expect(hexDecode(tx.URI ?? '')).toBe(getDidDocumentUrl(account))
    expect(JSON.parse(dataPayload)).toEqual({ purpose, version: 1 })
    expect(new TextEncoder().encode(dataPayload).byteLength).toBeLessThanOrEqual(
      DID_SET_DATA_MAX_BYTES
    )
  })

  it('keeps DIDSet Data free of PII and claim fields', () => {
    const tx = buildDidSet({ account, purpose })
    const data = decodeDidSetData(tx)
    const forbiddenFields = [
      'passport',
      'phone',
      'visa',
      'employment',
      'rent',
      'claim',
      'claims'
    ]

    expect(Object.keys(data).sort()).toEqual(['purpose', 'version'])
    for (const field of forbiddenFields) {
      expect(data).not.toHaveProperty(field)
    }
  })

  it('rejects Data payloads over 256 bytes before hex encoding', () => {
    expect(() =>
      buildDidSet({ account, purpose: 'x'.repeat(DID_SET_DATA_MAX_BYTES) })
    ).toThrow(/DIDSet Data payload must be 256 bytes or less before hex encoding/)
  })

  it('submits a DIDSet draft through the Testnet submitAndWait wrapper', async () => {
    const wallet = { classicAddress: account }
    const response = { result: { hash: 'MOCK_DID_SET_HASH' } }
    submitAndWaitMock.mockResolvedValue(response)

    const result = await submitDidSet(wallet as never, { account, purpose })

    expect(submitAndWaitMock).toHaveBeenCalledWith(buildDidSet({ account, purpose }), wallet)
    expect(result).toBe(response)
  })
})
