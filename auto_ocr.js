/* 自动爬取雨课堂试题 via 百度 OCR
 * 用法: node auto_ocr.js
 * 输出: yuketang_questions.json
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

// 百度 OCR 凭证
const API_KEY = '0OqAh5NNKWotnNsdfY8T5Wu5';
const SECRET_KEY = '7kOlSYYZWebwzeksyPArn44gmMiWmpem';

// 答案（从页面提取）
const ANSWERS = 'A B A A B B A B A A B A B A B A A A B B C B A C A D A C B B B C D A D C B A C C A D B C C ABCD ABDE ABCE CD AB CDE ABCD ABCDE CD ABCE'.split(' ');

// Q1-20: 判断题(2选项), Q21-45: 单选(4选项), Q46-55: 多选(5选项)
const OPT_COUNTS = [...Array(20).fill(2), ...Array(25).fill(4), ...Array(10).fill(5)];

let accessToken = '';

function httpPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch(e) { reject(e) } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getToken() {
  console.log('🔑 获取 Access Token...');
  const data = await httpPost(
    'aip.baidubce.com',
    '/oauth/2.0/token?grant_type=client_credentials&client_id=' + API_KEY + '&client_secret=' + SECRET_KEY,
    ''
  );
  if (data.access_token) {
    accessToken = data.access_token;
    console.log('✅ Token 获取成功\n');
  } else {
    throw new Error('Token获取失败: ' + JSON.stringify(data));
  }
}

function downloadImage(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 100) return Promise.resolve(dest);
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, res => {
      if (res.statusCode !== 200) { req.destroy(); reject('HTTP ' + res.statusCode); return; }
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => { fs.writeFileSync(dest, Buffer.concat(c)); resolve(dest); });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject('timeout'); });
  });
}

async function ocrImage(filepath) {
  const img = fs.readFileSync(filepath).toString('base64');
  const data = await httpPost(
    'aip.baidubce.com',
    '/rest/2.0/ocr/v1/general_basic?access_token=' + accessToken,
    'image=' + encodeURIComponent(img)
  );
  if (data.error_code == 18) {
    // QPS 限制，等待后重试
    await new Promise(r => setTimeout(r, 2000));
    return ocrImage(filepath);
  }
  if (data.error_code) throw new Error(data.error_msg);
  return (data.words_result || []).map(w => w.words);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 拼接题干：OCR 返回多行，合并去空格
function joinStem(words) {
  if (!words || words.length === 0) return '(OCR失败)';
  return words.join('').replace(/\s+/g, '');
}

// 拼接选项文本
function joinOpt(words) {
  if (!words || words.length === 0) return '(OCR失败)';
  return words.join(' ').replace(/\s+/g, ' ').trim();
}

async function processQuestion(qNum) {
  const slideNum = qNum + 1; // slide_3 = Q1
  const nOpts = OPT_COUNTS[qNum - 1];
  const dir = path.join(__dirname, 'ocr_cache', 'Q' + qNum);
  fs.mkdirSync(dir, { recursive: true });

  // 下载题干图片
  const bodyUrl = `https://rain-public-qn.yuketang.cn/public/2035944/slide_${slideNum}_4_20260512091713.png`;
  const bodyFile = path.join(dir, 'body.png');
  let stem = '(下载失败)';
  try {
    await downloadImage(bodyUrl, bodyFile);
    const words = await ocrImage(bodyFile);
    stem = joinStem(words);
  } catch(e) { stem = '(失败:' + e + ')'; }

  // 下载选项图片
  const shapeIds = nOpts === 2 ? [5, 6] : nOpts === 4 ? [5, 6, 7, 8] : [5, 6, 7, 8, 19];
  const labels = 'ABCDE'.split('');
  const options = {};

  for (let i = 0; i < shapeIds.length; i++) {
    const optUrl = `https://rain-public-qn.yuketang.cn/public/2035944/slide_${slideNum}_${shapeIds[i]}_20260512091713.png`;
    const optFile = path.join(dir, 'opt_' + labels[i] + '.png');
    try {
      await downloadImage(optUrl, optFile);
      await sleep(500); // 控制 QPS
      const words = await ocrImage(optFile);
      options[labels[i]] = joinOpt(words);
    } catch(e) {
      options[labels[i]] = '(失败:' + e + ')';
    }
    await sleep(600); // QPS 限制：大约 1 req/s
  }

  const type = nOpts === 2 ? 'judge' : 'single';
  const answer = ANSWERS[qNum - 1];

  // 构建选项数组
  const optArray = [];
  for (const l of labels.slice(0, nOpts)) {
    if (options[l] && options[l] !== '(OCR失败)') {
      optArray.push(l + '. ' + options[l]);
    }
  }

  const q = {
    id: qNum,
    type: type,
    question: stem,
    answer: answer,
    analysis: ''
  };
  if (optArray.length > 0) q.options = optArray;

  return q;
}

async function main() {
  console.log('📷 雨课堂试题自动 OCR\n');
  console.log('共 55 题，预计需要 3-5 分钟...\n');

  await getToken();

  const results = [];
  for (let i = 1; i <= 55; i++) {
    process.stdout.write(`Q${i}...`);
    try {
      const q = await processQuestion(i);
      results.push(q);
      console.log(' ✅ [' + q.answer + '] ' + q.question.substring(0, 40) + '...');
    } catch(e) {
      console.log(' ❌ ' + e.message);
      results.push({ id: i, type: 'single', question: '(OCR失败)', answer: ANSWERS[i-1], options: [] });
    }
  }

  const outPath = path.join(__dirname, 'yuketang_questions.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log('\n✅ 完成！输出: ' + outPath);
  console.log('共 ' + results.length + ' 题');
}

main().catch(e => { console.error(e); process.exit(1); });
