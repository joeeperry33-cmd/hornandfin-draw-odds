/* Horn & Fin state hub: "best hunter success" lists.
   Usage on a page:
   <div class="hf-hub-best" data-state="co" data-species="elk,deer"></div>
   <script src="https://cdn.jsdelivr.net/gh/joeeperry33-cmd/hornandfin-draw-odds@main/tool/hub.js" defer></script>
   Data comes from data/hub/<st>.json, rebuilt whenever draw or harvest data changes. */
(function(){
var BASE=(window.HFO_BASE||'https://cdn.jsdelivr.net/gh/joeeperry33-cmd/hornandfin-draw-odds@main/');
var NAMES={elk:'Elk',deer:'Deer',antelope:'Pronghorn',moose:'Moose',sheep:'Bighorn sheep',goat:'Mountain goat',bear:'Bear',bison:'Bison'};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function css(){if(document.getElementById('hf-hub-css'))return;var s=document.createElement('style');s.id='hf-hub-css';s.textContent=
'.hf-hub-best{background:#fff;border:1px solid #E3D9C6;border-radius:14px;padding:16px 18px;margin:0 0 1.6em}'+
'.hf-hub-best .hb-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}'+
'.hf-hub-best .hb-tab{border:1px solid #E3D9C6;background:#FBF8F2;color:#1A2312;border-radius:999px;padding:6px 14px;font:700 14px "Barlow Condensed",sans-serif;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}'+
'.hf-hub-best .hb-modes .hb-tab{background:#fff;text-transform:none;letter-spacing:0;font:600 14px system-ui,sans-serif}.hf-hub-best .hb-modes .hb-tab[aria-pressed="true"]{background:#E8641B;border-color:#E8641B;color:#fff}.hf-hub-best .hb-tab[aria-pressed="true"]{background:#1A2312;color:#fff;border-color:#1A2312}'+
'.hf-hub-best table{width:100%;border-collapse:collapse;font-size:15px}'+
'.hf-hub-best th{text-align:left;font:700 13px "Barlow Condensed",sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#6B6252;padding:6px 8px;border-bottom:1px solid #E3D9C6}'+
'.hf-hub-best td{padding:8px;border-bottom:1px solid #F0E9DB;vertical-align:top}'+
'.hf-hub-best td.hb-s{font-weight:800;color:#2F5D2A;white-space:nowrap}'+
'.hf-hub-best a.hb-h{color:#1A2312;font-weight:700;text-decoration:none}.hf-hub-best a.hb-h:hover{color:#E8641B}'+
'.hf-hub-best .hb-m{color:#6B6252;font-size:13px}'+
'.hf-hub-best .hb-pl{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:4px;background:#F3E6D3;color:#8A4B12;font-size:12px;font-weight:700}'+
'.hf-hub-best .hb-foot{margin:10px 0 0;font-size:13px;color:#6B6252}'+
'@media (max-width:640px){.hf-hub-best td,.hf-hub-best th{padding:6px 4px}}';
document.head.appendChild(s)}
function ptxt(v){v=String(v||'');var m=/^(\d+) Pref Points?$/.exec(v);if(m)return m[1]+(m[1]=='1'?' point':' points');if(/^Choice/.test(v))return '0 points ('+v.toLowerCase()+')';if(v=='Leftover')return 'leftover';return v.toLowerCase()}
function unitOf(n){var m=/^(GMU|Unit|Area|HD|Hunt Area)\s*[\w-]+/i.exec(n||'');return m?m[0]:''}
function render(el,d){
  var want=(el.getAttribute('data-species')||'elk,deer').split(',').map(function(s){return s.trim()}).filter(function(s){return d.species[s]});
  if(!want.length){el.style.display='none';return}
  var st=d.state,sp=want[0],mode='top';
  function draw(){
    var e=d.species[sp],rows=(mode=='easy'?e.easy:e.top)||[];var hasPts=rows.some(function(r){return r.pts});
    var h='<div class="hb-tabs" role="group" aria-label="Species">';
    want.forEach(function(s){h+='<button type="button" class="hb-tab" data-sp="'+s+'" aria-pressed="'+(s==sp)+'">'+esc(NAMES[s]||s)+'</button>'});
    h+='</div>';if(e.easy&&e.easy.length){h+='<div class="hb-tabs hb-modes" role="group" aria-label="Show"><button type="button" class="hb-tab" data-mode="top" aria-pressed="'+(mode=='top')+'">Highest success</button><button type="button" class="hb-tab" data-mode="easy" aria-pressed="'+(mode=='easy')+'">2 points or fewer to draw</button></div>'}
    h+='<table><thead><tr><th>Hunt</th><th>Hunter success</th></tr></thead><tbody>';
    rows.forEach(function(r){
      var u=unitOf(r.name),href='/hunting-guides/draw-odds/?state='+st+'&species='+sp+(u?'&unit='+encodeURIComponent(u):'');
      var pl=/private land/i.test(r.name)?'<span class="hb-pl">Private land</span>':'';
      var pt='';if(r.pts){pt=' · To draw: '+esc(ptxt(r.pts.res))+' res, '+esc(ptxt(r.pts.nr))+' nonres'}
      if(r.c){pt+=' · License + tag: '+(r.c[0]!=null?'$'+r.c[0].toLocaleString()+' res':'')+(r.c[0]!=null&&r.c[1]!=null?', ':'')+(r.c[1]!=null?'$'+r.c[1].toLocaleString()+' nonres':'nonres not eligible')}
      h+='<tr><td><a class="hb-h" href="'+href+'">'+esc(r.name||r.id)+'</a>'+pl+'<div class="hb-m">'+esc(r.id)+' · '+r.h.toLocaleString()+' hunters'+pt+'</div></td><td class="hb-s">'+r.s.toFixed(0)+'%</td></tr>'});
    h+='</tbody></table><p class="hb-foot">Limited-draw hunts with at least '+d.min_hunters+' hunters, from the '+esc(d.survey||'state harvest survey')+'. '+(mode=='easy'?'Points are what it took to draw last year. ':'')+'Tap a hunt to see its unit’s draw odds.'+(d.fees?' License + tag is the state’s '+esc(d.fees.year)+' price for the hunting license, required stamps and tag, not counting application fees.':'')+'</p>';
    el.innerHTML=h;
    Array.prototype.forEach.call(el.querySelectorAll('.hb-tab'),function(b){b.onclick=function(){if(b.dataset.sp){sp=b.dataset.sp;if(!d.species[sp].easy)mode='top'}else mode=b.dataset.mode;draw()}});
  }
  draw();
}
function init(){css();Array.prototype.forEach.call(document.querySelectorAll('.hf-hub-best'),function(el){
  var st=(el.getAttribute('data-state')||'').toLowerCase();if(!st)return;
  fetch(BASE+'data/hub/'+st+'.json').then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){render(el,d)}).catch(function(){el.style.display='none'})})}
if(document.readyState=='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
