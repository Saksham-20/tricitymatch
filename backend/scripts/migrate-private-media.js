/**
 * Convert existing selfies, voice notes and video intros from public Cloudinary
 * delivery (`upload`) to private (`authenticated`), and rewrite the stored URL.
 * New uploads are already private (middlewares/upload.js); this covers what was
 * uploaded before.
 *
 *   node scripts/migrate-private-media.js            # DRY RUN: list what would move
 *   node scripts/migrate-private-media.js --execute  # convert
 *
 * Safe to re-run: rows already on `authenticated` (or not on Cloudinary) are
 * skipped. Per-row failures are reported and do not stop the run; a row is only
 * rewritten after Cloudinary confirms the rename, so a failure leaves the old
 * public URL working rather than a dead link.
 *
 * Until it has been run, old assets keep working (utils/privateMedia passes
 * public URLs through unchanged), they just are not private yet.
 */

const { QueryTypes } = require('sequelize');
const cloudinary = require('cloudinary').v2;
const sequelize = require('../config/database');
const config = require('../config/env');
const { parseCloudinaryAsset } = require('../utils/cloudinaryAsset');

const execute = process.argv.includes('--execute');

// table, column, extra WHERE
const TARGETS = [
  ['Verifications', 'selfiePhoto', ''],
  ['Verifications', 'selfieVideoUrl', ''],
  ['Profiles', 'voiceIntroUrl', ''],
  ['Profiles', 'videoIntroUrl', ''],
  ['Messages', 'mediaUrl', `AND "messageType" = 'voice'`],
];

(async () => {
  sequelize.options.logging = false;
  if (!config.cloudinary.isConfigured()) {
    console.error('Cloudinary is not configured; nothing to do.');
    process.exit(1);
  }
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
  });

  let candidates = 0;
  let moved = 0;
  let failed = 0;

  for (const [table, column, extra] of TARGETS) {
    const rows = await sequelize.query(
      `SELECT "id", "${column}" AS url FROM "${table}" WHERE "${column}" IS NOT NULL ${extra}`,
      { type: QueryTypes.SELECT }
    );
    for (const row of rows) {
      const asset = parseCloudinaryAsset(row.url);
      if (!asset || asset.kind !== 'cloudinary' || asset.type !== 'upload') continue;
      // Not ours (seed data pointing at Cloudinary's public demo cloud, say).
      if (new URL(row.url).pathname.split('/')[1] !== config.cloudinary.cloudName) continue;
      candidates += 1;
      const label = `${table}.${column} ${row.id} (${asset.resourceType}) ${asset.publicId}`;
      if (!execute) { console.log(`would convert  ${label}`); continue; }

      try {
        const res = await cloudinary.uploader.rename(asset.publicId, asset.publicId, {
          resource_type: asset.resourceType,
          type: 'upload',
          to_type: 'authenticated',
          invalidate: true,
        });
        await sequelize.query(
          `UPDATE "${table}" SET "${column}" = :url WHERE "id" = :id`,
          { replacements: { url: res.secure_url, id: row.id } }
        );
        moved += 1;
        console.log(`converted      ${label}`);
      } catch (err) {
        failed += 1;
        console.error(`FAILED         ${label}: ${err.message || err.error?.message}`);
      }
    }
  }

  console.log(execute
    ? `\n${moved} converted, ${failed} failed, ${candidates} candidates`
    : `\n${candidates} asset(s) would be converted. Re-run with --execute.`);
  await sequelize.close();
  process.exit(failed ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
