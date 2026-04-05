'use strict';

/* ═══════════════════════════════════════════════════════
   SECURITY — Salted SHA-256 (hardened)
   Plain-text credentials are NOT stored anywhere.
   Only pre-computed SHA-256(salt+credential) hashes exist.
   Inspect element / search will NEVER reveal passwords.
═══════════════════════════════════════════════════════ */
// Random salt — defeats rainbow table attacks
const _S = '7f3a9c2e1b8d4f6a0e5c3b7a9f2d1e4c';
// Pre-computed hashes — plain text credentials removed entirely
// SHA-256(_S + username) and SHA-256(_S + password)
const _UH = '2f86f7e44e4fd55411b27130565eabf1fa01410948e6b928d5a15bf109396e44';
const _PH = '4b042e80e1831e1cb8c440a6ca7192fb5ecc953d51d768e9b64c528bd117f0fb';

async function _sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// No _initHash needed — hashes are already computed at build time
function _initHash() {}

async function _verify(pass) {
  const h = await _sha256(_S + pass);
  return h === _PH;
}

/* ═══════════════════════════════════════════════════════
   SESSION — persists across pages via sessionStorage
═══════════════════════════════════════════════════════ */
function isLoggedIn()   { return sessionStorage.getItem('_em') === '1'; }
function setLoggedIn()  { sessionStorage.setItem('_em','1'); }
function clearSession() { sessionStorage.removeItem('_em'); }

let EDIT_MODE = false;

/* ═══════════════════════════════════════════════════════
   CURSOR
═══════════════════════════════════════════════════════ */
function initCursor() {
  const dot  = document.getElementById('cdot');
  const ring = document.getElementById('cring');
  if (!dot || !ring) return;
  document.addEventListener('mousemove', e => {
    dot.style.left  = e.clientX + 'px';
    dot.style.top   = e.clientY + 'px';
    ring.style.left = e.clientX + 'px';
    ring.style.top  = e.clientY + 'px';
  });
  document.addEventListener('mouseover', e => {
    const t = e.target.closest('a,button,.proj-card,.cyber-card,.tl-item,.tool-card,.custom-slot,.skill-item,.cert-card,.svc-card,.edu-card,.hobby-card,.etag,.lang-pill');
    if (t) { ring.style.width='50px';ring.style.height='50px';ring.style.borderColor='rgba(255,0,110,0.8)'; }
    else   { ring.style.width='28px';ring.style.height='28px';ring.style.borderColor='rgba(0,245,255,0.5)'; }
  });
}

/* ═══════════════════════════════════════════════════════
   NAV ACTIVE
═══════════════════════════════════════════════════════ */
function initNav(page) {
  document.querySelectorAll('.nav-links a[data-page]').forEach(a => {
    if (a.getAttribute('data-page') === page) a.classList.add('active');
  });
}

/* ═══════════════════════════════════════════════════════
   LOGIN MODAL
═══════════════════════════════════════════════════════ */
function showLogin() {
  const ov = document.getElementById('loginOverlay');
  if (ov) { ov.classList.add('show'); setTimeout(()=>document.getElementById('loginUser')?.focus(),100); }
}
function hideLogin() {
  document.getElementById('loginOverlay')?.classList.remove('show');
}

async function attemptLogin() {
  const u   = (document.getElementById('loginUser')?.value||'').trim();
  const p   = (document.getElementById('loginPass')?.value||'');
  const err = document.getElementById('loginErr');
  // Verify both username and password against pre-computed hashes — no plain text comparison
  const uh = await _sha256(_S + u);
  if (uh !== _UH) { err.textContent='// ACCESS DENIED — INVALID USERNAME';err.classList.add('show');return; }
  const ok = await _verify(p);
  if (!ok) { err.textContent='// ACCESS DENIED — WRONG PASSWORD';err.classList.add('show');return; }
  setLoggedIn();
  hideLogin();
  enableEditMode();
}

/* ═══════════════════════════════════════════════════════
   EDIT MODE — persists across pages via sessionStorage
═══════════════════════════════════════════════════════ */
function enableEditMode() {
  EDIT_MODE = true;
  document.body.classList.add('edit-mode');
  // Update ALL edit buttons on page (nav + footer)
  document.querySelectorAll('.nav-edit-btn, .footer-edit-btn').forEach(b => {
    b.classList.add('active');
    const span = b.querySelector('.eb-text');
    if (span) span.textContent = 'EXIT EDIT';
  });
  // Make all [data-editable] contenteditable
  document.querySelectorAll('[data-editable]').forEach(el => {
    el.contentEditable = 'true';
    el.addEventListener('input', _saveEditable);
  });
  _restoreEdits();
}

function disableEditMode() {
  EDIT_MODE = false;
  clearSession();
  document.body.classList.remove('edit-mode');
  document.querySelectorAll('.nav-edit-btn, .footer-edit-btn').forEach(b => {
    b.classList.remove('active');
    const span = b.querySelector('.eb-text');
    if (span) span.textContent = 'EDIT MODE';
  });
  document.querySelectorAll('[data-editable]').forEach(el => {
    el.contentEditable = 'false';
    el.removeEventListener('input', _saveEditable);
  });
}

function toggleEditMode() {
  if (EDIT_MODE) { disableEditMode(); return; }
  if (isLoggedIn()) { enableEditMode(); return; }
  showLogin();
}

