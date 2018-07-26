pragma solidity ^0.4.24;
// pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Token.sol";


contract Loo is ERC721Token("Loo", "LAST") {

    address plasma;
    address private _creator; 
    string[] private _uris =
    ["QmNSx7dB5p8fX2k8BiqVyT4SscoW6dUt844K1X3KYVCSws",
    "QmYP6SsPfaWdeTZR5hqpG49ZgybfsnPMy9sqCFSiuFsoeY",
    "QmQHjUQjw43zfLAxTtQxJLvpw2mjbmKHq3oFCBcpzXc8cz",
    "QmZ6VzUNCB6LNeuqDNamsxDfcbKzZ8eRbLVSZ3svJr3DBA",
    "QmYCaFvsn8uBAhRR7J5jDhtcbC3VNsUjtkJ8zk3X42fBZp",
    "QmXD7u82MfxgKNWKVEdKzoRCCQbYa3mFoe6uFZjNwPhBJh",
    "QmQYhQfVDahDZk3QE3cQ7q4XfmwnKZAukYSkSJ7GT9BD9v"];
    uint32 private _uriIndex = 0;

    constructor (address _plasma) public {
        plasma = _plasma;
        _creator = msg.sender;
    }

    modifier onlyCreator(address creator) {
        require(msg.sender == _creator);
        _;
    }

    function register() external {
        // Give each new player 5 cards
        for (int j = 0; j < 5; j++) {
            create();            
        }
    }

    //1. User registers and sends the contract some ETH.
    //2. LOO Contract mints tokens
        //a. Call from database to create JSON file for each animal -- uses a script.
        //b. Put JSON file on IPFS, obtain hash as tokenURI.
        //c. Assign tokenURI to minted token.
    //3. Transfer token to user -- transferFrom(creator, destaddress, tokenID)
    //4. Users can transfer via plasma cash.
    
    function create() public {
        uint256 tokenId = allTokens.length + 1;
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, _uris[_uriIndex]);
        _uriIndex += 1;
    }

    function depositToPlasmaWithData(uint tokenId, bytes _data) public {
        require(plasma != address(0));
        safeTransferFrom(
            msg.sender,
            plasma,
            tokenId,
            _data);
    }

    function depositToPlasma(uint tokenId) public {
        require(plasma != address(0));
        safeTransferFrom(msg.sender, plasma, tokenId);
    }

}
