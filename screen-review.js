const screens = [
  ['Onboarding','welcome','Welcome','First-run introduction','onboarding:0'],
  ['Onboarding','name','Your name','Optional profile name','onboarding:1'],
  ['Onboarding','onboard-meds','Add medications','Medication setup step','onboarding:2'],
  ['Onboarding','onboard-symptoms','Choose symptoms','Symptom setup step','onboarding:3'],
  ['Daily use','home','Home','Daily status and quick actions','route:home'],
  ['Daily use','meds','Medications','Today’s scheduled and PRN medications','route:meds'],
  ['Daily use','calendar','Calendar','Selected-day activity and check-ins','calendar'],
  ['Daily use','settings','Settings','Account, tracking, data, and appearance','settings:main'],
  ['Quick logging','add-log','Add a log','Unified quick-log menu','addlog'],
  ['Quick logging','past-dose','Log scheduled medication','Historic or current scheduled dose','historic:scheduled'],
  ['Quick logging','past-prn','Log PRN medication','Historic or current as-needed dose','historic:prn'],
  ['Quick logging','mood-stress','Mood & stress','Timestamped mood and stress reading','quickcheck:new'],
  ['Quick logging','self-care','Self care','Activity, duration, and after ratings','selfcare:new'],
  ['Quick logging','symptom-detail','Symptom entry','Severity, timing, cause, relief, and notes','symptomdetail'],
  ['Daily check-in','checkin-sleep','Sleep','Morning sleep step','checkin:0'],
  ['Daily check-in','checkin-feeling','Mood and feelings','Mood, energy, anxiety, and stress','checkin:1'],
  ['Daily check-in','checkin-body','Body & GI','Body and digestive symptoms','checkin:2'],
  ['Daily check-in','checkin-cognition','Cognition','Memory, word recall, and speech','checkin:3'],
  ['Daily check-in','checkin-food','Food & fuel','Appetite and protein','checkin:4'],
  ['Daily check-in','checkin-meds','Meds & wrap-up','AM/PM dose confirmation and notes','checkin:5'],
  ['Manage tracking','checkin-setup','Check-in setup','Choose and order check-in sections','settings:steps'],
  ['Manage tracking','manage-meds','Manage medications','All medication profiles','settings:meds'],
  ['Manage tracking','add-med','Add medication','New medication profile','mededit:new'],
  ['Manage tracking','edit-med','Edit medication','Existing medication and change history','mededit:existing'],
  ['Manage tracking','manage-symptoms','Manage symptoms','Tracked symptoms by category','settings:symptoms'],
  ['Manage tracking','add-symptom','Add symptom','New custom symptom','symedit:new'],
  ['Manage tracking','edit-symptom','Edit symptom','Category, input, check-in, and quick-log settings','symedit:existing'],
  ['Manage tracking','symptom-library','Symptom library','Browse and add built-in symptoms','sympicker'],
  ['Manage tracking','relief-options','Relief options','Self-care and symptom relief choices','settings:whatHelped'],
  ['Manage tracking','life-factors','Life factors','Triggers and context choices','settings:contexts'],
  ['Manage tracking','appearance','Appearance','Theme, color, and shape controls','settings:theme'],
  ['Insights','insights','Insights hub','Visual categories and analysis tools','insights:hub'],
  ['Insights','insights-sleep','Sleep insights','Sleep trends and patterns','insights:sleep'],
  ['Insights','insights-mood','Mood insights','Mood trends and patterns','insights:mood'],
  ['Insights','insights-digestion','Digestion insights','Digestive symptom trends','insights:symptoms:gi'],
  ['Insights','insights-body','Body insights','Body symptom trends','insights:symptoms:body'],
  ['Insights','insights-cognition','Cognition insights','Cognition trends','insights:symptoms:cognition'],
  ['Insights','insights-prn','PRN medication insights','As-needed medication patterns','insights:prn'],
  ['Insights','insights-changes','Medication changes','Medication change comparisons','insights:side'],
  ['Insights','insights-patterns','Patterns','Generated cross-category patterns','insights:patterns'],
  ['Insights','med-history','Medication history','Medication timeline and notes','insights:medhistory'],
  ['Insights','explore','Explore & compare','Cross-category comparison tools','insights:explore'],
  ['Insights','exports','Export & share','Backup, provider, and AI export choices','insights:exports'],
  ['Insights','build-report','Build a report','Date range and report sections','insights:report'],
  ['Review and edit','edit-symptom-log','Edit symptom record','Full prior symptom details and notes','edit:episode'],
  ['Review and edit','edit-med-log','Edit scheduled dose','Status, date, time, and delete','edit:medlog'],
  ['Review and edit','edit-prn-log','Edit PRN dose','Dose, quantity, reason, and delete','edit:prnlog'],
  ['Review and edit','edit-reading','Edit mood & stress','Prior mood and stress reading','quickcheck:existing'],
  ['Review and edit','edit-self-care','Edit self care','Prior activity and after ratings','selfcare:existing'],
  ['Data and utilities','backup','Full backup','Download and restore app data','export:backup'],
  ['Data and utilities','doctor-export','Doctor summary','Provider export options','export:doctor'],
  ['Data and utilities','ai-export','AI analysis export','Prompt and JSON options','export:ai'],
  ['Data and utilities','time-picker','Time picker','Hour, 30-minute, and AM/PM wheels','picker:time'],
  ['Data and utilities','date-picker','Date picker','Past-date calendar picker','picker:date'],
  ['Data and utilities','clear-data','Clear data confirmation','Destructive-action confirmation','clear'],
];