function _saveEditable(e) {
  const key = e.target.getAttribute('data-editable');
  if (key) localStorage.setItem('ed_' + key, e.target.innerHTML);
}

function _restoreEdits() {
  document.querySelectorAll('[data-editable]').forEach(el => {
    const key = el.getAttribute('data-editable');
    const saved = key ? localStorage.getItem('ed_' + key) : null;
    if (saved !== null) el.innerHTML = saved;
  });
}

/* ═══════════════════════════════════════════════════════
   DETAIL PANEL — click card to open
═══════════════════════════════════════════════════════ */
function openPanel(data) {
  const p = document.getElementById('detailPanel');
  if (!p) return;
  p.querySelector('.dp-tag').textContent   = data.tag   || '';
  p.querySelector('.dp-title').textContent = data.title || '';
  p.querySelector('.dp-desc').textContent  = data.desc  || '';
  const img = p.querySelector('.dp-img');
  if (img) { if(data.img){img.src=data.img;img.style.display='block';}else{img.style.display='none';} }
  const tags = p.querySelector('.dp-tags');
  if (tags) tags.innerHTML = (data.tags||[]).map(t=>`<span class="pstag ${t.color||''}">${t.text}</span>`).join('');
  const rows = p.querySelector('#dpRows');
  if (rows) rows.innerHTML = Object.entries(data.rows||{}).map(([k,v])=>`<div class="dp-row"><span class="dp-row-label">${k}</span><span class="dp-row-val">${v}</span></div>`).join('');
  p.classList.add('open');
}
function closePanel() { document.getElementById('detailPanel')?.classList.remove('open'); }

/* ═══════════════════════════════════════════════════════
   ADD / EDIT MODAL
═══════════════════════════════════════════════════════ */
let _modalType    = null;
let _modalEditId  = null;
let _imgBase64    = null;
let _modalTags    = [];
let _tagColor     = 'cyan';

function openAddModal(type, editData) {
  if (!EDIT_MODE) return;
  _modalType   = type;
  _modalEditId = editData?.id || null;
  _imgBase64   = editData?.imgKey ? (localStorage.getItem(editData.imgKey)||null) : null;
  _modalTags   = editData?.tags ? JSON.parse(JSON.stringify(editData.tags)) : [];

  const modal = document.getElementById('addModal');
  const title = document.getElementById('modalTitle');
  const fields= document.getElementById('modalFields');
  if (!modal||!title||!fields) return;

  const labels = {project:'Project',experience:'Experience',skill:'Skill',service:'Service',cert:'Certificate',edu:'Education',hobby:'Hobby',custom:'Custom Item'};
  title.innerHTML = `${_modalEditId?'Edit':'Add'} <span>${labels[type]||type}</span>`;
  fields.innerHTML = _buildFields(type, editData);
  modal.classList.add('show');
  _renderTagChips();

  // image preview restore
  if (_imgBase64) {
    const prev = document.getElementById('mImgPreview');
    if (prev) { prev.src=_imgBase64; prev.classList.add('show'); }
  }
}

