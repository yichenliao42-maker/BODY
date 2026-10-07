/**
 * 丙級練習教室 V4｜LINE 正式通知版
 *
 * Script Properties 必填：
 * ADMIN_PASSWORD              管理員密碼
 * LINE_LOGIN_CHANNEL_ID       LINE Login Channel ID
 * LINE_CHANNEL_ACCESS_TOKEN   Messaging API Channel Access Token
 *
 * 安全設計：
 * - 前端只傳 LIFF access token
 * - 後端向 LINE 驗證 token，再自行取得 userId / displayName / friendship
 * - Channel Access Token 僅存在 Apps Script Script Properties
 */

const CFG = {
  BOOK: '報名資料',
  SET: '場次設定',
  PRICE: 1500,
  LIMIT: 6
};

const BOOK_HEADERS = [
  '報名編號','登記時間','項目代碼','項目','日期','姓名','手機','備註',
  '費用','報名狀態','付款狀態','管理備註','最後更新','時段',
  'LINE User ID','LINE 顯示名稱','LINE 好友','通知狀態','最後通知時間'
];

const SET_HEADERS = [
  '項目代碼','項目名稱','練習日期',
  '上午開放','上午上限',
  '下午開放','下午上限',
  '費用','啟用'
];

function doGet(e){
  try{
    ensure_();
    const a=(e&&e.parameter&&e.parameter.action)||'publicStatus';
    if(a==='publicStatus'){
      return json_({
        success:true,
        courses:publicCoursesCached_()
      });
    }
    return json_({success:false,message:'不支援的操作'});
  }catch(err){
    return json_({success:false,message:String(err.message||err)});
  }
}

function doPost(e){
  try{
    ensure_();
    const d=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
    const a=d.action||'registerBatch';

    if(a==='registerBatch') return registerBatch_(d);
    if(a==='register'){
      d.selections=[{courseId:d.courseId,session:d.session}];
      return registerBatch_(d);
    }

    if(!adminOK_(d.adminPassword)){
      return json_({success:false,message:'管理員密碼錯誤'});
    }

    if(a==='adminList'){
      return json_({
        success:true,
        bookings:rows_(),
        settings:Object.values(settingsMap_()),
        courses:publicCourses_(),
        lineReady:lineConfigReady_()
      });
    }
    if(a==='updateBooking') return updateBooking_(d);
    if(a==='cancelBooking'){
      d.bookingStatus='已取消';
      return updateBooking_(d);
    }
    if(a==='deleteBooking') return deleteBooking_(d);
    if(a==='updateCourseSettings') return updateSettings_(d);
    if(a==='confirmAndNotify') return confirmAndNotify_(d);
    if(a==='sendLineNotify') return sendLineNotifyAction_(d);

    return json_({success:false,message:'不支援的操作'});
  }catch(err){
    return json_({success:false,message:String(err.message||err)});
  }
}

