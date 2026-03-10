'use strict';

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const PROFILE_KEY = 'h_profile';
const POSTS_KEY   = 'h_posts';
const MAX_CHARS   = 500;

// ── STATE ──────────────────────────────────────────────────────────────────
let profile = null;
let posts   = [];
let composerImage = null;
let activeMenu = null;

// ── STORAGE ────────────────────────────────────────────────────────────────
const store = {
  getProfile: () => JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'),
  setProfile: p  => localStorage.setItem(PROFILE_KEY, JSON.stringify(p)),
  getPosts:   () => JSON.parse(localStorage.getItem(POSTS_KEY)   || '[]'),
  setPosts:   a  => localStorage.setItem(POSTS_KEY,   JSON.stringify(a)),
};

// ── HELPERS ─────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' • '
    + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function avatarHTML(p, cls = 'avatar-md') {
  if (p && p.avatar) {
    return `<div class="avatar ${cls}"><img src="${p.avatar}" alt="${escHtml(p.name)}"></div>`;
  }
  const initials = (p && p.name) ? p.name.charAt(0).toUpperCase() : '?';
  return `<div class="avatar avatar-placeholder ${cls}" style="font-size:14px;font-weight:700;color:var(--text-muted)">${initials}</div>`;
}

function showToast(msg) {
  const wrap = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

function closeAllMenus() {
  document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
  activeMenu = null;
}

// ── ONBOARDING ──────────────────────────────────────────────────────────────
function initOnboarding() {
  const onboarding = document.getElementById('onboarding');
  const nameInput  = document.getElementById('ob-name');
  const handleInput= document.getElementById('ob-handle');
  const avatarInput= document.getElementById('ob-avatar-input');
  const avatarPreview = document.getElementById('ob-avatar-preview');
  const btnStart   = document.getElementById('btn-start');

  let avatarData = null;

  document.getElementById('ob-avatar-area').addEventListener('click', () => avatarInput.click());

  avatarInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      avatarData = ev.target.result;
      avatarPreview.innerHTML = `<img src="${avatarData}" alt="Avatar">`;
    };
    reader.readAsDataURL(file);
  });

  // Auto-prefix @ on handle
  handleInput.addEventListener('input', () => {
    let v = handleInput.value;
    if (v && !v.startsWith('@')) {
      handleInput.value = '@' + v;
    }
  });

  btnStart.addEventListener('click', () => {
    const name   = nameInput.value.trim();
    let   handle = handleInput.value.trim();
    if (!name) { showToast('Please enter your name'); return; }
    if (!handle || handle === '@') { showToast('Please enter a username'); return; }
    if (!handle.startsWith('@')) handle = '@' + handle;

    profile = { name, handle, avatar: avatarData };
    store.setProfile(profile);

    onboarding.classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    renderProfile();
    renderFeed();
  });
}

// ── PROFILE RENDER ──────────────────────────────────────────────────────────
function renderProfile() {
  if (!profile) return;
  document.getElementById('sidebar-name').textContent   = profile.name;
  document.getElementById('sidebar-handle').textContent = profile.handle;
  document.getElementById('sidebar-avatar').innerHTML   = avatarHTML(profile, 'avatar-sm');
  document.getElementById('composer-avatar').innerHTML  = avatarHTML(profile, 'avatar-md');

  const stat = document.getElementById('stat-handle');
  if (stat) stat.textContent = profile.handle;
  const statName = document.getElementById('stat-name');
  if (statName) statName.textContent = profile.name;
}

// ── COMPOSER ────────────────────────────────────────────────────────────────
function initComposer() {
  const textarea  = document.getElementById('post-text');
  const charCount = document.getElementById('char-count');
  const btnPost   = document.getElementById('btn-post');
  const imgInput  = document.getElementById('img-input');
  const imgPreviewWrap = document.getElementById('img-preview-wrap');
  const imgPreviewEl   = document.getElementById('img-preview');
  const removeImgBtn   = document.getElementById('remove-img');

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    const remaining = MAX_CHARS - len;
    charCount.textContent = remaining;
    charCount.parentElement.className = 'char-counter'
      + (remaining < 20 ? ' warning' : '')
      + (remaining < 0  ? ' over'    : '');
    btnPost.disabled = (len === 0 && !composerImage) || remaining < 0;
  });

  document.getElementById('btn-img').addEventListener('click', () => imgInput.click());

  imgInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      composerImage = ev.target.result;
      imgPreviewEl.src = composerImage;
      imgPreviewWrap.style.display = 'block';
      btnPost.disabled = false;
    };
    reader.readAsDataURL(file);
    imgInput.value = '';
  });

  removeImgBtn.addEventListener('click', () => {
    composerImage = null;
    imgPreviewWrap.style.display = 'none';
    imgPreviewEl.src = '';
    if (!textarea.value.trim()) btnPost.disabled = true;
  });

  btnPost.addEventListener('click', submitPost);

  textarea.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitPost();
  });
}

