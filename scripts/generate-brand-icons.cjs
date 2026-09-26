const path = require('path');
const sharp = require('sharp');

const src = process.argv[2];
const outDir = process.argv[3] || path.join(__dirname, '../apps/web/public');

async function run() {
  const jobs = [
    ['favicon.png', 32],
    ['apple-touch-icon.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['logo.png', 512],
  ];
  for (const [name, size] of jobs) {
    await sharp(src)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toFile(path.join(outDir, name));
    console.log('wrote', name);
  }
  // Keep logo.jpg as PNG bytes renamed for bump script compatibility
  await sharp(src)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .jpeg({ quality: 92 })
    .toFile(path.join(outDir, 'logo.jpg'));
  console.log('wrote logo.jpg');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
