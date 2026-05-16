import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Client, encode, isValidAddress, type Payment, type SubmittableTransaction } from 'xrpl';

type JsonObject = Record<string, unknown>;

type GirinWalletSession = {
  topic: string;
  chainId: string;
  account: string;
  connectedAt: string;
  namespaces?: unknown;
};

type RegisterSessionResult = {
  session: GirinWalletSession;
};

type CreatePaymentDraftResult = {
  chainId: string;
  txJson: JsonObject;
};

type SubmitSignedResult = {
  chainId: string;
  txHash: string | null;
  engineResult: string | null;
  validated: boolean | null;
  raw: unknown;
};

const DEFAULT_CHAIN_ID = 'xrpl:1';

const CHAIN_WS_URLS: Record<string, string> = {
  'xrpl:0': 'wss://xrplcluster.com',
  'xrpl:1': 'wss://s.altnet.rippletest.net:51233',
  'xrpl:2': 'wss://s.devnet.rippletest.net:51233'
};

@Injectable()
export class GirinWalletService {
  private readonly sessionsByTopic = new Map<string, GirinWalletSession>();

  registerSession(input: unknown): RegisterSessionResult {
    const body = this.ensureRecord(input);
    const sessionCandidate = this.ensureRecord(body.session);
    const topic = this.requiredString(sessionCandidate.topic ?? body.topic, 'topic');
    const chainId = this.normalizeChainId(
      this.optionalString(sessionCandidate.chainId ?? body.chainId) ?? this.extractChainIdFromSession(sessionCandidate) ?? DEFAULT_CHAIN_ID
    );
    const account = this.requiredAccount(
      this.optionalString(sessionCandidate.account ?? body.account) ?? this.extractAccountFromSession(sessionCandidate),
      'account'
    );
    const connectedAt = new Date().toISOString();
    const stored: GirinWalletSession = {
      topic,
      chainId,
      account,
      connectedAt,
      namespaces: sessionCandidate.namespaces
    };

    this.sessionsByTopic.set(topic, stored);

    return { session: stored };
  }

  getSession(topic: string): RegisterSessionResult {
    const session = this.sessionsByTopic.get(topic);

    if (!session) {
      throw new NotFoundException('Session topic not found.');
    }

    return { session };
  }

  disconnectSession(topic: string): { ok: true } {
    this.sessionsByTopic.delete(topic);
    return { ok: true };
  }

  async createPaymentDraft(input: unknown): Promise<CreatePaymentDraftResult> {
    const body = this.ensureRecord(input);
    const chainId = this.normalizeChainId(this.optionalString(body.chainId) ?? DEFAULT_CHAIN_ID);
    const account = this.requiredAccount(this.optionalString(body.account), 'account');
    const destination = this.requiredAccount(this.optionalString(body.destination), 'destination');
    const amountDrops = this.requiredDrops(this.optionalString(body.amount) ?? this.optionalString(body.amountDrops), 'amount');
    const destinationTag = this.optionalDestinationTag(body.destinationTag);
    const memo = this.optionalString(body.memo);
    const autofill = body.autofill !== false;
    const txJson: Payment = {
      TransactionType: 'Payment',
      Account: account,
      Destination: destination,
      Amount: amountDrops
    };

    if (typeof destinationTag === 'number') {
      txJson.DestinationTag = destinationTag;
    }

    if (memo) {
      txJson.Memos = [
        {
          Memo: {
            MemoData: Buffer.from(memo, 'utf8').toString('hex').toUpperCase()
          }
        }
      ];
    }

    if (!autofill) {
      return {
        chainId,
        txJson: txJson as unknown as JsonObject
      };
    }

    const client = new Client(this.chainToWsUrl(chainId));
    await client.connect();

    try {
      const autofilled = await client.autofill(txJson as SubmittableTransaction);

      return {
        chainId,
        txJson: autofilled as unknown as JsonObject
      };
    } finally {
      await client.disconnect();
    }
  }

