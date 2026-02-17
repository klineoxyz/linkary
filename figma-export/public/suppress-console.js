// MEGA AGGRESSIVE CONSOLE SUPPRESSION - NUCLEAR OPTION
// This runs as early as possible to intercept ALL console calls

(function() {
  'use strict';
  
  if (typeof window === 'undefined' || typeof console === 'undefined') {
    return;
  }

  // Store original methods with proper binding
  const originalMethods = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console)
  };

  // Ultra-aggressive filter function
  const shouldBlock = function(args) {
    try {
      // Convert all arguments to searchable string
      let fullMessage = '';
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (typeof arg === 'string') {
          fullMessage += arg + ' ';
        } else if (arg && typeof arg === 'object') {
          try {
            fullMessage += JSON.stringify(arg) + ' ';
          } catch (e) {
            fullMessage += String(arg) + ' ';
          }
        } else {
          fullMessage += String(arg || '') + ' ';
        }
      }

      // Convert to lowercase for case-insensitive matching
      const msg = fullMessage.toLowerCase();

      // Block any message containing these keywords
      const blockList = [
        'injected',
        'evm',
        'proxy',
        'interception',
        'wallet',
        'metamask',
        'coinbase',
        'rabby',
        'rainbow',
        'phantom',
        'trust wallet',
        'web3',
        'ethereum',
        'provider',
        'failed to proxy',
        'could not proxy',
        'request method',
        'send method',
        'sendasync',
        'will not work'
      ];

      for (let i = 0; i < blockList.length; i++) {
        if (msg.indexOf(blockList[i]) !== -1) {
          return true;
        }
      }

      return false;
    } catch (e) {
      // If anything fails, don't block
      return false;
    }
  };

  // Override ALL console methods with Object.defineProperty for maximum lock
  try {
    Object.defineProperty(console, 'warn', {
      value: function() {
        if (!shouldBlock(arguments)) {
          originalMethods.warn.apply(console, arguments);
        }
      },
      configurable: false,
      writable: false,
      enumerable: true
    });

    Object.defineProperty(console, 'error', {
      value: function() {
        if (!shouldBlock(arguments)) {
          originalMethods.error.apply(console, arguments);
        }
      },
      configurable: false,
      writable: false,
      enumerable: true
    });

    Object.defineProperty(console, 'log', {
      value: function() {
        if (!shouldBlock(arguments)) {
          originalMethods.log.apply(console, arguments);
        }
      },
      configurable: false,
      writable: false,
      enumerable: true
    });

    Object.defineProperty(console, 'info', {
      value: function() {
        if (!shouldBlock(arguments)) {
          originalMethods.info.apply(console, arguments);
        }
      },
      configurable: false,
      writable: false,
      enumerable: true
    });

    Object.defineProperty(console, 'debug', {
      value: function() {
        if (!shouldBlock(arguments)) {
          originalMethods.debug.apply(console, arguments);
        }
      },
      configurable: false,
      writable: false,
      enumerable: true
    });

  } catch (e) {
    // Fallback to regular override if Object.defineProperty fails
    console.warn = function() {
      if (!shouldBlock(arguments)) {
        originalMethods.warn.apply(console, arguments);
      }
    };

    console.error = function() {
      if (!shouldBlock(arguments)) {
        originalMethods.error.apply(console, arguments);
      }
    };

    console.log = function() {
      if (!shouldBlock(arguments)) {
        originalMethods.log.apply(console, arguments);
      }
    };

    console.info = function() {
      if (!shouldBlock(arguments)) {
        originalMethods.info.apply(console, arguments);
      }
    };

    console.debug = function() {
      if (!shouldBlock(arguments)) {
        originalMethods.debug.apply(console, arguments);
      }
    };
  }

  // Also try to prevent extensions from logging by intercepting Error objects
  const OriginalError = window.Error;
  window.Error = function() {
    const err = OriginalError.apply(this, arguments);
    const msg = String(err.message || '').toLowerCase();
    
    if (msg.indexOf('injected') > -1 || 
        msg.indexOf('evm') > -1 || 
        msg.indexOf('proxy') > -1) {
      // Swallow the error
      return { message: '', stack: '', toString: function() { return ''; } };
    }
    
    return err;
  };
  window.Error.prototype = OriginalError.prototype;

  // Prevent window.onerror from showing these messages
  window.addEventListener('error', function(event) {
    const msg = String(event.message || '').toLowerCase();
    if (msg.indexOf('injected') > -1 || 
        msg.indexOf('evm') > -1 || 
        msg.indexOf('proxy') > -1) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
  }, true);

  // Intercept unhandledrejection
  window.addEventListener('unhandledrejection', function(event) {
    const msg = String(event.reason || '').toLowerCase();
    if (msg.indexOf('injected') > -1 || 
        msg.indexOf('evm') > -1 || 
        msg.indexOf('proxy') > -1) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
  }, true);

  // Flag that suppression is active
  window.__CONSOLE_SUPPRESSION_ACTIVE__ = true;

})();
