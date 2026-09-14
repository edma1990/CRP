const PRICE_PER_LITER = 1300000; // ریال

function jalaliToGregorian(jy, jm, jd) {
  jy = Number(jy) + 1595;
  let days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097); days %= 146097;
  if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const gd = days + 1; const leap = gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0);
  const mdays = [0,31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31]; let gm = 1, n = gd;
  while (gm <= 12 && n > mdays[gm]) n -= mdays[gm++];
  return `${gy}-${String(gm).padStart(2,'0')}-${String(n).padStart(2,'0')}`;
}
function gregorianToJalali(value) {
  if (!value) return '';
  const d = new Date(String(value).slice(0,10) + 'T12:00:00');
  return d.toLocaleDateString('fa-IR-u-ca-persian').replaceAll('-', '/');
}
function gregorianToJalaliDateTime(value) {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('fa-IR-u-ca-persian', { dateStyle: 'short', timeStyle: 'short' });
}
function normalizeJalali(value) {
  const v = String(value || '').replace(/[۰-۹]/g, x => '۰۱۲۳۴۵۶۷۸۹'.indexOf(x)).replace(/-/g, '/').trim();
  const m = v.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  return m ? jalaliToGregorian(+m[1], +m[2], +m[3]) : '';
}
function formatRial(value) { const n = Number(String(value || '').replace(/,/g,'').replace(/[^0-9-]/g,'')) || 0; return n ? n.toLocaleString('en-US') : ''; }
function persianNumberWords(n) {
  n = Math.abs(Number(n) || 0); if (!n) return 'صفر ریال';
  const ones=['','یک','دو','سه','چهار','پنج','شش','هفت','هشت','نه']; const teens=['ده','یازده','دوازده','سیزده','چهارده','پانزده','شانزده','هفده','هجده','نوزده']; const tens=['','','بیست','سی','چهل','پنجاه','شصت','هفتاد','هشتاد','نود']; const hundreds=['','صد','دویست','سیصد','چهارصد','پانصد','ششصد','هفتصد','هشتصد','نهصد']; const scales=['','هزار','میلیون','میلیارد','تریلیون'];
  const tri=x=>{let a=[];let h=Math.floor(x/100),r=x%100;if(h)a.push(hundreds[h]);if(r){if(r<10)a.push(ones[r]);else if(r<20)a.push(teens[r-10]);else{a.push(tens[Math.floor(r/10)]);if(r%10)a.push(ones[r%10]);}}return a.join(' و ')};
  let parts=[],i=0; while(n>0){const x=n%1000;if(x)parts.unshift(tri(x)+(scales[i]?' '+scales[i]:''));n=Math.floor(n/1000);i++;} return parts.join(' و ')+' ریال';
}
const STORAGE = "lynxoil_crm_v2";
const SETTLE_DAYS = 10;

const ROLES = {
  station: "جایگاه‌دار",
  sales: "کارشناس فروش",
  accounting: "مدیر مالی",
  salesManager: "مدیر فروش",
  commerce: "مدیر بازرگانی",
  loading: "کارشناس بارگیری",
  admin: "مدیر سامانه",
};

const STATUS = {
  draft_sales: "در انتظار بررسی کارشناس فروش",
  proforma_sent: "ارسال‌شده برای مدیر مالی / در انتظار بررسی", 
  returned_station: "عودت به جایگاه‌دار جهت اصلاح",
  pending_accounting: "در انتظار تایید مالی",
  finance_ok: "تایید مالی — در انتظار ارسال به مدیر فروش",
  finance_no: "عدم تایید مالی",
  pending_sales_mgr: "در انتظار تایید مدیر فروش",
  pending_loading: "در انتظار بارگیری",
  loaded: "بارگیری انجام شد",
  rejected: "رد شده",
};

const SETTLE_STATUS = {
  pending_sales: "در انتظار بررسی کارشناس فروش",
  pending_finance: "در انتظار تایید مدیر مالی",
  approved: "تایید شده — ارسال به جایگاه، بازرگانی و فروش",
  rejected: "رد شده",
};

function now() {
  return new Date().toLocaleString("fa-IR");
}
function num(n) {
  return Number(n || 0).toLocaleString("en-US");
}
function rial(n) {
  return num(n) + " ریال";
}
function toman(n) {
  return rial(n);
}
function liter(n) {
  return num(n) + " لیتر";
}
function uid() {
  return "R" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}
function parseMoney(s) {
  return Number(String(s || "").replace(/,/g, "").replace(/[^\d.]/g, "")) || 0;
}
function attachComma(el) {
  if (!el) return;
  el.addEventListener("input", () => {
    const n = parseMoney(el.value);
    el.value = n ? n.toLocaleString("en-US") : "";
  });
}

function badgeOf(station) {
  if (station.creditScore === "gold") return { cls: "b-gold", dot: "gold", label: "طلایی — خوش‌حساب و خوش‌فروش" };
  if (station.creditScore === "silver") return { cls: "b-silver", dot: "silver", label: "نقره‌ای — متوسط" };
  return { cls: "b-red", dot: "red", label: "قرمز — بدحساب" };
}

function seed() {
  const stations = [
    {
      id: "st1",
      name: "جایگاه امام علی (ع) ۲ — اصفهان",
      city: "اصفهان",
      user: "station1",
      contractStart: "1404/06/01",
      contractEnd: "1405/06/01",
      guaranteeToman: 20000000000,
      settledToman: 2000000000,
      lastSettlementDate: "1405/06/01",
      extraOrderLiters: 0,
      remainingLitersOnSite: 4200,
      creditScore: "gold",
    },
    {
      id: "st2",
      name: "جایگاه امیرکبیر ۲ — کاشان",
      city: "کاشان",
      user: "station2",
      contractStart: "1404/04/15",
      contractEnd: "1405/04/15",
      guaranteeToman: 8000000000,
      settledToman: 500000000,
      lastSettlementDate: "1405/05/20",
      extraOrderLiters: 1500,
      remainingLitersOnSite: 900,
      creditScore: "silver",
    },
    {
      id: "st3",
      name: "جایگاه هادی‌نیا — شهربابک",
      city: "شهربابک",
      user: "station3",
      contractStart: "1404/02/01",
      contractEnd: "1404/12/01",
      guaranteeToman: 4000000000,
      settledToman: 0,
      lastSettlementDate: "",
      extraOrderLiters: 0,
      remainingLitersOnSite: 200,
      creditScore: "red",
    },
  ];
  const users = [
    { username: "station1", pass: "1234", role: "station", stationId: "st1", name: "مدیر جایگاه امام علی" },
    { username: "station2", pass: "1234", role: "station", stationId: "st2", name: "مدیر جایگاه امیرکبیر" },
    { username: "station3", pass: "1234", role: "station", stationId: "st3", name: "مدیر جایگاه هادی‌نیا" },
    { username: "sales", pass: "1234", role: "sales", name: "کارشناس فروش لینکس‌اویل" },
    { username: "acc", pass: "1234", role: "accounting", name: "مدیر مالی" },
    { username: "smgr", pass: "1234", role: "salesManager", name: "مدیر فروش" },
    { username: "commerce", pass: "1234", role: "commerce", name: "مدیر بازرگانی" },
    { username: "load", pass: "1234", role: "loading", name: "کارشناس بارگیری" },
    { username: "admin", pass: "1234", role: "admin", name: "مدیر سامانه" },
  ];
  return { users, stations, requests: [demoRequest("st1", "loaded")], settlements: [], session: null };
}

function demoRequest(stId, status) {
  const liters = 8000;
  const amount = liters * PRICE_PER_LITER;
  return {
    id: "RDEMO01",
    stationId: stId,
    createdAt: now(),
    liters,
    remainingOnSite: 4200,
    extraOrderLiters: 0,
    cashBeforeShip: 0,
    lastSettlementDate: "1405/06/01",
    status,
    salesNote: "مطابقت ضمانت تایید شد",
    financeNote: "تاییدیه مالی صادر شد",
    financeOk: true,
    driver: "علی رضایی",
    plate: "12 ع 345 ایران 78",
    truck: "تانکر ولوو — ظرفیت 20000 لیتر",
    loadTime: "1405/06/07 ساعت 08:30",
    loadLiters: 8000,
    loadInvoiceName: "فاکتور-بارگیری-RDEMO01.pdf",
    proforma: { liters, unit: PRICE_PER_LITER, total: amount, no: "PF-1405-001", date: now() },
    logs: [
      { t: now(), by: "جایگاه‌دار", msg: "ثبت درخواست خرید" },
      { t: now(), by: "کارشناس فروش", msg: "صدور پیش‌فاکتور خودکار" },
      { t: now(), by: "مدیر مالی", msg: "تاییدیه مالی" },
      { t: now(), by: "مدیر فروش", msg: "تایید و ارسال به بارگیری" },
      { t: now(), by: "کارشناس بارگیری", msg: "بارگیری انجام و فاکتور پیوست شد" },
    ],
  };
}

function load() {
  const raw = localStorage.getItem(STORAGE);
  if (!raw) {
    const d = seed();
    save(d);
    return d;
  }
  try {
    const d = JSON.parse(raw);
    d.settlements = d.settlements || [];
    d.requests = d.requests || [];
    return d;
  } catch {
    const d = seed();
    save(d);
    return d;
  }
}
function save(db) {
  localStorage.setItem(STORAGE, JSON.stringify(db));
}

let db = load();
let page = new URLSearchParams(location.search).get('page') || "dash";
let selectedId = null;

function remainingCredit(st) {
  const maxOrder = Number(st.guaranteeToman || 0) / 2;
  return Math.max(0, maxOrder - usedCredit(st) + Number(st.settledToman || 0));
}
function usedCredit(st) {
  return db.requests
    .filter((r) => r.stationId === st.id && r.status !== "rejected" && r.status !== "loaded")
    .reduce((s, r) => s + Math.max(0, r.liters * PRICE_PER_LITER - (r.cashBeforeShip || 0)), 0);
}
function stationById(id) {
  return db.stations.find((s) => s.id === id);
}
function me() {
  return db.session;
}
function lastSettleOf(st) {
  const list = (db.settlements || []).filter((s) => s.stationId === st.id && s.status === "approved");
  if (!list.length) return st.lastSettlementDate || "—";
  list.sort((a, b) => String(a.payDate).localeCompare(String(b.payDate)));
  return list[list.length - 1].payDate;
}

function render() {
  const app = document.getElementById("app");
  if (!db.session) {
    app.innerHTML = loginView();
    bindLogin();
    return;
  }
  app.innerHTML = shell();
  bindApp();
}

