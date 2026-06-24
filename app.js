/* ===== ExamPractice - 期末刷题助手 =====
 * 纯前端单页应用，打开 index.html 即可运行
 * 题目数据来自 questions.json
 * 错题记录存储在 localStorage
 */

// ============================================================
// 全局状态
// ============================================================
const STATE = {
  questions: [],       // 全部题目
  currentList: [],     // 当前轮次的题目列表（可能是顺序、随机或错题）
  currentIndex: 0,     // 当前题目在当前列表中的索引
  mode: 'sequential',  // 'sequential' | 'random' | 'wrong'
  answered: false,     // 当前题目是否已提交
  stats: {
    total: 0,          // 本轮总题数
    done: 0,           // 已回答数
    correct: 0,        // 正确数
  },
};

// localStorage key
const WRONG_STORAGE_KEY = 'exampractice_wrong_ids';

// ============================================================
// DOM 引用
// ============================================================
const $ = (sel) => document.querySelector(sel);

const DOM = {
  questionText:   $('#questionText'),
  questionNumber: $('#questionNumber'),
  questionType:   $('#questionType'),
  optionsList:    $('#optionsList'),
  cardFooter:     $('#cardFooter'),
  resultArea:     $('#resultArea'),
  analysisArea:   $('#analysisArea'),
  btnSubmit:      $('#btnSubmit'),
  btnNext:        $('#btnNext'),
  btnPrev:        $('#btnPrev'),
  btnSequential:  $('#btnSequential'),
  btnRandom:      $('#btnRandom'),
  btnWrong:       $('#btnWrong'),
  btnClearWrong:  $('#btnClearWrong'),
  progress:       $('#progress'),
  accuracy:       $('#accuracy'),
  wrongCount:     $('#wrongCount'),
  questionCard:   $('#questionCard'),
  finishPanel:    $('#finishPanel'),
  finishTotal:    $('#finishTotal'),
  finishCorrect:  $('#finishCorrect'),
  finishAccuracy: $('#finishAccuracy'),
};

