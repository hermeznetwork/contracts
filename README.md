# Smart-contracts

Implements Hermez smart contracts

### Install

```
$ yarn install && cp .env.example .env
```

Optional:

- `cp .env.example .env`
- Add your vars to .env after this commnad

### Run tests

- #### Contracts tests

```
$ yarn run test
```

Or for a specific contract:

```
$ yarn run test:hermez
$ yarn run test:auction
$ yarn run test:withdrawalDelayer
```

- #### Contracts Coverage

```
$ yarn run test:coverage
```

Or for a specific contract:

```
$ yarn run test:coverage:hermez
$ yarn run test:coverage:auction
$ yarn run test:coverage:withdrawalDelayer
```

- #### Contracts Gas Report

```
$ yarn run test:gas
```

Or for a specific contract:

```
$ yarn run test:gas:hermez
$ yarn run test:gas:auction
$ yarn run test:gas:withdrawalDelayer
```

### Generate ABI
When requesting a PR to master, it is required to have included the latest contract abis to the `abi` folder. To do this :
```
./getABI.py
```
This script will generate the ABIs and store them to `abi` folder.  When requesting the PR.  GHA will verify that in fact the 
published ABIs match with the ones you include.
