/* ===== ExamPractice - 期末刷题助手 =====
 * 支持：单选题(single)、判断题(judge)、填空题(fill)
 * 进度保存 + 错题追踪 + 答题记录回溯
 */
const STATE={questions:[],currentList:[],currentIndex:0,mode:'sequential',stats:{total:0,done:0,correct:0}};
let selectedLetter=null;
const PROGRESS_KEY='exampractice_progress';
const WRONG_KEY='exampractice_wrong';
const $=s=>document.querySelector(s);

// 答题历史：按 currentList 索引记录 {selected, userAnswer, isCorrect, skipped}
let answerHistory=[];

// ========== 错题管理 (id -> 错误次数) ==========
function getWrongMap(){try{return JSON.parse(localStorage.getItem(WRONG_KEY))||{}}catch{return{}}}
function saveWrongMap(m){localStorage.setItem(WRONG_KEY,JSON.stringify(m))}
function addWrong(id){const m=getWrongMap();m[id]=(m[id]||0)+1;saveWrongMap(m)}
function reduceWrong(id){const m=getWrongMap();if(m[id]){m[id]--;if(m[id]<=0)delete m[id];saveWrongMap(m)}}
function clearWrongs(){localStorage.removeItem(WRONG_KEY)}
function getWrongCount(){const m=getWrongMap();return Object.keys(m).length}

// ========== 统计重算 ==========
function recalcStats(){
  let done=0,correct=0;
  answerHistory.forEach(h=>{if(h){done++;if(h.isCorrect)correct++}});
  STATE.stats={total:STATE.currentList.length,done,correct};
}

// ========== 进度保存/恢复 ==========
function saveProgress(){
  const p={
    mode:STATE.mode,index:STATE.currentIndex,
    done:STATE.stats.done,correct:STATE.stats.correct,
    total:STATE.currentList.length,
    listIds:STATE.currentList.map(q=>q.id),
    history:answerHistory
  };
  localStorage.setItem(PROGRESS_KEY,JSON.stringify(p));
}
function loadProgress(){try{return JSON.parse(localStorage.getItem(PROGRESS_KEY))}catch{return null}}
function clearProgress(){localStorage.removeItem(PROGRESS_KEY)}
function hasSavedProgress(){const p=loadProgress();return p&&p.done>0&&p.done<p.total}

function restoreProgress(p){
  STATE.mode=p.mode||'sequential';
  const idMap={};STATE.questions.forEach(q=>idMap[q.id]=q);
  STATE.currentList=p.listIds.map(id=>idMap[id]).filter(Boolean);
  STATE.currentIndex=p.index||0;
  STATE.stats={total:STATE.currentList.length,done:p.done||0,correct:p.correct||0};
  answerHistory=p.history||[];
  document.querySelectorAll('.mode-btn[data-mode]').forEach(b=>b.classList.remove('active'));
  const ab=document.querySelector('[data-mode="'+STATE.mode+'"]');
  if(ab)ab.classList.add('active');
}

// ========== 题库加载 ==========
function loadQuestions(){
  if(window.__QUESTIONS__&&window.__QUESTIONS__.length>0){
    STATE.questions=window.__QUESTIONS__;
    STATE.questions.forEach(q=>{if(q.type==='single')q.answer=q.answer.replace(/[^A-Za-z]/g,'').toUpperCase();q.answer=q.answer.trim()});
    return;
  }
  fetch('questions.json').then(r=>r.json()).then(data=>{
    STATE.questions=data;
    STATE.questions.forEach(q=>{if(q.type==='single')q.answer=q.answer.replace(/[^A-Za-z]/g,'').toUpperCase();q.answer=q.answer.trim()});
    buildQuestionList();renderQuestion();
  }).catch(()=>{$('#questionText').textContent='❌ 加载题库失败。';});
}

// ========== 列表构建 ==========
function buildQuestionList(){
  if(STATE.mode==='random'){const arr=[...STATE.questions];for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}STATE.currentList=arr}
  else if(STATE.mode==='wrong'){
    const wm=getWrongMap();const wids=Object.keys(wm).map(Number);
    STATE.currentList=STATE.questions.filter(q=>wids.includes(q.id)).sort((a,b)=>(wm[b.id]||0)-(wm[a.id]||0));
  }
  else{STATE.currentList=[...STATE.questions]}
  STATE.currentIndex=0;STATE.stats={total:STATE.currentList.length,done:0,correct:0};
  answerHistory=new Array(STATE.currentList.length).fill(null);
}

