
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
let componentStatusCache={wifi:false,coreReady:false,knowledge:{ready:false},simple:{stage:'unknown',percent:0},detailed:{stage:'unknown',percent:0}};
let pendingAi={};
let componentPoll=null;
let componentVerifyInFlight={simple:false,detailed:false};
let generationTimer=null;
let requestedPlanMode='simple';

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
  if(name==='settings'){updateSettings();refreshComponentStatus(false,false);}
  window.scrollTo(0,0);
}
function showCreate(cat){if(cat)selectedCategory=cat;renderChips();refreshCreateComponentStatus();go('create');refreshComponentStatus(false)}
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
Plan depth: ${plan.planMode==='detailed'?'DETAILED — give deeper operational, market and risk analysis':'SIMPLE — keep each section concise and practical'}

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

function selectedMode(){
  const el=document.querySelector('input[name="planMode"]:checked');
  return el?el.value:'simple';
}
function updateModeUi(){
  requestedPlanMode=selectedMode();
  document.querySelectorAll('.mode-card').forEach(x=>x.classList.toggle('selected',x.dataset.mode===requestedPlanMode));
  const note=document.getElementById('modeNote');
  if(!note)return;
  if(requestedPlanMode==='detailed'){
    const ready=componentStatusCache.detailed?.stage==='ready';
    note.textContent=ready?'Detailed planning is ready on this device.':'Detailed planning may require an additional Wi-Fi download the first time you use it.';
  }else note.textContent='Simple planning is the fastest option and is recommended for most first drafts.';
}

function generatePlan(){
  const plan=buildBasePlan();if(!plan)return;
  const mode=selectedMode();plan.planMode=mode;
  const needed=mode==='detailed'?componentStatusCache.detailed:componentStatusCache.simple;
  const ready=needed&&needed.stage==='ready'&&componentStatusCache.knowledge?.ready;

  if(!ready){
    pendingPlanAfterComponents={plan,mode};
    ensureComponentsForMode(mode,true);
    return;
  }
  startPlanGeneration(plan,mode);
}
let pendingPlanAfterComponents=null;

function startPlanGeneration(plan,mode){
  const chunks=retrieveKnowledge(plan,mode==='detailed'?9:5);
  plan.retrieved=chunks.map(c=>({id:c.id,title:c.title,source:c.source||'',url:c.url||'',status:c.status||'GUIDANCE',reviewed:c.reviewed||''}));
  const id='plan_'+Date.now()+'_'+Math.random().toString(36).slice(2);
  pendingAi[id]=plan;
  requestedPlanMode=mode;
  showGenerationProgress(mode);
  setGenerationStage(1,'Preparing your business idea',10);
  setTimeout(()=>setGenerationStage(2,'Reading local planning resources',25),250);
  setTimeout(()=>setGenerationStage(3,'Building the financial framework',40),500);
  setTimeout(()=>setGenerationStage(4,'Starting the planning engine',55),750);
  try{
    Android.generateBusinessPlan(id,buildAiPrompt(plan,chunks),mode);
  }catch(e){
    closeGenerationProgress();
    delete pendingAi[id];
    toast('Could not start the planner: '+e.message);
  }
}

function showGenerationProgress(mode){
  const m=document.getElementById('generationModal');if(!m)return;
  document.getElementById('generationTitle').textContent=mode==='detailed'?'Creating your detailed business plan':'Creating your business plan';
  m.classList.add('show');
  document.querySelectorAll('.gen-step').forEach(x=>x.classList.remove('active','done'));
  setGenerationStage(1,'Preparing your business idea',8);
  let p=55;
  clearInterval(generationTimer);
  generationTimer=setInterval(()=>{
    if(p<92){p+=Math.max(1,Math.round((92-p)/12));updateGenerationBar(p)}
  },1400);
}
function updateGenerationBar(percent){
  const bar=document.getElementById('generationBar'),pct=document.getElementById('generationPercent');
  if(bar)bar.style.width=Math.min(100,percent)+'%';if(pct)pct.textContent=Math.min(100,percent)+'%';
}
function setGenerationStage(n,text,percent){
  const t=document.getElementById('generationStatus');if(t)t.textContent=text;
  document.querySelectorAll('.gen-step').forEach((x,i)=>{x.classList.toggle('done',i<n-1);x.classList.toggle('active',i===n-1)});
  updateGenerationBar(percent);
}
function closeGenerationProgress(){
  clearInterval(generationTimer);generationTimer=null;
  const m=document.getElementById('generationModal');if(m)m.classList.remove('show');
}
window.onAiNativeStage=function(requestId,stage){
  if(stage==='loading')setGenerationStage(4,'Loading planning components',58);
  if(stage==='writing')setGenerationStage(5,'Writing your business plan',68);
  if(stage==='finalizing')setGenerationStage(6,'Finalizing your plan',94);
};

