import re, json, sys, os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from wy_parse import parse
import os
R=os.path.join(os.environ.get('HF_WORK','harvest-work'),'raw/')
def tbl_end(n): return r'Table %d:'%n

def parse_small(path, start_pat, stop_pat):
    """moose/sheep/goat layout. Each hunt area block ends with a Total row (area total).
    Area and 'Type N' labels are vertically centred, so they can sit on any line of the block;
    each Resident/Nonresident row takes the nearest Type label inside its block."""
    L=open(path).read().replace('Nonresidnet','Nonresident').split('\n')
    i0=next(i for i,l in enumerate(L) if re.search(start_pat,l))
    i1=next((i for i in range(i0+1,len(L)) if re.search(stop_pat,L[i])),len(L))
    L=L[i0+1:i1]
    def f(x):
        try: return float(x)
        except: return None
    res={}; blk=[]
    for idx,ln in enumerate(L):
        blk.append(ln)
        if re.search(r'\bTotal\s+[\d,]', ln) and not re.search(r'All\s+Total',ln):
            # process block
            area=None; name=''; types=[]; rows=[]
            for j,b in enumerate(blk):
                m=re.match(r'^\s{0,3}(\d{1,3})\s+([A-Z][A-Za-z\'\.\-]*(?: [A-Z][A-Za-z\'\.\-]*)*)', b)
                if m:
                    area=int(m.group(1)); name='' if m.group(2).startswith('Type') else m.group(2)
                elif re.match(r'^\s{0,3}(\d{1,3})\s*$', b) or re.match(r'^\s{0,3}(\d{1,3})\s{2,}', b):
                    area=int(re.match(r'^\s*(\d+)',b).group(1))
                for mt in re.finditer(r'Type\s+(\d+)', b): types.append((j,mt.group(1)))
                mr=re.search(r'(Resident|Nonresident|Total)\s+([\d,]+(?:\s+[\d,\.\-%\u2013]+){7,})', b)
                if mr:
                    tk=[t.replace(',','').replace('%','') for t in mr.group(2).split()]
                    if len(tk)<9: continue
                    rows.append((j,mr.group(1),{'active':f(tk[1]),'harvest':f(tk[5]),'days':f(tk[6]),'success':f(tk[8])}))
            blk=[]
            if area is None or not types: continue
            a=res.setdefault(area,{'name':name,'types':{}})
            tnames=sorted(set(t for _,t in types))
            for j,kind,rec in rows:
                if kind=='Total':
                    if len(tnames)==1: a['types'].setdefault(tnames[0],{})['total']=rec
                    a['total']=rec; continue
                t=min(types,key=lambda x:(abs(x[0]-j), x[0]))[1]
                a['types'].setdefault(t,{})[kind.lower()]=rec
            # multi-type areas: build per-type total from its rows
            for t,r in a['types'].items():
                if 'total' not in r:
                    rs=[r[k] for k in ('resident','nonresident') if k in r]
                    h=sum(x['active'] or 0 for x in rs); hv=sum(x['harvest'] or 0 for x in rs)
                    r['total']={'active':h,'harvest':hv,'days':sum(x['days'] or 0 for x in rs),'success':round(100*hv/h,1) if h else None}
    return res

def parse_bison(path):
    L=open(path).read().split('\n'); res={}; area=None; typ=None
    on=False
    for ln in L:
        if 'by Hunt Area' in ln: on=True; continue
        if on and 'Table 4' in ln: break
        if not on: continue
        m=re.match(r'^(\d{1,3})\s+([A-Z][a-z]+)\s+(\d)\s', ln)
        if m: area=int(m.group(1)); typ=m.group(3); res.setdefault(area,{'name':m.group(2),'types':{}})
        mr=re.search(r'(Resident|Nonresident)\s+([\d,]+(?:\s+[\d,\.\-%\u2013]+){7,})', ln)
        if mr and area:
            tk=[t.replace(',','').replace('%','') for t in mr.group(2).split()]
            pend=(mr.group(1).lower(),{'active':float(tk[1]),'harvest':float(tk[5]),'days':float(tk[6]),'success':float(tk[8]) if tk[8][0].isdigit() else None})
            res.setdefault('_p',[]).append(pend)
        if m or (mr and mr.group(1)=='Nonresident'):
            if mr and mr.group(1)=='Nonresident' and area:
                t=res[area]['types'].setdefault(typ,{})
                for k,r in res.pop('_p',[]): t[k]=r
                h=sum(x['active'] for x in t.values()); hv=sum(x['harvest'] for x in t.values())
                t['total']={'active':h,'harvest':hv,'days':sum(x['days'] for x in t.values()),'success':round(100*hv/h,1) if h else None}
    res.pop('_p',None); return res