function loginView() {
  return `<div class="login-wrap"><div class="login-scene" dir="ltr">
    <img class="login-mascot" src="lynx-lean.png" alt="کاراکتر LYNX OIL" />
    <div class="login-card" dir="rtl">
      <div class="logo-row">
        <img class="logo-lynx" src="logo-lynx.jpg" alt="LYNX OIL" />
        <img class="logo-msp" src="logo-msp.jpg" alt="MSP" />
      </div>
      <div class="brand"><div><strong>LYNX OIL CRM</strong><div class="muted">سامانه سفارش بنزین سوپر وارداتی</div></div></div>
      <h1>ورود به پنل</h1>
      <p class="sub">جایگاه‌داران و کارشناسان با حساب تعریف‌شده وارد می‌شوند.</p>
      <label>نام کاربری</label><input id="u" autocomplete="username" />
      <label>رمز عبور</label><input id="p" type="password" autocomplete="current-password" />
      <label>سؤال امنیتی: <span id="captchaQuestion">در حال دریافت...</span></label><input id="captcha" inputmode="numeric" autocomplete="off" placeholder="پاسخ را وارد کنید" />
      <button class="btn btn-ghost" id="newCaptcha" type="button" style="margin-top:10px">سؤال جدید</button>
      <button class="btn btn-gold" id="go">ورود</button>

    </div>
  </div></div>`;
}
function loadCaptcha() {
  fetch("api.php?action=challenge").then((r) => r.json()).then((j) => { document.getElementById("captchaQuestion").textContent = j.question; }).catch(() => { document.getElementById("captchaQuestion").textContent = "خطا در دریافت سؤال"; });
}
function bindLogin() {
  loadCaptcha();
  document.getElementById("newCaptcha").onclick = () => { document.getElementById("captcha").value = ""; loadCaptcha(); };
  document.getElementById("go").onclick = async () => {
    const u = document.getElementById("u").value.trim();
    const p = document.getElementById("p").value;
    if (!u || !p) { alert("نام کاربری و رمز عبور را وارد کنید"); return; }
    const btn = document.getElementById("go"); btn.disabled = true; btn.textContent = "در حال ورود...";
    try {
      const response = await fetch("api.php?action=login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p, captcha: document.getElementById("captcha").value }) });
      const result = await response.json();
      if (!result.ok) throw new Error(result.message || "نام کاربری یا رمز عبور نادرست است");
      const user = result.user;
      db.apiToken = result.token;
      db.session = { ...user, name: user.full_name, stationId: user.station_id };
      if (user.station_id && user.station_name) {
        const local = stationById(user.station_id);
        const mapped = { id: user.station_id, name: user.station_name, city: user.station_city || "", guaranteeToman: Number(user.guarantee_rial || 0), settledToman: 0, creditScore: user.credit_score || "silver", contractStart: "—", contractEnd: "—", remainingLitersOnSite: 0 };
        if (local) Object.assign(local, mapped); else db.stations.push(mapped);
      }
      save(db);
      if (user.role === "admin") { window.location.href = "admin-users.html"; return; }
      page = "dash"; render();
    } catch (e) {
      alert(e.message || "نام کاربری یا رمز عبور نادرست است");
      btn.disabled = false; btn.textContent = "ورود";
    }
  };
}

function navItems() {
  const r = me().role;
  const items = [{ id: "dash", t: "داشبورد" }];
  if (r === "station")
    items.push({ id: "new", t: "درخواست خرید جدید" }, { id: "settle", t: "فرم تسویه فروش" }, { id: "hist", t: "سوابق جایگاه" });
  if (r === "sales")
    items.push({ id: "inbox", t: "صندوق کارشناس فروش" }, { id: "settleInbox", t: "تسویه‌های فروش" }, { id: "finance", t: "اطلاعات مالی جایگاه‌ها" });
  if (r === "admin")
    items.push({ id: "inbox", t: "صندوق کارشناس فروش" }, { id: "settleInbox", t: "تسویه‌های فروش" }, { id: "stations", t: "جایگاه‌ها" }, { id: "finance", t: "اطلاعات مالی جایگاه‌ها" });
  if (r === "accounting" || r === "admin")
    items.push({ id: "acc", t: "تایید مالی سفارش" }, { id: "settleAcc", t: "تایید تسویه مالی" });
  if (r === "salesManager" || r === "admin") items.push({ id: "sm", t: "تایید مدیر فروش" });
  if (r === "commerce" || r === "admin") items.push({ id: "settleCom", t: "تسویه‌های تاییدشده" });
  if (r === "loading" || r === "admin") items.push({ id: "load", t: "بارگیری" });
  if (r === "admin") items.push({ id: "users", t: "کاربران" });
  return items;
}

function goLoading(){page='load';selectedId=null;render();}
function shell() {
  const items = navItems()
    .map((i) => i.id==='load' ? `<a class="nav-btn ${page === i.id ? "active" : ""}" href="#load" onclick="goLoading();return false">${i.t}</a>` : `<button class="nav-btn ${page === i.id ? "active" : ""}" data-p="${i.id}">${i.t}</button>`)
    .join("");
  return `<div class="app">
    <aside class="side">
      <div class="brand" style="flex-wrap:wrap">
        <img class="logo-lynx-sm" src="logo-lynx.jpg" alt="LYNX OIL" />
        <div><strong>LYNX OIL</strong><div class="muted" style="font-size:11px">CRM سفارش سوپر</div></div>
        <img class="logo-msp-sm" src="logo-msp.jpg" alt="MSP" />
      </div>
      ${items}
      <div style="flex:1"></div>
      <button class="nav-btn" id="out">خروج</button>
    </aside>
    <main class="main">
      <div class="topbar">
        <div><h2>${titleOf()}</h2><div class="muted">lynxoil.ir — بنزین سوپر وارداتی اکتان 95+</div></div>
        <div class="user-chip">${me().name} · ${ROLES[me().role]} <button class="btn btn-ghost" id="changePassword" style="padding:6px 10px;margin-right:8px">تغییر رمز</button></div>
      </div>
      ${pageBody()}
    </main>
  </div>`;
}
function titleOf() {
  const m = {
    dash: "داشبورد",
    new: "ثبت درخواست خرید",
    settle: "فرم تسویه فروش",
    mine: "درخواست‌های من",
    hist: "سوابق کامل جایگاه",
    inbox: "بررسی درخواست‌ها",
    settleInbox: "تسویه‌های فروش",
    stations: "مدیریت جایگاه‌ها",
    acc: "تاییدیه‌های مالی سفارش",
    settleAcc: "تایید تسویه مالی",
    sm: "تایید مدیر فروش",
    settleCom: "تسویه‌های تاییدشده",
    load: "کارشناس بارگیری",
    users: "کاربران",
    finance: "اطلاعات مالی جایگاه‌ها",
  };
  return m[page] || "پنل";
}

function pageBody() {
  if (page === "dash") return dash();
  if (page === "new") return newReq();
  if (page === "settle" && db.apiToken && me().role === 'station') return settlementStationPage();
  if ((page === "settleInbox" || page === "settleAcc" || page === "settleCom") && db.apiToken) return settlementWorkPage();
  if (page === "settle") return settleForm();
  if (page === "settleInbox" || page === "settleAcc" || page === "settleCom") return settleList();
  if (page === "inbox" && db.apiToken) return salesInboxPage();
  if (page === "acc" && db.apiToken && me().role === 'accounting') return workflowApprovalPage();
  if (page === "load" && db.apiToken && me().role === 'loading') return loadingPage();
  if (page === "mine" || page === "inbox" || page === "acc" || page === "sm" || page === "load") return listPage();
  if (page === "hist") return hist();
  if (page === "stations") return stationsPage();
  if (page === "users") return usersPage();
  if (page === "finance") return financePage();
  return "";
}

function stationDash() {
  return `<div id="stationDash"><div class="grid kpis"><div class="card kpi"><div class="lbl">اعتبار مالی باقی‌مانده</div><div class="val ok" id="sdCredit">در حال بارگذاری...</div></div><div class="card kpi"><div class="lbl">تاریخ آخرین تسویه (شمسی)</div><div class="val" id="sdSettle">—</div></div><div class="card kpi"><div class="lbl">روز گذشته از آخرین تسویه حساب</div><div class="val" id="sdDays">—</div></div><div class="card kpi"><div class="lbl">مجموع لیتر خریداری‌شده تا کنون</div><div class="val" id="sdLiters">—</div></div><div class="card kpi"><div class="lbl">مجموع مبلغ پرداختی تا کنون</div><div class="val" id="sdPaid">—</div></div><div class="card kpi"><div class="lbl">قیمت هر لیتر بنزین</div><div class="val">${rial(PRICE_PER_LITER)}</div></div></div><div class="card" style="margin-top:16px"><h3>درخواست‌های جاری</h3><div id="stationActiveOrders">در حال بارگذاری...</div></div></div>`;
}

async function openStationOrder(id){try{const d=await apiCall('station_order_detail&id='+id),o=d.order;const old=document.getElementById('stationOrderModal');if(old)old.remove();document.body.insertAdjacentHTML('beforeend',`<div id="stationOrderModal" style="position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:50;overflow:auto;padding:30px"><div class="card" style="max-width:850px;margin:auto"><h2>${o.order_code} — ${o.station_name}</h2><p class="status">${STATUS[o.status]||o.status}</p><p>مقدار: ${Number(o.liters).toLocaleString('en-US')} لیتر — مبلغ: ${Number(o.liters*o.unit_price_rial).toLocaleString('en-US')} ریال</p>${o.status==='proforma_sent'||o.status==='returned_station'?`<div class="row3"><div><label>نام راننده</label><input id="soDriver"></div><div><label>شماره پلاک</label><input id="soPlate"></div><div><label>کد ملی راننده</label><input id="soNational" inputmode="numeric"></div></div><div class="row"><div><label>نوع ماشین/تانکر</label><input id="soVehicle"></div><div><label>مبلغ پرداختی (ریال)</label><input id="soAmount" inputmode="numeric"></div></div><label>پیوست رسید پرداخت (اختیاری PDF/JPG تا ۱ مگابایت)</label><input id="soReceipt" type="file" accept="application/pdf,image/jpeg"><label>توضیحات</label><textarea id="soNote"></textarea><div class="actions"><button class="btn btn-green" id="soSend">ارسال اطلاعات به کارشناس فروش</button>`:''}<button class="btn btn-ghost" id="soClose">بستن</button></div><h4>گردش درخواست</h4><div class="timeline">${(d.logs||[]).map(l=>`<div class="tl-item"><strong>${l.action}</strong><br><small>${gregorianToJalaliDateTime(l.created_at)} — ${l.user_name||'سیستم'}</small></div>`).join('')}</div></div></div>`);document.getElementById('soClose').onclick=()=>document.getElementById('stationOrderModal').remove();const send=document.getElementById('soSend');if(send)send.onclick=async()=>{const fd=new FormData();fd.append('order_id',id);fd.append('driver_name',document.getElementById('soDriver').value);fd.append('vehicle_plate',document.getElementById('soPlate').value);fd.append('driver_national_id',document.getElementById('soNational').value);fd.append('vehicle_type',document.getElementById('soVehicle').value);fd.append('payment_amount_rial',document.getElementById('soAmount').value.replace(/,/g,''));fd.append('note',document.getElementById('soNote').value);const f=document.getElementById('soReceipt').files[0];if(f)fd.append('receipt',f);try{const r=await fetch('api.php?action=station_order_resubmit',{method:'POST',headers:{Authorization:'Bearer '+db.apiToken},body:fd});const j=await r.json();if(!j.ok)throw Error(j.message);alert('اطلاعات با موفقیت برای کارشناس فروش ارسال شد.');document.getElementById('stationOrderModal').remove();render()}catch(e){alert(e.message)}}}catch(e){alert(e.message)}}

async function bindStationDash() {
  try { const d=await apiCall('station_profile'),s=d.station; const credit=Number(s.remaining_credit_rial||0); const days=s.last_received_date?Math.max(0,Math.floor((Date.now()-new Date(s.last_received_date+'T12:00:00').getTime())/86400000)):0; document.getElementById('sdCredit').textContent=rial(credit);document.getElementById('sdSettle').textContent=gregorianToJalali(s.last_settlement_date);document.getElementById('sdDays').textContent=days+' روز';document.getElementById('sdLiters').textContent=Number(s.total_sales_liters||0).toLocaleString('en-US')+' لیتر';document.getElementById('sdPaid').textContent=rial(s.total_received_rial||0); const h=await apiCall('station_history'); const active=(h.orders||[]).filter(o=>!['loaded','rejected','cancelled'].includes(o.status)); const box=document.getElementById('stationActiveOrders'); box.innerHTML=active.length?`<table><thead><tr><th>کد</th><th>تاریخ ثبت</th><th>لیتر</th><th>مبلغ</th><th>وضعیت</th><th></th></tr></thead><tbody>${active.map(o=>`<tr><td>${o.order_code}</td><td>${gregorianToJalaliDateTime(o.created_at)}</td><td>${Number(o.liters).toLocaleString('en-US')}</td><td>${Number(o.total_rial).toLocaleString('en-US')} ریال</td><td><span class="status">${STATUS[o.status]||o.status}</span></td><td><button class="btn btn-ghost" data-active-id="${o.id}">مشاهده روند</button></td></tr>`).join('')}</tbody></table>`:'<p class="muted">درخواست جاری وجود ندارد.</p>';box.querySelectorAll('[data-active-id]').forEach(b=>b.onclick=()=>openStationOrder(b.dataset.activeId)); } catch(e){const r=document.getElementById('stationDash');if(r)r.innerHTML='<div class="card err">'+e.message+'</div>';}
}

function dash() {
  const r = me().role;
  if (r === "station") {
    const st = stationById(me().stationId);
    const b = badgeOf(st);
    const rem = remainingCredit(st);
    const maxO = st.guaranteeToman / 2;
    const my = db.requests.filter((x) => x.stationId === st.id);
    return stationDash();
  }
  if (selectedId && !String(selectedId).startsWith("S")) return detail(selectedId);
  if (r === "sales") return salesDashboard();
  if (r === "accounting") return accountingDashboard();
  if (r === "salesManager") return workflowInboxDash();
  if (r === "loading") return loadingDashboard();
  if (r === "commerce") return commerceDash();
  const pending = db.requests.filter((x) => x.status !== "loaded" && x.status !== "rejected");
  return `<div class="grid kpis">
    <div class="card kpi"><div class="lbl">درخواست‌های باز</div><div class="val">${num(pending.length)}</div></div>
    <div class="card kpi"><div class="lbl">جایگاه‌های فعال</div><div class="val">${num(db.stations.length)}</div></div>
    <div class="card kpi"><div class="lbl">قیمت هر لیتر</div><div class="val">${rial(PRICE_PER_LITER)}</div></div>
  </div>
  <div class="card" style="margin-top:16px">${reqTable(db.requests)}</div>`;
}

function reqTable(list) {
  if (!list.length) return `<p class="muted" style="margin-top:10px">موردی نیست.</p>`;
  return `<table><thead><tr><th>کد</th><th>جایگاه</th><th>لیتر</th><th>مبلغ</th><th>وضعیت</th><th></th></tr></thead><tbody>
    ${list
      .slice()
      .reverse()
      .map((x) => {
        const st = stationById(x.stationId);
        const b = badgeOf(st);
        return `<tr>
        <td>${x.id}</td>
        <td>${st.name} <span class="dot ${b.dot}" title="${b.label}"></span></td>
        <td>${liter(x.liters)}</td>
        <td>${rial(x.liters * PRICE_PER_LITER)}</td>
        <td><span class="status">${STATUS[x.status] || x.status}</span></td>
        <td><button class="btn btn-ghost" data-open="${x.id}">مشاهده</button></td>
      </tr>`;
      })
      .join("")}
  </tbody></table>`;
}

function newReq() {
  return `<div class="card"><h3>ثبت درخواست خرید</h3><p class="muted">اطلاعات اعتبار و آخرین تسویه از دیتابیس خوانده می‌شود.</p><div class="grid kpis"><div class="card kpi"><div class="lbl">تاریخ آخرین تسویه (شمسی)</div><div class="val" id="nrLastSettle">—</div></div><div class="card kpi"><div class="lbl">اعتبار مالی باقی‌مانده</div><div class="val ok" id="nrCredit">—</div></div><div class="card kpi"><div class="lbl">قیمت هر لیتر بنزین</div><div class="val" id="nrPrice">—</div></div></div><div class="row"><div><label>مقدار درخواستی (لیتر)</label><input id="nrLiters" type="number" min="1" inputmode="numeric"><small id="nrLitersWords" class="muted"></small></div><div><label>مبلغ سفارش (ریال)</label><input id="nrTotal" disabled><small id="nrTotalWords" class="muted"></small></div></div><p id="nrWarning" class="warn"></p><label>توضیحات</label><textarea id="nrNote" placeholder="توضیحات درخواست را وارد کنید"></textarea><div class="actions"><button class="btn btn-gold" id="nrSubmit" style="width:auto">ثبت و ارسال به کارشناس فروش</button></div></div>`;
}

async function bindNewReq() {
  try {
    const d = await apiCall('station_profile');
    const st = d.station;
    const price = PRICE_PER_LITER;
    const credit = Math.max(0, Number(st.credit_limit_rial || 0) - Number(st.balance_rial || 0));
    document.getElementById('nrLastSettle').textContent = gregorianToJalali(st.last_settlement_date) || '—';
    document.getElementById('nrCredit').textContent = rial(credit);
    document.getElementById('nrPrice').textContent = rial(price);
    const litersInput = document.getElementById('nrLiters');
    const totalInput = document.getElementById('nrTotal');
    const warning = document.getElementById('nrWarning');
    const update = () => { const liters = Number(litersInput.value) || 0; const total = liters * price; totalInput.value = total ? total.toLocaleString('en-US') : '0'; document.getElementById('nrLitersWords').textContent = liters ? persianNumberWords(liters).replace('ریال','لیتر') : ''; document.getElementById('nrTotalWords').textContent = total ? persianNumberWords(total) : ''; warning.textContent = total > credit ? 'مبلغ سفارش از اعتبار باقی‌مانده شما بیشتر است، نیاز به بررسی و اعلام کارشناس فروش دارد.' : ''; };
    litersInput.oninput = update; update();
    document.getElementById('nrSubmit').onclick = async () => {
      try {
        const liters = Number(litersInput.value) || 0; const total = liters * price;
        if (!liters) throw Error('مقدار لیتر را وارد کنید.');
        if (!confirm('آیا از ثبت درخواست خرید مطمئن هستید؟')) return;
        const result = await apiCall('station_create_order', 'POST', { liters, note: document.getElementById('nrNote').value });
        alert('درخواست ' + result.order_code + ' با موفقیت برای کارشناس فروش ارسال شد.'); page = 'hist'; render();
      } catch (e) { alert(e.message); }
    };
  } catch (e) { const warning = document.getElementById('nrWarning'); if (warning) warning.textContent = e.message; }
}

function settlementStationPage(){return `<div class="card"><h3>فرم تسویه فروش</h3><p class="muted">میزان فروش، مبلغ واریزی، تاریخ و فیش را ثبت کنید.</p><div class="row" style="align-items:end"><div><label>میزان فروش (لیتر)</label><input id="apiSvLiters" type="number" inputmode="decimal"></div><div style="max-width:90px;text-align:center;padding-bottom:12px;color:#e2ad28;font-weight:bold">⇄ تسویه ⇄</div><div><label>مبلغ واریزی (ریال)</label><input id="apiSvAmount" inputmode="numeric"></div></div><div class="row"><div><label>تاریخ واریز شمسی</label><div class="row3" style="display:flex;gap:6px"><select id="apiSvY"><option value="">سال</option>${jalaliSelectOptions(1400,1410)}</select><select id="apiSvM"><option value="">ماه</option>${jalaliSelectOptions(1,12)}</select><select id="apiSvD"><option value="">روز</option>${jalaliSelectOptions(1,31)}</select></div></div><div><label>فیش واریزی (اختیاری)</label><input id="apiSvReceipt" type="file" accept="application/pdf,image/jpeg,image/png"></div></div><label>توضیحات</label><textarea id="apiSvNote"></textarea><button class="btn btn-gold" id="apiSvSubmit">ارسال به کارشناس فروش</button></div><div class="card" style="margin-top:14px"><h3>سوابق تسویه</h3><div id="settlementBox">در حال بارگذاری...</div></div>`;}
function settlementWorkPage(){const r=me().role;return `<div class="card"><h3>${r==='accounting'?'تأیید تسویه مالی':r==='sales'?'تسویه‌های فروش':'سوابق تسویه‌های تأییدشده'}</h3><div id="settlementBox">در حال بارگذاری...</div></div>`;}
async function bindSettlementPage(){const box=document.getElementById('settlementBox');try{const d=await apiCall('settlement_list');box.innerHTML=d.items.length?`<table><thead><tr><th>کد</th><th>جایگاه</th><th>لیتر</th><th>مبلغ</th><th>تاریخ</th><th>وضعیت</th><th></th></tr></thead><tbody>${d.items.map(x=>`<tr style="${x.status==='approved'?'background:rgba(53,208,127,.12)':''}"><td>${x.settlement_code}</td><td>${x.station_name}</td><td>${Number(x.sales_liters).toLocaleString('en-US')}</td><td>${Number(x.amount_rial).toLocaleString('en-US')} ریال</td><td>${gregorianToJalali(x.paid_on)}</td><td>${x.status}</td><td><button class="btn btn-ghost" data-settle-open="${x.id}">مشاهده</button></td></tr>`).join('')}</tbody></table>`:'<p class="muted">موردی وجود ندارد.</p>';box.querySelectorAll('[data-settle-open]').forEach(b=>b.onclick=()=>openSettlement(b.dataset.settleOpen));if(me().role==='station'){const btn=document.getElementById('apiSvSubmit');if(btn)btn.onclick=submitSettlement;const lit=document.getElementById('apiSvLiters'),amt=document.getElementById('apiSvAmount');if(lit)lit.oninput=()=>{const n=lit.value.replace(/,/g,'');if(n)lit.value=Number(n).toLocaleString('en-US')};if(amt)amt.oninput=()=>{const n=amt.value.replace(/,/g,'');if(n)amt.value=Number(n).toLocaleString('en-US')}}}catch(e){box.innerHTML='<p class="err">'+e.message+'</p>';}}
async function submitSettlement(){const y=+document.getElementById('apiSvY').value,mn=+document.getElementById('apiSvM').value,d=+document.getElementById('apiSvD').value;if(!y||!mn||!d)return alert('سال، ماه و روز تاریخ واریز را انتخاب کنید.');const g=jalaliToGregorian(y,mn,d);const f=new FormData();f.append('sales_liters',document.getElementById('apiSvLiters').value.replace(/,/g,''));f.append('amount_rial',document.getElementById('apiSvAmount').value.replace(/,/g,''));f.append('paid_on',g);f.append('note',document.getElementById('apiSvNote').value);const file=document.getElementById('apiSvReceipt').files[0];if(file)f.append('receipt',file);try{const r=await fetch('api.php?action=settlement_create',{method:'POST',headers:{Authorization:'Bearer '+db.apiToken},body:f});const j=await r.json();if(!j.ok)throw Error(j.message);alert('فرم تسویه برای کارشناس فروش ارسال شد.');render();}catch(e){alert(e.message);}}
async function openSettlement(id){try{const d=await apiCall('settlement_detail&id='+id),x=d.settlement;const logs=(d.logs||[]).map(l=>`<div style="padding:8px;border-bottom:1px solid var(--line)"><b>${l.action}</b><br><small>${gregorianToJalaliDateTime(l.created_at)} — ${l.user_name||''}</small><br>${l.note||''}</div>`).join('');const finance=me().role==='accounting'&&x.status==='pending_finance';const sales=me().role==='sales'&&['pending_sales','returned_station'].includes(x.status);document.body.insertAdjacentHTML('beforeend',`<div id="settleModal" style="position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:60;overflow:auto;padding:30px"><div class="card" style="max-width:800px;margin:auto"><h2>${x.settlement_code} — ${x.station_name}</h2><p>شهر: ${x.city||'—'} | فروش: ${Number(x.sales_liters).toLocaleString('en-US')} لیتر | مبلغ: ${Number(x.amount_rial).toLocaleString('en-US')} ریال</p><p>تاریخ واریز: ${gregorianToJalali(x.paid_on)} | فیش: ${x.receipt_path?`<a href="api.php?action=download_settlement_receipt&id=${id}&token=${encodeURIComponent(db.apiToken)}" target="_blank">مشاهده فایل پیوست</a>`:'پیوست نشده'}</p><label>توضیحات</label><textarea id="settleNote">${x.note||''}</textarea><h4>گردش تسویه</h4><div>${logs||'گردشی ثبت نشده است.'}</div><div class="actions">${sales?'<button class="btn btn-green" id="stToFin">ارسال به مدیر مالی</button><button class="btn btn-red" id="stReturn">عودت برای اصلاح</button><button class="btn btn-red" id="stReject">رد</button>':''}${finance?'<button class="btn btn-green" id="stApprove">تأیید مالی و ارسال به جایگاه، فروش و بازرگانی</button><button class="btn btn-red" id="stFinReturn">بازگشت برای اصلاح</button><button class="btn btn-red" id="stFinReject">عدم تأیید و بستن</button>':''}<button class="btn btn-ghost" id="stClose">بستن</button></div></div></div>`);document.getElementById('stClose').onclick=()=>document.getElementById('settleModal').remove();const act=async(a)=>{try{await apiCall('settlement_action','POST',{settlement_id:id,action:a,note:document.getElementById('settleNote').value});alert('عملیات تسویه ثبت شد.');document.getElementById('settleModal').remove();render();}catch(e){alert(e.message)}};[['stToFin','approve'],['stReturn','return'],['stReject','reject'],['stApprove','approve'],['stFinReturn','return'],['stFinReject','reject']].forEach(([i,a])=>{const b=document.getElementById(i);if(b)b.onclick=()=>act(a);});}catch(e){alert(e.message)}}
function settleForm() {
  const st = stationById(me().stationId);
  const mine = (db.settlements || []).filter((s) => s.stationId === st.id);
  return `<div class="card">
    <h3>فرم تسویه فروش</h3>
    <p class="muted">طبق قرارداد هر ${SETTLE_DAYS} روز بخشی از بدهی تسویه شود. مسیر: کارشناس فروش سپس مدیر مالی. پس از تایید برای جایگاه‌دار، مدیر بازرگانی و کارشناس فروش ارسال می‌شود.</p>
    <p>آخرین تاریخ تسویه (خودکار): <strong>${lastSettleOf(st)}</strong></p>
    <div class="row">
      <div><label>میزان فروش (لیتر)</label><input id="svLiters" type="number" /></div>
      <div><label>مبلغ واریزی (ریال)</label><input id="svAmount" type="text" inputmode="numeric" placeholder="50,000,000" /></div>
    </div>
    <div class="row">
      <div><label>تاریخ واریز</label><input id="svDate" placeholder="1405/06/07" /></div>
      <div><label>پیوست فیش واریز</label><input id="svFile" type="file" accept="image/*,.pdf" /></div>
    </div>
    <div class="actions"><button class="btn btn-gold" id="submitSettle" style="width:auto">ارسال به کارشناس فروش</button></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>سوابق تسویه</h3>${settleTable(mine)}</div>`;
}

function settleTable(list) {
  if (!list.length) return `<p class="muted">موردی نیست.</p>`;
  return `<table><thead><tr><th>کد</th><th>جایگاه</th><th>فروش</th><th>مبلغ واریزی</th><th>تاریخ واریز</th><th>فیش</th><th>وضعیت</th><th></th></tr></thead><tbody>
    ${list
      .slice()
      .reverse()
      .map((s) => {
        const st = stationById(s.stationId);
        return `<tr>
        <td>${s.id}</td><td>${st.name}</td><td>${liter(s.salesLiters)}</td>
        <td>${rial(s.amount)}</td><td>${s.payDate}</td>
        <td>${s.receiptName || "—"}</td>
        <td><span class="status">${SETTLE_STATUS[s.status]}</span></td>
        <td><button class="btn btn-ghost" data-sv="${s.id}">مشاهده</button></td>
      </tr>`;
      })
      .join("")}
  </tbody></table>`;
}

function settleList() {
  db.settlements = db.settlements || [];
  let list = db.settlements;
  if (me().role === "sales") list = list.filter((s) => s.status === "pending_sales" || s.status === "approved");
  if (me().role === "accounting") list = list.filter((s) => s.status === "pending_finance" || s.status === "approved");
  if (me().role === "commerce") list = list.filter((s) => s.status === "approved");
  if (me().role === "station") list = list.filter((s) => s.stationId === me().stationId);
  if (selectedId && String(selectedId).startsWith("S")) return settleDetail(selectedId);
  return `<div class="card">${settleTable(list)}</div>`;
}

function settleDetail(id) {
  const s = (db.settlements || []).find((x) => x.id === id);
  if (!s) return "یافت نشد";
  const st = stationById(s.stationId);
  const role = me().role;
  let actions = `<button class="btn btn-ghost" id="back">بازگشت</button>`;
  if (role === "sales" && s.status === "pending_sales") {
    actions += `<button class="btn btn-green" id="svToFin">ارسال به مدیر مالی</button>
      <button class="btn btn-red" id="svReject">رد</button>`;
  }
  if (role === "accounting" && s.status === "pending_finance") {
    actions += `<button class="btn btn-green" id="svApprove">تایید مالی و ارسال به جایگاه / بازرگانی / فروش</button>
      <button class="btn btn-red" id="svFinNo">عدم تایید</button>`;
  }
  const img =
    s.receiptData && String(s.receiptData).startsWith("data:image")
      ? `<img src="${s.receiptData}" style="max-width:360px;border-radius:10px;margin-top:8px" alt="فیش" />`
      : s.receiptName
        ? `<p class="file-name">فیش: ${s.receiptName}</p>`
        : "<p class='muted'>فیش پیوست نشده</p>";
  return `<div class="card">
    <h3>${s.id} — ${st.name}</h3>
    <p class="status">${SETTLE_STATUS[s.status]}</p>
    <p>میزان فروش: <strong>${liter(s.salesLiters)}</strong></p>
    <p>مبلغ واریزی: <strong>${rial(s.amount)}</strong></p>
    <p>تاریخ واریز: <strong>${s.payDate}</strong></p>
    ${img}
    <label>توضیحات</label>
    <textarea id="svNote">${s.note || ""}</textarea>
    <div class="actions">${actions}</div>
    <div class="timeline">${(s.logs || []).map((l) => `<div class="tl-item"><strong>${l.by}</strong> — ${l.msg}<br><small>${l.t}</small></div>`).join("")}</div>
  </div>`;
}

function listPage() {
  let list = db.requests;
  if (page === "mine") list = list.filter((x) => x.stationId === me().stationId);
  if (page === "inbox") list = list.filter((x) => ["draft_sales", "proforma_sent", "returned_station", "finance_ok", "finance_no"].includes(x.status));
  if (page === "acc") list = list.filter((x) => x.status === "pending_accounting");
  if (page === "sm") list = list.filter((x) => x.status === "pending_sales_mgr");
  if (page === "load") list = list.filter((x) => x.status === "pending_loading" || x.status === "loaded");
  if (selectedId && !String(selectedId).startsWith("S") && !String(selectedId).startsWith("st")) return detail(selectedId);
  return `<div class="card">${reqTable(list)}</div>`;
}

function hist() {
  if (db.apiToken && me().role === 'station') return `<div class="card"><h3>سوابق جایگاه</h3><div id="historyBox">در حال بارگذاری...</div></div>`;
  const s = stationById(me().role === "station" ? me().stationId : db.stations[0].id);
  const list = db.requests.filter((x) => x.stationId === s.id);
  const b = badgeOf(s);
  return `<div class="card">
    <h3>${s.name} <span class="badge ${b.cls}"><span class="dot ${b.dot}"></span>${b.label}</span></h3>
    <p class="muted">قرارداد از ${s.contractStart} تا ${s.contractEnd} · ضمانت ${rial(s.guaranteeToman)} · اعتبار باقی ${rial(remainingCredit(s))} · آخرین تسویه ${lastSettleOf(s)}</p>
    ${reqTable(list)}
  </div>`;
}

function stationsPage() {
  if (selectedId && String(selectedId).startsWith("st")) return stationEdit(selectedId);
  return `<div class="card"><table><thead><tr><th>نشان</th><th>جایگاه</th><th>قرارداد</th><th>ضمانت</th><th>اعتبار باقی</th><th></th></tr></thead><tbody>
    ${db.stations
      .map((s) => {
        const b = badgeOf(s);
        return `<tr>
        <td><span class="dot ${b.dot}"></span></td>
        <td>${s.name}</td>
        <td>${s.contractStart} — ${s.contractEnd}</td>
        <td>${rial(s.guaranteeToman)}</td>
        <td>${rial(remainingCredit(s))}</td>
        <td><button class="btn btn-ghost" data-st="${s.id}">ویرایش</button></td>
      </tr>`;
      })
      .join("")}
  </tbody></table></div>`;
}

function stationEdit(id) {
  const s = stationById(id);
  return `<div class="card">
    <h3>ویرایش ${s.name}</h3>
    <div class="row"><div><label>تاریخ شروع قرارداد</label><input id="cs" value="${s.contractStart}" /></div>
    <div><label>تاریخ اتمام قرارداد</label><input id="ce" value="${s.contractEnd}" /></div></div>
    <div class="row"><div><label>مبلغ ضمانت (ریال)</label><input id="g" type="number" value="${s.guaranteeToman}" /></div>
    <div><label>تسویه تجمعی (ریال)</label><input id="set" type="number" value="${s.settledToman}" /></div></div>
    <div class="row"><div><label>نشان اعتباری</label>
      <select id="sc"><option value="gold" ${s.creditScore === "gold" ? "selected" : ""}>طلایی — خوش‌حساب و خوش‌فروش</option>
      <option value="silver" ${s.creditScore === "silver" ? "selected" : ""}>نقره‌ای — متوسط</option>
      <option value="red" ${s.creditScore === "red" ? "selected" : ""}>قرمز — بدحساب</option></select></div><div></div></div>
    <div class="actions"><button class="btn btn-green" id="saveSt">ذخیره</button><button class="btn btn-ghost" id="back">بازگشت</button></div>
  </div>`;
}

function salesInboxPage() { return `<div class="card"><h3>صندوق کارشناس فروش</h3><p class="muted">درخواست‌های جاری جایگاه‌ها از دیتابیس.</p><div id="salesInboxBox">در حال بارگذاری...</div></div>`; }
async function bindSalesInbox() { const box=document.getElementById('salesInboxBox'); try { const d=await apiCall('sales_inbox'); box.innerHTML=d.orders.length?`<table><thead><tr><th>کد</th><th>جایگاه</th><th>شهر</th><th>لیتر</th><th>مبلغ</th><th>تاریخ ثبت</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>${d.orders.map(o=>`<tr style="${'background:rgba(53,208,127,.12)'}"><td>${o.order_code}</td><td>${o.station_name}</td><td>${o.city}</td><td>${Number(o.liters).toLocaleString('en-US')}</td><td>${Number(o.total_rial).toLocaleString('en-US')} ریال</td><td>${gregorianToJalaliDateTime(o.created_at)}</td><td><span class="status" style="${'color:#35d07f;border-color:#35d07f;background:rgba(53,208,127,.12)'}">${STATUS[o.status]||o.status}</span></td><td><button class="btn btn-blue" data-sales-open="${o.id}">مشاهده و بررسی</button></td></tr>`).join('')}</tbody></table>`:'<p class="muted">درخواست جاری وجود ندارد.</p>'; box.querySelectorAll('[data-sales-open]').forEach(b=>b.onclick=()=>openLoadingOrder(b.dataset.salesOpen)); } catch(e) { box.innerHTML='<p class="err">'+e.message+'</p>'; } }

function usersPage() {
  return `<div class="card">${db.users.map((u) => `<div style="padding:8px 0;border-bottom:1px solid var(--line)">${u.username} — ${u.name} — ${ROLES[u.role]}</div>`).join("")}</div>`;
}

function jalaliSelectOptions(start,end){let s='';for(let i=start;i<=end;i++)s+=`<option value="${i}">${String(i).padStart(2,'۰')}</option>`;return s;}
function starPicker(id,label){return `<div style="margin:12px 0"><label>${label}</label><div class="star-rating" data-rating="${id}" style="direction:ltr;display:flex;gap:5px">${[1,2,3,4,5].map(n=>`<button type="button" data-star="${n}" style="border:0;background:none;font-size:25px;color:#56627a;cursor:pointer">★</button>`).join('')}</div></div>`;}
async function openLoadingOrder(id){try{const d=await apiCall('sales_order_detail&id='+id),o=d.order;if(!document.getElementById('loadingPrintStyle')){const st=document.createElement('style');st.id='loadingPrintStyle';st.textContent='@media print{body>*:not(#loadingOrderModal){display:none!important}#loadingOrderModal{position:static!important;background:#fff!important;padding:0!important;overflow:visible!important}#loadingOrderModal .card{max-width:none!important;color:#111!important;background:#fff!important;box-shadow:none!important}#loadingOrderModal .actions,#loadingOrderModal button{display:none!important}#loadingOrderModal a{color:#111!important;text-decoration:underline}}';document.head.appendChild(st);}const logs=(d.logs||[]).map(l=>`<div style="padding:9px 0;border-bottom:1px solid var(--line)"><strong>${l.action}</strong><br><small>${gregorianToJalaliDateTime(l.created_at)} — ${l.user_name||'سیستم'}</small><br>${l.note||''}</div>`).join('');const stars=(n)=>n?`<span style="color:#f5b942">${'★'.repeat(Number(n))}</span><span style="color:#56627a">${'★'.repeat(5-Number(n))}</span>`:'ثبت نشده';document.body.insertAdjacentHTML('beforeend',`<div id="loadingOrderModal" style="position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:50;overflow:auto;padding:30px"><div class="card" style="max-width:850px;margin:auto"><h2>${o.order_code} — ${o.station_name}</h2><p class="status" style="color:#35d07f;border-color:#35d07f;background:rgba(53,208,127,.12)">${STATUS[o.status]||o.status}</p><div class="row3"><div>شهر جایگاه: <strong>${o.city||'—'}</strong></div><div>مقدار: <strong>${Number(o.liters).toLocaleString('en-US')} لیتر</strong></div><div>مبلغ: <strong>${Number(o.liters*o.unit_price_rial).toLocaleString('en-US')} ریال</strong></div></div><div class="row3"><div>پیش‌فاکتور: <strong>${o.proforma_no||'—'}</strong></div><div>راننده: <strong>${o.driver_name||'—'}</strong></div><div>پلاک: <strong>${o.vehicle_plate||'—'}</strong></div></div><div class="row3"><div>کد ملی: <strong>${o.driver_national_id||'—'}</strong></div><div>نوع ماشین: <strong>${o.vehicle_type||o.vehicle_description||'—'}</strong></div><div>مبلغ پرداختی: <strong>${Number(o.payment_amount_rial||0).toLocaleString('en-US')} ریال</strong></div></div><p>تاریخ و ساعت بارگیری: <strong>${o.loaded_at?gregorianToJalaliDateTime(o.loaded_at):'هنوز ثبت نشده'}</strong></p><h4>گردش کامل درخواست</h4><div class="timeline">${logs||'<p class="muted">گردشی ثبت نشده است.</p>'}</div><h4>نتیجه امتیازدهی راننده</h4><div class="row3"><div>کلی: ${stars(o.driver_rating)}</div><div>رفتار: ${stars(o.behavior_rating)}</div><div>ایمنی: ${stars(o.safety_rating)}</div></div><div class="row3"><div>خودرو: ${stars(o.vehicle_rating)}</div><div>به‌موقع: ${stars(o.punctuality_rating)}</div><div>مخزن: ${stars(o.cleanliness_rating)}</div></div><p>پیوست‌ها: ${o.waybill_original_name?`<a href="api.php?action=download_loading_file&id=${id}&type=waybill&token=${encodeURIComponent(db.apiToken)}" target="_blank">دانلود حواله بارگیری</a>`:'حواله پیوست نشده'} — ${o.security_original_name?`<a href="api.php?action=download_loading_file&id=${id}&type=security&token=${encodeURIComponent(db.apiToken)}" target="_blank">دانلود فرم حراست</a>`:'فرم حراست پیوست نشده'}</p><div class="actions"><button class="btn btn-gold" id="ldPrint">PDF/چاپ</button><button class="btn btn-ghost" id="ldClose">بستن</button></div></div></div>`);document.getElementById('ldClose').onclick=()=>document.getElementById('loadingOrderModal').remove();document.getElementById('ldPrint').onclick=()=>window.print()}catch(e){alert(e.message)}}
function loadingDashboard(){return `<div class="card"><h3>داشبورد کارشناس بارگیری</h3><p class="muted">برای مشاهده درخواست‌های تأییدشده، وارد بخش «بارگیری» شوید.</p></div>`;}
function loadingPage(){return `<div class="card"><h3>بارگیری</h3><p class="muted">درخواست‌های تأییدشده و تکمیل‌شده در این بخش نمایش داده می‌شوند.</p><div id="workflowInboxBox">در حال بارگذاری...</div></div>`;}
function accountingDashboard(){return `<div class="card"><h3>داشبورد مدیر مالی</h3><h4>تأیید تسویه مالی</h4><div id="accountingSettlementDash">در حال بارگذاری...</div><h4 style="margin-top:20px">تأیید مالی سفارش‌ها</h4><div id="accountingOrdersDash">در حال بارگذاری...</div></div>`;}
async function bindAccountingDashboard(){try{const s=await apiCall('settlement_list'),a=document.getElementById('accountingSettlementDash');a.innerHTML=s.items.length?`<table><thead><tr><th>کد</th><th>جایگاه</th><th>مبلغ</th><th>تاریخ</th><th>عملیات</th></tr></thead><tbody>${s.items.map(x=>`<tr><td>${x.settlement_code}</td><td>${x.station_name}</td><td>${Number(x.amount_rial).toLocaleString('en-US')} ریال</td><td>${gregorianToJalali(x.paid_on)}</td><td><button class="btn btn-ghost" data-settle-open="${x.id}">مشاهده</button></td></tr>`).join('')}</tbody></table>`:'<p class="muted">تسویه در انتظار تأیید وجود ندارد.</p>';a.querySelectorAll('[data-settle-open]').forEach(b=>b.onclick=()=>openSettlement(b.dataset.settleOpen));const d=await apiCall('sales_inbox'),o=document.getElementById('accountingOrdersDash');o.innerHTML=renderSalesOrders(d.orders);o.querySelectorAll('[data-sales-open]').forEach(b=>b.onclick=async()=>{const d=await apiCall('sales_order_detail&id='+b.dataset.salesOpen);d.order.status==='pending_accounting'?openSalesOrder(b.dataset.salesOpen):openLoadingOrder(b.dataset.salesOpen);});}catch(e){document.getElementById('accountingSettlementDash').innerHTML='<p class="err">'+e.message+'</p>';}}
function workflowApprovalPage(){return `<div class="card"><h3>تأیید مالی سفارش‌ها</h3><p class="muted">درخواست‌های در انتظار تصمیم مدیر مالی در این بخش باقی می‌مانند تا تأیید یا عدم تأیید شوند.</p><div id="workflowInboxBox">در حال بارگذاری...</div></div>`;}
function workflowInboxDash(){const r=me().role;const title=r==='accounting'?'کارتابل مدیر مالی':r==='salesManager'?'کارتابل مدیر بازرگانی':'کارتابل کارشناس بارگیری';return `<div class="card"><h3>${title}</h3><p class="muted">درخواست‌های ارجاع‌شده برای بررسی در این کارتابل نمایش داده می‌شوند.</p><div id="workflowInboxBox">در حال بارگذاری...</div></div>`;}
async function bindWorkflowInbox(){const b=document.getElementById('workflowInboxBox');try{const d=await apiCall('sales_inbox');b.innerHTML=renderSalesOrders(d.orders);b.querySelectorAll('[data-sales-open]').forEach(x=>x.onclick=()=>me().role==='loading'?openLoadingOrder(x.dataset.salesOpen):openSalesOrder(x.dataset.salesOpen));}catch(e){b.innerHTML='<p class="err">'+e.message+'</p>';}}
function salesDashboard(){return `<div class="card"><h3>داشبورد کارشناس فروش</h3><p class="muted">تسویه‌های جدید تا زمان تأیید نهایی مدیر مالی در اینجا نمایش داده می‌شوند.</p><div id="salesSettlementDash">در حال بارگذاری...</div></div>`;}
async function bindSalesDashboard(){const b=document.getElementById('salesSettlementDash');if(!b)return;try{const d=await apiCall('settlement_list');b.innerHTML=d.items.length?`<table><thead><tr><th>کد</th><th>جایگاه</th><th>مبلغ</th><th>تاریخ</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>${d.items.map(x=>`<tr><td>${x.settlement_code}</td><td>${x.station_name}</td><td>${Number(x.amount_rial).toLocaleString('en-US')} ریال</td><td>${gregorianToJalali(x.paid_on)}</td><td>${x.status}</td><td><button class="btn btn-ghost" data-dash-settle="${x.id}">مشاهده</button></td></tr>`).join('')}</tbody></table>`:'<p class="muted">تسویه ارجاع‌شده‌ای وجود ندارد.</p>';b.querySelectorAll('[data-dash-settle]').forEach(x=>x.onclick=()=>openSettlement(x.dataset.dashSettle));}catch(e){b.innerHTML='<p class="err">'+e.message+'</p>';}}
function salesDash() { return `<div class="card"><h3>درخواست‌های جاری کارشناس فروش</h3><div id="salesDashBox">در حال بارگذاری...</div></div>`; }
async function bindSalesDash(){const b=document.getElementById('salesDashBox');try{const d=await apiCall('sales_inbox');b.innerHTML=renderSalesOrders(d.orders)}catch(e){b.textContent=e.message;b.className='err';}}
function renderSalesOrders(list){return list.length?`<table><thead><tr><th>کد</th><th>جایگاه</th><th>لیتر</th><th>مبلغ</th><th>تاریخ ثبت</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>${list.map(o=>`<tr style="${['pending_loading','loaded'].includes(o.status)?'background:rgba(53,208,127,.10)':''}"><td>${o.order_code}</td><td>${o.station_name}</td><td>${Number(o.liters).toLocaleString('en-US')}</td><td>${Number(o.total_rial).toLocaleString('en-US')} ریال</td><td>${gregorianToJalaliDateTime(o.created_at)}</td><td><span class="status" style="${['pending_loading','loaded'].includes(o.status)?'color:#35d07f;border-color:#35d07f;background:rgba(53,208,127,.12)':''}">${STATUS[o.status]||o.status}</span></td><td><button class="btn btn-blue" data-sales-open="${o.id}">مشاهده و بررسی</button></td></tr>`).join('')}</tbody></table>`:'<p class="muted">درخواست جاری وجود ندارد.</p>';}
async function openSalesOrder(id){try{const d=await apiCall('sales_order_detail&id='+id),o=d.order;const old=document.getElementById('salesOrderModal');if(old)old.remove();const logs=(d.logs||[]).map(l=>`<div style="padding:8px 0;border-bottom:1px solid var(--line)"><strong>${l.action}</strong><br><small>${gregorianToJalaliDateTime(l.created_at)} — ${l.user_name||'سیستم'}</small><br>${l.note||''}</div>`).join('');document.body.insertAdjacentHTML('beforeend',`<div id="salesOrderModal" style="position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:50;overflow:auto;padding:30px"><div class="card" style="max-width:850px;margin:auto"><h2>${o.order_code} — ${o.station_name}</h2><p class="status" style="${'color:#35d07f;border-color:#35d07f;background:rgba(53,208,127,.12)'}">${STATUS[o.status]||o.status}</p><div class="row3"><div>شهر: <strong>${o.city||'—'}</strong></div><div>مقدار: <strong>${Number(o.liters).toLocaleString('en-US')} لیتر</strong></div><div>مبلغ: <strong>${Number(o.liters*o.unit_price_rial).toLocaleString('en-US')} ریال</strong></div></div><div class="row3"><div>پیش‌فاکتور: <strong>${o.proforma_no||'—'}</strong></div><div>راننده: <strong>${o.driver_name||'—'}</strong></div><div>پلاک: <strong>${o.vehicle_plate||'—'}</strong></div></div><div class="row3"><div>کد ملی راننده: <strong>${o.driver_national_id||'—'}</strong></div><div>نوع ماشین: <strong>${o.vehicle_type||'—'}</strong></div><div>مبلغ پرداختی: <strong>${Number(o.payment_amount_rial||0).toLocaleString('en-US')} ریال</strong></div></div><p>رسید پرداخت: <strong>${o.payment_receipt_name||'پیوست نشده'}</strong></p><label>یادداشت بررسی / علت عودت</label><textarea id="salesActionNote">${o.sales_note||''}</textarea><h4>گردش درخواست</h4><div class="timeline">${logs||'<p class="muted">گردشی ثبت نشده است.</p>'}</div><div class="actions">${me().role==='accounting'&&o.status==='pending_accounting'?'<button class="btn btn-green" id="modalFinanceApprove">مورد تأیید است و ارسال برای مدیر بازرگانی</button><button class="btn btn-red" id="modalFinanceReject">مورد تأیید نیست و ارجاع به کارشناس فروش</button>':(me().role==='salesManager'&&o.status==='pending_sales_mgr'?'<button class="btn btn-green" id="modalCommerceApprove">تأیید و ارسال برای کارشناس بارگیری</button><button class="btn btn-red" id="modalCommerceReject">عدم تأیید و ارجاع به کارشناس فروش</button>':(o.status==='proforma_sent'&&o.driver_name?'<button class="btn btn-green" id="modalForwardFinance">تأیید و ارسال برای مدیر مالی</button>':'<button class="btn btn-green" id="modalApprove">صدور پیش‌فاکتور و ارسال به جایگاه</button>')+(me().role==='accounting'?'':'<button class="btn btn-red" id="modalReturn">عودت برای اصلاح</button><button class="btn btn-red" id="modalCancel">لغو و ابطال</button>'))}<button class="btn btn-ghost" id="modalClose">بستن</button></div></div></div>`);document.getElementById('modalClose').onclick=()=>document.getElementById('salesOrderModal').remove();const act=async(a)=>{try{const oldStatus=o.status;await apiCall('sales_order_action','POST',{order_id:id,action:a,note:document.getElementById('salesActionNote').value});const msg=me().role==='accounting'?(a==='approve'?'تأیید مالی انجام شد و درخواست برای مدیر بازرگانی ارسال شد.':'درخواست تأیید نشد و برای کارشناس فروش ارجاع شد.'):me().role==='salesManager'?(a==='approve'?'درخواست تأیید شد و برای کارشناس بارگیری ارسال شد.':'درخواست تأیید نشد و برای کارشناس فروش ارجاع شد.'):(a==='return'?'درخواست برای اصلاح به جایگاه‌دار عودت شد.':a==='reject'?'درخواست لغو و ابطال شد.':oldStatus==='proforma_sent'?'اطلاعات تأیید شد و درخواست برای مدیر مالی ارسال شد.':'پیش‌فاکتور صادر و برای جایگاه‌دار ارسال شد.');alert(msg);document.getElementById('salesOrderModal').remove();render()}catch(e){alert(e.message)}};const ap=document.getElementById('modalApprove');if(ap)ap.onclick=()=>act('approve');const ff=document.getElementById('modalForwardFinance');if(ff)ff.onclick=()=>act('approve');const fa=document.getElementById('modalFinanceApprove');if(fa)fa.onclick=()=>act('approve');const fr=document.getElementById('modalFinanceReject');if(fr)fr.onclick=()=>act('reject');const ca=document.getElementById('modalCommerceApprove');if(ca)ca.onclick=()=>act('approve');const cr=document.getElementById('modalCommerceReject');if(cr)cr.onclick=()=>act('reject');const rt=document.getElementById('modalReturn');if(rt)rt.onclick=()=>act('return');const cx=document.getElementById('modalCancel');if(cx)cx.onclick=()=>act('reject')}catch(e){alert(e.message)}}
function bindSalesActions(){document.querySelectorAll('[data-sales-open]').forEach(b=>b.onclick=()=>openSalesOrder(b.dataset.salesOpen));}

function commerceDash() {
  return `<div id="commerceRoot"><div class="grid kpis"><div class="card kpi"><div class="lbl">فروش بارگیری‌شده (تن)</div><div class="val" id="cmTons">—</div></div><div class="card kpi"><div class="lbl">فروش بارگیری‌شده (ریال)</div><div class="val" id="cmAmount">—</div></div><div class="card kpi"><div class="lbl">باقی‌مانده مخزن‌ها</div><div class="val" id="cmStock">—</div></div><div class="card kpi"><div class="lbl">جایگاه‌های فعال</div><div class="val" id="cmStations">—</div></div><div class="card kpi"><div class="lbl">مبلغ تسویه‌نشده</div><div class="val warn" id="cmUnsettled">—</div></div></div><div class="card" style="margin-top:16px"><h3>نمودار خلاصه فروش</h3><div id="cmBars" style="display:flex;align-items:end;gap:14px;height:180px;margin-top:18px"></div><p class="muted">نمودار بر اساس سفارش‌های بارگیری‌شده است.</p></div><div class="card" style="margin-top:16px"><h3>آخرین سفارش‌های بارگیری‌شده</h3><div id="cmRecent">در حال بارگذاری...</div></div></div>`;
}

async function bindCommerce() {
  try { const d=await apiCall("commerce_dashboard"),m=d.metrics; const tons=(m.loaded_liters*0.745/1000); document.getElementById("cmTons").textContent=tons.toLocaleString("en-US",{maximumFractionDigits:2})+" تن"; document.getElementById("cmAmount").textContent=Number(m.loaded_amount_rial).toLocaleString("en-US")+" ریال"; document.getElementById("cmStock").textContent=Number(m.remaining_stock_liters).toLocaleString("en-US")+" لیتر"; document.getElementById("cmStations").textContent=Number(m.active_stations).toLocaleString("en-US"); document.getElementById("cmUnsettled").textContent=Number(m.unsettled_amount_rial).toLocaleString("en-US")+" ریال"; const max=Math.max(...d.recent.map(x=>Number(x.load_liters||x.liters||0)),1); document.getElementById("cmBars").innerHTML=d.recent.length?d.recent.slice(0,8).map(x=>`<a href="#" data-open="${x.id}" style="height:${Math.max(12,Number(x.load_liters||x.liters||0)/max*150)}px;flex:1;background:linear-gradient(#f0c14b,#9b6800);border-radius:8px 8px 0 0;position:relative" title="${x.order_code}"><span style="position:absolute;bottom:-25px;right:0;font-size:10px;color:#9caec5">${x.city||''}</span></a>`).join(''):'<span class="muted">داده‌ای وجود ندارد.</span>'; document.getElementById("cmRecent").innerHTML=d.recent.length?`<table><thead><tr><th>کد</th><th>جایگاه</th><th>شهر</th><th>لیتر</th><th>تاریخ</th></tr></thead><tbody>${d.recent.map(x=>`<tr><td><button class="btn btn-ghost" data-open="${x.id}">${x.order_code}</button></td><td>${x.station_name}</td><td>${x.city}</td><td>${Number(x.load_liters||x.liters).toLocaleString('en-US')}</td><td>${x.loaded_at||'—'}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">موردی نیست.</p>'; document.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{e.preventDefault();selectedId=b.dataset.open;render()}); } catch(e) { const r=document.getElementById("commerceRoot"); if(r) r.innerHTML='<div class="card err">'+e.message+'</div>'; }
}

function financePage() {
  return `<div class="card"><h3>اطلاعات مالی و قراردادی جایگاه‌ها</h3><p class="muted">فرم کامل اطلاعات قرارداد، اعتبار، فروش و دریافت جایگاه.</p>
  <div class="row3"><div><label>شماره قرارداد</label><input id="fContractNo"></div><div><label>جایگاه</label><select id="fStation"><option value="">انتخاب جایگاه</option></select></div><div><label>شهر</label><input id="fCity" disabled></div></div>
  <div class="row3"><div><label>مالک</label><input id="fOwner"></div><div><label>تاریخ شروع قرارداد (شمسی)</label><input id="fStart" placeholder="۱۴۰۵/۰۱/۰۱"></div><div><label>تاریخ پایان قرارداد (شمسی)</label><input id="fEnd" placeholder="۱۴۰۶/۰۱/۰۱"></div></div>
  <div class="row3"><div><label>نوع قرارداد</label><select id="fType"><option value="cash">نقدی</option><option value="credit">اعتباری</option></select></div><div><label>چک اعتبار</label><select id="fCheck"><option value="1">دارد</option><option value="0">ندارد</option></select></div><div><label>مبلغ چک اعتبار (ریال)</label><input id="fCheckAmount" inputmode="numeric"><small id="fCheckAmountWords" class="muted"></small></div></div><div class="row3"><div><label>سقف اعتبار (ریال)</label><input id="fLimit" inputmode="numeric"><small id="fLimitWords" class="muted"></small></div><div><label>اعتبار مالی باقی‌مانده (ریال)</label><input id="fRemainingCredit" disabled></div><div></div><div></div></div>
  <div class="row3"><div><label>پایان الحاقیه (شمسی)</label><input id="fAnnex" placeholder="۱۴۰۵/۱۲/۲۹"></div><div><label>درصد کارمزد</label><input id="fCommission" type="number" step="0.001"></div><div><label>وضعیت اعتباری</label><select id="fCredit"><option value="gold">طلایی</option><option value="silver">نقره‌ای</option><option value="red">قرمز</option><option value="review">در حال بررسی</option></select></div></div>
  <div class="row3"><div><label>تاریخ آخرین تسویه (شمسی)</label><input id="fSettlement" placeholder="۱۴۰۵/۰۶/۱۱"></div><div><label>تاریخ آخرین فروش به مشتری (شمسی)</label><input id="fSale" placeholder="۱۴۰۵/۰۶/۱۱"></div><div><label>تاریخ آخرین دریافتی از مشتری (شمسی)</label><input id="fReceived" placeholder="۱۴۰۵/۰۶/۱۱"></div></div>
  <div class="row3"><div><label>وضعیت بدهکاری/طلبکاری (ریال)</label><input id="fBalance" inputmode="numeric" placeholder="مثبت = بدهکار، منفی = طلبکار"><small id="fBalanceWords" class="muted"></small></div><div><label>مجموع فروش به مشتری (لیتر)</label><input id="fTotalSales" inputmode="numeric"></div><div><label>مجموع دریافت وجه از مشتری (ریال)</label><input id="fTotalReceived" inputmode="numeric"><small id="fTotalReceivedWords" class="muted"></small></div></div><div class="row3"><div><label>روز گذشته از آخرین دریافت</label><input id="fDays" disabled></div><div><label>مدت باقی‌مانده قرارداد</label><input id="fRemaining" disabled></div><div></div></div>
  <label>توضیحات کارشناس فروش</label><textarea id="fNote"></textarea><div class="actions"><button class="btn btn-gold" id="saveFinance" style="width:auto">ذخیره اطلاعات</button></div><div id="financeMsg" class="muted">در حال بارگذاری...</div><div id="financeTable" style="margin-top:16px"></div></div>`;
}

function detail(id) {
  const x = db.requests.find((r) => r.id === id);
  if (!x) return "یافت نشد";
  const st = stationById(x.stationId);
  const b = badgeOf(st);
  const amount = x.liters * PRICE_PER_LITER;
  const allowed = st.guaranteeToman / 2;
  const gap = Math.max(0, amount - (x.cashBeforeShip || 0) - allowed);
  const role = me().role;
  let actions = `<button class="btn btn-ghost" id="back">بازگشت</button>`;

  if (role === "sales" && x.status === "draft_sales") {
    actions += `<button class="btn btn-green" id="autoPf">صدور پیش‌فاکتور خودکار و ارسال به جایگاه</button>
      <button class="btn btn-blue" id="cutLiters">کاهش مقدار بنزین درخواستی</button>`;
  }
  if (role === "station" && (x.status === "proforma_sent" || x.status === "returned_station" || x.status === "finance_no")) {
    actions += `<button class="btn btn-green" id="stResub">ارسال مجدد با راننده و پلاک</button>`;
  }
  if (role === "sales" && x.status === "proforma_sent" && x.driver) {
    actions += `<button class="btn btn-green" id="toAcc">ارسال به مدیر مالی</button>
      <button class="btn btn-red" id="backSt">عودت به جایگاه با توضیح</button>`;
  }
  if (role === "accounting" && x.status === "pending_accounting") {
    actions += `<button class="btn btn-green" id="finOk">تاییدیه مالی</button>
      <button class="btn btn-red" id="finNo">عدم تایید مالی</button>`;
  }
  if (role === "sales" && x.status === "finance_ok") {
    actions += `<button class="btn btn-green" id="toSm">ارسال به مدیر فروش</button>`;
  }
  if (role === "sales" && x.status === "finance_no") {
    actions += `<button class="btn btn-blue" id="toStFin">ارسال به جایگاه‌دار با توضیحات مالی</button>`;
  }
  if (role === "salesManager" && x.status === "pending_sales_mgr") {
    actions += `<button class="btn btn-green" id="smOk">تایید و ارسال به بارگیری</button>`;
  }
  if (role === "loading" && x.status === "pending_loading") {
    actions += `<button class="btn btn-green" id="doLoad">ثبت بارگیری و پیوست فاکتور</button>`;
  }

  const pf = x.proforma
    ? `<div class="invoice" id="pf">
    <div class="invoice-logos">
      <img src="logo-lynx.jpg" alt="LYNX OIL" style="background:#000;padding:6px;border-radius:8px;height:56px" />
      <img src="logo-msp.jpg" alt="MSP" style="height:56px" />
    </div>
    <h2>پیش‌فاکتور LYNX OIL</h2>
    <p>شماره ${x.proforma.no} · ${x.proforma.date}</p>
    <p>خریدار: ${st.name}</p>
    <table><tr><td>بنزین سوپر وارداتی اکتان 95+</td><td>${liter(x.proforma.liters)}</td><td>${rial(x.proforma.unit)} / لیتر</td><td>${rial(x.proforma.total)}</td></tr></table>
    <p>این سند به‌صورت خودکار صادر شده است.</p>
  </div>`
    : `<p class="muted">پیش‌فاکتور هنوز صادر نشده.</p>`;

  return `<div class="card">
    <h3>${x.id} — ${st.name} <span class="badge ${b.cls}"><span class="dot ${b.dot}"></span>${b.label}</span></h3>
    <p class="status">${STATUS[x.status]}</p>
    <div class="row3" style="margin-top:12px">
      <div>مقدار درخواستی: <strong>${liter(x.liters)}</strong></div>
      <div>مبلغ: <strong>${rial(amount)}</strong></div>
      <div>مبلغ واریزی: <strong>${rial(x.cashBeforeShip || 0)}</strong></div>
      <div>آخرین تاریخ تسویه: ${x.lastSettlementDate || lastSettleOf(st)}</div>
    </div>
    <p class="${gap > 0 ? "warn" : "ok"}" style="margin:10px 0">${
      gap > 0
        ? "میزان ضمانت از مبلغ درخواستی کمتر است. کارشناس فروش می‌تواند مقدار را کم کند."
        : "میزان ضمانت با مقدار بنزین درخواستی مطابقت دارد."
    }</p>
    ${x.driver ? `<p>راننده: ${x.driver} · پلاک: ${x.plate} · ماشین: ${x.truck}</p>` : ""}
    ${x.loadTime ? `<p>ساعت بارگیری: ${x.loadTime} · مقدار: ${liter(x.loadLiters)} · فاکتور: ${x.loadInvoiceName || "—"}</p>` : ""}
    <label>یادداشت / علت عدم صحت</label>
    <textarea id="note">${x.salesNote || ""}</textarea>
    ${
      role === "station" && (x.status === "proforma_sent" || x.status === "returned_station" || x.status === "finance_no")
        ? `
      <div class="row3">
        <div><label>کاهش لیتر (اختیاری)</label><input id="newL" type="number" value="${x.liters}" /></div>
        <div><label>راننده</label><input id="drv" value="${x.driver || ""}" /></div>
        <div><label>پلاک</label><input id="plt" value="${x.plate || ""}" /></div>
      </div>
      <label>ماشین حمل</label><input id="trk" value="${x.truck || ""}" />
    `
        : ""
    }
    ${
      role === "loading" && x.status === "pending_loading"
        ? `
      <div class="row3">
        <div><label>تاریخ و ساعت بارگیری</label><input id="loadAt" type="datetime-local" /></div>
        <div><label>فایل بارنامه (اختیاری — PDF/JPG تا ۱ مگابایت)</label><input id="waybill" type="file" accept="application/pdf,image/jpeg" /></div>
        <div><label>فایل حواله (اختیاری — PDF/JPG تا ۱ مگابایت)</label><input id="voucher" type="file" accept="application/pdf,image/jpeg" /></div>
      </div>
      <div class="row3">
        <div><label>ارزیابی راننده</label><select id="driverRating"><option value="">انتخاب امتیاز</option><option value="1">۱ - بسیار ضعیف</option><option value="2">۲ - ضعیف</option><option value="3">۳ - متوسط</option><option value="4">۴ - خوب</option><option value="5">۵ - عالی</option></select></div>
        <div><label>ارزیابی تانکر</label><select id="tankerRating"><option value="">انتخاب امتیاز</option><option value="1">۱ - بسیار ضعیف</option><option value="2">۲ - ضعیف</option><option value="3">۳ - متوسط</option><option value="4">۴ - خوب</option><option value="5">۵ - عالی</option></select></div>
        <div><label>مقدار بارگیری (لیتر)</label><input id="ll" type="number" value="${x.liters}" min="0" /></div>
      </div>
    `
        : ""
    }
    <div class="actions">${actions}</div>
    <h4 style="margin:18px 0 8px">پیش‌فاکتور خودکار</h4>
    ${pf}
    <h4 style="margin:18px 0 8px">گردش کار</h4>
    <div class="timeline">${(x.logs || []).map((l) => `<div class="tl-item"><strong>${l.by}</strong> — ${l.msg}<br><small>${l.t}</small></div>`).join("")}</div>
  </div>`;
}

function log(x, msg) {
  x.logs = x.logs || [];
  x.logs.push({ t: now(), by: me().name, msg });
}

function bindApp() {
  document.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { page = b.dataset.p; selectedId = null; render(); }));
  document.getElementById("out").onclick = () => { db.session = null; db.apiToken = null; save(db); render(); };
  const changePassword = document.getElementById("changePassword");
  if (changePassword) changePassword.onclick = async () => {
    const current = prompt("رمز عبور فعلی:"); if (current === null) return;
    const next = prompt("رمز عبور جدید حداقل ۸ کاراکتر:"); if (next === null) return;
    const repeat = prompt("تکرار رمز عبور جدید:"); if (repeat === null) return;
    try { await apiCall("change_password", "POST", { current_password: current, new_password: next, repeat_password: repeat }); alert("رمز عبور با موفقیت تغییر کرد."); } catch (e) { alert(e.message); }
  };
  document.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => { selectedId = b.dataset.open; render(); }));
  document.querySelectorAll("[data-sv]").forEach((b) => (b.onclick = () => { selectedId = b.dataset.sv; render(); }));
  document.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { selectedId = b.dataset.st; render(); }));
  const back = document.getElementById("back");
  if (back) back.onclick = () => { selectedId = null; render(); };
  attachComma(document.getElementById("deposit"));
  attachComma(document.getElementById("svAmount"));

  const est = document.getElementById("est");
  const litersI = document.getElementById("liters");
  if (litersI) {
    const upd = () => {
      const L = +litersI.value || 0;
      est.textContent = "مبلغ سفارش " + rial(L * PRICE_PER_LITER);
    };
    litersI.oninput = upd;
    upd();
    document.getElementById("submitReq").onclick = () => {
      const st = stationById(me().stationId);
      const liters = +document.getElementById("liters").value;
      const deposit = parseMoney((document.getElementById("deposit") || {}).value);
      db.requests.push({
        id: uid(),
        stationId: st.id,
        createdAt: now(),
        liters,
        remainingOnSite: st.remainingLitersOnSite || 0,
        extraOrderLiters: 0,
        cashBeforeShip: deposit,
        lastSettlementDate: lastSettleOf(st),
        status: "draft_sales",
        logs: [{ t: now(), by: me().name, msg: "ثبت درخواست خرید — مبلغ واریزی " + rial(deposit) }],
      });
      save(db);
      alert("درخواست برای کارشناس فروش ارسال شد.");
      page = "mine";
      render();
    };
  }

  const submitSettle = document.getElementById("submitSettle");
  if (submitSettle) {
    submitSettle.onclick = () => {
      const st = stationById(me().stationId);
      const amount = parseMoney(document.getElementById("svAmount").value);
      const payDate = document.getElementById("svDate").value.trim();
      const salesLiters = +document.getElementById("svLiters").value || 0;
      if (!amount || !payDate) {
        alert("مبلغ واریزی و تاریخ واریز الزامی است");
        return;
      }
      const file = document.getElementById("svFile").files[0];
      const finish = (receiptName, receiptData) => {
        db.settlements = db.settlements || [];
        db.settlements.push({
          id: "S" + uid().slice(1),
          stationId: st.id,
          salesLiters,
          amount,
          payDate,
          receiptName: receiptName || "",
          receiptData: receiptData || "",
          status: "pending_sales",
          note: "",
          logs: [{ t: now(), by: me().name, msg: "ثبت فرم تسویه فروش و ارسال به کارشناس فروش" }],
        });
        save(db);
        alert("فرم تسویه برای کارشناس فروش ارسال شد.");
        render();
      };
      if (file) {
        const r = new FileReader();
        r.onload = () => finish(file.name, r.result);
        r.readAsDataURL(file);
      } else finish("", "");
    };
  }

  const saveSt = document.getElementById("saveSt");
  if (saveSt)
    saveSt.onclick = () => {
      const s = stationById(selectedId);
      s.contractStart = document.getElementById("cs").value;
      s.contractEnd = document.getElementById("ce").value;
      s.guaranteeToman = +document.getElementById("g").value;
      s.settledToman = +document.getElementById("set").value;
      s.creditScore = document.getElementById("sc").value;
      save(db);
      selectedId = null;
      render();
    };

  if (page === "finance") bindFinance();
  if (['settle','settleInbox','settleAcc','settleCom'].includes(page) && db.apiToken) bindSettlementPage();
  if (page === "new") bindNewReq();
  if (page === "inbox" && db.apiToken) bindSalesInbox();
  if (page === "hist" && db.apiToken && me().role === "station") bindHistory();
  if (page === "dash" && me().role === "sales") { bindSalesDashboard(); }
  if (page === "dash" && me().role === "accounting") bindAccountingDashboard();
  if ((page === "acc" || page === "load") && ["accounting","salesManager"].includes(me().role)) bindWorkflowInbox();
  if (page === "load" && me().role === "loading") bindWorkflowInbox();
  if (page === "dash" && me().role === "commerce") bindCommerce();
  if (page === "dash" && me().role === "station") bindStationDash();
  wireActions();
}

