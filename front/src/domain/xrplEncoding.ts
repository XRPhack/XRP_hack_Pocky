import {
  convertHexToString,
  convertStringToHex,
  isoTimeToRippleTime as xrplIsoTimeToRippleTime
} from 'xrpl'

export function hexEncode(str: string): string {
  return convertStringToHex(str)
}

export function hexDecode(hex: string): string {
  return convertHexToString(hex)
}

export function isoTimeToRippleTime(iso: string | Date): number {
  return xrplIsoTimeToRippleTime(iso)
}

export function buildMemo({ type, data }: { type: string; data: string }): {
  Memo: { MemoType: string; MemoData: string }
} {
  return {
    Memo: {
      MemoType: hexEncode(type),
      MemoData: hexEncode(data)
    }
  }
}
