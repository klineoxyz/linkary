import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles/index.css';

// ⚡ TRIPLE-LAYER SUPPRESSION (Backup Layer 3)
(function() {
  if (typeof console === 'undefined') return;
  
  const _warn = console.warn.bind(console);
  const _error = console.error.bind(console);
  
  const suppress = (args: IArguments) => {
    const msg = Array.from(args).map(a => String(a)).join(' ').toLowerCase();
    return msg.includes('[evm]') || 
           msg.includes('evm]') ||
           msg.includes('[injected') || 
           msg.includes('injected|') ||
           msg.includes('failed to proxy') ||
           msg.includes('could not proxy') ||
           msg.includes('proxy request') ||
           msg.includes('proxy send') ||
           msg.includes('sendasync') ||
           msg.includes('interception');
  };
  
  console.warn = function() {
    if (!suppress(arguments)) _warn.apply(console, arguments);
  };
  
  console.error = function() {
    if (!suppress(arguments)) _error.apply(console, arguments);
  };
})();

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);