//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract BridgePass is ERC721 {
    uint256 private _nextTokenId;
    
    //who has a ticket
    mapping(address => bool) public hasMinted;

    constructor() ERC721("Bridge Phygital Pass", "BPP") {}

    function mint() public {
        //security patch
        require(!hasMinted[msg.sender], "You already have a ticket in this wallet");
        
        uint256 tokenId = _nextTokenId++;
        
        hasMinted[msg.sender] = true;
        
        _safeMint(msg.sender, tokenId);
    }
}
