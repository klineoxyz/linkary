import React from 'react';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

export interface TokenData {
  ticker: string;
  name: string;
  contractAddress: string;
  chain: string;
  price?: string;
  change24h?: number;
  marketCap?: string;
  volume24h?: string;
  links?: {
    coinmarketcap?: string;
    coingecko?: string;
    dexscreener?: string;
  };
}

interface TokenPriceCardProps {
  token: TokenData;
}

export function TokenPriceCard({ token }: TokenPriceCardProps) {
  const isPositive = token.change24h && token.change24h >= 0;
  
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: '#0F172A' }}>
            {token.name}
          </h3>
          <p className="text-sm" style={{ color: '#64748B' }}>
            ${token.ticker} · {token.chain}
          </p>
        </div>
        {token.change24h !== undefined && (
          <div className={`flex items-center gap-1 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">
              {isPositive ? '+' : ''}{token.change24h.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {token.price && (
        <div className="mb-4">
          <div className="text-3xl font-bold" style={{ color: '#0F172A' }}>
            ${token.price}
          </div>
        </div>
      )}

      {(token.marketCap || token.volume24h) && (
        <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          {token.marketCap && (
            <div>
              <div className="text-xs font-medium" style={{ color: '#64748B' }}>
                Market Cap
              </div>
              <div className="mt-1 text-sm font-semibold" style={{ color: '#0F172A' }}>
                ${token.marketCap}
              </div>
            </div>
          )}
          {token.volume24h && (
            <div>
              <div className="text-xs font-medium" style={{ color: '#64748B' }}>
                Volume (24h)
              </div>
              <div className="mt-1 text-sm font-semibold" style={{ color: '#0F172A' }}>
                ${token.volume24h}
              </div>
            </div>
          )}
        </div>
      )}

      {token.links && (
        <div className="flex flex-wrap gap-2">
          {token.links.coinmarketcap && (
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => window.open(token.links!.coinmarketcap, '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
              CoinMarketCap
            </Button>
          )}
          {token.links.coingecko && (
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => window.open(token.links!.coingecko, '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
              CoinGecko
            </Button>
          )}
          {token.links.dexscreener && (
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => window.open(token.links!.dexscreener, '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
              Dexscreener
            </Button>
          )}
        </div>
      )}

      <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-2 text-xs" style={{ color: '#64748B' }}>
        <span className="font-medium">Contract:</span> {token.contractAddress.slice(0, 8)}...{token.contractAddress.slice(-6)}
      </div>
    </Card>
  );
}
