/* Horn & Fin national "Compare hunts" tool.
   Usage on a page:
   <div id="hf-compare"></div>
   <script src="https://cdn.jsdelivr.net/gh/joeeperry33-cmd/hornandfin-draw-odds@main/tool/compare.js" defer></script>
   Data: data/national/<species>.json, rebuilt from the draw and harvest data by scripts/national/build.js. */
(function(){
var BASE=(window.HFO_BASE||'https://cdn.jsdelivr.net/gh/joeeperry33-cmd/hornandfin-draw-odds@main/');
var ST={ak:'Alaska',az:'Arizona',ar:'Arkansas',ca:'California',co:'Colorado',ga:'Georgia',id:'Idaho',ia:'Iowa',ks:'Kansas',md:'Maryland',mi:'Michigan',mt:'Montana',ne:'Nebraska',nv:'Nevada',nh:'New Hampshire',nm:'New Mexico',nd:'North Dakota',or:'Oregon',sd:'South Dakota',ut:'Utah',wi:'Wisconsin',wy:'Wyoming'};
var ALLST=[['al','Alabama'],['ak','Alaska'],['az','Arizona'],['ar','Arkansas'],['ca','California'],['co','Colorado'],['ct','Connecticut'],['de','Delaware'],['fl','Florida'],['ga','Georgia'],['hi','Hawaii'],['id','Idaho'],['il','Illinois'],['in','Indiana'],['ia','Iowa'],['ks','Kansas'],['ky','Kentucky'],['la','Louisiana'],['me','Maine'],['md','Maryland'],['ma','Massachusetts'],['mi','Michigan'],['mn','Minnesota'],['ms','Mississippi'],['mo','Missouri'],['mt','Montana'],['ne','Nebraska'],['nv','Nevada'],['nh','New Hampshire'],['nj','New Jersey'],['nm','New Mexico'],['ny','New York'],['nc','North Carolina'],['nd','North Dakota'],['oh','Ohio'],['ok','Oklahoma'],['or','Oregon'],['pa','Pennsylvania'],['ri','Rhode Island'],['sc','South Carolina'],['sd','South Dakota'],['tn','Tennessee'],['tx','Texas'],['ut','Utah'],['vt','Vermont'],['va','Virginia'],['wa','Washington'],['wv','West Virginia'],['wi','Wisconsin'],['wy','Wyoming'],['xx','Outside the U.S.']];
var SPN={elk:'Elk',deer:'Deer',antelope:'Pronghorn',moose:'Moose',sheep:'Bighorn sheep',goat:'Mountain goat',bison:'Bison',bear:'Black bear',brown_bear:'Brown bear',caribou:'Caribou',alligator:'Alligator',crane:'Sandhill crane',swan:'Tundra swan',sage_grouse:'Sage-grouse',sharptail:'Sharp-tailed grouse',sturgeon:'Lake sturgeon'};
var ORDER=['elk','deer','antelope','moose','sheep','goat','bison','bear','brown_bear','caribou','alligator','crane','swan','sage_grouse','sharptail','sturgeon'];
var W={r:'Rifle',a:'Archery',m:'Muzzleloader',o:'Other or any weapon'};
var S={sp:'elk',home:'',pts:0,st:'',w:'',sex:'',minS:0,sort:'odds',pub:false,limit:40};
function sexOf(n){n=n||'';var cow=/antlerless|\bcow|\bdoe|female|\bewe|calf|nanny/i.test(n),bull=/antlered|\bbull|\bbuck|\bmale\b|\(male\)|\bram\b|billy|either|any (elk|deer|antelope|pronghorn|moose|sheep|goat)|\bmb\b/i.test(n);return cow&&!/either/i.test(n)?'f':bull?'m':''}
function succOK(h){return h.s!=null&&!h.few&&(h.h||0)>=10}
var cache={},index=null,root;
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function get(u){return fetch(u,{cache:'force-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()})}
function readQS(){try{var q=new URLSearchParams(location.search);if(q.get('species'))S.sp=q.get('species');if(q.get('home'))S.home=q.get('home');if(q.get('pts'))S.pts=+q.get('pts')||0;if(q.get('sort'))S.sort=q.get('sort');if(q.get('state'))S.st=q.get('state')}catch(e){}}
function writeQS(){try{var q=new URLSearchParams();q.set('species',S.sp);if(S.home)q.set('home',S.home);if(S.pts)q.set('pts',S.pts);if(S.sort!='odds')q.set('sort',S.sort);if(S.st)q.set('state',S.st);history.replaceState(null,'','?'+q)}catch(e){}}
function css(){var s=document.createElement('style');s.textContent=
'#hf-compare{font-size:16px;color:#1A2312}'+
'#hf-compare .hc-panel{background:#fff;border:1px solid #E3D9C6;border-radius:14px;padding:16px 18px;margin:0 0 14px}'+
'#hf-compare .hc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}'+
'#hf-compare label{display:block;font:700 13px "Barlow Condensed",sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#6B6252;margin:0 0 4px}'+
'#hf-compare select,#hf-compare input[type=number]{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #D8CCB4;border-radius:8px;background:#FBF8F2;font-size:15px;color:#1A2312}'+
'#hf-compare .hc-sorts{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0}'+
'#hf-compare .hc-sort{border:1px solid #E3D9C6;background:#FBF8F2;color:#1A2312;border-radius:999px;padding:6px 14px;font:700 14px "Barlow Condensed",sans-serif;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}'+
'#hf-compare .hc-sort[aria-pressed="true"]{background:#1A2312;border-color:#1A2312;color:#fff}'+
'#hf-compare .hc-chk{display:flex;align-items:center;gap:6px;margin:10px 0 0;font-size:14px;text-transform:none;letter-spacing:0;font-family:inherit;font-weight:500;color:#1A2312}'+
'#hf-compare .hc-sum{margin:0 0 10px;color:#4A4336;font-size:15px}'+
'#hf-compare table{width:100%;border-collapse:collapse}'+
'#hf-compare th{text-align:left;font:700 13px "Barlow Condensed",sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#6B6252;padding:6px 8px;border-bottom:1px solid #E3D9C6}'+
'#hf-compare td{padding:9px 8px;border-bottom:1px solid #F0E9DB;vertical-align:top}'+
'#hf-compare td.hc-n{text-align:right;white-space:nowrap;font-weight:800}'+
'#hf-compare th.hc-n{text-align:right}'+
'#hf-compare .hc-st{display:inline-block;min-width:28px;padding:1px 6px;margin-right:6px;border-radius:4px;background:#1A2312;color:#fff;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.06em;text-align:center}'+
'#hf-compare a.hc-h{color:#1A2312;font-weight:700;text-decoration:none}#hf-compare a.hc-h:hover{color:#E8641B}'+
'#hf-compare .hc-m{color:#6B6252;font-size:13px;margin-top:2px}'+
'#hf-compare .hc-tag{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:4px;background:#F3E6D3;color:#8A4B12;font-size:12px;font-weight:700}'+
'#hf-compare .p-hi{color:#2F5D2A}#hf-compare .p-mid{color:#9A6A12}#hf-compare .p-lo{color:#A33A1A}#hf-compare .p-na{color:#9A9180;font-weight:500}'+
'#hf-compare .hc-more{display:block;margin:14px auto 0;padding:10px 18px;border:0;border-radius:8px;background:#E8641B;color:#fff;font:700 15px "Barlow Condensed",sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}'+
'#hf-compare .hc-foot{font-size:13px;color:#6B6252;margin:12px 0 0}'+
'@media (max-width:700px){#hf-compare .hc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#hf-compare .hc-hide{display:none}#hf-compare td,#hf-compare th{padding:7px 4px}}';
document.head.appendChild(s)}
function oddsFor(h){var home=S.home&&S.home==h.st;var p=home?h.res:h.nr;if(!p)return null;var o=p.o,L=(index&&index.levels)||[0];
  if(typeof o=='number')return {v:o,p:p,res:home};var i=0;for(var j=0;j<L.length;j++)if(L[j]<=S.pts)i=j;var v=o[i];return {v:v,p:p,res:home}}
function cls(v){return v==null?'p-na':v>=60?'p-hi':v>=20?'p-mid':'p-lo'}
function fmt(v){return v==null?'—':(v>=99.5?'100%':v>0&&v<1?'<1%':Math.round(v)+'%')}
function unitOf(n){var m=/^(GMU|Unit|Units|Area|HD|Hunt Area|District|Zone)\s*[\w-]+/i.exec(n||'');return m?m[0]:''}
function build(){root.innerHTML='<div class="hc-panel"><div class="hc-grid">'+
  '<div><label for="hc-sp">Species</label><select id="hc-sp"></select></div>'+
  '<div><label for="hc-home">I live in</label><select id="hc-home"><option value="">Choose your state</option></select></div>'+
  '<div><label for="hc-pts">My points</label><input type="number" id="hc-pts" min="0" max="30" value="'+S.pts+'"></div>'+
  '<div><label for="hc-st">Hunt in</label><select id="hc-st"><option value="">All states</option></select></div>'+
  '<div><label for="hc-w">Weapon</label><select id="hc-w"><option value="">Any</option><option value="r">Rifle</option><option value="a">Archery</option><option value="m">Muzzleloader</option></select></div>'+
  '<div><label for="hc-sex">Animal</label><select id="hc-sex"><option value="">Any</option><option value="m">Antlered, horned or either-sex</option><option value="f">Antlerless only</option></select></div>'+
  '<div><label for="hc-min">Min. hunter success</label><select id="hc-min"><option value="0">Any</option><option value="25">25%+</option><option value="50">50%+</option><option value="75">75%+</option></select></div>'+
  '</div><label class="hc-chk"><input type="checkbox" id="hc-pub"> Hide private-land-only hunts</label>'+
  '<div class="hc-sorts" role="group" aria-label="Sort by"><button type="button" class="hc-sort" data-s="odds">Best draw odds</button><button type="button" class="hc-sort" data-s="succ">Highest hunter success</button><button type="button" class="hc-sort" data-s="value">Best overall chance</button></div></div>'+
  '<div class="hc-panel" id="hc-out"><p class="hc-sum">Loading hunts…</p></div>';
  var sp=$('hc-sp');ORDER.forEach(function(k){if(index.species[k])sp.add(new Option(SPN[k]||k,k))});sp.value=S.sp;
  var hm=$('hc-home');ALLST.forEach(function(s){hm.add(new Option(s[1],s[0]))});hm.value=S.home;
  fillStates();$('hc-st').value=S.st;
  sp.onchange=function(){S.sp=sp.value;S.st='';S.limit=40;fillStates();load()};
  hm.onchange=function(){S.home=hm.value;S.limit=40;render()};
  $('hc-pts').oninput=function(){S.pts=Math.max(0,Math.min(30,+this.value||0));S.limit=40;render()};
  $('hc-st').onchange=function(){S.st=this.value;S.limit=40;render()};
  $('hc-w').onchange=function(){S.w=this.value;S.limit=40;render()};
  $('hc-sex').onchange=function(){S.sex=this.value;S.limit=40;render()};
  $('hc-min').onchange=function(){S.minS=+this.value;S.limit=40;render()};
  $('hc-pub').onchange=function(){S.pub=this.checked;S.limit=40;render()};
  Array.prototype.forEach.call(root.querySelectorAll('.hc-sort'),function(b){b.onclick=function(){S.sort=b.dataset.s;S.limit=40;render()}});
}
function fillStates(){var el=$('hc-st'),v=S.st;el.length=1;(index.species[S.sp]||{states:[]}).states.forEach(function(s){el.add(new Option(ST[s]||s.toUpperCase(),s))});el.value=v}
function load(){var sp=S.sp;$('hc-out').innerHTML='<p class="hc-sum">Loading hunts…</p>';if(cache[sp])return render();get(BASE+'data/national/'+sp+'.json').then(function(d){cache[sp]=d;if(S.sp==sp)render()}).catch(function(){$('hc-out').innerHTML='<p class="hc-sum">Couldn’t load hunts. Please try again.</p>'})}
function render(){writeQS();Array.prototype.forEach.call(root.querySelectorAll('.hc-sort'),function(b){b.setAttribute('aria-pressed',b.dataset.s==S.sort)});
  var d=cache[S.sp];if(!d)return;var rows=[];
  d.hunts.forEach(function(h){if(S.st&&h.st!=S.st)return;if(S.w&&h.w!=S.w)return;if(S.pub&&h.pl)return;if(S.sex&&sexOf(h.n)!=S.sex)return;
    if(S.minS&&!(succOK(h)&&h.s>=S.minS))return;var o=oddsFor(h);if(!o||o.v==null)return;
    if(S.sort=='succ'&&!succOK(h))return;
    var val=succOK(h)?o.v*h.s/100:-1;rows.push({h:h,o:o,val:val})});
  var key=S.sort=='succ'?function(r){return [r.h.s,r.o.v]}:S.sort=='value'?function(r){return [r.val,r.o.v]}:function(r){return [r.o.v,succOK(r.h)?r.h.s:-1]};
  rows.sort(function(a,b){var A=key(a),B=key(b);return (B[0]-A[0])||(B[1]-A[1])||((b.o.p.t||0)-(a.o.p.t||0))});
  var who=S.home?(S.home=='xx'?'a nonresident everywhere':'a resident of '+(ALLST.filter(function(s){return s[0]==S.home})[0]||['',''])[1]+' (nonresident elsewhere)'):'a nonresident (choose your state to see resident odds at home)';
  var h='<p class="hc-sum"><b>'+rows.length.toLocaleString()+'</b> '+esc((SPN[S.sp]||S.sp).toLowerCase())+' hunts'+(S.st?' in '+esc(ST[S.st]||S.st):' across '+(index.species[S.sp].states.length)+' states')+'. Odds are for '+esc(who)+' with '+S.pts+' point'+(S.pts==1?'':'s')+'.</p>';
  h+='<div style="overflow-x:auto"><table><thead><tr><th>Hunt</th><th class="hc-n">Draw odds</th><th class="hc-n">Hunter success</th><th class="hc-n hc-hide">Tags</th></tr></thead><tbody>';
  rows.slice(0,S.limit).forEach(function(r){var x=r.h,u=unitOf(x.n),href='/hunting-guides/draw-odds/?state='+x.st+'&species='+S.sp+'&res='+(r.o.res?'res':'nr')+(u?'&unit='+encodeURIComponent(u):'');
    var meta=[esc(x.id),(W[x.w]||'')];if(r.o.p.a)meta.push(r.o.p.a.toLocaleString()+(r.o.p.a==1?' applicant':' applicants'));if(x.h)meta.push(x.h.toLocaleString()+' hunters');
    if(x.g&&r.o.p.f!=null)meta.push('sure draw at '+r.o.p.f+' pts');
    h+='<tr><td><span class="hc-st">'+x.st.toUpperCase()+'</span><a class="hc-h" href="'+href+'">'+esc(x.n||x.id)+'</a>'+(x.pl?'<span class="hc-tag">Private land</span>':'')+'<div class="hc-m">'+meta.filter(Boolean).join(' · ')+'</div></td>'+
      '<td class="hc-n '+cls(r.o.v)+'">'+fmt(r.o.v)+'</td><td class="hc-n '+cls(x.s)+'">'+(x.s!=null?fmt(x.s)+(x.few?'*':''):'<span class="p-na">—</span>')+'</td><td class="hc-n hc-hide" style="font-weight:500">'+(r.o.p.t!=null?r.o.p.t:'—')+'</td></tr>'});
  h+='</tbody></table></div>';
  if(rows.length>S.limit)h+='<button type="button" class="hc-more" id="hc-more">Show more hunts</button>';
  h+='<p class="hc-foot">Draw odds are last year’s official results at your point level, from each state wildlife agency. Points don’t transfer between states, so this assumes you hold the same number of points in each state. Hunter success is from state harvest surveys where published; hunts with fewer than 10 hunters are marked * and left out of success rankings. "Best overall chance" multiplies draw odds by hunter success. Tap a hunt for its full draw results.</p>';
  $('hc-out').innerHTML=h;var m=$('hc-more');if(m)m.onclick=function(){S.limit+=40;render()}}
function init(){root=$('hf-compare');if(!root)return;css();readQS();get(BASE+'data/national/index.json').then(function(ix){index=ix;if(!ix.species[S.sp])S.sp='elk';build();load()}).catch(function(){root.innerHTML='<p>Couldn’t load the hunt list. Please try again.</p>'})}
if(document.readyState=='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