// ========== 类型标签 ==========
function typeLabel(t){if(t==='single')return'单选题';if(t==='judge')return'判断题';if(t==='fill')return'填空题';return'题目';}
function wrongLevel(count){if(count>=3)return{label:'🔴 高频错题',cls:'level-high'};if(count>=2)return{label:'🟡 易错题',cls:'level-mid'};return{label:'🟢 新错题',cls:'level-low'};}

function isAnswered(){return answerHistory[STATE.currentIndex]!==null}

// ========== 渲染 ==========
function renderQuestion(){
  $('#finishPanel').style.display='none';$('#questionCard').style.display='';$('#cardFooter').style.display='none';$('#optionsList').innerHTML='';
  if(STATE.currentList.length===0){
    $('#questionText').textContent=STATE.mode==='wrong'?'🎉 没有错题记录！继续加油！':'📭 题库为空';
    $('#questionNumber').textContent='第 0 题';$('#questionType').textContent='空';
    $('#btnPrev').disabled=$('#btnNext').disabled=$('#btnSubmit').disabled=true;return;
  }
  if(STATE.stats.done>=STATE.currentList.length){showFinish();return}
  const q=STATE.currentList[STATE.currentIndex];
  const hist=answerHistory[STATE.currentIndex];

  $('#questionText').textContent=q.question;
  let numberHTML='第 '+(STATE.stats.done+1)+' 题';
  if(STATE.mode==='wrong'){const wm=getWrongMap();const cnt=wm[q.id]||0;const lv=wrongLevel(cnt);numberHTML+=' <span class="wrong-badge '+lv.cls+'">'+lv.label+'（错'+cnt+'次）</span>';}
  $('#questionNumber').innerHTML=numberHTML;
  $('#questionType').textContent=typeLabel(q.type);

  // 渲染选项
  if(q.type==='judge'){
    ['✅ 正确','❌ 错误'].forEach((label,idx)=>{
      const btn=document.createElement('button');btn.className='option-btn judge-btn';
      btn.textContent=label;btn.dataset.letter=idx===0?'√':'×';
      btn.addEventListener('click',()=>selectOption(btn));$('#optionsList').appendChild(btn);
    });
  }else if(q.type==='fill'){
    const val=hist?hist.userAnswer:'';
    $('#optionsList').innerHTML='<div class="fill-input-wrapper"><input type="text" class="fill-input" id="fillInput" placeholder="请输入答案（多个空用，分隔）" value="'+escapeHtml(val)+'" autocomplete="off"></div>';
  }else{
    q.options.forEach((opt,idx)=>{
      const btn=document.createElement('button');btn.className='option-btn';btn.textContent=opt;
      btn.dataset.letter=String.fromCharCode(65+idx);
      btn.addEventListener('click',()=>selectOption(btn));$('#optionsList').appendChild(btn);
    });
  }

  // 恢复已答题状态
  if(hist){
    selectedLetter=hist.selected||null;
    if(q.type!=='fill'){
      // 高亮选中项
      document.querySelectorAll('.option-btn').forEach(b=>{
        if(b.dataset.letter===q.answer)b.classList.add('correct');
        if(b.dataset.letter===selectedLetter&&!hist.isCorrect)b.classList.add('wrong');
        b.classList.add('disabled');
      });
    }else{
      $('#fillInput').disabled=true;
      $('#fillInput').classList.add(hist.isCorrect?'input-correct':'input-wrong');
    }
    // 显示结果
    $('#resultArea').textContent=hist.isCorrect?'✅ 回答正确！':(hist.skipped?'⏭ 已加入错题库':'❌ 回答错误！正确答案：'+q.answer);
    $('#resultArea').className='result-area '+(hist.isCorrect?'correct-result':'wrong-result');
    $('#analysisArea').innerHTML='<span class="analysis-label">💡 解析：</span>'+(q.analysis||'暂无解析');
    $('#cardFooter').style.display='';
    $('#btnSubmit').disabled=true;$('#btnSubmit').textContent=hist.skipped?'已跳过':'已提交';
    $('#btnNext').disabled=(STATE.stats.done>=STATE.currentList.length);
    $('#btnPrev').disabled=(STATE.stats.done===0);
  }else{
    selectedLetter=null;
    $('#btnSubmit').disabled=false;$('#btnSubmit').textContent='✍️ 提交答案';
    $('#btnNext').disabled=true;
    $('#btnPrev').disabled=(STATE.currentIndex===0);
  }
  updateStats();
}