function registerBatch_(d){
  const name=String(d.name||'').trim();
  const phone=norm_(d.phone);
  const note=String(d.note||'').trim();
  const sels=Array.isArray(d.selections)?d.selections:[];
  const lineToken=String(d.lineAccessToken||'').trim();

  if(!name) return json_({success:false,message:'請填姓名'});
  if(!/^09\d{8}$/.test(phone)) return json_({success:false,message:'手機格式錯誤'});
  if(!sels.length) return json_({success:false,message:'請至少選一個場次'});

  // LINE 身分由伺服器驗證。未綁定仍可報名，但之後不能自動通知。
  let line={userId:'',displayName:'',friendFlag:false,verified:false};
  if(lineToken){
    try{
      line=verifyLineUser_(lineToken);
    }catch(err){
      // LINE 驗證失敗不阻斷報名，避免學員因 LINE 狀態失去名額
      line={userId:'',displayName:'',friendFlag:false,verified:false};
    }
  }

  const lock=LockService.getScriptLock();
  lock.waitLock(15000);

  try{
    const set=settingsMap_();
    const rows=rows_();
    const sheet=bookSheet_();
    const now=new Date();
    const out=[];
    const append=[];
    const seen={};

    sels.forEach(x=>{
      const cid=String(x.courseId||'');
      const session=String(x.session||'');
      const key=cid+'|'+session;

      if(seen[key]) return;
      seen[key]=1;

      const s=set[cid];
      if(!s||!s.active){
        out.push({courseId:cid,session,success:false,message:'項目未開放'});
        return;
      }
      if(!['上午','下午'].includes(session)){
        out.push({courseId:cid,session,success:false,message:'時段錯誤'});
        return;
      }
      if((session==='上午'&&!s.morningEnabled)||(session==='下午'&&!s.afternoonEnabled)){
        out.push({courseId:cid,session,success:false,message:'時段未開放'});
        return;
      }

      if(rows.some(r=>
        r.courseId===cid &&
        r.session===session &&
        norm_(r.phone)===phone &&
        r.bookingStatus!=='已取消'
      )){
        out.push({courseId:cid,session,success:false,message:'已登記過'});
        return;
      }

      const limit=session==='上午'?s.morningLimit:s.afternoonLimit;
      const active=rows.filter(r=>
        r.courseId===cid &&
        r.session===session &&
        ['待確認','已確認'].includes(r.bookingStatus)
      ).length;
      const pending=append.filter(r=>
        r.courseId===cid &&
        r.session===session &&
        ['待確認','已確認'].includes(r.status)
      ).length;

      const status=(active+pending)<limit?'待確認':'候補';
      const id=makeId_(cid,session);

      append.push({cid,session,s,status,id});
      out.push({
        courseId:cid,
        session,
        success:true,
        title:s.title,
        bookingStatus:status,
        bookingId:id
      });
    });

    if(append.length){
      const vals=append.map(x=>[
        x.id,now,x.cid,x.s.title,x.s.date,name,phone,note,
        x.s.price,x.status,'未付款','',now,x.session,
        line.userId||'',
        line.displayName||'',
        line.friendFlag?'是':'否',
        line.userId ? (line.friendFlag?'已綁定':'已綁定／未加好友') : '未綁定',
        ''
      ]);
      sheet.getRange(sheet.getLastRow()+1,1,vals.length,BOOK_HEADERS.length).setValues(vals);
      SpreadsheetApp.flush();
      clearCache_();
    }

    return json_({
      success:true,
      inserted:append.length,
      results:out,
      lineBound:!!line.userId,
      lineFriend:!!line.friendFlag
    });
  }finally{
    lock.releaseLock();
  }
}

function confirmAndNotify_(d){
  const id=String(d.bookingId||'');
  if(!id) return json_({success:false,message:'缺少報名編號'});

  const lock=LockService.getScriptLock();
  lock.waitLock(15000);

  try{
    const sheet=bookSheet_();
    const rows=rows_();
    const t=rows.find(r=>r.bookingId===id);
    if(!t) return json_({success:false,message:'找不到這筆報名'});
    if(t.bookingStatus==='已取消') return json_({success:false,message:'已取消的資料不能確認通知'});

    // 先確認名額
    if(!['已確認'].includes(t.bookingStatus)){
      const st=settingsMap_()[t.courseId];
      if(!st) return json_({success:false,message:'找不到場次設定'});
      const limit=t.session==='上午'?st.morningLimit:st.afternoonLimit;
      const active=rows.filter(r=>
        r.bookingId!==id &&
        r.courseId===t.courseId &&
        r.session===t.session &&
        ['待確認','已確認'].includes(r.bookingStatus)
      ).length;
      if(active>=limit && t.bookingStatus==='候補'){
        return json_({success:false,message:'此時段目前仍額滿，不能直接確認'});
      }
    }

    sheet.getRange(t.rowNumber,10).setValue('已確認');
    sheet.getRange(t.rowNumber,13).setValue(new Date());
    SpreadsheetApp.flush();

    const fresh=rows_().find(r=>r.bookingId===id);
    const result=sendBookingConfirmation_(fresh);

    clearCache_();

    return json_({
      success:true,
      message:'已確認',
      notification:result
    });
  }finally{
    lock.releaseLock();
  }
}

function sendLineNotifyAction_(d){
  const id=String(d.bookingId||'');
  const t=rows_().find(r=>r.bookingId===id);
  if(!t) return json_({success:false,message:'找不到這筆報名'});

  const result=sendBookingConfirmation_(t);

  return json_({
    success:true,
    message:'通知處理完成',
    notification:result
  });
}

