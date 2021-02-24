#!/usr/bin/env bash

set -o errexit
trap cleanup EXIT

cleanup() {
  if [ -n "$hardhatevm_pid" ] && ps -p $hardhatevm_pid > /dev/null; then
    kill -9 $hardhatevm_pid
  fi
}


start_hardhatevm() {
  node_modules/.bin/hardhat node > /dev/null &
  hardhatevm_pid=$!
  sleep 4
}

# hardhatEVM
start_hardhatevm
REPORT_GAS=true npx hardhat test $1 $2 --network reporter