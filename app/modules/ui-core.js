'use strict';

// Shared DOM and HTML-template helpers.

function $(id){return document.getElementById(id)}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function metric(label,value,sub){return `<div class="metric"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`}
function card(title,body,cls=''){return `<article class="card ${cls}"><div class="card-head"><h3>${title}</h3></div>${body}</article>`}
function empty(title,copy){return `<div class="empty-state"><div><strong>${title}</strong><p>${copy}</p></div></div>`}
