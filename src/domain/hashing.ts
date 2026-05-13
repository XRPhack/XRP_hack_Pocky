const encoder = new TextEncoder();

export async function sha256Hex(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export async function createHashAnchor(label: string, payload: unknown): Promise<string> {
  return sha256Hex(`${label}:${stableJson(payload)}`);
}

export function stringToHex(value: string): string {
  return [...encoder.encode(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}
