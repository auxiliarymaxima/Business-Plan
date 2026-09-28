
const categories=[
  ['Agriculture & Farming','🌾'],['Food & Catering','🍛'],['Retail & Trading','🛍️'],['Beauty & Wellness','💇🏽‍♀️'],['Construction & Building','🏗️'],['Transportation & Logistics','🚌'],['Tourism & Hospitality','🌴'],['Technology & Digital Services','💻'],['Fisheries & Marine','🎣'],['Manufacturing & Processing','⚙️'],['Professional Services','🧑🏽‍💼'],['Creative & Other Services','🎨']
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

function money(n){return 'GYD $'+Math.round(n||0).toLocaleString('en-US')}
function slugScreen(name){return document.getElementById(name+'Screen')}
function go(name){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));slugScreen(name).classList.add('active');document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.nav===name));if(name==='saved')renderSaved();if(name==='settings')updateSettings();window.scrollTo(0,0)}
function showCreate(cat){if(cat)selectedCategory=cat;renderChips();go('create')}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200);try{Android.toast(msg)}catch(e){}}

function renderCategories(){document.getElementById('categories').innerHTML=categories.map(([name,emo])=>`<button class="category" onclick="showCreate('${name.replaceAll("'","\\'")}')"><span class="emo">${emo}</span><strong>${name}</strong></button>`).join('')}
function renderChips(){document.getElementById('chips').innerHTML=categories.slice(0,8).map(([name,emo])=>`<button class="chip ${selectedCategory===name?'active':''}" onclick="selectedCategory='${name.replaceAll("'","\\'")}';renderChips()">${emo} ${name.split(' & ')[0]}</button>`).join('')}

