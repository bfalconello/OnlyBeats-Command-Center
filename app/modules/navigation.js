'use strict';

// Sidebar navigation and transient UI cleanup.

function renderNav(){$('nav').innerHTML=pages.map(([id,i,l])=>`<button class="nav-button ${id===currentPage?'active':''}" data-page="${id}"><span class="nav-icon">${i}</span>${l}</button>`).join('');document.querySelectorAll('.nav-button').forEach(b=>b.onclick=()=>navigate(b.dataset.page))}

function closeTransientUi(){
  try{$('gameDrawerBackdrop')?.classList.add('hidden')}catch{}
  try{$('gameDrawer')?.classList.remove('open')}catch{}
  try{$('focusBackdrop')?.classList.add('hidden')}catch{}
  try{$('focusModal')?.classList.remove('open')}catch{}
  try{$('notificationPanel')?.classList.add('hidden')}catch{}
  try{$('commandPalette')?.classList.add('hidden')}catch{}
}

function navigate(page){
  if(!pages.some(p=>p[0]===page))return;
  closeTransientUi();
  currentPage=page;
  renderNav();
  renderPage();
}

function setHeading(title,eyebrow='ONLYBEATS COMMAND CENTER'){$('sectionTitle').textContent=title;$('sectionEyebrow').textContent=eyebrow}