function selectOption(btn){if(isAnswered())return;document.querySelectorAll('.option-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');selectedLetter=btn.dataset.letter;}

// ========== 提交答案 ==========
function submitAnswer(){
  if(isAnswered())return;
  const q=STATE.currentList[STATE.currentIndex];let userAnswer,isCorrect;
  if(q.type==='fill'){
    const input=$('#fillInput');if(!input)return;userAnswer=input.value.trim();
    if(!userAnswer){alert('请输入答案！');return}
    isCorrect=(userAnswer===q.answer);
    if(!isCorrect){const nu=userAnswer.replace(/，/g,',').replace(/\s+/g,'');const na=q.answer.replace(/，/g,',').replace(/\s+/g,'');isCorrect=(nu===na)}
  }else{
    if(!selectedLetter){alert(q.type==='judge'?'请选择正确或错误！':'请先选择一个选项！');return}
    userAnswer=selectedLetter;isCorrect=(selectedLetter===q.answer);
  }

  // 记录答题历史
  answerHistory[STATE.currentIndex]={selected:selectedLetter,userAnswer,isCorrect,skipped:false};
  STATE.stats.done++;
  if(isCorrect){STATE.stats.correct++;reduceWrong(q.id)}
  else{addWrong(q.id)}

  // 高亮
  if(q.type==='fill'){$('#fillInput').disabled=true;$('#fillInput').classList.add(isCorrect?'input-correct':'input-wrong')}
  else{document.querySelectorAll('.option-btn').forEach(b=>{b.classList.add('disabled');if(b.dataset.letter===q.answer)b.classList.add('correct');if(b.dataset.letter===selectedLetter&&!isCorrect)b.classList.add('wrong')})}
  $('#resultArea').textContent=isCorrect?'✅ 回答正确！':'❌ 回答错误！正确答案：'+q.answer;
  $('#resultArea').className='result-area '+(isCorrect?'correct-result':'wrong-result');
  $('#analysisArea').innerHTML='<span class="analysis-label">💡 解析：</span>'+(q.analysis||'暂无解析');
  $('#cardFooter').style.display='';$('#btnSubmit').disabled=true;$('#btnSubmit').textContent='已提交';
  $('#btnNext').disabled=(STATE.stats.done>=STATE.currentList.length);
  $('#btnPrev').disabled=false;
  updateStats();updateWrongCount();
  saveProgress();
}

// ========== 导航 ==========
function nextQuestion(){
  if(STATE.stats.done>=STATE.currentList.length){showFinish();return}
  STATE.currentIndex++;renderQuestion();
}
function prevQuestion(){
  if(STATE.currentIndex<=0)return;
  STATE.currentIndex--;renderQuestion();
}
function showFinish(){
  $('#questionCard').style.display='none';$('#finishPanel').style.display='';
  $('#finishTotal').textContent=STATE.stats.total;$('#finishCorrect').textContent=STATE.stats.correct;
  const acc=STATE.stats.total>0?Math.round((STATE.stats.correct/STATE.stats.total)*100):0;
  $('#finishAccuracy').textContent=acc+'%';
  $('#btnPrev').disabled=$('#btnNext').disabled=$('#btnSubmit').disabled=true;
  clearProgress();
}

function updateStats(){$('#progress').textContent=STATE.stats.done+' / '+STATE.stats.total;const acc=STATE.stats.done>0?Math.round((STATE.stats.correct/STATE.stats.done)*100):0;$('#accuracy').textContent=acc+'%'}
function updateWrongCount(){$('#wrongCount').textContent=getWrongCount()}

// ========== 模式切换 ==========
function switchMode(mode){
  STATE.mode=mode;
  document.querySelectorAll('.mode-btn[data-mode]').forEach(b=>b.classList.remove('active'));
  const ab=document.querySelector('[data-mode="'+mode+'"]');
  if(ab)ab.classList.add('active');
  buildQuestionList();renderQuestion();updateWrongCount();
}

