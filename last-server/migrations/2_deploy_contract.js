const Loo = artifacts.require("Loo");
const RootChain = artifacts.require("RootChain");
const ValidatorManagerContract = artifacts.require("ValidatorManagerContract");

module.exports = async function(deployer, network, accounts) {
    // return; // for testing
    let aLooInstance;
    let aRootChainInstance;
    let aValidatorManagerContractInstance;

    return deployer.deploy(ValidatorManagerContract)
        .then(() => ValidatorManagerContract.deployed())
        .then(instance => {
            aValidatorManagerContractInstance = instance;
            console.log('ValidatorManagerContract deployed at address: ' + instance.address);
            return deployer.deploy(RootChain, instance.address);
        })
        .then(() => RootChain.deployed())
        .then(instance => {
            aRootChainInstance = instance;
            console.log('RootChain deployed at address: ' + instance.address);
            return deployer.deploy(Loo, instance.address);
        })
    .then(() => Loo.deployed())
        .then((instance) => {
            aLooInstance = instance;
            console.log('Loo deployed at address: ' + instance.address);

            aValidatorManagerContractInstance.toggleToken(instance.address);
        });
};