// ============================================================
// 错题管理
// ============================================================
function getWrongIds() {
  try {
    return JSON.parse(localStorage.getItem(WRONG_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveWrongId(id) {
  const ids = getWrongIds();
  if (!ids.includes(id)) {
    ids.push(id);
    localStorage.setItem(WRONG_STORAGE_KEY, JSON.stringify(ids));
  }
}

function clearWrongIds() {
  localStorage.removeItem(WRONG_STORAGE_KEY);
}

function removeWrongId(id) {
  const ids = getWrongIds().filter(i => i !== id);
  localStorage.setItem(WRONG_STORAGE_KEY, JSON.stringify(ids));
}

// ============================================================
// 题库加载
// ============================================================
async function loadQuestions() {
  // 优先使用内嵌数据（支持 file:// 协议直接打开）
  if (window.__QUESTIONS__ && window.__QUESTIONS__.length > 0) {
    STATE.questions = window.__QUESTIONS__;
    normalizeAnswers();
    return;
  }

  // 备用：通过 HTTP 请求加载（需要本地服务器）
  try {
    const resp = await fetch('questions.json');
    STATE.questions = await resp.json();
    normalizeAnswers();
  } catch (err) {
    DOM.questionText.textContent = '❌ 加载题库失败。请使用本地服务器打开（如 python -m http.server 8080）。';
    console.error('题库加载失败:', err);
  }
}

function normalizeAnswers() {
  STATE.questions.forEach(q => {
    q.answer = q.answer.replace(/[^A-Za-z]/g, '').toUpperCase();
  });
}

// ============================================================
// 题目列表构建
// ============================================================
function buildQuestionList() {
  switch (STATE.mode) {
    case 'random': {
      // Fisher-Yates 洗牌
      const arr = [...STATE.questions];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      STATE.currentList = arr;
      break;
    }
    case 'wrong': {
      const wrongIds = getWrongIds();
      STATE.currentList = STATE.questions.filter(q => wrongIds.includes(q.id));
      break;
    }
    case 'sequential':
    default:
      STATE.currentList = [...STATE.questions];
      break;
  }

  STATE.currentIndex = 0;
  STATE.stats = {
    total: STATE.currentList.length,
    done: 0,
    correct: 0,
  };
  STATE.answered = false;
}

// ============================================================
// 渲染当前题目
// ============================================================
function renderQuestion() {
  // 隐藏完成面板
  DOM.finishPanel.style.display = 'none';
  DOM.questionCard.style.display = '';
  DOM.cardFooter.style.display = 'none';
  DOM.optionsList.innerHTML = '';

  // 无题目处理
  if (STATE.currentList.length === 0) {
    DOM.questionText.textContent = STATE.mode === 'wrong'
      ? '🎉 没有错题记录，太棒了！'
      : '📭 题库为空，请添加题目到 questions.json';
    DOM.questionNumber.textContent = '第 0 题';
    DOM.questionType.textContent = '空题库';
    DOM.btnPrev.disabled = true;
    DOM.btnNext.disabled = true;
    DOM.btnSubmit.disabled = true;
    return;
  }

  // 完成判断
  if (STATE.stats.done >= STATE.currentList.length) {
    showFinish();
    return;
  }

  const q = STATE.currentList[STATE.currentIndex];
  DOM.questionText.textContent = q.question;
  DOM.questionNumber.textContent = `第 ${STATE.stats.done + 1} 题`;
  DOM.questionType.textContent = q.type === 'single' ? '单选题' : '题目';

  // 渲染选项
  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.dataset.letter = String.fromCharCode(65 + idx); // A, B, C, D...
    btn.addEventListener('click', () => selectOption(btn));
    DOM.optionsList.appendChild(btn);
  });

  STATE.answered = false;
  DOM.btnSubmit.disabled = false;
  DOM.btnSubmit.textContent = '✍️ 提交答案';
  DOM.btnPrev.disabled = (STATE.stats.done === 0);
  DOM.btnNext.disabled = true;

  updateStats();
}

// ============================================================
// 选项交互
// ============================================================
let selectedLetter = null;

function selectOption(btn) {
  if (STATE.answered) return; // 已提交后不允许换选项

  // 清除其他选项的选中状态
  document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedLetter = btn.dataset.letter;
}

// ============================================================
// 提交答案
// ============================================================
function submitAnswer() {
  if (STATE.answered) return;
  if (!selectedLetter) {
    alert('请先选择一个选项！');
    return;
  }

  const q = STATE.currentList[STATE.currentIndex];
  const isCorrect = selectedLetter === q.answer;

  STATE.answered = true;
  STATE.stats.done++;

  if (isCorrect) {
    STATE.stats.correct++;
    // 答对了，从错题列表移除
    removeWrongId(q.id);
  } else {
    // 答错了，加入错题
    saveWrongId(q.id);
  }

  // 高亮选项
  document.querySelectorAll('.option-btn').forEach(b => {
    b.classList.add('disabled');
    if (b.dataset.letter === q.answer) {
      b.classList.add('correct');
    }
    if (b.dataset.letter === selectedLetter && !isCorrect) {
      b.classList.add('wrong');
    }
  });

  // 显示结果
  DOM.resultArea.textContent = isCorrect ? '✅ 回答正确！' : `❌ 回答错误！正确答案是：${q.answer}`;
  DOM.resultArea.className = 'result-area ' + (isCorrect ? 'correct-result' : 'wrong-result');

  DOM.analysisArea.innerHTML = `<span class="analysis-label">💡 解析：</span>${q.analysis || '暂无解析'}`;

  DOM.cardFooter.style.display = '';
  DOM.btnSubmit.disabled = true;
  DOM.btnSubmit.textContent = '已提交';
  DOM.btnNext.disabled = false;
  DOM.btnPrev.disabled = (STATE.stats.done <= 1);

  updateStats();
  updateWrongCount();
}

// ============================================================
// 导航
// ============================================================
function nextQuestion() {
  if (STATE.stats.done >= STATE.currentList.length) {
    showFinish();
    return;
  }
  STATE.currentIndex++;
  selectedLetter = null;
  renderQuestion();
}

function prevQuestion() {
  if (STATE.stats.done <= 1) return;
  // 回到上一题：done--后找到上一题的index
  STATE.stats.done--;
  STATE.currentIndex--;
  selectedLetter = null;
  renderQuestion();
}

// ============================================================
// 完成面板
// ============================================================
function showFinish() {
  DOM.questionCard.style.display = 'none';
  DOM.finishPanel.style.display = '';
  DOM.finishTotal.textContent = STATE.stats.total;
  DOM.finishCorrect.textContent = STATE.stats.correct;
  const acc = STATE.stats.total > 0
    ? Math.round((STATE.stats.correct / STATE.stats.total) * 100)
    : 0;
  DOM.finishAccuracy.textContent = acc + '%';

  DOM.btnPrev.disabled = true;
  DOM.btnNext.disabled = true;
  DOM.btnSubmit.disabled = true;
}

// ============================================================
// 统计更新
// ============================================================
function updateStats() {
  DOM.progress.textContent = `${STATE.stats.done} / ${STATE.stats.total}`;
  const acc = STATE.stats.done > 0
    ? Math.round((STATE.stats.correct / STATE.stats.done) * 100)
    : 0;
  DOM.accuracy.textContent = acc + '%';
}

function updateWrongCount() {
  DOM.wrongCount.textContent = getWrongIds().length;
}

// ============================================================
// 模式切换
// ============================================================
function switchMode(mode) {
  STATE.mode = mode;
  selectedLetter = null;

  // 更新按钮状态
  document.querySelectorAll('.mode-btn[data-mode]').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`[data-mode="${mode}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  buildQuestionList();
  renderQuestion();
  updateWrongCount();
}

// ============================================================
// 事件绑定
// ============================================================
DOM.btnSubmit.addEventListener('click', submitAnswer);
DOM.btnNext.addEventListener('click', nextQuestion);
DOM.btnPrev.addEventListener('click', prevQuestion);

DOM.btnSequential.addEventListener('click', () => switchMode('sequential'));
DOM.btnRandom.addEventListener('click', () => switchMode('random'));
DOM.btnWrong.addEventListener('click', () => switchMode('wrong'));

DOM.btnClearWrong.addEventListener('click', () => {
  if (confirm('确定要清空全部错题记录吗？此操作不可恢复。')) {
    clearWrongIds();
    updateWrongCount();
    if (STATE.mode === 'wrong') {
      switchMode('sequential');
    }
    alert('✅ 错题已清空！');
  }
});

// 键盘快捷键
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (!STATE.answered) submitAnswer();
    else nextQuestion();
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prevQuestion();
  }
  // 数字键选选项
  if (!STATE.answered && e.key >= '1' && e.key <= '4') {
    e.preventDefault();
    const btns = document.querySelectorAll('.option-btn');
    const idx = parseInt(e.key) - 1;
    if (btns[idx]) selectOption(btns[idx]);
  }
});

// ============================================================
// 初始化
// ============================================================
async function init() {
  await loadQuestions();
  buildQuestionList();
  renderQuestion();
  updateWrongCount();
}

init();
