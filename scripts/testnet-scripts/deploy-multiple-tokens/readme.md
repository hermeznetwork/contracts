# Quick Guide

In repository root:

1. `yarn install`
2. `cd scripts/deployment-testnet`
3. Edit the `exmaple.env` with your parameters and save it as `.env`
4. Edit the `deploy_parametes_example.jsom` and save it as `deploy_parametes.jsom`
5. `node deployMultipleTokens.js`
6. `node verifyMultipleTokens.js`

# Guide:

In repository root:

1. Install the dependencies with npm or yarn: `yarn install`

2. Go to `scripts/testnet-scripts/deploy-multiple-tokens`

3. Edit the `.env.example` with your parameters and save it as `.env`
   The account of the mnemonic derived from the the path `m/44'/60'/0'/0` will deploy all the contracts, be assure that has enough ether

4. Edit the `deploy_parameters.json`
   The json it's an array, every field should contain the information of the token that will be deployed as:

   ```
    "name": <tokenName>,
    "symbol": <tokenSymbol>,
    "decimals": <Decimals>,
    "initialAccount": <ether addres> *optional
    "tokenInitalAmount": <initial total supply> *optional
   ```

   If `initialAccount` is no specified, deployer address wil be used
   If `tokenInitialAccount` is not especified, `1.000.000` will be the default amount

5. Run the deployment script:`node deployMultipleTokens.js`

6. (optional) Verify the smart contracts in etherscan!
   - Run `node verifyMultipleTokens.js`
