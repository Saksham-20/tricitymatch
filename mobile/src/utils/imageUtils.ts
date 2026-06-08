// Image utilities — resizing and Cloudinary URL helpers

export const getCloudinaryUrl = (
  publicId: string,
  options: { width?: number; height?: number; crop?: string; quality?: string; blur?: boolean } = {}
): string => {
  const { width = 400, height = 400, crop = 'fill', quality = 'auto', blur = false } = options;
  const base = `https://res.cloudinary.com/${process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`;
  const transforms = [`w_${width}`, `h_${height}`, `c_${crop}`, `q_${quality}`, 'f_auto'];
  if (blur) transforms.push('e_blur:800');
  return `${base}/${transforms.join(',')}/${publicId}`;
};

export const getThumbnailUrl = (publicId: string): string =>
  getCloudinaryUrl(publicId, { width: 150, height: 150, quality: 'q_70' });

export const getProfilePhotoUrl = (publicId: string): string =>
  getCloudinaryUrl(publicId, { width: 400, height: 400 });
