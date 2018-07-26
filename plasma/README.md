### Running Plasma Client Example
$ cd plasma
$ ganache-cli -m pink two example move shop length clean crop cheese tent strike field

On the next tab:
$ truffle compile
$ truffle migrate

Make sure the Plasma Contract address that is deployed is same as the config file
to Start childchain:
$ npm start

--------
In order to run Client:
$ cd last-client
$ yarn 
$ yarn start

Then, feel free to interact with the dapp (make sure to have your web3.eth.coinbase set to "0x87dbd8ab1bd9d4fce07db12743594a5f456435ff")