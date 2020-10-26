Guide:

In repository root:

Terminal 1:
    - `npx buidler node`

Terminal 2:
    - Enter in scripts folder
    - Edit `.env.example` adding your ethAddress and save it as `.env`
    - `node deployTest.js`

- every time to forge a batch:
     - Enter in scripts folder
     - Edit `.env` adding HERMEZ_ADDRESS from the previous script
     - `node forgeBatch.js`

- Test some L1Tx:
     - Enter in scripts folder
     - Edit `.env` adding HERMEZ_ADDRESS from the previous script
     - `node forceExit.js` or `node createAccount.js`