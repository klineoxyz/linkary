/**
 * Web3 Wallet Integration Utilities
 * 
 * Handles Web3 wallet extensions gracefully to prevent console spam
 * and prepare for future wallet integration features
 */

// Run suppression immediately when this module loads
if (typeof window !== 'undefined') {
  suppressEVMWarningsImmediately();
}

/**
 * Initialize Web3 environment
 * This should be called as early as possible in the app lifecycle
 */
export function initWeb3Environment() {
  if (typeof window === 'undefined') return;

  // Suppress console warnings from wallet extensions
  suppressEVMWarnings();
  
  // Optionally prepare for future wallet connections
  prepareWalletConnection();
}

/**
 * Suppress EVM warnings immediately (runs on module load)
 */
function suppressEVMWarningsImmediately() {
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;

  console.warn = function (...args: any[]) {
    const message = String(args[0] || '');
    
    if (
      message.includes('[EVM]') ||
      message.includes('[evm]') ||
      message.includes('Failed to proxy') ||
      message.includes('injected') ||
      message.includes('[injected') ||
      message.includes('injected|') ||
      message.includes('request method') ||
      message.includes('send method') ||
      message.includes('sendAsync method') ||
      message.includes('interception')
    ) {
      return;
    }
    
    return originalWarn.apply(console, args);
  };

  console.error = function (...args: any[]) {
    const message = String(args[0] || '');
    
    if (
      message.includes('[EVM]') ||
      message.includes('[evm]') ||
      message.includes('[injected') ||
      message.includes('injected|') ||
      message.includes('Could not proxy any methods on provider') ||
      message.includes('interception will not work') ||
      message.includes('Failed to proxy') ||
      message.includes('request method') ||
      message.includes('send method') ||
      message.includes('sendAsync method')
    ) {
      return;
    }
    
    return originalError.apply(console, args);
  };

  console.log = function (...args: any[]) {
    const message = String(args[0] || '');
    
    if (
      message.includes('[EVM]') ||
      message.includes('[evm]') ||
      message.includes('[injected') ||
      message.includes('injected|') ||
      message.includes('Failed to proxy') ||
      message.includes('interception')
    ) {
      return;
    }
    
    return originalLog.apply(console, args);
  };
}

/**
 * Suppress EVM provider injection warnings
 */
function suppressEVMWarnings() {
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;

  console.warn = function (...args: any[]) {
    const message = String(args[0] || '');
    
    // Filter out EVM injection warnings
    if (
      message.includes('[EVM]') ||
      message.includes('Failed to proxy') ||
      message.includes('injected') ||
      message.includes('[injected') ||
      message.includes('request method') ||
      message.includes('send method') ||
      message.includes('sendAsync method') ||
      message.includes('interception')
    ) {
      return;
    }
    
    return originalWarn.apply(console, args);
  };

  console.error = function (...args: any[]) {
    const message = String(args[0] || '');
    
    // Filter out EVM injection errors
    if (
      message.includes('[EVM]') ||
      message.includes('[injected') ||
      message.includes('Could not proxy any methods on provider') ||
      message.includes('interception will not work') ||
      message.includes('Failed to proxy') ||
      message.includes('request method') ||
      message.includes('send method') ||
      message.includes('sendAsync method')
    ) {
      return;
    }
    
    return originalError.apply(console, args);
  };

  console.log = function (...args: any[]) {
    const message = String(args[0] || '');
    
    // Filter out EVM injection logs
    if (
      message.includes('[EVM]') ||
      message.includes('[injected') ||
      message.includes('Failed to proxy') ||
      message.includes('interception')
    ) {
      return;
    }
    
    return originalLog.apply(console, args);
  };
}

/**
 * Prepare for wallet connections
 * Sets up event listeners for when users want to connect wallets
 */
function prepareWalletConnection() {
  // Listen for wallet connection requests
  window.addEventListener('ethereum#initialized', handleWalletInitialized, { once: true });
  
  // If ethereum is already available, handle it
  if ((window as any).ethereum) {
    handleWalletInitialized();
  }
}

/**
 * Handle wallet initialization
 */
function handleWalletInitialized() {
  const ethereum = (window as any).ethereum;
  
  if (!ethereum) return;
  
  // Wallet is available - you can add connection logic here later
  console.log('🔗 Web3 wallet detected and ready');
  
  // Example: Listen for account changes
  if (ethereum.on) {
    ethereum.on('accountsChanged', (accounts: string[]) => {
      console.log('Accounts changed:', accounts);
    });
    
    ethereum.on('chainChanged', (chainId: string) => {
      console.log('Chain changed:', chainId);
    });
  }
}

/**
 * Connect wallet (for future use)
 */
export async function connectWallet(): Promise<string[] | null> {
  if (typeof window === 'undefined') return null;
  
  const ethereum = (window as any).ethereum;
  
  if (!ethereum) {
    console.warn('No Web3 wallet found. Please install MetaMask or another Web3 wallet.');
    return null;
  }
  
  try {
    // Request account access
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    console.log('Connected accounts:', accounts);
    return accounts;
  } catch (error) {
    console.error('Error connecting wallet:', error);
    return null;
  }
}

/**
 * Get current wallet address (if connected)
 */
export async function getCurrentWallet(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  const ethereum = (window as any).ethereum;
  
  if (!ethereum) return null;
  
  try {
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    return accounts[0] || null;
  } catch (error) {
    console.error('Error getting wallet:', error);
    return null;
  }
}

/**
 * Disconnect wallet
 */
export function disconnectWallet() {
  // Most wallets don't have a disconnect method
  // This is handled on the wallet side
  console.log('Wallet disconnection requested');
}