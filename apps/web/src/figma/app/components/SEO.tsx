import React from "react";
import { Helmet } from "react-helmet";

/**
 * SEO Component for metadata management
 * Handles title, description, OpenGraph, Twitter cards, and structured data
 */

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: "website" | "profile" | "article";
  twitterCard?: "summary" | "summary_large_image";
  noindex?: boolean;
  structuredData?: object;
}

const DEFAULT_SEO = {
  title: "Linkary - Verifiable Reputation for Web3 Work",
  description:
    "Profiles, proof, and analytics in one place. Build verifiable reputation with ETHOS and counterparty verification.",
  ogImage: "/og-image.png",
  twitterHandle: "@linkary",
};

export default function SEO({
  title,
  description = DEFAULT_SEO.description,
  canonical,
  ogImage = DEFAULT_SEO.ogImage,
  ogType = "website",
  twitterCard = "summary_large_image",
  noindex = false,
  structuredData,
}: SEOProps) {
  const fullTitle = title ? `${title} | Linkary` : DEFAULT_SEO.title;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* OpenGraph Tags */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      {canonical && <meta property="og:url" content={canonical} />}

      {/* Twitter Card Tags */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:site" content={DEFAULT_SEO.twitterHandle} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured Data (JSON-LD) */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}

// Structured Data Helpers
export const personSchema = (data: {
  name: string;
  handle: string;
  image?: string;
  description?: string;
  url?: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Person",
  name: data.name,
  alternateName: data.handle,
  image: data.image,
  description: data.description,
  url: data.url,
});

export const organizationSchema = (data: {
  name: string;
  description?: string;
  logo?: string;
  url?: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: data.name,
  description: data.description,
  logo: data.logo,
  url: data.url,
});

export const reviewSchema = (data: {
  itemReviewed: string;
  author: string;
  rating: number;
  reviewBody: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Review",
  itemReviewed: {
    "@type": "Thing",
    name: data.itemReviewed,
  },
  author: {
    "@type": "Person",
    name: data.author,
  },
  reviewRating: {
    "@type": "Rating",
    ratingValue: data.rating,
    bestRating: 5,
  },
  reviewBody: data.reviewBody,
});