const $ = (id) => document.getElementById(id);
const frame = $('appFrame');
const capture = $('capture');
const loading = $('loading');
const storageKey = 'hcc-screen-review-feedback-v1';
const state = { index: 0, armed: false, selected: null, notes: loadNotes(), appReady: false };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadNotes(){ try{return JSON.parse(localStorage.getItem(storageKey)||'[]')}catch{return []} }
function saveNotes(){ localStorage.setItem(storageKey,JSON.stringify(state.notes)); renderNotes(); renderPins(); }
function screen(){ return screens[state.index]; }
function getApp(){ return frame.contentWindow && frame.contentWindow.__hccApp; }

function resetApp(app){
  app.setState({loading:false,route:'home',ob:null,ci:null,draft:null,logDate:null,setSub:null,insView:'hub',insCat:null,insMode:'visuals',heroSel:null,quickCheck:null,selfCareEdit:null,episodeEdit:null,medLogEdit:null,prn:null,historicMed:null,medEdit:null,symEdit:null,symPicker:null,exp:null,tp:null,dp:null,repOpen:false,confirmWipe:false,confirmDel:null,justLogged:null});
}

async function applyScreen(){
  const app=getApp(); if(!app||!app.db)return;
  loading.hidden=false; resetApp(app); await delay(40);
  const spec=screen()[4]; const [kind,a,b]=spec.split(':'); const today=app.db.todayISO();
  if(kind==='onboarding') app.setState({ob:{step:Number(a),name:'Alex'},route:'home'});
  if(kind==='route') app.setState({route:a});
  if(kind==='calendar') app.openActivity();
  if(kind==='settings') app.setState({route:'settings',setSub:a==='main'?null:a});
  if(kind==='addlog') app.openLog(today);
  if(kind==='historic'){
    const med=(app.raw.meds||[]).find((m)=>a==='prn'?m.prn:!m.prn&&!m.weekly);
    app.setState({route:'meds',historicMed:app.historicMedDefaults(med&&med.id,app.isoShift(today,-8))});
  }
  if(kind==='quickcheck'){
    const record=a==='existing'?(app.raw.stress||[])[0]:null;
    app.openQuickCheck(today,record&&record.id)();
  }
  if(kind==='selfcare'){
    if(a==='existing'){
      const record={id:'review-self-care',eventDate:today,time:`${today}T18:30:00`,durationMin:30,reliefIds:['wh-rest'],reliefLabels:['Rest'],afterStress:3,afterMood:8,notes:'Felt calmer afterward.'};
      app.raw.selfCare=[record,...(app.raw.selfCare||[]).filter((x)=>x.id!==record.id)]; app.openSelfCare(record.id,today)();
    }else app.openSelfCare(null,today)();
  }
  if(kind==='symptomdetail'){
    const symptom=(app.raw.symptoms||[]).find((x)=>x.name==='Anxiety')||(app.raw.symptoms||[])[0];
    app.setState({route:'log',logDate:today,draft:{stage:'detail',selected:symptom,cat:symptom&&symptom.category,queue:null,qi:0,staged:{},severity:6,when:'earlier',duration:'30',trigger:[],suspectedMedId:null,confidence:null,whatHelped:[],context:[],notes:'',logTime:'14:30'}});
  }
  if(kind==='checkin'){
    app.openCheckin(today,'morning'); await delay(35); app.setState((st)=>({ci:{...st.ci,stepIndex:Number(a)}}));
  }
  if(kind==='mededit') app.openMedEditor(a==='existing'?(app.raw.meds||[])[0]:null);
  if(kind==='symedit') app.openSymEditor(a==='existing'?(app.raw.symptoms||[])[0]:null);
  if(kind==='sympicker') app.openSymPicker();
  if(kind==='insights') app.setState({route:'insights',insView:a,insCat:b||null,insMode:'visuals',insRange:'30'});
  if(kind==='edit'){
    if(a==='episode'){const r=(app.raw.episodes||[])[0];if(r)app.openEpisodeEditor(r.id)();}
    if(a==='medlog'){const r=(app.raw.medLogs||[]).find((x)=>!x.isPrn);if(r)app.openMedLogEditor(r.id)();}
    if(a==='prnlog'){const r=(app.raw.medLogs||[]).find((x)=>x.isPrn);if(r)app.openMedLogEditor(r.id)();}
  }
  if(kind==='export') app.openExport(a)();
  if(kind==='picker'){
    app.setState({route:'home'}); await delay(20);
    if(a==='time') app.openTimePick('checkinTime',null,'20:30')();
    else app.openDatePick('historicDate',app.isoShift(today,-12))();
  }
  if(kind==='clear') app.setState({route:'settings',confirmWipe:true});
  await delay(140); loading.hidden=true;
}

