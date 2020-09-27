Guide:

In repository root:

Terminal 1:
    - `npx buidler node`

Terminal 2:
    - Enter in scripts folder
    - Edit `.env.example` adding your ethAddress and save it as `.env`
    - `npx buidler run --network localhost deployTest.js`

- every time to forge a batch:
     - Enter in scripts folder
     - Edit `.env` adding HERMEZ_ADDRESS from the previous script
     - `npx buidler run --network localhost forgeBatch.js`