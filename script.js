/* =========================================================
   TASKFORGE
   Front-end prototype

   IMPORTANT:
   This is a browser/localStorage prototype.
   Authentication, payments, balances and approvals must be
   moved to a secure backend before production deployment.
========================================================= */

const STORAGE_KEY = "taskforge_v2";
const SESSION_KEY = "taskforge_session";

const BID_WINDOW_MS = 6 * 60 * 60 * 1000;

/* === NEW: per-level daily bid limits === */
const DAILY_BID_LIMITS = {
  1: 1,
  2: 5,
  3: 10
};

function dailyLimitForLevel(level){
  return DAILY_BID_LIMITS[Number(level)] || 1;
}

const ADMIN_CONTACT_EMAIL = "deportmo@gmail.com";
const REFERRAL_COMMISSION_RATE = 0.30;

const DEMO_ADMIN = {
  email: "signin@gmail.com",
  password: "Gm08202118269"
};

/* Default settings — editable by admin via Payment Settings page */
const DEFAULT_SETTINGS = {
  paymentMethod: {
    provider: "KCB",
    paybill: "522522",
    accountLabel: "YOUR ACCOUNT NUMBER"
  },
  levelFees: {
    1: 500,
    2: 1000,
    3: 2000
  },
  trainingFees: {
    basic: 500,
    special: 2000
  },

  /* === NEW: 5 editable bid packages === */
  bidPackages: [
    { id:"pkg_1", name:"Starter",  bids:5,   price:100  },
    { id:"pkg_2", name:"Basic",    bids:15,  price:250  },
    { id:"pkg_3", name:"Standard", bids:30,  price:450  },
    { id:"pkg_4", name:"Pro",      bids:60,  price:800  },
    { id:"pkg_5", name:"Elite",    bids:150, price:1800 }
  ]
};

const LEVEL_WINDOWS = {
  1: "7 days",
  2: "3 days",
  3: "24 hours"
};

const BASIC_TRAINING_NOTE = `TRAINING WILL BE Today.
TRAINING DESCRIPTION: Training will be online via google meet for a period of one hour, from 8pm to 9pm.....
Equip yourself with the following:
1.Phone or a laptop
2.Good internet connection
3.A note book and a pen

Apply for training by paying KSH 500. Once verified You will receive training link via your email!`;

const SPECIAL_TRAINING_NOTE = `HOW DOES SPECIAL TRAINING WORK?
The objective of special training is to enhance your writing abilities through dedicated instruction and practical examples.
The training duration spans one week. You will be linked with one of our best writers during which he/she will conduct three Google Meet classes with you
To optimize your learning experience, he/she will be sharing some of their previously accepted assignments with you.
These examples will serve as valuable references for you to study and gain insights into effective writing techniques.

WHAT ARE THE ADVANTAGES OF SPECIAL TRAINING?
The advantages of special training includes;
✓ You will receive training from one of our top-earning writers, ensuring high-quality instruction.
✓ Once trained, you will submit your assignments to your trainer for verification before submitting them on our portal.
✓ Personal training means you have direct communication with your trainer, facilitating a more effective learning experience.
✓ With training from someone who understands our assignment requirements and guidelines, you are guaranteed to earn income confidently, knowing what to do and what not to do in our assignments

NOTE; The training fee is KSH. 2000
Thank you for expressing interest in the special training program. We appreciate your enthusiasm for improving your writing skills.....`;

let activePage = "dashboard";
let countdownTimer = null;


/* =========================================================
   BASIC HELPERS
========================================================= */

function uid(prefix = "id"){
  return (
    prefix +
    "_" +
    Math.random().toString(36).slice(2, 9) +
    Date.now().toString(36).slice(-5)
  );
}


function money(value){
  return "KSh " + Number(value || 0).toLocaleString("en-KE");
}


function dateTime(value){
  if(!value) return "—";

  return new Date(value).toLocaleString("en-KE", {
    dateStyle:"medium",
    timeStyle:"short"
  });
}


function dateOnly(value){
  if(!value) return "";

  return new Date(value).toLocaleDateString("en-CA");
}


function initials(name){
  return String(name || "User")
    .trim()
    .split(/\s+/)
    .slice(0,2)
    .map(x => x[0])
    .join("")
    .toUpperCase();
}


function escapeHTML(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

/* === NEW: M-Pesa code validation (strict Kenyan format) === */
function isValidMpesaCode(value){
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z][A-Z0-9]{9}$/.test(code);
}

function normalizeMpesaCode(value){
  return String(value || "").trim().toUpperCase();
}


function levelName(level){
  return "Level " + Number(level || 1);
}


function levelWindow(level){
  return LEVEL_WINDOWS[level] || "—";
}


function hoursLeft(deadline){
  const ms = new Date(deadline).getTime() - Date.now();

  if(ms <= 0) return "Expired";

  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);

  return `${hours}h ${String(mins).padStart(2,"0")}m`;
}


function countdownText(deadline){
  const ms = new Date(deadline).getTime() - Date.now();

  if(ms <= 0){
    return "00:00:00";
  }

  const totalSeconds = Math.floor(ms / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    String(hours).padStart(2,"0") +
    ":" +
    String(minutes).padStart(2,"0") +
    ":" +
    String(seconds).padStart(2,"0")
  );
}


/* =========================================================
   EMAIL + PHONE VALIDATION
========================================================= */

function normalizeEmail(value){
  return String(value || "").trim().toLowerCase();
}


function isValidEmail(value){
  const email = normalizeEmail(value);

  // Simple, reliable format check
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email);
}


function normalizePhone(value){

  let raw = String(value || "")
    .trim()
    .replace(/[\s\-()]/g,"");

  // Convert 07XXXXXXXX / 01XXXXXXXX / 254XXXXXXXXX to +254XXXXXXXXX
  if(raw.startsWith("+254")){
    raw = raw.slice(1);
  }

  if(raw.startsWith("254")){
    raw = raw.slice(3);
  }

  if(raw.startsWith("0")){
    raw = raw.slice(1);
  }

  return "+254" + raw;
}


function isValidPhone(value){
  const phone = normalizePhone(value);

  // +254 followed by 9 digits, first digit 1 or 7
  return /^\+254[17]\d{8}$/.test(phone);
}


/* =========================================================
   DATABASE
========================================================= */

function seedDB(){

  const now = Date.now();

  const adminId = "usr_admin";
  const demoId = "usr_demo";
  const janeId = "usr_jane";

  return {

    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),

    users:[
      {
        id:adminId,
        name:"TaskForge Administrator",
        email:DEMO_ADMIN.email,
        phone:"+254746953334",
        password:DEMO_ADMIN.password,
        role:"admin",
        level:3,
        regPaid:true,
        balance:0,
        createdAt:now
      },

      {
        id:demoId,
        name:"Demo Contributor",
        email:"demo@taskforge.local",
        phone:"+254711111111",
        password:"demo123",
        role:"user",
        level:1,
        regPaid:true,
        registrationConfirmed:true,
        balance:1800,
        bidBalance:20,
        training:"none",
        createdAt:now - 86400000 * 10
      },

      {
        id:janeId,
        name:"Jane Sample",
        email:"jane@taskforge.local",
        phone:"+254722222222",
        password:"jane123",
        role:"user",
        level:2,
        regPaid:false,
        registrationConfirmed:false,
        balance:0,
        bidBalance:0,
        training:"none",
        createdAt:now - 86400000 * 3
      }
    ],

    tasks:[
      {
        id:"task_1",
        title:"Product Description Review",
        description:"Review and improve product descriptions for clarity, grammar and consistency.",
        payment:1200,
        bidCost:2,
        level:1,
        status:"active",
        createdAt:now - 86400000 * 2
      },

      {
        id:"task_2",
        title:"Data Entry Verification",
        description:"Verify a structured list of business records and flag incomplete or duplicate entries.",
        payment:1800,
        bidCost:2,
        level:2,
        status:"active",
        createdAt:now - 86400000
      },

      {
        id:"task_3",
        title:"Research & Summary Task",
        description:"Research supplied material and prepare a concise professional summary following the task instructions.",
        payment:2500,
        bidCost:2,
        level:3,
        status:"active",
        createdAt:now - 3600000
      },

      {
        id:"task_4",
        title:"Spreadsheet Cleanup",
        description:"Clean formatting, standardize values and identify obvious inconsistencies in a spreadsheet.",
        payment:1500,
        bidCost:2,
        level:1,
        status:"active",
        createdAt:now - 7200000
      }
    ],

    bids:[
      {
        id:"bid_demo",
        taskId:"task_1",
        userId:demoId,
        status:"submitted",
        bidAt:now - 3600000,
        deadlineAt:now + 18000000,
        submittedAt:now - 900000
      }
    ],

    submissions:[
      {
        id:"sub_demo",
        taskId:"task_1",
        bidId:"bid_demo",
        userId:demoId,
        answer:"Completed the requested review and submitted the corrected content.",
        fileName:"product-review.txt",
        fileSize:4200,
        status:"pending",
        createdAt:now - 900000
      }
    ],

    transactions:[
      {
        id:"tx_seed",
        userId:demoId,
        type:"earning",
        amount:1800,
        status:"credited",
        description:"Approved task payment",
        createdAt:now - 86400000
      }
    ],

    withdrawals:[],

    referrals:[],

    training:[],  // training requests pending admin approval

    /* Registration / Training / Upgrade payment requests
       awaiting admin approve or reject */
    paymentRequests:[],

    notifications:[
      {
        id:uid("notif"),
        userId:demoId,
        title:"Welcome to TaskForge",
        message:"Your account is ready. Visit the marketplace to browse available tasks.",
        read:false,
        createdAt:now
      }
    ]

  };
}


function ensureDBShape(data){

  if(!data || typeof data !== "object"){
    data = seedDB();
  }

  data.users = Array.isArray(data.users) ? data.users : [];
  data.tasks = Array.isArray(data.tasks) ? data.tasks : [];
  data.bids = Array.isArray(data.bids) ? data.bids : [];
  data.submissions = Array.isArray(data.submissions) ? data.submissions : [];
  data.transactions = Array.isArray(data.transactions) ? data.transactions : [];
  data.withdrawals = Array.isArray(data.withdrawals) ? data.withdrawals : [];
  data.referrals = Array.isArray(data.referrals) ? data.referrals : [];
  data.training = Array.isArray(data.training) ? data.training : [];
  data.paymentRequests = Array.isArray(data.paymentRequests) ? data.paymentRequests : [];
  data.notifications = Array.isArray(data.notifications) ? data.notifications : [];
  data.users.forEach(u => {
    if(typeof u.bidBalance !== "number") u.bidBalance = 0;
    if(typeof u.registrationConfirmed !== "boolean"){
      u.registrationConfirmed = !!u.regPaid;
    }
    /* === NEW: payout fields === */
    if(typeof u.payoutName !== "string") u.payoutName = "";
    if(typeof u.payoutPhone !== "string") u.payoutPhone = "";
   });

  if(!data.settings || typeof data.settings !== "object"){
    data.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  if(!data.settings.paymentMethod){
    data.settings.paymentMethod = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.paymentMethod));
  }

  if(!data.settings.levelFees){
    data.settings.levelFees = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.levelFees));
  }

  if(!data.settings.trainingFees){
    data.settings.trainingFees = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.trainingFees));
  }

  /* === NEW: backfill bidPackages === */
  if(!Array.isArray(data.settings.bidPackages) || !data.settings.bidPackages.length){
    data.settings.bidPackages = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.bidPackages));
  }

  /* === NEW: backfill user bid fields + task bidCost === */
  data.users.forEach(u => {
    if(typeof u.bidBalance !== "number") u.bidBalance = 0;
    if(typeof u.registrationConfirmed !== "boolean"){
      u.registrationConfirmed = !!u.regPaid;
    }
  });

  data.tasks.forEach(t => {
    if(typeof t.bidCost !== "number") t.bidCost = 2;
    if(!Array.isArray(t.maskedFor)) t.maskedFor = [];
  });

  return data;
}

// === FIREBASE: sync cache + async loader ===
let _dbCache = null;
let _dbLoading = false;

async function loadDB(){
  if (_dbCache) return _dbCache;
  if (_dbLoading) {
    while (_dbLoading) await new Promise(r => setTimeout(r, 50));
    return _dbCache;
  }

  _dbLoading = true;

  let waited = 0;
  while (!window._firebaseReady && waited < 5000) {
    await new Promise(r => setTimeout(r, 50));
    waited += 50;
  }

  if (!window._firebaseReady) {
    console.warn("Firebase not loaded — using localStorage.");
    const stored = localStorage.getItem(STORAGE_KEY);
    _dbCache = stored ? ensureDBShape(JSON.parse(stored)) : seedDB();
    _dbLoading = false;
    return _dbCache;
  }

  const { doc, getDoc, setDoc, firestore } = window._firebase;
  const docRef = doc(firestore, "taskforge", "main");

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      _dbCache = ensureDBShape(snap.data());
    } else {
      const seeded = seedDB();
      _dbCache = seeded;
      await setDoc(docRef, seeded);
    }
  } catch (err) {
    console.error("Firestore read error:", err);
    const stored = localStorage.getItem(STORAGE_KEY);
    _dbCache = stored ? ensureDBShape(JSON.parse(stored)) : seedDB();
  }

  _dbLoading = false;
  return _dbCache;
}

// Synchronous accessor — returns cached data (must call loadDB() first)
function db(){
  if (!_dbCache) {
    // Cache not ready yet. Return empty shape to avoid crashes.
    return ensureDBShape({});
  }
  return _dbCache;
}

// Async save
async function saveDB(data){
  const shaped = ensureDBShape(data);
  _dbCache = shaped;

  if (!window._firebaseReady) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shaped));
    return;
  }

  try {
    const { doc, setDoc, firestore } = window._firebase;
    const docRef = doc(firestore, "taskforge", "main");
    await setDoc(docRef, shaped);
  } catch (err) {
    console.error("Firestore write error:", err);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shaped));
  }
}


/* Shortcut helpers for settings */
function paymentMethod(){
  return db().settings.paymentMethod;
}

function levelFee(level){
  return Number(db().settings.levelFees?.[level] || 0);
}

function trainingFee(type){
  return Number(db().settings.trainingFees?.[type] || 0);
}

/* === NEW === */
function bidPackages(){
  return db().settings.bidPackages || [];
}

function bidPackageById(id){
  return bidPackages().find(p => p.id === id) || null;
}

function userDailyLimit(user){
  return dailyLimitForLevel(user?.level || 1);
}


/* =========================================================
   SESSION
========================================================= */

function currentUser(){

  const sessionId = sessionStorage.getItem(SESSION_KEY);

  if(!sessionId){
    return null;
  }

  return db().users.find(
    user => user.id === sessionId
  ) || null;
}


function setSession(userId){
  sessionStorage.setItem(
    SESSION_KEY,
    userId
  );
}


function clearSession(){
  sessionStorage.removeItem(SESSION_KEY);
}


function findUser(userId){
  return db().users.find(
    user => user.id === userId
  );
}


function taskById(taskId){
  return db().tasks.find(
    task => task.id === taskId
  );
}


function findBid(taskId,userId){

  const matches = db().bids.filter(
    bid =>
      bid.taskId === taskId &&
      bid.userId === userId
  );

  if(!matches.length) return null;

  /* Return the most recent bid */
  return matches.sort(
    (a,b) => Number(b.bidAt) - Number(a.bidAt)
  )[0];
}

/* === NEW: bids on this task placed since it was last edited === */
function taskBidsSinceEdit(task){
  const since = Number(task?.updatedAt || 0);
  return db().bids.filter(b =>
    b.taskId === task.id && Number(b.bidAt) >= since
  );
}


function findBidById(bidId){

  return db().bids.find(
    bid => bid.id === bidId
  ) || null;
}


function currentUserSubmissions(){

  const user = currentUser();

  if(!user){
    return [];
  }

  return db().submissions.filter(
    submission => submission.userId === user.id
  );
}


/* =========================================================
   TASK ACCESS
========================================================= */

/*
  IMPORTANT:
  Levels no longer restrict marketplace visibility.

  Every contributor can see every ACTIVE task.

  Level still exists for registration/payment information.
*/

function accessibleTasks(user){
  const data = db();

  return data.tasks.filter(task => {

    if(task.status !== "active") return false;

    /* === AUTO-MASK: hide tasks this user has already completed === */
    if(
      user &&
      Array.isArray(task.maskedFor) &&
      task.maskedFor.includes(user.id)
    ){
      return false;
    }

    return true;
  });
}


/* =========================================================
   DAILY BIDDING
========================================================= */

function startOfToday(){

  const d = new Date();

  d.setHours(0,0,0,0);

  return d.getTime();
}


function startOfTomorrow(){

  const d = new Date();

  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 1);

  return d.getTime();
}


function userBidsToday(userId){

  const start = startOfToday();
  const end = startOfTomorrow();

  return db().bids.filter(
    bid =>
      bid.userId === userId &&
      Number(bid.bidAt) >= start &&
      Number(bid.bidAt) < end
  );
}


function dailyBidCount(userId){

  return userBidsToday(userId).length;
}


function dailyBidRemaining(userId){
  const u = findUser(userId);
  return Math.max(
    0,
    userDailyLimit(u) - dailyBidCount(userId)
  );
}

/* =========================================================
   EXPIRATION
========================================================= */

function expireBids(){

  const data = db();

  let changed = false;
  const now = Date.now();

  data.bids.forEach(bid => {

    if(
      bid.status === "bidded" &&
      Number(bid.deadlineAt) <= now
    ){
      bid.status = "expired";
      changed = true;

      /* === NEW: refund bids on expiry === */
      const refundUser = data.users.find(u => u.id === bid.userId);
      if(refundUser && Number(bid.bidCostDeducted || 0) > 0){
        refundUser.bidBalance =
          Number(refundUser.bidBalance || 0) + Number(bid.bidCostDeducted);
        data.transactions.push({
          id:uid("tx"),
          userId:bid.userId,
          type:"bid-refund",
          amount:0,
          status:"credited",
          description:`Bid refunded (expired task) — ${bid.bidCostDeducted} bid(s) returned`,
          createdAt:now
        });
      }

      const task = taskById(bid.taskId);

      data.notifications.push({
        id:uid("notif"),
        userId:bid.userId,
        title:"Task expired",
        message:`Your six-hour window for "${task?.title || "the task"}" has expired.`,
        read:false,
        createdAt:now
      });
    }

  });

  if(changed){
    saveDB(data);
  }

  return changed;
}


/* =========================================================
   TASK STATE
========================================================= */

function userTaskState(taskId,userId){

  const bid = findBid(taskId,userId);

  if(!bid){
    return { status:"available", bid:null };
  }

  /* Rejected bids make task available again */
  if(bid.status === "rejected" || bid.status === "available-again"){
    return { status:"available", bid:null };
  }

  /* === NEW: if task was edited after the user's last bid, treat as fresh === */
  const task = db().tasks.find(t => t.id === taskId);
  if(
    task &&
    Number(task.updatedAt || 0) > Number(bid.bidAt || 0) &&
    ["submitted","approved","expired"].includes(bid.status)
  ){
    return { status:"available", bid:null };
  }

  if(
    bid.status === "bidded" &&
    Number(bid.deadlineAt) <= Date.now()
  ){
    const data = db();
    const actualBid = data.bids.find(item => item.id === bid.id);
    if(actualBid){
      actualBid.status = "expired";
      saveDB(data);
    }
    bid.status = "expired";
  }

  return { status:bid.status, bid };
}


/* =========================================================
   STATUS BADGES
========================================================= */

function statusBadge(status){

  const map = {

    available:["blue","AVAILABLE"],
    active:["green","ACTIVE"],

    bidded:["orange","BIDDED"],

    submitted:["orange","SUBMITTED"],

    approved:["green","APPROVED"],
    completed:["green","COMPLETED"],
    credited:["green","CREDITED"],

    pending:["orange","PENDING"],
    processing:["orange","PROCESSING"],

    rejected:["red","REJECTED"],
    expired:["red","EXPIRED"],
    inactive:["gray","INACTIVE"],

    paid:["green","PAID"]
  };

  const item = map[status] || ["gray",String(status || "UNKNOWN").toUpperCase()];

  return `
    <span class="badge ${item[0]}">
      ${escapeHTML(item[1])}
    </span>
  `;
}


/* =========================================================
   TOAST
========================================================= */

function toast(message,type="success"){

  const root = document.getElementById("toastRoot");

  if(!root) return;

  const el = document.createElement("div");

  el.className =
    "toast " +
    (type === "error"
      ? "error"
      : type === "info"
        ? "info"
        : "");

  el.innerHTML = `
    <span>
      ${type === "error" ? "!" : type === "info" ? "i" : "✓"}
    </span>
    <div>${escapeHTML(message)}</div>
  `;

  root.appendChild(el);

  setTimeout(() => {
    el.remove();
  },3500);
}


/* =========================================================
   AUTH UI
========================================================= */

function showAuth(mode="login"){

  document.getElementById("authView")?.classList.remove("hidden");
  document.getElementById("appView")?.classList.add("hidden");

  document
    .querySelectorAll(".auth-tab")
    .forEach(tab => {

      tab.classList.toggle(
        "active",
        tab.dataset.auth === mode
      );

    });

  document
    .getElementById("loginForm")
    ?.classList.toggle(
      "hidden",
      mode !== "login"
    );

  document
    .getElementById("registerForm")
    ?.classList.toggle(
      "hidden",
      mode !== "register"
    );
}


function showApp(){

  const user = currentUser();

  if(!user){
    showAuth();
    return;
  }

  document
    .getElementById("authView")
    ?.classList.add("hidden");

  document
    .getElementById("appView")
    ?.classList.remove("hidden");

  updateChrome(user);

  activePage =
    user.role === "admin"
      ? "admin-dashboard"
      : "dashboard";

  renderPage(activePage);
}


