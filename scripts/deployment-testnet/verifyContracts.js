require("dotenv").config();
const bre = require("@nomiclabs/buidler");
const openzeppelinUpgrade = require("./.openzeppelin/rinkeby.json");


async function main() {
  console.log({openzeppelinUpgrade});
  for (const property in openzeppelinUpgrade.impls) {
    const address = openzeppelinUpgrade.impls[property].address;
    console.log({address});
    await bre.run("verify",{address});
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