async function prepare(){
  const started=Date.now();
  while(Date.now()-started<15000){
    const app=getApp();
    if(app&&app.db&&!app.state.loading){
      if(!(app.raw.meds||[]).length){ await app.seed.loadSampleData(); await app.refresh(); await delay(180); }
      state.appReady=true; await applyScreen(); return;
    }
    await delay(80);
  }
  loading.innerHTML='<div>Review preview could not load.<br>Refresh this page to try again.</div>';
}

function renderNavigation(){
  const list=$('screenList'); let group='';
  list.innerHTML=screens.map((s,i)=>{let heading='';if(s[0]!==group){group=s[0];heading=`<div class="group-title">${escapeHtml(group)}</div>`}return `${heading}<button class="screen-link ${i===state.index?'active':''}" data-index="${i}"><span class="screen-num">${i+1}</span><span><span class="screen-name">${escapeHtml(s[2])}</span><div class="screen-count">${notesFor(s[1]).length} note${notesFor(s[1]).length===1?'':'s'}</div></span></button>`}).join('');
  list.querySelectorAll('[data-index]').forEach((el)=>el.addEventListener('click',()=>go(Number(el.dataset.index))));
  const s=screen(); $('screenTitle').textContent=s[2]; $('screenMeta').textContent=`${state.index+1} of ${screens.length} · ${s[3]}`; $('progressBar').style.width=`${(state.index+1)/screens.length*100}%`;
  ['prevTop','prevBottom'].forEach((id)=>$(id).disabled=state.index===0); ['nextTop','nextBottom'].forEach((id)=>$(id).disabled=state.index===screens.length-1);
  list.querySelector('.active')?.scrollIntoView({block:'nearest',inline:'nearest'});
}
async function go(index){state.index=Math.max(0,Math.min(screens.length-1,index));location.hash=screen()[1];state.selected=null;renderNavigation();renderEditor();renderNotes();renderPins();if(state.appReady)await applyScreen();}
function notesFor(id=screen()[1]){return state.notes.filter((n)=>n.screenId===id)}

