// Suppress Web3 wallet injection warnings
// This script should be loaded before the main app
(function() {
  if (typeof window === 'undefined' || typeof console === 'undefined') return;
  
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  
  console.warn = function(...args) {
    const message = args.join(' ').toLowerCase();
    if (message.includes('[evm]') || 
        message.includes('injected') || 
        message.includes('proxy') || 
        message.includes('failed to proxy') ||
        message.includes('interception will not work') ||
        message.includes('could not proxy')) {
      return; // Suppress these warnings
    }
    originalWarn(...args);
  };
  
  console.error = function(...args) {
    const message = args.join(' ').toLowerCase();
    if (message.includes('[evm]') || 
        message.includes('injected') || 
        message.includes('proxy') || 
        message.includes('failed to proxy') ||
        message.includes('interception will not work') ||
        message.includes('could not proxy')) {
      return; // Suppress these errors
    }
    originalError(...args);
  };
})();
