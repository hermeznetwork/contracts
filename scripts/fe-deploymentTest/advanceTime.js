require("dotenv").config();
const bre = require("@nomiclabs/buidler");
const {time} = require("@openzeppelin/test-helpers");


async function main() {
    
  const timeToAdvance = parseInt(process.env.DELAY ? process.env.DELAY : 60);
  await time.increase(timeToAdvance);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