/* =========================================================
   CHROME
========================================================= */

const PAGE_LABELS = {

  dashboard:"Dashboard",
  tasks:"Available Tasks",
  "my-tasks":"My Tasks",
  submissions:"My Submissions",
  earnings:"Earnings & Withdrawals",
  training:"Apply for Training",
  upgrade:"Upgrade Level",
  referrals:"Referrals",
  transactions:"Transactions",
  profile:"Profile",
  contact:"Contact Admin",
  "buy-bids":"Buy Bids",

  "admin-dashboard":"Admin Dashboard",
  "admin-tasks":"Manage Tasks",
  "admin-users":"Users",
  "admin-submissions":"Submissions",
  "admin-payments":"Payments",
  "admin-payment-settings":"Payment Settings",
  "admin-referrals":"Referrals",
  "admin-transactions":"Transactions",
  "admin-training":"Training",
  "admin-bid-packages":"Bid Packages",
  "admin-bid-balances":"Bid Balances"
};


function updateChrome(user){

  const sideAvatar = document.getElementById("sideAvatar");
  const sideName = document.getElementById("sideName");
  const sideRole = document.getElementById("sideRole");

  const topAvatar = document.getElementById("topAvatar");
  const topName = document.getElementById("topName");
  const topLevel = document.getElementById("topLevel");

  if(sideAvatar) sideAvatar.textContent = initials(user.name);
  if(sideName) sideName.textContent = user.name;
  if(sideRole){
    sideRole.textContent =
      user.role === "admin"
        ? "Administrator"
        : "Contributor";
  }

  if(topAvatar) topAvatar.textContent = initials(user.name);
  if(topName) topName.textContent = user.name;

  if(topLevel){
    topLevel.textContent =
      user.role === "admin"
        ? "Administrator"
        : levelName(user.level);
  }

  document
    .getElementById("userNav")
    ?.classList.toggle(
      "hidden",
      user.role === "admin"
    );

  document
    .getElementById("adminNav")
    ?.classList.toggle(
      "hidden",
      user.role !== "admin"
    );

  updateNotificationDot(user);
}


function updateNotificationDot(user){

  const dot = document.getElementById("notificationDot");

  if(!dot) return;

  const unread = db().notifications.some(
    notification =>
      notification.userId === user.id &&
      !notification.read
  );

  dot.style.display = unread
    ? "block"
    : "none";
}


/* =========================================================
   PAGE RENDERER
========================================================= */

function renderPage(page){

  const user = currentUser();

  if(!user){
    showAuth();
    return;
  }

  activePage = page;

  const content =
    document.getElementById("pageContent");

  const crumb =
    document.getElementById("pageCrumb");

  if(!content) return;

  if(crumb){
    crumb.textContent =
      PAGE_LABELS[page] || "TaskForge";
  }

  document
    .querySelectorAll(".nav-item[data-page]")
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.page === page
      );

    });

  switch(page){

    case "dashboard":
      renderDashboard();
      break;

    case "tasks":
      renderTasks();
      break;

    case "my-tasks":
      renderMyTasks();
      break;

    case "submissions":
      renderSubmissions();
      break;

    case "earnings":
      renderEarnings();
      break;

    case "training":
      renderTraining();
      break;

    case "upgrade":
      renderUpgrade();
      break;

    case "referrals":
      renderReferrals();
      break;

    case "transactions":
      renderTransactions();
      break;

    case "profile":
      renderProfile();
      break;

    case "contact":
      renderContact();
      break;

    case "buy-bids":
      renderBuyBids();
      break;

    case "admin-dashboard":
      renderAdminDashboard();
      break;

    case "admin-tasks":
      renderAdminTasks();
      break;

    case "admin-users":
      renderAdminUsers();
      break;

    case "admin-submissions":
      renderAdminSubmissions();
      break;

    case "admin-payments":
      renderAdminPayments();
      break;

    case "admin-payment-settings":
      renderAdminPaymentSettings();
      break;

    case "admin-referrals":
      renderAdminReferrals();
      break;

    case "admin-transactions":
      renderAdminTransactions();
      break;

    case "admin-training":
      renderAdminTraining();
      break;

    case "admin-bid-packages":
      renderAdminBidPackages();
      break;

    case "admin-bid-balances":
      renderAdminBidBalances();
      break;

    default:
      renderDashboard();
  }

  updateChrome(user);
  startCountdowns();
}


/* =========================================================
   TASK CARD
========================================================= */

function taskCard(task,user){

  const state = userTaskState(
    task.id,
    user.id
  );

  const status = state.status;
  const bid = state.bid;

  let actionHTML = "";

  if(status === "available"){

    if(!user.regPaid){

      actionHTML = `
        <button
          class="btn ghost small-btn"
          type="button"
          disabled
        >
          Registration Verification Required
        </button>
      `;

    }else if(dailyBidCount(user.id) >= userDailyLimit(user)){
      actionHTML = `
        <button
          class="btn ghost small-btn"
          type="button"
          disabled
        >
          Daily bid limit reached — ${dailyBidCount(user.id)}/${userDailyLimit(user)}
        </button>
      `;

    }else{

      actionHTML = `
        <button
          class="btn primary small-btn"
          type="button"
          onclick="placeBid('${task.id}')"
        >
          Bid Task
        </button>
      `;
    }

  }else if(status === "bidded"){

    actionHTML = `
      <button
        class="btn secondary small-btn"
        type="button"
        onclick="openSubmitModal('${task.id}')"
      >
        Submit Work
      </button>
    `;

  }else if(status === "submitted"){

    actionHTML = `
      <button
        class="btn ghost small-btn"
        type="button"
        onclick="renderPage('submissions')"
      >
        View Submission
      </button>
    `;

  }else if(status === "approved"){

    actionHTML = `
      <button
        class="btn secondary small-btn"
        type="button"
        onclick="renderPage('earnings')"
      >
        Payment Credited
      </button>
    `;

  }else if(status === "rejected"){

    actionHTML = `
      <button
        class="btn danger small-btn"
        type="button"
        disabled
      >
        Rejected
      </button>
    `;

  }else if(status === "expired"){

    actionHTML = `
      <button
        class="btn danger small-btn"
        type="button"
        disabled
      >
        Task Expired
      </button>
    `;
  }


  const countdownHTML =
    status === "bidded" && bid
      ? `
        <div
          class="bid-countdown"
          data-countdown="${escapeHTML(bid.deadlineAt)}"
        >
          Time remaining:
          <strong>
            ${countdownText(bid.deadlineAt)}
          </strong>
        </div>
      `
      : "";


  const deadlineText =
    bid
      ? `
        <span>
          Deadline:
          ${escapeHTML(dateTime(bid.deadlineAt))}
        </span>
      `
      : `
        <span>
          6-hour window starts after bidding
        </span>
      `;


  return `
    <article class="task-card">

      <div>

        <div class="task-title">
          ${escapeHTML(task.title)}
        </div>

        <div class="task-meta">

          <span>
            ${statusBadge(status)}
          </span>

          <span>
            Task level: ${escapeHTML(levelName(task.level))}
          </span>

          ${deadlineText}

        </div>

        <div class="task-description">
          ${escapeHTML(task.description)}
        </div>

        <div class="task-meta">

         
          <span>
            Bidding limit: ${dailyBidCount(user.id)}/${userDailyLimit(user)} today
          </span>

          <span>
            Available to all contributors
          </span>

        </div>

      </div>


      <div class="pay-box">

        <strong>
          ${money(task.payment)}
        </strong>

        <small>
          Task payment · Bid cost: ${Number(task.bidCost || 0)} bid(s)
        </small>

        ${countdownHTML}

        <div class="task-status-row">
          <span class="task-status-label">
            Status
          </span>
          ${statusBadge(status)}
        </div>

        <div class="task-actions">
          ${actionHTML}
        </div>

      </div>

    </article>
  `;
}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard(){

  const user = currentUser();

  if(!user) return;

  const tasks = accessibleTasks(user);
  const todayBids = dailyBidCount(user.id);

  const myBids = db().bids.filter(
    bid => bid.userId === user.id
  );

  const activeBids = myBids.filter(
    bid => bid.status === "bidded"
  );

  const approved = db().submissions.filter(
    submission =>
      submission.userId === user.id &&
      submission.status === "approved"
  ).length;


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>
        <h1>
          Good ${new Date().getHours() < 12 ? "morning" : "day"},
          ${escapeHTML(user.name.split(" ")[0])}
        </h1>

        <p>
          Your TaskForge workspace at a glance.
        </p>
      </div>

      <div class="actions">
        <button
          class="btn primary"
          type="button"
          onclick="renderPage('tasks')"
        >
          Browse Marketplace
        </button>
      </div>

    </div>


    ${
      !user.regPaid
        ? `
          <div class="notice warning">
            <strong>Registration verification required for bidding.</strong>
            You can already view every available task in the marketplace.
            Once an administrator confirms your registration payment,
            the Bid Task buttons will become available.
          </div>

          ${
            !user.registrationConfirmed
              ? renderConfirmRegistrationPanel(user)
              : `
                <div class="confirm-panel">
                  <h3>Registration payment under review</h3>
                  <p>
                    You confirmed your payment on
                    ${escapeHTML(dateTime(user.registrationConfirmedAt))}.
                    An administrator will verify it shortly.
                  </p>
                </div>
              `
          }
        `
        : `
          <div class="notice">
            <strong>Your account is verified.</strong>
            You can bid on up to 2 tasks per calendar day.
            Each successful bid starts a six-hour completion window.
          </div>
        `
    }


    <div class="cards">

      <div class="stat-card">

        <div class="stat-top">
          <span>Marketplace Tasks</span>
          <div class="stat-icon">▤</div>
        </div>

        <div class="stat-value">
          ${tasks.length}
        </div>

        <div class="stat-foot">
          Active tasks available to everyone
        </div>

      </div>


     <div class="stat-card">

        <div class="stat-top">
          <span>Today's Bids</span>
          <div class="stat-icon">✓</div>
        </div>

        <div class="stat-value">
          ${todayBids}/${userDailyLimit(user)}
        </div>

        <div class="stat-foot">
          ${
            todayBids >= userDailyLimit(user)
              ? `<strong>Daily limit reached</strong>`
              : `<strong>${userDailyLimit(user) - todayBids}</strong> bid(s) remaining`
          }
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-top">
          <span>Active My Tasks</span>
          <div class="stat-icon">◷</div>
        </div>

        <div class="stat-value">
          ${activeBids.length}
        </div>

        <div class="stat-foot">
          Tasks currently inside your six-hour windows
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-top">
          <span>Balance</span>
          <div class="stat-icon">K</div>
        </div>

        <div class="stat-value">
          ${money(user.balance)}
        </div>

        <div class="stat-foot">
          ${approved} approved submission(s) · <b>${Number(user.bidBalance || 0)} bid(s)</b>
        </div>

      </div>

    </div>


    <div class="grid-2">

      <div class="panel">

        <div class="panel-head">

          <h3>
            Marketplace
          </h3>

          <span>
            ${tasks.length} active tasks
          </span>

        </div>

        <div class="panel-body">

          <div class="task-list">

            ${
              tasks.length
                ? tasks
                    .slice(0,4)
                    .map(task => taskCard(task,user))
                    .join("")
                : `
                  <div class="empty">
                    <strong>No active tasks</strong>
                    Check back later for new marketplace tasks.
                  </div>
                `
            }

          </div>

        </div>

      </div>


      <div class="panel">

        <div class="panel-head">

          <h3>
            Account Status
          </h3>

        </div>

        <div class="panel-body">

          <div class="kpi-strip">

            <div class="kpi">
              <span>Level</span>
              <b>${escapeHTML(levelName(user.level))}</b>
            </div>

            <div class="kpi">
              <span>Registration</span>
              <b>
                ${user.regPaid ? "Verified" : "Pending"}
              </b>
            </div>

            <div class="kpi">
              <span>Today's limit</span>
              <b>${todayBids}/${userDailyLimit(user)}</b>
            </div>

          </div>


          <div style="margin-top:18px">

            ${
              user.regPaid
                ? `
                  <div class="notice">
                    Your registration is verified.
                    Bidding is currently enabled.
                  </div>
                `
                : `
                  <div class="notice warning">
                    Your registration payment has not yet been verified.
                    Marketplace viewing is available, but bidding is locked.
                  </div>
                `
            }

          </div>

        </div>

      </div>

    </div>

  `;
}


/* =========================================================
   MARKETPLACE
========================================================= */

function renderTasks(){

  const user = currentUser();

  if(!user) return;

  const tasks = accessibleTasks(user);
  const today = dailyBidCount(user.id);


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          Task Marketplace
        </h1>

        <p>
          Browse all active tasks and bid on the work that suits you.
        </p>

      </div>

      <div>
        ${statusBadge(
          user.regPaid
            ? "approved"
            : "pending"
        )}
      </div>

    </div>


    ${
      !user.regPaid
        ? `
          <div class="notice warning">
            <strong>Registration Verification Required</strong><br>
            You can view every task in the marketplace.
            Bidding will become available after an administrator
            verifies your registration payment.
          </div>
        `
        : today >= userDailyLimit(user)
          ? `
            <div class="notice danger">
              <strong>Daily bid limit reached — ${today}/${userDailyLimit(user)} tasks.</strong><br>
              Your bid allowance resets at the start of the next day.
          </div>
          `
          : `
            <div class="notice">
              <strong>You have ${userDailyLimit(user) - today} bid(s) remaining today.</strong><br>
              A successful bid immediately starts a six-hour task window.
            </div>
          `
    }


    <div class="marketplace-summary">

      <div class="marketplace-stat">
        <span>Active marketplace tasks</span>
        <strong>${tasks.length}</strong>
      </div>

      <div class="marketplace-stat">
        <span>Your bids today</span>
        <strong class="${today >= userDailyLimit(user) ? "limit-reached" : "limit-ok"}">
          ${today}/${userDailyLimit(user)}
        </strong>
      </div>

      <div class="marketplace-stat">
        <span>Remaining today</span>
        <strong>
          ${dailyBidRemaining(user.id)}
        </strong>
      </div>

    </div>


    <div class="panel">

      <div class="panel-head">

        <h3>
          Available Tasks
        </h3>

        <span>
          Same marketplace for all contributor levels
        </span>

      </div>

      <div class="panel-body">

        <div class="task-list">

          ${
            tasks.length
              ? tasks
                  .map(task => taskCard(task,user))
                  .join("")
              : `
                <div class="empty">
                  <strong>No active tasks</strong>
                  There are currently no active marketplace tasks.
                </div>
              `
          }

        </div>

      </div>

    </div>

  `;
}


/* =========================================================
   MY TASKS
========================================================= */

function renderMyTasks(){

  const user = currentUser();

  if(!user) return;

  expireBids();

  const bids = db().bids
    .filter(
      bid => bid.userId === user.id
    )
    .sort(
      (a,b) => Number(b.bidAt) - Number(a.bidAt)
    );


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          My Tasks
        </h1>

        <p>
          Tasks you have bid on and their current workflow status.
        </p>

      </div>

      <div class="actions">

        <button
          class="btn primary"
          type="button"
          onclick="renderPage('tasks')"
        >
          Find More Tasks
        </button>

      </div>

    </div>


    <div class="marketplace-summary">

      <div class="marketplace-stat">
        <span>Total bids</span>
        <strong>${bids.length}</strong>
      </div>

      <div class="marketplace-stat">
        <span>Active</span>
        <strong>
          ${bids.filter(x => x.status === "bidded").length}
        </strong>
      </div>

      <div class="marketplace-stat">
        <span>Completed</span>
        <strong>
          ${bids.filter(x => x.status === "approved").length}
        </strong>
      </div>

    </div>


    <div class="panel">

      <div class="panel-head">
        <h3>My Task Queue</h3>
        <span>${bids.length} task record(s)</span>
      </div>

      <div class="panel-body">

        ${
          bids.length
            ? `
              <div class="task-list">

                ${bids.map(bid => {

                  const task = taskById(bid.taskId);

                  if(!task) return "";

                  return taskCard(
                    task,
                    user
                  );

                }).join("")}

              </div>
            `
            : `
              <div class="empty">

                <strong>
                  You have not bid on any tasks yet.
                </strong>

                <p>
                  Visit the marketplace to browse available work.
                </p>

                <button
                  class="btn primary"
                  type="button"
                  onclick="renderPage('tasks')"
                >
                  Browse Tasks
                </button>

              </div>
            `
        }

      </div>

    </div>

  `;
}


/* =========================================================
   BID TASK
========================================================= */

function placeBid(taskId){

  const user = currentUser();

  if(!user) return;

  const task = taskById(taskId);

  if(!task){
    toast("Task could not be found.","error");
    return;
  }

  if(task.status !== "active"){
    toast("This task is no longer available.","error");
    return;
  }

  if(!user.regPaid){
    toast("Registration verification is required before bidding.","error");
    return;
  }

  expireBids();

       const existingBid = findBid(taskId, user.id);

  /* === Allow re-bid if:
       1. the last bid was rejected, OR
       2. the task was edited after the user's last bid === */
  const taskEditedSinceBid =
    existingBid &&
    Number(task.updatedAt || 0) > Number(existingBid.bidAt || 0);

  if(
    existingBid &&
    existingBid.status !== "rejected" &&
    existingBid.status !== "available-again" &&
    !taskEditedSinceBid
  ){

    toast(
      "You have already bid on this task.",
      "info"
    );

    return;
  }

  /* === NEW: per-level daily limit === */
  const limit = userDailyLimit(user);
  const count = dailyBidCount(user.id);

  if(count >= limit){
    toast(`Daily bid limit reached — ${count}/${limit} tasks.`,"error");
    renderPage(activePage);
    return;
  }

  /* === NEW: bid cost check + deduction === */
  const cost = Number(task.bidCost || 0);
  const data = db();
  const dbUser = data.users.find(u => u.id === user.id);

  if(Number(dbUser.bidBalance || 0) < cost){
    toast(
      `Not enough bids. This task requires ${cost} bid(s); you have ${Number(dbUser.bidBalance || 0)}.`,
      "error"
    );
    renderPage("buy-bids");
    return;
  }

  dbUser.bidBalance = Number(dbUser.bidBalance || 0) - cost;

  const now = Date.now();

  const bid = {
    id:uid("bid"),
    taskId,
    userId:user.id,
    status:"bidded",
    bidAt:now,
    deadlineAt:now + BID_WINDOW_MS,
    submittedAt:null,
    bidCostDeducted:cost
  };

  data.bids.push(bid);

  data.transactions.push({
    id:uid("tx"),
    userId:user.id,
    type:"bid",
    amount:0,
    status:"debited",
    description:`Bid placed on "${task.title}" — ${cost} bid(s) deducted`,
    createdAt:now
  });

  data.notifications.push({
    id:uid("notif"),
    userId:user.id,
    title:"Task successfully bidded",
    message:`You bid on "${task.title}" and ${cost} bid(s) were deducted. Six-hour window started.`,
    read:false,
    createdAt:now
  });

  saveDB(data);

  toast(`Bid placed. ${cost} bid(s) deducted. You have 6 hours to complete "${task.title}".`);

  renderPage(activePage === "my-tasks" ? "my-tasks" : "tasks");
}


/* =========================================================
   SUBMISSION MODAL
========================================================= */

function openSubmitModal(taskId){

  const user = currentUser();

  if(!user) return;

  const task = taskById(taskId);

  const state = userTaskState(
    taskId,
    user.id
  );

  if(!task || !state.bid){
    toast(
      "You must bid on this task before submitting.",
      "error"
    );

    return;
  }

  if(state.status !== "bidded"){

    if(state.status === "expired"){
      toast(
        "The six-hour task window has expired.",
        "error"
      );
    }else{
      toast(
        "This task is not currently awaiting submission.",
        "info"
      );
    }

    return;
  }

  if(Date.now() >= Number(state.bid.deadlineAt)){

    expireBids();

    toast(
      "The six-hour task window has expired.",
      "error"
    );

    renderPage(activePage);
    return;
  }


  document.getElementById("modalRoot").innerHTML = `

    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-head">

          <h3>
            Submit Task
          </h3>

          <button
            class="modal-close"
            type="button"
            onclick="closeModal()"
          >
            ×
          </button>

        </div>


        <form
          id="submissionForm"
          onsubmit="submitTask(event,'${task.id}')"
        >

          <div class="modal-body">

            <div class="notice info">

              <strong>
                ${escapeHTML(task.title)}
              </strong>

              <br>

              Time remaining:
              <strong
                data-modal-countdown="${escapeHTML(state.bid.deadlineAt)}"
              >
                ${countdownText(state.bid.deadlineAt)}
              </strong>

            </div>


            <div class="form-grid">

              <label class="full-col">

                Your work / answer

                <textarea
                  id="submissionAnswer"
                  required
                  placeholder="Describe or paste your completed work here..."
                ></textarea>

              </label>


              <label class="full-col">

                Supporting file
                <span class="optional">optional</span>

                <input
                  id="submissionFile"
                  type="file"
                >

              </label>

            </div>

          </div>


          <div class="modal-foot">

            <button
              class="btn ghost"
              type="button"
              onclick="closeModal()"
            >
              Cancel
            </button>

            <button
              class="btn primary"
              type="submit"
            >
              Submit Work
            </button>

          </div>

        </form>

      </div>

    </div>

  `;


  startModalCountdown();
}


function startModalCountdown(){

  const tick = () => {

    const el =
      document.querySelector("[data-modal-countdown]");

    if(!el) return;

    const deadline =
      Number(el.dataset.modalCountdown);

    const remaining =
      countdownText(deadline);

    el.textContent = remaining;

    if(Date.now() >= deadline){

      el.classList.add("danger-text");

      const form =
        document.getElementById("submissionForm");

      if(form){

        const button =
          form.querySelector(
            'button[type="submit"]'
          );

        if(button){
          button.disabled = true;
        }

      }

      expireBids();

      return;
    }

    setTimeout(tick,1000);
  };

  tick();
}


function submitTask(event,taskId){

  event.preventDefault();

  const user = currentUser();

  if(!user) return;

  const data = db();

  const task = data.tasks.find(
    item => item.id === taskId
  );

    /* Get the most recent bid for this user+task */
  const matches = data.bids.filter(
    item =>
      item.taskId === taskId &&
      item.userId === user.id
  );

  const bid = matches.length
    ? matches.sort((a,b) => Number(b.bidAt) - Number(a.bidAt))[0]
    : null;


  if(!task || !bid){

    toast(
      "A valid task bid is required.",
      "error"
    );

    return;
  }


  if(bid.status !== "bidded"){

    toast(
      "This task cannot be submitted in its current state.",
      "error"
    );

    return;
  }


  if(Date.now() >= Number(bid.deadlineAt)){

    bid.status = "expired";

    saveDB(data);

    closeModal();

    toast(
      "Your six-hour task window has expired.",
      "error"
    );

    renderPage(activePage);

    return;
  }


  const duplicate = data.submissions.find(
    submission =>
      submission.bidId === bid.id
  );

  if(duplicate){

    toast(
      "A submission already exists for this task.",
      "error"
    );

    return;
  }


  const answer =
    document
      .getElementById("submissionAnswer")
      ?.value
      .trim();

  const fileInput =
    document.getElementById("submissionFile");

  const file =
    fileInput?.files?.[0] || null;


  if(!answer){

    toast(
      "Please enter your completed work.",
      "error"
    );

    return;
  }


  const now = Date.now();

  // Record how much time was left in the six-hour window at
  // the moment of submission (visible to admin during review).
  const remainingMsAtSubmission =
    Math.max(0, Number(bid.deadlineAt) - now);

  const submission = {

    id:uid("sub"),

    taskId,

    bidId:bid.id,

    userId:user.id,

    answer,

    fileName:file
      ? file.name
      : "",

    fileSize:file
      ? file.size
      : 0,

    status:"submitted",

    createdAt:now,

    remainingMsAtSubmission,

    remainingAtSubmissionText:
      remainingMsAtSubmission > 0
        ? countdownText(now + remainingMsAtSubmission)
        : "00:00:00"

  };


  data.submissions.push(submission);

  bid.status = "submitted";
  bid.submittedAt = now;


  data.notifications.push({

    id:uid("notif"),

    userId:user.id,

    title:"Task submitted",

    message:`Your submission for "${task.title}" has been sent for administrator review.`,

    read:false,

    createdAt:now

  });


  saveDB(data);

  closeModal();

  toast(
    "Submission received and sent for review."
  );

  renderPage(
    activePage === "my-tasks"
      ? "my-tasks"
      : "submissions"
  );
}


/* =========================================================
   SUBMISSIONS
========================================================= */

function renderSubmissions(){

  const user = currentUser();

  if(!user) return;

  const submissions = currentUserSubmissions()
    .sort(
      (a,b) =>
        Number(b.createdAt) -
        Number(a.createdAt)
    );


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          My Submissions
        </h1>

        <p>
          Track work you've submitted for review.
        </p>

      </div>

    </div>


    <div class="panel">

      <div class="panel-head">

        <h3>
          Submission History
        </h3>

        <span>
          ${submissions.length} submission(s)
        </span>

      </div>


      <div class="table-wrap">

        ${
          submissions.length
            ? `
              <table class="table">

                <thead>

                  <tr>
                    <th>Task</th>
                    <th>Submitted</th>
                    <th>Payment</th>
                    <th>Status</th>
                  </tr>

                </thead>

                <tbody>

                  ${submissions.map(sub => {

                    const task =
                      taskById(sub.taskId);

                    return `
                      <tr>

                        <td>
                          <strong>
                            ${escapeHTML(
                              task?.title ||
                              "Task"
                            )}
                          </strong>

                          ${
                            sub.fileName
                              ? `
                                <div class="footer-note">
                                  File:
                                  ${escapeHTML(sub.fileName)}
                                </div>
                              `
                              : ""
                          }

                        </td>

                        <td>
                          ${dateTime(sub.createdAt)}
                        </td>

                        <td>
                          ${money(task?.payment || 0)}
                        </td>

                        <td>
                          ${
                            statusBadge(
                              sub.status === "submitted"
                                ? "submitted"
                                : sub.status
                            )
                          }

                          ${
                            sub.status === "approved"
                              ? `
                                <div class="payment-window-box">
                                  <strong>Payment window:</strong>
                                  ${escapeHTML(levelWindow(user.level))}
                                  from approval.
                                </div>
                              `
                              : ""
                          }

                          ${
                            sub.status === "rejected"
                              ? `
                                <div class="rejection-box">
                                  <strong>Rejection reason:</strong>
                                  ${escapeHTML(sub.rejectionReason || "No reason provided.")}
                                </div>
                              `
                              : ""
                          }
                        </td>

                      </tr>
                    `;

                  }).join("")}

                </tbody>

              </table>
            `
            : `
              <div class="empty">

                <strong>
                  No submissions yet
                </strong>

                Bid on a task and submit your completed work
                before your six-hour deadline.

              </div>
            `
        }

      </div>

    </div>

  `;
}


