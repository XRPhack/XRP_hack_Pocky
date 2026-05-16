import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  instances: [] as Array<{
    url: string;
    connected: boolean;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
    fundWallet: ReturnType<typeof vi.fn>;
    submitAndWait: ReturnType<typeof vi.fn>;
  }>
}));

vi.mock('xrpl', () => {
  class MockClient {
    url: string;
    connected = false;
    connect = vi.fn(async () => {
      this.connected = true;
    });
    disconnect = vi.fn(async () => {
      this.connected = false;
    });
    isConnected = vi.fn(() => this.connected);
    fundWallet = vi.fn(async (wallet?: unknown, options?: unknown) => ({
      wallet: wallet ?? { classicAddress: 'rTest' },
      balance: 10,
      options
    }));
    submitAndWait = vi.fn(async (tx: unknown, options?: unknown) => ({
      tx,
      options
    }));

    constructor(url: string) {
      this.url = url;
      mockState.instances.push(this);
    }
  }

  return { Client: MockClient };
});

import {
  XRPL_TESTNET_WS,
  disconnectClient,
  fundTestWallet,
  getClient,
  submitAndWait
} from './xrplClient';

describe('xrplClient', () => {
  beforeEach(async () => {
    mockState.instances.length = 0;
    await disconnectClient();
  });

  it('exports the XRPL Testnet websocket endpoint and avoids mainnet strings', () => {
    expect(XRPL_TESTNET_WS).toBe('wss://s.altnet.rippletest.net:51233');
    expect(XRPL_TESTNET_WS).not.toContain('mainnet');
    expect(XRPL_TESTNET_WS).not.toContain('ripplex.io');
  });

  it('creates a reusable client that can be disconnected', async () => {
    const client = await getClient();
    const reusedClient = await getClient();

    expect(mockState.instances).toHaveLength(1);
    expect(mockState.instances[0].url).toBe(XRPL_TESTNET_WS);
    expect(client).toBe(reusedClient);
    expect(mockState.instances[0].connect).toHaveBeenCalledTimes(1);

    await disconnectClient();

    expect(mockState.instances[0].disconnect).toHaveBeenCalledTimes(1);
    expect(mockState.instances[0].connected).toBe(false);
  });

  it('funds a test wallet through the cached client', async () => {
    const result = await fundTestWallet({ classicAddress: 'rTEST' } as never, {
      usageContext: 'nomokdon-test'
    });

    expect(mockState.instances).toHaveLength(1);
    expect(mockState.instances[0].fundWallet).toHaveBeenCalledWith(
      { classicAddress: 'rTEST' },
      { usageContext: 'nomokdon-test' }
    );
    expect(result.balance).toBe(10);
  });

  it('submits a transaction with autofill and wallet signing enabled', async () => {
    const wallet = { classicAddress: 'rWALLET' } as never;
    const tx = { TransactionType: 'Payment' } as never;

    const result = await submitAndWait(tx, wallet);

    expect(mockState.instances).toHaveLength(1);
    expect(mockState.instances[0].submitAndWait).toHaveBeenCalledWith(tx, {
      autofill: true,
      wallet
    });
    expect(result).toBeDefined();
  });
});
