/**
 * Web3 Wallet Warning Suppressor
 * Import this FIRST in your main entry point
 */

(function() {
  'use strict';
  
  if (typeof console === 'undefined' || typeof window === 'undefined') {
    return;
  }

  // Store original console methods
  const originalConsole = {
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    log: console.log.bind(console)
  };

  // Check if message should be suppressed
  function shouldSuppress(args) {
    if (!args || args.length === 0) return false;
    
    try {
      // Check all arguments
      for (let i = 0; i < args.length; i++) {
        let message = '';
        const arg = args[i];
        
        if (typeof arg === 'string') {
          message = arg;
        } else if (arg && typeof arg === 'object') {
          try {
            message = JSON.stringify(arg);
          } catch {
            message = String(arg);
          }
        } else {
          message = String(arg || '');
        }
        
        message = message.toLowerCase();
        
        // Comprehensive wallet-related patterns
        const patterns = [
          'evm', 
          'injected', 
          'proxy request', 
          'proxy send',
          'proxy sendasync',
          'failed to proxy',
          'could not proxy',
          'interception will not work',
          'provider - interception',
          'any methods on provider',
          'metamask',
          'coinbase wallet',
          'rabby',
          'web3 provider',
          'ethereum provider'
        ];
        
        for (let j = 0; j < patterns.length; j++) {
          if (message.indexOf(patterns[j]) !== -1) {
            return true;
          }
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }

  // Override console.warn
  console.warn = function() {
    if (shouldSuppress(arguments)) return;
    return originalConsole.warn.apply(console, arguments);
  };

  // Override console.error
  console.error = function() {
    if (shouldSuppress(arguments)) return;
    return originalConsole.error.apply(console, arguments);
  };

  // Override console.log
  console.log = function() {
    if (shouldSuppress(arguments)) return;
    return originalConsole.log.apply(console, arguments);
  };

  // Prevent console object from being overwritten
  try {
    Object.defineProperty(window, 'console', {
      value: console,
      writable: false,
      configurable: false
    });
  } catch (e) {
    // Silently fail if we can't lock the console
  }
})();
