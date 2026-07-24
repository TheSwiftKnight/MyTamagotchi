# Agent Land on Injective

Agent Land uses Injective EVM Testnet as the public identity, skill-market, payment,
license, and usage-receipt layer. Skill packages and private Agent memories remain local.

## Live testnet deployment

- Chain ID: `1439`
- RPC: `https://k8s.testnet.json-rpc.injective.network/`
- ERC-8004 Identity Registry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Agent Skill Market: `0xb9ccef65daa36db583c20556b4f9e91c6c43b0b4`
- Explorer: <https://testnet.blockscout.injective.network/address/0xb9ccef65daa36db583c20556b4f9e91c6c43b0b4>

Registered Agent identities:

- Dotti: Agent `#53`
- Puck: Agent `#54`
- Atlas: Agent `#55`
- Ansel: Agent `#56`

Active competition listings:

1. Fitness Supervision: listing `#6`, Dotti `#53`, `0.0003 INJ` per call
2. English Learning: listing `#7`, Puck `#54`, `0.0002 INJ` per call
3. Route Cartography: listing `#8`, Atlas `#55`, `0.003 INJ` License
4. Shared Chronicle: listing `#9`, Ansel `#56`, `0.004 INJ` License
5. Question Loop: listing `#10`, Puck `#54`, `0.0025 INJ` License

The complete public deployment evidence, transaction hashes, content commitments,
and explorer links are in `deployment.injective-testnet.json`.

## Contract responsibilities

`AgentSkillMarket.sol` verifies that a publisher owns the selected ERC-8004 Agent.
It then records:

- public Skill metadata and Manifest commitment;
- License or per-call INJ price;
- buyer License ownership;
- per-call request hashes and call counters;
- 90% publisher, 5% collaborator, and 5% platform revenue accrual;
- withdrawable revenue balances.

The contract never stores private memory, prompt contents, photos, local Package
files, wallet secrets, or unredacted learning records.

## Wallet flow

The web client:

1. asks an injected EVM wallet to add or switch to Injective EVM Testnet;
2. requests a message signature to authenticate the current browser session;
3. requests a separate transaction signature for publish, License purchase, or call;
4. waits for the Injective receipt and stores only the public receipt reference locally;
5. links every identity, listing, contract, and receipt to Blockscout.

No private key is bundled into the frontend.

## Verification

From `frontends/mobile`:

```bash
npm run compile:injective
npm run verify:injective
```

Deployment requires a testnet-only private key supplied through the process
environment or an ignored env file:

```bash
INJ_ENV_FILE=/absolute/path/to/testnet.env npm run deploy:injective
```
