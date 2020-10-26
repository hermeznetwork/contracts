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