function cssPath(el){
  if(!el||el===frame.contentDocument.body)return'body'; const parts=[];let node=el;
  while(node&&node.nodeType===1&&node!==frame.contentDocument.body&&parts.length<6){let p=node.tagName.toLowerCase();if(node.id){p+='#'+CSS.escape(node.id);parts.unshift(p);break}const parent=node.parentElement;if(parent){const same=[...parent.children].filter((x)=>x.tagName===node.tagName);if(same.length>1)p+=`:nth-of-type(${same.indexOf(node)+1})`}parts.unshift(p);node=parent}
  return parts.join(' > ');
}
function elementLabel(el){return(el.getAttribute('aria-label')||el.innerText||el.textContent||el.getAttribute('placeholder')||el.tagName).replace(/\s+/g,' ').trim().slice(0,100)}
function selectAt(event){
  const rect=capture.getBoundingClientRect();const x=event.clientX-rect.left,y=event.clientY-rect.top;const doc=frame.contentDocument;const el=doc.elementFromPoint(x,y);if(!el)return;
  const r=el.getBoundingClientRect();state.selected={screenId:screen()[1],screenNumber:state.index+1,screenTitle:screen()[2],x:Math.round(x),y:Math.round(y),selector:cssPath(el),label:elementLabel(el),rect:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}};renderEditor();renderPins();$('note').focus();
}
function renderEditor(){
  $('editor').hidden=!state.selected;$('emptyTarget').hidden=!!state.selected;if(!state.selected)return;
  $('target').innerHTML=`<strong>${escapeHtml(state.selected.label)}</strong>${escapeHtml(state.selected.screenTitle)} · ${escapeHtml(state.selected.selector)}`;$('note').value='';$('type').value='bug';$('priority').value='medium';
}
function addNote(){
  if(!state.selected||!$('note').value.trim())return setStatus('Describe the requested change first.');
  state.notes.push({...state.selected,id:`feedback-${Date.now()}`,type:$('type').value,priority:$('priority').value,note:$('note').value.trim(),createdAt:new Date().toISOString()});state.selected=null;saveNotes();renderEditor();renderNavigation();setStatus('Feedback pin saved.');
}
function renderNotes(){
  const notes=notesFor();$('noteCount').textContent=String(state.notes.length);$('noteList').innerHTML=notes.length?notes.map((n)=>`<article class="note"><div class="note-top"><span class="note-n">${state.notes.indexOf(n)+1}</span><span class="note-label">${escapeHtml(n.label)}</span></div><div class="note-text">${escapeHtml(n.note)}</div><button data-remove="${n.id}">Remove</button></article>`).join(''):'<div class="empty">No feedback saved for this screen.</div>';
  $('noteList').querySelectorAll('[data-remove]').forEach((b)=>b.addEventListener('click',()=>{state.notes=state.notes.filter((n)=>n.id!==b.dataset.remove);saveNotes();renderNavigation()}));
}
function renderPins(){
  capture.querySelectorAll('.pin,.target-ring').forEach((x)=>x.remove());notesFor().forEach((n)=>{const pin=document.createElement('div');pin.className='pin';pin.textContent=String(state.notes.indexOf(n)+1);pin.style.left=`${n.x}px`;pin.style.top=`${n.y}px`;capture.appendChild(pin)});
  if(state.selected){const n=state.selected;const ring=document.createElement('div');ring.className='target-ring';ring.style.left=`${n.rect.x}px`;ring.style.top=`${n.rect.y}px`;ring.style.width=`${n.rect.width}px`;ring.style.height=`${n.rect.height}px`;capture.appendChild(ring)}
}
function setArmed(armed){state.armed=armed;capture.classList.toggle('armed',armed);['annotateMode','stageAnnotate'].forEach((id)=>$(id).classList.toggle('active',armed));['browseMode','stageBrowse'].forEach((id)=>$(id).classList.toggle('active',!armed))}
function exportPayload(){return{format:'health-tracker-screen-review.v1',createdAt:new Date().toISOString(),screenCount:screens.length,reviewedScreenCount:new Set(state.notes.map((n)=>n.screenId)).size,notes:state.notes}}
function markdown(){return state.notes.map((n,i)=>`## ${i+1}. ${n.screenTitle}: ${n.label}\n- Screen: ${n.screenNumber} of ${screens.length} (${n.screenId})\n- Type: ${n.type}\n- Priority: ${n.priority}\n- Element: \`${n.selector}\`\n- Position: ${n.x}, ${n.y}\n\n${n.note}`).join('\n\n')}
async function copyReview(){const text=`Please apply these Health Tracker screen-review fixes. Preserve existing user data and verify each affected screen.\n\n${markdown()}\n\nRaw review JSON:\n${JSON.stringify(exportPayload(),null,2)}`;try{await navigator.clipboard.writeText(text);setStatus('Copied. Paste it into this Codex task.')}catch{download('health-tracker-review.json',JSON.stringify(exportPayload(),null,2));setStatus('Copy was blocked, so the review file was downloaded.')}}
function download(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function submit(){if(!state.notes.length)return setStatus('Save at least one feedback pin first.');const url=new URL('https://github.com/dreamxlogic/Health-Tracker/issues/new');url.searchParams.set('title',`Screen review feedback · ${new Date().toISOString().slice(0,10)}`);url.searchParams.set('body',`Feedback submitted from the ${screens.length}-screen Health Tracker review.\n\n${markdown()}`.slice(0,7500));const opened=window.open(url.toString(),'_blank','noopener,noreferrer');if(!opened)copyReview();else setStatus('GitHub issue draft opened. Review and submit it.');}
function setStatus(text){$('status').textContent=text;clearTimeout(setStatus.timer);setStatus.timer=setTimeout(()=>$('status').textContent='',4000)}
function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

frame.addEventListener('load',prepare);
$('prevTop').onclick=$('prevBottom').onclick=()=>go(state.index-1);$('nextTop').onclick=$('nextBottom').onclick=()=>go(state.index+1);
['browseMode','stageBrowse'].forEach((id)=>$(id).onclick=()=>setArmed(false));['annotateMode','stageAnnotate'].forEach((id)=>$(id).onclick=()=>setArmed(true));capture.addEventListener('click',selectAt);$('saveNote').onclick=addNote;$('copyReview').onclick=copyReview;$('downloadReview').onclick=()=>{download('health-tracker-screen-review.json',JSON.stringify(exportPayload(),null,2));setStatus('Review file downloaded.')};$('submitReview').onclick=submit;
const requested=location.hash.slice(1);const requestedIndex=screens.findIndex((s)=>s[1]===requested);if(requestedIndex>=0)state.index=requestedIndex;renderNavigation();renderEditor();renderNotes();setArmed(false);
