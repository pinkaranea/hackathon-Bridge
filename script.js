const RANK_IMAGES = {
    "ROOKIE": "/static/rookienobg.png",
    "SILVER": "/static/silvernobg.png",
    "VIP GOLD": "/static/goldnobg.png"
};

const CONFIG = {
    PROJECT_ID: '881d9f0e18d7f88862688b21c96a6c88', 
    CONTRACT_ADDRESS: '0xc627Eb9EC77f0BEd7BF9246eB9d194e800c26BF5', 
    CHAIN_ID: 'eip155:11155111', 
    CHAIN_ID_HEX: '0xaa36a7', 
    EXPLORER_URL: 'https://sepolia.etherscan.io' 
};

let universalProvider = null;
let userAddress = null;
let currentUid = null;
let isLinkedToDatabase = false;
let isMinted = false;
let showSuccessMessage = false;
let autoConnectTriggered = false;
let qrCodeInstance = null;
let cardDetected = false;

const connectStatus = document.getElementById('connectStatus');
const mintBtn = document.getElementById('mintBtn');
const walletAddressEl = document.getElementById('walletAddress');
const disconnectBtn = document.getElementById('disconnectBtn');
const ticketVisual = document.getElementById('ticketVisual');
const statsInfo = document.getElementById('statsInfo');
const txHashEl = document.getElementById('txHash');
const fakeHashText = document.getElementById('fakeHashText');
const qrCodeContainer = document.getElementById('qrCodeContainer');

async function initWeb3() {
    console.log("Initializing WalletConnect...");
    try {
        const UniversalProvider = window.WalletConnectUniversalProvider?.UniversalProvider || window['@walletconnect/universal-provider']?.UniversalProvider;
        if (!UniversalProvider) throw new Error("WalletConnect not loaded");

        universalProvider = await UniversalProvider.init({
            projectId: CONFIG.PROJECT_ID,
            metadata: { name: 'Bridge', description: 'IoT to Web3', url: window.location.origin, icons: [] }
        });

        if (universalProvider.session) {
            console.log("Found existing session");
            extractAndDisplayAddress(universalProvider.session);
        }

        universalProvider.on("display_uri", (uri) => {
            console.log("Generating QR code");
            showQRCode(uri);
        });

        universalProvider.on("session_delete", () => resetWalletState());
        console.log("WalletConnect Ready");
    } catch (error) {
        connectStatus.innerHTML = '<span class="status-indicator status-disconnected"></span>Initialization Error';
    }
}

async function startAutoConnection() {
    if (!universalProvider || autoConnectTriggered || userAddress) return;
    autoConnectTriggered = true;
    connectStatus.innerHTML = '<span class="status-indicator status-pending"></span>Generating QR...';

    try {
        console.log("Awaiting phone authorization...");
        const session = await universalProvider.connect({
            optionalNamespaces: { 
                eip155: { 
                    methods: ['eth_sendTransaction', 'personal_sign'], 
                    chains: [CONFIG.CHAIN_ID],
                    events: ['chainChanged', 'accountsChanged'] 
                } 
            }
        });
        
        console.log("Connected successfully:", session);
        extractAndDisplayAddress(session);
    } catch (error) {
        console.error("Connection rejected:", error);
        autoConnectTriggered = false; 
        connectStatus.innerHTML = '<span class="status-indicator status-disconnected"></span>Connection rejected';
        hideQRCode();
    }
}

function extractAndDisplayAddress(session) {
    try {
        const accounts = session.namespaces.eip155.accounts;
        if (accounts && accounts.length > 0) {
            const fullAccount = accounts[0];
            userAddress = fullAccount.includes(':') ? fullAccount.split(':')[2] : fullAccount;
            
            hideQRCode();
            walletAddressEl.innerHTML = `<span class="status-indicator status-connected"></span>Identity Verified & Linked`;
            connectStatus.innerHTML = '<span class="status-indicator status-connected"></span>Secure Connection Active';
            connectStatus.style.background = '#3a5040';
            disconnectBtn.style.display = "inline-block";
            
            updateMintButtonVisibility();
            checkBlockchainStatus(userAddress);
        }
    } catch (e) {
        console.error("Error retrieving address:", e);
    }
}

