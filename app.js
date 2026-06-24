/* ===== ExamPractice - 期末刷题助手 =====
 * 支持：单选题(single)、判断题(judge)、填空题(fill)
 * 数据：window.__QUESTIONS__ 或 questions.json
 * 错题：localStorage
 */
const STATE={questions:[],currentList:[],currentIndex:0,mode:'sequential',answered:false,stats:{total:0,done:0,correct:0}};
let selectedLetter=null;
const WRONG_KEY='exampractice_wrong_ids';
const $=s=>document.querySelector(s);

function getWrongIds(){try{return JSON.parse(localStorage.getItem(WRONG_KEY))||[]}catch{return[]}}
function saveWrongId(id){const ids=getWrongIds();if(!ids.includes(id)){ids.push(id);localStorage.setItem(WRONG_KEY,JSON.stringify(ids))}}
function clearWrongIds(){localStorage.removeItem(WRONG_KEY)}
function removeWrongId(id){const ids=getWrongIds().filter(i=>i!==id);localStorage.setItem(WRONG_KEY,JSON.stringify(ids))}

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

function buildQuestionList(){
  if(STATE.mode==='random'){const arr=[...STATE.questions];for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}STATE.currentList=arr}
  else if(STATE.mode==='wrong'){const ids=getWrongIds();STATE.currentList=STATE.questions.filter(q=>ids.includes(q.id))}
  else{STATE.currentList=[...STATE.questions]}
  STATE.currentIndex=0;STATE.stats={total:STATE.currentList.length,done:0,correct:0};STATE.answered=false;
}

function typeLabel(t){if(t==='single')return'单选题';if(t==='judge')return'判断题';if(t==='fill')return'填空题';return'题目';}

function renderQuestion(){
  $('#finishPanel').style.display='none';$('#questionCard').style.display='';$('#cardFooter').style.display='none';$('#optionsList').innerHTML='';
  if(STATE.currentList.length===0){$('#questionText').textContent=STATE.mode==='wrong'?'🎉 没有错题记录！':'📭 题库为空';$('#btnPrev').disabled=$('#btnNext').disabled=$('#btnSubmit').disabled=true;return}
  if(STATE.stats.done>=STATE.currentList.length){showFinish();return}
  const q=STATE.currentList[STATE.currentIndex];
  $('#questionText').textContent=q.question;
  $('#questionNumber').textContent='第 '+(STATE.stats.done+1)+' 题';
  $('#questionType').textContent=typeLabel(q.type);

  if(q.type==='judge'){
    ['✅ 正确','❌ 错误'].forEach((label,idx)=>{
      const btn=document.createElement('button');btn.className='option-btn judge-btn';
      btn.textContent=label;btn.dataset.letter=idx===0?'√':'×';
      btn.addEventListener('click',()=>selectOption(btn));$('#optionsList').appendChild(btn);
    });
  }else if(q.type==='fill'){
    $('#optionsList').innerHTML='<div class="fill-input-wrapper"><input type="text" class="fill-input" id="fillInput" placeholder="请输入答案（多个空用，分隔）" autocomplete="off"></div>';
  }else{
    q.options.forEach((opt,idx)=>{
      const btn=document.createElement('button');btn.className='option-btn';btn.textContent=opt;
      btn.dataset.letter=String.fromCharCode(65+idx);
      btn.addEventListener('click',()=>selectOption(btn));$('#optionsList').appendChild(btn);
    });
  }
  STATE.answered=false;selectedLetter=null;
  $('#btnSubmit').disabled=false;$('#btnSubmit').textContent='✍️ 提交答案';
  $('#btnPrev').disabled=(STATE.stats.done===0);$('#btnNext').disabled=true;
  updateStats();
}

function selectOption(btn){if(STATE.answered)return;document.querySelectorAll('.option-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');selectedLetter=btn.dataset.letter;}