function sendBookingConfirmation_(t){
  if(!t.lineUserId){
    updateNotifyStatus_(t.rowNumber,'未綁定 LINE',null);
    return {sent:false,message:'此學員尚未綁定 LINE'};
  }

  if(t.lineFriend!=='是'){
    updateNotifyStatus_(t.rowNumber,'未加好友／無法通知',null);
    return {sent:false,message:'學員尚未加入或已封鎖 LINE 官方帳號'};
  }

  const token=PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  if(!token){
    updateNotifyStatus_(t.rowNumber,'系統未設定 Channel Token',null);
    return {sent:false,message:'尚未設定 LINE_CHANNEL_ACCESS_TOKEN'};
  }

  const text=[
    '【丙級練習登記確認】',
    '',
    '您好，'+t.name+'：',
    '您的練習登記已確認。',
    '',
    '項目：'+t.courseTitle,
    '日期：'+t.date,
    '時段：'+t.session,
    '費用：$'+Number(t.price||1500).toLocaleString()+'（現場繳費）',
    '',
    '請依預約時間準時到場，並遵守租借流程與清潔規範。'
  ].join('\n');

  const payload={
    to:t.lineUserId,
    messages:[{type:'text',text:text}]
  };

  const res=UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push',{
    method:'post',
    contentType:'application/json',
    headers:{Authorization:'Bearer '+token},
    payload:JSON.stringify(payload),
    muteHttpExceptions:true
  });

  const code=res.getResponseCode();

  if(code>=200 && code<300){
    updateNotifyStatus_(t.rowNumber,'已送出',new Date());
    return {sent:true,message:'LINE 通知已送出'};
  }

  const body=res.getContentText();
  updateNotifyStatus_(t.rowNumber,'通知失敗 HTTP '+code,null);
  return {sent:false,message:'LINE API 回傳 '+code,detail:body};
}

function updateNotifyStatus_(row,status,time){
  const sheet=bookSheet_();
  sheet.getRange(row,18).setValue(status);
  if(time) sheet.getRange(row,19).setValue(time);
  sheet.getRange(row,13).setValue(new Date());
}

function verifyLineUser_(accessToken){
  const expectedClientId=PropertiesService.getScriptProperties().getProperty('LINE_LOGIN_CHANNEL_ID');
  if(!expectedClientId) throw new Error('尚未設定 LINE_LOGIN_CHANNEL_ID');

  const verifyRes=UrlFetchApp.fetch(
    'https://api.line.me/oauth2/v2.1/verify?access_token='+encodeURIComponent(accessToken),
    {method:'get',muteHttpExceptions:true}
  );

  if(verifyRes.getResponseCode()!==200){
    throw new Error('LINE access token 驗證失敗');
  }

  const verify=JSON.parse(verifyRes.getContentText());
  if(String(verify.client_id)!==String(expectedClientId)){
    throw new Error('LINE Channel ID 不符');
  }

  const profileRes=UrlFetchApp.fetch('https://api.line.me/v2/profile',{
    method:'get',
    headers:{Authorization:'Bearer '+accessToken},
    muteHttpExceptions:true
  });

  if(profileRes.getResponseCode()!==200){
    throw new Error('無法取得 LINE Profile');
  }

  const profile=JSON.parse(profileRes.getContentText());

  let friendFlag=false;
  try{
    const friendRes=UrlFetchApp.fetch('https://api.line.me/friendship/v1/status',{
      method:'get',
      headers:{Authorization:'Bearer '+accessToken},
      muteHttpExceptions:true
    });
    if(friendRes.getResponseCode()===200){
      friendFlag=!!JSON.parse(friendRes.getContentText()).friendFlag;
    }
  }catch(err){}

  return {
    verified:true,
    userId:String(profile.userId||''),
    displayName:String(profile.displayName||''),
    friendFlag:friendFlag
  };
}

function updateBooking_(d){
  const id=String(d.bookingId||'');
  if(!id) return json_({success:false,message:'缺少報名編號'});

  const lock=LockService.getScriptLock();
  lock.waitLock(15000);

  try{
    const sheet=bookSheet_();
    const rows=rows_();
    const t=rows.find(r=>r.bookingId===id);
    if(!t) return json_({success:false,message:'找不到這筆報名'});

    const oldActive=['待確認','已確認'].includes(t.bookingStatus);
    const oldSession=t.session;

    const ns=String(d.session||t.session||'未指定');
    const bs=String(d.bookingStatus||t.bookingStatus);
    const ps=String(d.paymentStatus||t.paymentStatus);
    const an=String(d.adminNote||'');

    if(['待確認','已確認'].includes(bs)&&['上午','下午'].includes(ns)){
      const st=settingsMap_()[t.courseId];
      const limit=ns==='上午'?st.morningLimit:st.afternoonLimit;
      const n=rows.filter(r=>
        r.bookingId!==id &&
        r.courseId===t.courseId &&
        r.session===ns &&
        ['待確認','已確認'].includes(r.bookingStatus)
      ).length;
      if(n>=limit) return json_({success:false,message:`${ns}已達上限 ${limit} 人`});
    }

    sheet.getRange(t.rowNumber,10).setValue(bs);
    sheet.getRange(t.rowNumber,11).setValue(ps);
    sheet.getRange(t.rowNumber,12).setValue(an);
    sheet.getRange(t.rowNumber,13).setValue(new Date());
    sheet.getRange(t.rowNumber,14).setValue(ns==='未指定'?'':ns);

    let promoted=null;
    if(oldActive && bs==='已取消' && ['上午','下午'].includes(oldSession)){
      promoted=promote_(t.courseId,oldSession);
    }

    SpreadsheetApp.flush();
    clearCache_();

    return json_({success:true,message:'更新成功',promoted});
  }finally{
    lock.releaseLock();
  }
}