async function apiCall(action, method = "GET", data = null) {
  const headers = { "Content-Type": "application/json" };
  if (db.apiToken) headers.Authorization = "Bearer " + db.apiToken;
  const res = await fetch("api.php?action=" + action, { method, headers, body: data ? JSON.stringify(data) : undefined });
  const text = await res.text();
  let out; try { out = JSON.parse(text); } catch { throw new Error("پاسخ نامعتبر از سرور — HTTP " + res.status); }
  if (!out.ok) throw new Error(out.message || "خطای سرور");
  return out;
}

async function bindFinance() {
  const stationSelect=document.getElementById('fStation'),msg=document.getElementById('financeMsg'),table=document.getElementById('financeTable');let items=[];
  const raw=v=>String(v||'').replace(/,/g,'').replace(/[^0-9-]/g,'');
  const date=v=>normalizeJalali(v);
  const wireMoney=(id,hint)=>{const el=document.getElementById(id),out=document.getElementById(hint);el.addEventListener('input',()=>{el.value=formatRial(el.value);out.textContent=el.value?persianNumberWords(raw(el.value)):'';});};
  wireMoney('fCheckAmount','fCheckAmountWords'); wireMoney('fLimit','fLimitWords'); wireMoney('fBalance','fBalanceWords'); wireMoney('fTotalReceived','fTotalReceivedWords');
  const fill=()=>{stationSelect.innerHTML='<option value="">انتخاب جایگاه</option>'+items.map(s=>`<option value="${s.id}">${s.station_display_name||s.name}</option>`).join('');table.innerHTML='<table><thead><tr><th>جایگاه</th><th>شماره قرارداد</th><th>وضعیت اعتبار</th><th>روز دریافت</th><th>باقی قرارداد</th></tr></thead><tbody>'+items.map(s=>`<tr data-finance-id="${s.id}" style="cursor:pointer"><td>${s.station_display_name||s.name}</td><td>${s.contract_no||'—'}</td><td>${s.credit_status||'در حال بررسی'}</td><td>${daysSince(s.last_received_date)}</td><td>${remainingDays(s.contract_end)}</td></tr>`).join('')+'</tbody></table>';table.querySelectorAll('[data-finance-id]').forEach(row=>row.onclick=()=>{const s=items.find(x=>String(x.id)===row.dataset.financeId);if(s)edit(s)});};
  function daysSince(v){if(!v)return '—';const d=new Date(v+'T12:00:00');return Math.max(0,Math.floor((Date.now()-d.getTime())/86400000))+' روز'}
  function remainingDays(v){if(!v)return '—';const d=new Date(v+'T12:00:00');return Math.floor((d.getTime()-Date.now())/86400000)+' روز'}
  function edit(s){stationSelect.value=s.id;document.getElementById('fCity').value=s.city||'';document.getElementById('fContractNo').value=s.contract_no||'';document.getElementById('fOwner').value=s.owner_name||'';document.getElementById('fStart').value=gregorianToJalali(s.contract_start);document.getElementById('fEnd').value=gregorianToJalali(s.contract_end);document.getElementById('fType').value=s.contract_type||'credit';document.getElementById('fCheck').value=s.credit_check?'1':'0';document.getElementById('fCheckAmount').value=formatRial(s.credit_check_amount_rial);document.getElementById('fLimit').value=formatRial(s.credit_limit_rial);document.getElementById('fRemainingCredit').value=formatRial(s.remaining_credit_rial);document.getElementById('fAnnex').value=gregorianToJalali(s.annex_end_date);document.getElementById('fCommission').value=s.commission_percent||0;document.getElementById('fCredit').value=s.credit_status||'review';document.getElementById('fSettlement').value=gregorianToJalali(s.last_settlement_date);document.getElementById('fSale').value=gregorianToJalali(s.last_sale_date);document.getElementById('fReceived').value=gregorianToJalali(s.last_received_date);document.getElementById('fBalance').value=formatRial(s.balance_rial);document.getElementById('fTotalSales').value=Number(s.total_sales_liters||0).toLocaleString('en-US');document.getElementById('fTotalReceived').value=formatRial(s.total_received_rial);document.getElementById('fDays').value=daysSince(s.last_received_date);document.getElementById('fRemaining').value=remainingDays(s.contract_end);document.getElementById('fNote').value=s.sales_note||'';}
  try{items=(await apiCall('station_finance_list')).items;fill();stationSelect.onchange=()=>{const typedContract=document.getElementById('fContractNo').value;const s=items.find(x=>String(x.id)===stationSelect.value);if(s){edit(s);if(typedContract && !s.contract_no)document.getElementById('fContractNo').value=typedContract;}};document.getElementById('saveFinance').onclick=async()=>{try{const s=items.find(x=>String(x.id)===stationSelect.value);if(!s)throw Error('ابتدا یک جایگاه را انتخاب کنید.');if(!confirm('آیا از ثبت اطلاعات این جایگاه مطمئن هستید؟'))return;await apiCall('station_finance_update','POST',{station_id:s.id,contract_no:document.getElementById('fContractNo').value,owner_name:document.getElementById('fOwner').value,contract_start:date(document.getElementById('fStart').value),contract_end:date(document.getElementById('fEnd').value),annex_end_date:date(document.getElementById('fAnnex').value),contract_type:document.getElementById('fType').value,credit_check:document.getElementById('fCheck').value,credit_check_amount_rial:raw(document.getElementById('fCheckAmount').value),credit_limit_rial:raw(document.getElementById('fLimit').value),commission_percent:document.getElementById('fCommission').value,credit_status:document.getElementById('fCredit').value,last_settlement_date:date(document.getElementById('fSettlement').value),last_sale_date:date(document.getElementById('fSale').value),last_received_date:date(document.getElementById('fReceived').value),balance_rial:raw(document.getElementById('fBalance').value),total_sales_liters:raw(document.getElementById('fTotalSales').value),total_received_rial:raw(document.getElementById('fTotalReceived').value),sales_note:document.getElementById('fNote').value,financial_status:'review'});msg.textContent='اطلاعات با موفقیت ذخیره شد.';msg.className='ok';items=(await apiCall('station_finance_list')).items;fill();edit(items.find(x=>+x.id===+s.id))}catch(e){msg.textContent=e.message;msg.className='err'}}}catch(e){msg.textContent=e.message;msg.className='err'}
}