function submitAnswer(){
  if(STATE.answered)return;
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
  STATE.answered=true;STATE.stats.done++;
  if(isCorrect){STATE.stats.correct++;removeWrongId(q.id)}else{saveWrongId(q.id)}
  if(q.type==='fill'){$('#fillInput').disabled=true;$('#fillInput').classList.add(isCorrect?'input-correct':'input-wrong')}
  else{document.querySelectorAll('.option-btn').forEach(b=>{b.classList.add('disabled');if(b.dataset.letter===q.answer)b.classList.add('correct');if(b.dataset.letter===selectedLetter&&!isCorrect)b.classList.add('wrong')})}
  $('#resultArea').textContent=isCorrect?'✅ 回答正确！':'❌ 回答错误！正确答案：'+q.answer;
  $('#resultArea').className='result-area '+(isCorrect?'correct-result':'wrong-result');
  $('#analysisArea').innerHTML='<span class="analysis-label">💡 解析：</span>'+(q.analysis||'暂无解析');
  $('#cardFooter').style.display='';$('#btnSubmit').disabled=true;$('#btnSubmit').textContent='已提交';
  $('#btnNext').disabled=false;$('#btnPrev').disabled=(STATE.stats.done<=1);
  updateStats();updateWrongCount();
}

function nextQuestion(){if(STATE.stats.done>=STATE.currentList.length){showFinish();return}STATE.currentIndex++;renderQuestion()}
function prevQuestion(){if(STATE.stats.done<=1)return;STATE.stats.done--;STATE.currentIndex--;renderQuestion()}
function showFinish(){$('#questionCard').style.display='none';$('#finishPanel').style.display='';$('#finishTotal').textContent=STATE.stats.total;$('#finishCorrect').textContent=STATE.stats.correct;const acc=STATE.stats.total>0?Math.round((STATE.stats.correct/STATE.stats.total)*100):0;$('#finishAccuracy').textContent=acc+'%';$('#btnPrev').disabled=$('#btnNext').disabled=$('#btnSubmit').disabled=true}
function updateStats(){$('#progress').textContent=STATE.stats.done+' / '+STATE.stats.total;const acc=STATE.stats.done>0?Math.round((STATE.stats.correct/STATE.stats.done)*100):0;$('#accuracy').textContent=acc+'%'}
function updateWrongCount(){$('#wrongCount').textContent=getWrongIds().length}

function switchMode(mode){STATE.mode=mode;document.querySelectorAll('.mode-btn[data-mode]').forEach(b=>b.classList.remove('active'));const ab=document.querySelector('[data-mode="'+mode+'"]');if(ab)ab.classList.add('active');buildQuestionList();renderQuestion();updateWrongCount()}

$('#btnSubmit').addEventListener('click',submitAnswer);
$('#btnNext').addEventListener('click',nextQuestion);
$('#btnPrev').addEventListener('click',prevQuestion);
$('#btnSequential').addEventListener('click',()=>switchMode('sequential'));
$('#btnRandom').addEventListener('click',()=>switchMode('random'));
$('#btnWrong').addEventListener('click',()=>switchMode('wrong'));
$('#btnClearWrong').addEventListener('click',()=>{if(confirm('确定要清空全部错题记录吗？')){clearWrongIds();updateWrongCount();if(STATE.mode==='wrong')switchMode('sequential')}});

document.addEventListener('keydown',(e)=>{
  const q=STATE.currentList[STATE.currentIndex];
  if(e.key==='ArrowRight'){e.preventDefault();if(!STATE.answered)submitAnswer();else nextQuestion()}
  if(e.key==='ArrowLeft'){e.preventDefault();prevQuestion()}
  if(!STATE.answered){
    if(q&&q.type==='fill')return;
    if(e.key>='1'&&e.key<='2'&&q&&q.type==='judge'){const btns=document.querySelectorAll('.option-btn');if(btns[parseInt(e.key)-1])selectOption(btns[parseInt(e.key)-1])}
    if(e.key>='1'&&e.key<='4'&&q&&q.type==='single'){const btns=document.querySelectorAll('.option-btn');if(btns[parseInt(e.key)-1])selectOption(btns[parseInt(e.key)-1])}
  }
  if(e.key==='Enter'&&!STATE.answered&&q&&q.type==='fill'){submitAnswer()}
});

loadQuestions();buildQuestionList();renderQuestion();updateWrongCount();