/* =========================================================
   EARNINGS
========================================================= */

function renderEarnings(){

  const user = currentUser();

  if(!user) return;

  const withdrawals =
    db().withdrawals.filter(
      item => item.userId === user.id
    );


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          Earnings & Withdrawals
        </h1>

        <p>
          Track your available balance and payout requests.
        </p>

      </div>

      <button
        class="btn primary"
        type="button"
        onclick="openWithdrawalModal()"
      >
        Request Withdrawal
      </button>

    </div>

    

    <!-- === NEW: Payout details === -->
    <div class="panel" style="margin-bottom:18px">
      <div class="panel-head">
        <h3>Payout Details</h3>
        <span>Phone and name for receiving withdrawal payments</span>
      </div>
      <div class="panel-body">
        ${
          (user.payoutName && user.payoutPhone)
            ? `
              <div class="notice" style="margin-bottom:14px">
                <strong>Current payout details:</strong>
                ${escapeHTML(user.payoutName)} —
                <span class="code-pill">${escapeHTML(user.payoutPhone)}</span>
                <br>
                <span style="font-size:10px;color:#5a6d68">You can update these anytime below.</span>
              </div>
            `
            : `
              <div class="notice warning" style="margin-bottom:14px">
                <strong>Payout details not set.</strong>
                Please set the phone number and name to receive withdrawal payments.
              </div>
            `
        }

        <form onsubmit="savePayoutDetails(event)">
          <div class="form-grid">
            <label>
              Payout name (as registered on M-Pesa)
              <input
                id="payoutName"
                required
                value="${escapeHTML(user.payoutName || "")}"
                placeholder="e.g. Benson Carl"
              >
            </label>
            <label>
              Payout phone (+254...)
              <input
                id="payoutPhone"
                required
                value="${escapeHTML(user.payoutPhone || "")}"
                placeholder="+254712345678"
              >
              <small class="field-hint">
                The M-Pesa line that should receive your withdrawal.
              </small>
            </label>
          </div>

          <button class="btn primary" type="submit">
            Save payout details
          </button>
        </form>
      </div>
    </div>




    <div class="cards">

      <div class="stat-card">

        <div class="stat-top">
          <span>Available Balance</span>
          <div class="stat-icon">K</div>
        </div>

        <div class="stat-value">
          ${money(user.balance)}
        </div>

        <div class="stat-foot">
          Available for withdrawal
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-top">
          <span>Approved Tasks</span>
          <div class="stat-icon">✓</div>
        </div>

        <div class="stat-value">
          ${
            db().submissions.filter(
              x =>
                x.userId === user.id &&
                x.status === "approved"
            ).length
          }
        </div>

        <div class="stat-foot">
          Completed and approved
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-top">
          <span>Withdrawals</span>
          <div class="stat-icon">↗</div>
        </div>

        <div class="stat-value">
          ${withdrawals.length}
        </div>

        <div class="stat-foot">
          Requests submitted
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-top">
          <span>Level</span>
          <div class="stat-icon">L</div>
        </div>

        <div class="stat-value">
          ${escapeHTML(levelName(user.level))}
        </div>

        <div class="stat-foot">
          Registration fee:
          ${money(levelFee(user.level))}
        </div>

      </div>

    </div>


    <div class="notice info">
      <strong>Withdrawal timeline:</strong>
      Based on your current level
      (<b>${escapeHTML(levelName(user.level))}</b>),
      approved withdrawals are processed within
      <b>${escapeHTML(levelWindow(user.level))}</b>.
    </div>


    <div class="panel">

      <div class="panel-head">
        <h3>Withdrawal History</h3>
      </div>

      <div class="table-wrap">

        ${
          withdrawals.length
            ? `
              <table class="table">

                <thead>

                  <tr>
                    <th>Amount</th>
                    <th>Requested</th>
                    <th>Expected in</th>
                    <th>Status</th>
                  </tr>

                </thead>

                <tbody>

                  ${withdrawals.map(item => `

                    <tr>

                      <td>
                        <strong>
                          ${money(item.amount)}
                        </strong>
                      </td>

                      <td>
                        ${dateTime(item.createdAt)}
                      </td>

                      <td>
                        ${escapeHTML(item.expectedWindow || levelWindow(item.levelAtRequest || user.level))}
                      </td>

                      <td>
                        ${statusBadge(item.status)}
                      </td>

                    </tr>

                  `).join("")}

                </tbody>

              </table>
            `
            : `
              <div class="empty">
                <strong>No withdrawal requests</strong>
                Your withdrawal history will appear here.
              </div>
            `
        }

      </div>

    </div>

  `;
}


/* =========================================================
   WITHDRAWAL
========================================================= */

function openWithdrawalModal(){

  const user = currentUser();

  if(!user) return;


  document.getElementById("modalRoot").innerHTML = `

    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-head">

          <h3>
            Request Withdrawal
          </h3>

          <button
            class="modal-close"
            type="button"
            onclick="closeModal()"
          >
            ×
          </button>

        </div>


        <form onsubmit="requestWithdrawal(event)">

          <div class="modal-body">

            <div class="notice">
              Available balance:
              <strong>
                ${money(user.balance)}
              </strong>
            </div>

            ${
              (!user.payoutName || !user.payoutPhone)
                ? `
                  <div class="notice warning">
                    <strong>Payout details not set.</strong>
                    You can still request a withdrawal, but please set your payout
                    phone and name on the Earnings page so payment can be sent.
                  </div>
                `
                : `
                  <div class="notice info">
                    Payout will be sent to
                    <strong>${escapeHTML(user.payoutName)}</strong>
                    (${escapeHTML(user.payoutPhone)}).
                  </div>
                `
            }

            <div class="notice info">
              <strong>Expected payment window:</strong>
              Based on your level
              (<b>${escapeHTML(levelName(user.level))}</b>),
              you should expect payment within
              <b>${escapeHTML(levelWindow(user.level))}</b>
              after approval.
            </div>

            <label>
              Amount
              <input
                id="withdrawAmount"
                type="number"
                min="1"
                max="${Number(user.balance)}"
                step="1"
                required
                placeholder="Enter amount"
              >
            </label>

          </div>


          <div class="modal-foot">

            <button
              class="btn ghost"
              type="button"
              onclick="closeModal()"
            >
              Cancel
            </button>

            <button
              class="btn primary"
              type="submit"
            >
              Request Withdrawal
            </button>

          </div>

        </form>

      </div>

    </div>

  `;
}


function requestWithdrawal(event){

  event.preventDefault();

  const user = currentUser();

  if(!user) return;

  const amount =
    Number(
      document.getElementById("withdrawAmount").value
    );


  if(!Number.isFinite(amount) || amount <= 0){

    toast(
      "Enter a valid withdrawal amount.",
      "error"
    );

    return;
  }


  if(amount > Number(user.balance)){

    toast(
      "Withdrawal amount exceeds your balance.",
      "error"
    );

    return;
  }


  const data = db();

  const actualUser =
    data.users.find(
      item => item.id === user.id
    );

  actualUser.balance -= amount;

  const expectedWindow =
    levelWindow(actualUser.level);


  data.withdrawals.push({

    id:uid("wd"),

    userId:user.id,

    amount,

    levelAtRequest:actualUser.level,

    expectedWindow,

    status:"processing",

    createdAt:Date.now()

  });


  data.transactions.push({

    id:uid("tx"),

    userId:user.id,

    type:"withdrawal",

    amount:-amount,

    status:"processing",

    description:"Withdrawal request",

    createdAt:Date.now()

  });


  data.notifications.push({

    id:uid("notif"),

    userId:user.id,

    title:"Withdrawal request received",

    message:`Your withdrawal of ${money(amount)} is being processed. Based on your level (${levelName(actualUser.level)}), you should expect payment within ${expectedWindow}.`,

    read:false,

    createdAt:Date.now()

  });


  saveDB(data);

  closeModal();

  toast(
    `Withdrawal submitted. Based on your level, expect payment within ${expectedWindow}.`,
    "info"
  );

  renderPage("earnings");
}


/* =========================================================
   APPLY FOR TRAINING (user side — moved from registration)
========================================================= */

function renderTraining(){

  const user = currentUser();

  if(!user) return;

  const requests =
    db().training
      .filter(item => item.userId === user.id)
      .sort(
        (a,b) =>
          Number(b.createdAt) -
          Number(a.createdAt)
      );

  const basicFee = trainingFee("basic");
  const specialFee = trainingFee("special");


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>
        <h1>Apply for Training</h1>
        <p>
          Choose a training track, submit your payment request and
          wait for admin approval. A Google Meet link will be sent
          to your email after verification.
        </p>
      </div>

    </div>


    ${
      requests.some(r => r.status === "pending")
        ? `
          <div class="notice warning">
            <strong>You have a training request awaiting approval.</strong>
            You'll be notified as soon as the admin reviews it.
          </div>
        `
        : ""
    }


    <div class="panel">

      <div class="panel-head">
        <h3>Training Application</h3>
        <span>Basic or Special</span>
      </div>

      <div class="panel-body">

              <form onsubmit="submitTrainingRequest(event)">

          <div class="form-grid">

            <label class="full-col">
              Email (where the training link will be sent)
              <input
                id="trainingEmail"
                type="email"
                required
                value="${escapeHTML(user.email)}"
              >
              <small class="field-hint">
                Defaults to your account email. You can change it.
              </small>
            </label>

            <label class="full-col">
              Training type
              <select id="trainingType" onchange="updateTrainingNote()">
                <option value="basic" selected>
                  Basic Training — ${money(basicFee)}
                </option>
                <option value="special">
                  Special Training — ${money(specialFee)}
                </option>
              </select>
            </label>

            <label class="full-col">
              M-Pesa confirmation code
              <input
                id="trainingMpesaCode"
                required
                placeholder="e.g. QGH7X8K2LM"
                maxlength="10"
                style="text-transform:uppercase"
              >
              <small class="field-hint">
                Pay the fee via Paybill, then enter the 10-character code from your M-Pesa SMS.
              </small>
            </label>

          </div> 


          <div id="trainingNoteBox" class="training-note"></div>


          <div class="notice info">
            After submitting, your request will be pending until an
            administrator verifies your payment. You'll receive a
            notification once it's reviewed.
          </div>

          <button
            class="btn primary full"
            type="submit"
          >
            Submit Training Request
          </button>

        </form>

      </div>

    </div>


    <div class="panel" style="margin-top:18px">

      <div class="panel-head">
        <h3>My Training Requests</h3>
        <span>${requests.length} record(s)</span>
      </div>

      <div class="table-wrap">

        ${
          requests.length
            ? `
              <table class="table">

                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Requested</th>
                    <th>Fee</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>

                  ${requests.map(item => `

                    <tr>

                      <td>
                        <strong>
                          ${
                            item.type === "basic"
                              ? "Basic Training"
                              : "Special Training"
                          }
                        </strong>
                      </td>

                      <td>
                        ${dateTime(item.createdAt)}
                      </td>

                      <td>
                        ${money(
                          item.fee ||
                          trainingFee(item.type)
                        )}
                      </td>

                      <td>
                        ${statusBadge(item.status)}
                      </td>

                    </tr>

                  `).join("")}

                </tbody>

              </table>
            `
            : `
              <div class="empty">
                <strong>No training requests yet</strong>
                Submit your first request above.
              </div>
            `
        }

      </div>

    </div>

  `;


  updateTrainingNote();
}


function updateTrainingNote(){

  const box = document.getElementById("trainingNoteBox");
  const select = document.getElementById("trainingType");

  if(!box || !select) return;

  const type = select.value;

  box.innerHTML =
    type === "basic"
      ? `<pre class="training-note-pre">${escapeHTML(BASIC_TRAINING_NOTE)}</pre>`
      : `<pre class="training-note-pre">${escapeHTML(SPECIAL_TRAINING_NOTE)}</pre>`;
}


function submitTrainingRequest(event){

  event.preventDefault();

  const user = currentUser();

  if(!user) return;

  const email =
    normalizeEmail(
      document.getElementById("trainingEmail").value
    );

  const type =
    document.getElementById("trainingType").value;

  if(!isValidEmail(email)){

    toast(
      "Please enter a valid email address.",
      "error"
    );

    return;
  }

  const code = normalizeMpesaCode(
    document.getElementById("trainingMpesaCode")?.value
  );

  if(!isValidMpesaCode(code)){

    toast(
      "Enter a valid 10-character M-Pesa code.",
      "error"
    );

    return;
  }

  const data = db();

  const duplicate = data.training.find(
    item =>
      item.userId === user.id &&
      item.status === "pending"
  );

  if(duplicate){

    toast(
      "You already have a training request pending approval.",
      "info"
    );

    return;
  }

  const codeExists = data.paymentRequests.some(
    x => x.mpesaCode === code && x.status !== "rejected"
  );

  if(codeExists){

    toast("This M-Pesa code has already been used.","error");

    return;
  }

  const fee = trainingFee(type);
  const now = Date.now();

  const request = {
    id:uid("trn"),
    userId:user.id,
    email,
    type,
    fee,
    mpesaCode:code,
    status:"pending",
    createdAt:now
  };

  data.training.push(request);

  data.paymentRequests.push({
    id:uid("preq"),
    userId:user.id,
    kind:"training",
    referenceId:request.id,
    amount:fee,
    mpesaCode:code,
    description:
      type === "basic"
        ? "Basic Training payment"
        : "Special Training payment",
    status:"pending",
    createdAt:now
  });

  data.notifications.push({
    id:uid("notif"),
    userId:user.id,
    title:"Training request submitted",
    message:`Your ${type === "basic" ? "Basic" : "Special"} Training request has been submitted. M-Pesa code ${code}. Pending admin approval.`,
    read:false,
    createdAt:now
  });

  saveDB(data);

  toast("Training request submitted. Awaiting admin approval.");

  renderPage("training");
}


/* =========================================================
   UPGRADE LEVEL (user side)
========================================================= */

