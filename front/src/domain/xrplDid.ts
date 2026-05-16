import type { DIDSet, TxResponse, Wallet } from 'xrpl'

import { submitAndWait } from './xrplClient.js'
import { hexEncode } from './xrplEncoding.js'

export const DID_SET_DATA_MAX_BYTES = 256
export const DID_DOCUMENT_BASE_URL = 'https://nomokdon.app/did'

export type BuildDidSetInput = {
  account: string
  purpose: string
}

export function getDidDocumentUrl(account: string): string {
  return `${DID_DOCUMENT_BASE_URL}/${account}.json`
}

export function buildDidSet({ account, purpose }: BuildDidSetInput): DIDSet {
  const dataPayload = JSON.stringify({ purpose, version: 1 })
  const dataBytes = new TextEncoder().encode(dataPayload).byteLength

  if (dataBytes > DID_SET_DATA_MAX_BYTES) {
    throw new Error(
      `DIDSet Data payload must be ${DID_SET_DATA_MAX_BYTES} bytes or less before hex encoding; received ${dataBytes} bytes.`
    )
  }

  return {
    TransactionType: 'DIDSet',
    Account: account,
    URI: hexEncode(getDidDocumentUrl(account)),
    Data: hexEncode(dataPayload)
  }
}

export async function submitDidSet(
  wallet: Wallet,
  input: BuildDidSetInput
): Promise<TxResponse<DIDSet>> {
  return submitAndWait(buildDidSet(input), wallet)
}
