import fs from 'fs';import {feature} from 'topojson-client';import {geoMercator,geoPath,geoConicEqualArea} from 'd3-geo';
const topo=JSON.parse(fs.readFileSync('node_modules/us-atlas/states-10m.json'));
const fc=feature(topo,topo.objects.states);
const FIPS={'01':'al','02':'ak','04':'az','05':'ar','06':'ca','08':'co','09':'ct','10':'de','12':'fl','13':'ga','15':'hi','16':'id','17':'il','18':'in','19':'ia','20':'ks','21':'ky','22':'la','23':'me','24':'md','25':'ma','26':'mi','27':'mn','28':'ms','29':'mo','30':'mt','31':'ne','32':'nv','33':'nh','34':'nj','35':'nm','36':'ny','37':'nc','38':'nd','39':'oh','40':'ok','41':'or','42':'pa','44':'ri','45':'sc','46':'sd','47':'tn','48':'tx','49':'ut','50':'vt','51':'va','53':'wa','54':'wv','55':'wi','56':'wy'};
const out={};
for(const f of fc.features){const st=FIPS[f.id];if(!st)continue;
  let g=f; if(st=='ak'){g={...f,geometry:{...f.geometry,coordinates:f.geometry.coordinates.filter(p=>{const x=p[0][0][0];return x<-129&&x>-180||true})}}}
  const [[x0,y0],[x1,y1]]=geoPath().bounds(g);
  const proj=(st=='ak'?geoConicEqualArea().parallels([55,65]).rotate([154,0]):geoConicEqualArea().parallels([y0+(y1-y0)/6,y1-(y1-y0)/6]).rotate([-(x0+x1)/2,0])).fitExtent([[2,2],[198,198]],g);
  const path=geoPath(proj).digits(1);const d=path(g);const b=path.bounds(g);
  out[st]={d, vb:[Math.floor(b[0][0]),Math.floor(b[0][1]),Math.ceil(b[1][0]-b[0][0]),Math.ceil(b[1][1]-b[0][1])].join(' ')};}
fs.writeFileSync('states.json',JSON.stringify(out));
console.log(Object.keys(out).length, out.co.d.length, out.co.vb, out.mt.d.length, JSON.stringify(out).length);
