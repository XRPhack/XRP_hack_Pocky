import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockClientInstance = {
  url: string;
  connected: boolean;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  isConnected: ReturnType<typeof vi.fn>;
  fundWallet: ReturnType<typeof vi.fn>;
  submitAndWait: ReturnType<typeof vi.fn>;
};

const mockState = {
  instances: [] as MockClientInstance[]
};

async function loadXrplClientModule() {
  vi.doMock('xrpl', () => {
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

  return import('./xrplClient');
}

describe('xrplClient', () => {
  beforeEach(() => {
    mockState.instances.length = 0;
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('exports the XRPL Testnet websocket endpoint and avoids mainnet strings', async () => {
    const { XRPL_TESTNET_WS } = await loadXrplClientModule();

    expect(XRPL_TESTNET_WS).toBe('wss://s.altnet.rippletest.net:51233');
    expect(XRPL_TESTNET_WS).not.toContain('mainnet');
    expect(XRPL_TESTNET_WS).not.toContain('ripplex.io');
  });

  it('creates a reusable client that can be disconnected', async () => {
    const { XRPL_TESTNET_WS, disconnectClient, getClient } = await loadXrplClientModule();
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
    const { fundTestWallet } = await loadXrplClientModule();
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
    const { submitAndWait } = await loadXrplClientModule();
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