function submitPost() {
  const textarea = document.getElementById('post-text');
  const text = textarea.value.trim();
  if (!text && !composerImage) return;
  if (text.length > MAX_CHARS) return;

  const post = {
    id: uid(),
    text,
    image: composerImage,
    ts: Date.now(),
  };

  posts.unshift(post);
  store.setPosts(posts);

  textarea.value = '';
  composerImage = null;
  document.getElementById('img-preview-wrap').style.display = 'none';
  document.getElementById('img-preview').src = '';
  document.getElementById('char-count').textContent = MAX_CHARS;
  document.getElementById('char-count').parentElement.className = 'char-counter';
  document.getElementById('btn-post').disabled = true;

  prependPost(post);
  updateStats();
  showToast('Posted!');
}

// ── FEED ────────────────────────────────────────────────────────────────────
function renderFeed() {
  const feed = document.getElementById('feed');
  feed.innerHTML = '';

  if (posts.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✦</div>
        <div class="empty-state-title">Nothing here yet</div>
        <div class="empty-state-sub">Write something and post it.<br>Only you will see it.</div>
      </div>`;
    return;
  }

  posts.forEach(p => feed.appendChild(buildPostEl(p)));
  updateStats();
}

function prependPost(post) {
  const feed = document.getElementById('feed');
  const empty = feed.querySelector('.empty-state');
  if (empty) empty.remove();
  feed.insertBefore(buildPostEl(post), feed.firstChild);
  updateStats();
}

function buildPostEl(post) {
  const el = document.createElement('article');
  el.className = 'post';
  el.dataset.id = post.id;

  const imageBlock = post.image
    ? `<div class="post-image"><img src="${post.image}" alt="Post image" loading="lazy"></div>`
    : '';

  el.innerHTML = `
    ${avatarHTML(profile, 'avatar-md')}
    <div class="post-content">
      <div class="post-header">
        <span class="post-name">${escHtml(profile.name)}</span>
        <span class="post-handle">${escHtml(profile.handle)}</span>
        <span class="post-dot">·</span>
        <span class="post-date">${formatDate(post.ts)}</span>
      </div>
      ${post.text ? `<p class="post-text">${escHtml(post.text)}</p>` : ''}
      ${imageBlock}
    </div>
    <div class="post-menu-wrap">
      <button class="menu-trigger" title="More options" aria-label="Post options">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
        </svg>
      </button>
      <div class="dropdown-menu">
        <button class="menu-item danger delete-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          Delete post
        </button>
      </div>
    </div>`;

  const trigger = el.querySelector('.menu-trigger');
  const menu    = el.querySelector('.dropdown-menu');

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    if (menu.classList.contains('open')) {
      menu.classList.remove('open');
      activeMenu = null;
    } else {
      closeAllMenus();
      menu.classList.add('open');
      activeMenu = menu;
    }
  });

  el.querySelector('.delete-btn').addEventListener('click', e => {
    e.stopPropagation();
    closeAllMenus();
    confirmDelete(post.id, el);
  });

  return el;
}

// ── DELETE ───────────────────────────────────────────────────────────────────
function confirmDelete(postId, el) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-card">
      <div class="confirm-title">Delete post?</div>
      <div class="confirm-body">This will be removed from your local feed permanently.</div>
      <div class="confirm-actions">
        <button class="btn-cancel">Cancel</button>
        <button class="btn-confirm-delete">Delete</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('.btn-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.btn-confirm-delete').addEventListener('click', () => {
    posts = posts.filter(p => p.id !== postId);
    store.setPosts(posts);
    el.style.transition = 'opacity 0.2s, transform 0.2s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => {
      el.remove();
      if (posts.length === 0) renderFeed();
      updateStats();
    }, 200);
    overlay.remove();
    showToast('Post deleted');
  });

  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });
}

// ── STATS ─────────────────────────────────────────────────────────────────
function updateStats() {
  const el = document.getElementById('stat-posts');
  if (el) el.textContent = posts.length;
}

// ── GLOBAL CLICK ─────────────────────────────────────────────────────────
document.addEventListener('click', e => {
  if (activeMenu && !activeMenu.contains(e.target)) {
    closeAllMenus();
  }
});

// ── PWA INSTALL BUTTON ────────────────────────────────────────────────────
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('install-btn');
  if (btn) { btn.style.display = 'flex'; }
});

window.addEventListener('appinstalled', () => {
  const btn = document.getElementById('install-btn');
  if (btn) btn.style.display = 'none';
  showToast('H installed successfully!');
});

// ── INIT ──────────────────────────────────────────────────────────────────
function init() {
  // Register SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(err => console.warn('SW error:', err));
  }

  profile = store.getProfile();
  posts   = store.getPosts();

  const onboarding = document.getElementById('onboarding');
  const app        = document.getElementById('app');

  if (profile) {
    onboarding.classList.add('hidden');
    app.classList.remove('hidden');
    renderProfile();
    renderFeed();
  } else {
    app.classList.add('hidden');
  }

  initOnboarding();
  initComposer();

  // Install btn
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome === 'accepted') showToast('Installing H…');
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