function _buildFields(type, d) {
  const v = (k,fb='') => d?.[k]||fb;
  const imgField = `<div class="mfield"><label>Image (auto-sized)</label>
    <div class="img-upload-zone" onclick="document.getElementById('mImgInput').click()">
      <input type="file" id="mImgInput" accept="image/*" onchange="previewImg(this)">
      <label class="img-upload-label">▲ CLICK TO UPLOAD IMAGE</label>
      <img id="mImgPreview" class="img-preview" alt="preview">
    </div></div>`;

  if (type==='project') return `
    ${imgField}
    <div class="mfield"><label>Category Tag</label><input id="mTag" class="mfield-i" placeholder="WEB PROJECT" value="${v('tag')}"></div>
    <div class="mfield"><label>Main Heading (Bold Title)</label><input id="mName" class="mfield-i" placeholder="MY PROJECT" value="${v('name')}"></div>
    <div class="mfield"><label>Description</label><textarea id="mDesc" class="mfield-i">${v('desc')}</textarea></div>
    <div class="mfield"><label>Live URL</label><input id="mUrl" class="mfield-i" placeholder="https://" value="${v('url')}"></div>
    <div class="mfield"><label>Tech Tags</label>
      <div class="tag-add-row"><input id="mTagInp" class="mfield-i" placeholder="e.g. React" style="flex:1">
        <div class="col-btns"><div class="col-btn c sel" onclick="pickCol(this,'cyan')"></div><div class="col-btn p" onclick="pickCol(this,'pink')"></div><div class="col-btn pu" onclick="pickCol(this,'purple')"></div></div>
        <button class="act-btn" onclick="addTag()" style="display:flex">+ ADD</button>
      </div><div class="tag-chips" id="mTagChips"></div></div>`;

  if (type==='experience') return `
    <div class="mfield"><label>Period</label><input id="mPeriod" class="mfield-i" placeholder="2021 — PRESENT" value="${v('period')}"></div>
    <div class="mfield"><label>Role / Title</label><input id="mRole" class="mfield-i" placeholder="UI/UX Designer" value="${v('role')}"></div>
    <div class="mfield"><label>Company</label><input id="mCompany" class="mfield-i" placeholder="FREELANCE" value="${v('company')}"></div>
    <div class="mfield"><label>Description</label><textarea id="mExpDesc" class="mfield-i">${v('desc')}</textarea></div>`;

  if (type==='skill') return `
    <div class="mfield"><label>Skill Name</label><input id="mSkillName" class="mfield-i" placeholder="Adobe XD" value="${v('name')}"></div>
    <div class="mfield"><label>Proficiency % (0-100)</label><input id="mSkillPct" type="number" min="0" max="100" class="mfield-i" placeholder="80" value="${v('pct',80)}"></div>`;

  if (type==='service') return `
    ${imgField}
    <div class="mfield"><label>Service Icon (emoji)</label><input id="mSvcIcon" class="mfield-i" placeholder="🌐" value="${v('icon')}"></div>
    <div class="mfield"><label>Title</label><input id="mSvcTitle" class="mfield-i" placeholder="WordPress Development" value="${v('title')}"></div>
    <div class="mfield"><label>Description</label><textarea id="mSvcDesc" class="mfield-i">${v('desc')}</textarea></div>
    <div class="mfield"><label>Tags</label>
      <div class="tag-add-row"><input id="mTagInp" class="mfield-i" placeholder="e.g. WordPress" style="flex:1">
        <div class="col-btns"><div class="col-btn c sel" onclick="pickCol(this,'cyan')"></div><div class="col-btn p" onclick="pickCol(this,'pink')"></div><div class="col-btn pu" onclick="pickCol(this,'purple')"></div></div>
        <button class="act-btn" onclick="addTag()" style="display:flex">+ ADD</button>
      </div><div class="tag-chips" id="mTagChips"></div></div>
    <div class="mfield"><label>Footer Note</label><input id="mSvcNote" class="mfield-i" placeholder="3 YEARS EXPERIENCE" value="${v('note')}"></div>`;

  if (type==='cert') return `
    <div class="mfield"><label>Certificate Name</label><input id="mCertName" class="mfield-i" placeholder="Certificate Name" value="${v('name')}"></div>
    <div class="mfield"><label>Issuer / Source</label><input id="mCertSrc" class="mfield-i" placeholder="SOLOLEARN" value="${v('src')}"></div>
    <div class="mfield"><label>Accent Color</label>
      <div class="col-btns" style="margin-top:6px"><div class="col-btn c sel" onclick="pickCol(this,'cyan')"></div><div class="col-btn p" onclick="pickCol(this,'pink')"></div><div class="col-btn pu" onclick="pickCol(this,'purple')"></div></div></div>`;

  if (type==='edu') return `
    <div class="mfield"><label>Year Range</label><input id="mEduYear" class="mfield-i" placeholder="2024 — 2028" value="${v('year')}"></div>
    <div class="mfield"><label>Degree / Level</label><input id="mEduDeg" class="mfield-i" placeholder="BS in Cyber Security" value="${v('degree')}"></div>
    <div class="mfield"><label>Institution</label><input id="mEduInst" class="mfield-i" placeholder="Superior University" value="${v('inst')}"></div>
    <div class="mfield"><label>Note</label><input id="mEduNote" class="mfield-i" placeholder="4th Semester — Ongoing" value="${v('note')}"></div>`;

  if (type==='hobby') return `
    <div class="mfield"><label>Hobby Icon (emoji)</label><input id="mHobbyIcon" class="mfield-i" placeholder="📖" value="${v('icon')}"></div>
    <div class="mfield"><label>Hobby Name</label><input id="mHobbyName" class="mfield-i" placeholder="Reading" value="${v('name')}"></div>`;

  if (type==='custom') return `
    ${imgField}
    <div class="mfield"><label>Title</label><input id="mCustomTitle" class="mfield-i" placeholder="Project Title" value="${v('name')}"></div>
    <div class="mfield"><label>Description</label><textarea id="mCustomDesc" class="mfield-i">${v('desc')}</textarea></div>
    <div class="mfield"><label>Tags</label>
      <div class="tag-add-row"><input id="mTagInp" class="mfield-i" placeholder="e.g. Design" style="flex:1">
        <div class="col-btns"><div class="col-btn c sel" onclick="pickCol(this,'cyan')"></div><div class="col-btn p" onclick="pickCol(this,'pink')"></div><div class="col-btn pu" onclick="pickCol(this,'purple')"></div></div>
        <button class="act-btn" onclick="addTag()" style="display:flex">+ ADD</button>
      </div><div class="tag-chips" id="mTagChips"></div></div>`;

  return '';
}

function closeAddModal() { document.getElementById('addModal')?.classList.remove('show'); _modalType=null;_modalEditId=null; }

function previewImg(input) {
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    _imgBase64=e.target.result;
    const prev=document.getElementById('mImgPreview');
    if(prev){prev.src=_imgBase64;prev.classList.add('show');}
  };
  reader.readAsDataURL(file);
}

function pickCol(el,col) {
  el.closest('.col-btns')?.querySelectorAll('.col-btn').forEach(b=>b.classList.remove('sel'));
  el.classList.add('sel'); _tagColor=col;
}

function addTag() {
  const inp=document.getElementById('mTagInp'); if(!inp) return;
  const val=inp.value.trim(); if(!val) return;
  _modalTags.push({text:val,color:_tagColor});
  _renderTagChips(); inp.value='';
}

