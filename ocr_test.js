const Tesseract = require('tesseract.js');
const https = require('https');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'ocr_output');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

// Test with first question images (slide_3 = Q1)
const images = [
  { url: 'https://rain-public-qn.yuketang.cn/public/2035944/slide_3_4_20260512091713.png', label: 'Q1-body' },
  { url: 'https://rain-public-qn.yuketang.cn/public/2035944/slide_3_5_20260512091713.png', label: 'Q1-opt1' },
  { url: 'https://rain-public-qn.yuketang.cn/public/2035944/slide_3_6_20260512091713.png', label: 'Q1-opt2' },
];

async function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        fs.writeFileSync(dest, Buffer.concat(chunks));
        resolve(dest);
      });
    }).on('error', reject);
  });
}

async function ocrImage(filepath) {
  const { data } = await Tesseract.recognize(filepath, 'chi_sim+eng', {
    logger: m => { if (m.status === 'recognizing text') process.stdout.write('.'); }
  });
  return data.text;
}

(async () => {
  for (const img of images) {
    const dest = path.join(outDir, img.label + '.png');
    console.log('Downloading:', img.label);
    await downloadImage(img.url, dest);
    console.log('OCR:', img.label);
    const text = await ocrImage(dest);
    console.log('Result:', text.trim());
    console.log('---');
  }
  console.log('Done!');
})();
