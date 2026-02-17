/**
 * Global TypeScript type definitions
 */

interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    isConnected?: () => boolean;
    request?: (args: { method: string; params?: any[] }) => Promise<any>;
    send?: (method: string, params?: any[]) => Promise<any>;
    sendAsync?: (payload: any, callback: (error: any, response: any) => void) => void;
    on?: (event: string, handler: (...args: any[]) => void) => void;
    removeListener?: (event: string, handler: (...args: any[]) => void) => void;
    selectedAddress?: string | null;
    chainId?: string;
    networkVersion?: string;
    _metamask?: {
      isUnlocked: () => Promise<boolean>;
    };
    // Add other wallet providers
    isCoinbaseWallet?: boolean;
    isTrust?: boolean;
    isRabby?: boolean;
  };
}

// Extend NodeJS global for SSR compatibility
declare global {
  interface Window {
    ethereum?: Window['ethereum'];
  }
}

export {};
