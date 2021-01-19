#!/bin/sh

SESSION=hermez-ganache
HERMEZ_NODE=${HERMEZ_NODE:-~/git/iden3/hermez/hermez-node}
TMUX="tmux -S hermeztest"

$TMUX -f tmux.conf new-session -d -s $SESSION
$TMUX split-window -d -t 1 -h
$TMUX split-window -d -t 1 -v

# tmux send-keys -t 3 "node_modules/.bin/ganache-cli -d -b 4 -m \"explain tackle mirror kit van hammer degree position ginger unfair soup bonus\" -p 8545 -l 12500000 -a 20 -e 10000 --allowUnlimitedContractSize --chainId 31337" enter
$TMUX send-keys -t 3 "node_modules/.bin/ganache-cli -d -m \"explain tackle mirror kit van hammer degree position ginger unfair soup bonus\" -p 8545 -l 12500000 -a 20 -e 10000 --allowUnlimitedContractSize --chainId 31337" enter
$TMUX send-keys -t 1 "sleep 2 && npx buidler run --network localhostMnemonic scripts/ethclient-deployment/test-deployment.js && ./scripts/ethclient-deployment/mine-loop.sh" enter
$TMUX send-keys -t 2 "cd $HERMEZ_NODE/test/proofserver/cli && go run ." enter
$TMUX attach -t $SESSION
