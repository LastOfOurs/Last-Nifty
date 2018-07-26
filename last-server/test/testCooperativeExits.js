const ValidatorManagerContract = artifacts.require("ValidatorManagerContract");
const Loo = artifacts.require("Loo");
const RootChain = artifacts.require("RootChain");
import {increaseTimeTo, duration} from './helpers/increaseTime'
import assertRevert from './helpers/assertRevert.js';

const txlib = require('./UTXO.js')

contract("Plasma ERC721 - Cooperative Exits, no challenges", async function(accounts) {

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

    let data;
    let deposit_to_alice = [];

    beforeEach(async function() {
        vmc = await ValidatorManagerContract.new({from: authority});
        plasma = await RootChain.new(vmc.address, {from: authority});
        cards = await Loo.new(plasma.address);
        await vmc.toggleToken(cards.address);
        await cards.register({from: alice});
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

    describe('Exit of UTXO 2 (Coin 3)', async function() {
        it('Directly after its deposit', async function() {
            let UTXO = {'slot': events[2]['args'].slot, 'block': events[2]['args'].blockNumber.toNumber()};
            // Prevblock = 0 because we're exiting a tx
            // directly after being minted in the plasma chain
            let prevBlock = 0;

            let ret = txlib.createUTXO(UTXO.slot, prevBlock, alice, alice);
            let utxo = ret.tx;
            let sig = ret.sig;

            await plasma.startExit(
                     UTXO.slot,
                    '0x', utxo,
                    '0x0', '0x0',
                     sig,
                     [prevBlock, UTXO.block],
                     {'from': alice, 'value': web3.toWei(0.1, 'ether')}
            );

            t0 = (await web3.eth.getBlock('latest')).timestamp;

            await increaseTimeTo(t0 + t1);
            await plasma.finalizeExits({from: random_guy2});
            assertRevert(plasma.withdraw(UTXO.slot, {from: alice}));
            assert.equal(await cards.balanceOf.call(alice), 2);
            assert.equal(await cards.balanceOf.call(plasma.address), 3);

            await increaseTimeTo(t0 + t1 + t2);
            await plasma.finalizeExits({from: random_guy2});
            await plasma.withdraw(UTXO.slot, {from: alice});
            assert.equal(await cards.balanceOf.call(alice), 3);
            assert.equal((await cards.balanceOf.call(plasma.address)).toNumber(), 2);

            await txlib.withdrawBonds(plasma, alice, 0.1);
        });

        it('After 1 Plasma-Chain transfer', async function() {
            let UTXO = {'slot': events[2]['args'].slot, 'block': events[2]['args'].blockNumber.toNumber()};
            let prevBlock = UTXO.block;
            // Create a UTXO to Bob from Alice and sign it. Refer to Alice's deposit transaction at block 3
            let alice_to_bob = txlib.createUTXO(UTXO.slot, prevBlock, alice, bob);
            let txs = [alice_to_bob.leaf]
            // Authority submits a block to plasma with that transaction included
            let tree_bob = await txlib.submitTransactions(authority, plasma, txs);
            let submittedBlock = 1000;

            let sig = alice_to_bob.sig;
            let exiting_tx_proof = tree_bob.createMerkleProof(UTXO.slot)

            let prev_tx = txlib.createUTXO(UTXO.slot, 0, alice, alice).tx; // deposit to alice
            let exiting_tx = alice_to_bob.tx;

            plasma.startExit(
                    UTXO.slot,
                    prev_tx , exiting_tx,
                    '0x0', exiting_tx_proof,
                    sig,
                    [prevBlock, submittedBlock], // Prev tx was included in block 3, exiting tx was included in block 1000
                     {'from': bob, 'value': web3.toWei(0.1, 'ether')}
            );
            t0 = (await web3.eth.getBlock('latest')).timestamp;

            // Even though the coin still belongs to Alice, it is in the `EXITING` state so it shouldn't be possible for her to exit it
            assertRevert(plasma.withdraw(UTXO.slot, {from: alice}));

            // If enough time hasn't passed, neither bob nor alice should be able to withdraw the coin
            await increaseTimeTo(t0 + t1);
            await plasma.finalizeExits({from: random_guy2});
            assertRevert(plasma.withdraw(UTXO.slot, {from: alice}));
            assertRevert(plasma.withdraw(UTXO.slot, {from: bob}));
            assert.equal(await cards.balanceOf.call(alice), 2);
            assert.equal(await cards.balanceOf.call(bob), 0);
            assert.equal(await cards.balanceOf.call(plasma.address), 3);

            // After the exit is matured and finalized, bob can withdraw the coin.
            await increaseTimeTo(t0 + t1 + t2);
            await plasma.finalizeExits({from: random_guy2});
            assertRevert(plasma.withdraw(UTXO.slot, {from: alice}));
            await plasma.withdraw(UTXO.slot, {from : bob});
            assert.equal((await cards.balanceOf.call(alice)).toNumber(), 2);
            assert.equal((await cards.balanceOf.call(bob)).toNumber(), 1);
            assert.equal((await cards.balanceOf.call(plasma.address)).toNumber(), 2);

            // Bob is also able to withdraw his deposit bond of 0.1 ether
            await txlib.withdrawBonds(plasma, bob, 0.1);
        });

        it("After 2 Plasma-Chain transfers", async function() {
            let UTXO = {'slot': events[2]['args'].slot, 'block': events[2]['args'].blockNumber.toNumber()};
            let alice_to_bob = txlib.createUTXO(UTXO.slot, UTXO.block, alice, bob);
            let txs = [alice_to_bob.leaf];
            let tree_bob = await txlib.submitTransactions(authority, plasma, txs);

            await plasma.submitBlock('0x0', {from: authority});

            // Tx to Charlie from Bob referencing Bob's UTXO at block 1000
            let prevBlock = 1000;
            let bob_to_charlie = txlib.createUTXO(UTXO.slot, prevBlock, bob, charlie);
            txs = [bob_to_charlie.leaf];


            let tree_charlie = await txlib.submitTransactions(authority, plasma, txs);

            let exitBlock = 3000;

            // Concatenate the 2 signatures
            let sig = bob_to_charlie.sig

            let prev_tx_proof = tree_bob.createMerkleProof(UTXO.slot)
            let exiting_tx_proof = tree_charlie.createMerkleProof(UTXO.slot)

            let prev_tx = alice_to_bob.tx;
            let exiting_tx = bob_to_charlie.tx;

            plasma.startExit(
                    UTXO.slot,
                    prev_tx, exiting_tx,
                    prev_tx_proof, exiting_tx_proof,
                    sig,
                    [prevBlock, exitBlock],
                    {'from': charlie, 'value': web3.toWei(0.1, 'ether')}
            );
            t0 = (await web3.eth.getBlock('latest')).timestamp;

            // Even though the coin still belongs to Alice, it is in the `EXITING` state so it shouldn't be possible for her to exit it
            assertRevert(plasma.withdraw(UTXO.slot, {from: alice}));

            // If enough time hasn't passed, none of bob, alice or charlie should be able to withdraw the coin
            await increaseTimeTo(t0 + t1);
            await plasma.finalizeExits({from: random_guy2});
            assertRevert(plasma.withdraw(UTXO.slot, {from: alice}));
            assertRevert(plasma.withdraw(UTXO.slot, {from: bob}));
            assertRevert(plasma.withdraw(UTXO.slot, {from: charlie}));
            assert.equal(await cards.balanceOf.call(alice), 2);
            assert.equal(await cards.balanceOf.call(bob), 0);
            assert.equal(await cards.balanceOf.call(charlie), 0);
            assert.equal(await cards.balanceOf.call(plasma.address), 3);

            // After the exit is matured and finalized, Charlie can withdraw the coin.
            await increaseTimeTo(t0 + t1 + t2);
            await plasma.finalizeExits({from: random_guy2});
            assertRevert(plasma.withdraw(UTXO.slot, {from: alice}));
            assertRevert(plasma.withdraw(UTXO.slot, {from: bob}));
            await plasma.withdraw(UTXO.slot, {from : charlie});
            assert.equal(await cards.balanceOf.call(alice), 2);
            assert.equal(await cards.balanceOf.call(bob), 0);
            assert.equal(await cards.balanceOf.call(charlie), 1);
            assert.equal(await cards.balanceOf.call(plasma.address), 2);

            // Charlie is also able to withdraw his deposit bond of 0.1 ether
            await txlib.withdrawBonds(plasma, charlie, 0.1);
        });

        it("Dylan tries to steal Charlie's coin by providing an exit for it, fails", async function() {
            let UTXO = {'slot': events[2]['args'].slot, 'block': events[2]['args'].blockNumber.toNumber()};
            let alice_to_bob = txlib.createUTXO(UTXO.slot, UTXO.block, alice, bob);
            let txs = [alice_to_bob.leaf];
            let tree_bob = await txlib.submitTransactions(authority, plasma, txs);

            await plasma.submitBlock('0x0', {from: authority});

            // Tx to Charlie from Bob referencing Bob's UTXO at block 1000
            let prevBlock = 1000;
            let bob_to_charlie = txlib.createUTXO(UTXO.slot, prevBlock, bob, charlie);
            txs = [bob_to_charlie.leaf];


            let tree_charlie = await txlib.submitTransactions(authority, plasma, txs);

            let exitBlock = 3000;

            // Concatenate the 2 signatures
            let sig = bob_to_charlie.sig

            let prev_tx_proof = tree_bob.createMerkleProof(UTXO.slot)
            let exiting_tx_proof = tree_charlie.createMerkleProof(UTXO.slot)

            let prev_tx = alice_to_bob.tx;
            let exiting_tx = bob_to_charlie.tx;

            // Dylan cannot submit an exit for Charlie's coin
            assertRevert(plasma.startExit(
                    UTXO.slot,
                    prev_tx, exiting_tx,
                    prev_tx_proof, exiting_tx_proof,
                    sig,
                    [prevBlock, exitBlock],
                    {'from': dylan, 'value': web3.toWei(0.1, 'ether')}
            ));
        });

    });

    // If it works for 2 coins, proof by induction it will work for N coins >2
    describe('Exit of UTXO 1 and 2', async function() {
        it('Alice gives Bob 2 coins who exits both', async function() {
            let UTXO = [{'slot': events[1]['args'].slot, 'block': events[1]['args'].blockNumber.toNumber()},
                        {'slot': events[2]['args'].slot, 'block': events[2]['args'].blockNumber.toNumber()}];
            let alice_to_bob = {};
            let txs = [];
            let tx;
            for (let i in UTXO) {
                let aUTXO = UTXO[i];
                tx = txlib.createUTXO(aUTXO.slot, aUTXO.block, alice, bob);
                alice_to_bob[aUTXO.slot] = tx;
                txs.push(tx.leaf);
            }

            // Tree contains both transactions
            let tree_bob = await txlib.submitTransactions(authority, plasma, txs);
            let exitBlock = 1000;
            // Block 1000 has now been checkpointed with both transactions that give ownership of the coins to Bob
            // UTXO 1 was deposited at Block 2, UTXO 2 was created at block 3

            let prev_tx, exiting_tx, prev_tx_proof, exiting_tx_proof, sig;
            let slot;

            for (let i in UTXO) {
                let aUTXO = UTXO[i];
                slot = aUTXO.slot;

                prev_tx = txlib.createUTXO(slot, 0, alice, alice).tx;
                exiting_tx = alice_to_bob[slot].tx;
                sig = alice_to_bob[slot].sig;

                prev_tx_proof = '0x0';
                exiting_tx_proof = tree_bob.createMerkleProof(slot);

                await plasma.startExit(
                        slot,
                        prev_tx, exiting_tx,
                        prev_tx_proof, exiting_tx_proof,
                        sig,
                        [aUTXO.block, exitBlock],
                         {'from': bob, 'value': web3.toWei(0.1, 'ether')}
                );
            }
            t0 = (await web3.eth.getBlock('latest')).timestamp;

            // Even though the coin still belongs to Alice, it is in the `EXITING` state so it shouldn't be possible for her to exit it
            UTXO.forEach(function(aUTXO) {
                assertRevert(plasma.withdraw(aUTXO.slot, {from : alice}));
            });

            // If enough time hasn't passed, neither bob nor alice should be able to withdraw the coin
            await increaseTimeTo(t0 + t1);
            await plasma.finalizeExits({from: random_guy2});
            UTXO.forEach(function(aUTXO) {
                assertRevert(plasma.withdraw(aUTXO.slot, {from: alice}));
                assertRevert(plasma.withdraw(aUTXO.slot, {from: bob}));
            });

            assert.equal(await cards.balanceOf.call(alice), 2);
            assert.equal(await cards.balanceOf.call(bob), 0);
            assert.equal(await cards.balanceOf.call(plasma.address), 3);

            // After the exit is matured and finalized, bob can withdraw the coin.
            await increaseTimeTo(t0 + t1 + t2);
            await plasma.finalizeExits({from: random_guy2});
            UTXO.forEach(async function(aUTXO) {
                assertRevert(plasma.withdraw(aUTXO.slot, {from : alice}));
                await plasma.withdraw(aUTXO.slot, {from : bob});
            });
            assert.equal(await cards.balanceOf.call(alice), 2);
            assert.equal(await cards.balanceOf.call(bob), 2);
            assert.equal(await cards.balanceOf.call(plasma.address), 1);

            // Bob is also able to withdraw his deposit bonds of 0.2 ether for 2 exits
            await txlib.withdrawBonds(plasma, bob, 0.1 * 2);
        });

        it('Alice gives Bob 2 coins, he exits 1 and gives another to Charlie who also exits it', async function() {
            let UTXO = [{'slot': events[1]['args'].slot, 'block': events[1]['args'].blockNumber.toNumber()},
                        {'slot': events[2]['args'].slot, 'block': events[2]['args'].blockNumber.toNumber()}];

            let alice_to_bob = {};
            let txs = [];
            let tx;
            UTXO.forEach(function(aUTXO) {
                tx = txlib.createUTXO(aUTXO.slot, aUTXO.block, alice, bob);
                alice_to_bob[aUTXO.slot] = tx;
                txs.push(tx.leaf);
            });

            // Tree contains both transactions
            let tree_bob = await txlib.submitTransactions(authority, plasma, txs);

            // Bob has ownership of the 2 coin's and now he gives 1 to Charlie
            let bob_to_charlie = txlib.createUTXO(UTXO[0].slot, UTXO[0].block, bob, charlie);
            txs = [ bob_to_charlie.leaf ];
            let tree_charlie = await txlib.submitTransactions(authority, plasma, txs);

            // Bob exits UTXO 1
            let slot = UTXO[1].slot; // the first UTXO in the list is UTXO 1.
            let sig = alice_to_bob[slot].sig
            let exiting_tx_proof = tree_bob.createMerkleProof(slot)
            let prev_tx = txlib.createUTXO(slot, 0, alice, alice).tx;
            let exiting_tx = alice_to_bob[slot].tx;

            plasma.startExit(
                    slot,
                    prev_tx , exiting_tx,
                    '0x0', exiting_tx_proof,
                    sig,
                    [UTXO[1].block, 1000],
                     {'from': bob, 'value': web3.toWei(0.1, 'ether')}
            );

            slot = UTXO[0].slot;
            sig = bob_to_charlie.sig;
            let prev_tx_proof = tree_bob.createMerkleProof(slot)
            exiting_tx_proof = tree_charlie.createMerkleProof(slot)
            prev_tx = alice_to_bob[slot].tx;
            exiting_tx = bob_to_charlie.tx;

            plasma.startExit(
                    slot,
                    prev_tx , exiting_tx,
                    prev_tx_proof, exiting_tx_proof,
                    sig,
                    [1000, 2000],
                     {'from': charlie, 'value': web3.toWei(0.1, 'ether')}
            );

            t0 = (await web3.eth.getBlock('latest')).timestamp;

            // After the exit is matured and finalized, bob and charlie can withdraw the coin.
            await increaseTimeTo(t0 + t1 + t2);
            await plasma.finalizeExits({from: random_guy2});

            await plasma.withdraw(UTXO[1].slot, {from: bob});
            await plasma.withdraw(UTXO[0].slot, {from: charlie});
            assert.equal((await cards.balanceOf.call(alice)).toNumber(), 2);
            assert.equal((await cards.balanceOf.call(bob)).toNumber(), 1);
            assert.equal((await cards.balanceOf.call(charlie)).toNumber(), 1);
            assert.equal((await cards.balanceOf.call(plasma.address)).toNumber(), 1);

            await plasma.withdrawBonds({from: bob});
            await plasma.withdrawBonds({from: charlie});
            let withdrewBonds = plasma.WithdrewBonds({}, {fromBlock: 0, toBlock: 'latest'});
            let e = await txlib.Promisify(cb => withdrewBonds.get(cb));
            let withdraw = e[0].args;
            assert.equal(withdraw.from, bob);
            assert.equal(withdraw.amount, web3.toWei(0.1, 'ether'));
            withdraw = e[1].args;
            assert.equal(withdraw.from, charlie);
            assert.equal(withdraw.amount, web3.toWei(0.1, 'ether'));

        });

        it('Alice gives Bob 2 coins, who gives both to Charlie who exits both', async function() {
            let UTXO = [{'slot': events[1]['args'].slot, 'block': events[1]['args'].blockNumber.toNumber()},
                        {'slot': events[2]['args'].slot, 'block': events[2]['args'].blockNumber.toNumber()}];
            let alice_to_bob = {};
            let txs = [];
            let tx;
            UTXO.forEach(function(aUTXO) {
                tx = txlib.createUTXO(aUTXO.slot, aUTXO.block, alice, bob);
                alice_to_bob[aUTXO.slot] = tx;
                txs.push(tx.leaf);
            });

            // Tree contains both transactions
            let tree_bob = await txlib.submitTransactions(authority, plasma, txs);

            let bob_to_charlie = {};
            txs = [];
            UTXO.forEach(function(aUTXO) {
                tx = txlib.createUTXO(aUTXO.slot, 1000, bob, charlie);
                bob_to_charlie[aUTXO.slot] = tx;
                txs.push(tx.leaf);
            });

            let tree_charlie = await txlib.submitTransactions(authority, plasma, txs);

            let slot, prev_tx, exiting_tx, prev_tx_proof, exiting_tx_proof, sig;
            UTXO.forEach(function(aUTXO) {
                slot = aUTXO.slot;
                sig = bob_to_charlie[slot].sig;
                prev_tx_proof = tree_bob.createMerkleProof(slot)
                exiting_tx_proof = tree_charlie.createMerkleProof(slot)
                prev_tx = alice_to_bob[slot].tx;
                exiting_tx = bob_to_charlie[slot].tx;

                plasma.startExit(
                        slot,
                        prev_tx , exiting_tx,
                        prev_tx_proof, exiting_tx_proof,
                        sig,
                        [1000, 2000],
                         {'from': charlie, 'value': web3.toWei(0.1, 'ether')}
                );
            });
            t0 = (await web3.eth.getBlock('latest')).timestamp;

            // After the exit is matured and finalized, Charlie can withdraw the coin.
            await increaseTimeTo(t0 + t1 + t2);
            await plasma.finalizeExits({from: random_guy2});
            UTXO.forEach(async function(aUTXO) {
                await plasma.withdraw(aUTXO.slot, {from: charlie});
            });

            assert.equal((await cards.balanceOf.call(alice)).toNumber(), 2);
            assert.equal((await cards.balanceOf.call(bob)).toNumber(), 0);
            assert.equal((await cards.balanceOf.call(charlie)).toNumber(), 2);
            assert.equal((await cards.balanceOf.call(plasma.address)).toNumber(), 1);

            // Charlie is also able to withdraw his deposit bonds of 0.2 ether for 2 exits
            await plasma.withdrawBonds({from: charlie});
            let withdrewBonds = plasma.WithdrewBonds({}, {fromBlock: 0, toBlock: 'latest'});
            let e = await txlib.Promisify(cb => withdrewBonds.get(cb));
            let withdraw = e[0].args;
            assert.equal(withdraw.from, charlie);
            assert.equal(withdraw.amount, web3.toWei(0.1 * 2, 'ether'));

        });

        it('Alice gives Bob and Charlie 1 coin, they both exit them', async function() {
            let UTXO = [{'slot': events[1]['args'].slot, 'block': events[1]['args'].blockNumber.toNumber()},
                        {'slot': events[2]['args'].slot, 'block': events[2]['args'].blockNumber.toNumber()}];
            let txs = [];
            let alice_to_bob = txlib.createUTXO(UTXO[0].slot, UTXO[0].block, alice, bob);
            let alice_to_charlie = txlib.createUTXO(UTXO[1].slot, UTXO[1].block, alice, charlie);
            txs = [alice_to_bob.leaf, alice_to_charlie.leaf]; // push leaf
            let tree = await txlib.submitTransactions(authority, plasma, txs);

            let slot = UTXO[0].slot;
            let sig = alice_to_bob.sig;
            let exiting_tx_proof = tree.createMerkleProof(slot);
            let prev_tx = txlib.createUTXO(slot, 0, alice, alice).tx;
            let exiting_tx = alice_to_bob.tx;

            plasma.startExit(
                    slot,
                    prev_tx , exiting_tx,
                    '0x0', exiting_tx_proof,
                    sig,
                    [UTXO[0].block, 1000],
                     {'from': bob, 'value': web3.toWei(0.1, 'ether')}
            );
            t0 = (await web3.eth.getBlock('latest')).timestamp;

            slot = UTXO[1].slot;
            sig = alice_to_charlie.sig;
            exiting_tx_proof = tree.createMerkleProof(slot);
            prev_tx = txlib.createUTXO(slot, 0, alice, alice).tx;
            exiting_tx = alice_to_charlie.tx;

            plasma.startExit(
                    slot,
                    prev_tx , exiting_tx,
                    '0x0', exiting_tx_proof,
                    sig,
                    [UTXO[1].block, 1000],
                     {'from': charlie, 'value': web3.toWei(0.1, 'ether')}
            );
            t0 = (await web3.eth.getBlock('latest')).timestamp;

            await increaseTimeTo(t0 + t1 + t2);
            await plasma.finalizeExits({from: random_guy2});

            await plasma.withdraw(UTXO[0].slot, {from: bob});
            await plasma.withdraw(UTXO[1].slot, {from: charlie});

            assert.equal((await cards.balanceOf.call(alice)).toNumber(), 2);
            assert.equal((await cards.balanceOf.call(bob)).toNumber(), 1);
            assert.equal((await cards.balanceOf.call(charlie)).toNumber(), 1);
            assert.equal((await cards.balanceOf.call(plasma.address)).toNumber(), 1);

            // Charlie is also able to withdraw his deposit bonds of 0.2 ether for 2 exits
            await plasma.withdrawBonds({from: bob});
            await plasma.withdrawBonds({from: charlie});
            let withdrewBonds = plasma.WithdrewBonds({}, {fromBlock: 0, toBlock: 'latest'});
            let e = await txlib.Promisify(cb => withdrewBonds.get(cb));
            let withdraw = e[0].args;
            assert.equal(withdraw.from, bob);
            assert.equal(withdraw.amount, web3.toWei(0.1, 'ether'));
            withdraw = e[1].args;
            assert.equal(withdraw.from, charlie);
            assert.equal(withdraw.amount, web3.toWei(0.1, 'ether'));
        });

        it('Alice gives Bob and Charlie 1 coin, Bob gives Charlie his coin and Charlie exits it', async function() {
            let UTXO = [{'slot': events[1]['args'].slot, 'block': events[1]['args'].blockNumber.toNumber()},
                        {'slot': events[2]['args'].slot, 'block': events[2]['args'].blockNumber.toNumber()}];
            let txs = [];
            let alice_to_bob = txlib.createUTXO(UTXO[0].slot, UTXO[0].block, alice, bob);
            let alice_to_charlie = txlib.createUTXO(UTXO[1].slot, UTXO[1].block, alice, charlie);
            txs = [alice_to_bob.leaf, alice_to_charlie.leaf]; // push leaf
            let tree1 = await txlib.submitTransactions(authority, plasma, txs);

            // Bob and Charlie own a coin each.

            let bob_to_charlie = txlib.createUTXO(UTXO[0].slot, 1000, bob, charlie);
            txs = [bob_to_charlie.leaf]
            let tree2 = await txlib.submitTransactions(authority, plasma, txs);

            // Charlie exits the coin he received from alice, which was UTXO[1]
            let slot = UTXO[1].slot;
            let sig = alice_to_charlie.sig;
            let exiting_tx_proof = tree1.createMerkleProof(slot);
            let prev_tx = txlib.createUTXO(slot, 0, alice, alice).tx;
            let exiting_tx = alice_to_charlie.tx;

            plasma.startExit(
                    slot,
                    prev_tx , exiting_tx,
                    '0x0', exiting_tx_proof,
                    sig,
                    [UTXO[1].block, 1000],
                     {'from': charlie, 'value': web3.toWei(0.1, 'ether')}
            );

            // Charlie exits the coin he received from Bob
            slot = UTXO[0].slot;
            sig = bob_to_charlie.sig;
            let prev_tx_proof = tree1.createMerkleProof(slot);
            exiting_tx_proof = tree2.createMerkleProof(slot);
            prev_tx = alice_to_bob.tx;
            exiting_tx = bob_to_charlie.tx;

            plasma.startExit(
                    slot,
                    prev_tx, exiting_tx,
                    prev_tx_proof, exiting_tx_proof,
                    sig,
                    [1000, 2000],
                     {'from': charlie, 'value': web3.toWei(0.1, 'ether')}
            );

            t0 = (await web3.eth.getBlock('latest')).timestamp;
            await increaseTimeTo(t0 + t1 + t2);
            await plasma.finalizeExits({from: random_guy2});

            await plasma.withdraw(UTXO[0].slot, {from: charlie});
            await plasma.withdraw(UTXO[1].slot, {from: charlie});

            assert.equal(await cards.balanceOf.call(alice), 2);
            assert.equal(await cards.balanceOf.call(bob), 0);
            assert.equal(await cards.balanceOf.call(charlie), 2);
            assert.equal(await cards.balanceOf.call(plasma.address), 1);

            await plasma.withdrawBonds({from: charlie});
            let withdrewBonds = plasma.WithdrewBonds({}, {fromBlock: 0, toBlock: 'latest'});
            let e = await txlib.Promisify(cb => withdrewBonds.get(cb));
            let withdraw = e[0].args;
            assert.equal(withdraw.from, charlie);
            assert.equal(withdraw.amount, web3.toWei(0.1 * 2, 'ether'));
        });

    });
});
