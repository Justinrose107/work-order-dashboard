(function(root){
  const REGIONS={DAP:['HMT','ANZ','KOR','JPN'],SEA:['SEA'],EUB:['CEE','WEU'],EMG:['FSA','KSA','ESA','MEA'],RCIS:['CIS'],ISC:['ISC'],LATAM:['SSA','PSA']};
  const text=v=>String(v??'').trim();
  const norm=v=>text(v).toLowerCase().replace(/[\s（）()’'._-]/g,'');
  const closed=v=>['closed','close','已关闭','关闭','cancelled','canceled','已取消','取消'].includes(text(v).toLowerCase());
  function date(v,offset=8,date1904=false){
    if(v===null||v===undefined||text(v)==='')return null;
    if(v instanceof Date)return Number.isFinite(+v)?+v:NaN;
    if(typeof v==='number')return (v-(date1904?24107:25569))*86400000-offset*3600000;
    const s=text(v), m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/);
    if(m){const [y,mo,d,h,mi,se]=m.slice(1,7).map(x=>Number(x||0));const t=Date.UTC(y,mo-1,d,h,mi,se);const check=new Date(t);return check.getUTCFullYear()===y&&check.getUTCMonth()===mo-1&&check.getUTCDate()===d&&h<24&&mi<60&&se<60?t-offset*3600000:NaN;}
    if(/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(s))return Date.parse(s);
    return NaN;
  }
  function region(big,sub){
    let s=text(sub).toUpperCase();if(s==='KOREA')s='KOR';if(s==='RCIS')s='CIS';
    let b=Object.keys(REGIONS).find(k=>REGIONS[k].includes(s));
    const given=text(big).toUpperCase();
    return {region:b||(REGIONS[given]?given:'Unmatched'),sub:s||'Not provided',regionIssue:!b||(given&&given!==b)};
  }
  const fields={id:['Work Order Number（Required）','Work Order Number','工单编号'],region:['Service Sales Region','大区'],sub:['Service Region','子区域'],status:['Work Order Status','工单状态'],complete:['Service Complete Time','服务完成时间'],country:['Country','国家'],owner:['Owner（Required）','Owner','负责人'],type:['Work Order Type','工单类型'],priority:['Priority','优先级'],flow:['Work Order Flow Status','流程状态'],progress:['Work Order Flow Progress'],account:['Account Name','客户'],model:['Product Model（txt）','Product Model','产品型号'],serial:['Serial No.','序列号'],case:['Case Number'],warranty:['Asset Warranty Status'],created:['Created On'],fault:['Fault Description'],solution:['Field Solution']};
  function columns(headers){return Object.fromEntries(Object.entries(fields).map(([k,aliases])=>[k,headers.findIndex(h=>aliases.some(a=>norm(h)===norm(a)))]));}
  function parse(matrix,options={}){
    const hi=matrix.slice(0,30).findIndex(r=>{const c=columns(r);return c.id>=0&&c.status>=0&&c.complete>=0});
    if(hi<0)throw Error('Missing required columns: Work Order Number, Work Order Status, Service Complete Time. Please import the original work order export.');
    const headers=matrix[hi],c=columns(headers);if(c.sub<0&&c.region<0)throw Error('Missing region columns: Service Region or Service Sales Region.');
    const rows=[],seen=new Set();let duplicate=0,blankId=0;
    for(let i=hi+1;i<matrix.length;i++){
      const raw=matrix[i];if(raw.every(v=>text(v)===''))continue;
      const r=Object.fromEntries(Object.keys(fields).map(k=>[k,c[k]>=0?text(raw[c[k]]):'']));
      if(!r.id)blankId++;if(r.id&&seen.has(r.id))duplicate++;seen.add(r.id);
      Object.assign(r,region(r.region,r.sub));r.row=i+1;r.raw=raw;r.completeMs=date(c.complete>=0?raw[c.complete]:null,options.offset??8,options.date1904);if(c.created>=0&&typeof raw[c.created]==='number'){const t=date(raw[c.created],0,options.date1904);r.created=Number.isFinite(t)?new Date(t).toISOString().slice(0,19).replace('T',' '):text(raw[c.created]);}r.closed=closed(r.status);rows.push(r);
    }
    return {rows,headers,duplicate,blankId};
  }
  function classify(r,now){
    if(r.closed)return 'closed';
    if(!r.status)return 'invalid';
    if(r.completeMs===null)return 'missing';
    if(!Number.isFinite(r.completeMs)||r.completeMs>now)return 'invalid';
    return now-r.completeMs<=72*3600000?'grace':'overdue';
  }
  root.WO={REGIONS,text,norm,date,region,closed,columns,parse,classify};
})(typeof globalThis!=='undefined'?globalThis:window);
