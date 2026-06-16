import React from 'react';
import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://tricityshadi.com';
const DEFAULT_TITLE = 'TricityShadi - Find Your Perfect Match in Tricity';
const DEFAULT_DESCRIPTION =
  'The most trusted matrimonial platform for Chandigarh, Mohali, and Panchkula. Find your perfect life partner with our smart matching algorithm.';
const DEFAULT_IMAGE = `${SITE_URL}/images/hero-couple.png`;

/**
 * Per-route SEO meta (SEO-3). Sets a unique title/description and a correct
 * canonical per page — fixing the previous behaviour where every route inherited
 * index.html's title and a canonical hard-pinned to "/", which caused content
 * pages to be treated as duplicates of the homepage.
 *
 * Props:
 *  - title:       page title (site name is appended unless `bare`)
 *  - description: meta description
 *  - path:        route path (e.g. "/about") used to build the canonical URL
 *  - image:       absolute OG/Twitter image URL
 *  - noindex:     when true, emits robots noindex (for auth/app pages)
 *  - bare:        use `title` verbatim without appending the site name
 */
export default function Seo({ title, description, path = '/', image, noindex = false, bare = false }) {
  const fullTitle = title ? (bare ? title : `${title} | TricityShadi`) : DEFAULT_TITLE;
  const desc = description || DEFAULT_DESCRIPTION;
  const canonical = `${SITE_URL}${path === '/' ? '/' : path.replace(/\/$/, '')}`;
  const ogImage = image || DEFAULT_IMAGE;

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}
