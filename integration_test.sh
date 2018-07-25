#!/bin/bash

function cleanup {
    kill -TERM $flask_pid
    kill -9 $ganache_pid
}

trap cleanup EXIT

cd last-server
ganache_pid=$(npm run --silent migrate:dev)
echo 'Launched ganache' $ganache_pid

cd ../plasma-cash
FLASK_APP=./child_chain FLASK_ENV=development flask run --port=8546 &
flask_pid=$!
echo 'Launched flask' $flask_pid

sleep 3

# python demo.py
# python challenge_after_demo.py
# python challenge_between_demo.py
# python challenge_before_demo.py
# python auto_respond_challenge.py
python loo-demo.py
