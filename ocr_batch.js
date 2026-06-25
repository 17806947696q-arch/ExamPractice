const Tesseract = require('tesseract.js');
const https = require('https');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'ocr_output');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

// Answers extracted from quiz_info page
const answers = [
  'A','B','A','A','B','B','A','B','A','A',  // Q1-10 (1分)
  'B','A','B','A','B','A','A','A','B','B',  // Q11-20 (1分)
  'C','B','A','C','A','D','A','C','B','B',  // Q21-30 (2分)
  'B','C','D','A','D','C','B','A','C','C',  // Q31-40 (2分)
  'A','D','B','C','C','ABCD','ABDE','ABCE','CD','AB',  // Q41-50 (2分/3分)
  'CDE','ABCD','ABCDE','CD','ABCE'  // Q51-55 (3分)
];

// Image URLs grouped by question (from quizData structure)
// Slide 0=title, slides 1-55=questions
// Each question slide has shapes: 4=question body, 5=optA, 6=optB, [7=optC, 8=optD, ...]
const questionImages = [];

for (let q = 1; q <= 55; q++) {
  const slideNum = q + 1;
  const opts = q <= 20 ? 2 : (q <= 45 ? 4 : 5);
  const images = [
    { id: 4, label: 'q' },
    { id: 5, label: 'A' },
    { id: 6, label: 'B' },
  ];
  if (opts >= 4) {
    images.push({ id: 7, label: 'C' });
    images.push({ id: 8, label: 'D' });
  }
  if (opts >= 5) {
    images.push({ id: 19, label: 'E' });
  }
  questionImages.push({ qNum: q, slide: slideNum, images, answer: answers[q-1], opts });
}

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
  const { data } = await Tesseract.recognize(filepath, 'chi_sim');
  return data.text.replace(/\s+/g, ' ').trim();
}

(async () => {
  const results = [];

  for (const q of questionImages) {
    const qDir = path.join(outDir, `Q${q.qNum}`);
    if (!fs.existsSync(qDir)) fs.mkdirSync(qDir);

    const texts = {};
    for (const img of q.images) {
      const filename = `slide${q.slide}_${img.id}.png`;
      const dest = path.join(qDir, filename);
      const url = `https://rain-public-qn.yuketang.cn/public/2035944/slide_${q.slide}_${img.id}_20260512091713.png`;

      if (!fs.existsSync(dest)) {
        try {
          await downloadImage(url, dest);
        } catch(e) {
          texts[img.label] = '(download failed)';
          continue;
        }
      }
      process.stdout.write(`OCR Q${q.qNum}-${img.label}...`);
      try {
        texts[img.label] = await ocrImage(dest);
        console.log(' OK');
      } catch(e) {
        texts[img.label] = '(ocr failed)';
        console.log(' FAIL');
      }
    }

    results.push({
      num: q.qNum,
      question: texts['q'] || '',
      options: {
        A: texts['A'] || '',
        B: texts['B'] || '',
        C: texts['C'] || '',
        D: texts['D'] || '',
        E: texts['E'] || '',
      },
      answer: q.answer,
      optsCount: q.opts
    });
  }

  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2), 'utf-8');
  console.log('\n=== Done! ===');
  console.log('Total questions:', results.length);
  console.log('Results saved to:', path.join(outDir, 'results.json'));
})();
