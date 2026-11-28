import re, json, os, glob, collections
R=os.path.join(os.environ.get('HF_WORK','harvest-work'),'raw/')
# ODFW 2025 harvest summaries: one row per hunt per unit, so rows of the same hunt are summed.
agg=collections.defaultdict(lambda:{'h':0,'k':0,'files':set()})
for f in sorted(glob.glob(R+'or_*.txt')):
    col=None; hcols=None
    for ln in open(f):
        if 'Season/Tag/Hunt' in ln or ('Hunt' in ln and 'Success' in ln and col is None):
            i=ln.find('Season/Tag/Hunt'); col=i if i>=0 else ln.find('Hunt')
            hdr=re.split(r'\s{2,}', ln[col:].strip())
            hcols=hdr[1:]  # numeric columns after the hunt column
            continue
        if col is None: continue
        seg=ln[max(0,col-3):]
        m=re.match(r'^\s*(\d{3}[A-Z0-9\-]{0,5}|[A-Z]{1,2}\d{2,3}[A-Z0-9\-]{0,4})\s+(.*\S)\s*$', seg)
        if not m or len(ln)-len(ln.lstrip())>col+2: continue
        tk=m.group(2).split()
        n=len(hcols)            # numeric columns, the last one is "NN%"
        if len(tk)<n+1 or not tk[-1].endswith('%'): continue
        try: nums=[float(x.replace(',','').rstrip('%')) for x in tk[-n:]]
        except ValueError: continue
        h=nums[0]
        ki=None
        for j,c in enumerate(hcols):
            if c.lower().startswith('harvest total') or c.lower()=='harvest' or c.lower().startswith('total harvest'):
                ki=j
        k=nums[ki] if ki is not None else round(nums[-1]*h/100)
        a=agg[m.group(1)]; a['h']+=h; a['k']+=k; a['files'].add(os.path.basename(f))
out={c:{'s':min(100.0,round(100*a['k']/a['h'],1)) if a['h'] else 0,'h':int(a['h']),'k':int(a['k'])} for c,a in agg.items() if a['h']>0}
d=json.load(open(os.path.join(os.environ.get('HF_REPO','.'),'data/')+'or.json'))
hit=collections.Counter(); tot=collections.Counter(); miss=[]; res={}
for h in d['hunts']:
    tot[h['sp']]+=1
    if h['id'] in out: hit[h['sp']]+=1; res[h['id']]=out[h['id']]
    else: miss.append(h['id'])
print(len(out),{s:f"{hit[s]}/{tot[s]}" for s in tot})
for k in ['119A','210','215A','218A','616A1']: print(k,out.get(k))
json.dump(res,open(os.path.join(os.environ.get('HF_WORK','harvest-work'),'or_harvest_raw.json'),'w'))