function renderUpgrade(){

  const user = currentUser();

  if(!user) return;

  const pending =
    db().paymentRequests.find(
      item =>
        item.userId === user.id &&
        item.kind === "upgrade" &&
        item.status === "pending"
    );


  const options = [1,2,3]
    .filter(level => level > Number(user.level))
    .map(level => `
      <option value="${level}">
        ${escapeHTML(levelName(level))} — ${money(levelFee(level))} (payment window: ${escapeHTML(levelWindow(level))})
      </option>
    `)
    .join("");


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>
        <h1>Upgrade Level</h1>
        <p>
          Select the level you want to upgrade to, submit your payment
          and wait for admin approval. Your account level updates once
          the admin approves.
        </p>
      </div>

    </div>


    <div class="cards">

      <div class="stat-card">
        <div class="stat-top">
          <span>Current Level</span>
          <div class="stat-icon">L</div>
        </div>
        <div class="stat-value">
          ${escapeHTML(levelName(user.level))}
        </div>
        <div class="stat-foot">
          Payment window: ${escapeHTML(levelWindow(user.level))}
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span>Registration Fee (current)</span>
          <div class="stat-icon">K</div>
        </div>
        <div class="stat-value">
          ${money(levelFee(user.level))}
        </div>
        <div class="stat-foot">
          Current level fee
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span>Upgrade Requests</span>
          <div class="stat-icon">↥</div>
        </div>
        <div class="stat-value">
          ${db().paymentRequests.filter(x => x.userId === user.id && x.kind === "upgrade").length}
        </div>
        <div class="stat-foot">
          Total submitted
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-top">
          <span>Balance</span>
          <div class="stat-icon">K</div>
        </div>
        <div class="stat-value">
          ${money(user.balance)}
        </div>
        <div class="stat-foot">
          Available
        </div>
      </div>

    </div>


    ${
      pending
        ? `
          <div class="notice warning">
            <strong>You have an upgrade request pending approval.</strong>
            Target: ${escapeHTML(levelName(pending.targetLevel))}.
            You'll be notified once the admin reviews it.
          </div>
        `
        : ""
    }


    <div class="panel">

      <div class="panel-head">
        <h3>Request an Upgrade</h3>
        <span>Payment required before approval</span>
      </div>

      <div class="panel-body">

        ${
          Number(user.level) >= 3
            ? `
              <div class="notice">
                You are already on the highest level (Level 3).
              </div>
            `
            : `
                <form onsubmit="submitUpgradeRequest(event)">

                <div class="form-grid">

                  <label class="full-col">
                    Target level
                    <select id="upgradeTarget">
                      ${options}
                    </select>
                  </label>

                  <label class="full-col">
                    M-Pesa confirmation code
                    <input
                      id="upgradeMpesaCode"
                      required
                      placeholder="e.g. QGH7X8K2LM"
                      maxlength="10"
                      style="text-transform:uppercase"
                    >
                    <small class="field-hint">
                      Pay the level fee via Paybill, then enter the 10-character code from your M-Pesa SMS.
                    </small>
                  </label>

                </div> 

                <div class="notice info">
                  <strong>How it works:</strong>
                  Choose the level you want. Pay the corresponding fee.
                  Once the admin approves your payment, your account will
                  be upgraded automatically.
                </div>

                <button
                  class="btn primary full"
                  type="submit"
                >
                  Submit Upgrade Request
                </button>

              </form>
            `
        }

      </div>

    </div>


    <div class="panel" style="margin-top:18px">

      <div class="panel-head">
        <h3>My Upgrade Requests</h3>
      </div>

      <div class="table-wrap">

        ${
          db().paymentRequests.filter(
            x => x.userId === user.id && x.kind === "upgrade"
          ).length
            ? `
              <table class="table">
                <thead>
                  <tr>
                    <th>Target</th>
                    <th>Fee</th>
                    <th>Requested</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${db().paymentRequests
                    .filter(x => x.userId === user.id && x.kind === "upgrade")
                    .sort((a,b) => Number(b.createdAt) - Number(a.createdAt))
                    .map(item => `
                      <tr>
                        <td>${escapeHTML(levelName(item.targetLevel))}</td>
                        <td>${money(item.amount)}</td>
                        <td>${dateTime(item.createdAt)}</td>
                        <td>${statusBadge(item.status)}</td>
                      </tr>
                    `).join("")}
                </tbody>
              </table>
            `
            : `
              <div class="empty">
                <strong>No upgrade requests yet</strong>
                Submit your first request above.
              </div>
            `
        }

      </div>

    </div>

  `;
}


function submitUpgradeRequest(event){

  event.preventDefault();

  const user = currentUser();

  if(!user) return;

  const targetLevel =
    Number(document.getElementById("upgradeTarget").value);

  if(![1,2,3].includes(targetLevel)){

    toast("Please select a valid level.","error");
    return;
  }

  if(targetLevel <= Number(user.level)){

    toast(
      "Please choose a level higher than your current level.",
      "error"
    );

    return;
  }

  const code = normalizeMpesaCode(
    document.getElementById("upgradeMpesaCode")?.value
  );

  if(!isValidMpesaCode(code)){

    toast(
      "Enter a valid 10-character M-Pesa code.",
      "error"
    );

    return;
  }

  const data = db();

  const duplicate = data.paymentRequests.find(
    item =>
      item.userId === user.id &&
      item.kind === "upgrade" &&
      item.status === "pending"
  );

  if(duplicate){

    toast(
      "You already have an upgrade request pending approval.",
      "info"
    );

    return;
  }

  const codeExists = data.paymentRequests.some(
    x => x.mpesaCode === code && x.status !== "rejected"
  );

  if(codeExists){

    toast("This M-Pesa code has already been used.","error");

    return;
  }

  const amount = levelFee(targetLevel);
  const now = Date.now();

  data.paymentRequests.push({
    id:uid("preq"),
    userId:user.id,
    kind:"upgrade",
    targetLevel,
    amount,
    mpesaCode:code,
    description:`Upgrade to ${levelName(targetLevel)}`,
    status:"pending",
    createdAt:now
  });

  data.notifications.push({
    id:uid("notif"),
    userId:user.id,
    title:"Upgrade request submitted",
    message:`Your request to upgrade to ${levelName(targetLevel)} has been submitted. M-Pesa code ${code}. Awaiting admin approval.`,
    read:false,
    createdAt:now
  });

  saveDB(data);

  toast("Upgrade request submitted. Awaiting admin approval.");

  renderPage("upgrade");
}


/* =========================================================
   REFERRALS
========================================================= */

function renderReferrals(){

  const user = currentUser();

  if(!user) return;

  const referralCode =
    "TF" +
    user.id
      .replace(/\W/g,"")
      .slice(-6)
      .toUpperCase();

  const link =
    location.origin +
    location.pathname +
    "?ref=" +
    referralCode;


  const referrals =
    db().referrals.filter(
      item => item.referrerId === user.id
    );

  const pending =
    referrals.filter(
      x => x.status === "pending"
    );

  const approved =
    referrals.filter(
      x => x.status === "approved"
    );


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          Referrals
        </h1>

        <p>
          Share your referral link and earn 30% of each referred
          user's registration fee once an admin approves it.
        </p>

      </div>

    </div>


    <div class="grid-2">

      <div class="referral-box">

        <h3>
          Your referral link
        </h3>

        <p>
          Anyone who registers using this link will be credited to
          your account. You earn 30% of their registration fee as
          a pending commission, released once an admin approves it.
        </p>

        <div class="referral-link">
          ${escapeHTML(link)}
        </div>

        <button
          class="btn primary"
          type="button"
          onclick="copyReferral('${escapeHTML(link)}')"
        >
          Copy Referral Link
        </button>

      </div>


      <div class="panel">

        <div class="panel-head">
          <h3>
            Referral Summary
          </h3>
        </div>

        <div class="panel-body">

          <div class="kpi-strip">

            <div class="kpi">
              <span>Referrals</span>
              <b>${referrals.length}</b>
            </div>

            <div class="kpi">
              <span>Pending</span>
              <b>${pending.length}</b>
            </div>

            <div class="kpi">
              <span>Approved</span>
              <b>${approved.length}</b>
            </div>

          </div>

          <div style="margin-top:18px">

            <div class="notice info">
              Pending commissions are released to your balance
              only after an administrator approves them.
            </div>

          </div>

        </div>

      </div>

    </div>


    <div class="panel">

      <div class="panel-head">
        <h3>Referred Users</h3>
        <span>${referrals.length} record(s)</span>
      </div>

      <div class="table-wrap">

        ${
          referrals.length
            ? `
              <table class="table">

                <thead>

                  <tr>
                    <th>Referred user</th>
                    <th>Commission (30%)</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>

                </thead>

                <tbody>

                  ${referrals.map(item => {

                    const referred =
                      findUser(item.referredUserId);

                    return `
                      <tr>

                        <td>
                          ${escapeHTML(referred?.name || "User")}
                          <div class="footer-note">
                            ${escapeHTML(referred?.email || "")}
                          </div>
                        </td>

                        <td>
                          ${money(item.commission)}
                        </td>

                        <td>
                          ${
                            item.status === "approved"
                              ? `<span class="badge approved-commission">APPROVED</span>`
                              : `<span class="badge pending-commission">PENDING</span>`
                          }
                        </td>

                        <td>
                          ${dateTime(item.createdAt)}
                        </td>

                      </tr>
                    `;

                  }).join("")}

                </tbody>

              </table>
            `
            : `
              <div class="empty">
                <strong>No referrals yet</strong>
                Share your referral link to start earning.
              </div>
            `
        }

      </div>

    </div>

  `;
}


function copyReferral(text){

  navigator.clipboard
    ?.writeText(text)
    .then(() => {
      toast("Referral link copied.");
    })
    .catch(() => {
      toast("Copy failed. Please copy the link manually.","error");
    });
}


/* =========================================================
   TRANSACTIONS
========================================================= */

function renderTransactions(){

  const user = currentUser();

  if(!user) return;

  const transactions =
    db().transactions
      .filter(
        transaction =>
          transaction.userId === user.id
      )
      .sort(
        (a,b) =>
          Number(b.createdAt) -
          Number(a.createdAt)
      );


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          Transactions
        </h1>

        <p>
          Your account transaction history.
        </p>

      </div>

    </div>


    <div class="panel">

      <div class="table-wrap">

        ${
          transactions.length
            ? `
              <table class="table">

                <thead>

                  <tr>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>

                </thead>

                <tbody>

                  ${transactions.map(tx => `

                    <tr>

                      <td>
                        ${escapeHTML(tx.description)}
                      </td>

                      <td class="${
                        Number(tx.amount) >= 0
                          ? "tx-positive"
                          : "tx-negative"
                      }">

                        ${
                          Number(tx.amount) >= 0
                            ? "+"
                            : ""
                        }

                        ${money(tx.amount)}

                      </td>

                      <td>
                        ${statusBadge(tx.status)}
                      </td>

                      <td>
                        ${dateTime(tx.createdAt)}
                      </td>

                    </tr>

                  `).join("")}

                </tbody>

              </table>
            `
            : `
              <div class="empty">
                <strong>No transactions</strong>
                Your account activity will appear here.
              </div>
            `
        }

      </div>

    </div>

  `;
}


/* =========================================================
   PROFILE
========================================================= */

function renderProfile(){

  const user = currentUser();

  if(!user) return;

  const pm = paymentMethod();


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>
        <h1>Profile</h1>
        <p>Manage your TaskForge account information.</p>
      </div>
    </div>


    <div class="panel">

      <div class="panel-head">
        <h3>Account Information</h3>
        ${statusBadge(user.regPaid ? "approved" : "pending")}
      </div>

      <div class="panel-body">

        <div class="form-grid">

          <label>
            Full name
            <input
              value="${escapeHTML(user.name)}"
              disabled
            >
          </label>

          <label>
            Email
            <input
              value="${escapeHTML(user.email)}"
              disabled
            >
          </label>

          <label>
            Phone
            <input
              value="${escapeHTML(user.phone)}"
              disabled
            >
          </label>

          <label>
            Account level
            <input
              value="${escapeHTML(levelName(user.level))}"
              disabled
            >
          </label>

        </div>


        <div class="notice" style="margin-top:15px">

          <strong>
            Marketplace access
          </strong>

          <br>

          All contributor levels can view the same active marketplace.

          ${
            user.regPaid
              ? "Your registration is verified and bidding is enabled."
              : "Your registration is awaiting verification, so bidding is currently locked."
          }

        </div>


        <div class="payment-method-box">

          <strong>Registration payment method (M-Pesa Paybill only)</strong>

          Paybill: <span class="code-pill">${escapeHTML(pm.paybill)}</span>
          &nbsp;·&nbsp;
          Account: <span class="code-pill">${escapeHTML(pm.accountLabel)}</span>

          <div style="margin-top:6px">
            Example provider: ${escapeHTML(pm.provider)}.
            Only use a phone number linked to your M-Pesa account.
          </div>

          <div style="margin-top:6px">
            Need help?
            <a
              href="mailto:${escapeHTML(ADMIN_CONTACT_EMAIL)}"
              style="color:#0e7c68;font-weight:700"
            >
              ${escapeHTML(ADMIN_CONTACT_EMAIL)}
            </a>
          </div>

        </div>

      </div>

    </div>

  `;
}


/* =========================================================
   CONTACT ADMIN
========================================================= */

function renderContact(){

  const user = currentUser();

  if(!user) return;

  const pm = paymentMethod();

  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>
        <h1>Contact Admin</h1>
        <p>Reach the administrator for any account or payment issues.</p>
      </div>

    </div>

    <div class="panel">

      <div class="panel-body">

        <div class="payment-method-box">

          <strong>Email support</strong>

          <a
            href="mailto:${escapeHTML(ADMIN_CONTACT_EMAIL)}"
            style="color:#0e7c68;font-weight:700;font-size:13px"
          >
            ${escapeHTML(ADMIN_CONTACT_EMAIL)}
          </a>

          <div style="margin-top:8px">
            Please include your registered email, phone number and a
            short description of the issue so the admin can assist faster.
          </div>

        </div>


        <div class="payment-method-box">

          <strong>Payment method (M-Pesa Paybill only)</strong>

          Paybill: <span class="code-pill">${escapeHTML(pm.paybill)}</span>
          &nbsp;·&nbsp;
          Account: <span class="code-pill">${escapeHTML(pm.accountLabel)}</span>

          <div style="margin-top:6px">
            Example provider: ${escapeHTML(pm.provider)}.
            No bank fields are used.
          </div>

        </div>

      </div>

    </div>

  `;
}


/* =========================================================
   ADMIN DASHBOARD
========================================================= */

function requireAdmin(){

  const user = currentUser();

  if(!user || user.role !== "admin"){

    toast(
      "Administrator access required.",
      "error"
    );

    renderPage("dashboard");

    return null;
  }

  return user;
}


function renderAdminDashboard(){

  if(!requireAdmin()) return;

  const data = db();

  const users =
    data.users.filter(
      user => user.role !== "admin"
    );

  const activeTasks =
    data.tasks.filter(
      task => task.status === "active"
    );

  const pendingSubs =
    data.submissions.filter(
      sub =>
        sub.status === "submitted" ||
        sub.status === "pending"
    );

   const limitUsers =
    users.filter(
      user =>
        dailyBidCount(user.id) >= userDailyLimit(user)
    );

  const pendingReferrals =
    data.referrals.filter(
      item => item.status === "pending"
    );

  const pendingTraining =
    data.training.filter(
      item => item.status === "pending"
    );

  const pendingRequests =
    data.paymentRequests.filter(
      item => item.status === "pending"
    );


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          Admin Dashboard
        </h1>

        <p>
          Monitor the marketplace, bids, submissions and payments.
        </p>

      </div>

    </div>


    <div class="cards">

      <div class="stat-card">

        <div class="stat-top">
          <span>Contributors</span>
          <div class="stat-icon">♙</div>
        </div>

        <div class="stat-value">
          ${users.length}
        </div>

        <div class="stat-foot">
          Registered contributor accounts
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-top">
          <span>Active Tasks</span>
          <div class="stat-icon">▤</div>
        </div>

        <div class="stat-value">
          ${activeTasks.length}
        </div>

        <div class="stat-foot">
          Marketplace tasks
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-top">
          <span>Pending Submissions</span>
          <div class="stat-icon">✓</div>
        </div>

        <div class="stat-value">
          ${pendingSubs.length}
        </div>

        <div class="stat-foot">
          Awaiting review
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-top">
          <span>Pending Referrals</span>
          <div class="stat-icon">♧</div>
        </div>

        <div class="stat-value">
          ${pendingReferrals.length}
        </div>

        <div class="stat-foot">
          30% commissions awaiting approval
        </div>

      </div>

    </div>


    <div class="grid-2">

      <div class="panel">

        <div class="panel-head">
          <h3>Recent Bids</h3>
          <span>${data.bids.length} total</span>
        </div>

        <div class="table-wrap">

          <table class="table">

            <thead>
              <tr>
                <th>User</th>
                <th>Task</th>
                <th>Bid Time</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>

              ${
                data.bids
                  .slice()
                  .sort(
                    (a,b) =>
                      Number(b.bidAt) -
                      Number(a.bidAt)
                  )
                  .slice(0,8)
                  .map(bid => {

                    const user =
                      findUser(bid.userId);

                    const task =
                      taskById(bid.taskId);

                    return `
                      <tr>

                        <td>
                          ${escapeHTML(user?.name || "User")}
                        </td>

                        <td>
                          ${escapeHTML(task?.title || "Task")}
                        </td>

                        <td>
                          ${dateTime(bid.bidAt)}
                        </td>

                        <td>
                          ${statusBadge(bid.status)}
                        </td>

                      </tr>
                    `;

                  })
                  .join("")
                  ||
                  `
                    <tr>
                      <td colspan="4" class="center">
                        No bids yet.
                      </td>
                    </tr>
                  `
              }

            </tbody>

          </table>

        </div>

      </div>


      <div class="panel">

        <div class="panel-head">
          <h3>Daily Bid Limits</h3>
          <button
            class="btn secondary small-btn"
            type="button"
            onclick="resetAllDailyLimits()"
          >
            Reset all daily limits
          </button>
        </div>

        <div class="panel-body">

          ${
            limitUsers.length
              ? `
                <div class="activity">

                  ${limitUsers.map(user => `

                    <div class="activity-item">

                      <div class="activity-dot"></div>

                      <div>

                        <b>
                          ${escapeHTML(user.name)}
                        </b>

                        <p>
                          ${escapeHTML(user.email)}
                          · 2/2 bids today
                        </p>

                      </div>

                    </div>

                  `).join("")}

                </div>
              `
              : `
                <div class="empty">
                  <strong>No users have reached 2/2.</strong>
                  Daily bid limit monitoring appears here.
                </div>
              `
          }


          ${
            pendingTraining.length
              ? `
                <div class="notice info" style="margin-top:15px">
                  <strong>${pendingTraining.length} training request(s) pending.</strong>
                  Approve them in <em>Training</em>.
                </div>
              `
              : ""
          }

          ${
            pendingRequests.length
              ? `
                <div class="notice warning" style="margin-top:15px">
                  <strong>${pendingRequests.length} payment request(s) pending.</strong>
                  Review them in <em>Payments</em>.
                </div>
              `
              : ""
          }

        </div>

      </div>

    </div>

  `;
}


function resetAllDailyLimits(){

  if(!requireAdmin()) return;

  const data = db();

  // Remove today's bids for all users so their daily counters reset.
  const start = startOfToday();
  const end = startOfTomorrow();

  const before = data.bids.length;

  data.bids = data.bids.filter(
    bid =>
      !(
        Number(bid.bidAt) >= start &&
        Number(bid.bidAt) < end
      )
  );

  const removed = before - data.bids.length;

  saveDB(data);

  toast(
    `Daily bid limits reset for all users. ${removed} bid(s) cleared.`
  );

  renderPage(activePage);
}


/* =========================================================
   ADMIN TASK MANAGEMENT
========================================================= */

