#!/usr/bin/env bash

set -o errexit
trap cleanup EXIT

cleanup() {
  if [ -n "$buidlerevm_pid" ] && ps -p $buidlerevm_pid > /dev/null; then
    kill -9 $buidlerevm_pid
  fi
}


start_buidlerevm() {
  node_modules/.bin/buidler node > /dev/null &
  buidlerevm_pid=$!
  sleep 4
}

# BuidlerEVM
start_buidlerevm
REPORT_GAS=true npx buidler test $1 $2 --network reporter