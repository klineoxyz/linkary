import React from 'react';
import { PublicStandaloneProfile, PublicProfileData } from './profile/PublicStandaloneProfile';

// Demo data for standalone public profile
const demoPublicProfile: PublicProfileData = {
  type: 'individual',
  slug: 'muazxinthi',
  name: 'Muaz Xinthi',
  handle: 'Muazxinthi',
  bio: 'Creator economy operator. Web3 GTM, research, and partnerships. Building Linkary: reputation-driven gigs + reviews.',
  location: 'Berlin',
  verified: true,
  
  ethos: 842,
  xscore: 771,
  reputationIndex: 86,
  socialPower: 823,
  
  reviews: {
    avg: 4.8,
    count: 37,
  },
  
  socialLinks: [
    { platform: 'x', url: 'https://x.com/muazxinthi' },
    { platform: 'linkedin', url: 'https://linkedin.com/in/muazxinthi' },
    { platform: 'telegram', url: 'https://t.me/muazxinthi' },
    { platform: 'website', url: 'https://linkary.xyz' },
  ],
  
  links: [
    { label: 'Portfolio', url: 'https://example.com/portfolio', clicks: 412 },
    { label: 'Case Studies', url: 'https://example.com/case-studies', clicks: 324 },
    { label: 'Bento Profile', url: 'https://bento.me/muazxinthi', clicks: 632 },
    { label: 'Media Kit', url: 'https://example.com/media', clicks: 156 },
  ],
  
  ambassadorOf: ['MatrixPay', 'Gemini Labs'],
  
  partnerships: [
    { name: 'Chainlink', type: 'Infrastructure Partner', verified: true },
    { name: 'Polygon', type: 'Ecosystem Partner', verified: true },
  ],
  
  featuredWork: [
    { title: 'MatrixPay GTM Strategy', views: 1240 },
    { title: 'Web3 Creator Playbook', views: 892 },
    { title: 'Partnership Framework', views: 634 },
    { title: 'Community Growth Guide', views: 521 },
  ],
  
  caseStudies: [
    {
      id: 'cs-1',
      projectName: 'MatrixPay',
      role: 'Content Creator & Growth Lead',
      duration: '3 months',
      results: { metric: 'Engagement Rate', value: '+340%' },
      verified: true,
    },
    {
      id: 'cs-2',
      projectName: 'Gemini Labs',
      role: 'Marketing Strategist',
      duration: '6 weeks',
      results: { metric: 'Partners Onboarded', value: '12' },
      verified: true,
    },
  ],
  
  reviewItems: [
    {
      by: 'MatrixPay',
      byType: 'project',
      rating: 5,
      title: 'Fast delivery and sharp strategy',
      text: 'Great comms, shipped assets on time, and helped our creator sprint outperform targets.',
      date: '2026-02-02',
      verifiedDeal: true,
    },
    {
      by: 'Gemini Labs',
      byType: 'project',
      rating: 4,
      title: 'Strong creative direction',
      text: 'Excellent taste and execution. Would love to work again.',
      date: '2026-01-18',
      verifiedDeal: true,
    },
  ],
};

// Demo data for project with token
const demoProjectProfile: PublicProfileData = {
  type: 'project',
  slug: 'matrixpay',
  name: 'MatrixPay',
  tagline: 'Payments + creator bounties for Web3 teams',
  verified: true,
  
  ethos: 721,
  xscore: 806,
  reputationIndex: 88,
  socialPower: 794,
  
  reviews: {
    avg: 4.7,
    count: 29,
  },
  
  socialLinks: [
    { platform: 'x', url: 'https://x.com/matrixpay' },
    { platform: 'discord', url: 'https://discord.gg/matrixpay' },
    { platform: 'telegram', url: 'https://t.me/matrixpay' },
    { platform: 'website', url: 'https://matrixpay.xyz' },
    { platform: 'github', url: 'https://github.com/matrixpay' },
  ],
  
  links: [
    { label: 'Documentation', url: 'https://docs.matrixpay.xyz', clicks: 8420 },
    { label: 'Start Building', url: 'https://app.matrixpay.xyz', clicks: 3210 },
    { label: 'Careers', url: 'https://matrixpay.xyz/careers', clicks: 1560 },
    { label: 'Media Kit', url: 'https://matrixpay.xyz/media', clicks: 892 },
  ],
  
  founders: [
    {
      name: 'Sarah Chen',
      role: 'CTO & Co-Founder',
      handle: 'sarahchen',
      ethos: 892,
      xscore: 654,
      socialPower: 712,
      verified: true,
      videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      videoCaption: 'Sarah explains MatrixPay\'s vision for creator payments',
    },
    {
      name: 'Alex Kim',
      role: 'Lead Designer',
      handle: 'alexkim',
      ethos: 743,
      xscore: 821,
      socialPower: 789,
      verified: true,
    },
    {
      name: 'Muaz Xinthi',
      role: 'Growth Lead',
      handle: 'Muazxinthi',
      ethos: 842,
      xscore: 771,
      socialPower: 823,
      verified: true,
    },
  ],
  
  token: {
    ticker: 'MATRIX',
    name: 'MatrixPay Token',
    contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
    chain: 'Ethereum',
    price: '2.34',
    change24h: 5.67,
    marketCap: '42.5M',
    volume24h: '8.9M',
    links: {
      coinmarketcap: 'https://coinmarketcap.com/currencies/matrixpay',
      coingecko: 'https://coingecko.com/en/coins/matrixpay',
      dexscreener: 'https://dexscreener.com/ethereum/0x1234567890abcdef',
    },
  },
  
  partnerships: [
    { name: 'Chainlink', type: 'Oracle Partner', verified: true },
    { name: 'Polygon', type: 'Infrastructure Partner', verified: true },
    { name: 'Uniswap', type: 'DEX Integration', verified: true },
  ],
  
  caseStudies: [
    {
      id: 'cs-1',
      projectName: 'Creator Campaign Q1 2026',
      role: 'Platform',
      duration: '3 months',
      results: { metric: 'Total Payments', value: '$125K' },
      verified: true,
    },
  ],
  
  reviewItems: [
    {
      by: 'Muaz Xinthi',
      byType: 'individual',
      rating: 5,
      title: 'Best payment platform for creators',
      text: 'Fast settlements, great support team, and transparent pricing.',
      date: '2026-02-02',
      verifiedDeal: true,
    },
  ],
};

interface PublicStandalonePageProps {
  profileType?: 'individual' | 'project';
}

export default function PublicStandalonePage({ profileType = 'individual' }: PublicStandalonePageProps) {
  const profileData = profileType === 'project' ? demoProjectProfile : demoPublicProfile;
  
  return (
    <PublicStandaloneProfile 
      data={profileData}
      isLoggedIn={false}
    />
  );
}
