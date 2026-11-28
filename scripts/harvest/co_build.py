import re, json, glob, collections
import os
R=os.path.join(os.environ.get('HF_WORK','harvest-work'),'raw/')
out={}
def parse(path, sp):
    hdr=None
    for ln in open(path).read().split('\n'):
        if ln.strip().startswith('Hunt Code'):
            hdr=[h.strip().lower() for h in re.split(r'\s{2,}', ln.strip())][1:]; continue
        m=re.match(r'^\s?([A-Z]{2}(?:[A-Z]\d{2}|\d{3})[A-Z]\d[A-Z])(\*?)\s+(.*)$', ln)
        if not m or not hdr: continue
        tk=m.group(3).split()
        if len(tk)!=len(hdr): continue
        v=dict(zip(hdr,tk))
        f=lambda x: float(x.replace(',','').replace('%',''))
        code=m.group(1)
        try:
            sk='success' if 'success' in v else 'success*'
            e={'s':f(v[sk]),'h':int(f(v.get('hunters',v.get('sold','0')))),'k':int(f(v['harvest']))}
            if 'hunters' not in v: e['per_lic']=1
        except Exception: continue
        if m.group(2): e['few']=1
        # draw-odds id: E-E-001-E1-R
        did=f"{code[0]}-{code[1]}-{code[2:5]}-{code[5:7]}-{code[7]}"
        out[did]=e
for sp,f in [('elk','co_elk'),('deer','co_deer'),('antelope','co_pronghorn'),('moose','co_moose'),('sheep','co_sheep'),('goat','co_goat'),('sheep','co_dsheep'),('bear','co_bear')]:
    parse(R+f+'.txt', sp)
d=json.load(open(os.path.join(os.environ.get('HF_REPO','.'),'data/')+'co.json'))
hit=collections.Counter(); tot=collections.Counter(); miss=[]
for h in d['hunts']:
    tot[h['sp']]+=1
    if h['id'] in out: hit[h['sp']]+=1
    else: miss.append(h['id'])
print(len(out),{s:f"{hit[s]}/{tot[s]}" for s in tot}); print(miss[:30])
json.dump(out,open(os.path.join(os.environ.get('HF_WORK','harvest-work'),'co_harvest_raw.json'),'w'))
