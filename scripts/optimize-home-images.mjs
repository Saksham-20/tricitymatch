import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const scriptFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(scriptFile), '..');
const imageDir = path.join(rootDir, 'frontend', 'public', 'images');
const outputDir = path.join(imageDir, 'optimized');

const imagePlan = [
  { name: 'hero-couple', width: 1600, quality: 78 },
  { name: 'couple-walking', width: 1600, quality: 76 },
  { name: 'wedding-ceremony', width: 1200, quality: 76 },
  { name: 'wedding-hands', width: 1200, quality: 76 },
  { name: 'couple-testimonial', width: 1200, quality: 76 },
  { name: 'couple-engagement', width: 1200, quality: 76 },
  { name: 'profile-priya', width: 640, quality: 74 },
  { name: 'profile-rahul', width: 640, quality: 74 },
  { name: 'profile-anjali', width: 640, quality: 74 },
  { name: 'profile-arjun', width: 640, quality: 74 },
  { name: 'profile-meera', width: 640, quality: 74 },
];

const sourceExtensions = ['.png', '.jpg', '.jpeg'];

async function findSourceFile(name) {
  for (const extension of sourceExtensions) {
    const filePath = path.join(imageDir, `${name}${extension}`);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      // Continue searching extensions.
    }
  }
  throw new Error(`Source file not found for ${name}`);
}

async function optimizeImage({ name, width, quality }) {
  const sourceFile = await findSourceFile(name);
  const outputFile = path.join(outputDir, `${name}.webp`);

  const sourceStats = await fs.stat(sourceFile);
  const sourceImage = sharp(sourceFile, { failOn: 'none' });
  const metadata = await sourceImage.metadata();
  const targetWidth = Math.min(width, metadata.width || width);

  await sourceImage
    .resize({ width: targetWidth, withoutEnlargement: true })
    .webp({ quality, effort: 6 })
    .toFile(outputFile);

  const outputStats = await fs.stat(outputFile);
  const savedKb = ((sourceStats.size - outputStats.size) / 1024).toFixed(1);
  console.log(`${name}: ${(sourceStats.size / 1024).toFixed(1)}KB -> ${(outputStats.size / 1024).toFixed(1)}KB (${savedKb}KB saved)`);
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  for (const item of imagePlan) {
    await optimizeImage(item);
  }

  console.log(`Optimized images written to ${path.relative(rootDir, outputDir)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});