async function saveIdentityToDatabase(uid, address) {
    if (isLinkedToDatabase) return;
    try {
        console.log("Sending link to Python...");
        const response = await fetch('/api/link_wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: uid, wallet: address })
        });
        
        if (response.ok) {
            console.log("Identity permanently linked in JSON database!");
            isLinkedToDatabase = true;
        }
    } catch (error) {
        console.error("Database save error:", error);
    }
}

async function checkBlockchainStatus(wallet) {
    try {
        console.log("Checking Sepolia for address:", wallet);
        const rpcProvider = new ethers.JsonRpcProvider("https://rpc.sepolia.org");
        const CONTRACT_ABI = ["function balanceOf(address owner) view returns (uint256)"];
        const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, rpcProvider);
        const balance = await contract.balanceOf(wallet);
        console.log("Found tokens:", balance.toString());
        
        if (balance > 0) {
            console.log("User already claimed the reward!");
            isMinted = true; 
            showSuccessMessage = true;
            mintBtn.style.display = "none";
            
            const currentImg = ticketVisual.querySelector('.rank-image');
            const imgHtml = currentImg ? currentImg.outerHTML : '';
            
            ticketVisual.innerHTML = `
                ${imgHtml}
                <div class="ticket-text ${currentImg ? '' : 'center'}">
                    <h3>NFT SECURED</h3>
                    <div class="uid">On-Chain Verified</div>
                </div>`;
                
            ticketVisual.style.background = "linear-gradient(45deg, #6a8a6a, #8aa88a)";
            ticketVisual.style.borderColor = "#a8c9a8";
            ticketVisual.style.boxShadow = "0 0 20px #a8c9a844";
            
            setTimeout(() => {
                showSuccessMessage = false;
                ticketVisual.style.background = "";
                ticketVisual.style.borderColor = "";
                ticketVisual.style.boxShadow = "";
            }, 5000);
        }
    } catch (error) {
        console.error("Blockchain read error:", error);
    }
}

mintBtn.addEventListener('click', async () => {
    if (!userAddress || !universalProvider) return;
    mintBtn.innerText = "Confirm on Phone...";
    mintBtn.disabled = true;
    mintBtn.style.backgroundColor = "#b899c9";

    try {
        const txHash = await universalProvider.request({
            method: 'eth_sendTransaction',
            params: [{
                from: userAddress,
                to: CONFIG.CONTRACT_ADDRESS,
                data: '0x1249c58b',
                chainId: CONFIG.CHAIN_ID_HEX,
                gas: '0x493E0'
            }]
        });

        // Notify Python backend that NFT was minted successfully
        try {
            await fetch('/api/nft_minted', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: currentUid })
            });
            console.log("Backend notified about successful mint");
        } catch (e) {
            console.error("Failed to notify backend", e);
        }

        mintBtn.style.display = "none";
        txHashEl.style.display = "block";
        
        const currentImg = ticketVisual.querySelector('.rank-image');
        const imgHtml = currentImg ? currentImg.outerHTML : '';
        
        ticketVisual.innerHTML = `
            ${imgHtml}
            <div class="ticket-text ${currentImg ? '' : 'center'}">
                <h3>NFT SECURED</h3>
                <div class="uid">On-Chain Asset</div>
            </div>`;
            
        ticketVisual.style.background = "linear-gradient(45deg, #6a8a6a, #8aa88a)";
        ticketVisual.style.borderColor = "#a8c9a8";
        ticketVisual.style.boxShadow = "0 0 20px #a8c9a844";
        isMinted = true;
        showSuccessMessage = true;

        setTimeout(() => {
            showSuccessMessage = false;
            txHashEl.style.display = "none";
            ticketVisual.style.background = "";
            ticketVisual.style.borderColor = "";
            ticketVisual.style.boxShadow = "";
        }, 6000);
    } catch (error) {
        console.error("Transaction error details:", error);
        alert("Transaction rejected. Please check your Sepolia ETH balance and contract permissions.");
        mintBtn.innerText = "Mint Phygital NFT";
        mintBtn.disabled = false;
        mintBtn.style.backgroundColor = "#c988a8";
    }
});

