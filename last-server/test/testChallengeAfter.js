const ValidatorManagerContract = artifacts.require("ValidatorManagerContract");
const Loo = artifacts.require("Loo");
const RootChain = artifacts.require("RootChain");
import {increaseTimeTo, duration} from './helpers/increaseTime'
import assertRevert from './helpers/assertRevert.js';

const txlib = require('./UTXO.js')

contract("Plasma ERC721 - Exit Spent Coin Challenge / `challengeAfter`", async function(accounts) {

    const t1 = 3600 * 24 * 3; // 3 days later
    const t2 = 3600 * 24 * 5; // 5 days later

    // Alice registers and has 5 coins, and she deposits 3 of them.
    const ALICE_INITIAL_COINS = 5;
    const ALICE_DEPOSITED_COINS = 3;
    const COINS = [1, 2, 3];

    let cards;
    let plasma;
    let vmc;
    let events;
    let t0;

    let [authority, alice, bob, charlie, dylan, elliot, random_guy, random_guy2, challenger] = accounts;

    beforeEach(async function() {
        vmc = await ValidatorManagerContract.new({from: authority});
        plasma = await RootChain.new(vmc.address, {from: authority});
        cards = await Loo.new(plasma.address);
        await vmc.toggleToken(cards.address);
        cards.register({from: alice});
        assert.equal(await cards.balanceOf.call(alice), 5);

        let ret;
        for (let i = 0; i < ALICE_DEPOSITED_COINS; i ++) {
            await cards.depositToPlasma(COINS[i], {from: alice});
        }


        assert.equal((await cards.balanceOf.call(alice)).toNumber(), ALICE_INITIAL_COINS - ALICE_DEPOSITED_COINS);
        assert.equal((await cards.balanceOf.call(plasma.address)).toNumber(), ALICE_DEPOSITED_COINS);

        const depositEvent = plasma.Deposit({}, {fromBlock: 0, toBlock: 'latest'});
        events = await txlib.Promisify(cb => depositEvent.get(cb));

        // Check that events were emitted properly
        let coin;
        for (let i = 0; i < events.length; i++) {
            coin = events[i].args;
            // assert.equal(coin.slot.toNumber(), i);
            assert.equal(coin.blockNumber.toNumber(), i+1);
            assert.equal(coin.denomination.toNumber(), 1);
            assert.equal(coin.from, alice);
        }

    });

    describe('Invalid Exit of UTXO 2', function() {
        it("Charlie tries to exit a spent coin. Dylan challenges in time and exits his coin", async function() {
            let UTXO = {'slot': events[2]['args'].slot, 'block': events[2]['args'].blockNumber.toNumber()};
            let ret = await charlieExitSpentCoin(UTXO);
            let bob_to_charlie = ret.charlie.data;
            let tree_charlie = ret.charlie.tree;
            let charlie_to_dylan = ret.dylan.data;
            let tree_dylan = ret.dylan.tree
            let block_number = 3000; // dylan's TX was included in block 3000

            // Challenge the `Exit Spent Coin`
            let challengeTx = charlie_to_dylan.tx;
            let sig = charlie_to_dylan.sig;
            let proof = tree_dylan.createMerkleProof(UTXO.slot);
            await plasma.challengeAfter(
                UTXO.slot,
                block_number,
                challengeTx,
                proof,
                sig,
                {'from': challenger}
            );
            t0 = (await web3.eth.getBlock('latest')).timestamp;

            await increaseTimeTo( t0 + t1 + t2);
            await plasma.finalizeExits({from: random_guy2});

            // The exit was deleted so Charlie is not able to withdraw the coin
            assertRevert(plasma.withdraw(UTXO.slot, {from: charlie}));

            // Dylan will exit his coin now. This is the same as the cooperative exit case
            let prev_tx_proof = tree_charlie.createMerkleProof(UTXO.slot)
            let prev_tx = bob_to_charlie.tx;
            let exiting_tx = charlie_to_dylan.tx;
            sig = charlie_to_dylan.sig;

            plasma.startExit(
                    UTXO.slot,
                    prev_tx, exiting_tx,
                    prev_tx_proof, proof,
                    sig,
                    [2000, 3000],
                     {'from': dylan, 'value': web3.toWei(0.1, 'ether')}
            );
            t0 = (await web3.eth.getBlock('latest')).timestamp;

            await increaseTimeTo(t0 + t1 + t2);
            await plasma.finalizeExits({from: random_guy2});
            await plasma.withdraw(UTXO.slot, {from : dylan});

            assert.equal(await cards.balanceOf.call(alice), 2);
            assert.equal(await cards.balanceOf.call(bob), 0);
            assert.equal(await cards.balanceOf.call(charlie), 0);
            assert.equal(await cards.balanceOf.call(dylan), 1);
            assert.equal(await cards.balanceOf.call(plasma.address), 2);

            await plasma.withdrawBonds({'from' : challenger});
            await plasma.withdrawBonds({'from' : dylan});
            let withdrewBonds = plasma.WithdrewBonds({}, {fromBlock: 0, toBlock: 'latest'});
            let e = await txlib.Promisify(cb => withdrewBonds.get(cb));
            let withdraw = e[0].args;
            assert.equal(withdraw.from, challenger);
            assert.equal(withdraw.amount, web3.toWei(0.1, 'ether'));
            withdraw = e[1].args;
            assert.equal(withdraw.from, dylan);
            assert.equal(withdraw.amount, web3.toWei(0.1, 'ether'));

        });

        it("Charlie tries to exit a spent coin. Dylan does not challenge in time", async function() {
            let UTXO = {'slot': events[2]['args'].slot, 'block': events[2]['args'].blockNumber.toNumber()};
            await charlieExitSpentCoin(UTXO);

            t0 = (await web3.eth.getBlock('latest')).timestamp;
            await increaseTimeTo( t0 + t1 + t2);
            await plasma.finalizeExits({from: random_guy2 });

            // Charlie can steal the coin
            plasma.withdraw(UTXO.slot, {from : charlie });

            assert.equal(await cards.balanceOf.call(alice), 2);
            assert.equal(await cards.balanceOf.call(bob), 0);
            assert.equal(await cards.balanceOf.call(charlie), 1);
            assert.equal(await cards.balanceOf.call(dylan), 0);
            assert.equal(await cards.balanceOf.call(plasma.address), 2);

            // On the contrary, his bond must be slashed, and `challenger` must be able to claim it
            await txlib.withdrawBonds(plasma, charlie, 0.1)
        });


        it("Alice sends Bob UTXO 2, submits it, Bob holds his coin. Operator colludes and creates an invalid block + tx. Bob tries to exit. Dylan tries to challenged with an invalid spend but fails", async function() {
            let UTXO = {'slot': events[2]['args'].slot, 'block': events[2]['args'].blockNumber.toNumber()};
            let alice_to_bob = txlib.createUTXO(UTXO.slot, UTXO.block, alice, bob);
            let txs = [alice_to_bob.leaf];
            let tree_1000 = await txlib.submitTransactions(authority, plasma, txs);

            // Nevertheless, Charlie pretends he received the coin, and by
            // colluding with the chain operator he is able to include his
            // invalid transaction in a block.
            let charlie_to_dylan = txlib.createUTXO(UTXO.slot, 1000, charlie, dylan);
            txs = [charlie_to_dylan.leaf]
            let invalid_tree = await txlib.submitTransactions(authority, plasma, txs);

            // Bob tries to exit his coin
            let sig = alice_to_bob.sig;
            let utxo = alice_to_bob.tx;
            let proof = tree_1000.createMerkleProof(UTXO.slot);

            let prev_tx = txlib.createUTXO(UTXO.slot, 0, alice, alice).tx;

            await plasma.startExit(
                UTXO.slot,
                prev_tx, utxo,
                '0x0', proof,
                sig,
                [3, 1000],
                {'from': bob, 'value': web3.toWei(0.1, 'ether')}
            );
            t0 = (await web3.eth.getBlock('latest')).timestamp;

            // but Dylan is unable to challenge with his invalid spend!
            utxo = charlie_to_dylan.tx;
            sig = charlie_to_dylan.sig;
            proof = invalid_tree.createMerkleProof(UTXO.slot);

            // Previously this challenge would be successful
            assertRevert(plasma.challengeAfter(
                UTXO.slot,
                2000,
                utxo,
                proof,
                sig,
                {'from': dylan}
            ));

            await increaseTimeTo(t0 + t1 + t2);
            await plasma.finalizeExits({from: random_guy2});
            await plasma.withdraw(UTXO.slot, {from : bob});
            await txlib.withdrawBonds(plasma, bob, 0.1);

        });

        async function charlieExitSpentCoin(UTXO) {

            let alice_to_bob = txlib.createUTXO(UTXO.slot, UTXO.block, alice, bob);
            let txs = [alice_to_bob.leaf]
            let tree_bob = await txlib.submitTransactions(authority, plasma, txs);

            // Tx to Charlie from Bob referencing Bob's UTXO at block 1000
            let bob_to_charlie = txlib.createUTXO(UTXO.slot, 1000, bob, charlie);
            txs = [bob_to_charlie.leaf]
            let tree_charlie = await txlib.submitTransactions(authority, plasma, txs);

            // Tx to Dylan from Charlie referencing Charlie's UTXO at block 2000
            let charlie_to_dylan = txlib.createUTXO(UTXO.slot, 2000, charlie, dylan);
            txs = [charlie_to_dylan.leaf]
            let tree_dylan = await txlib.submitTransactions(authority, plasma, txs);

            // Concatenate the 2 signatures
            let sig = bob_to_charlie.sig;

            let prev_tx_proof = tree_bob.createMerkleProof(UTXO.slot)
            let exiting_tx_proof = tree_charlie.createMerkleProof(UTXO.slot)

            let prev_tx = alice_to_bob.tx;
            let exiting_tx = bob_to_charlie.tx;

            // Charlie exits the coin, even though he sent the tx to Dylan.
            plasma.startExit(
                    UTXO.slot,
                    prev_tx, exiting_tx,
                    prev_tx_proof, exiting_tx_proof,
                    sig,
                    [1000, 2000],
                     {'from': charlie, 'value': web3.toWei(0.1, 'ether')}
            );

            return {
                'charlie': {'data': bob_to_charlie, 'tree': tree_charlie},
                'dylan': {'data': charlie_to_dylan, 'tree': tree_dylan}
            };
        }
    });

    describe('Invalid Exit of UTXO 0', function() {
        it("Alice gives a coin to Bob and Charlie and immediately tries to exit Bob's coin. Gets Challenged.", async function() {

            let UTXO = [{'slot': events[0]['args'].slot, 'block': events[0]['args'].blockNumber.toNumber()},
                        {'slot': events[2]['args'].slot, 'block': events[2]['args'].blockNumber.toNumber()}];
            let alice_to_bob = txlib.createUTXO(UTXO[0].slot, UTXO[0].block, alice, bob);
            let alice_to_charlie = txlib.createUTXO(UTXO[1].slot, UTXO[1].block, alice, charlie);
            let txs = [alice_to_bob.leaf, alice_to_charlie.leaf]
            let tree = await txlib.submitTransactions(authority, plasma, txs);

            let slot = UTXO[0].slot;
            let ret = txlib.createUTXO(slot, 0, alice, alice);
            let utxo = ret.tx;
            let sig = ret.sig

            await plasma.startExit(
                     slot,
                    '0x', utxo,
                    '0x0', '0x0',
                     sig,
                     [0, UTXO[0].block],
                     {'from': alice, 'value': web3.toWei(0.1, 'ether')}
            );

            let challengeTx = alice_to_bob.tx;
            sig = alice_to_bob.sig;
            let proof = tree.createMerkleProof(slot);
            await plasma.challengeAfter(
                slot, 1000, challengeTx, proof, sig,
                {'from': challenger}
            );
            t0 = (await web3.eth.getBlock('latest')).timestamp;
            await increaseTimeTo(t0 + t1 + t2);
            await plasma.finalizeExits({from: random_guy2});
            assertRevert(plasma.withdraw(slot, {from : alice}));
            assert.equal(await cards.balanceOf.call(alice), 2);
            assert.equal(await cards.balanceOf.call(bob), 0);
            assert.equal(await cards.balanceOf.call(plasma.address), 3);

            await txlib.withdrawBonds(plasma, challenger, 0.1);
        });

        it("Alice gives a coin to Bob and Charlie. Bob gives a coin to Charlie and immediately tries to exit it. Gets Challenged", async function() {
            let UTXO = [{'slot': events[0]['args'].slot, 'block': events[0]['args'].blockNumber.toNumber()},
                        {'slot': events[2]['args'].slot, 'block': events[2]['args'].blockNumber.toNumber()}];
            let alice_to_bob = txlib.createUTXO(UTXO[0].slot, UTXO[0].block, alice, bob);
            let alice_to_charlie = txlib.createUTXO(UTXO[1].slot, UTXO[1].block, alice, charlie);
            let txs = [alice_to_bob.leaf, alice_to_charlie.leaf]
            let tree1 = await txlib.submitTransactions(authority, plasma, txs);

            let bob_to_charlie = txlib.createUTXO(UTXO[0].slot, 1000, bob, charlie);
            txs = [bob_to_charlie.leaf];
            let tree2 = await txlib.submitTransactions(authority, plasma, txs);

            let slot = UTXO[0].slot;
            let sig = alice_to_bob.sig;
            let exiting_tx_proof = tree1.createMerkleProof(slot);

            let prev_tx = txlib.createUTXO(slot, 0, alice, alice).tx;
            let exiting_tx = alice_to_bob.tx;
            await plasma.startExit(
                     slot,
                     prev_tx, exiting_tx,
                     '0x0', exiting_tx_proof,
                     sig,
                     [UTXO[0].block, 1000],
                     {'from': bob, 'value': web3.toWei(0.1, 'ether')}
            );

            let challengeTx = bob_to_charlie.tx;
            sig = bob_to_charlie.sig;
            let proof = tree2.createMerkleProof(slot);
            await plasma.challengeAfter(
                slot, 2000, challengeTx, proof, sig,
                {'from': challenger}
            );

            t0 = (await web3.eth.getBlock('latest')).timestamp;
            await increaseTimeTo(t0 + t1 + t2);
            await plasma.finalizeExits({from: random_guy2});
            assertRevert(plasma.withdraw(0, {from : bob}));

            assert.equal(await cards.balanceOf.call(alice), 2);
            assert.equal(await cards.balanceOf.call(bob), 0);
            assert.equal(await cards.balanceOf.call(plasma.address), 3);

            await txlib.withdrawBonds(plasma, challenger, 0.1);
        });
    });
});
