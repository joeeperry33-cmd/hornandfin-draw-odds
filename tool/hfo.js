(function(){
var BASE=(window.HFO_BASE||'https://cdn.jsdelivr.net/gh/joeeperry33-cmd/hornandfin-draw-odds@main/');
var STATES=[['al','Alabama'],['ak','Alaska'],['az','Arizona'],['ar','Arkansas'],['ca','California'],['co','Colorado'],['ct','Connecticut'],['de','Delaware'],['fl','Florida'],['ga','Georgia'],['hi','Hawaii'],['id','Idaho'],['il','Illinois'],['in','Indiana'],['ia','Iowa'],['ks','Kansas'],['ky','Kentucky'],['la','Louisiana'],['me','Maine'],['md','Maryland'],['ma','Massachusetts'],['mi','Michigan'],['mn','Minnesota'],['ms','Mississippi'],['mo','Missouri'],['mt','Montana'],['ne','Nebraska'],['nv','Nevada'],['nh','New Hampshire'],['nj','New Jersey'],['nm','New Mexico'],['ny','New York'],['nc','North Carolina'],['nd','North Dakota'],['oh','Ohio'],['ok','Oklahoma'],['or','Oregon'],['pa','Pennsylvania'],['ri','Rhode Island'],['sc','South Carolina'],['sd','South Dakota'],['tn','Tennessee'],['tx','Texas'],['ut','Utah'],['vt','Vermont'],['va','Virginia'],['wa','Washington'],['wv','West Virginia'],['wi','Wisconsin'],['wy','Wyoming']];
var SPN={elk:'Elk',deer:'Deer',antelope:'Pronghorn',moose:'Moose',caribou:'Caribou',sheep:'Bighorn sheep',goat:'Mountain goat',bison:'Bison',bear:'Black bear',brown_bear:'Brown bear'};
function spName(k){return (S.st=='ak'&&k=='sheep')?'Dall sheep':(SPN[k]||k)}
var SPORDER=['elk','deer','antelope','moose','sheep','goat','bison','bear','brown_bear','caribou'];
var POOLS={res:'Residents',nr:'Nonresidents',all:'All applicants',nr_special:'Nonresidents (special price)',nr_rand:'Nonresidents (random draw)',nr_special_rand:'Nonresidents (special price, random draw)',out:'Outfitter pool (resident or nonresident with an outfitter)',youth_res:'Youth residents',youth_nr:'Youth nonresidents',landowner:'Landowners'};
var RESPOOLS={res:['res','youth_res','landowner'],nr:['nr','nr_special','nr_rand','nr_special_rand','out','youth_nr']};
var $=function(id){return document.getElementById(id)};
var S={st:'co',sp:'elk',res:'nr',pts:0,q:'',sort:'apps',dir:-1,limit:50,onlyMine:false,hunt:null,weapon:'all',tab:'likely',unit:'',uq:''};
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
  for(var i=0;i<s.length;i++){var ok=true;for(var j=i;j<s.length;j++)if(s[j][2]<s[j][1]-0.01&&!(j>i&&s[j][1]<=2)){ok=false;break}if(ok)return s[i][0]}return null}
function lowestDrew(rows){var s=rows.filter(function(r){return r[0]!=null&&r[2]>0});if(!s.length)return null;return Math.min.apply(null,s.map(function(r){return r[0]}))}
function levelAt(rows,p){var best=null;rows.forEach(function(r){if(r[0]!=null&&r[1]>0&&r[0]<=p&&(best==null||r[0]>best[0]))best=r});return best}
function oddsAt(h,k,data,p){var rows=rowsFor(h,k,data);var r;var nz=rows.filter(function(x){return x[0]!=null&&x[1]>0});
  if(nz.length&&p<Math.min.apply(null,nz.map(function(x){return x[0]}))){var q=h.q||{},tags=q[k]!=null?q[k]:q.all,dr=rows.reduce(function(a,x){return a+(x[2]||0)},0),ap=rows.reduce(function(a,x){return a+(x[1]||0)},0);
    if(tags!=null&&dr<tags-0.5&&dr>=ap-0.5&&!(data.combine&&data.combine[k]))r=1;else if(/pref|hybrid/.test(h.system||data.system||''))r=0;else r=rateAt(rows,p)}else r=rateAt(rows,p);var c=data.combine&&data.combine[k];if(c&&h[c]&&h[c].length&&r!=null){var pr=rateAt(h[c],p);if(pr!=null)r=r+(1-r)*pr}return r}
function cumulative(fn,p,years,gain){var miss=1;for(var y=0;y<years;y++){var r=fn(p+(gain?y:0));if(r==null)return null;miss*=(1-r)}return 1-miss}
function gains(data,h){var s=(h&&h.system)||(data&&data.system);return !!s&&s!='random'&&s!='none'}
function primary(h,data){var ks=poolsFor(h,data);return ks.length?ks[0]:null}
// ---------- render ----------
function renderControls(){var st=$('hfo-st');if(!st.options.length){STATES.forEach(function(s){st.add(new Option(s[1],s[0]))})}st.value=S.st;
  var r=rules&&rules[S.st],sps=r?Object.keys(r.species).sort(function(a,b){return SPORDER.indexOf(a)-SPORDER.indexOf(b)}):['elk','deer'];var data=cache[S.st];
  if(data&&data.hunts){data.hunts.forEach(function(h){if(sps.indexOf(h.sp)<0)sps.push(h.sp)})}
  if(sps.indexOf(S.sp)<0){if(r)S.sp=sps[0];else sps.unshift(S.sp)}var sp=$('hfo-sp');sp.innerHTML='';sps.forEach(function(k){sp.add(new Option(spName(k),k))});sp.value=S.sp;
  [].forEach.call($('hfo-res').querySelectorAll('button'),function(b){b.setAttribute('aria-pressed',b.dataset.v==S.res?'true':'false')});$('hfo-pts').value=S.pts}
function renderRules(){var el=$('hfo-rules'),r=rules&&rules[S.st];if(!r){el.innerHTML='<p class="hfo-muted">Loading the rules…</p>';return}
  var v=r.species[S.sp];var nm=stateName(S.st);
  if(!v){el.innerHTML='<h3>'+esc(nm)+' '+esc(spName(S.sp))+'</h3>'+(r.page_slug?'<p>See our <a href="/hunting-guides/'+esc(r.page_slug)+'/">'+esc(nm)+' draw guide</a>.</p>':'')+(r.otc?'<p>'+esc(r.otc)+'</p>':'');return}
  if(v.system=='none'){el.innerHTML='<h3>'+esc(nm)+' '+esc(spName(S.sp).toLowerCase())+': no draw needed</h3><p>'+esc(v.system_summary||'Tags are sold over the counter; no points or drawing.')+'</p>'+(r.otc?'<p class="hfo-muted">'+esc(r.otc)+'</p>':'')+srcList(v);return}
  var who=S.res=='res'?v.resident||{}:v.nonresident||{};
  var h='<h3>How '+esc(nm)+' '+esc((spName(S.sp)).toLowerCase())+' draws work</h3><p>'+esc(v.system_summary)+'</p>';
  if(v.allocation&&v.allocation.length){h+='<ul>'+v.allocation.map(function(a){return '<li>'+(a.pct!=null?'<b>'+a.pct+'%</b> — ':'')+esc(a.pool)+'</li>'}).join('')+'</ul>'}
  h+='<div class="hfo-facts"><div class="hfo-fact"><b>'+(S.res=='res'?'Resident':'Nonresident')+' cost to apply</b>'+(who.point_only_fee!=null&&who.point_only_fee!==who.application_fee?'Point: '+money(who.point_only_fee)+'<br>':'')+(who.application_fee!=null?'Application: '+money(who.application_fee):(who.point_only_fee!=null?'Point: '+money(who.point_only_fee):'—'))+'</div>'+
     '<div class="hfo-fact"><b>Nonresident share</b>'+esc(v.nonresident_quota||'—')+'</div>'+
     '<div class="hfo-fact"><b>You lose points if</b>'+esc(v.lose_points_if||'—')+'</div></div>';
  if(v.waiting_period&&!/^none/i.test(v.waiting_period))h+='<p class="hfo-muted"><b>Waiting period:</b> '+esc(v.waiting_period)+'</p>';
  if(r.page_slug)h+='<p><a class="hfo-btn alt" href="/hunting-guides/'+esc(r.page_slug)+'/">Full '+esc(nm)+' points guide</a></p>';else h+=srcList(v);el.innerHTML=h}
function srcList(v){var L=(v&&v.sources)||[];return L.length?'<p class="hfo-muted">Source: '+L.slice(0,2).map(function(x){var u=typeof x=='string'?x:x.url,l=typeof x=='string'?x.replace(/^https?:\/\/(www\.)?/,'').split('/')[0]:x.label;return '<a href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(l)+'</a>'}).join(', ')+'</p>':''}
function weaponOf(n){n=n||'';if(/archery|\bbow|bowhunt/i.test(n))return 'archery';if(/muzzle/i.test(n))return 'muzzle';if(/rifle|any legal|\balw\b|any weapon|centerfire/i.test(n))return 'rifle';return 'other'}
function huntRows(data){var hs=data.hunts.filter(function(h){return h.sp==S.sp&&(S.weapon=='all'||weaponOf(h.name)==S.weapon)});var out=[];
  hs.forEach(function(h){var k=primary(h,data);if(!k)return;var rows=rowsFor(h,k,data);
    var q=h.q||{};var tags=k=='all'?q.all:(q[k]!=null?q[k]:(q.all!=null?q.all:null));
    var lv=levelAt(rows,S.pts);out.push({h:h,k:k,rows:rows,n:lv?lv[1]:null,odds:oddsAt(h,k,data,S.pts),full:fullAt(rows),low:lowestDrew(rows),tags:tags,apps:rows.reduce(function(s,r){return s+(r[1]||0)},0)})});
  return out}
function renderHunts(){var el=$('hfo-hunts'),data=cache[S.st],r=rules&&rules[S.st],v=r&&r.species[S.sp],nm=stateName(S.st);
  if(data===undefined){el.innerHTML='<p class="hfo-muted">Loading draw results…</p>';return}
  if(!data||!data.hunts||!data.hunts.some(function(h){return h.sp==S.sp})){el.innerHTML=tierPanel(v,nm,data);return}
  var list=huntRows(data);var ql=S.q.toLowerCase();
  if(ql)list=list.filter(function(x){return (x.h.id+' '+x.h.name).toLowerCase().indexOf(ql)>=0});
  if(S.onlyMine)list=list.filter(function(x){return x.odds!=null&&x.odds>=0.75});
  var key=S.sort,d=S.dir;list.sort(function(a,b){var A=a[key],B=b[key];if(key=='id'){A=a.h.id;B=b.h.id;return A<B?-d:A>B?d:0}if(A==null)A=-1;if(B==null)B=-1;return (A-B)*d});
  var pointsSys=gains(data);
  var h='<h3>Every '+esc(nm)+' '+esc((spName(S.sp)).toLowerCase())+' hunt</h3><p class="hfo-muted">'+esc(data.year)+' draw results from '+srcLinks(data)+'. '+esc((S.sp=='elk'||S.sp=='deer'||S.st=='ak')?(data.about||''):'')+'</p>';
  (data.notes||[]).forEach(function(n){h+='<div class="hfo-note">'+esc(n)+'</div>'});
  h+='<div class="hfo-searchrow"><input type="search" id="hfo-q" placeholder="Search hunt code, unit or area" value="'+esc(S.q)+'"><label class="hfo-check"><input type="checkbox" id="hfo-mine" '+(S.onlyMine?'checked':'')+'> Only hunts I\'d likely draw (75%+)</label></div>';
  h+='<div class="hfo-tablewrap"><table><thead><tr><th data-k="id">Hunt</th><th data-k="tags">Tags</th><th data-k="apps" class="hfo-x">Applicants</th><th data-k="odds">'+(pointsSys?'Odds at '+S.pts+' pts':'Draw odds')+'</th>'+(pointsSys?'<th data-k="full" class="hfo-x">Everyone drew at</th><th data-k="low" class="hfo-x">Lowest drew</th>':'')+'</tr></thead><tbody>';
  list.slice(0,S.limit).forEach(function(x,i){h+='<tr class="hfo-row" data-i="'+esc(x.h.id)+'"><td><b>'+esc(x.h.id)+'</b><br><span class="hfo-muted">'+esc(x.h.name)+'</span></td><td>'+(x.tags==null?'—':x.tags)+'</td><td class="hfo-x">'+x.apps+'</td><td>'+pill(x.odds)+'</td>'+(pointsSys?'<td class="hfo-x">'+(x.full==null?'Not everyone':x.full+' pts')+'</td><td class="hfo-x">'+(x.low==null?'—':x.low+' pts')+'</td>':'')+'</tr>'});
  h+='</tbody></table></div>';
  if(!list.length){var other=S.res=='res'?'nr':'res',saved=S.res;S.res=other;var n2=huntRows(data).length;S.res=saved;
    h+=(n2&&!S.q&&!S.onlyMine)?'<p>'+esc(nm)+' '+esc(spName(S.sp).toLowerCase())+' has no '+(S.res=='nr'?'nonresident':'resident')+' draw results. <button class="hfo-btn alt" type="button" id="hfo-swap">Show '+(other=='res'?'resident':'nonresident')+' results ('+n2+' hunts)</button></p>':'<p>No hunts match.</p>'}
  h+='<p class="hfo-muted" style="margin-top:10px">Showing '+Math.min(S.limit,list.length)+' of '+list.length+' hunts. '+(list.length>S.limit?'<button class="hfo-btn alt" id="hfo-more" type="button">Show more</button>':'')+'</p>';
  el.innerHTML=h;
  $('hfo-q').addEventListener('input',function(e){S.q=e.target.value;S.limit=50;var pos=e.target.selectionStart;renderHunts();var q=$('hfo-q');q.focus();q.setSelectionRange(pos,pos)});
  $('hfo-mine').addEventListener('change',function(e){S.onlyMine=e.target.checked;renderHunts()});
  if($('hfo-swap'))$('hfo-swap').addEventListener('click',function(){S.res=S.res=='res'?'nr':'res';all()});
  if($('hfo-more'))$('hfo-more').addEventListener('click',function(){S.limit+=100;renderHunts()});
  [].forEach.call(el.querySelectorAll('th[data-k]'),function(th){th.addEventListener('click',function(){var k=th.dataset.k;if(S.sort==k)S.dir*=-1;else{S.sort=k;S.dir=k=='id'?1:-1}renderHunts()})});
  [].forEach.call(el.querySelectorAll('tr.hfo-row'),function(tr){tr.addEventListener('click',function(){S.hunt=tr.dataset.i;renderDetail();$('hfo-detail').scrollIntoView({behavior:'smooth',block:'start'})})})}
function srcLinks(data){var KW={elk:/elk/i,deer:/deer|buck/i,antelope:/prong|antelope/i,moose:/moose/i,sheep:/sheep|bighorn/i,goat:/goat/i,bison:/bison/i,bear:/bear/i,brown_bear:/bear/i,caribou:/caribou/i};var L=(data.sources||[]).filter(function(s){return !/api|endpoint/i.test(s.label)});var re=KW[S.sp];var M=re?L.filter(function(s){return re.test(s.label)}):[];if(!M.length){var other=/elk|deer|buck|prong|antelope|moose|sheep|bighorn|goat|bison|bear|caribou/i;M=L.filter(function(s){return !other.test(s.label)})}return (M.length?M:L).slice(0,2).map(function(s){return '<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.label)+'</a>'}).join(', ')||'the state wildlife agency'}
function tierPanel(v,nm,data){var h='<h3>What it usually takes</h3>';
  if(S.st=='wa')h+='<div class="hfo-note">Washington hasn\'t published hunt-by-hunt drawing results since 2021, so we can\'t show unit odds. The ranges below are general guidance.</div>';
  else if(v&&v.system=='none')return '<h3>No draw for '+esc(spName(S.sp).toLowerCase())+' in '+esc(nm)+'</h3><p>'+esc(v.system_summary||'')+'</p>';
  else if(!(v&&v.tiers&&v.tiers.length))return '<h3>Hunt-by-hunt results</h3><div class="hfo-note">'+esc(nm)+' doesn\'t publish '+esc(spName(S.sp).toLowerCase())+' draw results by hunt and point level, so we can\'t show unit odds. The rules above explain how the draw works.</div>';
  else h+='<div class="hfo-note">'+(data&&data.hunts&&data.hunts.length?'Hunt-by-hunt results for '+esc(nm)+' '+esc(spName(S.sp).toLowerCase())+' aren\'t available.':esc(nm)+' doesn\'t publish '+esc(spName(S.sp).toLowerCase())+' draw results by hunt.')+' The guidance below is general.</div>';
  var t=(v&&v.tiers)||[];if(!t.length)return h+'<p>See the full guide for details.</p>';
  var hasPts=t.some(function(x){return x.typical_points_resident||x.typical_points_nonresident});
  h+='<div class="hfo-tablewrap"><table><thead><tr><th>Hunt type</th><th>Examples</th>'+(hasPts?'<th>Residents</th><th>Nonresidents</th>':'')+'<th>What to expect</th></tr></thead><tbody>';
  t.forEach(function(x){h+='<tr><td><b>'+esc(x.tier)+'</b></td><td>'+esc(x.example_hunts||'')+'</td>'+(hasPts?'<td>'+esc(x.typical_points_resident||'—')+'</td><td>'+esc(x.typical_points_nonresident||'—')+'</td>':'')+'<td>'+esc(x.note||'')+'</td></tr>'});
  return h+'</tbody></table></div>'}
function renderDetail(){var el=$('hfo-detail'),data=cache[S.st];if(!S.hunt||!data||!data.hunts){el.hidden=true;return}
  var h0=data.hunts.filter(function(h){return h.id==S.hunt&&h.sp==S.sp})[0];if(!h0){el.hidden=true;return}el.hidden=false;
  var keys=poolsFor(h0,data);var pointsSys=gains(data,h0);var k=keys[0];var rows=k?rowsFor(h0,k,data):[];
  var fn=function(p){return oddsAt(h0,k,data,p)};var now=fn(S.pts),five=cumulative(fn,S.pts,5,pointsSys),full=fullAt(rows);
  var h='<p class="hfo-muted"><a href="#" id="hfo-close">← Back to all hunts</a></p><h3>'+esc(h0.id)+(h0.name?' — '+esc(h0.name):'')+'</h3>';if(h0.url)h+='<p class="hfo-muted"><a href="'+esc(h0.url)+'" target="_blank" rel="noopener">Hunt details, boundaries and rules from the state agency →</a></p>';
  if(!k){h+='<p>No '+(S.res=='res'?'resident':'nonresident')+' applicants or tags in this hunt last year'+(S.res=='nr'?' (it may be resident-only)':'')+'.</p>';el.innerHTML=h;bindClose();return}
  h+='<div class="hfo-big"><div class="hfo-stat"><b>'+pct(now)+'</b><span>'+(pointsSys?'chance last year with '+S.pts+' point'+(S.pts==1?'':'s')+(data.combine&&data.combine[k]?' (points draw + random draw)':''):'of applicants drew last year')+'</span></div>'+
     '<div class="hfo-stat"><b>'+pct(five)+'</b><span>chance of drawing at least once in 5 years'+(pointsSys?', gaining a point each year':'')+', if results look like last year</span></div>'+
     '<div class="hfo-stat"><b>'+(pointsSys?(full==null?'—':full):(h0.q&&h0.q[k]!=null?h0.q[k]:(h0.q&&h0.q.all!=null?h0.q.all:'—')))+'</b><span>'+(pointsSys?(full==null?'points where everyone drew (nobody was guaranteed)':'points where everyone drew last year'):(h0.q&&h0.q[k]!=null?'tags for this pool':'tags in this hunt'))+'</span></div></div>';
  var lvl=null;rows.forEach(function(r){if(r[0]!=null&&r[1]>0&&r[0]<=S.pts&&(lvl==null||r[0]>lvl[0]))lvl=r});if(pointsSys&&lvl&&lvl[1]<5)h+='<p class="hfo-muted">Only '+lvl[1]+' applicant'+(lvl[1]==1?'':'s')+' had '+lvl[0]+' point'+(lvl[0]==1?'':'s')+' last year, so treat that percentage with caution.</p>';
  if(pointsSys&&full!=null&&S.pts<full)h+='<p>You\'re <b>'+(full-S.pts)+' point'+(full-S.pts==1?'':'s')+'</b> short of a sure thing based on last year. Point creep often pushes that line up a point every year or two, so plan on a little longer.</p>';
  if(data.system&&/bonus/.test(data.system))h+='<p class="hfo-muted">This is a bonus-point state, so every applicant has some chance. Extra points add entries; they don\'t guarantee a tag.</p>';
  keys.forEach(function(kk){var rr=rowsFor(h0,kk,data);var isEst=rr.length&&rr[0][3];
    h+='<h4>'+esc(POOLS[kk]||kk)+(h0.q&&h0.q[kk]!=null?' · '+h0.q[kk]+' tag'+(h0.q[kk]==1?'':'s'):'')+'</h4><div class="hfo-tablewrap"><table><thead><tr><th>'+(rr.length&&rr[0][0]!=null?'Points':'')+'</th><th>Applicants</th><th>'+(isEst?'Drew (est.)':'Drew')+'</th><th>Odds</th><th class="hfo-x"></th></tr></thead><tbody>';
    var lowest=rr.length?rr[rr.length-1]:null;rr.forEach(function(r){var p=r[1]?Math.min(1,r[2]/r[1]):null;var lump=data.lump&&r===lowest&&r[0]!=null&&rr.length>1;var me=r[0]!=null&&(r[0]==S.pts||(lump&&S.pts<=r[0]));h+='<tr'+(me?' class="hfo-me"':'')+'><td>'+(r[0]==null?'All':(lump?'≤ '+r[0]:r[0]))+(me?' ← you':'')+'</td><td>'+r[1]+'</td><td>'+(r[2]==null?'—':r[2])+'</td><td>'+pct(p)+'</td><td class="hfo-x" style="width:30%"><div class="hfo-bar"><i style="width:'+Math.round((p||0)*100)+'%"></i></div></td></tr>'});
    h+='</tbody></table></div>'});
  if(h0.nr_note)h+='<p><b>Who can apply:</b> '+esc(h0.nr_note)+'</p>';
  if(h0.second&&h0.second.permits)h+='<p class="hfo-muted"><b>Second drawing:</b> '+h0.second.permits+' leftover tag'+(h0.second.permits==1?'':'s')+', '+h0.second.applicants+' first-choice applicants, '+h0.second.drawn+' drew.</p>';
  if(h0.drawn_out)h+='<p class="hfo-muted">Agency "drawn out at": residents '+esc(h0.drawn_out.res||'—')+', nonresidents '+esc(h0.drawn_out.nr||'—')+'.</p>';
  h+='<p class="hfo-muted">Source: '+srcLinks(data)+'. Past results don\'t guarantee future odds; quotas and applicant numbers change every year.</p>';
  el.innerHTML=h;bindClose()}
function bindClose(){var c=$('hfo-close');if(c)c.addEventListener('click',function(e){e.preventDefault();S.hunt=null;renderDetail();$('hfo-hunts').scrollIntoView({behavior:'smooth'})})}
function demand(x){return x.tags?x.apps/x.tags:0}
function bestSort(a,b,pointsSys){if(pointsSys){var A=a.full!=null?a.full:(a.low!=null?a.low:0),B=b.full!=null?b.full:(b.low!=null?b.low:0);if(A!=B)return B-A}else if(Math.abs(b.odds-a.odds)>0.001)return b.odds-a.odds;return (b.tags||0)-(a.tags||0)||b.apps-a.apps}
function renderBest(){var el=$('hfo-best');if(!el){el=document.createElement('div');el.className='hfo-panel';el.id='hfo-best';$('hfo-detail').parentNode.insertBefore(el,$('hfo-detail'))}
  var data=cache[S.st];if(!data||!data.hunts||!data.hunts.some(function(h){return h.sp==S.sp})){el.hidden=true;return}el.hidden=false;
  var pointsSys=gains(data),nm=stateName(S.st),spn=(spName(S.sp)).toLowerCase(),who=S.res=='res'?'resident':'nonresident';
  var all=huntRows(data).filter(function(x){return x.odds!=null});
  function solid(x){return !pointsSys||x.full==null||x.full<=S.pts||(x.n!=null&&x.n>=5)}
  var likely=all.filter(function(x){return x.odds>=0.75&&solid(x)}),good=all.filter(function(x){return x.odds>=0.4&&solid(x)&&!(x.odds>=0.75)});
  likely.sort(function(a,b){return bestSort(a,b,pointsSys)});good.sort(function(a,b){return b.odds-a.odds||bestSort(a,b,pointsSys)});
  var list=S.tab=='good'?good:likely;
  var hasW=data.hunts.some(function(h){return h.sp==S.sp&&weaponOf(h.name)!='other'});
  var h='<h3>'+(pointsSys?esc(nm)+' '+spn+' hunts you\'d likely draw with '+S.pts+' point'+(S.pts==1?'':'s'):'Your best '+esc(nm)+' '+spn+' odds as a '+who)+'</h3>';
  h+='<p class="hfo-muted">Based on last year\'s results for '+who+'s'+(pointsSys?' with your points':'')+'. <b>Likely</b> means at least 75% drew; <b>good chance</b> means 40–74%. '+(pointsSys?'Hunts that took the most points are listed first, so the best hunts you can get are at the top.':'Your best odds are listed first.')+'</p>';
  h+='<div class="hfo-searchrow"><div class="hfo-seg hfo-tabs" style="flex:1;min-width:240px"><button type="button" data-t="likely" aria-pressed="'+(S.tab!='good')+'">Likely ('+likely.length+')</button><button type="button" data-t="good" aria-pressed="'+(S.tab=='good')+'">Good chance ('+good.length+')</button></div>'+
     (hasW?'<select id="hfo-weapon" style="max-width:220px"><option value="all">All weapons</option><option value="archery">Archery</option><option value="muzzle">Muzzleloader</option><option value="rifle">Rifle / any weapon</option></select>':'')+'</div>';
  if(!list.length){h+='<p>'+(S.tab=='good'?'No hunts fell in the 40–74% range':'No hunts drew 75% or more of '+who+'s'+(pointsSys?' with '+S.pts+' point'+(S.pts==1?'':'s'):''))+' last year'+(S.weapon!='all'?' for that weapon':'')+'. '+(S.tab=='good'?'':'Check the Good chance tab'+(pointsSys?', or keep building points':'')+'.')+'</p>'}
  else{h+='<div class="hfo-tablewrap"><table><thead><tr><th>Hunt</th><th>Your odds</th><th>Tags</th><th class="hfo-x">Applicants per tag</th>'+(pointsSys?'<th class="hfo-x">Everyone drew at</th>':'')+'</tr></thead><tbody>';
    list.slice(0,15).forEach(function(x){h+='<tr class="hfo-row" data-i="'+esc(x.h.id)+'"><td><b>'+esc(x.h.id)+'</b><br><span class="hfo-muted">'+esc(x.h.name)+'</span></td><td>'+pill(x.odds)+'</td><td>'+(x.tags==null?'—':x.tags)+'</td><td class="hfo-x">'+(x.tags?(x.apps/x.tags).toFixed(1):'—')+'</td>'+(pointsSys?'<td class="hfo-x">'+(x.full==null?'Not everyone':x.full+' pts')+'</td>':'')+'</tr>'});
    h+='</tbody></table></div>';
    if(list.length>15)h+='<p class="hfo-muted" style="margin-top:10px">Showing the top 15 of '+list.length+'. <a href="#" id="hfo-seeall">See them all in the full list</a>.</p>'}
  h+='<p class="hfo-muted" style="margin-top:10px">Odds change every year with quotas and point creep. Click a hunt for the full breakdown.</p>';
  el.innerHTML=h;
  [].forEach.call(el.querySelectorAll('.hfo-tabs button'),function(b){b.addEventListener('click',function(){S.tab=b.dataset.t;renderBest()})});
  var w=$('hfo-weapon');if(w){w.value=S.weapon;w.addEventListener('change',function(){S.weapon=w.value;S.limit=50;renderBest();renderHunts()})}
  var sa=$('hfo-seeall');if(sa)sa.addEventListener('click',function(e){e.preventDefault();S.onlyMine=S.tab!='good';S.sort='odds';S.dir=-1;renderHunts();$('hfo-hunts').scrollIntoView({behavior:'smooth'})});
  [].forEach.call(el.querySelectorAll('tr.hfo-row'),function(tr){tr.addEventListener('click',function(){S.hunt=tr.dataset.i;renderDetail();$('hfo-detail').scrollIntoView({behavior:'smooth',block:'start'})})})}
// ---------- unit lookup ----------
function renderUnitKeep(){if(S.unit)renderUnit()}
function unitOf(h,st){var n=h.name||'';if(!n)return 'Hunt '+h.id;var m;
  if(st=='ut')return n.split(' — ')[0].trim();
  if(st=='nv'){m=n.match(/^(Units? .*?), (Elk|Mule Deer|Deer|Antelope|Pronghorn|Bighorn|Mountain|Desert|California|Rocky)/);return m?m[1]:n.split(',')[0]}
  if(st=='ca'){m=n.match(/^(Zone [A-Z0-9-]+|[A-Z]{1,2}-?\d+[A-Z]?)\b/);if(m)return m[1];return n.split(/ Period| - | Late| Early| Archery| Either| Buck| Bull| Antlerless| General| Apprentice| Muzzle| Hunt/)[0].trim()}
  var u=n.split(/,| \| |: | — /)[0].trim();if(st=='or'){m=u.match(/^(.*?\bUnits?)\b/);if(m)u=m[1]}return u}
function natKey(u){return u.replace(/\d+/g,function(d){return ('00000'+d).slice(-5)}).toLowerCase()}
function unitList(data){var m={};data.hunts.forEach(function(h){if(h.sp!=S.sp)return;var u=unitOf(h,S.st);m[u]=(m[u]||0)+1});return Object.keys(m).sort(function(a,b){return natKey(a)<natKey(b)?-1:1}).map(function(u){return [u,m[u]]})}
function primaryFor(h,data,res){var ks=[];(RESPOOLS[res]||[]).forEach(function(k){if(h[k]&&h[k].length&&k.indexOf('youth')<0&&k!='landowner')ks.push(k)});if(!ks.length&&h.all&&h.all.length)ks.push('all');return ks[0]||null}
function ptsTxt(n){return n+' pt'+(n==1?'':'s')}
function needCell(h,data,res,pointsSys){var k=primaryFor(h,data,res);if(!k)return '<td class="hfo-nd">'+(res=='nr'?'Resident only':'—')+'</td>';
  var rows=rowsFor(h,k,data),q=h.q||{},tags=q[k]!=null?q[k]:null;
  if(!pointsSys){var o=oddsAt(h,k,data,0);return '<td>'+pill(o)+(tags!=null?'<br><span class="hfo-muted">'+tags+' tag'+(tags==1?'':'s')+'</span>':'')+'</td>'}
  var tg=tags!=null?' · '+tags+' tag'+(tags==1?'':'s'):'';
  if(rows.length&&rows.every(function(r){return r[0]==null})){var A=rows.reduce(function(a,r){return a+(r[1]||0)},0),D=rows.reduce(function(a,r){return r[2]==null?a:a+(r[2]||0)},0),known=rows.some(function(r){return r[2]!=null});
    return known&&A?'<td>'+pill(Math.min(1,D/A))+'<br><span class="hfo-muted">'+D+' of '+A+' drew; no point breakdown published</span></td>':'<td class="hfo-nd">'+A+' applied; results by points not published</td>'}
  var full=fullAt(rows),low=lowestDrew(rows),apps=rows.reduce(function(a,r){return a+(r[1]||0)},0),dr=rows.reduce(function(a,r){return a+(r[2]||0)},0);
  if(apps&&dr>=apps-0.5)return '<td><b class="hfo-need">0 pts</b><br><span class="hfo-muted">Everyone drew'+tg+'</span></td>';
  if(low==null)return '<td><b class="hfo-need">Nobody drew</b><br><span class="hfo-muted">'+(tags===0?'No tags for this group':apps+' applied')+'</span></td>';
  var mine=oddsAt(h,k,data,S.pts);
  return '<td><b class="hfo-need">'+(full!=null?ptsTxt(full):'No sure thing')+'</b><br><span class="hfo-muted">'+(full!=null?(low<full?'Some drew with '+low:'Everyone drew at '+full):'Not everyone drew at any level; some drew with '+ptsTxt(low))+tg+'</span>'+(res==S.res?'<br><span class="hfo-muted">You ('+ptsTxt(S.pts)+'): </span>'+pill(mine):'')+'</td>'}
function coMissing(hs){if(S.st!='co'||(S.sp!='elk'&&S.sp!='deer'))return '';var have={};hs.forEach(function(h){var p=h.id.split('-');if(p.length==5&&(p[1]=='M'||p[1]=='E'))have[p[3]+'-'+p[4]]=1});
  var std=[['O1-A','Archery'],['O1-M','Muzzleloader'],['O1-R','1st Rifle'],['O2-R','2nd Rifle'],['O3-R','3rd Rifle'],['O4-R','4th Rifle']];
  var miss=std.filter(function(x){return !have[x[0]]&&!(x[0]=='O1-R'&&have['E1-R'])}).map(function(x){return x[1]});if(!miss.length)return '';
  var animal=S.sp=='elk'?'bull':'buck';
  return '<div class="hfo-note"><b>Not in the draw for '+animal+'s here: '+esc(miss.join(', '))+'.</b> '+(S.sp=='elk'?((miss.indexOf('2nd Rifle')>=0||miss.indexOf('3rd Rifle')>=0)?'2nd and 3rd rifle bull tags are sold over the counter in many Colorado units (no draw, no points needed). '+'Any other season listed here had no bull draw in this unit. ':'That season had no bull draw in this unit. '):'Colorado buck tags are all limited, so these seasons weren\'t offered for bucks in this unit. ')+'Check <a href="https://cpw.state.co.us/hunting/big-game/'+S.sp+'" target="_blank" rel="noopener">CPW\'s '+S.sp+' page and big game brochure</a> to confirm.</div>'}
function seasonKey(h){if(S.st!='co')return 0;var p=h.id.split('-');var sx={M:0,E:1,F:2}[p[1]];var se=p[3]||'';var o=se=='E1'?0:/^O/.test(se)?(p[4]=='A'?1:p[4]=='M'?2:2+(+se[1])):/^[WLV]/.test(se)?8:/^P/.test(se)?9:10;return (sx==null?3:sx)*100+o*10+(+se.slice(1)||0)/10}
function shortName(h,u){var n=h.name||'';if(n.indexOf(u)==0)n=n.slice(u.length).replace(/^[\s,:|—-]+/,'');return n||h.id}
function renderUnit(){var el=$('hfo-unit');if(!el){el=document.createElement('div');el.className='hfo-panel hfo-unitpanel';el.id='hfo-unit';var c=document.querySelector('.hfo-controls');c.parentNode.insertBefore(el,c.nextSibling)}
  var data=cache[S.st],nm=stateName(S.st),spn=(spName(S.sp)).toLowerCase();
  if(data===undefined){el.innerHTML='<h3>Points needed by unit</h3><p class="hfo-muted">Loading…</p>';return}
  if(!data||!data.hunts||!data.hunts.some(function(h){return h.sp==S.sp})){el.hidden=true;return}el.hidden=false;
  var units=unitList(data);if(S.unit&&!units.some(function(u){return u[0]==S.unit}))S.unit='';
  var pointsSys=gains(data);
  var h='<h3>'+(pointsSys?'How many points does a unit take?':'What are the odds in a unit?')+'</h3><p class="hfo-muted">Pick a '+esc(nm)+' '+spn+' unit or area to see '+(pointsSys?'how many points it took to draw each hunt there last year, for residents and nonresidents.':'last year\'s draw odds for each hunt there. '+esc(nm)+' has no preference points, so everyone has the same chance.')+'</p>';
  h+='<div class="hfo-combo"><input type="search" id="hfo-uq" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="hfo-ulist" placeholder="Type a unit, e.g. '+esc(units.length?units[Math.min(5,units.length-1)][0]:'')+'" value="'+esc(S.unit||S.uq)+'"><ul id="hfo-ulist" role="listbox" hidden></ul></div>';
  if(S.unit){var hs=data.hunts.filter(function(x){return x.sp==S.sp&&unitOf(x,S.st)==S.unit});hs.sort(function(a,b){return seasonKey(a)-seasonKey(b)});
    h+='<div class="hfo-unithead"><b>'+esc(S.unit)+'</b> · '+hs.length+' '+spn+' hunt'+(hs.length==1?'':'s')+' · '+esc(data.year)+' results</div>';
    h+=coMissing(hs);
    h+='<div class="hfo-tablewrap"><table class="hfo-unittable"><thead><tr><th>Hunt</th><th'+(S.res=='res'?' class="hfo-mycol"':'')+'>Residents'+(pointsSys?' need':'')+'</th><th'+(S.res=='nr'?' class="hfo-mycol"':'')+'>Nonresidents'+(pointsSys?' need':'')+'</th></tr></thead><tbody>';
    hs.forEach(function(x){h+='<tr class="hfo-row" data-i="'+esc(x.id)+'"><td><b>'+esc(x.id)+'</b><br><span class="hfo-muted">'+esc(shortName(x,S.unit))+'</span></td>'+needCell(x,data,'res',pointsSys)+needCell(x,data,'nr',pointsSys)+'</tr>'});
    h+='</tbody></table></div><p class="hfo-muted" style="margin-top:10px">'+(pointsSys?'"Points needed" is the fewest points where everyone who applied drew last year. "Some drew with" is the lowest point level that got lucky'+(/bonus/.test(data.system||'')?' (in a bonus-point state, extra points only add chances)':'')+'. Expect point creep to push these up a bit each year. ':'')+'Click a hunt for the full breakdown.</p>'}
  el.innerHTML=h;
  var inp=$('hfo-uq'),ul=$('hfo-ulist'),act=-1;
  function show(){var q=inp.value.trim().toLowerCase().replace(/^(gmu|unit|units|area|hd|zone)\s*/,'');var m=units.filter(function(u){var l=u[0].toLowerCase();return !q||l.indexOf(q)>=0||l.replace(/^(gmu|units?|area|hd|zone)\s*/,'').indexOf(q)==0});
    m.sort(function(a,b){var A=a[0].toLowerCase().replace(/^(gmu|units?|area|hd|zone)\s*/,''),B=b[0].toLowerCase().replace(/^(gmu|units?|area|hd|zone)\s*/,'');var a0=A.indexOf(q)==0?0:1,b0=B.indexOf(q)==0?0:1;return a0-b0||(natKey(a[0])<natKey(b[0])?-1:1)});
    m=m.slice(0,60);act=-1;ul.innerHTML=m.length?m.map(function(u,i){return '<li role="option" data-u="'+esc(u[0])+'">'+esc(u[0])+' <span>'+u[1]+' hunt'+(u[1]==1?'':'s')+'</span></li>'}).join(''):'<li class="hfo-none">No unit matches</li>';ul.hidden=false;inp.setAttribute('aria-expanded','true')}
  function pick(u){S.unit=u;S.uq='';try{var qs=new URLSearchParams(location.search);qs.set('state',S.st);qs.set('species',S.sp);qs.set('unit',u);history.replaceState(null,'','?'+qs.toString())}catch(e){}renderUnit();var t=$('hfo-unit');if(t)t.scrollIntoView({behavior:'smooth',block:'start'})}
  inp.addEventListener('focus',function(){inp.select();show()});
  inp.addEventListener('input',function(){S.uq=inp.value;show()});
  inp.addEventListener('keydown',function(e){var li=ul.querySelectorAll('li[data-u]');if(e.key=='ArrowDown'||e.key=='ArrowUp'){e.preventDefault();if(ul.hidden)show();act=Math.max(0,Math.min(li.length-1,act+(e.key=='ArrowDown'?1:-1)));[].forEach.call(li,function(x,i){x.classList.toggle('on',i==act);if(i==act)x.scrollIntoView({block:'nearest'})})}
    else if(e.key=='Enter'){e.preventDefault();var t=li[act>=0?act:0];if(t)pick(t.dataset.u)}else if(e.key=='Escape'){ul.hidden=true}});
  ul.addEventListener('mousedown',function(e){var t=e.target.closest('li[data-u]');if(t){e.preventDefault();pick(t.dataset.u)}});
  inp.addEventListener('blur',function(){setTimeout(function(){ul.hidden=true;inp.setAttribute('aria-expanded','false')},150)});
  [].forEach.call(el.querySelectorAll('tr.hfo-row'),function(tr){tr.addEventListener('click',function(){S.hunt=tr.dataset.i;renderDetail();$('hfo-detail').scrollIntoView({behavior:'smooth',block:'start'})})})}
function all(){renderControls();renderUnit();renderRules();renderBest();renderHunts();renderDetail()}
function go(){loadRules().then(function(){return loadState(S.st)}).then(all,all)}
// ---------- events ----------
$('hfo-st').addEventListener('change',function(e){S.st=e.target.value;S.hunt=null;S.unit='';S.uq='';S.q='';S.limit=50;S.weapon='all';all();go()});
$('hfo-sp').addEventListener('change',function(e){S.sp=e.target.value;S.hunt=null;S.unit='';S.uq='';S.limit=50;S.weapon='all';all()});
[].forEach.call($('hfo-res').querySelectorAll('button'),function(b){b.addEventListener('click',function(){S.res=b.dataset.v;all()})});
$('hfo-pts').addEventListener('input',function(e){var v=parseInt(e.target.value,10);S.pts=isNaN(v)?0:Math.max(0,Math.min(40,v));renderUnitKeep();renderBest();renderHunts();renderDetail()});
var qs=new URLSearchParams(location.search);if(qs.get('state'))S.st=qs.get('state');if(qs.get('species'))S.sp=qs.get('species');if(qs.get('res'))S.res=qs.get('res')=='res'?'res':'nr';if(qs.get('unit'))S.unit=qs.get('unit');
all();go();
})();