async function fetchStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        let lastUid = null;
        let lastTime = "";
        for (const [uid, info] of Object.entries(data)) {
            if (info.last_seen > lastTime) { lastTime = info.last_seen; lastUid = uid; }
        }

        if (lastUid && !showSuccessMessage) {
            const info = data[lastUid];
            currentUid = lastUid;
            
            // Optional: If you want to check if they have NFT from DB
            if (info.has_nft) {
                isMinted = true;
            }

            if (!cardDetected) {
                cardDetected = true;
                if (!userAddress && !autoConnectTriggered) startAutoConnection();
            }
            if (userAddress && currentUid && !isLinkedToDatabase) {
                saveIdentityToDatabase(currentUid, userAddress);
            }
            
            const levelKey = info.level.toUpperCase();
            let imgSrc = RANK_IMAGES[levelKey];
            if (!imgSrc && levelKey.includes("GOLD")) imgSrc = RANK_IMAGES["VIP GOLD"];
            
            const imgTag = imgSrc ? `<img src="${imgSrc}" class="rank-image" alt="Rank">` : '';
            const textAlignmentClass = imgSrc ? '' : 'center'; 
            
            ticketVisual.className = "ticket-visual " + (
                info.level.includes("ROOKIE") ? "level-rookie" :
                info.level.includes("SILVER") ? "level-silver" :
                info.level.includes("GOLD") ? "level-vip-gold" : "level-none"
            );
            
            ticketVisual.innerHTML = `
                ${imgTag}
                <div class="ticket-text ${textAlignmentClass}">
                    <h3>${info.level}</h3>
                    <div class="uid">UID: ${lastUid}</div>
                </div>
            `;
            
            let scansLeft = 5 - info.scans;
            let rewardMessage = "";
            
            if (scansLeft > 0) {
                rewardMessage = `
                    <div style="margin-top: 15px; padding: 12px; background: rgba(201, 136, 168, 0.1); border: 1px dashed #c988a8; border-radius: 8px; color: #d99bb9; font-size: 0.95rem; text-align: center;">
                        <b>${scansLeft} scans left</b> to unlock a PaySafeCard or V-Bucks in your PKO bank account
                    </div>`;
            } else {
                rewardMessage = `
                    <div style="margin-top: 15px; padding: 12px; background: rgba(168, 201, 168, 0.1); border: 1px dashed #a8c9a8; border-radius: 8px; color: #a8c9a8; font-size: 0.95rem; text-align: center;">
                        <b>Reward Unlocked</b> Claim your PaySafeCard / Robux
                    </div>`;
            }

            statsInfo.innerHTML = `
                <span style="color:#9a9aa0">UID:</span> <span style="color:white">${lastUid}</span> <br>
                <span style="color:#9a9aa0">Level:</span> <span style="color:white">${info.level}</span> <br>
                <span style="color:#9a9aa0">Scans:</span> <span style="color:white">${info.scans} / 5</span> <br>
                <span style="color:#9a9aa0">Time:</span> <span style="color:white">${info.last_seen}</span>
                ${rewardMessage}
            `;
            updateMintButtonVisibility();
        }
    } catch (error) {}
}

disconnectBtn.addEventListener('click', async () => {
    console.log("Manual session disconnect and reset...");
    if (universalProvider && universalProvider.session) {
        try { await universalProvider.disconnect(); } catch(e) {}
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
});

function updateMintButtonVisibility() {
    if (userAddress && cardDetected && !isMinted) mintBtn.style.display = "block";
    else mintBtn.style.display = "none";
}

function showQRCode(uri) {
    if (!uri) return;
    document.getElementById('qrcode').innerHTML = '';
    qrCodeInstance = new QRCode(document.getElementById('qrcode'), {
        text: uri, width: 256, height: 256, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H
    });
    qrCodeContainer.classList.add('show');
    connectStatus.innerHTML = '<span class="status-indicator status-pending"></span>Scan QR Code with Phone';
}

function hideQRCode() {
    qrCodeContainer.classList.remove('show');
    if (qrCodeInstance) { document.getElementById('qrcode').innerHTML = ''; qrCodeInstance = null; }
}

function resetWalletState() {
    userAddress = null; autoConnectTriggered = false; isLinkedToDatabase = false;
    walletAddressEl.innerText = "";
    disconnectBtn.style.display = "none";
    connectStatus.innerHTML = '<span class="status-indicator status-pending"></span>Ready for Card Scan';
    connectStatus.style.background = '#1a1a1f'; mintBtn.style.display = "none"; hideQRCode();
}

window.addEventListener('load', () => {
    setTimeout(async () => {
        await initWeb3();
        setInterval(fetchStats, 2000);
    }, 500);
});