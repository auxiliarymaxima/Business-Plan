
const categories=[
  ['Agriculture & Farming','🌾'],['Food & Catering','🍛'],['Retail & Trading','🛍️'],['Beauty & Wellness','💇🏽‍♀️'],
  ['Construction & Building','🏗️'],['Transportation & Logistics','🚌'],['Tourism & Hospitality','🌴'],
  ['Technology & Digital Services','💻'],['Fisheries & Marine','🎣'],['Manufacturing & Processing','⚙️'],
  ['Professional Services','🧑🏽‍💼'],['Creative & Other Services','🎨']
];

const sectorPresets={
 'Agriculture & Farming':{margin:.31,growth:.055,customers:'households, wholesalers, restaurants, supermarkets and agro-processors'},
 'Food & Catering':{margin:.36,growth:.06,customers:'office workers, families, event organisers and walk-in customers'},
 'Retail & Trading':{margin:.25,growth:.05,customers:'local consumers, small businesses and repeat neighbourhood buyers'},
 'Beauty & Wellness':{margin:.43,growth:.055,customers:'working professionals, students, bridal clients and repeat personal-care customers'},
 'Construction & Building':{margin:.28,growth:.045,customers:'homeowners, contractors, developers and small commercial clients'},
 'Transportation & Logistics':{margin:.27,growth:.05,customers:'commuters, businesses, retailers and delivery customers'},
 'Tourism & Hospitality':{margin:.39,growth:.06,customers:'local travellers, diaspora visitors, regional tourists and corporate groups'},
 'Technology & Digital Services':{margin:.48,growth:.07,customers:'small businesses, professionals, schools and organisations seeking digital services'},
 'Fisheries & Marine':{margin:.30,growth:.045,customers:'households, restaurants, markets and seafood distributors'},
 'Manufacturing & Processing':{margin:.29,growth:.05,customers:'retailers, distributors, institutions and direct consumers'},
 'Professional Services':{margin:.52,growth:.055,customers:'individuals, SMEs, established companies and public-sector clients'},
 'Creative & Other Services':{margin:.45,growth:.06,customers:'consumers, events, brands and organisations seeking custom creative work'}
};

let selectedCategory='Food & Catering';
let currentPlan=null;
let knowledge={version:'fallback',updated:'unknown',chunks:[]};
let modelStatusCache={stage:'unknown',installed:false,percent:0,verified:false};
let pendingAi={};
let modelPoll=null;

const fallbackKnowledge=[
 {id:'planning-basics',title:'Business planning basics',tags:['all','planning'],status:'GUIDANCE',text:'Separate startup costs, equipment, working capital, monthly operating costs and owner drawings. Validate demand with customers before scaling.'},
 {id:'records',title:'Records and cash controls',tags:['all','finance'],status:'GUIDANCE',text:'Keep sales, expenses, receipts, invoices, customer records and business funds separate from personal spending.'},
 {id:'marketing-local',title:'Low-cost local marketing',tags:['all','marketing'],status:'GUIDANCE',text:'Use WhatsApp, Facebook, referrals, repeat-customer follow-up, community visibility and partnerships before committing to large advertising spend.'}
];

function hasAndroid(){return typeof Android!=='undefined'}
function money(n){return 'GYD $'+Math.round(n||0).toLocaleString('en-US')}
function formatBytes(n){
  n=Number(n||0); if(!n)return '0 MB';
  const gb=n/1073741824;if(gb>=1)return gb.toFixed(gb>=10?0:2)+' GB';
  return (n/1048576).toFixed(0)+' MB';
}
function slugScreen(name){return document.getElementById(name+'Screen')}
function go(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const screen=slugScreen(name); if(screen)screen.classList.add('active');
  document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.nav===name));
  if(name==='saved')renderSaved();
  if(name==='settings'){updateSettings();refreshModelStatus();}
  window.scrollTo(0,0);
}
function showCreate(cat){if(cat)selectedCategory=cat;renderChips();refreshCreateAiStatus();go('create')}
function toast(msg){
  const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2400);
  try{Android.toast(msg)}catch(e){}
}
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function safeUrl(s){try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.href:'#'}catch(e){return '#'}}