function _renderTagChips() {
  const row=document.getElementById('mTagChips'); if(!row) return;
  row.innerHTML=_modalTags.map((t,i)=>`<span class="t-chip ${t.color}">${t.text}<span class="tx" onclick="removeTag(${i})">✕</span></span>`).join('');
}

function removeTag(i) { _modalTags.splice(i,1); _renderTagChips(); }

/* ── Save modal ── */
function saveModalItem() {
  const m = _modalType;
  if (m==='project')    _saveProject();
  else if (m==='experience') _saveExperience();
  else if (m==='skill') _saveSkill();
  else if (m==='service') _saveService();
  else if (m==='cert') _saveCert();
  else if (m==='edu')  _saveEdu();
  else if (m==='hobby') _saveHobby();
  else if (m==='custom') _saveCustom();
}

/* ══ helpers ══ */
function _g(id) { return (document.getElementById(id)?.value||'').trim(); }

function _storeImg(prefix) {
  if (!_imgBase64) return null;
  const key = prefix + '_' + Date.now();
  try { localStorage.setItem(key, _imgBase64); return key; } catch(e) { return null; }
}

function _list(key) { return JSON.parse(localStorage.getItem(key)||'[]'); }
function _push(key,item) { const l=_list(key); if(_modalEditId){const i=l.findIndex(x=>x.id===_modalEditId);if(i>-1)l[i]=item;else l.push(item);}else l.push(item); localStorage.setItem(key,JSON.stringify(l)); }
function _del(key,id) { localStorage.setItem(key,JSON.stringify(_list(key).filter(x=>x.id!==id))); }

/* ══ Project ══ */
function _saveProject() {
  const name=_g('mName'); if(!name){alert('Title required');return;}
  const imgKey=_storeImg('proj') || (_modalEditId ? _list('projects').find(x=>x.id===_modalEditId)?.imgKey : null);
  const item={id:_modalEditId||'p'+Date.now(),tag:_g('mTag'),name,desc:_g('mDesc'),url:_g('mUrl'),imgKey,tags:_modalTags};
  _push('projects',item);
  if(_modalEditId) _updateProjectEl(item); else _renderProject(item);
  closeAddModal();
}

function _renderProject(item) {
  const grid=document.getElementById('projGrid'); if(!grid) return;
  const imgSrc=item.imgKey?localStorage.getItem(item.imgKey):null;
  const thumb=imgSrc
    ?`<img src="${imgSrc}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;">`
    :`<svg width="80" height="80" viewBox="0 0 80 80"><rect x="10" y="10" width="60" height="60" fill="none" stroke="#00f5ff" stroke-width="1.5" opacity=".4"/><circle cx="40" cy="40" r="12" fill="none" stroke="#00f5ff" stroke-width="1.5"/><circle cx="40" cy="40" r="4" fill="#00f5ff"/></svg>`;
  const tagsHtml=(item.tags||[]).map(t=>`<span class="pstag ${t.color}">${t.text}</span>`).join('');
  const el=document.createElement('div');
  el.className='proj-card'; el.setAttribute('data-id',item.id);
  el.innerHTML=`
    <div class="proj-thumb" style="background:#07101a;">${thumb}</div>
    <div class="proj-body">
      <div class="item-actions">
        <button class="act-btn upd" onclick='editProject("${item.id}")'>✎ EDIT</button>
        <button class="act-btn del" onclick='deleteProject("${item.id}",this)'>✕ DELETE</button>
      </div>
      <div class="proj-tag" data-editable="ptag_${item.id}">${item.tag||'PROJECT'}</div>
      <div class="proj-name" data-editable="pname_${item.id}">${item.name}</div>
      <p class="proj-desc" data-editable="pdesc_${item.id}">${item.desc||''}</p>
      <div class="proj-stack">${tagsHtml}</div>
      <div class="proj-links">${item.url?`<a href="${item.url}" target="_blank" class="proj-link">↗ LIVE</a>`:''}</div>
    </div>`;
  el.addEventListener('click', e=>{
    if(e.target.closest('.item-actions')||EDIT_MODE&&e.target.hasAttribute('data-editable')) return;
    openPanel({tag:item.tag,title:item.name,desc:item.desc,img:imgSrc,tags:item.tags||[],rows:{'URL':item.url||'—'}});
  });
  _bindNew(el); grid.appendChild(el);
}

function _updateProjectEl(item) {
  const el=document.querySelector(`.proj-card[data-id="${item.id}"]`); if(!el) return;
  el.remove(); _renderProject(item);
}

function editProject(id) {
  const item=_list('projects').find(x=>x.id===id); if(!item) return;
  openAddModal('project',item);
}

function deleteProject(id,btn) {
  if(!EDIT_MODE) return;
  if(!confirm('Delete this project?')) return;
  btn.closest('.proj-card')?.remove(); _del('projects',id);
}

/* ══ Experience ══ */
function _saveExperience() {
  const role=_g('mRole'); if(!role){alert('Role required');return;}
  const item={id:_modalEditId||'e'+Date.now(),period:_g('mPeriod'),role,company:_g('mCompany'),desc:_g('mExpDesc')};
  _push('experiences',item);
  if(_modalEditId) _updateExpEl(item); else _renderExp(item);
  closeAddModal();
}

