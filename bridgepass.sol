// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract BridgePass is ERC721 {
    uint256 private _nextTokenId;
    
    // Zmienna śledząca, kto już odebrał bilet
    mapping(address => bool) public hasMinted;

    constructor() ERC721("Bridge Phygital Pass", "BPP") {}

    function mint() public {
        // ZABEZPIECZENIE: Sprawdza, czy ten portfel już czegoś nie wybił
        require(!hasMinted[msg.sender], "Zabezpieczenie: Posiadasz juz bilet na tym portfelu!");
        
        uint256 tokenId = _nextTokenId++;
        
        // Zaznaczamy, że ten użytkownik właśnie odebrał bilet
        hasMinted[msg.sender] = true;
        
        _safeMint(msg.sender, tokenId);
    }
}