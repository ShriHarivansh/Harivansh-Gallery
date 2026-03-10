'use strict';

const PROFILE_KEY = 'h_profile';
const POSTS_KEY   = 'h_posts';
const MAX_CHARS   = 500;
const MAX_IMG_PX  = 1200;
const IMG_QUALITY = 0.82;
const MAX_POSTS   = 500;

let profile = null, posts = [], composerImage = null, activeMenu = null;

// ── STORAGE ────────────────────────────────────────────────────────────────
const store = {
  getProfile() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null'); } catch { return null; } },
  setProfile(p) { try { localStorage.setItem(PROFILE_KEY,JSON.stringify(p)); return true; } catch { showToast('Storage full'); return false; } },
  getPosts() { try { return JSON.parse(localStorage.getItem(POSTS_KEY)||'[]'); } catch { return []; } },
  setPosts(arr) {
    try { localStorage.setItem(POSTS_KEY,JSON.stringify(arr)); return true; }
    catch {
      const copy = arr.slice();
      for (let i = copy.length-1; i >= 0; i--) {
        if (copy[i].image) { copy[i].image = null; try { localStorage.setItem(POSTS_KEY,JSON.stringify(copy)); showToast('Storage full — some images removed'); return true; } catch {} }
      }
      return false;
    }
  }
};

// ── HELPERS ────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function formatDate(ts) {
  try {
    const d=new Date(ts);
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+' · '+d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
  } catch { return ''; }
}
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function makeAvatarEl(p, cls) {
  const wrap = document.createElement('div');
  wrap.className = 'avatar '+(cls||'avatar-md');
  if (p && p.avatar) {
    const img = document.createElement('img');
    img.src = p.avatar; img.alt = p.name||''; wrap.appendChild(img);
  } else {
    wrap.classList.add('avatar-placeholder');
    wrap.textContent = (p&&p.name) ? p.name.charAt(0).toUpperCase() : '?';
  }
  return wrap;
}

function showToast(msg, ms) {
  const wrap = document.getElementById('toastContainer'); if(!wrap) return;
  const el = document.createElement('div'); el.className='toast'; el.textContent=msg; wrap.appendChild(el);
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),350); }, ms||2400);
}
function showLoading(msg) {
  let el = document.getElementById('loadingOverlay');
  if (!el) { el=document.createElement('div'); el.id='loadingOverlay'; el.innerHTML='<div class="spinner"></div><div class="loading-label"></div>'; document.body.appendChild(el); }
  el.querySelector('.loading-label').textContent = msg||''; el.style.display='flex';
}
function hideLoading() { const el=document.getElementById('loadingOverlay'); if(el) el.style.display='none'; }
function closeAllMenus() { document.querySelectorAll('.dropdown-menu.open').forEach(m=>m.classList.remove('open')); activeMenu=null; }

// ── IMAGE COMPRESSION ───────────────────────────────────────────────────────
function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file||!file.type.startsWith('image/')) return reject(new Error('Not an image'));
    const reader = new FileReader();
    reader.onerror = ()=>reject(new Error('File read failed'));
    reader.onload = ev => {
      const img = new Image();
      img.onerror = ()=>reject(new Error('Could not decode image'));
      img.onload = () => {
        try {
          let w=img.width, h=img.height;
          if (w>MAX_IMG_PX||h>MAX_IMG_PX) {
            if(w>=h){h=Math.round(h/w*MAX_IMG_PX);w=MAX_IMG_PX;}
            else{w=Math.round(w/h*MAX_IMG_PX);h=MAX_IMG_PX;}
          }
          const c=document.createElement('canvas'); c.width=w; c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          let data=c.toDataURL('image/jpeg',IMG_QUALITY);
          if(data.length>700000) data=c.toDataURL('image/jpeg',0.6);
          if(data.length>450000){
            const c2=document.createElement('canvas'); c2.width=Math.round(w/2); c2.height=Math.round(h/2);
            c2.getContext('2d').drawImage(c,0,0,c2.width,c2.height);
            data=c2.toDataURL('image/jpeg',0.7);
          }
          resolve(data);
        } catch(e){reject(e);}
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── ONBOARDING ─────────────────────────────────────────────────────────────
function initOnboarding() {
  const nameInput=document.getElementById('ob-name');
  const handleInput=document.getElementById('ob-handle');
  const avatarInput=document.getElementById('ob-avatar-input');
  const avatarWrap=document.getElementById('ob-avatar-preview');
  const btnStart=document.getElementById('btn-start');
  let avatarData=null;

  document.getElementById('ob-avatar-area').addEventListener('click',()=>avatarInput.click());

  avatarInput.addEventListener('change', async e=>{
    const file=e.target.files[0]; avatarInput.value=''; if(!file) return;
    try { showLoading('Processing photo…'); avatarData=await compressImage(file); avatarWrap.innerHTML=''; const img=document.createElement('img'); img.src=avatarData; img.alt='Preview'; avatarWrap.appendChild(img); }
    catch(err){ showToast('Photo error: '+err.message); avatarData=null; }
    finally{ hideLoading(); }
  });

  handleInput.addEventListener('input',()=>{
    const v=handleInput.value;
    if(v&&!v.startsWith('@')){ const p=handleInput.selectionStart+1; handleInput.value='@'+v; handleInput.setSelectionRange(p,p); }
  });
  nameInput.addEventListener('keydown',e=>{ if(e.key==='Enter') handleInput.focus(); });
  handleInput.addEventListener('keydown',e=>{ if(e.key==='Enter') btnStart.click(); });

  btnStart.addEventListener('click',()=>{
    const name=nameInput.value.trim(); let handle=handleInput.value.trim();
    if(!name){showToast('Enter your name');return;}
    if(!handle||handle==='@'){showToast('Enter a username');return;}
    if(!handle.startsWith('@')) handle='@'+handle;
    handle='@'+handle.slice(1).replace(/[^A-Za-z0-9_]/g,'_').slice(0,25);
    profile={name:name.slice(0,60),handle,avatar:avatarData};
    if(!store.setProfile(profile)) return;
    document.getElementById('onboarding').style.display='none';
    showApp();
  });
}

// ── SHOW APP ──────────────────────────────────────────────────────────────
function showApp() {
  const app=document.getElementById('app');
  app.style.display='flex';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ app.style.opacity='1'; }));
  renderProfile(); renderFeed();
}

