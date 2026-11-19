import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sizes = [
  { dir: 'mipmap-mdpi',    size: 48 },
  { dir: 'mipmap-hdpi',    size: 72 },
  { dir: 'mipmap-xhdpi',   size: 96 },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

const base = 'android/app/src/main/res';

for (const { dir, size } of sizes) {
  const pad = Math.round(size * 0.12);
  const emojiSize = size - pad * 2;
  const radius = Math.round(size * 0.22);

  // Dark rounded background
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" rx="${radius}" fill="#0a0e1a"/>
    </svg>`
  );

  // Resize emoji and composite on background
  const emoji = await sharp('emoji-box.png').resize(emojiSize, emojiSize).png().toBuffer();

  const result = await sharp(bg)
    .composite([{ input: emoji, top: pad, left: pad }])
    .png()
    .toBuffer();

  const outDir = path.join(base, dir);
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    const outPath = path.join(outDir, name);
    await sharp(result).toFile(outPath);
    console.log(`✓ ${outPath}`);
  }
}

console.log('\nDone!');