function _renderExp(item) {
  const tl=document.getElementById('timelineContainer'); if(!tl) return;
  const el=document.createElement('div');
  el.className='tl-item'; el.setAttribute('data-id',item.id);
  el.innerHTML=`
    <div class="item-actions">
      <button class="act-btn upd" onclick='editExp("${item.id}")'>✎ EDIT</button>
      <button class="act-btn del" onclick='deleteExp("${item.id}",this)'>✕ DELETE</button>
    </div>
    <div class="tl-period"  data-editable="eperiod_${item.id}">${item.period||'ONGOING'}</div>
    <div class="tl-role"    data-editable="erole_${item.id}">${item.role}</div>
    <div class="tl-company" data-editable="ecomp_${item.id}">${item.company||''}</div>
    <p class="tl-desc"      data-editable="edesc_${item.id}">${item.desc||''}</p>`;
  el.addEventListener('click', e=>{
    if(e.target.closest('.item-actions')) return;
    openPanel({tag:item.period,title:item.role,desc:item.desc,rows:{'Company':item.company||'—','Period':item.period||'—'}});
  });
  _bindNew(el); tl.appendChild(el);
}

function _updateExpEl(item){const el=document.querySelector(`.tl-item[data-id="${item.id}"]`);if(el){el.remove();_renderExp(item);}}
function editExp(id){const item=_list('experiences').find(x=>x.id===id);if(item)openAddModal('experience',item);}
function deleteExp(id,btn){if(!EDIT_MODE)return;if(!confirm('Delete?'))return;btn.closest('.tl-item')?.remove();_del('experiences',id);}

/* ══ Skill ══ */
function _saveSkill() {
  const name=_g('mSkillName'); if(!name){alert('Name required');return;}
  const pct=Math.min(100,Math.max(0,parseInt(document.getElementById('mSkillPct')?.value)||70));
  const item={id:_modalEditId||'s'+Date.now(),name,pct};
  _push('skills',item);
  if(_modalEditId) _updateSkillEl(item); else _renderSkill(item);
  closeAddModal();
}

function _renderSkill(item) {
  const grid=document.getElementById('skillsGrid'); if(!grid) return;
  const cols=['linear-gradient(to right,var(--cyan),var(--purple))','linear-gradient(to right,var(--pink),var(--purple))','linear-gradient(to right,var(--green),var(--cyan))'];
  const col=cols[Math.floor(Math.random()*cols.length)];
  const el=document.createElement('div');
  el.className='skill-item'; el.setAttribute('data-id',item.id);
  el.innerHTML=`
    <div class="item-actions">
      <button class="act-btn upd" onclick='editSkill("${item.id}")'>✎ EDIT</button>
      <button class="act-btn del" onclick='deleteSkill("${item.id}",this)'>✕ DELETE</button>
    </div>
    <div class="sk-top">
      <span class="sk-name" data-editable="sname_${item.id}">${item.name}</span>
      <span class="sk-pct"  data-editable="spct_${item.id}">${item.pct}%</span>
    </div>
    <div class="sk-bar"><div class="sk-fill" style="width:${item.pct}%;background:${col}"></div></div>`;
  el.addEventListener('click',e=>{
    if(e.target.closest('.item-actions')) return;
    openPanel({tag:'SKILL',title:item.name,desc:`Proficiency: ${item.pct}%`,rows:{'Level':item.pct+'%'}});
  });
  _bindNew(el); grid.appendChild(el);
}

function _updateSkillEl(item){const el=document.querySelector(`.skill-item[data-id="${item.id}"]`);if(el){el.remove();_renderSkill(item);}}
function editSkill(id){const item=_list('skills').find(x=>x.id===id);if(item)openAddModal('skill',item);}
function deleteSkill(id,btn){if(!EDIT_MODE)return;if(!confirm('Delete?'))return;btn.closest('.skill-item')?.remove();_del('skills',id);}

/* ══ Service ══ */
function _saveService() {
  const title=_g('mSvcTitle'); if(!title){alert('Title required');return;}
  const imgKey=_storeImg('svc') || (_modalEditId?_list('services').find(x=>x.id===_modalEditId)?.imgKey:null);
  const item={id:_modalEditId||'sv'+Date.now(),icon:_g('mSvcIcon')||'⚡',title,desc:_g('mSvcDesc'),note:_g('mSvcNote'),tags:_modalTags,imgKey};
  _push('services',item);
  if(_modalEditId) _updateSvcEl(item); else _renderService(item);
  closeAddModal();
}

function _renderService(item) {
  const grid=document.getElementById('svcGrid'); if(!grid) return;
  const colors=['c1','c2','c3','c4','c5','c6'];
  const col=colors[grid.children.length%6];
  const tagsHtml=(item.tags||[]).map(t=>`<span class="pstag ${t.color}">${t.text}</span>`).join('');
  const imgSrc=item.imgKey?localStorage.getItem(item.imgKey):null;
  const el=document.createElement('div');
  el.className=`svc-card ${col}`; el.setAttribute('data-id',item.id);
  el.innerHTML=`
    <div class="item-actions">
      <button class="act-btn upd" onclick='editService("${item.id}")'>✎ EDIT</button>
      <button class="act-btn del" onclick='deleteService("${item.id}",this)'>✕ DELETE</button>
    </div>
    ${imgSrc?`<img src="${imgSrc}" alt="${item.title}" style="width:100%;height:130px;object-fit:cover;margin-bottom:14px;border:1px solid var(--border);">`:''}
    <span class="svc-icon" data-editable="sicon_${item.id}">${item.icon}</span>
    <div class="svc-title" data-editable="stitle_${item.id}">${item.title}</div>
    <p class="svc-desc"   data-editable="sdesc_${item.id}">${item.desc||''}</p>
    <div class="svc-tags">${tagsHtml}</div>
    <div class="svc-price" data-editable="snote_${item.id}">${item.note||''}</div>`;
  el.addEventListener('click',e=>{
    if(e.target.closest('.item-actions')) return;
    openPanel({tag:'SERVICE',title:item.title,desc:item.desc,img:imgSrc,tags:item.tags||[]});
  });
  _bindNew(el); grid.appendChild(el);
}

