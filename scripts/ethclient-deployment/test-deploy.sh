#!/bin/bash

gnome-terminal -- npx buidler node

npx buidler run --network localhost test-deployment.js

exit