  async submitSigned(input: unknown): Promise<SubmitSignedResult> {
    const body = this.ensureRecord(input);
    const chainId = this.normalizeChainId(this.optionalString(body.chainId) ?? DEFAULT_CHAIN_ID);
    const signedBlob = this.extractSignedBlob(body);
    const client = new Client(this.chainToWsUrl(chainId));
    await client.connect();

    try {
      const response = await client.submitAndWait(signedBlob);
      const result = this.ensureRecord(response.result);
      const meta = this.ensureRecord(result.meta);

      return {
        chainId,
        txHash: this.optionalString(result.hash) ?? null,
        engineResult: this.optionalString(meta.TransactionResult ?? result.engine_result) ?? null,
        validated: typeof result.validated === 'boolean' ? result.validated : null,
        raw: response
      };
    } finally {
      await client.disconnect();
    }
  }

  private extractSignedBlob(body: JsonObject): string {
    const topLevelCandidates = [
      this.optionalString(body.signedTransaction),
      this.optionalString(body.txBlob),
      this.optionalString(body.tx_blob)
    ];
    const nestedResult = this.ensureRecord(body.result);
    const nestedCandidates = [
      this.optionalString(nestedResult.signedTransaction),
      this.optionalString(nestedResult.txBlob),
      this.optionalString(nestedResult.tx_blob)
    ];
    const blob = [...topLevelCandidates, ...nestedCandidates].find((item) => typeof item === 'string');

    if (blob) {
      return blob;
    }

    const txJsonCandidate = this.ensureRecord(body.txJson ?? body.tx_json ?? nestedResult.txJson ?? nestedResult.tx_json);

    if (txJsonCandidate && this.optionalString(txJsonCandidate.TxnSignature) && this.optionalString(txJsonCandidate.SigningPubKey)) {
      return encode(txJsonCandidate as unknown as SubmittableTransaction);
    }

    throw new BadRequestException('Signed transaction payload is required.');
  }

  private extractChainIdFromSession(session: JsonObject): string | undefined {
    const requiredNamespaces = this.ensureRecord(session.requiredNamespaces);
    const xrplNamespace = this.ensureRecord(requiredNamespaces.xrpl);
    const chains = Array.isArray(xrplNamespace.chains) ? xrplNamespace.chains : undefined;
    const firstChain = chains?.find((item) => typeof item === 'string');

    return typeof firstChain === 'string' ? firstChain : undefined;
  }

  private extractAccountFromSession(session: JsonObject): string | undefined {
    const namespaces = this.ensureRecord(session.namespaces);
    const xrplNamespace = this.ensureRecord(namespaces.xrpl);
    const accounts = Array.isArray(xrplNamespace.accounts) ? xrplNamespace.accounts : undefined;
    const first = accounts?.find((item) => typeof item === 'string');

    if (typeof first !== 'string') {
      return undefined;
    }

    const parts = first.split(':');

    return parts[2] ?? undefined;
  }

  private normalizeChainId(chainId: string): string {
    const normalized = chainId.trim().toLowerCase();

    if (!CHAIN_WS_URLS[normalized]) {
      throw new BadRequestException('Unsupported chainId. Use xrpl:0, xrpl:1, or xrpl:2.');
    }

    return normalized;
  }

  private chainToWsUrl(chainId: string): string {
    const endpoint = CHAIN_WS_URLS[chainId];

    if (!endpoint) {
      throw new BadRequestException('Missing XRPL websocket endpoint for chainId.');
    }

    return endpoint;
  }

  private ensureRecord(value: unknown): JsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as JsonObject;
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required.`);
    }

    return value.trim();
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private requiredAccount(value: string | undefined, field: string): string {
    if (!value) {
      throw new BadRequestException(`${field} is required.`);
    }

    if (!isValidAddress(value)) {
      throw new BadRequestException(`${field} must be a valid XRPL classic address.`);
    }

    return value;
  }

  private requiredDrops(value: string | undefined, field: string): string {
    if (!value) {
      throw new BadRequestException(`${field} is required.`);
    }

    if (!/^\d+$/u.test(value)) {
      throw new BadRequestException(`${field} must be a stringified integer in drops.`);
    }

    if (BigInt(value) <= 0n) {
      throw new BadRequestException(`${field} must be greater than zero.`);
    }

    return value;
  }

  private optionalDestinationTag(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const asNumber = typeof value === 'number' ? value : Number(value);

    if (!Number.isInteger(asNumber) || asNumber < 0 || asNumber > 4_294_967_295) {
      throw new BadRequestException('destinationTag must be an integer between 0 and 4294967295.');
    }

    return asNumber;
  }
}
