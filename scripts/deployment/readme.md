# Guide:

In repository root:

1. Install the dependencies with npm or yarn: `yarn install`

2. Terminal 1: `npx buidler node`

3. If you want to use a custom mnemonic go to the root of the repository and edit `.env.example`, change the variable `MNEMONIC` and save it as `.env`
   The path `m/44'/60'/0'/0` will be used, starting from index '0'

4. Terminal 2: - Enter in `scripts/deployment` folder and edit the `deploy_parameters.json`
   The json contains all the deployment parameters, indexed with a `chainID` and the `buidlerNetwork` that buidler will use
   The `31337` which is already included, is the chainId of `buidlerevm`

   - The `numAccountsFund` are the number of accounts, starting with index '0' of the mnemonic to fund with ether and HEZ **ether funding only available in evmbuidler enviroment**
   - Then there are some configuration parameters, related with the Smart contracts constructor
   - Lastly are some parameters which only has more relevance in testnet:

     - Some address which can perform especial operations in the SC, if empty, the accounts in mnemonic will be used in order
     - Finally libraries, if empty, will be deployed

   - A `deploy_output.json` will be created with all the address of the SC created, and the mnemonic index of the relevant accounts

5. Run the deployment script:`node deploy.js`
