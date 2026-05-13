import type { SubmittableTransaction, Wallet } from 'xrpl';

import { submitAndWait } from './xrplClient.js';
import { hexEncode, isoTimeToRippleTime } from './xrplEncoding.js';

export const SUPPORTED_CREDENTIAL_TYPES = [
  'nomokdon-visa',
  'nomokdon-rent-reputation'
] as const;

export type XrplCredentialType = (typeof SUPPORTED_CREDENTIAL_TYPES)[number];

export type CredentialExpiration = string | Date | number;

export type BuildCredentialCreateInput = {
  issuer: string;
  subject: string;
  type: string;
  uri: string;
  expiration: CredentialExpiration;
};

export type BuildCredentialAcceptInput = {
  tenant: string;
  issuer: string;
  type: string;
};

export type XrplCredentialCreateTransaction = {
  TransactionType: 'CredentialCreate';
  Account: string;
  Subject: string;
  CredentialType: string;
  URI: string;
  Expiration: number;
};

export type XrplCredentialAcceptTransaction = {
  TransactionType: 'CredentialAccept';
  Account: string;
  Issuer: string;
  CredentialType: string;
};

function isSupportedCredentialType(type: string): type is XrplCredentialType {
  return (SUPPORTED_CREDENTIAL_TYPES as readonly string[]).includes(type);
}

function validateCredentialType(type: string): XrplCredentialType {
  const byteLength = new TextEncoder().encode(type).length;

  if (byteLength > 64) {
    throw new Error('CredentialType must be 64 bytes or fewer before hex encoding');
  }

  if (!isSupportedCredentialType(type)) {
    throw new Error(`Unsupported CredentialType: ${type}`);
  }

  return type;
}

function encodeCredentialType(type: string): string {
  return hexEncode(validateCredentialType(type));
}

function normalizeExpiration(expiration: CredentialExpiration): number {
  if (typeof expiration === 'number') {
    return expiration;
  }

  return isoTimeToRippleTime(expiration);
}

export function buildCredentialCreate({
  issuer,
  subject,
  type,
  uri,
  expiration
}: BuildCredentialCreateInput): XrplCredentialCreateTransaction {
  return {
    TransactionType: 'CredentialCreate',
    Account: issuer,
    Subject: subject,
    CredentialType: encodeCredentialType(type),
    URI: hexEncode(uri),
    Expiration: normalizeExpiration(expiration)
  };
}

export function buildCredentialAccept({
  tenant,
  issuer,
  type
}: BuildCredentialAcceptInput): XrplCredentialAcceptTransaction {
  return {
    TransactionType: 'CredentialAccept',
    Account: tenant,
    Issuer: issuer,
    CredentialType: encodeCredentialType(type)
  };
}

export async function submitCreate(
  issuerWallet: Wallet,
  input: BuildCredentialCreateInput
) {
  return submitAndWait(
    buildCredentialCreate(input) as unknown as SubmittableTransaction,
    issuerWallet
  );
}

export async function submitAccept(
  tenantWallet: Wallet,
  input: BuildCredentialAcceptInput
) {
  return submitAndWait(
    buildCredentialAccept(input) as unknown as SubmittableTransaction,
    tenantWallet
  );
}
