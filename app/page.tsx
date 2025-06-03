'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useAddress, useContract, useContractRead, ConnectWallet, useSDK } from '@thirdweb-dev/react';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [currentPhase, setCurrentPhase] = useState("-1");
  const [isGuaranteedWL, setIsGuaranteedWL] = useState(false);
  const [isFCFSWL, setIsFCFSWL] = useState(false);
  const [eligibilityChecked, setEligibilityChecked] = useState(false);
  const [mintedPhases, setMintedPhases] = useState<string[]>([]);
  const [totalMinted, setTotalMinted] = useState(0);
  const [maxSupply, setMaxSupply] = useState(0);
  const [hasActiveCondition, setHasActiveCondition] = useState(false);
  const [nextPhaseTime, setNextPhaseTime] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<{days: number; hours: number; minutes: number; seconds: number}>(
    {days: 0, hours: 0, minutes: 0, seconds: 0}
  );
  const [currentTime, setCurrentTime] = useState(new Date());

  // Helper function to pad numbers with leading zeros
  const padNumber = (num: number): string => num.toString().padStart(2, '0');

  // Define mint phase times (all June 3rd, 2025)
  const mintTimes = {
    guaranteed: new Date('2025-06-03T09:00:00-04:00'), // 9 AM EST
    fcfs: new Date('2025-06-03T11:00:00-04:00'),       // 11 AM EST
    public: new Date('2025-06-03T14:00:00-04:00')      // 2 PM EST
  };
  
  const { contract } = useContract("0x967043D11cd0C2c4924F6a18A49ed960F4d2D3d0", "edition-drop");
  const address = useAddress();
  const sdk = useSDK();
  
  const tokenId = "0";

  // Get supply info
  useEffect(() => {
    const fetchSupplyData = async () => {
      if (!contract || !sdk) return;
      
      try {
        const [totalSupplyData, maxSupplyData] = await Promise.all([
          contract.erc1155.totalSupply(tokenId),
          contract.call("maxTotalSupply", [tokenId])
        ]);

        setTotalMinted(Number(totalSupplyData));
        setMaxSupply(Number(maxSupplyData));
      } catch (error) {
        console.error('Error fetching supply data:', error);
      }
    };

    fetchSupplyData();
    // Set up an interval to refresh the data every 30 seconds
    const interval = setInterval(fetchSupplyData, 30000);
    return () => clearInterval(interval);
  }, [contract, sdk]);

  // Update countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      const currentTime = new Date();
      let targetTime;

      // Always count down to the next phase
      if (currentTime < mintTimes.guaranteed) {
        targetTime = mintTimes.guaranteed;
      } else if (currentTime < mintTimes.fcfs) {
        targetTime = mintTimes.fcfs;
      } else if (currentTime < mintTimes.public) {
        targetTime = mintTimes.public;
      } else {
        // All phases have passed
        setTimeRemaining({days: 0, hours: 0, minutes: 0, seconds: 0});
        return;
      }

      const diff = targetTime.getTime() - currentTime.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining({days, hours, minutes, seconds});
      setCurrentTime(currentTime);

      console.log('Time remaining:', { days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Removed automatic eligibility check on address/contract change
  
  const checkEligibility = async () => {
    if (!address || !contract) return;
    setChecking(true);

    // Check user's balance
    try {
      const balance = await contract.erc1155.balanceOf(address, "0");
      setUserBalance(Number(balance));
    } catch (error) {
      console.error('Error checking balance:', error);
    }
    
    try {
      const tokenId = "0";
      
      try {
        // Get active condition to check if minting is currently possible
        const activeCondition = await contract.claimConditions.getActive(tokenId).catch(() => null);
        console.log('Active condition:', activeCondition);

        // Read and parse allowlist CSVs
        const allowlist0Response = await fetch('/allowlist0.csv');
        const allowlist1Response = await fetch('/allowlist1.csv');
        
        const allowlist0Text = await allowlist0Response.text();
        const allowlist1Text = await allowlist1Response.text();

        // Parse CSVs and extract addresses, skipping header row
        const allowlist0Addresses = allowlist0Text.split('\n')
          .map(line => line.trim()) 
          .filter(line => line.length > 0)
          .slice(1) // Skip header row
          .map(line => line.split(',')[0]) // Get just the address
          .filter(addr => addr && addr.length > 0); // Remove empty addresses
 
        const allowlist1Addresses = allowlist1Text.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .slice(1) // Skip header row
          .map(line => line.split(',')[0]) // Get just the address
          .filter(addr => addr && addr.length > 0); // Remove empty addresses

        console.log('Allowlist 0 addresses:', allowlist0Addresses);
        console.log('Allowlist 1 addresses:', allowlist1Addresses);
        console.log('Current wallet:', address);

        // Check if wallet is in allowlists (case-insensitive)
        const currentAddress = (address || '').toLowerCase();
        
        // Convert allowlist addresses to lowercase for comparison
        const allowlist0Lower = allowlist0Addresses.map(addr => addr.toLowerCase());
        const allowlist1Lower = allowlist1Addresses.map(addr => addr.toLowerCase());
        
        // Track eligibility for both phases
        const isInPhase0 = allowlist0Lower.includes(currentAddress);
        const isInPhase1 = allowlist1Lower.includes(currentAddress);
        
        if (isInPhase0) {
          console.log('Found in guaranteed allowlist (Phase 0)');
        }
        if (isInPhase1) {
          console.log('Found in FCFS allowlist (Phase 1)');
        }
        if (!isInPhase0 && !isInPhase1) {
          console.log('Address not found in any allowlist');
        }
        
        // Set eligibility flags based on whitelist status
        setIsGuaranteedWL(isInPhase0);
        setIsFCFSWL(isInPhase1);

        // Get the current phase based on the current time
        if (activeCondition) {
          setHasActiveCondition(true);
          const now = new Date();
          let phaseIndex;
          
          if (now >= mintTimes.public) {
            phaseIndex = "2"; // Public phase
          } else if (now >= mintTimes.fcfs) {
            phaseIndex = "1"; // FCFS phase
          } else if (now >= mintTimes.guaranteed) {
            phaseIndex = "0"; // Guaranteed phase
          } else {
            phaseIndex = "-1"; // Not started
          }
          
          setCurrentPhase(phaseIndex);
          console.log('Setting current phase to:', phaseIndex);

          // Set next phase time
          let nextTime = null;
          if (now < mintTimes.guaranteed) {
            nextTime = mintTimes.guaranteed;
          } else if (now < mintTimes.fcfs) {
            nextTime = mintTimes.fcfs;
          } else if (now < mintTimes.public) {
            nextTime = mintTimes.public;
          }
          setNextPhaseTime(nextTime);
          if (nextTime) {
            console.log('Next phase starts at:', nextTime);
          }
        } else {
          setCurrentPhase("-1"); // No active phase
          console.log('No active phase');
          setNextPhaseTime(null);
        }
      } catch (error: any) {
        if (error.message?.includes('DropNoActiveCondition')) {
          console.log('No active claim condition');
          setIsGuaranteedWL(false);
          setIsFCFSWL(false);
          setCurrentPhase("-1"); // No active phase
        } else {
          throw error;
        }
      }
      
      setEligibilityChecked(true);
    } catch (error) {
      console.error('Error checking eligibility:', error);
      setEligibilityChecked(false);
    } finally {
      setChecking(false);
    }
  };

  const handleMint = async (stage: string) => {
    if (!address || !contract || totalMinted >= maxSupply || mintedPhases.includes(stage)) return;
    setLoading(true);
    
    try {
      // Verify active claim condition first
      const activeCondition = await contract.claimConditions.getActive(tokenId);
      console.log('Active claim condition:', activeCondition);

      // Verify user is eligible to claim
      const canClaim = await contract.claimConditions.canClaim(tokenId, 1, address);
      console.log('Can claim:', canClaim);

      if (!canClaim) {
        throw new Error('Not eligible to claim in current phase');
      }

      // Attempt to mint
      const quantity = 1;
      const result = await contract.claim(tokenId, quantity);
      
      // Wait for transaction confirmation and get receipt
      const receipt = await result.receipt;
      console.log('Mint successful, transaction hash:', receipt.transactionHash);
      
      setMintedPhases(prev => [...prev, stage]);
    } catch (error: any) {
      console.error('Error minting:', error);
      // Handle specific error cases
      if (error.message.includes('not eligible') || 
          error.message.includes('cannot claim yet') ||
          error.message.includes('DropNoActiveCondition') ||
          error.errorName === 'DropNoActiveCondition') {
        alert('Mint hasn\'t started');
      } else if (error.message.includes('insufficient funds')) {
        alert('Insufficient funds to complete the transaction');
      } else {
        alert('Error minting: Please try again later');
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <div className="background-image" />
      <div className="background-overlay" />
      <header className="nav-header">
        <div className="nav-container">
          <div className="nav-logo">
            <a href="https://darktableccg.com/" target="_blank" rel="noopener noreferrer">
              <Image src="/DarkTable_LOGO-KeyWhite.png" alt="Dark Table CCG" width={150} height={50} />
            </a>
          </div>
          <div className="nav-spacer"></div>
          <ConnectWallet 
            theme="dark"
            btnTitle="Connect Wallet"
            className="nav-button"
          />
        </div>
      </header> 
      <main className="container">
      {/* Hero Section */}
      <div className="hero"> 
        <h1 data-text="Under The Table Pass">Under The Table Pass</h1>
        <span>The best deals are made under the table, this pass gets you in on all of them.</span>
      </div> 

      {/* Mint Details */}
      <section className="mint-details">
        <h2>Under the Table Pass Collection</h2>
        <div className="mint-details-grid">
          <div className="mint-detail-item">
            <h3>Chain</h3>
            <p>Somnia Testnet</p>
          </div>
          <div className="mint-detail-item">
            <h3>Supply</h3>
            <p>{maxSupply}</p>
          </div>
          <div className="mint-detail-item">
            <h3>Mint Date</h3>
            <p>June 3rd, 2025</p>
          </div>
          <div className="mint-detail-item">
            <h3>Mint Price</h3>
            <p>FREE</p>
          </div>
        </div>
      </section>

      <section className="mint-status">
        <div className="mint-status-header">
          <h2>Mint Status</h2>
          <div className="current-phase">
            {!address ? "Connect Wallet" :
             currentTime < mintTimes.guaranteed ? 
               `Mint Starts In ${timeRemaining.days > 0 ? `${timeRemaining.days} days ` : ''}${padNumber(timeRemaining.hours)}:${padNumber(timeRemaining.minutes)}:${padNumber(timeRemaining.seconds)}` :
             currentTime < mintTimes.fcfs ? 
               `Guaranteed Mint | ${padNumber(timeRemaining.hours)}:${padNumber(timeRemaining.minutes)}:${padNumber(timeRemaining.seconds)} remaining` :
             currentTime < mintTimes.public ?
               `FCFS Mint | ${padNumber(timeRemaining.hours)}:${padNumber(timeRemaining.minutes)}:${padNumber(timeRemaining.seconds)} remaining` :
             "Public Mint"}
          </div>
        </div>

        {/* Supply Progress Bar */}
        <div className="supply-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{
                width: `${(totalMinted / maxSupply) * 100}%`,
                backgroundColor: totalMinted >= maxSupply ? '#ff4444' : '#4CAF50'
              }}
            />
          </div>
          <div className="supply-text">
            <span>{totalMinted} / {maxSupply} Minted</span>
            <span>{maxSupply - totalMinted} Remaining</span>
          </div>
        </div>

        {/* Countdown Timer */}
        {nextPhaseTime && (
          <div className="countdown-timer">
            <h3>Next Phase Starts In:</h3>
            <div className="countdown-grid">
              <div className="countdown-item">
                <span className="countdown-value">{timeRemaining.days}</span>
                <span className="countdown-label">Days</span>
              </div>
              <div className="countdown-item">
                <span className="countdown-value">{timeRemaining.hours}</span>
                <span className="countdown-label">Hours</span>
              </div>
              <div className="countdown-item">
                <span className="countdown-value">{timeRemaining.minutes}</span>
                <span className="countdown-label">Minutes</span>
              </div>
              <div className="countdown-item">
                <span className="countdown-value">{timeRemaining.seconds}</span>
                <span className="countdown-label">Seconds</span>
              </div>
            </div>
          </div>
        )}

              {/* My Collection Section */}
      {address && userBalance > 0 && (
        <div className="collection-section">
          <h3>My Collection</h3>
          <div className="flex items-center justify-center gap-4 p-6 bg-gray-800 rounded-lg">
            <div className="text-center">
              <Image 
                src="/DTMint.jpeg" 
                alt="Dark Table Pass" 
                width={200} 
                height={200} 
                className="rounded-lg shadow-lg mb-4"
              />
              <div className="text-xl font-semibold mb-2">Under The Table Pass{userBalance > 1 ? 's' : ''}</div>
              <div className="text-gray-400">Owned: {userBalance}</div>
            </div>
          </div>
        </div>
      )}
      </section>

      {/* Main Card */}
      <div className="card">
        {/* Wallet Connection */}
        <div style={{ marginBottom: '2.5rem' }} className="wallet-checker">
          {!address ? (
            <ConnectWallet 
              theme="dark"
              btnTitle="Connect Wallet"
              className="button"
              style={{ width: '100%', height: '60px', borderRadius: '.25rem' }}
            />
          ) : !eligibilityChecked ? (
            <button 
              className="button" 
              onClick={checkEligibility}
              disabled={checking}
            >
              <span>{checking ? 'Checking...' : 'Check Allowlist'}</span>
            </button>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 mt-8">
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => handleMint(currentPhase)}
                  disabled={loading || totalMinted >= maxSupply || !isGuaranteedWL || mintedPhases.includes('guaranteed')}
                  className="button"
                  style={{ width: '100%', height: '60px', borderRadius: '.25rem' }}
                >
                  {!address ? "Not Connected" :
                   loading ? "Processing..." :
                   Number(currentPhase) === 0 ? 
                     (isGuaranteedWL ? "Mint a pass" : "Not Whitelisted for Guaranteed") :
                   Number(currentPhase) === 1 ? 
                     (isFCFSWL ? "Mint a pass" : "Not Whitelisted for FCFS") :
                   Number(currentPhase) === 2 ? 
                     (!address ? "Connect Wallet" : "Mint a pass") :
                   "Mint Starts Soon!"}
                </button>
                <p style={{ color: 'white', fontStyle: 'italic', textAlign: 'center', marginTop: '.5rem' }}>Reminder ~ Switch to Somnia Testnet to mint!</p>
              </div>
            </div>
          )}
        </div>

        {/* Status Cards */}
        <div>
          {/* Guaranteed */}
          <div className="status-card"> 
            <div className="status-card-header">
              <h3>The Chosen (Guaranteed)</h3>
              <span className="status-badge">
                {!address ? 'Connect Wallet' :
                 checking ? 'Checking...' :
                 !eligibilityChecked ? 'Ready to Check' :
                 isGuaranteedWL ? (mintedPhases.includes('guaranteed') ? 'Minted!' : 'Eligible!') :
                 'Not Eligible'}
              </span>
            </div>
            <p>Those marked by the elder signs, destined for the inner circle</p>
          </div>

          {/* FCFS Allowlist */}
          <div className="status-card">
            <div className="status-card-header">
              <h3>The Seekers (FCFS)</h3>
              <span className="status-badge">
                {!address ? 'Connect Wallet' :
                 checking ? 'Checking...' :
                 !eligibilityChecked ? 'Ready to Check' :
                 isFCFSWL ? (mintedPhases.includes('fcfs') ? 'Minted!' : 'Eligible!') :
                 'Not Eligible'}
              </span>
            </div>
            <p>Those who dare to venture first into the unknown depths</p>
          </div>

          {/* Public */}
          <div className="status-card">
            <div className="status-card-header">
              <h3>The Masses (Public)</h3>
              <span className="status-badge">
                {!address ? 'Connect Wallet' :
                 checking ? 'Checking...' :
                 !eligibilityChecked ? 'Ready to Check' :
                 currentPhase === "2" ? (mintedPhases.includes('public') ? 'Minted!' : 'Eligible!') :
                 'Eligible!'}
              </span>
            </div>
            <p>When the stars align, all shall witness the great awakening</p>
          </div>
        </div>
      </div>

      {/* Game Description Section */}
      <section className="game-section">
        <div className="game-content">
          <h2 className="section-title">Dark Table CCG</h2>
          <p className="section-text">
            Welcome to the world&apos;s first Cross-Collectible (C2) Card Game: a free-to-play, 
            4-player strategic experience with a fully onchain, cross-platform economy and 
            1000s of items. Set in a grim Lovecraftian world, players form temporary 
            alliances and bluff their way to victory in a dark battle for survival.
          </p>
          <p className="section-text">
            Inspired by what card gamers truly want, Dark Table CCG features easier 
            deck-building, intense multiplayer chaos, and deep customization.
          </p>
        </div>
        <div className="game-media">
          <Image src="/gameplaygif.gif" alt="Dark Table CCG Gameplay" width={400} height={300} />
        </div>
      </section>

      {/* Holder Perks Section */}
      <section className="perks-section">
        <div className="perks-media">
          <Image src="/DTMint.jpeg" alt="Dark Table CCG Logo" width={400} height={200} />
        </div>
        <div className="perks-content">
          <h2 className="section-title">Holder Perks</h2>
          <ul className="section-text">
            <li>Exclusive Closed Beta Access</li>
            <li>Season Pass to earn World Chests</li>
            <li>Auto-WL for the high-utility Origin Key Collection</li>
            <li>Airdropped in-game Alpha Bundle</li>
          </ul>
        </div>
      </section>


      </main>
    </>
  );
}