async function bindHistory() {
  const box=document.getElementById('historyBox'); try { const d=await apiCall('station_history'); if(!d.orders.length){box.innerHTML='<p class="muted">سابقه‌ای وجود ندارد.</p>';return;} box.innerHTML='<table><thead><tr><th>کد</th><th>تاریخ</th><th>لیتر</th><th>مبلغ</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>'+d.orders.map(o=>`<tr><td>${o.order_code}</td><td>${gregorianToJalaliDateTime(o.created_at)}</td><td>${Number(o.liters).toLocaleString('en-US')}</td><td>${Number(o.total_rial).toLocaleString('en-US')} ریال</td><td>${STATUS[o.status]||o.status}</td><td><button class="btn btn-ghost" data-history-id="${o.id}">مشاهده روند</button><button class="btn btn-ghost" data-history-print="${o.id}">PDF/چاپ</button></td></tr>`).join('')+'</tbody></table>';box.querySelectorAll('[data-history-id]').forEach(b=>b.onclick=()=>openLoadingOrder(b.dataset.historyId));box.querySelectorAll('[data-history-print]').forEach(b=>b.onclick=()=>{openLoadingOrder(b.dataset.historyPrint).then(()=>setTimeout(()=>window.print(),400));}); } catch(e){box.textContent=e.message;box.className='err';}
}