// ── PROFILE ───────────────────────────────────────────────────────────────
function renderProfile() {
  if(!profile) return;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v||'';};
  set('sidebar-name',profile.name); set('sidebar-handle',profile.handle);
  set('stat-handle',profile.handle); set('stat-name',profile.name);
  const setAv=(id,cls)=>{const c=document.getElementById(id);if(!c)return;c.innerHTML='';c.appendChild(makeAvatarEl(profile,cls));};
  setAv('sidebar-avatar','avatar-sm'); setAv('composer-avatar','avatar-md');
}

// ── COMPOSER ──────────────────────────────────────────────────────────────
function initComposer() {
  const textarea=document.getElementById('post-text');
  const charCount=document.getElementById('char-count');
  const btnPost=document.getElementById('btn-post');
  const imgInput=document.getElementById('img-input');
  const imgWrap=document.getElementById('img-preview-wrap');
  const imgEl=document.getElementById('img-preview');

  function syncCounter() {
    const rem=MAX_CHARS-textarea.value.length;
    charCount.textContent=rem;
    const bar=charCount.closest('.char-counter');
    bar.classList.toggle('warning',rem<20&&rem>=0);
    bar.classList.toggle('over',rem<0);
    btnPost.disabled=(!textarea.value.trim()&&!composerImage)||rem<0;
  }

  textarea.addEventListener('input',()=>{ syncCounter(); textarea.style.height='auto'; textarea.style.height=Math.min(textarea.scrollHeight,400)+'px'; });
  document.getElementById('btn-img').addEventListener('click',()=>imgInput.click());

  imgInput.addEventListener('change',async e=>{
    const file=e.target.files[0]; imgInput.value=''; if(!file) return;
    try{ showLoading('Compressing…'); composerImage=await compressImage(file); imgEl.src=composerImage; imgWrap.style.display='block'; btnPost.disabled=false; }
    catch(err){ showToast('Image error: '+err.message); composerImage=null; }
    finally{ hideLoading(); }
  });

  document.getElementById('remove-img').addEventListener('click',()=>{ composerImage=null; imgWrap.style.display='none'; imgEl.src=''; syncCounter(); });
  btnPost.addEventListener('click',submitPost);
  textarea.addEventListener('keydown',e=>{ if((e.ctrlKey||e.metaKey)&&e.key==='Enter') submitPost(); });
}

function submitPost() {
  const textarea=document.getElementById('post-text');
  const text=textarea.value.trim();
  if(!text&&!composerImage) return;
  if(text.length>MAX_CHARS){showToast('Post too long');return;}

  const post={id:uid(),text,image:composerImage,ts:Date.now()};
  posts.unshift(post); if(posts.length>MAX_POSTS) posts.length=MAX_POSTS;
  store.setPosts(posts);

  textarea.value=''; textarea.style.height=''; composerImage=null;
  document.getElementById('img-preview-wrap').style.display='none';
  document.getElementById('img-preview').src='';
  document.getElementById('char-count').textContent=MAX_CHARS;
  const bar=document.getElementById('char-count').closest('.char-counter');
  bar.classList.remove('warning','over');
  document.getElementById('btn-post').disabled=true;

  prependPostToDOM(post); updateStats(); showToast('Posted ✓');
}

// ── FEED ──────────────────────────────────────────────────────────────────
function renderFeed() {
  const feed=document.getElementById('feed'); feed.innerHTML='';
  if(!posts.length){
    const div=document.createElement('div'); div.className='empty-state';
    div.innerHTML='<div class="empty-state-icon">✦</div><div class="empty-state-title">Nothing here yet</div><div class="empty-state-sub">Write something — only you will see it.</div>';
    feed.appendChild(div); return;
  }
  const frag=document.createDocumentFragment();
  posts.forEach(p=>frag.appendChild(buildPostEl(p)));
  feed.appendChild(frag); updateStats();
}

