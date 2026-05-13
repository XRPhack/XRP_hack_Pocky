import { writeFile } from 'node:fs/promises'

import type { TxResponse, Wallet } from 'xrpl'

import { submitCreate, submitAccept } from '../src/domain/xrplCredential'
import { submitDidSet } from '../src/domain/xrplDid'
import { submitEscrowCreate } from '../src/domain/xrplEscrow'
import { disconnectClient, fundTestWallet, XRPL_TESTNET_WS } from '../src/domain/xrplClient'
import { submitRentPayment } from '../src/domain/xrplPayment'

const TESTNET_EXPLORER_BASE_URL = 'https://testnet.xrpl.org/transactions'
const OUTPUT_FILE = new URL('./demo-fixtures.json', import.meta.url)

const persona = {
  id: 'mina-p',
  displayName: 'Mina P.',
  nationality: 'Philippines',
  visaType: 'D-4',
  visaExpiresAt: '2027-05-12T00:00:00.000Z',
  schoolOrEmployer: 'Nomok Language Institute',
  monthlyIncomeKrw: 2_900_000
} as const

type AccountRole = 'tenant' | 'issuer' | 'landlord'

type PublicAccount = {
  role: AccountRole
  address: string
}

type PublicTransaction = {
  label: string
  transactionType: string
  hash: string
  validated: boolean
  ledgerIndex?: number
  ledgerDate?: string
  explorerUrl: string
  submittedBy: AccountRole
  account: string
}

type DemoFixtures = {
  generatedAt: string
  network: {
    name: 'XRPL Testnet'
    websocket: typeof XRPL_TESTNET_WS
    explorerBaseUrl: typeof TESTNET_EXPLORER_BASE_URL
  }
  persona: typeof persona
  accounts: Record<AccountRole, PublicAccount>
  transactions: PublicTransaction[]
}

type TxResult = {
  hash?: string
  validated?: boolean
  ledger_index?: number
  close_time_iso?: string
  meta?: string | { TransactionResult?: string }
  tx_json?: {
    Account?: string
    TransactionType?: string
    hash?: string
    date?: number
  }
}

type PublicTxResponse = TxResponse & {
  result?: TxResult
}

function assertTestnetEndpoint(endpoint: string): void {
  const isApprovedTestnet = endpoint === XRPL_TESTNET_WS

  if (!isApprovedTestnet) {
    throw new Error(`Only the approved XRPL Testnet endpoint is allowed: ${XRPL_TESTNET_WS}`)
  }
}

function assertEndpointOverridesAreSafe(): void {
  for (const key of ['XRPL_WS', 'XRPL_SERVER', 'XRPL_WEBSOCKET_URL', 'VITE_XRPL_WS']) {
    const endpoint = process.env[key]

    if (endpoint) {
      assertTestnetEndpoint(endpoint)
    }
  }

  assertTestnetEndpoint(XRPL_TESTNET_WS)
}

function accountAddress(wallet: Wallet): string {
  return wallet.classicAddress
}

function transactionResult(response: TxResponse): TxResult {
  return (response as PublicTxResponse).result ?? {}
}

function transactionSucceeded(result: TxResult): boolean {
  if (typeof result.meta === 'string') {
    return result.meta === 'tesSUCCESS'
  }

  return result.meta?.TransactionResult === 'tesSUCCESS'
}

function toPublicTransaction({
  response,
  label,
  fallbackType,
  submittedBy
}: {
  response: TxResponse
  label: string
  fallbackType: string
  submittedBy: AccountRole
}): PublicTransaction {
  const result = transactionResult(response)
  const hash = result.hash ?? result.tx_json?.hash
  const validated = result.validated === true
  const succeeded = transactionSucceeded(result)

  if (!hash) {
    throw new Error(`${label} did not return a transaction hash from Testnet.`)
  }

  if (!validated || !succeeded) {
    throw new Error(`${label} was submitted but not validated successfully. Check Testnet availability, faucet funding, and amendment support.`)
  }

  return {
    label,
    transactionType: result.tx_json?.TransactionType ?? fallbackType,
    hash,
    validated,
    ledgerIndex: result.ledger_index,
    ledgerDate: result.close_time_iso,
    explorerUrl: `${TESTNET_EXPLORER_BASE_URL}/${hash}`,
    submittedBy,
    account: result.tx_json?.Account ?? 'unavailable'
  }
}

