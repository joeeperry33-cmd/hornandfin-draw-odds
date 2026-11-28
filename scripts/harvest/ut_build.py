import re, json, os, collections
R=os.environ.get('HARVEST_RAW','/home/user/harvest/raw/')
out={}
# 2025 preliminary all-hunts table: Hunt# Species Name Type Weapon Sex Permits Hunters Harvest Success Days Satisfaction
for ln in open(R+'ut_2025_gs_buck_deer_hr-preliminary.txt'):
    m=re.match(r'^\s*([A-Z]{2}\d{4})\s+(.*?)\s+(\d[\d,]*)\s+(\d[\d,]*)\s+(\d[\d,]*)\s+([\d.]+)\s+([\d.]+|-)\s+([\d.]+|-)\s*$', ln)
    if not m: continue
    code=m.group(1); f=lambda x:float(x.replace(',',''))
    out[code]={'s':f(m.group(6)),'h':int(f(m.group(4))),'k':int(f(m.group(5))),'permits':int(f(m.group(3)))}
    if m.group(7)!='-': out[code]['dd']=f(m.group(7))
# 2025 bighorn sheep per-hunter records -> aggregate
agg=collections.defaultdict(lambda:[0,0])
for ln in open(R+'ut_sheep_2025.txt'):
    m=re.match(r'^\s*\d+\s+2025\s+([A-Z]{2}\d{4})\s+([YN])\s+([YN])', ln)
    if m and m.group(2)=='Y':
        agg[m.group(1)][0]+=1; agg[m.group(1)][1]+= m.group(3)=='Y'
for c,(h,k) in agg.items():
    if c not in out: out[c]={'s':round(100*k/h,1),'h':h,'k':k}
d=json.load(open('/home/user/hornandfin-draw-odds/data/ut.json'))
hit=collections.Counter(); tot=collections.Counter(); miss=[]
for h in d['hunts']:
    tot[h['sp']]+=1
    if h['id'] in out: hit[h['sp']]+=1
    else: miss.append(h['id'])
print(len(out),{s:f"{hit[s]}/{tot[s]}" for s in tot}); print(miss[:40])
json.dump(out,open('/home/user/harvest/ut_harvest_raw.json','w'))
