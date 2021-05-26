Steps to upgrade the contracts:

1. npm i
2. update `.env.example` file and save it as `.env`
3. copy `deploy_output.json` from the smart contracts deployment
4. copy `.openzeppelin` file from the smart contract deployment
5. `node deployVerifiers.js`
6. `node verifyVerifiers.js`
7. Check `Hermez.sol` and update `updateVerifiers` for deploying correctly the verifiers
8. `node timeLockUpgrade.js` ( this will deploy the new implementation of the contract, and will prompt all the transactions that msut be done to upgrade it)
