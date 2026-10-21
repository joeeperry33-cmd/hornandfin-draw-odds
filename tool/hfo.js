(function(){
var BASE=(window.HFO_BASE||'https://cdn.jsdelivr.net/gh/joeeperry33-cmd/hornandfin-draw-odds@main/');
var STATES=[['co','Colorado'],['wy','Wyoming'],['mt','Montana'],['id','Idaho'],['nm','New Mexico'],['az','Arizona'],['ut','Utah'],['nv','Nevada'],['or','Oregon'],['wa','Washington'],['ca','California'],['ak','Alaska']];
var SPN={elk:'Elk',deer:'Deer',moose:'Moose',caribou:'Caribou',sheep:'Dall sheep',goat:'Mountain goat',bison:'Bison',brown_bear:'Brown bear'};
var POOLS={res:'Residents',nr:'Nonresidents',all:'All applicants',nr_special:'Nonresidents (special price)',nr_rand:'Nonresidents (random draw)',nr_special_rand:'Nonresidents (special price, random draw)',out:'Outfitter pool (resident or nonresident with an outfitter)',youth_res:'Youth residents',youth_nr:'Youth nonresidents',landowner:'Landowners'};
var RESPOOLS={res:['res','youth_res','landowner'],nr:['nr','nr_special','nr_rand','nr_special_rand','out','youth_nr']};
var $=function(id){return document.getElementById(id)};
var S={st:'co',sp:'elk',res:'nr',pts:0,q:'',sort:'apps',dir:-1,limit:50,onlyMine:false,hunt:null};
var cache={},rules=null;
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function money(v){return v==null?'—':(v===0?'Free':'$'+(+v).toFixed(v%1?2:0))}
function pct(p){return p==null?'—':(p>=0.995?'100%':(p<0.005&&p>0?'<1%':Math.round(p*100)+'%'))}
function pill(p){var c=p==null?'p-na':p>=0.6?'p-hi':p>=0.2?'p-mid':'p-lo';return '<span class="hfo-pill '+c+'">'+pct(p)+'</span>'}
function getJSON(u){return fetch(u,{cache:'force-cache'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})}
function loadRules(){return rules?Promise.resolve(rules):getJSON(BASE+'data/rules.json').then(function(j){rules=j;return j})}
function loadState(st){if(cache[st]!==undefined)return Promise.resolve(cache[st]);return getJSON(BASE+'data/'+st+'.json').then(function(j){cache[st]=j;return j}).catch(function(){cache[st]=null;return null})}
function stateName(st){for(var i=0;i<STATES.length;i++)if(STATES[i][0]==st)return STATES[i][1]}
// ---------- odds math ----------
function poolsFor(h,data){var keys=[];if(!data.split||h.all){if(h.all)keys.push('all')}
  (RESPOOLS[S.res]||[]).forEach(function(k){if(h[k]&&h[k].length)keys.push(k)});
  if(!keys.length&&h.all)keys.push('all');return keys}
function rowsFor(h,k,data){var rows=(h[k]||[]).slice();
  if(data.est&&rows.length&&rows[0][2]==null){rows=estimate(h,rows)}
  return rows.sort(function(a,b){return (b[0]==null?0:b[0])-(a[0]==null?0:a[0])})}
// estimate drawn from quotas when the agency publishes applicants only (California)
function estimate(h,rows){var q=h.q||{},pref=q.pref||0,rand=q.rand||0;var r=rows.slice().sort(function(a,b){return b[0]-a[0]});var left=pref,out=[],remain=0;
  r.forEach(function(x){var take=Math.min(left,x[1]);left-=take;out.push([x[0],x[1],take]);remain+=x[1]-take});
  var pr=remain>0?Math.min(1,rand/remain):0;
  return out.map(function(x){var d=x[2]+(x[1]-x[2])*pr;return [x[0],x[1],Math.round(d*10)/10,1]})}
function rateAt(rows,p){if(!rows.length)return null;
  if(rows.length==1&&rows[0][0]==null)return rows[0][1]?Math.min(1,rows[0][2]/rows[0][1]):null;
  var best=null;rows.forEach(function(r){if(r[0]!=null&&r[1]>0&&r[0]<=p&&(best==null||r[0]>best[0]))best=r});
  if(!best){var nz=rows.filter(function(r){return r[1]>0});if(!nz.length)return null;var lo=nz[nz.length-1];return Math.min(1,lo[2]/lo[1])}
  return best[1]?Math.min(1,best[2]/best[1]):null}
function fullAt(rows){var s=rows.filter(function(r){return r[0]!=null&&r[1]>0}).sort(function(a,b){return a[0]-b[0]});if(!s.length)return null;
  for(var i=0;i<s.length;i++){var ok=true;for(var j=i;j<s.length;j++)if(s[j][2]<s[j][1]-0.01){ok=false;break}if(ok)return s[i][0]}return null}
function lowestDrew(rows){var s=rows.filter(function(r){return r[0]!=null&&r[2]>0});if(!s.length)return null;return Math.min.apply(null,s.map(function(r){return r[0]}))}
function oddsAt(h,k,data,p){var rows=rowsFor(h,k,data);var r=rateAt(rows,p);var c=data.combine&&data.combine[k];if(c&&h[c]&&h[c].length&&r!=null){var pr=rateAt(h[c],p);if(pr!=null)r=r+(1-r)*pr}return r}
function cumulative(fn,p,years,gain){var miss=1;for(var y=0;y<years;y++){var r=fn(p+(gain?y:0));if(r==null)return null;miss*=(1-r)}return 1-miss}
function gains(data,h){var s=(h&&h.system)||(data&&data.system);return !!s&&s!='random'&&s!='none'}
function primary(h,data){var ks=poolsFor(h,data);return ks.length?ks[0]:null}
// ---------- render ----------
function renderControls(){var st=$('hfo-st');if(!st.options.length){STATES.forEach(function(s){st.add(new Option(s[1],s[0]))})}st.value=S.st;
  var r=rules&&rules[S.st],sps=r?Object.keys(r.species):['elk','deer'];var data=cache[S.st];
  if(data&&data.hunts){data.hunts.forEach(function(h){if(sps.indexOf(h.sp)<0)sps.push(h.sp)})}
  if(sps.indexOf(S.sp)<0){if(r)S.sp=sps[0];else sps.unshift(S.sp)}var sp=$('hfo-sp');sp.innerHTML='';sps.forEach(function(k){sp.add(new Option(SPN[k]||k,k))});sp.value=S.sp;
  [].forEach.call($('hfo-res').querySelectorAll('button'),function(b){b.setAttribute('aria-pressed',b.dataset.v==S.res?'true':'false')});$('hfo-pts').value=S.pts}
function renderRules(){var el=$('hfo-rules'),r=rules&&rules[S.st];if(!r){el.innerHTML='<p class="hfo-muted">Loading the rules…</p>';return}
  var v=r.species[S.sp];var nm=stateName(S.st);
  if(!v){el.innerHTML='<h3>'+esc(nm)+' '+esc(SPN[S.sp]||S.sp)+'</h3><p>See our <a href="/hunting-guides/'+esc(r.page_slug)+'/">'+esc(nm)+' draw guide</a>.</p>';return}
  var who=S.res=='res'?v.resident||{}:v.nonresident||{};
  var h='<h3>How '+esc(nm)+' '+esc((SPN[S.sp]||S.sp).toLowerCase())+' draws work</h3><p>'+esc(v.system_summary)+'</p>';
  if(v.allocation&&v.allocation.length){h+='<ul>'+v.allocation.map(function(a){return '<li>'+(a.pct!=null?'<b>'+a.pct+'%</b> — ':'')+esc(a.pool)+'</li>'}).join('')+'</ul>'}
  h+='<div class="hfo-facts"><div class="hfo-fact"><b>'+(S.res=='res'?'Resident':'Nonresident')+' cost to apply</b>'+(who.point_only_fee!=null&&who.point_only_fee!==who.application_fee?'Point: '+money(who.point_only_fee)+'<br>':'')+(who.application_fee!=null?'Application: '+money(who.application_fee):(who.point_only_fee!=null?'Point: '+money(who.point_only_fee):'—'))+'</div>'+
     '<div class="hfo-fact"><b>Nonresident share</b>'+esc(v.nonresident_quota||'—')+'</div>'+
     '<div class="hfo-fact"><b>You lose points if</b>'+esc(v.lose_points_if||'—')+'</div></div>';
  if(v.waiting_period&&!/^none/i.test(v.waiting_period))h+='<p class="hfo-muted"><b>Waiting period:</b> '+esc(v.waiting_period)+'</p>';
  h+='<p><a class="hfo-btn alt" href="/hunting-guides/'+esc(r.page_slug)+'/">Full '+esc(nm)+' points guide</a></p>';el.innerHTML=h}
function huntRows(data){var hs=data.hunts.filter(function(h){return h.sp==S.sp});var out=[];
  hs.forEach(function(h){var k=primary(h,data);if(!k)return;var rows=rowsFor(h,k,data);
    var q=h.q||{};var tags=k=='all'?q.all:(q[k]!=null?q[k]:(q.all!=null?q.all:null));
    out.push({h:h,k:k,rows:rows,odds:oddsAt(h,k,data,S.pts),full:fullAt(rows),low:lowestDrew(rows),tags:tags,apps:rows.reduce(function(s,r){return s+(r[1]||0)},0)})});
  return out}
function renderHunts(){var el=$('hfo-hunts'),data=cache[S.st],r=rules&&rules[S.st],v=r&&r.species[S.sp],nm=stateName(S.st);
  if(data===undefined){el.innerHTML='<p class="hfo-muted">Loading draw results…</p>';return}
  if(!data||!data.hunts||!data.hunts.some(function(h){return h.sp==S.sp})){el.innerHTML=tierPanel(v,nm,data);return}
  var list=huntRows(data);var ql=S.q.toLowerCase();
  if(ql)list=list.filter(function(x){return (x.h.id+' '+x.h.name).toLowerCase().indexOf(ql)>=0});
  if(S.onlyMine)list=list.filter(function(x){return x.odds!=null&&x.odds>=0.5});
  var key=S.sort,d=S.dir;list.sort(function(a,b){var A=a[key],B=b[key];if(key=='id'){A=a.h.id;B=b.h.id;return A<B?-d:A>B?d:0}if(A==null)A=-1;if(B==null)B=-1;return (A-B)*d});
  var pointsSys=gains(data);
  var h='<h3>Every '+esc(nm)+' '+esc((SPN[S.sp]||S.sp).toLowerCase())+' hunt</h3><p class="hfo-muted">'+esc(data.year)+' draw results from '+srcLinks(data)+'. '+esc(data.about||'')+'</p>';
  (data.notes||[]).forEach(function(n){h+='<div class="hfo-note">'+esc(n)+'</div>'});
  h+='<div class="hfo-searchrow"><input type="search" id="hfo-q" placeholder="Search hunt code, unit or area" value="'+esc(S.q)+'"><label class="hfo-check"><input type="checkbox" id="hfo-mine" '+(S.onlyMine?'checked':'')+'> Only hunts I\'d likely draw (50%+)</label></div>';
  h+='<div class="hfo-tablewrap"><table><thead><tr><th data-k="id">Hunt</th><th data-k="tags">Tags</th><th data-k="apps" class="hfo-x">Applicants</th><th data-k="odds">'+(pointsSys?'Odds at '+S.pts+' pts':'Draw odds')+'</th>'+(pointsSys?'<th data-k="full" class="hfo-x">Everyone drew at</th><th data-k="low" class="hfo-x">Lowest drew</th>':'')+'</tr></thead><tbody>';
  list.slice(0,S.limit).forEach(function(x,i){h+='<tr class="hfo-row" data-i="'+esc(x.h.id)+'"><td><b>'+esc(x.h.id)+'</b><br><span class="hfo-muted">'+esc(x.h.name)+'</span></td><td>'+(x.tags==null?'—':x.tags)+'</td><td class="hfo-x">'+x.apps+'</td><td>'+pill(x.odds)+'</td>'+(pointsSys?'<td class="hfo-x">'+(x.full==null?'Not everyone':x.full+' pts')+'</td><td class="hfo-x">'+(x.low==null?'—':x.low+' pts')+'</td>':'')+'</tr>'});
  h+='</tbody></table></div>';
  if(!list.length)h+='<p>No hunts match.</p>';
  h+='<p class="hfo-muted" style="margin-top:10px">Showing '+Math.min(S.limit,list.length)+' of '+list.length+' hunts. '+(list.length>S.limit?'<button class="hfo-btn alt" id="hfo-more" type="button">Show more</button>':'')+'</p>';
  el.innerHTML=h;
  $('hfo-q').addEventListener('input',function(e){S.q=e.target.value;S.limit=50;var pos=e.target.selectionStart;renderHunts();var q=$('hfo-q');q.focus();q.setSelectionRange(pos,pos)});
  $('hfo-mine').addEventListener('change',function(e){S.onlyMine=e.target.checked;renderHunts()});
  if($('hfo-more'))$('hfo-more').addEventListener('click',function(){S.limit+=100;renderHunts()});
  [].forEach.call(el.querySelectorAll('th[data-k]'),function(th){th.addEventListener('click',function(){var k=th.dataset.k;if(S.sort==k)S.dir*=-1;else{S.sort=k;S.dir=k=='id'?1:-1}renderHunts()})});
  [].forEach.call(el.querySelectorAll('tr.hfo-row'),function(tr){tr.addEventListener('click',function(){S.hunt=tr.dataset.i;renderDetail();$('hfo-detail').scrollIntoView({behavior:'smooth',block:'start'})})})}
function srcLinks(data){var other=S.sp=='elk'?/deer/i:S.sp=='deer'?/elk/i:/^$/;var L=(data.sources||[]).filter(function(s){return !/api|endpoint/i.test(s.label)});var M=L.filter(function(s){return !other.test(s.label)});return (M.length?M:L).slice(0,2).map(function(s){return '<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.label)+'</a>'}).join(', ')||'the state wildlife agency'}
function tierPanel(v,nm,data){var h='<h3>What it usually takes</h3>';
  if(S.st=='wa')h+='<div class="hfo-note">Washington hasn\'t published hunt-by-hunt drawing results since 2021, so we can\'t show unit odds. The ranges below are general guidance.</div>';
  else h+='<div class="hfo-note">Unit-by-unit results for '+esc(nm)+' '+esc((SPN[S.sp]||S.sp).toLowerCase())+' aren\'t loaded yet. The ranges below are general guidance.</div>';
  var t=(v&&v.tiers)||[];if(!t.length)return h+'<p>See the full guide for details.</p>';
  var hasPts=t.some(function(x){return x.typical_points_resident||x.typical_points_nonresident});
  h+='<div class="hfo-tablewrap"><table><thead><tr><th>Hunt type</th><th>Examples</th>'+(hasPts?'<th>Residents</th><th>Nonresidents</th>':'')+'<th>What to expect</th></tr></thead><tbody>';
  t.forEach(function(x){h+='<tr><td><b>'+esc(x.tier)+'</b></td><td>'+esc(x.example_hunts||'')+'</td>'+(hasPts?'<td>'+esc(x.typical_points_resident||'—')+'</td><td>'+esc(x.typical_points_nonresident||'—')+'</td>':'')+'<td>'+esc(x.note||'')+'</td></tr>'});
  return h+'</tbody></table></div>'}
function renderDetail(){var el=$('hfo-detail'),data=cache[S.st];if(!S.hunt||!data||!data.hunts){el.hidden=true;return}
  var h0=data.hunts.filter(function(h){return h.id==S.hunt&&h.sp==S.sp})[0];if(!h0){el.hidden=true;return}el.hidden=false;
  var keys=poolsFor(h0,data);var pointsSys=gains(data,h0);var k=keys[0];var rows=k?rowsFor(h0,k,data):[];
  var fn=function(p){return oddsAt(h0,k,data,p)};var now=fn(S.pts),five=cumulative(fn,S.pts,5,pointsSys),full=fullAt(rows);
  var h='<p class="hfo-muted"><a href="#" id="hfo-close">← Back to all hunts</a></p><h3>'+esc(h0.id)+(h0.name?' — '+esc(h0.name):'')+'</h3>';
  if(!k){h+='<p>No '+(S.res=='res'?'resident':'nonresident')+' applicants or tags in this hunt last year'+(S.res=='nr'?' (it may be resident-only)':'')+'.</p>';el.innerHTML=h;bindClose();return}
  h+='<div class="hfo-big"><div class="hfo-stat"><b>'+pct(now)+'</b><span>'+(pointsSys?'chance last year with '+S.pts+' point'+(S.pts==1?'':'s')+(data.combine&&data.combine[k]?' (points draw + random draw)':''):'of applicants drew last year')+'</span></div>'+
     '<div class="hfo-stat"><b>'+pct(five)+'</b><span>chance of drawing at least once in 5 years'+(pointsSys?', gaining a point each year':'')+', if results look like last year</span></div>'+
     '<div class="hfo-stat"><b>'+(pointsSys?(full==null?'—':full):(h0.q&&h0.q[k]!=null?h0.q[k]:(h0.q&&h0.q.all!=null?h0.q.all:'—')))+'</b><span>'+(pointsSys?(full==null?'points where everyone drew (nobody was guaranteed)':'points where everyone drew last year'):(h0.q&&h0.q[k]!=null?'tags for this pool':'tags in this hunt'))+'</span></div></div>';
  var lvl=null;rows.forEach(function(r){if(r[0]!=null&&r[1]>0&&r[0]<=S.pts&&(lvl==null||r[0]>lvl[0]))lvl=r});if(pointsSys&&lvl&&lvl[1]<5)h+='<p class="hfo-muted">Only '+lvl[1]+' applicant'+(lvl[1]==1?'':'s')+' had '+lvl[0]+' point'+(lvl[0]==1?'':'s')+' last year, so treat that percentage with caution.</p>';
  if(pointsSys&&full!=null&&S.pts<full)h+='<p>You\'re <b>'+(full-S.pts)+' point'+(full-S.pts==1?'':'s')+'</b> short of a sure thing based on last year. Point creep often pushes that line up a point every year or two, so plan on a little longer.</p>';
  if(data.system&&/bonus/.test(data.system))h+='<p class="hfo-muted">This is a bonus-point state, so every applicant has some chance. Extra points add entries; they don\'t guarantee a tag.</p>';
  keys.forEach(function(kk){var rr=rowsFor(h0,kk,data);var isEst=rr.length&&rr[0][3];
    h+='<h4>'+esc(POOLS[kk]||kk)+(h0.q&&h0.q[kk]!=null?' · '+h0.q[kk]+' tag'+(h0.q[kk]==1?'':'s'):'')+'</h4><div class="hfo-tablewrap"><table><thead><tr><th>'+(rr.length&&rr[0][0]!=null?'Points':'')+'</th><th>Applicants</th><th>'+(isEst?'Drew (est.)':'Drew')+'</th><th>Odds</th><th></th></tr></thead><tbody>';
    var lowest=rr.length?rr[rr.length-1]:null;rr.forEach(function(r){var p=r[1]?Math.min(1,r[2]/r[1]):null;var lump=data.lump&&r===lowest&&r[0]!=null&&rr.length>1;var me=r[0]!=null&&(r[0]==S.pts||(lump&&S.pts<=r[0]));h+='<tr'+(me?' class="hfo-me"':'')+'><td>'+(r[0]==null?'All':(lump?'≤ '+r[0]:r[0]))+(me?' ← you':'')+'</td><td>'+r[1]+'</td><td>'+(r[2]==null?'—':r[2])+'</td><td>'+pct(p)+'</td><td style="width:30%"><div class="hfo-bar"><i style="width:'+Math.round((p||0)*100)+'%"></i></div></td></tr>'});
    h+='</tbody></table></div>'});
  if(h0.nr_note)h+='<p><b>Who can apply:</b> '+esc(h0.nr_note)+'</p>';
  if(h0.second&&h0.second.permits)h+='<p class="hfo-muted"><b>Second drawing:</b> '+h0.second.permits+' leftover tag'+(h0.second.permits==1?'':'s')+', '+h0.second.applicants+' first-choice applicants, '+h0.second.drawn+' drew.</p>';
  if(h0.drawn_out)h+='<p class="hfo-muted">Agency "drawn out at": residents '+esc(h0.drawn_out.res||'—')+', nonresidents '+esc(h0.drawn_out.nr||'—')+'.</p>';
  h+='<p class="hfo-muted">Source: '+srcLinks(data)+'. Past results don\'t guarantee future odds; quotas and applicant numbers change every year.</p>';
  el.innerHTML=h;bindClose()}
function bindClose(){var c=$('hfo-close');if(c)c.addEventListener('click',function(e){e.preventDefault();S.hunt=null;renderDetail();$('hfo-hunts').scrollIntoView({behavior:'smooth'})})}
function all(){renderControls();renderRules();renderHunts();renderDetail()}
function go(){loadRules().then(function(){return loadState(S.st)}).then(all,all)}
// ---------- events ----------
$('hfo-st').addEventListener('change',function(e){S.st=e.target.value;S.hunt=null;S.q='';S.limit=50;all();go()});
$('hfo-sp').addEventListener('change',function(e){S.sp=e.target.value;S.hunt=null;S.limit=50;all()});
[].forEach.call($('hfo-res').querySelectorAll('button'),function(b){b.addEventListener('click',function(){S.res=b.dataset.v;all()})});
$('hfo-pts').addEventListener('input',function(e){var v=parseInt(e.target.value,10);S.pts=isNaN(v)?0:Math.max(0,Math.min(40,v));renderHunts();renderDetail()});
var qs=new URLSearchParams(location.search);if(qs.get('state'))S.st=qs.get('state');if(qs.get('species'))S.sp=qs.get('species');if(qs.get('res'))S.res=qs.get('res')=='res'?'res':'nr';
all();go();
})();