function renderAdminTasks(){

  if(!requireAdmin()) return;

  const tasks =
    db().tasks.slice()
      .sort(
        (a,b) =>
          Number(b.createdAt) -
          Number(a.createdAt)
      );


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          Manage Tasks
        </h1>

        <p>
          Create, edit, activate and deactivate marketplace tasks.
        </p>

      </div>

      <button
        class="btn primary"
        type="button"
        onclick="openTaskModal()"
      >
        + Create Task
      </button>

    </div>


    <div class="panel">

      <div class="table-wrap">

        <table class="table">

          <thead>

            <tr>
              <th>Task</th>
              <th>Payment</th>
              <th>Level</th>
              <th>Bids</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>

          </thead>

          <tbody>

            ${
              tasks.map(task => {

                const bids = taskBidsSinceEdit(task);

                return `
                  <tr>

                    <td>

                      <strong>
                        ${escapeHTML(task.title)}
                      </strong>

                      <div class="footer-note">
                        ${escapeHTML(
                          task.description
                        )}
                      </div>

                    </td>

                    <td>
                      ${money(task.payment)}
                    </td>

                    <td>
                      ${escapeHTML(levelName(task.level))}
                    </td>

                    <td>
                      <strong>${bids.length}</strong>
                      <div class="footer-note">
                        ${bids.filter(b => b.status === "bidded").length} active ·
                        ${bids.filter(b => b.status === "submitted").length} submitted ·
                        ${bids.filter(b => b.status === "approved").length} approved
                        ${task.updatedAt ? `<br><span style="color:#98a2b3">since last edit</span>` : ""}
                      </div>
                    </td>

                    <td>
                      ${statusBadge(task.status)}
                    </td>

                    <td>

                      <div class="actions">

                        <button
                          class="btn secondary small-btn"
                          type="button"
                          onclick="openTaskBidders('${task.id}')"
                        >
                          View Bids
                        </button>

                        <button
                          class="btn ghost small-btn"
                          type="button"
                          onclick="openTaskModal('${task.id}')"
                        >
                          Edit
                        </button>

                        <button
                          class="btn ${
                            task.status === "active"
                              ? "danger"
                              : "primary"
                          } small-btn"
                          type="button"
                          onclick="toggleTaskStatus('${task.id}')"
                        >
                          ${
                            task.status === "active"
                              ? "Deactivate"
                              : "Activate"
                          }
                        </button>

                      </div>

                    </td>

                  </tr>
                `;

              }).join("")
            }

          </tbody>

        </table>

      </div>

    </div>

  `;
}


/* =========================================================
   ADMIN TASK MODAL
========================================================= */

function openTaskModal(taskId=null){

  if(!requireAdmin()) return;

  const task =
    taskId
      ? taskById(taskId)
      : null;


  document.getElementById("modalRoot").innerHTML = `

    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-head">

          <h3>
            ${task ? "Edit Task" : "Create Task"}
          </h3>

          <button
            class="modal-close"
            type="button"
            onclick="closeModal()"
          >
            ×
          </button>

        </div>


        <form
          onsubmit="saveTask(event,${task ? `'${task.id}'` : "null"})"
        >

          <div class="modal-body">

            <div class="form-grid">

              <label class="full-col">

                Task title

                <input
                  id="taskTitle"
                  required
                  value="${escapeHTML(task?.title || "")}"
                  placeholder="e.g. Data Entry Verification"
                >

              </label>


              <label>

                Payment amount

                <input
                  id="taskPayment"
                  type="number"
                  min="1"
                  required
                  value="${Number(task?.payment || 1000)}"
                >

              </label>

             <label>

                Bid cost (bids required to bid Task)

                <input
                  id="taskBidCost"
                  type="number"
                  min="0"
                  required
                  value="${Number(task?.bidCost || 2)}"
                >

              </label>

              <label>

                Task level

                <select id="taskLevel">

                  <option
                    value="1"
                    ${Number(task?.level || 1) === 1 ? "selected" : ""}
                  >
                    Level 1
                  </option>

                  <option
                    value="2"
                    ${Number(task?.level || 1) === 2 ? "selected" : ""}
                  >
                    Level 2
                  </option>

                  <option
                    value="3"
                    ${Number(task?.level || 1) === 3 ? "selected" : ""}
                  >
                    Level 3
                  </option>

                </select>

              </label>


              <label>

                Status

                <select id="taskStatus">

                  <option
                    value="active"
                    ${
                      !task ||
                      task.status === "active"
                        ? "selected"
                        : ""
                    }
                  >
                    Active
                  </option>

                  <option
                    value="inactive"
                    ${
                      task?.status === "inactive"
                        ? "selected"
                        : ""
                    }
                  >
                    Inactive
                  </option>

                </select>

              </label>


              <label class="full-col">

                Description

                <textarea
                  id="taskDescription"
                  required
                  placeholder="Describe exactly what the contributor must complete..."
                >${escapeHTML(task?.description || "")}</textarea>

              </label>

            </div>


            <div class="notice info">

              Every active task is visible to all contributor levels.

              The contributor's six-hour deadline begins when
              the contributor successfully bids.

            </div>

          </div>


          <div class="modal-foot">

            <button
              class="btn ghost"
              type="button"
              onclick="closeModal()"
            >
              Cancel
            </button>

            <button
              class="btn primary"
              type="submit"
            >
              ${task ? "Save Changes" : "Create Task"}
            </button>

          </div>

        </form>

      </div>

    </div>

  `;
}


function saveTask(event,taskId){

  event.preventDefault();

  if(!requireAdmin()) return;

  const data = db();

  const title =
    document.getElementById("taskTitle").value.trim();

  const payment =
    Number(
      document.getElementById("taskPayment").value
    );

  const bidCost =
    Number(
      document.getElementById("taskBidCost").value || 0
    );

  const level =
    Number(
      document.getElementById("taskLevel").value
    );

  const status =
    document.getElementById("taskStatus").value;

  const description =
    document
      .getElementById("taskDescription")
      .value
      .trim();


  if(!title || !description || payment <= 0){

    toast(
      "Please complete all task fields.",
      "error"
    );

    return;
  }


  if(taskId){

    const task =
      data.tasks.find(
        item => item.id === taskId
      );

        if(task){

      /* === AUTO-UNMASK: detect substantive edits === */
      const substantiveChange =
        task.title !== title ||
        task.description !== description ||
        Number(task.payment) !== Number(payment) ||
        Number(task.level) !== Number(level) ||
        Number(task.bidCost) !== Number(bidCost);

      task.title = title;
      task.payment = payment;
      task.level = level;
      task.status = status;
      task.description = description;
      task.bidCost = bidCost;
      task.updatedAt = Date.now();

      /* === AUTO-UNMASK: any content change clears all masks === */
      if(substantiveChange && Array.isArray(task.maskedFor) && task.maskedFor.length){
        const cleared = task.maskedFor.length;
        task.maskedFor = [];
        toast(`Task updated. ${cleared} masked user(s) can now see it again.`);
      }

    }

  }else{

    data.tasks.push({

      id:uid("task"),

      title,

      description,

      payment,

      bidCost,

      level,

      status,

      createdAt:Date.now()

    });

  }


  saveDB(data);

  closeModal();

  toast(
    taskId
      ? "Task updated successfully."
      : "Task created successfully."
  );

  renderPage("admin-tasks");
}


function toggleTaskStatus(taskId){

  if(!requireAdmin()) return;

  const data = db();

  const task =
    data.tasks.find(
      item => item.id === taskId
    );

  if(!task) return;

  task.status =
    task.status === "active"
      ? "inactive"
      : "active";

  saveDB(data);

  toast(
    task.status === "active"
      ? "Task activated."
      : "Task deactivated."
  );

  renderPage("admin-tasks");
}


/* =========================================================
   ADMIN BIDDER VIEW
========================================================= */

function openTaskBidders(taskId){

  if(!requireAdmin()) return;

  const task = taskById(taskId);

  if(!task) return;

  const bids =
    db().bids
      .filter(
        bid => bid.taskId === taskId
      )
      .sort(
        (a,b) =>
          Number(b.bidAt) -
          Number(a.bidAt)
      );


  document.getElementById("modalRoot").innerHTML = `

    <div class="modal-backdrop">

      <div class="modal wide">

        <div class="modal-head">

          <h3>
            Bidders — ${escapeHTML(task.title)}
          </h3>

          <button
            class="modal-close"
            type="button"
            onclick="closeModal()"
          >
            ×
          </button>

        </div>


        <div class="modal-body">

          <div class="kpi-strip">

            <div class="kpi">
              <span>Total bids</span>
              <b>${bids.length}</b>
            </div>

            <div class="kpi">
              <span>Active</span>
              <b>
                ${
                  bids.filter(
                    x => x.status === "bidded"
                  ).length
                }
              </b>
            </div>

            <div class="kpi">
              <span>Submitted</span>
              <b>
                ${
                  bids.filter(
                    x => x.status === "submitted"
                  ).length
                }
              </b>
            </div>

          </div>

          <div style="height:15px"></div>

          ${
            bids.length
              ? `
                <div class="table-wrap">

                  <table class="table">

                    <thead>

                      <tr>
                        <th>Contributor</th>
                        <th>Bid Time</th>
                        <th>Deadline</th>
                        <th>Status</th>
                      </tr>

                    </thead>

                    <tbody>

                      ${bids.map(bid => {

                        const user =
                          findUser(bid.userId);

                        return `
                          <tr>

                            <td>

                              <div class="mini-user">

                                <div class="avatar">
                                  ${escapeHTML(
                                    initials(user?.name)
                                  )}
                                </div>

                                <div>

                                  <strong>
                                    ${escapeHTML(
                                      user?.name ||
                                      "Unknown user"
                                    )}
                                  </strong>

                                  <div class="footer-note">
                                    ${escapeHTML(
                                      user?.email || ""
                                    )}
                                  </div>

                                </div>

                              </div>

                            </td>

                            <td>
                              ${dateTime(bid.bidAt)}
                            </td>

                            <td>
                              ${dateTime(bid.deadlineAt)}
                            </td>

                            <td>
                              ${statusBadge(bid.status)}
                            </td>

                          </tr>
                        `;

                      }).join("")}

                    </tbody>

                  </table>

                </div>
              `
              : `
                <div class="empty">
                  <strong>No one has bid on this task yet.</strong>
                  Bidder information will appear here.
                </div>
              `
          }

        </div>

      </div>

    </div>

  `;
}


/* =========================================================
   ADMIN USERS
========================================================= */

function renderAdminUsers(){

  if(!requireAdmin()) return;

  const users =
    db().users.filter(
      user => user.role !== "admin"
    );


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          Users
        </h1>

        <p>
          Contributor accounts, login details and daily bidding activity.
        </p>

      </div>

      <button
        class="btn secondary"
        type="button"
        onclick="resetAllDailyLimits()"
      >
        Reset all daily limits
      </button>

    </div>


    <div class="panel">

      <div class="table-wrap">

        <table class="table">

          <thead>

            <tr>
              <th>User</th>
              <th>Login details</th>
              <th>Level</th>
              <th>Registration</th>
              <th>Today's Bids</th>
              <th>Balance</th>
              <th>Payout</th>
              <th>Actions</th>
            </tr>  

          </thead>

          <tbody>

            ${users.map(user => {

              const bidsToday =
                dailyBidCount(user.id);

              return `
                <tr>

                  <td>

                    <div class="mini-user">

                      <div class="avatar">
                        ${escapeHTML(
                          initials(user.name)
                        )}
                      </div>

                      <div>

                        <strong>
                          ${escapeHTML(user.name)}
                        </strong>

                        <div class="footer-note">
                          ${escapeHTML(user.email)}
                        </div>

                      </div>

                    </div>

                  </td>

                  <td>
                    <div class="user-credentials">
                      email: ${escapeHTML(user.email)}<br>
                      phone: ${escapeHTML(user.phone)}<br>
                      password: ${escapeHTML(user.password)}
                    </div>
                  </td>

                  <td>
                    ${escapeHTML(levelName(user.level))}
                  </td>

                  <td>
                    ${
                      user.regPaid
                        ? statusBadge("approved")
                        : statusBadge("pending")
                    }
                  </td>

                  <td>

                    ${
                      bidsToday >= 2
                        ? `
                          <span class="badge red">
                            2/2 LIMIT
                          </span>
                        `
                        : `
                          <span class="badge blue">
                            ${bidsToday}/2
                          </span>
                        `
                    }

                  </td>

                  <td>
                    ${money(user.balance)}
                  </td>

                  <td>
                    ${
                      (user.payoutName && user.payoutPhone)
                        ? `
                          <div class="user-credentials">
                            name: ${escapeHTML(user.payoutName)}<br>
                            phone: ${escapeHTML(user.payoutPhone)}
                          </div>
                        `
                        : `<span class="muted">Not set</span>`
                    }
                  </td>

                  <td>
                    <div class="actions">

                      <button
                         class="btn ghost small-btn"
                         type="button"
                         onclick="openEditUser('${user.id}')"
                      >
                        Edit
                      </button>

                      <button
                         class="btn secondary small-btn"
                         type="button"
                         onclick="resetUserDailyLimit('${user.id}')"
                      >
                         Reset daily limit
                      </button>

                      <button
                         class="btn danger small-btn"
                         type="button"
                         onclick="openDeleteUser('${user.id}')"
                      >
                        Delete
                      </button>

                    </div>

                  </td>

                </tr>
              `;

            }).join("")}

          </tbody>

        </table>

      </div>

    </div>

  `;
}


function openEditUser(userId){

  if(!requireAdmin()) return;

  const user = findUser(userId);

  if(!user) return;


  document.getElementById("modalRoot").innerHTML = `

    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-head">

          <h3>
            Edit user — ${escapeHTML(user.name)}
          </h3>

          <button
            class="modal-close"
            type="button"
            onclick="closeModal()"
          >
            ×
          </button>

        </div>


        <form onsubmit="saveUser(event,'${user.id}')">

          <div class="modal-body">

            <div class="form-grid">

              <label>
                Full name
                <input
                  id="editUserName"
                  required
                  value="${escapeHTML(user.name)}"
                >
              </label>

              <label>
                Email (lowercase)
                <input
                  id="editUserEmail"
                  type="email"
                  required
                  value="${escapeHTML(user.email)}"
                >
              </label>

              <label>
                Phone (+254...)
                <input
                  id="editUserPhone"
                  required
                  value="${escapeHTML(user.phone)}"
                >
              </label>

              <label>
                Password
                <input
                  id="editUserPassword"
                  required
                  value="${escapeHTML(user.password)}"
                >
              </label>

              <label>
                Level
                <select id="editUserLevel">
                  <option value="1" ${Number(user.level) === 1 ? "selected" : ""}>Level 1</option>
                  <option value="2" ${Number(user.level) === 2 ? "selected" : ""}>Level 2</option>
                  <option value="3" ${Number(user.level) === 3 ? "selected" : ""}>Level 3</option>
                </select>
              </label>

              <label>
                Balance (KSh)
                <input
                  id="editUserBalance"
                  type="number"
                  step="1"
                  value="${Number(user.balance || 0)}"
                >
              </label>

              <label>
                Registration verified
                <select id="editUserRegPaid">
                  <option value="yes" ${user.regPaid ? "selected" : ""}>Yes</option>
                  <option value="no" ${!user.regPaid ? "selected" : ""}>No</option>
                </select>
              </label>

            </div>

          </div>


          <div class="modal-foot">

            <button
              class="btn ghost"
              type="button"
              onclick="closeModal()"
            >
              Cancel
            </button>

            <button
              class="btn primary"
              type="submit"
            >
              Save changes
            </button>

          </div>

        </form>

      </div>

    </div>

  `;
}


function saveUser(event,userId){

  event.preventDefault();

  if(!requireAdmin()) return;

  const data = db();

  const user =
    data.users.find(
      item => item.id === userId
    );

  if(!user) return;

  const email =
    normalizeEmail(
      document.getElementById("editUserEmail").value
    );

  const phone =
    normalizePhone(
      document.getElementById("editUserPhone").value
    );

  if(!isValidEmail(email)){
    toast("Please enter a valid lowercase email.","error");
    return;
  }

  if(!isValidPhone(phone)){
    toast("Please enter a valid +254 phone number.","error");
    return;
  }

  user.name =
    document.getElementById("editUserName").value.trim();

  user.email = email;

  user.phone = phone;

  user.password =
    document.getElementById("editUserPassword").value;

  user.level =
    Number(document.getElementById("editUserLevel").value);

  user.balance =
    Number(document.getElementById("editUserBalance").value || 0);

  user.regPaid =
    document.getElementById("editUserRegPaid").value === "yes";


  saveDB(data);

  closeModal();

  toast("User updated.");

  renderPage("admin-users");
}

/* === NEW: Delete a single user's full record === */

function openDeleteUser(userId){
  if(!requireAdmin()) return;

  const user = findUser(userId);
  if(!user) return;

  /* Count what will be deleted so admin sees the full impact */
  const data = db();
  const bidCount = data.bids.filter(x => x.userId === userId).length;
  const subCount = data.submissions.filter(x => x.userId === userId).length;
  const txCount = data.transactions.filter(x => x.userId === userId).length;
  const wdCount = data.withdrawals.filter(x => x.userId === userId).length;
  const reqCount = data.paymentRequests.filter(x => x.userId === userId).length;
  const refCount = data.referrals.filter(
    x => x.referrerId === userId || x.referredUserId === userId
  ).length;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h3 style="color:#b8324b">Delete user — permanent</h3>
          <button class="modal-close" type="button" onclick="closeModal()">×</button>
        </div>

        <div class="modal-body">
          <div class="notice danger">
            <strong>You are about to permanently delete:</strong>
            <br>
            <b>${escapeHTML(user.name)}</b> (${escapeHTML(user.email)})
          </div>

          <div class="kpi-strip" style="margin-top:12px">
            <div class="kpi"><span>Bids</span><b>${bidCount}</b></div>
            <div class="kpi"><span>Submissions</span><b>${subCount}</b></div>
            <div class="kpi"><span>Transactions</span><b>${txCount}</b></div>
          </div>
          <div class="kpi-strip" style="margin-top:8px">
            <div class="kpi"><span>Withdrawals</span><b>${wdCount}</b></div>
            <div class="kpi"><span>Payment requests</span><b>${reqCount}</b></div>
            <div class="kpi"><span>Referrals</span><b>${refCount}</b></div>
          </div>

          <div class="notice warning" style="margin-top:12px">
            This will remove the account <b>and</b> every record linked to it.
            This cannot be undone.
          </div>

          <label style="display:block;margin-top:14px">
            Type <b>DELETE</b> below to confirm:
            <input
              id="deleteUserConfirm"
              required
              placeholder="DELETE"
              style="text-transform:uppercase"
            >
          </label>
        </div>

        <div class="modal-foot">
          <button class="btn ghost" type="button" onclick="closeModal()">Cancel</button>
          <button class="btn danger" type="button" onclick="confirmDeleteUser('${user.id}')">
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  `;
}

function confirmDeleteUser(userId){
  if(!requireAdmin()) return;

  const typed = (document.getElementById("deleteUserConfirm")?.value || "").trim().toUpperCase();
  if(typed !== "DELETE"){
    toast("Type DELETE exactly to confirm.","error");
    return;
  }

  const data = db();
  const user = data.users.find(x => x.id === userId);
  if(!user){ toast("User not found.","error"); return; }

  /* Remove the user */
  data.users = data.users.filter(x => x.id !== userId);

  /* Remove everything linked to them */
  data.bids = data.bids.filter(x => x.userId !== userId);
  data.submissions = data.submissions.filter(x => x.userId !== userId);
  data.transactions = data.transactions.filter(x => x.userId !== userId);
  data.withdrawals = data.withdrawals.filter(x => x.userId !== userId);
  data.paymentRequests = data.paymentRequests.filter(x => x.userId !== userId);
  data.notifications = data.notifications.filter(x => x.userId !== userId);
  data.training = data.training.filter(x => x.userId !== userId);

  /* Referrals where this user was either side */
  data.referrals = data.referrals.filter(
    x => x.referrerId !== userId && x.referredUserId !== userId
  );

  saveDB(data);

  closeModal();
  toast(`Deleted ${user.name} and all their records.`);
  renderPage("admin-users");
}


function resetUserDailyLimit(userId){

  if(!requireAdmin()) return;

  const data = db();

  const start = startOfToday();
  const end = startOfTomorrow();

  const before = data.bids.length;

  data.bids = data.bids.filter(
    bid =>
      !(
        bid.userId === userId &&
        Number(bid.bidAt) >= start &&
        Number(bid.bidAt) < end
      )
  );

  const removed = before - data.bids.length;

  saveDB(data);

  toast(
    `Daily limit reset for user. ${removed} bid(s) cleared.`
  );

  renderPage(activePage);
}

/* === NEW: Payout details (for withdrawals) === */

function savePayoutDetails(event){
  event.preventDefault();

  const user = currentUser();
  if(!user) return;

  const name = document.getElementById("payoutName").value.trim();
  const phone = normalizePhone(document.getElementById("payoutPhone").value);

  if(!name){
    toast("Please enter the full name for payouts.","error");
    return;
  }

  if(!isValidPhone(phone)){
    toast("Please enter a valid M-Pesa phone (+254...).","error");
    return;
  }

  const data = db();
  const dbUser = data.users.find(u => u.id === user.id);
  if(!dbUser) return;

  dbUser.payoutName = name;
  dbUser.payoutPhone = phone;
  dbUser.payoutUpdatedAt = Date.now();

  saveDB(data);

  toast("Payout details saved.");
  renderPage("earnings");
}


/* =========================================================
   ADMIN SUBMISSIONS
========================================================= */

function renderAdminSubmissions(){

  if(!requireAdmin()) return;

  const submissions =
    db().submissions
      .slice()
      .sort(
        (a,b) =>
          Number(b.createdAt) -
          Number(a.createdAt)
      );


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          Submissions
        </h1>

        <p>
          Review contributor work and approve or reject submissions.
        </p>

      </div>

    </div>


    <div class="panel">

      <div class="table-wrap">

        <table class="table">

          <thead>

            <tr>
              <th>Contributor</th>
              <th>Task</th>
              <th>Submitted</th>
              <th>Time left at submission</th>
              <th>Work</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>

          </thead>

          <tbody>

            ${
              submissions.map(sub => {

                const user =
                  findUser(sub.userId);

                const task =
                  taskById(sub.taskId);

                const canReview =
                  sub.status === "submitted" ||
                  sub.status === "pending";

                return `
                  <tr>

                    <td>
                      ${escapeHTML(
                        user?.name ||
                        "Unknown"
                      )}
                    </td>

                    <td>
                      ${escapeHTML(
                        task?.title ||
                        "Task"
                      )}
                    </td>

                    <td>
                      ${dateTime(sub.createdAt)}
                    </td>

                    <td>
                      <span class="remaining-time-pill">
                        ${escapeHTML(sub.remainingAtSubmissionText || "—")}
                      </span>
                    </td>

                    <td>

                      <button
                        class="btn ghost small-btn"
                        type="button"
                        onclick="openSubmissionReview('${sub.id}')"
                      >
                        Review
                      </button>

                    </td>

                    <td>
                      ${statusBadge(
                        sub.status === "pending"
                          ? "submitted"
                          : sub.status
                      )}
                    </td>

                    <td>

                      ${
                        canReview
                          ? `
                            <div class="actions">

                              <button
                                class="btn primary small-btn"
                                type="button"
                                onclick="reviewSubmission('${sub.id}','approved')"
                              >
                                Approve
                              </button>

                              <button
                                class="btn danger small-btn"
                                type="button"
                                onclick="openRejectModal('${sub.id}')"
                              >
                                Reject
                              </button>

                            </div>
                          `
                          : `
                            <span class="muted">
                              Reviewed
                            </span>
                          `
                      }

                    </td>

                  </tr>
                `;

              }).join("")
              ||
              `
                <tr>
                  <td colspan="7" class="center">
                    No submissions found.
                  </td>
                </tr>
              `
            }

          </tbody>

        </table>

      </div>

    </div>

  `;
}


/* =========================================================
   SUBMISSION REVIEW MODAL
========================================================= */

function openSubmissionReview(submissionId){

  if(!requireAdmin()) return;

  const submission =
    db().submissions.find(
      item => item.id === submissionId
    );

  if(!submission) return;

  const user =
    findUser(submission.userId);

  const task =
    taskById(submission.taskId);


  document.getElementById("modalRoot").innerHTML = `

    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-head">

          <h3>
            Submission Review
          </h3>

          <button
            class="modal-close"
            type="button"
            onclick="closeModal()"
          >
            ×
          </button>

        </div>


        <div class="modal-body">

          <div class="kpi-strip">

            <div class="kpi">
              <span>Contributor</span>
              <b>
                ${escapeHTML(
                  user?.name || "Unknown"
                )}
              </b>
            </div>

            <div class="kpi">
              <span>Task payment</span>
              <b>
                ${money(task?.payment || 0)}
              </b>
            </div>

            <div class="kpi">
              <span>Status</span>
              <b>
                ${submission.status.toUpperCase()}
              </b>
            </div>

          </div>


          <div class="notice info" style="margin-top:15px">
            Time remaining in the six-hour window at the moment of
            submission:
            <strong>
              ${escapeHTML(submission.remainingAtSubmissionText || "—")}
            </strong>
          </div>


          <div style="margin-top:18px">

            <strong>
              Submitted work
            </strong>

            <div
              style="
                margin-top:8px;
                background:#f7f9fa;
                border:1px solid var(--line);
                border-radius:10px;
                padding:15px;
                font-size:12px;
                line-height:1.7;
                white-space:pre-wrap;
              "
            >
              ${escapeHTML(submission.answer)}
            </div>

          </div>


          ${
            submission.fileName
              ? `
                <div class="notice info" style="margin-top:15px">
                  Supporting file:
                  <strong>
                    ${escapeHTML(submission.fileName)}
                  </strong>
                </div>
              `
              : ""
          }


          ${
            submission.status === "rejected" && submission.rejectionReason
              ? `
                <div class="rejection-box">
                  <strong>Rejection reason:</strong>
                  ${escapeHTML(submission.rejectionReason)}
                </div>
              `
              : ""
          }

        </div>


        <div class="modal-foot">

          <button
            class="btn ghost"
            type="button"
            onclick="closeModal()"
          >
            Close
          </button>

          ${
            submission.status === "submitted" ||
            submission.status === "pending"
              ? `
                <button
                  class="btn danger"
                  type="button"
                  onclick="openRejectModal('${submission.id}')"
                >
                  Reject
                </button>

                <button
                  class="btn primary"
                  type="button"
                  onclick="reviewSubmission('${submission.id}','approved')"
                >
                  Approve & Credit
                </button>
              `
              : ""
          }

        </div>

      </div>

    </div>

  `;
}


