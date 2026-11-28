import re, json, os, collections, subprocess, html as H
R=os.environ.get('HARVEST_RAW','/home/user/harvest/raw/')
out={}; spmap={'deer':'deer','elk':'elk','pronghorn':'antelope','moose':'moose','goat':'goat','bear':'bear','sheep':'sheep'}
for g in ['deer','elk','pronghorn','moose','goat','bear','sheep']:
    p=R+f'id_{g}.html'
    if not os.path.exists(p):
        subprocess.run(['curl','-sL','-m','90','-A','Mozilla/5.0','-o',p,f'https://idfg.idaho.gov/ifwis/huntplanner/stats/?season=controlled&game={g}&yr=2025'])
    s=open(p,errors='ignore').read()
    i=s.find('id="stattable"')
    if i<0: print(g,'no table'); continue
    t=s[i:s.find('</table>',i)]
    hdr=[H.unescape(re.sub('<[^>]+>','',x)).strip() for x in re.findall(r'<th[^>]*>(.*?)</th>',t)]
    n=0
    for row in re.findall(r'<tr>(.*?)</tr>',t,re.S):
        c=[H.unescape(re.sub('<[^>]+>','',x)).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>',row,re.S)]
        if len(c)!=len(hdr): continue
        v=dict(zip(hdr,c))
        try: e={'s':float(v['Success%']),'h':int(v['Hunters']),'k':int(v['Harvest'])}
        except: continue
        if v.get('Days'): e['days_total']=int(v['Days'])
        if v.get('%6+Pts'): e['p6']=v['%6+Pts']
        out[(spmap[g],v['Hunt#'])]=e; n+=1
    print(g,n,hdr)
d=json.load(open('/home/user/hornandfin-draw-odds/data/id.json'))
hit=collections.Counter(); tot=collections.Counter(); miss=[]
res={}
for h in d['hunts']:
    tot[h['sp']]+=1
    e=out.get((h['sp'],h['id']))
    if e: hit[h['sp']]+=1; res[h['id']]=e
    else: miss.append((h['sp'],h['id']))
print({s:f"{hit[s]}/{tot[s]}" for s in tot}); print(miss[:30])
print('dup ids in draw file:',len(d['hunts'])-len({h['id'] for h in d['hunts']}))
json.dump(res,open('/home/user/harvest/id_harvest_raw.json','w'))
