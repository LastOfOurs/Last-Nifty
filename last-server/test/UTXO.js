const RLP = require('rlp')
const utils = require('web3-utils');
const SparseMerkleTree = require('./SparseMerkleTree.js');
const ethutil = require('ethereumjs-util');
const BN = require('bn.js');

const Promisify = (inner) =>
new Promise((resolve, reject) =>
    inner((err, res) => {
        if (err) {
            reject(err);
        } else {
            resolve(res);
        }
    })
);


/********** UTILS ********/

function signHash(from, hash) {
    let sig = (web3.eth.sign(from, hash)).slice(2);
    let r = ethutil.toBuffer('0x' + sig.substring(0, 64));
    let s = ethutil.toBuffer('0x' + sig.substring(64, 128));
    let v = ethutil.toBuffer(parseInt(sig.substring(128, 130), 16) + 27);
    let mode = ethutil.toBuffer(1); // mode = geth
    let signature = '0x' + Buffer.concat([mode, r, s, v]).toString('hex');
    return signature;
};

function createUTXO(slot, block, from, to) {
    let rlpSlot = slot instanceof web3.BigNumber ? (new BN(slot.toString())).toBuffer() : slot;
    let data = [rlpSlot, block, 1, to];
    data = '0x' + RLP.encode(data).toString('hex');

    // If it's a deposit transaction txHash = hash of the slot
    let txHash = block == 0 ?
        utils.soliditySha3({type: 'uint64', value: slot}) :
        utils.soliditySha3({type: 'bytes', value: data});
    let sig = signHash(from, txHash);

    let leaf = {};
    leaf.slot = web3.toBigNumber(slot).toString();
    leaf.hash = txHash;

    return {'tx': data, 'sig': sig, 'leaf': leaf};
};

async function submitTransactions(from, plasma, txs) {
    let tree;
    let leaves = {}
    for (let l in txs) {
        leaves[txs[l].slot] = txs[l].hash;
    }
    tree = new SparseMerkleTree(64, leaves);
    await plasma.submitBlock(tree.root, {'from': from});
    return tree;
}

async function withdrawBonds(plasma, withdrawer, amount) {
    await plasma.withdrawBonds({from: withdrawer});
    let withdrewBonds = plasma.WithdrewBonds({}, {fromBlock: 0, toBlock: 'latest'});
    let e = await Promisify(cb => withdrewBonds.get(cb));
    let withdraw = e[0].args;
    assert.equal(withdraw.from, withdrawer);
    assert.equal(withdraw.amount, web3.toWei(amount, 'ether'));
}


module.exports = {
    signHash : signHash,
    createUTXO : createUTXO,
    submitTransactions: submitTransactions,
    withdrawBonds: withdrawBonds,
    Promisify: Promisify
}
