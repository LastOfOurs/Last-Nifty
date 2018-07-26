from time import sleep

from client.client import Client
from dependency_config import container
from utils.utils import increaseTime

alice = Client(container.get_root('alice'), container.get_token('alice'))
bob = Client(container.get_root('bob'), container.get_token('bob'))
charlie = Client(container.get_root('charlie'), container.get_token('charlie'))
authority = Client(
    container.get_root('authority'), container.get_token('authority')
)
w3 = alice.root_chain.w3  # get w3 instance

# Give alice 5 starter animals.
alice.register()
print('------------------------------------')
print('Alice registers and gets 5 animals in the starter pack.')
print('------------------------------------')

aliceTokensStart = alice.token_contract.balance_of()
print('Alice has {} LAST tokens'.format(aliceTokensStart))
assert aliceTokensStart == 5, "START: Alice has incorrect number of LAST tokens"
print(alice.token_contract)