function extractName(idea){const m=idea.match(/(?:called|named)\s+([A-Z][A-Za-z0-9 &'’-]{2,32})/);return m?m[1].trim().replace(/[.,]$/,''):'My Guyana Business'}
function inferCategory(idea){const s=idea.toLowerCase();const tests=[['Agriculture & Farming',['farm','crop','agri','vegetable','livestock']],['Food & Catering',['food','cater','restaurant','lunch','bakery','snack']],['Retail & Trading',['retail','shop','store','sell','trading']],['Beauty & Wellness',['beauty','salon','hair','nail','spa']],['Construction & Building',['construction','building','contractor','masonry']],['Transportation & Logistics',['transport','taxi','bus','delivery','logistics']],['Tourism & Hospitality',['tour','hotel','guest','travel','resort']],['Technology & Digital Services',['tech','software','website','computer','digital','it service']],['Fisheries & Marine',['fish','fishing','marine','seafood']],['Manufacturing & Processing',['manufactur','process','factory','production']],['Professional Services',['consult','account','legal','training','professional']],['Creative & Other Services',['design','print','photo','creative','art']]];for(const [cat,keys] of tests)if(keys.some(k=>s.includes(k)))return cat;return selectedCategory}

function generatePlan(){
 const idea=document.getElementById('idea').value.trim(); if(idea.length<18){toast('Please describe your business idea first.');return}
 const cat=inferCategory(idea); selectedCategory=cat; const preset=sectorPresets[cat]||sectorPresets['Professional Services'];
 const funding=Math.max(100000,parseInt((document.getElementById('amount').value||'1500000').replace(/\D/g,''))||1500000);
 const name=document.getElementById('businessName').value.trim()||extractName(idea);
 const startup=Math.round(funding*.47), equipment=Math.round(funding*.28), working=Math.round(funding*.25);
 const baseSales=Math.max(220000,Math.round(funding*.29)); const months=[];let cumulative=0;
 for(let i=1;i<=12;i++){const season=1+((i===11||i===12)?0.12:0);const sales=Math.round(baseSales*Math.pow(1+preset.growth,i-1)*season);const profit=Math.round(sales*preset.margin);cumulative+=profit;months.push({i,sales,profit})}
 const jobs=Math.max(1,Math.min(12,Math.round(funding/650000)));
 const plan={id:Date.now(),name,idea,cat,funding,startup,equipment,working,months,jobs,margin:preset.margin,customers:preset.customers,created:new Date().toISOString()};currentPlan=plan;savePlan(plan);renderPlan(plan);go('plan');toast('Business plan created and saved.');
}
function savePlan(plan){let arr=JSON.parse(localStorage.getItem('gbpb_plans')||'[]');arr=arr.filter(p=>p.id!==plan.id);arr.unshift(plan);localStorage.setItem('gbpb_plans',JSON.stringify(arr.slice(0,30)))}
function renderPlan(p){
 const first=p.months[0], last=p.months[p.months.length-1];
 document.getElementById('planContent').innerHTML=`
 <div class="plan-title"><div class="crumb">← Home &nbsp; • &nbsp; Guyana Business Plan Builder</div><h1>${esc(p.name)}</h1><small>${esc(p.cat)} • Guyana</small></div>
 <div class="plan-card"><h3>Executive Summary</h3><p>${esc(p.name)} is a Guyana-focused ${p.cat.toLowerCase()} venture built around this idea: ${esc(p.idea)} The plan prioritises a clear customer offer, disciplined startup spending, reliable service and repeat business.</p><div class="metrics"><div class="metric"><span>Estimated startup funding</span><b>${money(p.funding)}</b></div><div class="metric"><span>Illustrative year-1 sales</span><b>${money(p.months.reduce((a,m)=>a+m.sales,0))}</b></div><div class="metric"><span>Potential jobs</span><b>${p.jobs}</b></div><div class="metric"><span>Planning margin</span><b>${Math.round(p.margin*100)}%</b></div></div></div>
 <div class="plan-card"><h3>Business Opportunity</h3><p>The business can compete by combining local knowledge, responsive customer service and a focused offer. Its core target customers are ${esc(p.customers)}. Early validation should come from direct customer conversations, small pilot sales and tracking which products or services generate repeat demand.</p></div>
 <div class="plan-card"><h3>Marketing & Sales Strategy</h3><p>Use Facebook, WhatsApp, Instagram, referrals, community visibility and partnerships to generate leads. Keep pricing simple, publish clear contact information, collect customer reviews and use introductory offers without permanently lowering margins. Track enquiries, conversion rate and repeat customers every month.</p></div>
 <div class="plan-card"><h3>Operations</h3><p>Start with a lean workflow: secure required supplies and equipment, document daily tasks, maintain simple stock and cash records, and schedule purchases around actual demand. Separate business funds from personal spending and keep invoices, receipts and customer records organised from day one.</p></div>
 <div class="plan-card"><h3>Funding Requirement</h3><p>Total illustrative funding requirement: <strong>${money(p.funding)}</strong>.</p>
   ${bar('Startup / setup',p.startup,p.funding)}${bar('Equipment / tools',p.equipment,p.funding)}${bar('Working capital',p.working,p.funding)}
 </div>
 <div class="plan-card"><h3>12-Month Financial Outlook</h3><p>This projection is a planning model, not a guarantee. It assumes gradual customer growth and the planning margin selected for the business type.</p><div class="monthlist">${p.months.map(m=>`<strong>Month ${m.i}</strong> — Sales ${money(m.sales)} • Estimated operating profit ${money(m.profit)}<br>`).join('')}</div><div class="metrics"><div class="metric"><span>Month 1 sales</span><b>${money(first.sales)}</b></div><div class="metric"><span>Month 12 sales</span><b>${money(last.sales)}</b></div></div></div>
 <div class="plan-card"><h3>SWOT Analysis</h3><div class="swot"><div><b>Strengths</b><p>Local focus, direct customer relationships, flexible decision-making and low overhead potential.</p></div><div><b>Weaknesses</b><p>New brand, limited initial capacity and dependence on disciplined cash flow.</p></div><div><b>Opportunities</b><p>Digital marketing, partnerships, underserved niches and repeat-customer growth.</p></div><div><b>Threats</b><p>Price competition, supplier changes, demand swings and unexpected operating costs.</p></div></div></div>
 <div class="plan-card"><h3>Implementation Plan</h3><p><strong>Weeks 1–2:</strong> validate demand, confirm suppliers and finalise pricing. <strong>Weeks 3–4:</strong> acquire essential equipment, set up records and brand assets. <strong>Month 2:</strong> launch a focused sales campaign and measure results. <strong>Months 3–6:</strong> improve the highest-performing offer, build repeat sales and add capacity only when demand supports it.</p></div>
 <div class="unlock"><h3>Professional Printable Plan</h3><p>${isUnlocked()?'Unlocked on this device. You can print or save to PDF.':'Unlock the professional printable layout and PDF-ready output.'}</p><button class="pay" onclick="${isUnlocked()?'printPlan()':'openPayment()'}">${isUnlocked()?'🖨 Print / Save PDF':'Unlock PDF • GYD $500'}</button></div>
 <button class="secondary print-hide" onclick="showCreate('${p.cat.replaceAll("'","\\'")}')">Edit / Create Another Plan</button>`;
}
function bar(label,val,total){return `<div class="barrow"><label><span>${label}</span><span>${money(val)}</span></label><div class="bar"><i style="width:${Math.max(6,val/total*100)}%"></i></div></div>`}
function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function renderSaved(){const arr=JSON.parse(localStorage.getItem('gbpb_plans')||'[]');const el=document.getElementById('savedList');if(!arr.length){el.innerHTML='<div class="saved-empty">📄<h3>No saved plans yet</h3><p>Create your first business plan and it will appear here.</p><button class="primary" onclick="showCreate()">Create a Plan</button></div>';return}el.innerHTML=arr.map(p=>`<div class="saved-card"><h3>${esc(p.name)}</h3><small>${esc(p.cat)} • ${new Date(p.created).toLocaleDateString()}</small><div class="row"><button class="smallbtn" onclick="openSaved(${p.id})">Open</button><button class="smallbtn" onclick="deleteSaved(${p.id})">Delete</button></div></div>`).join('')}
function openSaved(id){const arr=JSON.parse(localStorage.getItem('gbpb_plans')||'[]');const p=arr.find(x=>x.id===id);if(p){currentPlan=p;renderPlan(p);go('plan')}}
function deleteSaved(id){let arr=JSON.parse(localStorage.getItem('gbpb_plans')||'[]').filter(x=>x.id!==id);localStorage.setItem('gbpb_plans',JSON.stringify(arr));renderSaved();toast('Plan deleted.')}
function isUnlocked(){return localStorage.getItem('gbpb_unlocked')==='1'}
function openPayment(){document.getElementById('paymentModal').classList.add('show')}
function closePayment(){document.getElementById('paymentModal').classList.remove('show')}
function demoUnlock(){localStorage.setItem('gbpb_unlocked','1');closePayment();updateSettings();if(currentPlan)renderPlan(currentPlan);toast('Professional plan unlocked on this device.')}
function updateSettings(){const yes=isUnlocked();document.getElementById('unlockStatus').textContent=yes?'Professional printing is enabled':'Not unlocked';document.getElementById('unlockBadge').textContent=yes?'Unlocked':'Locked'}
function printPlan(){try{Android.printPlan()}catch(e){window.print()}}

const tipData=[['💵','Know your numbers','Separate startup costs, monthly operating costs and working capital. Keep a cash buffer rather than spending the full funding amount immediately.'],['🎯','Define one clear customer','A plan becomes stronger when it states exactly who is expected to buy, why they need the offer and how you will reach them.'],['📣','Use low-cost channels first','WhatsApp, Facebook, referrals and partnerships can validate demand before you spend heavily on advertising.'],['🧾','Keep records from day one','Track every sale and expense. Good records help with pricing, cash flow, tax preparation and financing conversations.'],['📦','Buy inventory from demand','Avoid tying up too much cash in stock. Start lean, measure what sells and restock around real demand.'],['🤝','Build repeat customers','Follow up, ask for feedback and make it easy for satisfied customers to buy again or refer someone else.']];
function renderTips(){document.getElementById('tips').innerHTML=tipData.map(([e,h,p])=>`<div class="tip"><b>${e}</b><h3>${h}</h3><p>${p}</p></div>`).join('')}
renderCategories();renderChips();renderTips();updateSettings();