function _updateSvcEl(item){const el=document.querySelector(`.svc-card[data-id="${item.id}"]`);if(el){el.remove();_renderService(item);}}
function editService(id){const item=_list('services').find(x=>x.id===id);if(item)openAddModal('service',item);}
function deleteService(id,btn){if(!EDIT_MODE)return;if(!confirm('Delete?'))return;btn.closest('.svc-card')?.remove();_del('services',id);}

/* ══ Certificate ══ */
function _saveCert() {
  const name=_g('mCertName'); if(!name){alert('Name required');return;}
  const item={id:_modalEditId||'c'+Date.now(),name,src:_g('mCertSrc'),color:_tagColor};
  _push('certs',item);
  if(_modalEditId) _updateCertEl(item); else _renderCert(item);
  closeAddModal();
}

function _renderCert(item) {
  const cont=document.getElementById('certContainer'); if(!cont) return;
  const colMap={cyan:'var(--cyan)',pink:'var(--pink)',purple:'var(--purple)'};
  const c=colMap[item.color]||'var(--cyan)';
  const el=document.createElement('div');
  el.className='cert-card'; el.setAttribute('data-id',item.id);
  el.style.cssText=`--cert-c:${c}`;
  el.innerHTML=`
    <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${c};box-shadow:0 0 8px ${c};"></div>
    <div class="item-actions">
      <button class="act-btn upd" onclick='editCert("${item.id}")'>✎ EDIT</button>
      <button class="act-btn del" onclick='deleteCert("${item.id}",this)'>✕ DELETE</button>
    </div>
    <div class="cert-card-name" data-editable="cname_${item.id}">${item.name}</div>
    <div class="cert-card-src" style="color:${c};" data-editable="csrc_${item.id}">${item.src||''}</div>`;
  el.addEventListener('click',e=>{
    if(e.target.closest('.item-actions')) return;
    openPanel({tag:'CERTIFICATE',title:item.name,desc:'',rows:{'Issuer':item.src||'—'}});
  });
  _bindNew(el); cont.appendChild(el);
}

function _updateCertEl(item){const el=document.querySelector(`.cert-card[data-id="${item.id}"]`);if(el){el.remove();_renderCert(item);}}
function editCert(id){const item=_list('certs').find(x=>x.id===id);if(item)openAddModal('cert',item);}
function deleteCert(id,btn){if(!EDIT_MODE)return;if(!confirm('Delete?'))return;btn.closest('.cert-card')?.remove();_del('certs',id);}

/* ══ Education ══ */
function _saveEdu() {
  const deg=_g('mEduDeg'); if(!deg){alert('Degree required');return;}
  const item={id:_modalEditId||'ed'+Date.now(),year:_g('mEduYear'),degree:deg,inst:_g('mEduInst'),note:_g('mEduNote')};
  _push('edus',item);
  if(_modalEditId) _updateEduEl(item); else _renderEdu(item);
  closeAddModal();
}

function _renderEdu(item) {
  const cont=document.getElementById('eduContainer'); if(!cont) return;
  const el=document.createElement('div');
  el.className='edu-card'; el.setAttribute('data-id',item.id);
  el.innerHTML=`
    <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(to right,var(--cyan),var(--purple));"></div>
    <div class="item-actions">
      <button class="act-btn upd" onclick='editEdu("${item.id}")'>✎ EDIT</button>
      <button class="act-btn del" onclick='deleteEdu("${item.id}",this)'>✕ DELETE</button>
    </div>
    <div class="edu-year"   data-editable="eyear_${item.id}">${item.year||''}</div>
    <div class="edu-degree" data-editable="edeg_${item.id}">${item.degree}</div>
    <div class="edu-inst"   data-editable="einst_${item.id}">${item.inst||''}</div>
    <div class="edu-note"   data-editable="enote_${item.id}">${item.note||''}</div>`;
  el.addEventListener('click',e=>{
    if(e.target.closest('.item-actions')) return;
    openPanel({tag:'EDUCATION',title:item.degree,desc:item.note,rows:{'Institution':item.inst||'—','Period':item.year||'—'}});
  });
  _bindNew(el); cont.appendChild(el);
}

function _updateEduEl(item){const el=document.querySelector(`.edu-card[data-id="${item.id}"]`);if(el){el.remove();_renderEdu(item);}}
function editEdu(id){const item=_list('edus').find(x=>x.id===id);if(item)openAddModal('edu',item);}
function deleteEdu(id,btn){if(!EDIT_MODE)return;if(!confirm('Delete?'))return;btn.closest('.edu-card')?.remove();_del('edus',id);}