function renderCategories(){
  document.getElementById('categories').innerHTML=categories.map(([name,emo])=>
    `<button class="category" onclick="showCreate('${name.replaceAll("'","\\'")}')"><span class="emo">${emo}</span><strong>${name}</strong></button>`
  ).join('');
}
function renderChips(){
  document.getElementById('chips').innerHTML=categories.slice(0,8).map(([name,emo])=>
    `<button class="chip ${selectedCategory===name?'active':''}" onclick="selectedCategory='${name.replaceAll("'","\\'")}';renderChips()">${emo} ${name.split(' & ')[0]}</button>`
  ).join('');
}

function extractName(idea){
  const m=idea.match(/(?:called|named)\s+([A-Z][A-Za-z0-9 &'’-]{2,32})/);
  return m?m[1].trim().replace(/[.,]$/,''):'My Guyana Business';
}
function inferCategory(idea){
  const s=idea.toLowerCase();
  const tests=[
    ['Agriculture & Farming',['farm','crop','agri','vegetable','livestock','poultry']],
    ['Food & Catering',['food','cater','restaurant','lunch','bakery','snack','cook']],
    ['Retail & Trading',['retail','shop','store','sell','trading','boutique']],
    ['Beauty & Wellness',['beauty','salon','hair','nail','spa','barber']],
    ['Construction & Building',['construction','building','contractor','masonry','carpentry']],
    ['Transportation & Logistics',['transport','taxi','bus','delivery','logistics','courier']],
    ['Tourism & Hospitality',['tour','hotel','guest','travel','resort','rental']],
    ['Technology & Digital Services',['tech','software','website','computer','digital','it service','app']],
    ['Fisheries & Marine',['fish','fishing','marine','seafood']],
    ['Manufacturing & Processing',['manufactur','process','factory','production']],
    ['Professional Services',['consult','account','legal','training','professional']],
    ['Creative & Other Services',['design','print','photo','creative','art','event']]
  ];
  for(const [cat,keys] of tests)if(keys.some(k=>s.includes(k)))return cat;
  return selectedCategory;
}

function buildBasePlan(){
  const idea=document.getElementById('idea').value.trim();
  if(idea.length<18){toast('Please describe your business idea first.');return null}
  const cat=inferCategory(idea);selectedCategory=cat;
  const preset=sectorPresets[cat]||sectorPresets['Professional Services'];
  const funding=Math.max(100000,parseInt((document.getElementById('amount').value||'1500000').replace(/\D/g,''))||1500000);
  const name=document.getElementById('businessName').value.trim()||extractName(idea);

  const startup=Math.round(funding*.47),equipment=Math.round(funding*.28),working=Math.round(funding*.25);
  const baseSales=Math.max(220000,Math.round(funding*.29));const months=[];
  for(let i=1;i<=12;i++){
    const season=1+((i===11||i===12)?0.12:0);
    const sales=Math.round(baseSales*Math.pow(1+preset.growth,i-1)*season);
    const profit=Math.round(sales*preset.margin);
    months.push({i,sales,profit});
  }
  const jobs=Math.max(1,Math.min(12,Math.round(funding/650000)));
  return {
    id:Date.now(),name,idea,cat,funding,startup,equipment,working,months,jobs,
    margin:preset.margin,customers:preset.customers,created:new Date().toISOString(),
    aiGenerated:false,aiText:'',aiTps:null,retrieved:[]
  };
}

function tokenize(s){
  return String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(x=>x.length>2);
}
function retrieveKnowledge(plan,limit=8){
  const q=new Set(tokenize(plan.idea+' '+plan.cat+' '+plan.customers));
  const chunks=(knowledge.chunks&&knowledge.chunks.length?knowledge.chunks:fallbackKnowledge);
  return chunks.map(c=>{
    const hay=tokenize((c.title||'')+' '+(c.text||'')+' '+(c.tags||[]).join(' '));
    let score=0;hay.forEach(w=>{if(q.has(w))score+=2});
    if((c.tags||[]).some(t=>String(t).toLowerCase()==='all'))score+=1;
    if((c.tags||[]).some(t=>plan.cat.toLowerCase().includes(String(t).toLowerCase())))score+=5;
    if(c.priority)score+=Number(c.priority);
    return {c,score};
  }).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.c);
}

function buildAiPrompt(plan,chunks){
  const totalSales=plan.months.reduce((a,m)=>a+m.sales,0);
  const totalProfit=plan.months.reduce((a,m)=>a+m.profit,0);
  const knowledgeText=chunks.map((c,i)=>
    `[K${i+1}] ${c.title} | ${c.status||'GUIDANCE'} | reviewed ${c.reviewed||knowledge.updated||'unknown'}\n${c.text}`
  ).join('\n\n');

  return `/no_think
Create a professional Guyana-focused business plan for the following venture.

BUSINESS INPUT
Name: ${plan.name}
Category: ${plan.cat}
Idea: ${plan.idea}
Target customers: ${plan.customers}

DETERMINISTIC PLANNING FIGURES
Funding requested: ${money(plan.funding)}
Setup/startup allocation: ${money(plan.startup)}
Equipment/tools allocation: ${money(plan.equipment)}
Working-capital allocation: ${money(plan.working)}
Illustrative Year-1 sales: ${money(totalSales)}
Illustrative Year-1 operating profit: ${money(totalProfit)}
Planning operating margin: ${Math.round(plan.margin*100)}%
Potential initial jobs: ${plan.jobs}
These are planning estimates calculated by the app, not guarantees.

CURATED LOCAL KNOWLEDGE
${knowledgeText}

RULES
- Treat CONFIRMED facts as dated facts tied to their review date.
- Treat GUIDANCE as general planning guidance.
- If a needed current figure is absent, write VERIFY rather than inventing it.
- Do not invent competitors, supplier prices, rent, interest rates, grants, licences or market statistics.
- Keep the plan practical for a Guyanese SME and suitable for discussion with a lender or investor.
- Do not show hidden reasoning.

OUTPUT THESE HEADINGS IN THIS ORDER:
Executive Summary
Business Description
Market Opportunity
Target Customers
Products and Pricing Strategy
Marketing and Sales Strategy
Operations Plan
Staffing
Guyana Compliance and Registration
Funding Requirement and Use of Funds
Financial Outlook
SWOT Analysis
Risks and Mitigation
Implementation Timeline
Assumptions to Verify
`;
}

function generatePlan(){
  const plan=buildBasePlan();if(!plan)return;
  const chunks=retrieveKnowledge(plan);
  plan.retrieved=chunks.map(c=>({id:c.id,title:c.title,source:c.source||'',url:c.url||'',status:c.status||'GUIDANCE',reviewed:c.reviewed||''}));

  const useAi=localStorage.getItem('gbpb_use_local_ai')!=='0';
  const ready=modelStatusCache.installed||modelStatusCache.stage==='ready';

  if(useAi&&ready&&hasAndroid()&&typeof Android.generateBusinessPlan==='function'){
    const id='plan_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    pendingAi[id]=plan;
    const btn=document.getElementById('generateBtn');btn.disabled=true;btn.textContent='🤖 Qwen is writing your plan…';
    const st=document.getElementById('createAiStatus');st.className='ai-status';st.textContent='Local Qwen is generating on this phone. This can take a little while on first use.';
    try{
      Android.generateBusinessPlan(id,buildAiPrompt(plan,chunks));
    }catch(e){
      finishFallback(plan,'Unable to start local AI: '+e.message);
    }
  }else{
    finishFallback(plan,ready?'Local AI is disabled in Settings.':'Local AI is not installed yet; using the offline template + curated knowledge pack.');
  }
}

function finishFallback(plan,message){
  plan.aiGenerated=false;
  plan.aiText='';
  savePlan(plan);currentPlan=plan;renderPlan(plan);go('plan');
  restoreGenerateButton();toast(message||'Business plan created.');
}
function restoreGenerateButton(){
  const btn=document.getElementById('generateBtn');
  if(btn){btn.disabled=false;btn.textContent='✨ Create My Business Plan'}
  refreshCreateAiStatus();
}

window.onAiResult=function(requestId,text,tps){
  const plan=pendingAi[requestId];delete pendingAi[requestId];if(!plan)return;
  plan.aiGenerated=true;plan.aiText=stripThinking(text);plan.aiTps=parseFloat(tps)||null;
  savePlan(plan);currentPlan=plan;renderPlan(plan);go('plan');restoreGenerateButton();
  toast('Local AI business plan created.');
};
window.onAiError=function(requestId,message){
  const plan=pendingAi[requestId];delete pendingAi[requestId];if(!plan)return;
  finishFallback(plan,'Qwen could not finish; template mode was used. '+message);
};

function stripThinking(text){
  let s=String(text||'');
  s=s.replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
  if(s.startsWith('<think>'))s=s.replace(/^<think>[\s\S]*?(?:<\/think>|$)/i,'').trim();
  return s;
}

function formatAiText(text){
  const lines=stripThinking(text).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  let html='',inList=false;
  const headingNames=['executive summary','business description','market opportunity','target customers','products and pricing strategy','marketing and sales strategy','operations plan','staffing','guyana compliance and registration','funding requirement and use of funds','financial outlook','swot analysis','risks and mitigation','implementation timeline','assumptions to verify'];
  for(const line of lines){
    const clean=line.replace(/^#{1,3}\s*/,'').replace(/^\*\*(.*?)\*\*:?$/,'$1').replace(/:$/,'');
    const isHeading=headingNames.includes(clean.toLowerCase()) || /^#{1,3}\s/.test(line);
    const isBullet=/^[-•*]\s+/.test(line);
    if(isHeading){
      if(inList){html+='</ul>';inList=false}
      html+=`<h3>${esc(clean)}</h3>`;
    }else if(isBullet){
      if(!inList){html+='<ul>';inList=true}
      html+=`<li>${esc(line.replace(/^[-•*]\s+/,''))}</li>`;
    }else{
      if(inList){html+='</ul>';inList=false}
      html+=`<p>${esc(line)}</p>`;
    }
  }
  if(inList)html+='</ul>';
  return html||'<p>No AI narrative was returned.</p>';
}

function renderPlan(p){
  const first=p.months[0],last=p.months[p.months.length-1];
  const yearSales=p.months.reduce((a,m)=>a+m.sales,0);
  const yearProfit=p.months.reduce((a,m)=>a+m.profit,0);
  const aiCard=p.aiGenerated&&p.aiText?`
    <div class="plan-card ai-output">
      <h3 style="margin-top:0">🤖 Local AI Business Plan</h3>
      <p class="tiny">Generated entirely on this device with Qwen3 1.7B${p.aiTps?' • '+p.aiTps.toFixed(1)+' tokens/sec':''}. Curated Guyana facts are dated; estimates still require validation.</p>
      ${formatAiText(p.aiText)}
    </div>`:'';

  const sourceHtml=(p.retrieved||[]).length?`
    <div class="plan-card"><h3>Local Knowledge Used</h3>
      <p>The app retrieved these offline knowledge items for this plan.</p>
      ${(p.retrieved||[]).map(s=>s.url
        ?`<a class="source-chip" href="${esc(safeUrl(s.url))}">${esc(s.title)} • ${esc(s.status)}</a>`
        :`<span class="source-chip">${esc(s.title)} • ${esc(s.status)}</span>`).join('')}
    </div>`:'';

  document.getElementById('planContent').innerHTML=`
   <div class="plan-title"><div class="crumb">← Home &nbsp; • &nbsp; Guyana Business Plan Builder</div><h1>${esc(p.name)}</h1><small>${esc(p.cat)} • Guyana • ${p.aiGenerated?'Local AI':'Offline template'} mode</small></div>
   ${aiCard}
   <div class="plan-card"><h3>Executive Summary</h3><p>${esc(p.name)} is a Guyana-focused ${p.cat.toLowerCase()} venture built around this idea: ${esc(p.idea)} The planning model prioritises a clear customer offer, disciplined startup spending, reliable service and repeat business.</p><div class="metrics"><div class="metric"><span>Estimated startup funding</span><b>${money(p.funding)}</b></div><div class="metric"><span>Illustrative year-1 sales</span><b>${money(yearSales)}</b></div><div class="metric"><span>Illustrative operating profit</span><b>${money(yearProfit)}</b></div><div class="metric"><span>Planning margin</span><b>${Math.round(p.margin*100)}%</b></div></div></div>
   <div class="plan-card"><h3>Business Opportunity</h3><p>The business can compete by combining local knowledge, responsive customer service and a focused offer. Its core target customers are ${esc(p.customers)}. Early validation should come from direct customer conversations, small pilot sales and tracking which products or services generate repeat demand.</p></div>
   <div class="plan-card"><h3>Marketing & Sales Strategy</h3><p>Use Facebook, WhatsApp, Instagram, referrals, community visibility and partnerships to generate leads. Keep pricing simple, publish clear contact information, collect customer reviews and track enquiries, conversion rate and repeat customers every month.</p></div>
   <div class="plan-card"><h3>Operations</h3><p>Start lean: secure required supplies and equipment, document daily tasks, maintain stock and cash records, and schedule purchases around actual demand. Separate business funds from personal spending and retain invoices and receipts.</p></div>
   <div class="plan-card"><h3>Funding Requirement</h3><p>Total illustrative funding requirement: <strong>${money(p.funding)}</strong>.</p>
     ${bar('Startup / setup',p.startup,p.funding)}${bar('Equipment / tools',p.equipment,p.funding)}${bar('Working capital',p.working,p.funding)}
   </div>
   <div class="plan-card"><h3>12-Month Financial Outlook</h3><p>This projection is a planning model, not a guarantee. It assumes gradual customer growth and the planning margin selected for the business type.</p><div class="monthlist">${p.months.map(m=>`<strong>Month ${m.i}</strong> — Sales ${money(m.sales)} • Estimated operating profit ${money(m.profit)}<br>`).join('')}</div><div class="metrics"><div class="metric"><span>Month 1 sales</span><b>${money(first.sales)}</b></div><div class="metric"><span>Month 12 sales</span><b>${money(last.sales)}</b></div></div></div>
   <div class="plan-card"><h3>SWOT Analysis</h3><div class="swot"><div><b>Strengths</b><p>Local focus, direct customer relationships, flexible decisions and lean overhead potential.</p></div><div><b>Weaknesses</b><p>New brand, limited initial capacity and dependence on disciplined cash flow.</p></div><div><b>Opportunities</b><p>Digital marketing, partnerships, underserved niches and repeat-customer growth.</p></div><div><b>Threats</b><p>Price competition, supplier changes, demand swings and unexpected operating costs.</p></div></div></div>
   <div class="plan-card"><h3>Implementation Plan</h3><p><strong>Weeks 1–2:</strong> validate demand, confirm suppliers and finalise pricing. <strong>Weeks 3–4:</strong> acquire essential equipment, set up records and brand assets. <strong>Month 2:</strong> launch a focused sales campaign and measure results. <strong>Months 3–6:</strong> strengthen the best-performing offer and add capacity only when demand supports it.</p></div>
   ${sourceHtml}
   <div class="unlock"><h3>Professional Printable Plan</h3><p>${isUnlocked()?'Unlocked on this device. You can print or save to PDF.':'Unlock the professional printable layout and PDF-ready output.'}</p><button class="pay" onclick="${isUnlocked()?'printPlan()':'openPayment()'}">${isUnlocked()?'🖨 Print / Save PDF':'Unlock PDF • GYD $500'}</button></div>
   <button class="secondary print-hide" onclick="showCreate('${p.cat.replaceAll("'","\\'")}')">Edit / Create Another Plan</button>`;
}
function bar(label,val,total){return `<div class="barrow"><label><span>${label}</span><span>${money(val)}</span></label><div class="bar"><i style="width:${Math.max(6,val/total*100)}%"></i></div></div>`}

function savePlan(plan){
  let arr=JSON.parse(localStorage.getItem('gbpb_plans')||'[]');
  arr=arr.filter(p=>p.id!==plan.id);arr.unshift(plan);
  localStorage.setItem('gbpb_plans',JSON.stringify(arr.slice(0,30)));
}
function renderSaved(){
  const arr=JSON.parse(localStorage.getItem('gbpb_plans')||'[]');const el=document.getElementById('savedList');
  if(!arr.length){el.innerHTML='<div class="saved-empty">📄<h3>No saved plans yet</h3><p>Create your first business plan and it will appear here.</p><button class="primary" onclick="showCreate()">Create a Plan</button></div>';return}
  el.innerHTML=arr.map(p=>`<div class="saved-card"><h3>${esc(p.name)}</h3><small>${esc(p.cat)} • ${new Date(p.created).toLocaleDateString()} • ${p.aiGenerated?'Local AI':'Template'}</small><div class="row"><button class="smallbtn" onclick="openSaved(${p.id})">Open</button><button class="smallbtn" onclick="deleteSaved(${p.id})">Delete</button></div></div>`).join('');
}
function openSaved(id){const arr=JSON.parse(localStorage.getItem('gbpb_plans')||'[]');const p=arr.find(x=>x.id===id);if(p){currentPlan=p;renderPlan(p);go('plan')}}
function deleteSaved(id){let arr=JSON.parse(localStorage.getItem('gbpb_plans')||'[]').filter(x=>x.id!==id);localStorage.setItem('gbpb_plans',JSON.stringify(arr));renderSaved();toast('Plan deleted.')}

function isUnlocked(){return localStorage.getItem('gbpb_unlocked')==='1'}
function openPayment(){document.getElementById('paymentModal').classList.add('show')}
function closePayment(){document.getElementById('paymentModal').classList.remove('show')}
function demoUnlock(){localStorage.setItem('gbpb_unlocked','1');closePayment();updateSettings();if(currentPlan)renderPlan(currentPlan);toast('Professional plan unlocked on this device.')}
function updateSettings(){
  const yes=isUnlocked();
  const a=document.getElementById('unlockStatus'),b=document.getElementById('unlockBadge');
  if(a)a.textContent=yes?'Professional printing is enabled':'Not unlocked';
  if(b)b.textContent=yes?'Unlocked':'Locked';
  const use=document.getElementById('useLocalAi');if(use)use.checked=localStorage.getItem('gbpb_use_local_ai')!=='0';
  const ks=document.getElementById('knowledgeStatus');if(ks)ks.textContent=`${(knowledge.chunks||[]).length} local knowledge items • updated ${knowledge.updated||'unknown'}`;
}
function saveAiPreference(){
  const use=document.getElementById('useLocalAi');
  localStorage.setItem('gbpb_use_local_ai',use&&use.checked?'1':'0');
  refreshCreateAiStatus();
}
function printPlan(){try{Android.printPlan()}catch(e){window.print()}}

function refreshCreateAiStatus(){
  const el=document.getElementById('createAiStatus');if(!el)return;
  const enabled=localStorage.getItem('gbpb_use_local_ai')!=='0';
  if(!enabled){el.className='ai-status warn';el.textContent='Local AI is turned off. The app will use its offline template and Guyana knowledge pack.';return}
  if(modelStatusCache.installed||modelStatusCache.stage==='ready'){
    el.className='ai-status';el.textContent='🤖 Local Qwen ready — this plan can be generated on-device with no AI API charge.';
  }else if(['downloading','pending','paused'].includes(modelStatusCache.stage)){
    el.className='ai-status warn';el.textContent=`Qwen download ${modelStatusCache.percent||0}% complete. Template mode is available while it downloads.`;
  }else{
    el.className='ai-status warn';el.textContent='Qwen is not downloaded yet. You can still create a template plan, or install the local model in Settings.';
  }
}

function parseJsonSafe(s,def={}){try{return JSON.parse(s)}catch(e){return def}}
function refreshModelStatus(showToast=false){
  if(!hasAndroid()||typeof Android.getModelStatus!=='function'){
    modelStatusCache={stage:'browser_preview',installed:false,percent:0,verified:false};
    updateModelUi();if(showToast)toast('Model controls work inside the Android app.');return;
  }
  try{
    modelStatusCache=parseJsonSafe(Android.getModelStatus(),{stage:'unknown',installed:false,percent:0});
  }catch(e){modelStatusCache={stage:'error',installed:false,percent:0,error:e.message}}
  updateModelUi();refreshCreateAiStatus();

  if(['downloading','pending','paused','finishing'].includes(modelStatusCache.stage)){
    if(!modelPoll)modelPoll=setInterval(()=>refreshModelStatus(false),1800);
  }else if(modelPoll){clearInterval(modelPoll);modelPoll=null}
}
function updateModelUi(){
  const badge=document.getElementById('modelBadge'),bar=document.getElementById('modelProgress'),detail=document.getElementById('modelDetail');
  if(!badge||!bar||!detail)return;
  const s=modelStatusCache;bar.style.width=(s.percent||0)+'%';
  const labels={ready:'Ready',downloading:'Downloading',pending:'Pending',paused:'Paused',failed:'Failed',not_downloaded:'Not installed',browser_preview:'Android only',finishing:'Finishing',error:'Error'};
  badge.textContent=labels[s.stage]||'Checking';
  if(s.stage==='ready'){
    detail.textContent=`Ready • ${formatBytes(s.bytes)}${s.verified?' • SHA-256 verified':' • verification recommended'}`;
  }else if(['downloading','pending','paused','finishing'].includes(s.stage)){
    detail.textContent=`${s.percent||0}% • ${formatBytes(s.bytes)}${s.totalBytes>0?' of '+formatBytes(s.totalBytes):''}`;
  }else if(s.stage==='failed'){
    detail.textContent='Download failed. Check storage/network and try again.';
  }else if(s.stage==='browser_preview'){
    detail.textContent='The local model downloader is available in the installed Android APK.';
  }else{
    detail.textContent='Not downloaded. About 1.28 GB free storage is needed, plus working RAM while Qwen runs.';
  }
  const d=document.getElementById('downloadModelBtn');
  if(d)d.textContent=s.stage==='ready'?'AI Installed':'Download AI';
}
function downloadLocalModel(){
  if(!hasAndroid()){toast('Install the Android APK to download the local model.');return}
  try{
    const wifi=document.getElementById('wifiOnly')?.checked!==false;
    const r=parseJsonSafe(Android.startModelDownload(wifi),{ok:false,message:'Unknown error'});
    toast(r.message||'Download request sent.');refreshModelStatus();
  }catch(e){toast('Could not start model download: '+e.message)}
}
function deleteLocalModel(){
  if(!hasAndroid()){toast('Model controls are available in Android.');return}
  if(!confirm('Delete the downloaded Qwen model from this device?'))return;
  try{Android.deleteModel();toast('Local model deleted.');setTimeout(()=>refreshModelStatus(),300)}catch(e){toast('Delete failed: '+e.message)}
}
function verifyLocalModel(){
  if(!hasAndroid()||!modelStatusCache.installed){toast('Download the model first.');return}
  const id='verify_'+Date.now();toast('Verifying the 1.28 GB model…');
  try{Android.verifyModel(id)}catch(e){toast('Verification could not start: '+e.message)}
}
window.onModelVerified=function(requestId,ok,hash){
  if(ok==='true'){toast('Model verified successfully.');modelStatusCache.verified=true}
  else toast('Model verification failed. Delete it and download again.');
  refreshModelStatus();
};
window.onModelVerificationError=function(requestId,message){toast('Verification error: '+message)};

function loadKnowledge(){
  let data=null;
  if(hasAndroid()&&typeof Android.getKnowledgeJson==='function'){
    try{data=parseJsonSafe(Android.getKnowledgeJson(),null)}catch(e){}
  }
  knowledge=data&&Array.isArray(data.chunks)?data:{version:'fallback',updated:'built-in',chunks:fallbackKnowledge};
  updateSettings();
}

const tipData=[
 ['💵','Know your numbers','Separate startup costs, monthly operating costs and working capital. Keep a cash buffer rather than spending the full funding amount immediately.'],
 ['🎯','Define one clear customer','State exactly who is expected to buy, why they need the offer and how you will reach them.'],
 ['📣','Use low-cost channels first','WhatsApp, Facebook, referrals and partnerships can validate demand before heavy advertising.'],
 ['🧾','Keep records from day one','Track every sale and expense. Good records help pricing, cash flow, tax preparation and financing conversations.'],
 ['📦','Buy inventory from demand','Start lean, measure what sells and restock around real demand rather than tying up too much cash.'],
 ['🤝','Build repeat customers','Follow up, ask for feedback and make it easy for satisfied customers to buy again or refer someone else.'],
 ['🤖','Use AI as a drafting tool','Qwen can organise and write the plan locally, but current legal, tax and market facts should still be checked before formal use.']
];
function renderTips(){document.getElementById('tips').innerHTML=tipData.map(([e,h,p])=>`<div class="tip"><b>${e}</b><h3>${h}</h3><p>${p}</p></div>`).join('')}

renderCategories();
renderChips();
renderTips();
loadKnowledge();
updateSettings();
refreshModelStatus();
refreshCreateAiStatus();