// ========== 加入错题库 ==========
function skipToWrong(){
  if(isAnswered()){nextQuestion();return}
  const q=STATE.currentList[STATE.currentIndex];
  addWrong(q.id);
  answerHistory[STATE.currentIndex]={selected:null,userAnswer:'(跳过)',isCorrect:false,skipped:true};
  STATE.stats.done++;
  updateWrongCount();
  saveProgress();
  if(STATE.stats.done>=STATE.currentList.length){showFinish();return}
  STATE.currentIndex++;
  renderQuestion();
}

// ========== 题目导航面板 ==========
function toggleNavPanel(){
  const panel=$('#navPanel');
  if(panel.style.display==='none'){
    panel.style.display='';renderNavGrid();
  }else{
    panel.style.display='none';
  }
}
function renderNavGrid(){
  const grid=$('#navGrid');grid.innerHTML='';
  for(let i=0;i<STATE.currentList.length;i++){
    const num=document.createElement('div');num.className='nav-num';num.textContent=i+1;
    if(i===STATE.currentIndex)num.classList.add('current-dot');
    else if(answerHistory[i]){
      if(answerHistory[i].skipped)num.classList.add('skipped-dot');
      else if(answerHistory[i].isCorrect)num.classList.add('correct-dot');
      else num.classList.add('wrong-dot');
    }else{num.classList.add('pending-dot')}
    num.addEventListener('click',()=>jumpToQuestion(i));
    grid.appendChild(num);
  }
}
function jumpToQuestion(idx){
  STATE.currentIndex=idx;$('#navPanel').style.display='none';renderQuestion();
}
$('#navClose').addEventListener('click',()=>{$('#navPanel').style.display='none'});
$('#progressItem').addEventListener('click',toggleNavPanel);

// ========== 事件 ==========
$('#btnSubmit').addEventListener('click',submitAnswer);
$('#btnNext').addEventListener('click',nextQuestion);
$('#btnPrev').addEventListener('click',prevQuestion);
$('#btnSequential').addEventListener('click',()=>switchMode('sequential'));
$('#btnRandom').addEventListener('click',()=>switchMode('random'));
$('#btnWrong').addEventListener('click',()=>switchMode('wrong'));
$('#btnClearWrong').addEventListener('click',()=>{
  const cnt=getWrongCount();
  if(cnt===0){alert('没有错题记录。');return}
  if(confirm('确定要清空全部 '+cnt+' 道错题记录吗？此操作不可恢复。')){
    clearWrongs();updateWrongCount();
    if(STATE.mode==='wrong')switchMode('sequential');
    alert('✅ 错题已清空！');
  }
});
$('#btnSkip').addEventListener('click',()=>{
  if(isAnswered()){nextQuestion();return}
  if(!confirm('确定将这题加入错题库并跳过吗？'))return;
  skipToWrong();
});

// 键盘
document.addEventListener('keydown',(e)=>{
  const q=STATE.currentList[STATE.currentIndex];
  if(e.key==='ArrowRight'){e.preventDefault();if(isAnswered())nextQuestion();else submitAnswer()}
  if(e.key==='ArrowLeft'){e.preventDefault();prevQuestion()}
  if(!isAnswered()){
    if(q&&q.type==='fill')return;
    if(e.key>='1'&&e.key<='2'&&q&&q.type==='judge'){const btns=document.querySelectorAll('.option-btn');if(btns[parseInt(e.key)-1])selectOption(btns[parseInt(e.key)-1])}
    if(e.key>='1'&&e.key<='4'&&q&&q.type==='single'){const btns=document.querySelectorAll('.option-btn');if(btns[parseInt(e.key)-1])selectOption(btns[parseInt(e.key)-1])}
  }
  if(e.key==='Enter'&&!isAnswered()&&q&&q.type==='fill'){submitAnswer()}
  if(e.key==='s'&&!isAnswered()&&!e.ctrlKey&&!e.metaKey){e.preventDefault();skipToWrong()}
});

// HTML 转义
function escapeHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ========== 初始化 ==========
loadQuestions();
if(hasSavedProgress()){
  const p=loadProgress();
  if(confirm('📝 检测到上次未完成的进度（已完成 '+p.done+'/'+p.total+' 题），是否继续？')){
    restoreProgress(p);
  }else{
    clearProgress();
    buildQuestionList();
  }
}else{
  buildQuestionList();
}
renderQuestion();
updateWrongCount();
