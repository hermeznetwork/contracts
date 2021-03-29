#!/bin/sh
set -e

URL="http://localhost:8545"
GENESIS=98

genid() {
        python3 -c "import random; print(random.randint(0,2**64), end='')"
}

rpc() {
        local method="$1"
        local params="$2"
        local id=`genid`
        curl -s -X POST --data \ "{\"jsonrpc\":\"2.0\",\
                \"method\":\"${method}\",\
                \"params\":[${params}],\
                \"id\":${id}}" \
                ${URL}
}

minerstop() {
        rpc miner_stop ""
        echo
}

mine() {
        local DATE=$(date +%s)
        rpc evm_mine "${DATE}"
        echo
}

getblock() {
        local result=`rpc eth_getBlockByNumber "\"latest\", false"`
        # echo ${result} | jq
        local block_hex=`echo ${result} | jq .result.number | sed s/\"//g`
        printf "%d" "${block_hex}"
}

if [ "$1" = "nostop" ]; then
    echo "mining for every tx"
else
    minerstop
fi

while [ true ]; do
        block=`getblock`
        printf "blockNum %s\n" ${block}
        if [ $block -gt $GENESIS ]; then
                echo "Reached genesis!"
                break
        fi
        echo "$block <= $GENESIS"
        mine
done


while [ true ]; do
        mine
        sleep 4
done
