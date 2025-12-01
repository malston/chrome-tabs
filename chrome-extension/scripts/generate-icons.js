/**
 * Generates PNG icons from SVG source at required sizes for Chrome extension
 */

const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const svgPath = path.join(__dirname, '..', 'assets', 'icon.svg');
const assetsDir = path.join(__dirname, '..', 'assets');

const svgString = fs.readFileSync(svgPath, 'utf8');

for (const size of sizes) {
  const resvg = new Resvg(svgString, {
    fitTo: {
      mode: 'width',
      value: size
    }
  });

  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  const outputPath = path.join(assetsDir, `icon${size}.png`);
  fs.writeFileSync(outputPath, pngBuffer);
  console.log(`Generated ${outputPath} (${size}x${size})`);
}

console.log('Done!');
