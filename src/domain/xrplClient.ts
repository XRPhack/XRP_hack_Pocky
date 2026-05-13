import {
  Client,
  type FundingOptions,
  type SubmittableTransaction,
  type TxResponse,
  type Wallet
} from 'xrpl';

export const XRPL_TESTNET_WS = 'wss://s.altnet.rippletest.net:51233';

let sharedClient: Client | null = null;

export async function getClient(): Promise<Client> {
  if (!sharedClient) {
    sharedClient = new Client(XRPL_TESTNET_WS);
  }

  if (!sharedClient.isConnected()) {
    await sharedClient.connect();
  }

  return sharedClient;
}

export async function disconnectClient(): Promise<void> {
  if (!sharedClient) {
    return;
  }

  if (sharedClient.isConnected()) {
    await sharedClient.disconnect();
  }

  sharedClient = null;
}

export async function fundTestWallet(
  wallet?: Wallet | null,
  options?: FundingOptions
): Promise<{ wallet: Wallet; balance: number }> {
  const client = await getClient();

  return client.fundWallet(wallet ?? null, options);
}

export async function submitAndWait<T extends SubmittableTransaction>(
  tx: T,
  wallet: Wallet
): Promise<TxResponse<T>> {
  const client = await getClient();

  return client.submitAndWait(tx, {
    autofill: true,
    wallet
  });
}