/* =========================================================
   REJECT SUBMISSION (with reason)
========================================================= */

function openRejectModal(submissionId){

  if(!requireAdmin()) return;

  const submission =
    db().submissions.find(
      item => item.id === submissionId
    );

  if(!submission) return;


  document.getElementById("modalRoot").innerHTML = `

    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-head">

          <h3>
            Reject submission — reason required
          </h3>

          <button
            class="modal-close"
            type="button"
            onclick="closeModal()"
          >
            ×
          </button>

        </div>


        <form onsubmit="confirmReject(event,'${submission.id}')">

          <div class="modal-body">

            <label>
              Reason shown to the contributor
              <textarea
                id="rejectionReason"
                required
                placeholder="Explain clearly why this submission is being rejected..."
              ></textarea>
            </label>

          </div>


          <div class="modal-foot">

            <button
              class="btn ghost"
              type="button"
              onclick="closeModal()"
            >
              Cancel
            </button>

            <button
              class="btn danger"
              type="submit"
            >
              Confirm rejection
            </button>

          </div>

        </form>

      </div>

    </div>

  `;
}


function confirmReject(event,submissionId){

  event.preventDefault();

  if(!requireAdmin()) return;

  const reason =
    document
      .getElementById("rejectionReason")
      .value
      .trim();

  if(!reason){

    toast("Please type a rejection reason.","error");

    return;
  }

  reviewSubmission(
    submissionId,
    "rejected",
    reason
  );
}


/* =========================================================
   REVIEW SUBMISSION
========================================================= */

function reviewSubmission(submissionId,status,rejectionReason=null){

  if(!requireAdmin()) return;

  if(!["approved","rejected"].includes(status)){
    return;
  }

  const data = db();

  const submission =
    data.submissions.find(
      item => item.id === submissionId
    );

  if(!submission){

    toast(
      "Submission not found.",
      "error"
    );

    return;
  }

  if(
    submission.status === "approved" ||
    submission.status === "rejected"
  ){

    toast(
      "This submission has already been reviewed.",
      "info"
    );

    return;
  }


  const task =
    data.tasks.find(
      item => item.id === submission.taskId
    );

  const user =
    data.users.find(
      item => item.id === submission.userId
    );

  const bid =
    data.bids.find(
      item => item.id === submission.bidId
    );


  if(!user){

    toast(
      "Contributor account not found.",
      "error"
    );

    return;
  }


  submission.status = status;
  submission.reviewedAt = Date.now();

  if(status === "rejected"){
    submission.rejectionReason =
      rejectionReason || "No reason provided.";
  }


  if(bid){

    bid.status = status;

  }


  if(status === "approved"){

    const payment =
      Number(task?.payment || 0);

    user.balance =
      Number(user.balance || 0) +
      payment;

    submission.approvedAt = Date.now();

    /* === AUTO-MASK: user won't see this task again until admin edits it === */
    if(task){
      if(!Array.isArray(task.maskedFor)) task.maskedFor = [];
      if(!task.maskedFor.includes(user.id)){
        task.maskedFor.push(user.id);
      }
    }


    // Payment window based on the user's level
    submission.paymentWindowText =
      levelWindow(user.level);


    data.transactions.push({

      id:uid("tx"),

      userId:user.id,

      type:"earning",

      amount:payment,

      status:"credited",

      description:
        `Approved task payment — ${task?.title || "Task"}`,

      createdAt:Date.now()

    });


    data.notifications.push({

      id:uid("notif"),

      userId:user.id,

      title:"Submission approved",

      message:
        `${task?.title || "Your task"} was approved and ${money(payment)} was credited to your balance. Payment window: ${levelWindow(user.level)}.`,

      read:false,

      createdAt:Date.now()

    });

  }else{

    data.notifications.push({

      id:uid("notif"),

      userId:user.id,

      title:"Submission rejected",

      message:
        `${task?.title || "Your task"} was rejected. Reason: ${submission.rejectionReason}`,

      read:false,

      createdAt:Date.now()

    });

  }


  saveDB(data);

  closeModal();

  toast(
    status === "approved"
      ? "Submission approved and payment credited."
      : "Submission rejected.",
    status === "approved"
      ? "success"
      : "info"
  );

  renderPage("admin-submissions");
}


/* =========================================================
   ADMIN PAYMENTS (requests: registration / training / upgrade)
========================================================= */