/* ══ Hobby ══ */
function _saveHobby() {
  const name=_g('mHobbyName'); if(!name){alert('Name required');return;}
  const item={id:_modalEditId||'h'+Date.now(),icon:_g('mHobbyIcon')||'⭐',name};
  _push('hobbies',item);
  if(_modalEditId) _updateHobbyEl(item); else _renderHobby(item);
  closeAddModal();
}

function _renderHobby(item) {
  const cont=document.getElementById('hobbiesContainer'); if(!cont) return;
  const el=document.createElement('div');
  el.className='hobby-card'; el.setAttribute('data-id',item.id);
  el.innerHTML=`
    <div class="item-actions" style="justify-content:center;">
      <button class="act-btn del" onclick='deleteHobby("${item.id}",this)'>✕</button>
    </div>
    <span class="hobby-icon" data-editable="hicon_${item.id}">${item.icon}</span>
    <div class="hobby-name" data-editable="hname_${item.id}">${item.name}</div>`;
  _bindNew(el); cont.appendChild(el);
}

function deleteHobby(id,btn){if(!EDIT_MODE)return;if(!confirm('Delete?'))return;btn.closest('.hobby-card')?.remove();_del('hobbies',id);}

/* ══ Custom slot ══ */
function _saveCustom() {
  const name=_g('mCustomTitle'); if(!name){alert('Title required');return;}
  const imgKey=_storeImg('cus') || (_modalEditId?_list('customs').find(x=>x.id===_modalEditId)?.imgKey:null);
  const item={id:_modalEditId||'cu'+Date.now(),name,desc:_g('mCustomDesc'),tags:_modalTags,imgKey};
  _push('customs',item);
  if(_modalEditId) _updateCustomEl(item); else _renderCustom(item);
  closeAddModal();
}

function _renderCustom(item) {
  const grid=document.getElementById('customGrid'); if(!grid) return;
  const imgSrc=item.imgKey?localStorage.getItem(item.imgKey):null;
  const tagsHtml=(item.tags||[]).map(t=>`<span class="pstag ${t.color}">${t.text}</span>`).join('');
  const el=document.createElement('div');
  el.className='custom-slot'; el.setAttribute('data-id',item.id);
  el.innerHTML=`
    <div class="item-actions">
      <button class="act-btn upd" onclick='editCustom("${item.id}")'>✎ EDIT</button>
      <button class="act-btn del" onclick='deleteCustom("${item.id}",this)'>✕ DELETE</button>
    </div>
    ${imgSrc?`<div class="slot-img"><img src="${imgSrc}" alt="${item.name}"></div>`:''}
    <div class="proj-name" data-editable="csname_${item.id}">${item.name}</div>
    <p class="proj-desc"   data-editable="csdesc_${item.id}">${item.desc||''}</p>
    <div class="proj-stack">${tagsHtml}</div>`;
  el.addEventListener('click',e=>{
    if(e.target.closest('.item-actions')) return;
    openPanel({tag:'PROJECT',title:item.name,desc:item.desc,img:imgSrc,tags:item.tags||[]});
  });
  _bindNew(el); grid.appendChild(el);
}

function _updateCustomEl(item){const el=document.querySelector(`.custom-slot[data-id="${item.id}"]`);if(el){el.remove();_renderCustom(item);}}
function editCustom(id){const item=_list('customs').find(x=>x.id===id);if(item)openAddModal('custom',item);}
function deleteCustom(id,btn){if(!EDIT_MODE)return;if(!confirm('Delete?'))return;btn.closest('.custom-slot')?.remove();_del('customs',id);}

/* ── bind editable fields to newly created elements ── */
function _bindNew(el) {
  if (EDIT_MODE) {
    el.querySelectorAll('[data-editable]').forEach(e => {
      e.contentEditable='true';
      e.addEventListener('input',_saveEditable);
    });
  }
}

/* ═══════════════════════════════════════════════════════
   LOAD SAVED DATA
═══════════════════════════════════════════════════════ */
function loadSaved(page) {
  if (page==='projects') {
    _list('projects').forEach(_renderProject);
    _list('customs').forEach(_renderCustom);
  }
  if (page==='experience') {
    _list('experiences').forEach(_renderExp);
    _list('skills').forEach(_renderSkill);
    _list('certs').forEach(_renderCert);
    _list('edus').forEach(_renderEdu);
  }
  if (page==='about') {
    _list('hobbies').forEach(_renderHobby);
  }
  if (page==='services') {
    _list('services').forEach(_renderService);
  }
  if (page==='index') {
    _list('edus').forEach(_renderEdu);
  }
}

/* ═══════════════════════════════════════════════════════
   CONTACT FORM — Web3Forms (real email delivery)
═══════════════════════════════════════════════════════ */
async function handleFormSubmit(e) {
  e.preventDefault();
  const form   = document.getElementById('contactForm');
  const btn    = document.getElementById('submitBtn');
  const smsg   = document.getElementById('smsg');
  const errmsg = document.getElementById('errmsg');

  btn.disabled = true;
  btn.querySelector('span').textContent = '// SENDING...';
  smsg.style.display   = 'none';
  errmsg.style.display = 'none';

  try {
    const res  = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      body: new FormData(form)
    });
    const data = await res.json();

    if (data.success) {
      smsg.style.display = 'block';
      form.reset();
    } else {
      errmsg.style.display = 'block';
    }
  } catch (err) {
    errmsg.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = '↗ SEND MESSAGE';
  }
}

