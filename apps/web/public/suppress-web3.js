/**
 * Web3 Wallet Warning Suppressor
 * This script runs BEFORE any React code loads
 * Add to <head> of index.html for earliest execution
 */

(function() {
  'use strict';
  
  if (typeof console === 'undefined' || typeof window === 'undefined') {
    return;
  }

  // Store original methods
  var _warn = console.warn;
  var _error = console.error;
  var _log = console.log;

  // Check if message should be suppressed
  function shouldSuppress(args) {
    if (!args || args.length === 0) return false;
    
    var message = String(args[0] || '').toLowerCase();
    
    return (
      message.indexOf('[evm]') !== -1 ||
      message.indexOf('evm]') !== -1 ||
      message.indexOf('[injected') !== -1 ||
      message.indexOf('injected|') !== -1 ||
      message.indexOf('injected]') !== -1 ||
      message.indexOf('failed to proxy') !== -1 ||
      message.indexOf('could not proxy') !== -1 ||
      message.indexOf('proxy request method') !== -1 ||
      message.indexOf('proxy send method') !== -1 ||
      message.indexOf('proxy sendasync method') !== -1 ||
      message.indexOf('interception will not work') !== -1 ||
      message.indexOf('provider - interception') !== -1 ||
      (message.indexOf('metamask') !== -1 && message.indexOf('proxy') !== -1)
    );
  }

  // Override console.warn
  console.warn = function() {
    if (shouldSuppress(arguments)) return;
    return _warn.apply(console, arguments);
  };

  // Override console.error
  console.error = function() {
    if (shouldSuppress(arguments)) return;
    return _error.apply(console, arguments);
  };

  // Override console.log
  console.log = function() {
    if (shouldSuppress(arguments)) return;
    return _log.apply(console, arguments);
  };

  // Optional: Create ethereum stub to prevent some injection attempts
  if (!window.ethereum) {
    window.ethereum = {
      isMetaMask: false,
      request: function() {
        return Promise.reject(new Error('No Web3 wallet connected'));
      },
      send: function() {
        throw new Error('No Web3 wallet connected');
      },
      sendAsync: function() {
        throw new Error('No Web3 wallet connected');
      },
      on: function() {},
      removeListener: function() {}
    };
  }
})();
