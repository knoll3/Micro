# Micro

A simple implementation of a micro payament system on the ethereum network.

This allows an organization to collect micropayments from any number of subscribers without requiring an on chain transaction for each payment. Use cases include a shopping site where customers pay in small quantities, a game to facilitate in-game micro-transactions, and much more.

# How it works

1. The contract owner deploys a single Micro contract with the MicroToken ERC20 contract.
2. A subscriber (or customer) deposits tokens into the contract. The subscriber will need to make an on-chain transaction for this.
3. The subscriber purchases something from the contract owner off-chain.
4. The subscriber signs a message containing various meta data including the amount that is to be paid and sends it to the owner off-chain.
5. The owner validates and saves this signature off-chain as well as signatures from other subscribers.
6. If the subscriber purchases something else, the subscriber signs another message containing the previous amount plus the cost of the item being purchased and sends it to the owner.
7. The owner discards the previous signatures and keeps the new one (since it is greater in value).
8. On a periodic basis, the owner claims the payments from the contract by submitting the subscribers' signatures to be verfied by the contract. The owner will need to make an on-chain transaction for this.

## Notes

- All payments are facilitated with the ERC20 MicroToken, but could be modified to just use ETH.
- When the owner claims payments they only use one signature per subscriber. Naturally they will use the one with the largest amount.
- Each new signature from a subscriber contains the same nonce which prevents the owner from using multiple signatures from the same subscriber.
- The owner can and should verify signatures off chain.
- The transaction fees to claim payments ranges from $1.00 to $5.00 per subscriber in ETH depending on the price of gas and the price of ETH.
- Protocol fees could be collected on a monthly basis from subscribers to cover the transction costs of claiming payments.

# Advanced Sample Hardhat Project

This project demonstrates an advanced Hardhat use case, integrating other tools commonly used alongside Hardhat in the ecosystem.

The project comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts. It also comes with a variety of other tools, preconfigured to work with the project code.

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
npx hardhat help
REPORT_GAS=true npx hardhat test
npx hardhat coverage
npx hardhat run scripts/deploy.ts
TS_NODE_FILES=true npx ts-node scripts/deploy.ts
npx eslint '**/*.{js,ts}'
npx eslint '**/*.{js,ts}' --fix
npx prettier '**/*.{json,sol,md}' --check
npx prettier '**/*.{json,sol,md}' --write
npx solhint 'contracts/**/*.sol'
npx solhint 'contracts/**/*.sol' --fix
```

# Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Ropsten.

In this project, copy the .env.example file to a file named .env, and then edit it to fill in the details. Enter your Etherscan API key, your Ropsten node URL (eg from Alchemy), and the private key of the account which will send the deployment transaction. With a valid .env file in place, first deploy your contract:

```shell
hardhat run --network ropsten scripts/deploy.ts
```

Then, copy the deployment address and paste it in to replace `DEPLOYED_CONTRACT_ADDRESS` in this command:

```shell
npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS "Hello, Hardhat!"
```

# Performance optimizations

For faster runs of your tests and scripts, consider skipping ts-node's type checking by setting the environment variable `TS_NODE_TRANSPILE_ONLY` to `1` in hardhat's environment. For more details see [the documentation](https://hardhat.org/guides/typescript.html#performance-optimizations).