function deleteBooking_(d){
  const id=String(d.bookingId||'');
  if(!id) return json_({success:false,message:'缺少報名編號'});

  const lock=LockService.getScriptLock();
  lock.waitLock(15000);

  try{
    const sheet=bookSheet_();
    const rows=rows_();
    const t=rows.find(r=>r.bookingId===id);
    if(!t) return json_({success:false,message:'找不到資料'});

    const shouldPromote=
      ['待確認','已確認'].includes(t.bookingStatus) &&
      ['上午','下午'].includes(t.session);

    sheet.deleteRow(t.rowNumber);
    SpreadsheetApp.flush();

    const p=shouldPromote?promote_(t.courseId,t.session):null;
    clearCache_();

    return json_({success:true,message:'已永久刪除',promoted:p});
  }finally{
    lock.releaseLock();
  }
}

function updateSettings_(d){
  const id=String(d.courseId||'');
  const sheet=setSheet_();
  const vals=sheet.getRange(2,1,Math.max(0,sheet.getLastRow()-1),SET_HEADERS.length).getValues();

  let row=-1;
  vals.forEach((r,i)=>{if(String(r[0])===id)row=i+2});

  if(row<0) return json_({success:false,message:'找不到此項目'});

  const title=String(d.title||'').trim();
  const date=String(d.date||'').trim();

  if(!title) return json_({success:false,message:'項目名稱不可空白'});

  sheet.getRange(row,1,1,9).setValues([[
    id,title,date,
    !!d.morningEnabled,Math.max(1,Number(d.morningLimit||6)),
    !!d.afternoonEnabled,Math.max(1,Number(d.afternoonLimit||6)),
    Math.max(0,Number(d.price||1500)),
    d.active!==false
  ]]);

  clearCache_();
  return json_({success:true,message:'場次設定已更新'});
}

function promote_(cid,session){
  const st=settingsMap_()[cid];
  if(!st) return null;

  const limit=session==='上午'?st.morningLimit:st.afternoonLimit;
  const rows=rows_();
  const sheet=bookSheet_();

  const active=rows.filter(r=>
    r.courseId===cid &&
    r.session===session &&
    ['待確認','已確認'].includes(r.bookingStatus)
  ).length;

  if(active>=limit) return null;

  const q=rows
    .filter(r=>r.courseId===cid&&r.session===session&&r.bookingStatus==='候補')
    .sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));

  if(!q.length) return null;

  const f=q[0];
  sheet.getRange(f.rowNumber,10).setValue('待確認');
  sheet.getRange(f.rowNumber,12).setValue((f.adminNote?f.adminNote+'；':'')+'系統自動遞補');
  sheet.getRange(f.rowNumber,13).setValue(new Date());

  return {bookingId:f.bookingId,name:f.name,phone:f.phone,session:f.session};
}

function publicCoursesCached_(){
  const c=CacheService.getScriptCache();
  const v=c.get('pubV4');
  if(v) return JSON.parse(v);
  const d=publicCourses_();
  c.put('pubV4',JSON.stringify(d),20);
  return d;
}

function clearCache_(){
  CacheService.getScriptCache().remove('pubV4');
}