function prependPostToDOM(post) {
  const feed=document.getElementById('feed');
  const empty=feed.querySelector('.empty-state'); if(empty) empty.remove();
  feed.insertBefore(buildPostEl(post),feed.firstChild); updateStats();
}

function buildPostEl(post) {
  const el=document.createElement('article'); el.className='post'; el.dataset.id=post.id;
  el.appendChild(makeAvatarEl(profile,'avatar-md'));

  const content=document.createElement('div'); content.className='post-content';
  const header=document.createElement('div'); header.className='post-header';
  header.innerHTML=`<span class="post-name">${escHtml(profile.name)}</span><span class="post-handle">${escHtml(profile.handle)}</span><span class="post-dot">·</span><span class="post-date">${escHtml(formatDate(post.ts))}</span>`;
  content.appendChild(header);

  if(post.text){const p=document.createElement('p');p.className='post-text';p.textContent=post.text;content.appendChild(p);}
  if(post.image){
    const iw=document.createElement('div');iw.className='post-image';
    const img=document.createElement('img');img.loading='lazy';img.alt='Post image';img.src=post.image;
    img.onerror=()=>iw.remove(); iw.appendChild(img); content.appendChild(iw);
  }
  el.appendChild(content);

  const menuWrap=document.createElement('div'); menuWrap.className='post-menu-wrap';
  const trigger=document.createElement('button'); trigger.className='menu-trigger'; trigger.setAttribute('aria-label','More options');
  trigger.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
  const menu=document.createElement('div'); menu.className='dropdown-menu';
  const delBtn=document.createElement('button'); delBtn.className='menu-item danger';
  delBtn.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Delete post';
  menu.appendChild(delBtn); menuWrap.appendChild(trigger); menuWrap.appendChild(menu); el.appendChild(menuWrap);

  trigger.addEventListener('click',e=>{
    e.stopPropagation();
    const isOpen=menu.classList.contains('open'); closeAllMenus();
    if(!isOpen){menu.classList.add('open');activeMenu=menu;}
  });
  delBtn.addEventListener('click',e=>{e.stopPropagation();closeAllMenus();confirmDelete(post.id,el);});
  return el;
}

// ── DELETE ────────────────────────────────────────────────────────────────
function confirmDelete(postId,el) {
  const overlay=document.createElement('div'); overlay.className='confirm-overlay';
  overlay.innerHTML='<div class="confirm-card"><div class="confirm-title">Delete post?</div><div class="confirm-body">Permanently removed from your device.</div><div class="confirm-actions"><button class="btn-cancel">Cancel</button><button class="btn-confirm-delete">Delete</button></div></div>';
  document.body.appendChild(overlay);
  const onKey=e=>{if(e.key==='Escape')dismiss();};
  const dismiss=()=>{overlay.remove();document.removeEventListener('keydown',onKey);};
  document.addEventListener('keydown',onKey);
  overlay.querySelector('.btn-cancel').addEventListener('click',dismiss);
  overlay.addEventListener('click',e=>{if(e.target===overlay)dismiss();});
  overlay.querySelector('.btn-confirm-delete').addEventListener('click',()=>{
    posts=posts.filter(p=>p.id!==postId); store.setPosts(posts);
    el.style.transition='opacity .2s,transform .2s'; el.style.opacity='0'; el.style.transform='translateX(20px)';
    setTimeout(()=>{el.remove();if(!document.getElementById('feed').children.length)renderFeed();updateStats();},220);
    dismiss(); showToast('Post deleted');
  });
}

function updateStats(){const el=document.getElementById('stat-posts');if(el)el.textContent=posts.length;}

document.addEventListener('click',e=>{if(activeMenu){const w=activeMenu.closest('.post-menu-wrap');if(w&&!w.contains(e.target))closeAllMenus();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAllMenus();});

let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;const b=document.getElementById('install-btn');if(b)b.style.display='flex';});
window.addEventListener('appinstalled',()=>{const b=document.getElementById('install-btn');if(b)b.style.display='none';deferredPrompt=null;showToast('H installed!');});

function init() {
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  profile=store.getProfile(); posts=store.getPosts();
  if(!Array.isArray(posts)) posts=[];

  const app=document.getElementById('app');
  app.style.cssText='display:none;opacity:0;transition:opacity 0.35s ease;';

  if(profile&&profile.name&&profile.handle){
    document.getElementById('onboarding').style.display='none';
    showApp();
  }
  initOnboarding(); initComposer();

  const installBtn=document.getElementById('install-btn');
  if(installBtn){
    installBtn.addEventListener('click',async()=>{
      if(!deferredPrompt){showToast('Open in browser to install');return;}
      try{await deferredPrompt.prompt();const{outcome}=await deferredPrompt.userChoice;deferredPrompt=null;if(outcome==='accepted')showToast('Installing…');}catch{}
    });
  }
}
document.addEventListener('DOMContentLoaded',init);
