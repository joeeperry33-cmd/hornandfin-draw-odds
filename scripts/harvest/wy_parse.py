import re, sys, json
# Parse WGFD harvest report "by Hunt Area" tables (elk, deer, pronghorn layout).
def nums(tokens):
    out=[]
    for t in tokens:
        t=t.replace(',','')
        if t in ('-',): out.append(None); continue
        try: out.append(float(t))
        except: return None
    return out

def parse(path, start_pat, stop_pat, nharv, prefix, type_filter=None):
    lines=open(path).read().split('\n')
    on=False; area=None; res={}
    for ln in lines:
        if re.search(start_pat, ln): on=True; continue
        if on and stop_pat and re.search(stop_pat, ln): on=False; continue
        if not on: continue
        s=ln.strip()
        if not s: continue
        m=re.match(r'^(\d{1,3})\s+([A-Z][A-Za-z\'\.\- ]+?)\s*$', s)
        if m and not re.search(r'\d', m.group(2)):
            area=int(m.group(1)); res.setdefault(area,{'name':m.group(2).strip(),'types':{}}); continue
        if area is None: continue
        s2=re.sub(r'^\([^)]*\)\s*','',s)
        tk=s2.split()
        if not tk: continue
        label=tk[0]
        if label in ('Total','Resident','Nonresident'):
            n=nums(tk[1:])
        elif re.fullmatch(r'\d{1,2}|GEN',label):
            n=nums(tk[1:])
        else: continue
        need=1+nharv+1+1+1+1  # active, harv cols, total, days, success, dph
        if not n or len(n) < need: continue
        rec={'active':n[0],'harvest':n[1+nharv],'days':n[2+nharv],'success':n[3+nharv]}
        if label in ('Total','Resident','Nonresident'):
            res[area][label.lower()]=rec
        else:
            if type_filter and not type_filter(label): continue
            rec['sold']=n[5+nharv] if len(n)>5+nharv else None
            res[area]['types'][label]=rec
    return res

if __name__=='__main__':
    r=parse(*sys.argv[1:3], None, int(sys.argv[3]), '')
    print(json.dumps(r)[:1500]); print(len(r))
