#!/bin/sh
set -e

URL="http://localhost:8545"
GENESIS=98

genid() {
        python3 -c "import random; print(random.randint(0,2**64), end='')"
}

mine() {
        local DATE=$(date +%s)
        local id=`genid`
        curl -s -X POST --data \ "{\"jsonrpc\":\"2.0\",\
                \"method\":\"evm_mine\",\
                \"params\":[${DATE}],\
                \"id\":${id}}" \
                ${URL}
        echo
}

getblock() {
        local DATE=$(date +%s)
        local id=`genid`
        local result=`curl -s -X POST --data "{\"jsonrpc\":\"2.0\",\
                \"method\":\"eth_getBlockByNumber\",\
                \"params\":[\"latest\", false],\
                \"id\":${id}}" \
                ${URL}`
        # echo ${result} | jq
        local block_hex=`echo ${result} | jq .result.number | sed s/\"//g`
        printf "%d" "${block_hex}"
}

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
        sleep 2
done
