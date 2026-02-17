/**
 * Suppress Web3 wallet extension warnings
 * 
 * This suppresses console warnings from browser wallet extensions (MetaMask, etc.)
 * trying to inject EVM providers when they can't properly proxy methods.
 * 
 * IMPORTANT: This runs immediately as an IIFE when the module is loaded
 */

// IMMEDIATELY INVOKED - Runs before React or any other code
if (typeof window !== 'undefined' && typeof console !== 'undefined') {
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;

  // Check if message should be suppressed
  const shouldSuppress = (args: any[]): boolean => {
    if (!args || args.length === 0) return false;
    
    const message = String(args[0] || '').toLowerCase();
    
    return (
      message.includes('[evm]') ||
      message.includes('evm]') ||
      message.includes('[injected') ||
      message.includes('injected|') ||
      message.includes('injected]') ||
      message.includes('failed to proxy') ||
      message.includes('could not proxy') ||
      message.includes('proxy request method') ||
      message.includes('proxy send method') ||
      message.includes('proxy sendasync method') ||
      message.includes('interception will not work') ||
      message.includes('provider - interception') ||
      (message.includes('metamask') && message.includes('proxy'))
    );
  };

  // Override console methods IMMEDIATELY
  console.warn = function(...args: any[]) {
    if (shouldSuppress(args)) return;
    return originalWarn.apply(console, args);
  };

  console.error = function(...args: any[]) {
    if (shouldSuppress(args)) return;
    return originalError.apply(console, args);
  };

  console.log = function(...args: any[]) {
    if (shouldSuppress(args)) return;
    return originalLog.apply(console, args);
  };
}

export function suppressWeb3Warnings() {
  // Already executed above via IIFE
  return true;
}

/**
 * Initialize a minimal ethereum provider stub to prevent injection errors
 * This prevents wallet extensions from throwing errors when trying to inject
 */
export function initializeEthereumStub() {
  if (typeof window !== 'undefined' && !window.ethereum) {
    // Create a minimal stub to prevent injection errors
    (window as any).ethereum = {
      isMetaMask: false,
      request: async () => {
        throw new Error('No Web3 wallet connected');
      },
      send: () => {
        throw new Error('No Web3 wallet connected');
      },
      sendAsync: () => {
        throw new Error('No Web3 wallet connected');
      },
      on: () => {},
      removeListener: () => {},
      _metamask: undefined,
    };
  }
}