function publicCourses_(){
  const set=settingsMap_();
  const rows=rows_();
  const out={};

  Object.keys(set).forEach(id=>{
    const c=set[id];

    const one=(session,en,limit)=>{
      const count=rows.filter(r=>
        r.courseId===id &&
        r.session===session &&
        ['待確認','已確認'].includes(r.bookingStatus)
      ).length;

      const wait=rows.filter(r=>
        r.courseId===id &&
        r.session===session &&
        r.bookingStatus==='候補'
      ).length;

      return {
        enabled:en,
        limit,
        count,
        remaining:Math.max(0,limit-count),
        waitlist:wait,
        full:count>=limit
      };
    };

    out[id]={
      id,
      title:c.title,
      date:c.date,
      price:c.price,
      active:c.active,
      morning:one('上午',c.morningEnabled,c.morningLimit),
      afternoon:one('下午',c.afternoonEnabled,c.afternoonLimit)
    };
  });

  return out;
}

function ensure_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();

  let b=ss.getSheetByName(CFG.BOOK);
  if(!b){
    b=ss.insertSheet(CFG.BOOK);
    b.getRange(1,1,1,BOOK_HEADERS.length).setValues([BOOK_HEADERS]);
  }else{
    if(b.getLastColumn()<BOOK_HEADERS.length){
      for(let col=b.getLastColumn()+1;col<=BOOK_HEADERS.length;col++){
        b.getRange(1,col).setValue(BOOK_HEADERS[col-1]);
      }
    }
  }

  let s=ss.getSheetByName(CFG.SET);
  if(!s){
    s=ss.insertSheet(CFG.SET);
    s.getRange(1,1,1,SET_HEADERS.length).setValues([SET_HEADERS]);
    s.getRange(2,1,3,9).setValues([
      ['cake','蛋糕丙級','10/21（三）',true,6,true,6,1500,true],
      ['cook','中餐丙級','11/4（三）',true,6,true,6,1500,true],
      ['bread','麵包丙級','日期待公告',true,6,true,6,1500,true]
    ]);
  }
}

function rows_(){
  const s=bookSheet_();
  const lr=s.getLastRow();
  if(lr<2) return [];

  return s.getRange(2,1,lr-1,BOOK_HEADERS.length).getValues().map((r,i)=>({
    rowNumber:i+2,
    bookingId:String(r[0]||''),
    createdAt:r[1]||'',
    courseId:String(r[2]||''),
    courseTitle:String(r[3]||''),
    date:String(r[4]||''),
    name:String(r[5]||''),
    phone:String(r[6]||''),
    note:String(r[7]||''),
    price:Number(r[8]||1500),
    bookingStatus:String(r[9]||''),
    paymentStatus:String(r[10]||''),
    adminNote:String(r[11]||''),
    updatedAt:r[12]||'',
    session:String(r[13]||'未指定'),
    lineUserId:String(r[14]||''),
    lineDisplayName:String(r[15]||''),
    lineFriend:String(r[16]||''),
    notifyStatus:String(r[17]||''),
    lastNotifyAt:r[18]||''
  })).filter(r=>r.bookingId);
}

function settingsMap_(){
  const s=setSheet_();
  const lr=s.getLastRow();
  const o={};
  if(lr<2) return o;

  s.getRange(2,1,lr-1,9).getValues().forEach(r=>{
    const id=String(r[0]||'');
    if(!id) return;
    o[id]={
      id,
      title:String(r[1]||''),
      date:String(r[2]||''),
      morningEnabled:bool_(r[3]),
      morningLimit:Number(r[4]||6),
      afternoonEnabled:bool_(r[5]),
      afternoonLimit:Number(r[6]||6),
      price:Number(r[7]||1500),
      active:bool_(r[8])
    };
  });

  return o;
}

function lineConfigReady_(){
  const p=PropertiesService.getScriptProperties();
  return !!(
    p.getProperty('LINE_LOGIN_CHANNEL_ID') &&
    p.getProperty('LINE_CHANNEL_ACCESS_TOKEN')
  );
}

function adminOK_(p){
  const s=PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if(!s) throw new Error('尚未設定 ADMIN_PASSWORD');
  return String(p||'')===s;
}

function bookSheet_(){
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.BOOK);
}
function setSheet_(){
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.SET);
}
function bool_(v){
  return typeof v==='boolean'
    ? v
    : ['true','1','yes','是','開啟'].includes(String(v).toLowerCase());
}
function norm_(v){
  return String(v||'').replace(/\D/g,'');
}
function makeId_(cid,session){
  const tz=Session.getScriptTimeZone()||'Asia/Taipei';
  const stamp=Utilities.formatDate(new Date(),tz,'yyyyMMddHHmmss');
  const rnd=Math.floor(100+Math.random()*900);
  return cid.toUpperCase()+'-'+(session==='上午'?'AM':'PM')+'-'+stamp+'-'+rnd;
}
function json_(o){
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