out={}
def add(sp, prefix, parsed, small=False, type_ok=None):
    for area,a in parsed.items():
        for typ,r in a['types'].items():
            if type_ok and not type_ok(typ): continue
            key=f"{prefix} {area:03d}-{typ}" if typ!='GEN' else f"{prefix} {area:03d}-GEN"
            if small:
                tot=r.get('total') or r.get('resident') or r.get('nonresident')
                if not tot: continue
                e={'success':tot['success'],'hunters':tot['active'],'harvest':tot['harvest'],'days':tot['days']}
                if 'resident' in r and 'nonresident' in r:
                    e['res']=r['resident']['success']; e['nr']=r['nonresident']['success']
            else:
                e={'success':r['success'],'hunters':r['active'],'harvest':r['harvest'],'days':r['days']}
            e['sp']=sp; e['area_name']=a['name']
            if not small and 'total' in a:
                e['area']={'success':a['total']['success'],'res':a.get('resident',{}).get('success'),'nr':a.get('nonresident',{}).get('success')}
            out[key]=e

add('elk','Elk',parse(R+'wy_elk.txt','Table 3: Harvest Statistics by Hunt Area',tbl_end(4),4,''))
mule=parse(R+'wy_deer.txt','Table 7: Mule Deer Harvest Statistics by Hunt Area',tbl_end(8),3,'')
wt=parse(R+'wy_deer.txt','Table 8: White-Tailed Deer Harvest Statistics by Hunt Area',tbl_end(9),3,'')
d0=json.load(open(os.path.join(os.environ.get('HF_REPO','.'),'data/')+'wy.json'))
wt_ids={h['id'] for h in d0['hunts'] if h['sp']=='deer' and 'White' in h['name']}
add('deer','Deer',mule)
tmp=out; out={}
add('deer','Deer',wt)
wt_out=out; out=tmp
for k,v in wt_out.items():
    if k in wt_ids or k not in out: out[k]={**v,'deer_kind':'whitetail'}
for k in list(out):
    if out[k]['sp']=='deer' and 'deer_kind' not in out[k]: out[k]['deer_kind']='mule'
add('antelope','Antelope',parse(R+'wy_pronghorn.txt','Table 3: Harvest Statistics by Hunt Area',tbl_end(4),3,''))
add('moose','Moose',parse_small(R+'wy_moose.txt','By Hunt Area',r'Table 4'),small=True)
add('sheep','Sheep',parse_small(R+'wy_sheep.txt','By Hunt Area',r'Table 4'),small=True)
add('goat','Goat',parse_small(R+'wy_goat.txt','By Hunt Area',r'Table 4'),small=True)
add('bison','Bison',parse_bison(R+'wy_bison.txt'),small=True)
json.dump(out,open(os.path.join(os.environ.get('HF_WORK','harvest-work'),'wy_harvest_raw.json'),'w'),indent=0)
d=json.load(open(os.path.join(os.environ.get('HF_REPO','.'),'data/')+'wy.json'))
ids={h['id']:h['sp'] for h in d['hunts']}
import collections
hit=collections.Counter(); tot=collections.Counter(); miss=[]
for i,sp in ids.items():
    tot[sp]+=1
    if i in out: hit[sp]+=1
    else: miss.append(i)
print('parsed',len(out)); print({s:f"{hit[s]}/{tot[s]}" for s in tot}); print(miss[:40])

# Nonresident general regions (draw ids "Elk E", "Deer A", ...)
def regions(path, start, nharv, prefix, sp):
    L=open(path).read().split('\n'); on=False
    for ln in L:
        if start in ln: on=True; continue
        if on and re.search(r'Table \d+:', ln): break
        m=re.match(r'^\s*NR (?:Region )?(\w+)\s+([\d,\s\.]+)$', ln) if on else None
        if not m: continue
        n=[float(x.replace(',','')) for x in m.group(2).split()]
        code=m.group(1)[0] if prefix=='Elk' else m.group(1)
        out[f'{prefix} {code}']={'success':n[3+nharv],'hunters':n[0],'harvest':n[1+nharv],'days':n[2+nharv],'sp':sp,'area_name':'Nonresident general region '+m.group(1)}
regions(R+'wy_elk.txt','Table 5: Harvest Statistics by Nonresident General Region',4,'Elk','elk')
regions(R+'wy_deer.txt','Table 11: Mule Deer Harvest Statistics by Nonresident General Region',3,'Deer','deer')
json.dump(out,open(os.path.join(os.environ.get('HF_WORK','harvest-work'),'wy_harvest_raw.json'),'w'),indent=0)
hit=collections.Counter(); miss=[]
for i,sp in ids.items():
    if i in out: hit[sp]+=1
    else: miss.append(i)
print('after regions',{s:f"{hit[s]}/{tot[s]}" for s in tot}); print(miss)
