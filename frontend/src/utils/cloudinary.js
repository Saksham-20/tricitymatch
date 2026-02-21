/**
 * Cloudinary URL transformation utilities
 */

/**
 * Check if a URL is a Cloudinary URL
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
export const isCloudinaryUrl = (url) => {
  return url && typeof url === 'string' && url.includes('cloudinary');
};

/**
 * Get a transformed Cloudinary URL with specified transformations
 * @param {string} url - The original Cloudinary URL
 * @param {string} transformations - The transformation string to insert
 * @returns {string} - The transformed URL
 */
export const getTransformedUrl = (url, transformations) => {
  if (!isCloudinaryUrl(url)) {
    return url;
  }
  
  // Insert transformation after /upload/
  return url.replace('/upload/', `/upload/${transformations}/`);
};

/**
 * Get a thumbnail URL (150x150) optimized for small displays
 * @param {string} url - The original URL
 * @returns {string} - The transformed URL
 */
export const getThumbnailUrl = (url) => {
  if (!isCloudinaryUrl(url)) {
    return url;
  }
  return getTransformedUrl(url, 'w_150,h_150,c_thumb,g_face,f_auto,q_auto');
};

/**
 * Get a profile card URL (300x300) optimized for profile cards
 * @param {string} url - The original URL
 * @returns {string} - The transformed URL
 */
export const getProfileCardUrl = (url) => {
  if (!isCloudinaryUrl(url)) {
    return url;
  }
  return getTransformedUrl(url, 'w_300,h_300,c_fill,g_face,f_auto,q_auto');
};

/**
 * Get a full-size optimized URL (800x800) for profile detail view
 * @param {string} url - The original URL
 * @returns {string} - The transformed URL
 */
export const getFullSizeUrl = (url) => {
  if (!isCloudinaryUrl(url)) {
    return url;
  }
  return getTransformedUrl(url, 'w_800,h_800,c_limit,f_auto,q_auto');
};

/**
 * Get a gallery thumbnail URL (200x200) for gallery grids
 * @param {string} url - The original URL
 * @returns {string} - The transformed URL
 */
export const getGalleryThumbnailUrl = (url) => {
  if (!isCloudinaryUrl(url)) {
    return url;
  }
  return getTransformedUrl(url, 'w_200,h_200,c_fill,g_face,f_auto,q_auto');
};

/**
 * Get avatar URL (50x50) for small circular avatars
 * @param {string} url - The original URL
 * @returns {string} - The transformed URL
 */
export const getAvatarUrl = (url) => {
  if (!isCloudinaryUrl(url)) {
    return url;
  }
  return getTransformedUrl(url, 'w_50,h_50,c_thumb,g_face,f_auto,q_auto');
};

/**
 * Get the proper image URL based on whether it's a Cloudinary URL or local URL
 * For Cloudinary URLs, apply the specified transformation
 * For local URLs, prepend the API base URL
 * @param {string} url - The original URL (either Cloudinary or local path)
 * @param {string} apiBaseUrl - The API base URL for local paths
 * @param {string} [transformation] - The transformation to apply for Cloudinary URLs
 * @returns {string} - The proper URL to use
 */
export const getImageUrl = (url, apiBaseUrl, transformation = 'profile') => {
  const u = typeof url === 'string' ? url.trim() : url;
  if (!u) return null;

  // If it's already a full URL (Cloudinary or other)
  if (u.startsWith('http://') || u.startsWith('https://')) {
    // Apply transformation if it's a Cloudinary URL
    if (isCloudinaryUrl(u)) {
      switch (transformation) {
        case 'thumbnail':
          return getThumbnailUrl(u);
        case 'profile':
          return getProfileCardUrl(u);
        case 'full':
          return getFullSizeUrl(u);
        case 'gallery':
          return getGalleryThumbnailUrl(u);
        case 'avatar':
          return getAvatarUrl(u);
        default:
          return u;
      }
    }
    return u;
  }

  // Local path - prepend API base URL (ensure no double slash)
  const base = (apiBaseUrl || '').replace(/\/$/, '');
  const path = u.startsWith('/') ? u : `/${u}`;
  return base ? `${base}${path}` : path;
};
