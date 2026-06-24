// 将 questions.json 转换为 questions_data.js（浏览器可内嵌加载）
// 运行方式：node generate_data.js

const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'questions.json');
const jsPath = path.join(__dirname, 'questions_data.js');

try {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const js = [
    '// 题库数据 - 由 questions.json 自动生成',
    '// 运行 node generate_data.js 重新生成',
    '// 题目数量：' + data.length,
    'window.__QUESTIONS__ = ' + JSON.stringify(data, null, 2) + ';',
    ''
  ].join('\n');
  fs.writeFileSync(jsPath, js, 'utf-8');
  console.log('✅ 已生成 questions_data.js，包含 ' + data.length + ' 道题目');
} catch (e) {
  console.error('❌ 生成失败:', e.message);
  process.exit(1);
}