function getReq() {
  return db.requests.find((r) => r.id === selectedId);
}

function wireActions() {
  const x = selectedId && getReq();
  const note = () => (document.getElementById("note") || {}).value || "";

  const autoPf = document.getElementById("autoPf");
  if (autoPf)
    autoPf.onclick = () => {
      x.salesNote = note();
      x.proforma = { liters: x.liters, unit: PRICE_PER_LITER, total: x.liters * PRICE_PER_LITER, no: "PF-" + x.id, date: now() };
      x.status = "proforma_sent";
      log(x, "پیش‌فاکتور به‌صورت خودکار صادر و برای جایگاه‌دار ارسال شد");
      save(db);
      render();
    };
  const cut = document.getElementById("cutLiters");
  if (cut)
    cut.onclick = () => {
      const n = prompt("مقدار لیتر جدید:", x.liters);
      if (!n) return;
      x.liters = +n;
      log(x, "مقدار بنزین درخواستی به " + n + " لیتر کاهش یافت");
      save(db);
      render();
    };
  const stResub = document.getElementById("stResub");
  if (stResub)
    stResub.onclick = () => {
      x.liters = +document.getElementById("newL").value;
      x.driver = document.getElementById("drv").value;
      x.plate = document.getElementById("plt").value;
      x.truck = document.getElementById("trk").value;
      if (!x.driver || !x.plate) {
        alert("راننده و پلاک الزامی است");
        return;
      }
      x.status = "proforma_sent";
      log(x, "جایگاه‌دار اطلاعات راننده و پلاک را ثبت کرد");
      save(db);
      alert("برای کارشناس فروش ارسال شد");
      render();
    };
  const toAcc = document.getElementById("toAcc");
  if (toAcc)
    toAcc.onclick = () => {
      x.status = "pending_accounting";
      log(x, "به مدیر مالی ارسال شد");
      save(db);
      selectedId = null;
      render();
    };
  const backSt = document.getElementById("backSt");
  if (backSt)
    backSt.onclick = () => {
      x.salesNote = note();
      if (!x.salesNote) {
        alert("علت عدم صحت را بنویسید");
        return;
      }
      x.status = "returned_station";
      log(x, "عودت به جایگاه: " + x.salesNote);
      save(db);
      render();
    };
  const finOk = document.getElementById("finOk");
  if (finOk)
    finOk.onclick = () => {
      x.financeOk = true;
      x.financeNote = note();
      x.status = "finance_ok";
      log(x, "تاییدیه مالی صادر شد");
      save(db);
      selectedId = null;
      render();
    };
  const finNo = document.getElementById("finNo");
  if (finNo)
    finNo.onclick = () => {
      x.financeOk = false;
      x.financeNote = note();
      x.status = "finance_no";
      log(x, "عدم تایید مالی");
      save(db);
      selectedId = null;
      render();
    };
  const toSm = document.getElementById("toSm");
  if (toSm)
    toSm.onclick = () => {
      x.status = "pending_sales_mgr";
      log(x, "به مدیر فروش ارسال شد");
      save(db);
      selectedId = null;
      render();
    };
  const toStFin = document.getElementById("toStFin");
  if (toStFin)
    toStFin.onclick = () => {
      x.status = "returned_station";
      log(x, "عدم تایید مالی به جایگاه اعلام شد");
      save(db);
      render();
    };
  const smOk = document.getElementById("smOk");
  if (smOk)
    smOk.onclick = () => {
      x.status = "pending_loading";
      log(x, "مدیر فروش تایید کرد — ارسال به بارگیری");
      save(db);
      selectedId = null;
      render();
    };
  const doLoad = document.getElementById("doLoad");
  if (doLoad)
    doLoad.onclick = async () => {
      const at = document.getElementById("loadAt").value;
      const wb = document.getElementById("waybill").files[0];
      const vo = document.getElementById("voucher").files[0];
      const dr = document.getElementById("driverRating").value;
      const tr = document.getElementById("tankerRating").value;
      if (!at || !dr || !tr) { alert("تاریخ و ساعت بارگیری و هر دو ارزیابی الزامی است"); return; }
      if (wb.size > 1024 * 1024 || vo.size > 1024 * 1024) { alert("حجم هر فایل نباید بیشتر از ۱ مگابایت باشد"); return; }
      if (db.apiToken && /^\\d+$/.test(String(x.id))) {
        const fd = new FormData(); fd.append("order_id", x.id); fd.append("loaded_at", at); fd.append("driver_rating", dr); fd.append("tanker_rating", tr); fd.append("loading_note", (document.getElementById("note") || {}).value || ""); fd.append("waybill", wb); fd.append("voucher", vo);
        try { const res = await fetch("api.php?action=loading_save", { method: "POST", headers: { Authorization: "Bearer " + db.apiToken }, body: fd }); const out = await res.json(); if (!out.ok) throw new Error(out.message || "خطا"); alert("اطلاعات بارگیری با موفقیت ثبت شد."); x.status="loaded"; save(db); render(); } catch(e) { alert(e.message); }
      } else {
        x.loadTime = at; x.loadLiters = +document.getElementById("ll").value; x.waybillName = wb.name; x.voucherName = vo.name; x.driverRating = dr; x.tankerRating = tr; x.status = "loaded"; log(x, "بارنامه، حواله و ارزیابی بارگیری ثبت شد"); save(db); alert("اطلاعات بارگیری در نسخه فعلی ثبت شد؛ برای ذخیره دیتابیسی، سفارش باید از دیتابیس خوانده شود."); render();
      }
    };

  const sv = selectedId && (db.settlements || []).find((z) => z.id === selectedId);
  const svNote = () => (document.getElementById("svNote") || {}).value || "";
  const svToFin = document.getElementById("svToFin");
  if (svToFin)
    svToFin.onclick = () => {
      sv.note = svNote();
      sv.status = "pending_finance";
      sv.logs.push({ t: now(), by: me().name, msg: "بررسی شد و برای مدیر مالی ارسال گردید" });
      save(db);
      selectedId = null;
      render();
    };
  const svReject = document.getElementById("svReject");
  if (svReject)
    svReject.onclick = () => {
      sv.note = svNote();
      sv.status = "rejected";
      sv.logs.push({ t: now(), by: me().name, msg: "رد شد: " + sv.note });
      save(db);
      render();
    };
  const svApprove = document.getElementById("svApprove");
  if (svApprove)
    svApprove.onclick = () => {
      sv.note = svNote();
      sv.status = "approved";
      const stn = stationById(sv.stationId);
      stn.lastSettlementDate = sv.payDate;
      stn.settledToman = (stn.settledToman || 0) + sv.amount;
      sv.logs.push({ t: now(), by: me().name, msg: "تایید مالی — ارسال به جایگاه‌دار، مدیر بازرگانی و کارشناس فروش" });
      save(db);
      selectedId = null;
      alert("تایید شد و برای جایگاه، بازرگانی و فروش ارسال گردید.");
      render();
    };
  const svFinNo = document.getElementById("svFinNo");
  if (svFinNo)
    svFinNo.onclick = () => {
      sv.note = svNote();
      sv.status = "rejected";
      sv.logs.push({ t: now(), by: me().name, msg: "عدم تایید مالی: " + sv.note });
      save(db);
      render();
    };
}

render();