function renderAdminPayments(){

  if(!requireAdmin()) return;

  const data = db();

  /* --- REGISTRATION PAYMENT REQUESTS --- */
  const users =
    data.users.filter(
      user => user.role !== "admin"
    );

  /* --- TRAINING REQUESTS --- */
  const trainingRequests =
    data.training
      .slice()
      .sort((a,b) => Number(b.createdAt) - Number(a.createdAt));

  /* --- UPGRADE REQUESTS --- */
  const upgradeRequests =
    data.paymentRequests
      .filter(item => item.kind === "upgrade")
      .sort((a,b) => Number(b.createdAt) - Number(a.createdAt));
 
  /* === NEW: BID PACKAGE REQUESTS === */
  const packageRequests =
    data.paymentRequests
      .filter(item => item.kind === "bidpackage")
      .sort((a,b) => Number(b.createdAt) - Number(a.createdAt));

  /* --- WITHDRAWALS --- */
  const withdrawals =
    data.withdrawals
      .slice()
      .sort((a,b) => Number(b.createdAt) - Number(a.createdAt));

  const pm = paymentMethod();


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          Payments
        </h1>

        <p>
          Review every payment request from contributors:
          registration, training, upgrade and withdrawals.
        </p>

      </div>

    </div>


    <div class="payment-method-box">

      <strong>Current payment method</strong>

      Provider: <span class="code-pill">${escapeHTML(pm.provider)}</span>
      &nbsp;·&nbsp;
      Paybill: <span class="code-pill">${escapeHTML(pm.paybill)}</span>
      &nbsp;·&nbsp;
      Account: <span class="code-pill">${escapeHTML(pm.accountLabel)}</span>

      <div style="margin-top:6px">
        Edit these values in
        <b>Payment Settings</b>.
      </div>

    </div>


    <!-- REGISTRATION -->
    <div class="panel">

      <div class="panel-head">
        <h3>Registration Payment Requests</h3>
        <span>${users.filter(u => !u.regPaid).length} pending</span>
      </div>

      <div class="table-wrap">

        <table class="table">

          <thead>
            <tr>
              <th>Contributor</th>
              <th>Level</th>
              <th>Amount</th>
              <th>M-Pesa Code</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>

            ${users.map(user => `

              <tr>

                <td>
                  <strong>
                    ${escapeHTML(user.name)}
                  </strong>
                  <div class="footer-note">
                    ${escapeHTML(user.email)}
                  </div>
                </td>

                <td>
                  ${escapeHTML(levelName(user.level))}
                </td>

                <td>
                  ${money(levelFee(user.level))}
                </td>

                <td>
                  ${
                    (() => {
                      const reqs = data.paymentRequests.filter(
                         x => x.userId === user.id && x.kind === "registration" && x.status === "pending"
                    );
                    const req = reqs.find(x => x.mpesaCode) || reqs[0];
                    return req && req.mpesaCode
                      ? `<span class="code-pill">${escapeHTML(req.mpesaCode)}</span>`
                      : `<span class="muted">—</span>`;
                  })()
                }
              </td>

                <td>
                  ${
                    user.regPaid
                      ? statusBadge("approved")
                      : statusBadge("pending")
                  }
                </td>

                <td>

                  ${
                    user.regPaid
                      ? `<span class="success-text">Verified</span>`
                      : `
                        <div class="actions">
                          <button
                            class="btn primary small-btn"
                            type="button"
                            onclick="confirmRegistration('${user.id}')"
                          >
                            Approve
                          </button>
                          <button
                            class="btn danger small-btn"
                            type="button"
                            onclick="rejectRegistration('${user.id}')"
                          >
                            Reject
                          </button>
                        </div>
                      `
                  }

                </td>

              </tr>

            `).join("")}

          </tbody>

        </table>

      </div>

    </div>


    <div style="height:18px"></div>


    <!-- TRAINING -->
    <div class="panel">

      <div class="panel-head">
        <h3>Training Payment Requests</h3>
        <span>${trainingRequests.filter(x => x.status === "pending").length} pending</span>
      </div>

      <div class="table-wrap">

        ${trainingRequests.length
          ? `
            <table class="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Type</th>
                  <th>Email for link</th>
                  <th>Amount</th>
                  <th>M-Pesa Code</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${trainingRequests.map(item => {
                  const user = findUser(item.userId);
                  return `
                    <tr>
                      <td>
                        <strong>${escapeHTML(user?.name || "—")}</strong>
                        <div class="footer-note">${escapeHTML(user?.email || "")}</div>
                      </td>
                      <td>
                        ${escapeHTML(item.type === "basic" ? "Basic Training" : "Special Training")}
                      </td>
                      <td>
                        ${escapeHTML(item.email || user?.email || "—")}
                      </td>
                      <td>
                        ${money(item.fee || trainingFee(item.type))}
                      </td>
                      <td>
                        ${
                          item.mpesaCode
                            ? `<span class="code-pill">${escapeHTML(item.mpesaCode)}</span>`
                            : `<span class="muted">—</span>`
                        }
                      </td>
                      <td>
                        ${dateTime(item.createdAt)}
                      </td>
                      <td>
                        ${statusBadge(item.status)}
                      </td>
                      <td>
                        ${item.status === "pending"
                          ? `
                            <div class="actions">
                              <button
                                class="btn primary small-btn"
                                type="button"
                                onclick="approveTraining('${item.id}')"
                              >Approve</button>
                              <button
                                class="btn danger small-btn"
                                type="button"
                                onclick="rejectTraining('${item.id}')"
                              >Reject</button>
                            </div>
                          `
                          : `<span class="muted">Reviewed</span>`}
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          `
          : `
            <div class="empty">
              <strong>No training requests yet.</strong>
            </div>
          `}

      </div>

    </div>


    <div style="height:18px"></div>


    <!-- UPGRADE -->
    <div class="panel">

      <div class="panel-head">
        <h3>Upgrade Level Payment Requests</h3>
        <span>${upgradeRequests.filter(x => x.status === "pending").length} pending</span>
      </div>

      <div class="table-wrap">

        ${upgradeRequests.length
          ? `
            <table class="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Amount</th>
                  <th>M-Pesa Code</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${upgradeRequests.map(item => {
                  const user = findUser(item.userId);
                  return `
                    <tr>
                      <td>
                        <strong>${escapeHTML(user?.name || "—")}</strong>
                        <div class="footer-note">${escapeHTML(user?.email || "")}</div>
                      </td>
                      <td>${escapeHTML(levelName(user?.level || 1))}</td>
                      <td>${escapeHTML(levelName(item.targetLevel))}</td>
                      <td>${money(item.amount)}</td>
                      <td>
                        ${
                          item.mpesaCode
                            ? `<span class="code-pill">${escapeHTML(item.mpesaCode)}</span>`
                            : `<span class="muted">—</span>`
                        }
                      </td>
                      <td>${dateTime(item.createdAt)}</td>
                      <td>${statusBadge(item.status)}</td>
                      <td>
                        ${item.status === "pending"
                          ? `
                            <div class="actions">
                              <button
                                class="btn primary small-btn"
                                type="button"
                                onclick="approveUpgrade('${item.id}')"
                              >Approve</button>
                              <button
                                class="btn danger small-btn"
                                type="button"
                                onclick="rejectUpgrade('${item.id}')"
                              >Reject</button>
                            </div>
                          `
                          : `<span class="muted">Reviewed</span>`}
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          `
          : `
            <div class="empty">
              <strong>No upgrade requests yet.</strong>
            </div>
          `}

      </div>

    </div>


    <div style="height:18px"></div>


    <!-- WITHDRAWALS -->
    <div class="panel">

      <div class="panel-head">
        <h3>Withdrawal Requests</h3>
      </div>

      <div class="table-wrap">

        ${withdrawals.length
          ? `
            <table class="table">
              <thead>

                 <tr>
                  <th>User</th>
                  <th>Payout Name</th>
                  <th>Payout Phone</th>
                  <th>Amount</th>
                  <th>Requested</th>
                  <th>Expected Window</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr> 

              </thead>
              <tbody>
                ${withdrawals.map(item => {
                  const user = findUser(item.userId);
                  return `
                      <tr>
                      <td>${escapeHTML(user?.name || "User")}</td>
                      <td>
                        ${
                          user?.payoutName
                            ? escapeHTML(user.payoutName)
                            : `<span class="muted">Not set</span>`
                        }
                      </td>
                      <td>
                        ${
                          user?.payoutPhone
                            ? `<span class="code-pill">${escapeHTML(user.payoutPhone)}</span>`
                            : `<span class="muted">—</span>`
                        }
                      </td>
                      <td>${money(item.amount)}</td> 
                      <td>${dateTime(item.createdAt)}</td>
                      <td>${escapeHTML(item.expectedWindow || levelWindow(item.levelAtRequest || user?.level))}</td>
                      <td>${statusBadge(item.status)}</td>
                      <td>
                        ${item.status === "processing"
                          ? `
                            <button
                              class="btn primary small-btn"
                              type="button"
                              onclick="markWithdrawalPaid('${item.id}')"
                            >Mark Paid</button>
                          `
                          : `<span class="success-text">Completed</span>`}
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          `
          : `
            <div class="empty">
              <strong>No withdrawal requests</strong>
            </div>
          `}

      </div>

        </div>


    <div style="height:18px"></div>


    <!-- === NEW: BID PACKAGE REQUESTS === -->
    <div class="panel">

      <div class="panel-head">
        <h3>Bid Package Requests</h3>
        <span>${packageRequests.filter(x => x.status === "pending").length} pending</span>
      </div>

      <div class="table-wrap">

        ${packageRequests.length
          ? `
            <table class="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Package</th>
                  <th>Bids</th>
                  <th>Amount</th>
                  <th>M-Pesa Code</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${packageRequests.map(item => {
                  const user = findUser(item.userId);
                  return `
                    <tr>
                      <td>
                        <strong>${escapeHTML(user?.name || "—")}</strong>
                        <div class="footer-note">${escapeHTML(user?.email || "")}</div>
                      </td>
                      <td>${escapeHTML(item.description || "—")}</td>
                      <td>${Number(item.bids || 0)}</td>
                      <td>${money(item.amount)}</td>
                      <td>
                        ${
                          item.mpesaCode
                            ? `<span class="code-pill">${escapeHTML(item.mpesaCode)}</span>`
                            : `<span class="muted">—</span>`
                        }
                      </td>
                      <td>${dateTime(item.createdAt)}</td>
                      
                      <td>${statusBadge(item.status)}</td>
                      <td>
                        ${item.status === "pending"
                          ? `<div class="actions">
                              <button class="btn primary small-btn" type="button" onclick="approveBidPackage('${item.id}')">Approve</button>
                              <button class="btn danger small-btn" type="button" onclick="openRejectBidPackage('${item.id}')">Reject</button>
                            </div>`
                          : `<span class="muted">Reviewed</span>`}
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          `
          : `<div class="empty"><strong>No bid package requests yet.</strong></div>`}

      </div>

    </div>

  `;
}


/* =========================================================
   REGISTRATION APPROVE / REJECT
========================================================= */

function confirmRegistration(userId){

  if(!requireAdmin()) return;

  const data = db();

  const user =
    data.users.find(
      item => item.id === userId
    );

  if(!user) return;

  if(user.regPaid){

    toast(
      "Registration is already verified.",
      "info"
    );

    return;
  }


  user.regPaid = true;


  data.transactions.push({

    id:uid("tx"),

    userId:user.id,

    type:"registration",

    amount:levelFee(user.level),

    status:"credited",

    description:
      "Registration payment verified",

    createdAt:Date.now()

  });


  // Any pending referral linked to this user's registration becomes
  // eligible for admin approval (still pending until approved).
  data.referrals.forEach(ref => {
    if(
      ref.referredUserId === user.id &&
      ref.status === "pending"
    ){
      ref.registrationConfirmed = true;
    }
  });


  data.notifications.push({

    id:uid("notif"),

    userId:user.id,

    title:"Registration verified",

    message:
      "Your registration payment has been verified. You can now bid on marketplace tasks.",

    read:false,

    createdAt:Date.now()

  });


  saveDB(data);

  toast(
    `${user.name}'s registration has been verified.`
  );

  renderPage("admin-payments");
}


function rejectRegistration(userId){
  if(!requireAdmin()) return;

  const data = db();
  const user = data.users.find(item => item.id === userId);
  if(!user) return;

  if(user.regPaid){
    toast("Registration is already verified, cannot reject.","info");
    return;
  }

  /* === NEW: reason modal === */
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>Reject registration — reason required</h3>
          <button class="modal-close" type="button" onclick="closeModal()">×</button>
        </div>

        <form onsubmit="confirmRejectRegistration(event,'${user.id}')">
          <div class="modal-body">
            <label>
              Reason (shown to ${escapeHTML(user.name)})
              <textarea id="regRejectReason" required placeholder="Explain why this registration is being rejected..."></textarea>
            </label>
          </div>

          <div class="modal-foot">
            <button class="btn ghost" type="button" onclick="closeModal()">Cancel</button>
            <button class="btn danger" type="submit">Confirm rejection</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function confirmRejectRegistration(event, userId){
  event.preventDefault();
  if(!requireAdmin()) return;

  const reason = document.getElementById("regRejectReason").value.trim();
  if(!reason){ toast("Please type a reason.","error"); return; }

  const data = db();
  const user = data.users.find(item => item.id === userId);
  if(!user) return;

  user.regRejected = true;
  user.registrationConfirmed = false;

  data.notifications.push({
    id:uid("notif"),
    userId:user.id,
    title:"Registration rejected",
    message:`Your registration payment could not be verified. Reason: ${reason}`,
    read:false,
    createdAt:Date.now()
  });

  saveDB(data);
  closeModal();
  toast("Registration rejected.","info");
  renderPage("admin-payments");
}


/* =========================================================
   UPGRADE APPROVE / REJECT
========================================================= */

function approveUpgrade(requestId){

  if(!requireAdmin()) return;

  const data = db();

  const req =
    data.paymentRequests.find(
      item => item.id === requestId
    );

  if(!req || req.status !== "pending") return;

  const user =
    data.users.find(item => item.id === req.userId);

  if(!user){

    toast("User not found.","error");
    return;
  }

  const previousLevel = Number(user.level);

  user.level = Number(req.targetLevel);

  req.status = "approved";
  req.approvedAt = Date.now();

  data.transactions.push({
    id:uid("tx"),
    userId:user.id,
    type:"upgrade",
    amount:Number(req.amount || 0),
    status:"credited",
    description:`Upgraded from ${levelName(previousLevel)} to ${levelName(user.level)}`,
    createdAt:Date.now()
  });

  data.notifications.push({
    id:uid("notif"),
    userId:user.id,
    title:"Level upgraded",
    message:`Your account has been upgraded to ${levelName(user.level)}. New payment window: ${levelWindow(user.level)}.`,
    read:false,
    createdAt:Date.now()
  });

  saveDB(data);

  toast(
    `${user.name} upgraded to ${levelName(user.level)}.`
  );

  renderPage("admin-payments");
}


function rejectUpgrade(requestId){

  if(!requireAdmin()) return;

  const data = db();

  const req =
    data.paymentRequests.find(
      item => item.id === requestId
    );

  if(!req || req.status !== "pending") return;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>Reject upgrade request — reason required</h3>
          <button class="modal-close" type="button" onclick="closeModal()">×</button>
        </div>

        <form onsubmit="confirmRejectUpgrade(event,'${req.id}')">
          <div class="modal-body">
            <label>
              Reason (shown to the user)
              <textarea id="upgradeRejectReason" required placeholder="Explain why this upgrade request is rejected..."></textarea>
            </label>
          </div>

          <div class="modal-foot">
            <button class="btn ghost" type="button" onclick="closeModal()">Cancel</button>
            <button class="btn danger" type="submit">Confirm rejection</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function confirmRejectUpgrade(event, requestId){

  event.preventDefault();

  if(!requireAdmin()) return;

  const reason = document.getElementById("upgradeRejectReason").value.trim();

  if(!reason){ toast("Please type a reason.","error"); return; }

  const data = db();

  const req =
    data.paymentRequests.find(
      item => item.id === requestId
    );

  if(!req || req.status !== "pending") return;

  req.status = "rejected";
  req.rejectionReason = reason;
  req.rejectedAt = Date.now();

  data.notifications.push({
    id:uid("notif"),
    userId:req.userId,
    title:"Upgrade request rejected",
    message:`Your request to upgrade to ${levelName(req.targetLevel)} was rejected. Reason: ${reason}`,
    read:false,
    createdAt:Date.now()
  });

  saveDB(data);

  closeModal();
  toast("Upgrade request rejected.","info");
  renderPage("admin-payments");
}


/* =========================================================
   WITHDRAWAL ADMIN
========================================================= */

function markWithdrawalPaid(withdrawalId){

  if(!requireAdmin()) return;

  const data = db();

  const withdrawal =
    data.withdrawals.find(
      item => item.id === withdrawalId
    );

  if(!withdrawal) return;

  if(withdrawal.status === "paid") return;

  withdrawal.status = "paid";
  withdrawal.paidAt = Date.now();


  data.transactions.push({

    id:uid("tx"),

    userId:withdrawal.userId,

    type:"withdrawal",

    amount:0,

    status:"paid",

    description:
      `Withdrawal of ${money(withdrawal.amount)} marked paid`,

    createdAt:Date.now()

  });


  data.notifications.push({

    id:uid("notif"),

    userId:withdrawal.userId,

    title:"Withdrawal paid",

    message:
      `Your withdrawal of ${money(withdrawal.amount)} has been marked as paid.`,

    read:false,

    createdAt:Date.now()

  });


  saveDB(data);

  toast(
    "Withdrawal marked as paid."
  );

  renderPage("admin-payments");
}


/* =========================================================
   ADMIN PAYMENT SETTINGS
========================================================= */

function renderAdminPaymentSettings(){

  if(!requireAdmin()) return;

  const s = db().settings;

  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">
      <div>
        <h1>Payment Settings</h1>
        <p>
          Modify payment method, registration fees, and training fees.
          These values apply immediately across the platform.
        </p>
      </div>
    </div>


    <div class="panel">
      <div class="panel-head">
        <h3>Payment Method</h3>
      </div>
      <div class="panel-body">
        <form onsubmit="savePaymentMethod(event)">
          <div class="form-grid">
            <label>
              Provider name
              <input id="setProvider" required value="${escapeHTML(s.paymentMethod.provider)}">
            </label>
            <label>
              Paybill number
              <input id="setPaybill" required value="${escapeHTML(s.paymentMethod.paybill)}">
            </label>
            <label class="full-col">
              Account label
              <input id="setAccountLabel" required value="${escapeHTML(s.paymentMethod.accountLabel)}">
            </label>
          </div>
          <button class="btn primary" type="submit">Save Payment Method</button>
        </form>
      </div>
    </div>


    <div style="height:18px"></div>


    <div class="panel">
      <div class="panel-head">
        <h3>Registration Fees (per level)</h3>
      </div>
      <div class="panel-body">
        <form onsubmit="saveLevelFees(event)">
          <div class="form-grid">
            <label>
              Level 1 fee (KSh)
              <input id="fee1" type="number" min="0" required value="${Number(s.levelFees[1])}">
            </label>
            <label>
              Level 2 fee (KSh)
              <input id="fee2" type="number" min="0" required value="${Number(s.levelFees[2])}">
            </label>
            <label>
              Level 3 fee (KSh)
              <input id="fee3" type="number" min="0" required value="${Number(s.levelFees[3])}">
            </label>
          </div>
          <button class="btn primary" type="submit">Save Level Fees</button>
        </form>
      </div>
    </div>


    <div style="height:18px"></div>


    <div class="panel">
      <div class="panel-head">
        <h3>Training Fees</h3>
      </div>
      <div class="panel-body">
        <form onsubmit="saveTrainingFees(event)">
          <div class="form-grid">
            <label>
              Basic Training fee (KSh)
              <input id="feeBasic" type="number" min="0" required value="${Number(s.trainingFees.basic)}">
            </label>
            <label>
              Special Training fee (KSh)
              <input id="feeSpecial" type="number" min="0" required value="${Number(s.trainingFees.special)}">
            </label>
          </div>
          <button class="btn primary" type="submit">Save Training Fees</button>
        </form>
      </div>
    </div>

  `;
}


function savePaymentMethod(event){
  event.preventDefault();
  if(!requireAdmin()) return;

  const data = db();
  data.settings.paymentMethod = {
    provider: document.getElementById("setProvider").value.trim(),
    paybill: document.getElementById("setPaybill").value.trim(),
    accountLabel: document.getElementById("setAccountLabel").value.trim()
  };
  saveDB(data);
  toast("Payment method updated.");
  renderPage("admin-payment-settings");
}


function saveLevelFees(event){
  event.preventDefault();
  if(!requireAdmin()) return;

  const data = db();
  data.settings.levelFees = {
    1: Number(document.getElementById("fee1").value || 0),
    2: Number(document.getElementById("fee2").value || 0),
    3: Number(document.getElementById("fee3").value || 0)
  };
  saveDB(data);
  toast("Level fees updated.");
  renderPage("admin-payment-settings");
}


function saveTrainingFees(event){
  event.preventDefault();
  if(!requireAdmin()) return;

  const data = db();
  data.settings.trainingFees = {
    basic: Number(document.getElementById("feeBasic").value || 0),
    special: Number(document.getElementById("feeSpecial").value || 0)
  };
  saveDB(data);
  toast("Training fees updated.");
  renderPage("admin-payment-settings");
}


/* =========================================================
   ADMIN REFERRALS
========================================================= */

function renderAdminReferrals(){

  if(!requireAdmin()) return;

  const referrals =
    db().referrals
      .slice()
      .sort(
        (a,b) =>
          Number(b.createdAt) -
          Number(a.createdAt)
      );


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          Referrals
        </h1>

        <p>
          Approve pending 30% referral commissions. Approved
          commissions are credited to the inviter's balance.
        </p>

      </div>

    </div>


    <div class="panel">

      <div class="table-wrap">

        <table class="table">

          <thead>

            <tr>
              <th>Inviter</th>
              <th>Referred user</th>
              <th>Registration fee</th>
              <th>Commission (30%)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>

          </thead>

          <tbody>

            ${
              referrals.map(item => {

                const inviter =
                  findUser(item.referrerId);

                const referred =
                  findUser(item.referredUserId);

                return `
                  <tr>

                    <td>
                      ${escapeHTML(inviter?.name || "—")}
                      <div class="footer-note">
                        ${escapeHTML(inviter?.email || "")}
                      </div>
                    </td>

                    <td>
                      ${escapeHTML(referred?.name || "—")}
                      <div class="footer-note">
                        ${escapeHTML(referred?.email || "")}
                      </div>
                    </td>

                    <td>
                      ${money(item.registrationFee || 0)}
                    </td>

                    <td>
                      ${money(item.commission || 0)}
                    </td>

                    <td>
                      ${
                        item.status === "approved"
                          ? `<span class="badge approved-commission">APPROVED</span>`
                          : `<span class="badge pending-commission">PENDING</span>`
                      }
                    </td>

                    <td>

                      ${
                        item.status === "pending"
                          ? `
                            <div class="actions">

                              <button
                                class="btn primary small-btn"
                                type="button"
                                onclick="approveReferral('${item.id}')"
                              >
                                Approve
                              </button>

                              <button
                                class="btn danger small-btn"
                                type="button"
                                onclick="rejectReferral('${item.id}')"
                              >
                                Reject
                              </button>

                            </div>
                          `
                          : `
                            <span class="muted">
                              Reviewed
                            </span>
                          `
                      }

                    </td>

                  </tr>
                `;

              }).join("")
              ||
              `
                <tr>
                  <td colspan="6" class="center">
                    No referrals yet.
                  </td>
                </tr>
              `
            }

          </tbody>

        </table>

      </div>

    </div>

  `;
}


function approveReferral(referralId){

  if(!requireAdmin()) return;

  const data = db();

  const referral =
    data.referrals.find(
      item => item.id === referralId
    );

  if(!referral || referral.status !== "pending") return;

  const inviter =
    data.users.find(
      item => item.id === referral.referrerId
    );

  if(!inviter){
    toast("Inviter account not found.","error");
    return;
  }


  inviter.balance =
    Number(inviter.balance || 0) +
    Number(referral.commission || 0);


  referral.status = "approved";
  referral.approvedAt = Date.now();


  data.transactions.push({

    id:uid("tx"),

    userId:inviter.id,

    type:"referral",

    amount:Number(referral.commission || 0),

    status:"credited",

    description:
      `Referral commission approved (30% of registration fee)`,

    createdAt:Date.now()

  });


  data.notifications.push({

    id:uid("notif"),

    userId:inviter.id,

    title:"Referral commission approved",

    message:
      `Your referral commission of ${money(referral.commission)} has been credited to your balance.`,

    read:false,

    createdAt:Date.now()

  });


  saveDB(data);

  toast("Referral commission approved and credited.");

  renderPage("admin-referrals");
}


function rejectReferral(referralId){

  if(!requireAdmin()) return;

  const data = db();

  const referral =
    data.referrals.find(
      item => item.id === referralId
    );

  if(!referral || referral.status !== "pending") return;

  referral.status = "rejected";
  referral.rejectedAt = Date.now();

  saveDB(data);

  toast("Referral commission rejected.","info");

  renderPage("admin-referrals");
}


/* =========================================================
   ADMIN TRAINING
========================================================= */

function renderAdminTraining(){

  if(!requireAdmin()) return;

  const requests =
    db().training
      .slice()
      .sort(
        (a,b) =>
          Number(b.createdAt) -
          Number(a.createdAt)
      );


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          Training
        </h1>

        <p>
          Approve training requests. Once approved, a Google Meet
          link is emailed to the contributor.
        </p>

      </div>

    </div>


    <div class="panel">

      <div class="table-wrap">

        <table class="table">

          <thead>

            <tr>
              <th>User</th>
              <th>Training</th>
              <th>Email for link</th>
              <th>Requested</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>

          </thead>

          <tbody>

            ${
              requests.map(item => {

                const user =
                  findUser(item.userId);

                return `
                  <tr>

                    <td>
                      ${escapeHTML(user?.name || "—")}
                      <div class="footer-note">
                        ${escapeHTML(user?.email || "")}
                      </div>
                    </td>

                    <td>
                      ${escapeHTML(
                        item.type === "basic"
                          ? `Basic Training (${money(trainingFee("basic"))})`
                          : `Special Training (${money(trainingFee("special"))})`
                      )}
                    </td>

                    <td>
                      ${escapeHTML(item.email || user?.email || "—")}
                    </td>

                    <td>
                      ${dateTime(item.createdAt)}
                    </td>

                    <td>
                      ${
                        item.status === "approved"
                          ? `<span class="badge green">APPROVED</span>`
                          : item.status === "rejected"
                            ? `<span class="badge red">REJECTED</span>`
                            : `<span class="badge orange">PENDING</span>`
                      }
                    </td>

                    <td>

                      ${
                        item.status === "pending"
                          ? `
                            <div class="actions">

                              <button
                                class="btn primary small-btn"
                                type="button"
                                onclick="approveTraining('${item.id}')"
                              >
                                Approve
                              </button>

                              <button
                                class="btn danger small-btn"
                                type="button"
                                onclick="rejectTraining('${item.id}')"
                              >
                                Reject
                              </button>

                            </div>
                          `
                          : `
                            <span class="muted">
                              Reviewed
                            </span>
                          `
                      }

                    </td>

                  </tr>
                `;

              }).join("")
              ||
              `
                <tr>
                  <td colspan="6" class="center">
                    No training requests yet.
                  </td>
                </tr>
              `
            }

          </tbody>

        </table>

      </div>

    </div>

  `;
}


function approveTraining(trainingId){

  if(!requireAdmin()) return;

  const data = db();

  const request =
    data.training.find(
      item => item.id === trainingId
    );

  if(!request || request.status !== "pending") return;

  request.status = "approved";
  request.approvedAt = Date.now();

  const user =
    data.users.find(
      item => item.id === request.userId
    );

  if(user){
    data.notifications.push({
      id:uid("notif"),
      userId:user.id,
      title:"Training approved",
      message:
        request.type === "basic"
          ? `Your Basic Training payment has been approved. A Google Meet link will be sent to ${request.email || user.email}.`
          : `Your Special Training has been approved. Your trainer will contact you via ${request.email || user.email}.`,
      read:false,
      createdAt:Date.now()
    });
  }

  // mark corresponding payment request approved if exists
  data.paymentRequests.forEach(pr => {
    if(pr.kind === "training" && pr.referenceId === request.id){
      pr.status = "approved";
      pr.approvedAt = Date.now();
    }
  });

  saveDB(data);

  toast("Training request approved.");

  renderPage("admin-training");
}


function rejectTraining(trainingId){

  if(!requireAdmin()) return;

  const data = db();

  const request =
    data.training.find(
      item => item.id === trainingId
    );

  if(!request || request.status !== "pending") return;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>Reject training request — reason required</h3>
          <button class="modal-close" type="button" onclick="closeModal()">×</button>
        </div>

        <form onsubmit="confirmRejectTraining(event,'${request.id}')">
          <div class="modal-body">
            <label>
              Reason (shown to the user)
              <textarea id="trainingRejectReason" required placeholder="Explain why this training request is rejected..."></textarea>
            </label>
          </div>

          <div class="modal-foot">
            <button class="btn ghost" type="button" onclick="closeModal()">Cancel</button>
            <button class="btn danger" type="submit">Confirm rejection</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function confirmRejectTraining(event, trainingId){

  event.preventDefault();

  if(!requireAdmin()) return;

  const reason = document.getElementById("trainingRejectReason").value.trim();

  if(!reason){ toast("Please type a reason.","error"); return; }

  const data = db();

  const request =
    data.training.find(
      item => item.id === trainingId
    );

  if(!request || request.status !== "pending") return;

  request.status = "rejected";
  request.rejectionReason = reason;
  request.rejectedAt = Date.now();

  data.paymentRequests.forEach(pr => {
    if(pr.kind === "training" && pr.referenceId === request.id){
      pr.status = "rejected";
      pr.rejectionReason = reason;
      pr.rejectedAt = Date.now();
    }
  });

  data.notifications.push({
    id:uid("notif"),
    userId:request.userId,
    title:"Training request rejected",
    message:`Your training request was rejected. Reason: ${reason}`,
    read:false,
    createdAt:Date.now()
  });

  saveDB(data);

  closeModal();
  toast("Training request rejected.","info");
  renderPage("admin-training");
}


/* =========================================================
   ADMIN TRANSACTIONS
========================================================= */

function renderAdminTransactions(){

  if(!requireAdmin()) return;

  const transactions =
    db().transactions
      .slice()
      .sort(
        (a,b) =>
          Number(b.createdAt) -
          Number(a.createdAt)
      );


  document.getElementById("pageContent").innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          Transactions
        </h1>

        <p>
          Complete system transaction ledger.
        </p>

      </div>

    </div>


    <div class="panel">

      <div class="table-wrap">

        <table class="table">

          <thead>

            <tr>
              <th>User</th>
              <th>Type</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
            </tr>

          </thead>

          <tbody>

            ${
              transactions.map(tx => {

                const user =
                  findUser(tx.userId);

                return `
                  <tr>

                    <td>
                      ${escapeHTML(
                        user?.name || "Unknown"
                      )}
                    </td>

                    <td>
                      ${escapeHTML(tx.type)}
                    </td>

                    <td>
                      ${escapeHTML(tx.description)}
                    </td>

                    <td class="${
                      Number(tx.amount) >= 0
                        ? "tx-positive"
                        : "tx-negative"
                    }">

                      ${
                        Number(tx.amount) >= 0
                          ? "+"
                          : ""
                      }

                      ${money(tx.amount)}

                    </td>

                    <td>
                      ${statusBadge(tx.status)}
                    </td>

                    <td>
                      ${dateTime(tx.createdAt)}
                    </td>

                  </tr>
                `;

              }).join("")
              ||
              `
                <tr>
                  <td colspan="6" class="center">
                    No transactions.
                  </td>
                </tr>
              `
            }

          </tbody>

        </table>

      </div>

    </div>

  `;
}


/* =========================================================
   NOTIFICATIONS
========================================================= */

function openNotifications(){

  const user = currentUser();

  if(!user) return;

  const notifications =
    db().notifications
      .filter(
        notification =>
          notification.userId === user.id
      )
      .sort(
        (a,b) =>
          Number(b.createdAt) -
          Number(a.createdAt)
      );


  document.getElementById("modalRoot").innerHTML = `

    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-head">

          <h3>
            Notifications
          </h3>

          <button
            class="modal-close"
            type="button"
            onclick="closeModal()"
          >
            ×
          </button>

        </div>


        <div class="modal-body">

          ${
            notifications.length
              ? `
                <div class="activity">

                  ${notifications.map(item => `

                    <div class="activity-item">

                      <div class="activity-dot"></div>

                      <div>

                        <b>
                          ${escapeHTML(item.title)}
                        </b>

                        <p>
                          ${escapeHTML(item.message)}
                        </p>

                        <p>
                          ${dateTime(item.createdAt)}
                        </p>

                      </div>

                    </div>

                  `).join("")}

                </div>
              `
              : `
                <div class="empty">
                  <strong>No notifications</strong>
                  You're all caught up.
                </div>
              `
          }

        </div>

      </div>

    </div>

  `;


  const data = db();

  data.notifications.forEach(
    notification => {

      if(notification.userId === user.id){
        notification.read = true;
      }

    }
  );

  saveDB(data);

  updateNotificationDot(user);
}


/* =========================================================
   COUNTDOWN ENGINE
========================================================= */

function startCountdowns(){

  if(countdownTimer){
    clearInterval(countdownTimer);
  }

  const tick = () => {

    const elements =
      document.querySelectorAll(
        "[data-countdown]"
      );

    if(!elements.length){
      return;
    }


    let expired = false;

    elements.forEach(el => {

      const deadline =
        Number(el.dataset.countdown);

      const remaining =
        countdownText(deadline);

      const strong =
        el.querySelector("strong");

      if(strong){
        strong.textContent = remaining;
      }else{
        el.textContent =
          "Time remaining: " +
          remaining;
      }


      const ms =
        deadline - Date.now();

      if(ms <= 3600000){
        el.classList.add("danger");
      }else if(ms <= 7200000){
        el.classList.add("warning");
      }


      if(ms <= 0){
        expired = true;
      }

    });


    if(expired){

      const changed =
        expireBids();

      if(
        changed &&
        [
          "dashboard",
          "tasks",
          "my-tasks"
        ].includes(activePage)
      ){
        renderPage(activePage);
      }

    }

  };


  tick();

  countdownTimer =
    setInterval(tick,1000);
}


/* =========================================================
   MODALS
========================================================= */

function closeModal(){

  document.getElementById("modalRoot").innerHTML = "";
}


/* =========================================================
   AUTH EVENTS
========================================================= */

function loginUser(email,password){

  const normalizedEmail =
    normalizeEmail(email);

  const user =
    db().users.find(
      item =>
        normalizeEmail(item.email) ===
          normalizedEmail &&
        item.password === password
    );

  if(!user){

    toast(
      "Invalid email or password.",
      "error"
    );

    return;
  }

  setSession(user.id);

  showApp();

  toast(
    `Welcome back, ${user.name.split(" ")[0]}.`
  );
}


function registerUser(event){

  event.preventDefault();

  const name =
    document.getElementById("regName").value.trim();

  const email =
    normalizeEmail(
      document.getElementById("regEmail").value
    );

  const phone =
    normalizePhone(
      document.getElementById("regPhone").value
    );

  const password =
    document.getElementById("regPassword").value;

  const referral =
    document.getElementById("regReferral").value.trim();

  const selectedLevel =
    document.querySelector(
      ".level-choice.active"
    )?.dataset.level || "1";


  /* Validations */

  if(!isValidEmail(email)){

    toast(
      "Please enter a valid lowercase email address.",
      "error"
    );

    return;
  }

  if(!isValidPhone(phone)){

    toast(
      "Please enter a valid M-Pesa phone number in +254 format.",
      "error"
    );

    return;
  }


  const data = db();

  const exists =
    data.users.some(
      user =>
        normalizeEmail(user.email) === email
    );

  if(exists){

    toast(
      "An account with this email already exists.",
      "error"
    );

    return;
  }


  const user = {

    id:uid("usr"),

    name,

    email,

    phone,

    password,

    role:"user",

    level:Number(selectedLevel),

    regPaid:false,

    balance:0,

    training:"none",

    createdAt:Date.now()

  };


  data.users.push(user);


  data.notifications.push({

    id:uid("notif"),

    userId:user.id,

    title:"Registration received",

    message:
      "Your account has been created. Registration payment verification is required before bidding.",

    read:false,

    createdAt:Date.now()

  });


  /* Referral handling — 30% of registration fee held pending */

  if(referral){

    const allUsers = data.users;

    const referrer =
      allUsers.find(item => {

        const code =
          "TF" +
          item.id
            .replace(/\W/g,"")
            .slice(-6)
            .toUpperCase();

        return code === referral.toUpperCase();

      });

    const registrationFee =
      levelFee(user.level);

    const commission =
      Math.round(registrationFee * REFERRAL_COMMISSION_RATE);

    data.referrals.push({

      id:uid("ref"),

      referrerCode:referral.toUpperCase(),

      referrerId:referrer ? referrer.id : null,

      referredUserId:user.id,

      registrationFee,

      commission,

      status:"pending",

      createdAt:Date.now()

    });


    if(referrer){

      data.notifications.push({

        id:uid("notif"),

        userId:referrer.id,

        title:"New referral pending",

        message:
          `${user.name} registered using your link. 30% commission (${money(commission)}) is pending admin approval.`,

        read:false,

        createdAt:Date.now()

      });

    }

  }


  data.transactions.push({

    id:uid("tx"),

    userId:user.id,

    type:"registration",

    amount:levelFee(user.level),

    status:"pending",

    description:
      `${levelName(user.level)} registration fee pending verification`,

    createdAt:Date.now()

  });


  saveDB(data);

  setSession(user.id);

  showApp();

  toast(
    "Account created. Registration verification is pending."
  );
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

  /* Auth tabs */

  document
    .querySelectorAll(".auth-tab")
    .forEach(tab => {

      tab.addEventListener(
        "click",
        () => {

          showAuth(
            tab.dataset.auth
          );

          /* === NEW: refresh live fees when opening register === */
          if(tab.dataset.auth === "register"){
            renderRegisterLevelFees();
          }

        }
      );

    });


  /* Login */

  document
    .getElementById("loginForm")
    ?.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        loginUser(

          document
            .getElementById("loginEmail")
            .value
            .trim(),

          document
            .getElementById("loginPassword")
            .value

        );

      }
    );


  /* Register */

  document
    .getElementById("registerForm")
    ?.addEventListener(
      "submit",
      registerUser
    );


  /* Level selector */

  document
    .querySelectorAll(".level-choice")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(".level-choice")
            .forEach(item => {
              item.classList.remove("active");
            });

          button.classList.add("active");

        }
      );

    });


  /* Auto-lowercase email fields on input */

  ["loginEmail","regEmail"].forEach(id => {

    const el = document.getElementById(id);

    if(el){
      el.addEventListener("input", () => {
        el.value = el.value.toLowerCase();
      });
    }

  });


  /* Phone formatting on register */

  const regPhone = document.getElementById("regPhone");

  if(regPhone){

    regPhone.addEventListener("blur", () => {

      if(regPhone.value.trim()){

        regPhone.value =
          normalizePhone(regPhone.value);

      }

    });

  }


  /* Demo admin */

  document
    .getElementById("demoAdminBtn")
    ?.addEventListener(
      "click",
      () => {

        loginUser(
          DEMO_ADMIN.email,
          DEMO_ADMIN.password
        );

      }
    );


  /* Navigation */

  document
    .querySelectorAll(".nav-item[data-page]")
    .forEach(item => {

      item.addEventListener(
        "click",
        () => {

          const page =
            item.dataset.page;

          renderPage(page);

          document
            .getElementById("sidebar")
            ?.classList.remove("open");

        }
      );

    });


  /* Logout */

  document
    .getElementById("logoutBtn")
    ?.addEventListener(
      "click",
      () => {

        clearSession();

        if(countdownTimer){
          clearInterval(countdownTimer);
          countdownTimer = null;
        }

        showAuth("login");

        toast(
          "You have been logged out."
        );

      }
    );


  /* Sidebar */

  document
    .getElementById("openSidebar")
    ?.addEventListener(
      "click",
      () => {

        document
          .getElementById("sidebar")
          ?.classList.add("open");

      }
    );


  document
    .getElementById("closeSidebar")
    ?.addEventListener(
      "click",
      () => {

        document
          .getElementById("sidebar")
          ?.classList.remove("open");

      }
    );


  /* Notifications */

  document
    .getElementById("notificationBtn")
    ?.addEventListener(
      "click",
      openNotifications
    );


  /* Referral capture from URL (?ref=CODE) */

  const params =
    new URLSearchParams(location.search);

  const refCode =
    params.get("ref");

  if(refCode){

    const referralField =
      document.getElementById("regReferral");

    if(referralField){
      referralField.value = refCode.toUpperCase();
    }

    showAuth("register");
  }

  /* === NEW: live level fees on register form === */
  renderRegisterLevelFees();

  /* === FIREBASE: load data before rendering === */
   await loadDB();

  if(currentUser()){
    showApp();
  }else{
    showAuth("login");
  }

});