async function fundDemoWallet(role: AccountRole): Promise<Wallet> {
  console.log(`Funding ${role} Testnet account...`)
  const { wallet } = await fundTestWallet()

  console.log(`${role}: ${accountAddress(wallet)}`)
  return wallet
}

async function main(): Promise<void> {
  assertEndpointOverridesAreSafe()

  const issuerWallet = await fundDemoWallet('issuer')
  const tenantWallet = await fundDemoWallet('tenant')
  const landlordWallet = await fundDemoWallet('landlord')

  const issuer = accountAddress(issuerWallet)
  const tenant = accountAddress(tenantWallet)
  const landlord = accountAddress(landlordWallet)
  const credentialExpiresAt = '2027-05-12T00:00:00.000Z'

  const submitted: PublicTransaction[] = []

  async function record(
    label: string,
    fallbackType: string,
    submittedBy: AccountRole,
    submit: () => Promise<TxResponse>
  ): Promise<void> {
    console.log(`Submitting ${label}...`)
    const response = await submit()
    const publicTx = toPublicTransaction({ response, label, fallbackType, submittedBy })

    submitted.push(publicTx)
    console.log(`${label}: ${publicTx.hash} validated in ledger ${publicTx.ledgerIndex ?? 'unknown'}`)
  }

  await record('Mina P. DIDSet', 'DIDSet', 'tenant', () =>
    submitDidSet(tenantWallet, {
      account: tenant,
      purpose: 'NomokDon tenant trust profile for Mina P.'
    })
  )

  await record('Visa CredentialCreate', 'CredentialCreate', 'issuer', () =>
    submitCreate(issuerWallet, {
      issuer,
      subject: tenant,
      type: 'nomokdon-visa',
      uri: 'https://nomokdon.app/credentials/mina-p/visa.json',
      expiration: credentialExpiresAt
    })
  )

  await record('Visa CredentialAccept', 'CredentialAccept', 'tenant', () =>
    submitAccept(tenantWallet, {
      tenant,
      issuer,
      type: 'nomokdon-visa'
    })
  )

  await record('Rent reputation CredentialCreate', 'CredentialCreate', 'issuer', () =>
    submitCreate(issuerWallet, {
      issuer,
      subject: tenant,
      type: 'nomokdon-rent-reputation',
      uri: 'https://nomokdon.app/credentials/mina-p/rent-reputation.json',
      expiration: credentialExpiresAt
    })
  )

  await record('Rent reputation CredentialAccept', 'CredentialAccept', 'tenant', () =>
    submitAccept(tenantWallet, {
      tenant,
      issuer,
      type: 'nomokdon-rent-reputation'
    })
  )

  await record('Reservation EscrowCreate', 'EscrowCreate', 'tenant', () =>
    submitEscrowCreate(
      {
        account: tenant,
        destination: landlord,
        amountDrops: '2000000',
        finishAfter: '2026-05-17T00:00:00.000Z',
        cancelAfter: '2026-06-30T00:00:00.000Z'
      },
      tenantWallet
    )
  )

  await record('May rent Payment with memo', 'Payment', 'tenant', () =>
    submitRentPayment(tenantWallet, {
      tenant,
      landlord,
      amountDrops: '1000000',
      rentData: {
        personaId: persona.id,
        period: '2026-05',
        amountKrw: 850_000,
        status: 'paid'
      }
    })
  )

  const fixtures: DemoFixtures = {
    generatedAt: new Date().toISOString(),
    network: {
      name: 'XRPL Testnet',
      websocket: XRPL_TESTNET_WS,
      explorerBaseUrl: TESTNET_EXPLORER_BASE_URL
    },
    persona,
    accounts: {
      tenant: { role: 'tenant', address: tenant },
      issuer: { role: 'issuer', address: issuer },
      landlord: { role: 'landlord', address: landlord }
    },
    transactions: submitted
  }

  await writeFile(OUTPUT_FILE, `${JSON.stringify(fixtures, null, 2)}\n`, 'utf8')
  console.log(`Wrote public demo fixture with ${submitted.length} validated transactions to ${OUTPUT_FILE.pathname}`)
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)

    console.error(`Demo Testnet setup failed: ${message}`)
    console.error('Action: retry after confirming XRPL Testnet websocket reachability, faucet availability, and Credential transaction support.')
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectClient()
  })
