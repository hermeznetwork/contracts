#!/bin/sh

SESSION=hermez-ganache
HERMEZ_NODE=${HERMEZ_NODE:-~/git/iden3/hermez/hermez-node}
TMUX="tmux -S hermeztest"

$TMUX -f tmux.conf new-session -d -s $SESSION
$TMUX split-window -d -t 1 -h
$TMUX split-window -d -t 1 -v

# tmux send-keys -t 3 "node_modules/.bin/ganache-cli -d -b 4 -m \"explain tackle mirror kit van hammer degree position ginger unfair soup bonus\" -p 8545 -l 12500000 -a 20 -e 10000 --allowUnlimitedContractSize --chainId 31337" enter
$TMUX send-keys -t 3 "node_modules/.bin/ganache-cli -d -m \"explain tackle mirror kit van hammer degree position ginger unfair soup bonus\" -p 8545 -l 12500000 -a 20 -e 10000 --allowUnlimitedContractSize --chainId 31337" enter
MINE_LOOP_ARGS=""

if [ "$1" = "nostop" ]; then
    MINE_LOOP_ARGS="nostop"
    $TMUX send-keys -t 1 "sleep 2 && npx buidler run --network localhostMnemonic scripts/ethclient-deployment/test-deployment.js && ./scripts/ethclient-deployment/mine-loop.sh $MINE_LOOP_ARGS" enter
elif [ "$1" = "hermez-node-test" ]; then
    $TMUX send-keys -t 1 "sleep 2 && npx buidler run --network localhostMnemonic scripts/ethclient-deployment/test-deployment.js" enter
else
    $TMUX send-keys -t 1 "sleep 2 && npx buidler run --network localhostMnemonic scripts/ethclient-deployment/test-deployment.js && ./scripts/ethclient-deployment/mine-loop.sh" enter
fi
$TMUX send-keys -t 2 "cd $HERMEZ_NODE/test/proofserver/cli && go run ." enter
$TMUX attach -t $SESSION
