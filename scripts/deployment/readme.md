# Guide:

In repository root:

1. Install the dependencies with npm or yarn: `yarn install`

2. Terminal 1: `npx buidler node`

3. If you want to use a custom mnemonic go to the root of the repository and edit `.env.example`, change the variable `MNEMONIC` and save it as `.env`
   The path `m/44'/60'/0'/0` will be used, starting from index '0'
4. Terminal 2: - Enter in `scripts/deployment` folder and edit the `deploy_parameters.json`
   The json contains all the deployment parameters, indexed with a `chainID`
   The `31337` wich is already included, is the chainId of `buidlerevm`

   - The `numAccountsFund` are the number of accounts, starting with index '0' of the mnemonic to fund with ether and HEZ **ether funding only available in evmbuidler enviroment**
   - Then there are some configuration parameters, related with the Smart contracts constructor
   - Lastly are some parameters wich only has more relevance in testnet:

     - Some address which can perform especial operations in the SC, if empty, the accounts in mnemonic will be used in order
     - Finally libraries, if empty, will be deployed

   - A `deploy_output.json` will be created with all the address of the SC created, and the mnemonic index of the relevant accounts

5. Run the deployment script:`node deploy.js`

6. Once the deployment is done, you can create ERC20/ERC777 tokens and add it to the rollup with the following script:
   `node createTokens <options>`

   - `numAccountsFund`: number of accounts, starting with index '0' of the mnemonic to fund with tokens of every token contract deployed. Default: 10
   - `numERC777Deployments`: number of ERC777 tokens deployed. Default: 0
   - `numERC20Deployments`: number of ERC20 tokens deployed. Default: 0
   - `decimalsERC20`: number of decimals of the ERC20, must be a uint8 (max value 255). Default: 18
   - `addTokensBool`: Boolean, if `true` the token will be added to the rollup. Default: true

Example: `node createTokens.js --numERC777Deployments 5 --numERC20Deployments 4` This command will deploy 5 ERC777 and 4 ERC20, will add them to Hermez and will fund the first 10 index of the mnemonic with tokens

- A `tokenList.json` will be created or edited if it's already created with all the tokens added to the Hermez using this script
