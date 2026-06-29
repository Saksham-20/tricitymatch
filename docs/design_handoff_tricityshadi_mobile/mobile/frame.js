/* ============================================================ TricityShadi mobile canvas kit
   Injects the icon sprite + helpers to stamp positioned iOS frames on a design canvas. */
(function(){
  const SPRITE = `
<g id="i-home"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></g>
<g id="i-search"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></g>
<g id="i-heart"><path d="M12 20s-7-4.6-9.3-9C1.2 8.3 2.5 5 5.8 5 8 5 9.4 6.4 12 9c2.6-2.6 4-4 6.2-4 3.3 0 4.6 3.3 3.1 6-2.3 4.4-9.3 9-9.3 9z"/></g>
<g id="i-chat"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-5.4A8.4 8.4 0 1 1 21 11.5z"/></g>
<g id="i-user"><circle cx="12" cy="8" r="4"/><path d="M5 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/></g>
<g id="i-bell"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></g>
<g id="i-filter"><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/></g>
<g id="i-sliders"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></g>
<g id="i-shield"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></g>
<g id="i-check"><polyline points="20 6 9 17 4 12"/></g>
<g id="i-lock"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></g>
<g id="i-star"><polygon points="12 3 14.6 8.6 20.5 9.3 16 13.3 17.3 19.2 12 16.1 6.7 19.2 8 13.3 3.5 9.3 9.4 8.6"/></g>
<g id="i-phone"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></g>
<g id="i-video"><rect x="2" y="6" width="14" height="12" rx="2.5"/><path d="m16 10 6-3.5v11L16 14"/></g>
<g id="i-x"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></g>
<g id="i-plus"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></g>
<g id="i-back"><polyline points="15 18 9 12 15 6"/></g>
<g id="i-fwd"><polyline points="9 6 15 12 9 18"/></g>
<g id="i-bookmark"><path d="M6 4h12v17l-6-4-6 4z"/></g>
<g id="i-mic"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></g>
<g id="i-mic-off"><path d="M9 9v-3a3 3 0 0 1 6 0v5M5 11a7 7 0 0 0 11 5.3M12 18v3"/><line x1="3" y1="3" x2="21" y2="21"/></g>
<g id="i-camera"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></g>
<g id="i-gear"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.18a1.65 1.65 0 0 0-2.82-1.17l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 13H4a2 2 0 0 1 0-4h.18a1.65 1.65 0 0 0 1.17-2.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 11 4.6V4a2 2 0 0 1 4 0v.18a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 11H21a2 2 0 0 1 0 4z"/></g>
<g id="i-wifi"><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none"/></g>
<g id="i-ring"><circle cx="12" cy="13" r="8"/><path d="M9.5 5 12 2l2.5 3"/></g>
<g id="i-cake"><path d="M4 21h16v-7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3z"/><path d="M4 16c1.5 1.3 2.5 1.3 4 0s2.5-1.3 4 0 2.5 1.3 4 0 2.5-1.3 4 0"/><path d="M12 8V5M9 8V6M15 8V6"/></g>
<g id="i-cap"><path d="M2 8.5 12 4l10 4.5-10 4.5z"/><path d="M6 10.5V15c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/></g>
<g id="i-pin"><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></g>
<g id="i-briefcase"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></g>
<g id="i-refresh"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 4v4h-4"/></g>
<g id="i-send"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></g>
<g id="i-block"><circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/></g>
<g id="i-flag"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></g>
<g id="i-dots"><circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/></g>
<g id="i-play"><polygon points="7 4 20 12 7 20"/></g>
<g id="i-pause"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></g>
<g id="i-cloud-off"><path d="M3 3l18 18M17.5 17.5H7a4 4 0 0 1-1.3-7.8M8.5 5.2A5 5 0 0 1 18 8a4 4 0 0 1 2 1"/></g>
<g id="i-wallet"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16 14h2"/></g>
<g id="i-faceid"><path d="M7 3H4v3M17 3h3v3M7 21H4v-3M17 21h3v-3M9 9v1M15 9v1M12 9v4l-1.5 1M9.5 15a4 4 0 0 0 5 0"/></g>`;

  function injectSprite(){
    if(document.getElementById('ts-sprite')) return;
    const s=document.createElementNS('http://www.w3.org/2000/svg','svg');
    s.id='ts-sprite';s.setAttribute('width','0');s.setAttribute('height','0');
    s.style.position='absolute';s.innerHTML='<defs>'+SPRITE+'</defs>';
    document.body.appendChild(s);
  }

  // status bar markup
  window.statusBar = (variant='')=>`<div class="statusbar ${variant}"><span>9:41</span>
    <span class="right">
      <svg class="fi" viewBox="0 0 22 14" width="18" height="14"><path d="M1 10h2v3H1zM6 7h2v6H6zM11 4h2v9h-2zM16 1h2v12h-2z"/></svg>
      <svg class="i"><use href="#i-wifi"/></svg>
      <svg class="fi" viewBox="0 0 26 14" width="24"><rect x="1" y="2" width="20" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="3" y="4" width="14" height="6" rx="1.5"/><rect x="22.5" y="5" width="2.4" height="4" rx="1"/></svg>
    </span></div>`;

  // bottom tab bar; active = home|search|matches|chat|profile ; elder hides chat
  window.tabBar = (active, opts={})=>{
    const tabs=[['home','Home','i-home'],['search','Search','i-search'],['matches','Matches','i-heart'],['chat','Chat','i-chat'],['profile','Profile','i-user']];
    const list = opts.elder ? tabs.filter(t=>t[0]!=='chat') : tabs;
    return `<div class="tabbar">`+list.map(([k,l,ic])=>{
      const dot = (k==='chat'&&opts.chatBadge)?`<span class="badge-dot">${opts.chatBadge}</span>`:'';
      const dot2 = (k==='matches'&&opts.matchBadge)?`<span class="badge-dot">${opts.matchBadge}</span>`:'';
      return `<a class="tab ${k===active?'on':''}"><svg class="${k==='matches'&&active==='matches'?'fi':k==='chat'&&active==='chat'?'fi':'i'}"><use href="#${ic}"/></svg><span>${l}</span>${dot}${dot2}</a>`;
    }).join('')+`</div><div class="homebar"></div>`;
  };

  // photo placeholder
  window.ph = (label='',glyph='i-user',cls='')=>`<div class="ph ${cls}" data-label="${label}"><span class="glyph"><svg class="i"><use href="#${glyph}"/></svg></span></div>`;

  /* frame(opts):
     {x,y, label, pills:[['dark'|'elder'|'state','Text']], theme, elder, statusVariant, screen:HTML, w} */
  window.frame = (o)=>{
    const wrap=document.createElement('div');
    wrap.style.cssText=`position:absolute;left:${o.x}px;top:${o.y}px;`;
    const pills=(o.pills||[]).map(([k,t])=>`<span class="pill ${k}">${t}</span>`).join('');
    const themeAttr = `${o.theme==='dark'?'data-theme="dark"':''} ${o.elder?'data-elder="on"':''}`;
    wrap.innerHTML=`<div class="frame-label"><b>${o.label}</b>${pills}</div>
      <div class="ios" ${themeAttr}><div class="island"></div>
        <div class="screen">${o.statusVariant!==null?statusBar(o.statusVariant||''):''}${o.screen}</div>
      </div>`;
    document.body.appendChild(wrap);
    return wrap;
  };

  // redline note card
  window.redline = (x,y,title,rows,w=280)=>{
    const el=document.createElement('div');
    el.className='redline';el.style.cssText=`left:${x}px;top:${y}px;width:${w}px;`;
    el.innerHTML=`<h4>${title}</h4>`+rows.map(r=>`<div class="rl"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('');
    document.body.appendChild(el);
    return el;
  };

  injectSprite();
})();