/* =========================================================
   === NEW: REGISTRATION PAYMENT CONFIRMATION
========================================================= */

function renderConfirmRegistrationPanel(user){
  const pm = paymentMethod();
  const fee = levelFee(user.level);

  return `
    <div class="confirm-panel">
      <h3>Confirm your registration payment</h3>
      <p>
        Pay <strong>${money(fee)}</strong> for
        <strong>${escapeHTML(levelName(user.level))}</strong> using:
        Paybill <span class="code-pill">${escapeHTML(pm.paybill)}</span>,
        Account <span class="code-pill">${escapeHTML(pm.accountLabel)}</span>.
        Then enter your M-Pesa code below and send for admin approval.
      </p>

      <form onsubmit="confirmRegistrationPayment(event)">
        <label>
          M-Pesa confirmation code
          <input
            id="regMpesaCode"
            required
            placeholder="e.g. QGH7X8K2LM"
            maxlength="10"
            style="text-transform:uppercase"
          >
          <small class="field-hint">
            10-character code from your M-Pesa SMS.
          </small>
        </label>

        <button class="btn primary" type="submit" style="margin-top:12px">
          Send for admin approval
        </button>
      </form>
    </div>
  `;
}

function confirmRegistrationPayment(event){
  event.preventDefault();

  const user = currentUser();
  if(!user) return;

  const code = normalizeMpesaCode(
    document.getElementById("regMpesaCode")?.value
  );

  if(!isValidMpesaCode(code)){
    toast(
      "Enter a valid 10-character M-Pesa code.",
      "error"
    );
    return;
  }

  const data = db();
  const dbUser = data.users.find(u => u.id === user.id);
  if(!dbUser) return;

  if(dbUser.registrationConfirmed){
    toast("Already confirmed. Awaiting admin approval.","info");
    return;
  }

  /* prevent duplicate code re-use */
  const codeExists = data.paymentRequests.some(
    x => x.mpesaCode === code && x.status !== "rejected"
  );

  if(codeExists){
    toast("This M-Pesa code has already been used.","error");
    return;
  }

  dbUser.registrationConfirmed = true;
  dbUser.registrationConfirmedAt = Date.now();

  data.paymentRequests.push({
    id:uid("preq"),
    userId:user.id,
    kind:"registration",
    amount:levelFee(dbUser.level),
    mpesaCode:code,
    description:`${levelName(dbUser.level)} registration payment`,
    status:"pending",
    createdAt:Date.now()
  });

  data.notifications.push({
    id:uid("notif"),
    userId:user.id,
    title:"Registration confirmation sent",
    message:`Payment confirmation (M-Pesa ${code}) sent to admin for verification.`,
    read:false,
    createdAt:Date.now()
  });

  saveDB(data);
  toast("Sent for admin approval.");
  renderPage("dashboard");
}



/* =========================================================
   === NEW: BUY BIDS (user page)
========================================================= */

function renderBuyBids(){
  const user = currentUser();
  if(!user) return;

  const pkgs = bidPackages();

  const myRequests = db().paymentRequests
    .filter(x => x.userId === user.id && x.kind === "bidpackage")
    .sort((a,b) => Number(b.createdAt) - Number(a.createdAt));

  const pending = myRequests.filter(x => x.status === "pending");

  document.getElementById("pageContent").innerHTML = `
    <div class="page-header">
      <div>
        <h1>Buy Bids</h1>
        <p>
          Purchase a bid package. Once admin approves your payment,
          the bids are credited to your bid balance.
        </p>
      </div>
      <div class="bid-balance-pill">
        Bid balance: <b>${Number(user.bidBalance || 0)}</b>
      </div>
    </div>

    ${
      pending.length
        ? `<div class="notice warning">
            <strong>You have ${pending.length} bid package request(s) pending approval.</strong>
          </div>`
        : ""
    }

    <div class="panel">
      <div class="panel-head">
        <h3>Available packages</h3>
        <span>${pkgs.length} options</span>
      </div>
      <div class="panel-body">
        <div class="package-grid">
          ${pkgs.map(p => `
            <div class="package-card">
              <h4>${escapeHTML(p.name)}</h4>
              <div class="pkg-bids">${Number(p.bids)}<small>bids</small></div>
              <div class="pkg-price">${money(p.price)}</div>
              <button
                class="btn primary"
                type="button"
                onclick="openBuyBidsModal('${p.id}')"
              >
                Select & Pay
              </button>
            </div>
          `).join("")}
        </div>
      </div>
    </div>


    <!-- === NEW: purchase history === -->
    <div class="panel" style="margin-top:18px">
      <div class="panel-head">
        <h3>My Bid Package Purchases</h3>
        <span>${myRequests.length} record(s)</span>
      </div>

      <div class="table-wrap">
        ${myRequests.length
          ? `
            <table class="table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Bids</th>
                  <th>Amount</th>
                  <th>M-Pesa Code</th>
                  <th>Requested</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${myRequests.map(item => `
                  <tr>
                    <td><strong>${escapeHTML(item.description || "Package")}</strong></td>
                    <td>${Number(item.bids || 0)}</td>
                    <td>${money(item.amount)}</td>
                    <td>
                      ${
                        item.mpesaCode
                          ? `<span class="code-pill">${escapeHTML(item.mpesaCode)}</span>`
                          : `<span class="muted">—</span>`
                      }
                    </td>
                    <td>${dateTime(item.createdAt)}</td>
                    <td>
                      ${statusBadge(item.status)}
                      ${
                        item.status === "rejected" && item.rejectionReason
                          ? `<div class="rejection-box">
                              <strong>Reason:</strong>
                              ${escapeHTML(item.rejectionReason)}
                            </div>`
                          : ""
                      }
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `
          : `<div class="empty"><strong>No purchases yet</strong>Buy your first bid package above.</div>`}
      </div>
    </div>
  `;
}

function openBuyBidsModal(packageId){
  const user = currentUser();
  if(!user) return;

  const p = bidPackageById(packageId);
  if(!p){ toast("Package not found.","error"); return; }

  const pm = paymentMethod();

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>Buy ${escapeHTML(p.name)} — ${Number(p.bids)} bids</h3>
          <button class="modal-close" type="button" onclick="closeModal()">×</button>
        </div>

        <form onsubmit="submitBidPackageRequest(event,'${p.id}')">
          <div class="modal-body">
            <div class="notice info">
              Pay <strong>${money(p.price)}</strong> via Paybill
              <span class="code-pill">${escapeHTML(pm.paybill)}</span>,
              Account <span class="code-pill">${escapeHTML(pm.accountLabel)}</span>.
              Then enter your M-Pesa confirmation code below.
            </div>

            <label>
              M-Pesa confirmation code
              <input
                id="pkgMpesaCode"
                required
                placeholder="e.g. QGH7X8K2LM"
                maxlength="10"
                style="text-transform:uppercase"
              >
              <small class="field-hint">
                10-character code from your M-Pesa SMS. Uppercase letters and digits only.
              </small>
            </label>
          </div>

          <div class="modal-foot">
            <button class="btn ghost" type="button" onclick="closeModal()">Cancel</button>
            <button class="btn primary" type="submit">Send for approval</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function submitBidPackageRequest(event, packageId){
  event.preventDefault();

  const user = currentUser();
  if(!user) return;

  const p = bidPackageById(packageId);
  if(!p) return;

  const codeInput = document.getElementById("pkgMpesaCode");
  const code = normalizeMpesaCode(codeInput?.value);

  if(!isValidMpesaCode(code)){
    toast(
      "Enter a valid 10-character M-Pesa code (uppercase letters and digits, starting with a letter).",
      "error"
    );
    return;
  }

  const data = db();

  /* prevent duplicate code re-use */
  const codeExists = data.paymentRequests.some(
    x => x.mpesaCode === code && x.status !== "rejected"
  );

  if(codeExists){
    toast("This M-Pesa code has already been used.","error");
    return;
  }

  data.paymentRequests.push({
    id:uid("preq"),
    userId:user.id,
    kind:"bidpackage",
    packageId:p.id,
    bids:Number(p.bids),
    amount:Number(p.price),
    mpesaCode:code,
    description:`Bid package: ${p.name} (${p.bids} bids)`,
    status:"pending",
    createdAt:Date.now()
  });

  data.notifications.push({
    id:uid("notif"),
    userId:user.id,
    title:"Bid package request submitted",
    message:`${p.name} package — ${p.bids} bids for ${money(p.price)}. M-Pesa code ${code}. Awaiting admin approval.`,
    read:false,
    createdAt:Date.now()
  });

  saveDB(data);
  closeModal();
  toast("Request submitted. Awaiting admin approval.");
  renderPage("buy-bids");
}


/* =========================================================
   === NEW: ADMIN — BID PACKAGES
========================================================= */

function renderAdminBidPackages(){
  if(!requireAdmin()) return;

  const pkgs = bidPackages();

  document.getElementById("pageContent").innerHTML = `
    <div class="page-header">
      <div>
        <h1>Bid Packages</h1>
        <p>Edit the 5 bid packages users can purchase.</p>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h3>Edit packages</h3>
        <span>${pkgs.length} package(s)</span>
      </div>
      <div class="panel-body">
        <form onsubmit="saveBidPackages(event)">
          <div class="package-grid">
            ${pkgs.map((p,i) => `
              <div class="package-card">
                <label>
                  Name
                  <input
                    class="pkg-name"
                    data-index="${i}"
                    required
                    value="${escapeHTML(p.name)}"
                  >
                </label>
                <label>
                  Bids
                  <input
                    class="pkg-bids"
                    data-index="${i}"
                    type="number"
                    min="1"
                    required
                    value="${Number(p.bids)}"
                  >
                </label>
                <label>
                  Price (KSh)
                  <input
                    class="pkg-price"
                    data-index="${i}"
                    type="number"
                    min="0"
                    required
                    value="${Number(p.price)}"
                  >
                </label>
              </div>
            `).join("")}
          </div>

          <button class="btn primary" type="submit" style="margin-top:15px">
            Save all packages
          </button>
        </form>
      </div>
    </div>
  `;
}

function saveBidPackages(event){
  event.preventDefault();
  if(!requireAdmin()) return;

  const data = db();

  document.querySelectorAll(".pkg-name").forEach(el => {
    const i = Number(el.dataset.index);
    const bidsEl = document.querySelector(`.pkg-bids[data-index="${i}"]`);
    const priceEl = document.querySelector(`.pkg-price[data-index="${i}"]`);
    if(data.settings.bidPackages[i]){
      data.settings.bidPackages[i].name = el.value.trim();
      data.settings.bidPackages[i].bids = Number(bidsEl.value || 0);
      data.settings.bidPackages[i].price = Number(priceEl.value || 0);
    }
  });

  saveDB(data);
  toast("Bid packages updated.");
  renderPage("admin-bid-packages");
}

/* =========================================================
   === NEW: ADMIN — BID BALANCES
========================================================= */

function renderAdminBidBalances(){
  if(!requireAdmin()) return;

  const users = db().users.filter(u => u.role !== "admin");

  document.getElementById("pageContent").innerHTML = `
    <div class="page-header">
      <div>
        <h1>Bid Balances</h1>
        <p>All contributor bid account balances.</p>
      </div>
    </div>

    <div class="panel">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Level</th>
              <th>Bid balance</th>
              <th>Bids today</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td><strong>${escapeHTML(u.name)}</strong></td>
                <td>${escapeHTML(u.email)}</td>
                <td>${escapeHTML(levelName(u.level))}</td>
                <td><span class="bid-balance-pill"><b>${Number(u.bidBalance || 0)}</b></span></td>
                <td>${dailyBidCount(u.id)}/${userDailyLimit(u)}</td>
                <td>
                  <button
                    class="btn ghost small-btn"
                    type="button"
                    onclick="openAdjustBids('${u.id}')"
                  >
                    Adjust
                  </button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="6" class="center">No users.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openAdjustBids(userId){
  if(!requireAdmin()) return;

  const u = findUser(userId);
  if(!u) return;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>Adjust bids — ${escapeHTML(u.name)}</h3>
          <button class="modal-close" type="button" onclick="closeModal()">×</button>
        </div>

        <form onsubmit="saveAdjustBids(event,'${u.id}')">
          <div class="modal-body">
            <div class="notice info">
              Current bid balance: <strong>${Number(u.bidBalance || 0)}</strong>
            </div>

            <label>
              New bid balance
              <input id="adjustBidsAmount" type="number" min="0" required value="${Number(u.bidBalance || 0)}">
            </label>
          </div>

          <div class="modal-foot">
            <button class="btn ghost" type="button" onclick="closeModal()">Cancel</button>
            <button class="btn primary" type="submit">Save</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function saveAdjustBids(event, userId){
  event.preventDefault();
  if(!requireAdmin()) return;

  const data = db();
  const u = data.users.find(x => x.id === userId);
  if(!u) return;

  u.bidBalance = Number(document.getElementById("adjustBidsAmount").value || 0);

  saveDB(data);
  closeModal();
  toast("Bid balance updated.");
  renderPage("admin-bid-balances");
}


/* =========================================================
   MAKE REQUIRED FUNCTIONS AVAILABLE TO INLINE BUTTONS
========================================================= */

window.renderPage = renderPage;
window.placeBid = placeBid;
window.openSubmitModal = openSubmitModal;
window.submitTask = submitTask;
window.closeModal = closeModal;

window.openWithdrawalModal = openWithdrawalModal;
window.requestWithdrawal = requestWithdrawal;

window.copyReferral = copyReferral;

window.openTaskModal = openTaskModal;
window.saveTask = saveTask;
window.toggleTaskStatus = toggleTaskStatus;
window.openTaskBidders = openTaskBidders;

window.openSubmissionReview = openSubmissionReview;
window.reviewSubmission = reviewSubmission;
window.openRejectModal = openRejectModal;
window.confirmReject = confirmReject;

window.confirmRegistration = confirmRegistration;
window.rejectRegistration = rejectRegistration;
window.markWithdrawalPaid = markWithdrawalPaid;

window.openNotifications = openNotifications;

window.resetAllDailyLimits = resetAllDailyLimits;
window.resetUserDailyLimit = resetUserDailyLimit;
window.openEditUser = openEditUser;
window.saveUser = saveUser;

window.approveReferral = approveReferral;
window.rejectReferral = rejectReferral;

window.approveTraining = approveTraining;
window.rejectTraining = rejectTraining;

window.submitTrainingRequest = submitTrainingRequest;
window.updateTrainingNote = updateTrainingNote;

window.submitUpgradeRequest = submitUpgradeRequest;
window.approveUpgrade = approveUpgrade;
window.rejectUpgrade = rejectUpgrade;

window.savePaymentMethod = savePaymentMethod;
window.saveLevelFees = saveLevelFees;
window.saveTrainingFees = saveTrainingFees;

/* === NEW: BID PACKAGE APPROVE / REJECT === */

function approveBidPackage(requestId){
  if(!requireAdmin()) return;

  const data = db();
  const req = data.paymentRequests.find(x => x.id === requestId);
  if(!req || req.status !== "pending") return;

  const u = data.users.find(x => x.id === req.userId);
  if(!u){ toast("User not found.","error"); return; }

  u.bidBalance = Number(u.bidBalance || 0) + Number(req.bids || 0);

  req.status = "approved";
  req.approvedAt = Date.now();

  data.transactions.push({
    id:uid("tx"),
    userId:u.id,
    type:"bidpackage",
    amount:Number(req.amount || 0),
    status:"credited",
    description:`Bid package approved — ${req.bids} bid(s) credited`,
    createdAt:Date.now()
  });

  data.notifications.push({
    id:uid("notif"),
    userId:u.id,
    title:"Bid package approved",
    message:`${req.bids} bid(s) have been credited to your bid balance.`,
    read:false,
    createdAt:Date.now()
  });

  saveDB(data);
  toast(`${req.bids} bid(s) credited to ${u.name}.`);
  renderPage("admin-payments");
}

function openRejectBidPackage(requestId){
  if(!requireAdmin()) return;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>Reject bid package request</h3>
          <button class="modal-close" type="button" onclick="closeModal()">×</button>
        </div>

        <form onsubmit="confirmRejectBidPackage(event,'${requestId}')">
          <div class="modal-body">
            <label>
              Reason (sent to user)
              <textarea id="bidPkgRejectReason" required placeholder="Explain why this request is rejected..."></textarea>
            </label>
          </div>

          <div class="modal-foot">
            <button class="btn ghost" type="button" onclick="closeModal()">Cancel</button>
            <button class="btn danger" type="submit">Confirm rejection</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function confirmRejectBidPackage(event, requestId){
  event.preventDefault();
  if(!requireAdmin()) return;

  const reason = document.getElementById("bidPkgRejectReason").value.trim();
  if(!reason){ toast("Please type a reason.","error"); return; }

  const data = db();
  const req = data.paymentRequests.find(x => x.id === requestId);
  if(!req) return;

  req.status = "rejected";
  req.rejectionReason = reason;
  req.rejectedAt = Date.now();

  data.notifications.push({
    id:uid("notif"),
    userId:req.userId,
    title:"Bid package rejected",
    message:`Your bid package request was rejected. Reason: ${reason}`,
    read:false,
    createdAt:Date.now()
  });

  saveDB(data);
  closeModal();
  toast("Bid package request rejected.","info");
  renderPage("admin-payments");
}

/* === NEW: live level fees on register form === */
function renderRegisterLevelFees(){
  const picker = document.getElementById("regLevelPicker");
  if(!picker) return;

  const fees = db().settings.levelFees || {};
  const windows = LEVEL_WINDOWS;

  picker.querySelectorAll(".level-choice").forEach(btn => {
    const level = Number(btn.dataset.level);
    const feeEl = btn.querySelector("span");
    const smallEl = btn.querySelector("small");

    if(feeEl) feeEl.textContent = money(fees[level] || 0);
    if(smallEl) smallEl.textContent = `Payment window: ${windows[level] || "—"}`;
  });
}

/* === NEW: window bindings === */
window.renderBuyBids = renderBuyBids;
window.openBuyBidsModal = openBuyBidsModal;
window.submitBidPackageRequest = submitBidPackageRequest;

window.renderAdminBidPackages = renderAdminBidPackages;
window.saveBidPackages = saveBidPackages;

window.renderAdminBidBalances = renderAdminBidBalances;
window.openAdjustBids = openAdjustBids;
window.saveAdjustBids = saveAdjustBids;

window.approveBidPackage = approveBidPackage;
window.openRejectBidPackage = openRejectBidPackage;
window.confirmRejectBidPackage = confirmRejectBidPackage;

window.confirmRegistrationPayment = confirmRegistrationPayment;
window.confirmRejectRegistration = confirmRejectRegistration;
window.renderRegisterLevelFees = renderRegisterLevelFees;
window.confirmRejectTraining = confirmRejectTraining;
window.confirmRejectUpgrade = confirmRejectUpgrade;
window.openDeleteUser = openDeleteUser;
window.confirmDeleteUser = confirmDeleteUser;
window.savePayoutDetails = savePayoutDetails;