/* legacy stub so old pages don't throw errors */
function sendForm() { handleFormSubmit({ preventDefault: ()=>{} }); }

/* ═══════════════════════════════════════════════════════
   PHOTO UPDATE (about page)
═══════════════════════════════════════════════════════ */
function triggerPhotoUpload() {
  if (!EDIT_MODE) return;
  document.getElementById('photoFileInput')?.click();
}

function handlePhotoUpload(input) {
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    const src=e.target.result;
    localStorage.setItem('profile_photo',src);
    _applyPhoto(src);
  };
  reader.readAsDataURL(file);
}

function _applyPhoto(src) {
  const wrap=document.getElementById('avPhotoWrap');
  if(!wrap) return;
  wrap.innerHTML=`<img src="${src}" alt="M.Fahad" style="width:100%;height:100%;border-radius:50%;object-fit:cover;object-position:top;border:2px solid var(--cyan);box-shadow:0 0 36px rgba(0,245,255,0.3);">`;
}

/* ═══════════════════════════════════════════════════════
   MAIN INIT
═══════════════════════════════════════════════════════ */
function portfolioInit(page) {
  _initHash();
  initNav(page);
  initCursor();
  _restoreEdits();
  loadSaved(page);

  // if session already active, restore edit mode
  if (isLoggedIn()) enableEditMode();

  // restore profile photo
  const ph=localStorage.getItem('profile_photo');
  if(ph) _applyPhoto(ph);

  // button bindings — Edit button is ONLY in footer
  document.getElementById('footerEditBtn')?.addEventListener('click', toggleEditMode);
  document.getElementById('loginSubmitBtn')?.addEventListener('click', attemptLogin);
  document.getElementById('loginCancelBtn')?.addEventListener('click', hideLogin);
  document.getElementById('modalSaveBtn')?.addEventListener('click', saveModalItem);
  document.getElementById('modalCancelBtn')?.addEventListener('click', closeAddModal);
  document.getElementById('dpCloseBtn')?.addEventListener('click', closePanel);

  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){hideLogin();closeAddModal();closePanel();}
    if(e.key==='Enter'&&document.getElementById('loginOverlay')?.classList.contains('show')) attemptLogin();
  });

  // static card click for detail panel
  document.querySelectorAll('.proj-card:not([data-id])').forEach(card=>{
    card.addEventListener('click', e=>{
      if(e.target.closest('.item-actions')||EDIT_MODE&&e.target.hasAttribute('data-editable')) return;
      const name=card.querySelector('.proj-name')?.textContent||'';
      const desc=card.querySelector('.proj-desc')?.textContent||'';
      const tag =card.querySelector('.proj-tag')?.textContent||'';
      const img =card.querySelector('.proj-thumb img');
      const tags=[...card.querySelectorAll('.pstag')].map(t=>({text:t.textContent,color:t.className.replace('pstag','').trim()}));
      const url =card.querySelector('.proj-link')?.href||'';
      openPanel({tag,title:name,desc,img:img?.src,tags,rows:{'URL':url||'—'}});
    });
  });

  document.querySelectorAll('.cert-card:not([data-id])').forEach(c=>{
    c.addEventListener('click',()=>{
      openPanel({tag:'CERTIFICATE',title:c.querySelector('.cert-card-name')?.textContent||'',desc:'',rows:{'Issuer':c.querySelector('.cert-card-src')?.textContent||'—'}});
    });
  });

  document.querySelectorAll('.skill-item:not([data-id])').forEach(s=>{
    s.addEventListener('click',e=>{
      if(e.target.closest('.item-actions')) return;
      openPanel({tag:'SKILL',title:s.querySelector('.sk-name')?.textContent||'',desc:'',rows:{'Proficiency':s.querySelector('.sk-pct')?.textContent||'—'}});
    });
  });

  document.querySelectorAll('.svc-card:not([data-id])').forEach(s=>{
    s.addEventListener('click',e=>{
      if(e.target.closest('.item-actions')) return;
      openPanel({tag:'SERVICE',title:s.querySelector('.svc-title')?.textContent||'',desc:s.querySelector('.svc-desc')?.textContent||''});
    });
  });

  document.querySelectorAll('.tl-item:not([data-id])').forEach(t=>{
    t.addEventListener('click',e=>{
      if(e.target.closest('.item-actions')) return;
      openPanel({tag:t.querySelector('.tl-period')?.textContent||'',title:t.querySelector('.tl-role')?.textContent||'',desc:t.querySelector('.tl-desc')?.textContent||'',rows:{'Company':t.querySelector('.tl-company')?.textContent||'—'}});
    });
  });

  document.querySelectorAll('.edu-card:not([data-id])').forEach(e=>{
    e.addEventListener('click',()=>{
      openPanel({tag:'EDUCATION',title:e.querySelector('.edu-degree')?.textContent||'',desc:e.querySelector('.edu-note')?.textContent||'',rows:{'Institution':e.querySelector('.edu-inst')?.textContent||'—','Period':e.querySelector('.edu-year')?.textContent||'—'}});
    });
  });
}