window.onAiResult=function(requestId,text,tps){
  const plan=pendingAi[requestId];delete pendingAi[requestId];if(!plan)return;
  setGenerationStage(6,'Finalizing your plan',100);
  plan.aiGenerated=true;plan.aiText=stripThinking(text);plan.aiTps=parseFloat(tps)||null;
  setTimeout(()=>{
    closeGenerationProgress();savePlan(plan);currentPlan=plan;renderPlan(plan);go('plan');
    toast('Business plan created. Tap the plan text to make your own edits.');
  },450);
};
window.onAiError=function(requestId,message){
  delete pendingAi[requestId];closeGenerationProgress();
  toast('The planner could not finish. Please try again. '+message);
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

function canonicalHeading(line){
  const canonical=['Executive Summary','Business Description','Market Opportunity','Target Customers','Products and Pricing Strategy','Marketing and Sales Strategy','Operations Plan','Staffing','Guyana Compliance and Registration','Funding Requirement and Use of Funds','Financial Outlook','SWOT Analysis','Risks and Mitigation','Implementation Timeline','Assumptions to Verify'];
  const clean=String(line||'').replace(/^#{1,4}\s*/,'').replace(/^\*\*(.*?)\*\*:?$/,'$1').replace(/:$/,'').trim().toLowerCase();
  return canonical.find(x=>x.toLowerCase()===clean)||null;
}
function parsePlanSections(text){
  const sections={};let current=null;
  for(const raw of stripThinking(text).split(/\r?\n/)){
    const line=raw.trim();if(!line)continue;
    const head=canonicalHeading(line);
    if(head){current=head;if(!sections[current])sections[current]=[];continue}
    if(current)sections[current].push(line);
  }
  return Object.fromEntries(Object.entries(sections).map(([k,v])=>[k,v.join('\n')]));
}
function formatBody(text){
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);let html='',list=false;
  for(const line of lines){
    if(/^[-•*]\s+/.test(line)){if(!list){html+='<ul>';list=true}html+=`<li>${esc(line.replace(/^[-•*]\s+/,''))}</li>`}
    else{if(list){html+='</ul>';list=false}html+=`<p>${esc(line.replace(/^\*\*(.*?)\*\*$/,'$1'))}</p>`}
  }
  if(list)html+='</ul>';return html||'<p>Tap here to add your own notes.</p>';
}
function editableSection(title,text){return `<div class="editable-section" contenteditable="true" data-section="${esc(title)}">${formatBody(text)}</div>`}

function renderPlan(p){
  const first=p.months[0],last=p.months[p.months.length-1];
  const yearSales=p.months.reduce((a,m)=>a+m.sales,0);
  const yearProfit=p.months.reduce((a,m)=>a+m.profit,0);
  const ai=parsePlanSections(p.aiText||'');const edits=p.sectionEdits||{};
  const sec=(title,fallback)=>edits[title]||ai[title]||fallback;

  const sourceHtml=(p.retrieved||[]).length?`
    <div class="plan-card"><h3>Planning Sources Used</h3>
      <p>These offline planning resources were selected as relevant to this business idea.</p>
      ${(p.retrieved||[]).map(s=>s.url
        ?`<a class="source-chip" href="${esc(safeUrl(s.url))}">${esc(s.title)} • ${esc(s.status)}</a>`
        :`<span class="source-chip">${esc(s.title)} • ${esc(s.status)}</span>`).join('')}
    </div>`:'';

  document.getElementById('planContent').innerHTML=`
   <div class="plan-title"><div class="crumb">← Home &nbsp; • &nbsp; Guyana Business Plan Builder</div><h1>${esc(p.name)}</h1><small>${esc(p.cat)} • Guyana • ${p.planMode==='detailed'?'Detailed':'Simple'} plan</small></div>
   <div class="plan-card print-hide"><h3>✏️ Your plan is editable</h3><p>Tap inside any section to change the wording or assumptions. Use <strong>Save My Edits</strong> when finished.</p><button class="smallbtn" onclick="savePlanEdits()">Save My Edits</button></div>
   <div class="plan-card"><h3>Executive Summary</h3>${editableSection('Executive Summary',sec('Executive Summary',`${p.name} is a Guyana-focused ${p.cat.toLowerCase()} venture built around this idea: ${p.idea} The plan prioritises a clear customer offer, disciplined startup spending, reliable service and repeat business.`))}<div class="metrics"><div class="metric"><span>Estimated startup funding</span><b>${money(p.funding)}</b></div><div class="metric"><span>Illustrative year-1 sales</span><b>${money(yearSales)}</b></div><div class="metric"><span>Illustrative operating profit</span><b>${money(yearProfit)}</b></div><div class="metric"><span>Planning margin</span><b>${Math.round(p.margin*100)}%</b></div></div></div>
   <div class="plan-card"><h3>Business Description</h3>${editableSection('Business Description',sec('Business Description',`${p.name} will operate in the ${p.cat} sector. The initial concept is: ${p.idea}`))}</div>
   <div class="plan-card"><h3>Market Opportunity</h3>${editableSection('Market Opportunity',sec('Market Opportunity',`The business should validate demand through customer conversations, pilot sales and careful tracking of repeat purchases before expanding.`))}</div>
   <div class="plan-card"><h3>Target Customers</h3>${editableSection('Target Customers',sec('Target Customers',`Primary customers may include ${p.customers}. The owner should refine this group by location, purchasing frequency, budget and buying motivation.`))}</div>
   <div class="plan-card"><h3>Products and Pricing Strategy</h3>${editableSection('Products and Pricing Strategy',sec('Products and Pricing Strategy',`Start with a focused offer, calculate unit cost carefully, add a sustainable margin and verify prices against actual customer willingness to pay.`))}</div>
   <div class="plan-card"><h3>Marketing and Sales Strategy</h3>${editableSection('Marketing and Sales Strategy',sec('Marketing and Sales Strategy',`Use WhatsApp, Facebook, referrals, community visibility and partnerships to generate leads. Track enquiries, conversion and repeat customers every month.`))}</div>
   <div class="plan-card"><h3>Operations Plan</h3>${editableSection('Operations Plan',sec('Operations Plan',`Start lean, document daily tasks, maintain stock and cash records, schedule purchases around actual demand and keep business funds separate from personal spending.`))}</div>
   <div class="plan-card"><h3>Staffing</h3>${editableSection('Staffing',sec('Staffing',`The planning model allows for approximately ${p.jobs} initial job${p.jobs===1?'':'s'}, subject to real workload, wages and cash flow.`))}</div>
   <div class="plan-card"><h3>Guyana Compliance and Registration</h3>${editableSection('Guyana Compliance and Registration',sec('Guyana Compliance and Registration',`Verify the business structure, TIN, registration, NIS, tax, licence and sector-specific requirements that apply before formal operation.`))}</div>
   <div class="plan-card"><h3>Funding Requirement and Use of Funds</h3>${editableSection('Funding Requirement and Use of Funds',sec('Funding Requirement and Use of Funds',`The illustrative funding requirement is ${money(p.funding)}. The app has allocated this across setup, equipment and working capital as a starting planning framework.`))}${bar('Startup / setup',p.startup,p.funding)}${bar('Equipment / tools',p.equipment,p.funding)}${bar('Working capital',p.working,p.funding)}</div>
   <div class="plan-card"><h3>Financial Outlook</h3>${editableSection('Financial Outlook',sec('Financial Outlook',`The figures below are planning estimates rather than guarantees. Replace them with actual supplier quotations, pricing and confirmed operating costs before using the plan for financing.`))}<div class="monthlist">${p.months.map(m=>`<strong>Month ${m.i}</strong> — Sales ${money(m.sales)} • Estimated operating profit ${money(m.profit)}<br>`).join('')}</div><div class="metrics"><div class="metric"><span>Month 1 sales</span><b>${money(first.sales)}</b></div><div class="metric"><span>Month 12 sales</span><b>${money(last.sales)}</b></div></div></div>
   <div class="plan-card"><h3>SWOT Analysis</h3>${editableSection('SWOT Analysis',sec('SWOT Analysis',`Strengths: local focus and flexible decisions.\nWeaknesses: new brand and limited initial capacity.\nOpportunities: digital marketing, partnerships and underserved niches.\nThreats: price competition, supplier changes and unexpected operating costs.`))}</div>
   <div class="plan-card"><h3>Risks and Mitigation</h3>${editableSection('Risks and Mitigation',sec('Risks and Mitigation',`Monitor cash flow, supplier reliability, customer demand and compliance requirements. Keep contingency funds and avoid scaling fixed costs before demand is demonstrated.`))}</div>
   <div class="plan-card"><h3>Implementation Timeline</h3>${editableSection('Implementation Timeline',sec('Implementation Timeline',`Weeks 1–2: validate demand and confirm suppliers.\nWeeks 3–4: acquire essential equipment and establish records.\nMonth 2: launch and measure results.\nMonths 3–6: strengthen the best-performing offer and expand only when demand supports it.`))}</div>
   <div class="plan-card"><h3>Assumptions to Verify</h3>${editableSection('Assumptions to Verify',sec('Assumptions to Verify',`VERIFY current supplier prices, rent, wages, licensing requirements, tax treatment, financing terms and customer demand before relying on the final figures.`))}</div>
   ${sourceHtml}
   <div class="unlock"><h3>Professional Printable Plan</h3><p>${isUnlocked()?'Unlocked on this device. You can print or save to PDF.':'Unlock the professional printable layout and PDF-ready output.'}</p><button class="pay" onclick="${isUnlocked()?'printPlan()':'openPayment()'}">${isUnlocked()?'🖨 Print / Save PDF':'Unlock PDF • GYD $500'}</button></div>
   <button class="secondary print-hide" onclick="showCreate('${p.cat.replaceAll("'","\\'")}')">Edit / Create Another Plan</button>`;
}
function savePlanEdits(){
  if(!currentPlan)return;
  const edits={};document.querySelectorAll('.editable-section').forEach(el=>{edits[el.dataset.section]=el.innerText.trim()});
  currentPlan.sectionEdits=edits;savePlan(currentPlan);toast('Your edits were saved on this device.');
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
  el.innerHTML=arr.map(p=>`<div class="saved-card"><h3>${esc(p.name)}</h3><small>${esc(p.cat)} • ${new Date(p.created).toLocaleDateString()} • ${p.aiGenerated?'Generated':'Template'}</small><div class="row"><button class="smallbtn" onclick="openSaved(${p.id})">Open</button><button class="smallbtn" onclick="deleteSaved(${p.id})">Delete</button></div></div>`).join('');
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
  const ready=componentStatusCache.coreReady;
  const status=document.getElementById('componentSettingsStatus'),badge=document.getElementById('componentSettingsBadge');
  if(status)status.textContent=ready?'Everything needed for simple plans is ready.':'Some planning components still need to be downloaded.';
  if(badge)badge.textContent=ready?'✓ Ready':'Update';
}
function printPlan(){try{Android.printPlan()}catch(e){window.print()}}

function parseJsonSafe(s,def={}){try{return JSON.parse(s)}catch(e){return def}}
function refreshCreateComponentStatus(){
  const el=document.getElementById('createAiStatus');if(!el)return;
  const mode=selectedMode();const s=mode==='detailed'?componentStatusCache.detailed:componentStatusCache.simple;
  if(s?.stage==='ready'&&componentStatusCache.knowledge?.ready){
    el.className='ai-status';el.textContent='✓ Ready to create your plan privately on this device.';
  }else if(['downloading','pending','paused','needs_verification'].includes(s?.stage)){
    el.className='ai-status warn';el.textContent=`Preparing components… ${s?.percent||0}%`;
  }else{
    el.className='ai-status warn';el.textContent='A Wi-Fi download may be needed before this plan can be created.';
  }
}

function refreshComponentStatus(showToast=false,fromStartup=false){
  if(!hasAndroid()||typeof Android.getComponentStatus!=='function'){
    componentStatusCache={wifi:false,coreReady:false,knowledge:{ready:true,items:(knowledge.chunks||[]).length},simple:{stage:'browser_preview',percent:0},detailed:{stage:'browser_preview',percent:0}};
    updateSettings();refreshCreateComponentStatus();if(fromStartup)hideComponentGate();return;
  }
  try{componentStatusCache=parseJsonSafe(Android.getComponentStatus(),componentStatusCache)}catch(e){}
  updateSettings();refreshCreateComponentStatus();updateModeUi();updateComponentGate();

  for(const mode of ['simple','detailed']){
    const st=componentStatusCache[mode];
    if(st?.stage==='needs_verification'&&!componentVerifyInFlight[mode]){
      componentVerifyInFlight[mode]=true;
      try{Android.verifyComponent(mode,'verify_'+mode+'_'+Date.now())}catch(e){componentVerifyInFlight[mode]=false}
    }
  }

  const busy=['downloading','pending','paused','needs_verification'].some(x=>[componentStatusCache.simple?.stage,componentStatusCache.detailed?.stage].includes(x));
  if(busy&&!componentPoll)componentPoll=setInterval(()=>refreshComponentStatus(false,false),1600);
  if(!busy&&componentPoll){clearInterval(componentPoll);componentPoll=null}
  if(showToast)toast(componentStatusCache.coreReady?'Components are ready.':'Component check complete.');
}

window.onComponentVerified=function(requestId,mode,ok){
  componentVerifyInFlight[mode]=false;
  if(ok!=='true')toast('A downloaded component could not be verified. Please download it again.');
  setTimeout(()=>refreshComponentStatus(false,false),250);
};
window.onComponentVerificationError=function(requestId,mode,message){componentVerifyInFlight[mode]=false;toast('Component check could not finish. '+message);refreshComponentStatus(false,false)};

function startupComponentCheck(){
  showComponentGate('Checking components','Preparing the app for private offline planning…',5,false);
  setTimeout(()=>{
    refreshComponentStatus(false,true);
    setTimeout(()=>{
      const s=componentStatusCache.simple;
      if(componentStatusCache.coreReady){showComponentGate('Components ready','Everything is ready.',100,false);setTimeout(hideComponentGate,450);return}
      if(['downloading','pending','paused','needs_verification'].includes(s?.stage)){updateComponentGate();return}
      if(componentStatusCache.wifi){startComponentDownload('simple','startup')}else showWifiRequired('Core components need Wi-Fi before the first business plan can be created. You can continue to the app now and finish setup later.');
    },220);
  },350);
}

function showComponentGate(title,text,percent=0,showActions=false){
  const gate=document.getElementById('componentGate');if(!gate)return;
  gate.classList.add('show');document.getElementById('componentGateTitle').textContent=title;document.getElementById('componentGateText').textContent=text;
  document.getElementById('componentGateBar').style.width=percent+'%';document.getElementById('componentGatePct').textContent=percent+'%';
  document.getElementById('componentGateActions').style.display=showActions?'grid':'none';
}
function hideComponentGate(){const g=document.getElementById('componentGate');if(g)g.classList.remove('show')}
function showWifiRequired(message){
  showComponentGate('Wi-Fi needed',message,0,true);
  document.getElementById('componentWifiBtn').style.display='block';
  document.getElementById('componentContinueBtn').style.display='block';
}
function openWifi(){try{Android.openWifiSettings()}catch(e){toast('Open Wi-Fi settings on your phone.')}}
function continueWithoutComponents(){hideComponentGate();go('home')}
function checkComponentsAgain(){showComponentGate('Checking components','Checking what is already available…',8,false);setTimeout(()=>refreshComponentStatus(false,true),250);setTimeout(()=>{if(!componentStatusCache.coreReady){if(componentStatusCache.wifi)startComponentDownload('simple','startup');else showWifiRequired('Wi-Fi is still unavailable. You can continue to the home screen and try again later.')}},700)}

function updateComponentGate(){
  const gate=document.getElementById('componentGate');if(!gate||!gate.classList.contains('show'))return;
  let mode=requestedPlanMode==='detailed'?'detailed':'simple';
  const s=componentStatusCache[mode]||{};
  if(s.stage==='ready'&&componentStatusCache.knowledge?.ready){
    showComponentGate('Components ready','Everything is ready.',100,false);
    if(pendingPlanAfterComponents){const x=pendingPlanAfterComponents;pendingPlanAfterComponents=null;setTimeout(()=>{hideComponentGate();startPlanGeneration(x.plan,x.mode)},400)}
    else setTimeout(hideComponentGate,500);
    return;
  }
  if(['downloading','pending','paused'].includes(s.stage)){
    const pct=Math.max(1,s.percent||0);showComponentGate('Downloading components','Keep the app open while the download finishes. Wi-Fi only.',pct,false);return;
  }
  if(s.stage==='needs_verification'){showComponentGate('Checking components','Finishing setup…',99,false);return}
  if(s.stage==='failed'){showWifiRequired('The component download did not finish. Connect to Wi-Fi and try again.');return}
}

function startComponentDownload(mode,reason='manual'){
  requestedPlanMode=mode;
  if(!hasAndroid()){toast('Component downloads are available in the installed Android app.');return}
  if(!componentStatusCache.wifi){showWifiRequired(mode==='detailed'?'Detailed planning needs an additional Wi-Fi download. You can continue with the simple plan instead.':'Wi-Fi is needed to download the required components.');return}
  showComponentGate('Downloading components',mode==='detailed'?'Preparing detailed planning. Wi-Fi only.':'Preparing private offline planning. Wi-Fi only.',1,false);
  try{
    const r=parseJsonSafe(Android.startComponentDownload(mode),{ok:false});
    if(!r.ok){if(r.needsWifi)showWifiRequired('Wi-Fi is required for this download.');else{hideComponentGate();toast(r.message||'Could not start component download.')}}
    else{refreshComponentStatus(false,false);if(!componentPoll)componentPoll=setInterval(()=>refreshComponentStatus(false,false),1600)}
  }catch(e){hideComponentGate();toast('Could not start component download: '+e.message)}
}

function ensureComponentsForMode(mode,forPlan=false){
  requestedPlanMode=mode;refreshComponentStatus(false,false);
  const s=mode==='detailed'?componentStatusCache.detailed:componentStatusCache.simple;
  if(s?.stage==='ready'&&componentStatusCache.knowledge?.ready){hideComponentGate();if(forPlan&&pendingPlanAfterComponents){const x=pendingPlanAfterComponents;pendingPlanAfterComponents=null;startPlanGeneration(x.plan,x.mode)};return}
  if(componentStatusCache.wifi)startComponentDownload(mode,forPlan?'plan':'manual');
  else showWifiRequired(mode==='detailed'?'Detailed planning requires an additional Wi-Fi download. You can switch to Simple Plan or continue to the app.':'Wi-Fi is needed to finish the required component download. You can continue to the app and try again later.');
}
function settingsDownloadComponents(){requestedPlanMode='simple';ensureComponentsForMode('simple',false)}
function settingsCheckComponents(){showComponentGate('Checking components','Checking what is already available…',8,false);setTimeout(()=>{refreshComponentStatus(true,false);setTimeout(hideComponentGate,650)},250)}
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
 ['🔒','Private planning','The planning engine can work locally on the phone, but current legal, tax and market facts should still be checked before formal use.']
];
function renderTips(){document.getElementById('tips').innerHTML=tipData.map(([e,h,p])=>`<div class="tip"><b>${e}</b><h3>${h}</h3><p>${p}</p></div>`).join('')}

renderCategories();
renderChips();
renderTips();
loadKnowledge();
updateModeUi();
updateSettings();
refreshComponentStatus(false,false);
refreshCreateComponentStatus();
setTimeout(startupComponentCheck,250);
