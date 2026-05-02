// ===== Family Network Dashboard =====

const STORAGE_KEY = 'family-network-dashboard-v2';

// ===== Firebase (cloud sync) =====
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBq77puuoon1uTmEVOFhHP9x-sixa7PD5o",
  authDomain:        "profit-first-dashboard.firebaseapp.com",
  projectId:         "profit-first-dashboard",
  storageBucket:     "profit-first-dashboard.firebasestorage.app",
  messagingSenderId: "457012175633",
  appId:             "1:457012175633:web:1ca50f59e38346e6ade2b0"
};
const FS_COLLECTION = 'dashboard';
const FS_DOC = 'family-net-worth-anderson';

let _db = null;
let _docRef = null;
let _applyingRemote = false;
let _saveTimer = null;

function setSyncBadge(s, label) {
  const el = document.getElementById('syncBadge');
  if (!el) return;
  el.classList.remove('connecting','synced','syncing','offline');
  el.classList.add(s);
  el.querySelector('.sync-text').textContent = label;
}

function initFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      setSyncBadge('offline', 'Local only');
      return;
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.firestore();
    _db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    _docRef = _db.collection(FS_COLLECTION).doc(FS_DOC);
    setSyncBadge('connecting', 'Connecting…');

    _docRef.onSnapshot(
      (snap) => {
        if (snap.exists) {
          const remote = snap.data();
          if (remote && remote.payload) {
            try {
              const next = JSON.parse(remote.payload);
              _applyingRemote = true;
              state = next;
              localStorage.setItem(STORAGE_KEY, remote.payload);
              renderAll();
              _applyingRemote = false;
              setSyncBadge('synced', 'Synced');
            } catch (e) { console.warn('Bad remote payload', e); }
          }
        } else {
          // First run — push local state up
          pushToCloud(true);
        }
      },
      (err) => {
        console.warn('Snapshot error:', err);
        setSyncBadge('offline', 'Offline');
      }
    );
  } catch (e) {
    console.warn('Firebase init failed:', e);
    setSyncBadge('offline', 'Local only');
  }
}

function pushToCloud(initial) {
  if (!_docRef) return;
  if (!initial) setSyncBadge('syncing', 'Saving…');
  const payload = JSON.stringify(state);
  _docRef.set({
    payload,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).then(() => {
    setSyncBadge('synced', 'Synced');
  }).catch((err) => {
    console.warn('Cloud save failed:', err);
    setSyncBadge('offline', 'Offline');
  });
}

const seedData = {
  members: [
    {
      id: 'todd',
      name: 'Todd',
      goal: { target: 500000, monthly: 2500, rate: 7 },
      accounts: [
        { id: 't1', name: 'Chase Checking', balance: 4800,    category: 'cash' },
        { id: 't2', name: 'Ally Savings',   balance: 2000,    category: 'cash' },
        { id: 't3', name: 'Robinhood',      balance: 121310,  category: 'investment' },
        { id: 't4', name: 'M1',             balance: 103000,  category: 'investment' },
      ],
    },
    {
      id: 'morgan',
      name: 'Morgan',
      goal: { target: 250000, monthly: 2000, rate: 7 },
      accounts: [
        { id: 'm1', name: 'Chase',                balance: 53491.15, category: 'cash' },
        { id: 'm2', name: 'Ally',                 balance: 1844.24,  category: 'cash' },
        { id: 'm3', name: 'Acorns',               balance: 16744.38, category: 'investment' },
        { id: 'm4', name: 'Robinhood Roth IRA',   balance: 11651.78, category: 'retirement' },
        { id: 'm5', name: 'Robinhood Trad IRA',   balance: 7168.44,  category: 'retirement' },
        { id: 'm6', name: 'Robinhood Managed',    balance: 8314.86,  category: 'investment' },
      ],
    },
  ],
  activeMemberId: 'family',
  familyGoal: { target: 0, monthly: 4500, rate: 7 },
  houseCalc: {
    expanded: true,
    annualIncome: 180000,
    taxRate: 22,
    debts: [
      { id: 'd1', name: 'Car payment', amount: 450 },
      { id: 'd2', name: 'Student loan', amount: 0 },
    ],
    dtiPercent: 30,
    mortgageRate: 6.75,
    loanTermYears: 30,
    taxesInsurance: 500,
    homePrice: 650000,
  },
};

const FAMILY_ID = 'family';

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return structuredClone(seedData);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (_applyingRemote) return;
  // Debounce cloud writes (rapid input typing)
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => pushToCloud(false), 350);
}

const $ = (id) => document.getElementById(id);

// ===== Formatting =====
const fmtMoney = (n) => {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  const opts = { minimumFractionDigits: abs < 1000 ? 2 : 0, maximumFractionDigits: 2 };
  return '$' + n.toLocaleString('en-US', opts);
};

const fmtMoneyShort = (n) => {
  if (!isFinite(n)) return '$0';
  return '$' + Math.round(n).toLocaleString('en-US');
};

const parseNum = (s) => {
  if (typeof s !== 'string') return 0;
  const cleaned = s.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const categoryLabel = (c) => ({
  cash: 'Cash & Banking',
  retirement: 'Retirement',
  investment: 'Investment',
  other: 'Other',
}[c] || 'Other');

const categoryGlyph = (c, name) => {
  const ch = (name || '?').trim().charAt(0).toUpperCase();
  return ch || '·';
};

// ===== State helpers =====
function isFamilyView() {
  return state.activeMemberId === FAMILY_ID;
}

function activeMember() {
  if (isFamilyView()) return null;
  return state.members.find(m => m.id === state.activeMemberId) || state.members[0];
}

function memberTotal(m) {
  return (m.accounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
}

function familyTotal() {
  return state.members.reduce((s, m) => s + memberTotal(m), 0);
}

function familyAccountCount() {
  return state.members.reduce((s, m) => s + (m.accounts?.length || 0), 0);
}

// Returns array of { account, member } pairs for the family view
function familyAccounts() {
  const list = [];
  state.members.forEach(m => {
    (m.accounts || []).forEach(acc => list.push({ account: acc, member: m }));
  });
  return list;
}

function activeGoal() {
  if (isFamilyView()) {
    state.familyGoal = state.familyGoal || { target: 0, monthly: 0, rate: 7 };
    return state.familyGoal;
  }
  const m = activeMember();
  m.goal = m.goal || { target: 0, monthly: 0, rate: 7 };
  return m.goal;
}

function ensureHouseCalc() {
  if (!state.houseCalc) {
    state.houseCalc = {
      expanded: true,
      annualIncome: 0,
      taxRate: 22,
      debts: [],
      dtiPercent: 30,
      mortgageRate: 6.75,
      loanTermYears: 30,
      taxesInsurance: 500,
      homePrice: 0,
    };
  }
  if (!Array.isArray(state.houseCalc.debts)) state.houseCalc.debts = [];
  return state.houseCalc;
}

// ===== House affordability math =====
function computeHouseAffordability(hc) {
  const annualIncome = Number(hc.annualIncome) || 0;
  const taxRate = Math.max(0, Math.min(60, Number(hc.taxRate) || 0));
  const dti = Math.max(0, Math.min(60, Number(hc.dtiPercent) || 0));
  const rate = Math.max(0, Number(hc.mortgageRate) || 0);
  const term = Math.max(1, Number(hc.loanTermYears) || 30);
  const taxIns = Math.max(0, Number(hc.taxesInsurance) || 0);
  const homePrice = Math.max(0, Number(hc.homePrice) || 0);
  const totalDebts = (hc.debts || []).reduce((s, d) => s + (Number(d.amount) || 0), 0);

  const monthlyGross = annualIncome / 12;
  const monthlyNet = monthlyGross * (1 - taxRate / 100);
  const monthlyDisp = Math.max(0, monthlyNet - totalDebts);
  const maxHousing = monthlyDisp * (dti / 100);
  const maxPI = Math.max(0, maxHousing - taxIns);

  const r = (rate / 100) / 12;
  const n = term * 12;
  let maxLoan = 0;
  if (maxPI > 0) {
    if (r === 0) maxLoan = maxPI * n;
    else maxLoan = maxPI * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
  }

  const downPayment = Math.max(0, homePrice - maxLoan);

  return {
    monthlyGross, monthlyNet, monthlyDisp, totalDebts,
    maxHousing, maxPI, maxLoan,
    homePrice, downPayment,
  };
}

function activeTotal() {
  return isFamilyView() ? familyTotal() : memberTotal(activeMember());
}

function activeLabel() {
  return isFamilyView() ? 'Family' : activeMember().name;
}

// ===== Rendering =====
function renderMemberTabs() {
  const tabs = $('memberTabs');
  tabs.innerHTML = '';

  const makeTab = (id, label) => {
    const btn = document.createElement('button');
    btn.className = 'member-tab' + (id === state.activeMemberId ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      state.activeMemberId = id;
      saveState();
      renderAll();
    });
    return btn;
  };

  const familyTab = makeTab(FAMILY_ID, 'Family');
  familyTab.classList.add('family-tab');
  tabs.appendChild(familyTab);

  state.members.forEach(m => tabs.appendChild(makeTab(m.id, m.name)));
}

function renderHero() {
  const total = activeTotal();
  animateNumber($('totalValue'), total);
  $('accountCount').textContent = isFamilyView() ? familyAccountCount() : (activeMember().accounts || []).length;
  $('memberLabel').textContent = activeLabel();
}

let heroAnimToken = 0;
function animateNumber(el, target) {
  const token = ++heroAnimToken;
  const startText = el.textContent.replace(/[^0-9.\-]/g, '');
  const start = parseFloat(startText) || 0;
  const duration = 700;
  const t0 = performance.now();
  function step(now) {
    if (token !== heroAnimToken) return;
    const t = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = start + (target - start) * eased;
    el.textContent = fmtMoneyShort(v);
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = fmtMoneyShort(target);
  }
  requestAnimationFrame(step);
}

function renderAccounts() {
  const list = $('accountsList');
  list.innerHTML = '';

  let entries;
  if (isFamilyView()) {
    entries = familyAccounts();
    if (entries.length === 0) {
      list.innerHTML = '<div class="empty-state">No accounts yet. Pick a member tab and click <strong>+ Account</strong>.</div>';
      return;
    }
    entries.sort((a, b) => b.account.balance - a.account.balance);
  } else {
    const m = activeMember();
    if (!m.accounts || m.accounts.length === 0) {
      list.innerHTML = '<div class="empty-state">No accounts yet. Click <strong>+ Account</strong> to add one.</div>';
      return;
    }
    entries = [...m.accounts].sort((a, b) => b.balance - a.balance).map(a => ({ account: a, member: m }));
  }

  entries.forEach(({ account: acc, member }) => {
    const row = document.createElement('div');
    row.className = 'account-row';
    const subText = isFamilyView()
      ? `${member.name} · ${categoryLabel(acc.category)}`
      : categoryLabel(acc.category);
    row.innerHTML = `
      <div class="account-icon ${acc.category || 'other'}">${categoryGlyph(acc.category, acc.name)}</div>
      <div>
        <div class="account-name"></div>
        <div class="account-cat"></div>
      </div>
      <div class="account-balance">${fmtMoney(acc.balance)}</div>
    `;
    row.querySelector('.account-name').textContent = acc.name;
    row.querySelector('.account-cat').textContent = subText;
    row.addEventListener('click', () => openAccountModal(acc.id, member.id));
    list.appendChild(row);
  });
}

function renderGoal() {
  const goal = activeGoal();
  const family = isFamilyView();

  // Show/hide sections based on view
  $('houseCalc').style.display = family ? '' : 'none';
  $('simpleGoalForm').style.display = family ? 'none' : '';

  if (family) {
    $('goalPanelTitle').textContent = 'House Down Payment';
    $('goalPanelSub').textContent = 'Project your path to the build';
    $('pathTitle').textContent = 'Path to Down Payment';
    renderHouseCalc();
  } else {
    $('goalPanelTitle').textContent = 'Goal Planner';
    $('goalPanelSub').textContent = 'Project your path to the target';
    $('pathTitle').textContent = 'Path to Goal';
    $('goalAmount').value = goal.target ? Number(goal.target).toLocaleString('en-US') : '';
  }

  $('monthlyAmount').value = goal.monthly ? Number(goal.monthly).toLocaleString('en-US') : '';
  $('returnRate').value = goal.rate || '';
  computeGoal();
}

function renderHouseCalc() {
  const hc = ensureHouseCalc();
  const calc = $('houseCalc');
  calc.classList.toggle('open', !!hc.expanded);

  $('hcIncome').value = hc.annualIncome ? Number(hc.annualIncome).toLocaleString('en-US') : '';
  $('hcTaxRate').value = hc.taxRate ?? '';
  $('hcRate').value = hc.mortgageRate ?? '';
  $('hcTerm').value = hc.loanTermYears ?? '';
  $('hcDti').value = hc.dtiPercent ?? '';
  $('hcTaxIns').value = hc.taxesInsurance ? Number(hc.taxesInsurance).toLocaleString('en-US') : '';
  $('hcHomePrice').value = hc.homePrice ? Number(hc.homePrice).toLocaleString('en-US') : '';

  renderDebts();
  computeHouse();
}

function renderDebts() {
  const hc = ensureHouseCalc();
  const list = $('debtsList');
  list.innerHTML = '';
  hc.debts.forEach(d => {
    const row = document.createElement('div');
    row.className = 'debt-row';
    row.innerHTML = `
      <input type="text" class="debt-name" placeholder="Car payment" />
      <div class="input-wrap">
        <span class="prefix">$</span>
        <input type="text" class="debt-amount" inputmode="decimal" placeholder="0" />
      </div>
      <button type="button" class="debt-del" title="Remove">×</button>
    `;
    const nameEl = row.querySelector('.debt-name');
    const amtEl = row.querySelector('.debt-amount');
    nameEl.value = d.name || '';
    amtEl.value = d.amount ? Number(d.amount).toLocaleString('en-US') : '';
    nameEl.addEventListener('input', () => { d.name = nameEl.value; saveState(); });
    amtEl.addEventListener('input', () => {
      d.amount = parseNum(amtEl.value);
      computeHouse();
      saveState();
    });
    amtEl.addEventListener('blur', () => {
      const n = parseNum(amtEl.value);
      amtEl.value = n ? n.toLocaleString('en-US') : '';
    });
    row.querySelector('.debt-del').addEventListener('click', () => {
      hc.debts = hc.debts.filter(x => x.id !== d.id);
      saveState();
      renderDebts();
      computeHouse();
    });
    list.appendChild(row);
  });
}

function computeHouse() {
  const hc = ensureHouseCalc();
  // Pull current input values
  hc.annualIncome = parseNum($('hcIncome').value);
  hc.taxRate = parseNum($('hcTaxRate').value);
  hc.mortgageRate = parseNum($('hcRate').value);
  hc.loanTermYears = parseNum($('hcTerm').value) || 30;
  hc.dtiPercent = parseNum($('hcDti').value);
  hc.taxesInsurance = parseNum($('hcTaxIns').value);
  hc.homePrice = parseNum($('hcHomePrice').value);

  const r = computeHouseAffordability(hc);

  $('statNet').textContent = fmtMoney(r.monthlyNet);
  $('statDisp').textContent = fmtMoney(r.monthlyDisp);
  $('statMaxHousing').textContent = fmtMoney(r.maxHousing) + ' / mo';
  $('statMaxLoan').textContent = fmtMoney(r.maxLoan);
  $('statDown').textContent = fmtMoney(r.downPayment);

  // Summary in collapsed header
  $('houseSummary').textContent = r.downPayment > 0
    ? 'Down: ' + fmtMoneyShort(r.downPayment)
    : '—';

  // Feed the down payment into the family goal target
  if (isFamilyView()) {
    state.familyGoal = state.familyGoal || { target: 0, monthly: 0, rate: 7 };
    state.familyGoal.target = r.downPayment;
    computeGoal();
  }
}

function computeGoal() {
  const current = activeTotal();
  const family = isFamilyView();
  // In family view, target comes from the house calc (already on state.familyGoal.target)
  const target = family
    ? (state.familyGoal?.target || 0)
    : parseNum($('goalAmount').value);
  const monthly = parseNum($('monthlyAmount').value);
  const annualRate = parseNum($('returnRate').value);
  const remaining = Math.max(0, target - current);

  $('resCurrent').textContent = fmtMoney(current);
  $('resRemaining').textContent = fmtMoney(remaining);

  // Save goal inputs
  if (family) {
    state.familyGoal = state.familyGoal || { target: 0, monthly: 0, rate: 7 };
    state.familyGoal.monthly = monthly;
    state.familyGoal.rate = annualRate;
    // target stays driven by the house calc
  } else {
    activeMember().goal = { target, monthly, rate: annualRate };
  }
  saveState();

  // Compute time to goal: future value formula
  // FV = P(1+r)^n + PMT * [((1+r)^n - 1) / r]
  // Solve for n given FV = target, P = current
  let timeText = '—';
  let dateText = '—';
  let pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;

  if (target > 0) {
    if (current >= target) {
      timeText = 'Goal Reached';
      dateText = 'Today';
    } else if (monthly <= 0 && annualRate <= 0) {
      timeText = '—';
      dateText = 'Increase contribution';
    } else {
      const r = annualRate > 0 ? (annualRate / 100) / 12 : 0;
      let n = solveMonths(current, monthly, r, target);
      if (!isFinite(n) || n <= 0 || n > 12 * 200) {
        timeText = '—';
        dateText = 'Out of range';
      } else {
        timeText = formatDuration(n);
        const d = new Date();
        d.setMonth(d.getMonth() + Math.ceil(n));
        dateText = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
    }
  }

  $('resTime').textContent = timeText;
  $('resDate').textContent = dateText;
  $('progressBar').style.width = pct + '%';
  $('progressMeta').textContent = pct.toFixed(1) + '% of goal';
}

function solveMonths(P, PMT, r, FV) {
  // Closed form when r > 0
  if (r > 0) {
    // FV = P(1+r)^n + PMT*((1+r)^n - 1)/r
    // Let x = (1+r)^n
    // FV = P*x + PMT*(x-1)/r
    // FV*r = P*r*x + PMT*x - PMT
    // x (P*r + PMT) = FV*r + PMT
    // x = (FV*r + PMT) / (P*r + PMT)
    const num = FV * r + PMT;
    const den = P * r + PMT;
    if (den <= 0 || num <= 0) return Infinity;
    const x = num / den;
    if (x <= 1) return Infinity;
    return Math.log(x) / Math.log(1 + r);
  }
  // r == 0: linear
  if (PMT <= 0) return Infinity;
  return (FV - P) / PMT;
}

function formatDuration(months) {
  const total = Math.ceil(months);
  const y = Math.floor(total / 12);
  const mo = total % 12;
  if (y === 0) return `${mo} mo`;
  if (mo === 0) return `${y} yr`;
  return `${y} yr ${mo} mo`;
}

function renderAll() {
  renderMemberTabs();
  renderHero();
  renderAccounts();
  renderGoal();
}

// ===== Account modal =====
let editingAccountId = null;
let editingMemberId = null;

function openAccountModal(accountId, memberId) {
  // memberId override is used for editing from Family view
  let targetMemberId = memberId || (isFamilyView() ? null : state.activeMemberId);

  // Adding a new account from Family view: ask which member
  if (!accountId && !targetMemberId) {
    if (state.members.length === 1) {
      targetMemberId = state.members[0].id;
    } else {
      const choice = window.prompt(
        'Add account to which family member?\n\n' +
        state.members.map((m, i) => `${i + 1}. ${m.name}`).join('\n'),
        '1'
      );
      if (!choice) return;
      const idx = parseInt(choice, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= state.members.length) return;
      targetMemberId = state.members[idx].id;
    }
  }

  editingAccountId = accountId || null;
  editingMemberId = targetMemberId;

  const m = state.members.find(x => x.id === targetMemberId);
  const acc = accountId ? (m.accounts || []).find(a => a.id === accountId) : null;
  $('accountModalTitle').textContent = (acc ? 'Edit Account' : 'Add Account') + ` · ${m.name}`;
  $('acctName').value = acc ? acc.name : '';
  $('acctBalance').value = acc ? Number(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  $('acctCategory').value = acc ? (acc.category || 'other') : 'cash';
  $('acctDeleteBtn').style.display = acc ? 'inline-flex' : 'none';
  $('accountModal').classList.add('open');
  setTimeout(() => $('acctName').focus(), 60);
}

function closeAccountModal() {
  $('accountModal').classList.remove('open');
  editingAccountId = null;
  editingMemberId = null;
}

function saveAccount() {
  const m = state.members.find(x => x.id === editingMemberId);
  if (!m) return;
  const name = $('acctName').value.trim();
  const balance = parseNum($('acctBalance').value);
  const category = $('acctCategory').value;
  if (!name) { $('acctName').focus(); return; }

  if (editingAccountId) {
    const acc = m.accounts.find(a => a.id === editingAccountId);
    if (acc) Object.assign(acc, { name, balance, category });
  } else {
    m.accounts = m.accounts || [];
    m.accounts.push({ id: 'a' + Date.now().toString(36), name, balance, category });
  }
  saveState();
  closeAccountModal();
  renderAll();
}

function deleteAccount() {
  if (!editingAccountId) return;
  const m = state.members.find(x => x.id === editingMemberId);
  if (!m) return;
  m.accounts = (m.accounts || []).filter(a => a.id !== editingAccountId);
  saveState();
  closeAccountModal();
  renderAll();
}

// ===== Member modal =====
function openMemberModal() {
  $('memberName').value = '';
  $('memberModal').classList.add('open');
  setTimeout(() => $('memberName').focus(), 60);
}

function closeMemberModal() {
  $('memberModal').classList.remove('open');
}

function saveMember() {
  const name = $('memberName').value.trim();
  if (!name) { $('memberName').focus(); return; }
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
  state.members.push({
    id,
    name,
    goal: { target: 0, monthly: 0, rate: 7 },
    accounts: [],
  });
  state.activeMemberId = id;
  saveState();
  closeMemberModal();
  renderAll();
}

// ===== Wire up =====
function wireEvents() {
  $('addAccountBtn').addEventListener('click', () => openAccountModal(null));
  $('addMemberBtn').addEventListener('click', openMemberModal);
  $('acctSaveBtn').addEventListener('click', saveAccount);
  $('acctDeleteBtn').addEventListener('click', deleteAccount);
  $('memberSaveBtn').addEventListener('click', saveMember);

  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => {
      closeAccountModal();
      closeMemberModal();
    });
  });

  // Click outside to close
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', (e) => {
      if (e.target === ov) {
        closeAccountModal();
        closeMemberModal();
      }
    });
  });

  // ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAccountModal();
      closeMemberModal();
    }
  });

  // Goal inputs - format as you type, recompute
  ['goalAmount', 'monthlyAmount'].forEach(id => {
    const el = $(id);
    el.addEventListener('input', () => {
      const cursor = el.selectionStart;
      const before = el.value;
      const n = parseNum(before);
      const formatted = n ? n.toLocaleString('en-US') : '';
      // Only reformat if it changed
      if (formatted !== before && before !== '') {
        el.value = formatted;
        // best-effort cursor restore
        const diff = formatted.length - before.length;
        const pos = Math.max(0, (cursor || 0) + diff);
        el.setSelectionRange(pos, pos);
      }
      computeGoal();
    });
  });
  $('returnRate').addEventListener('input', computeGoal);

  // House calc inputs
  $('houseToggle').addEventListener('click', () => {
    const hc = ensureHouseCalc();
    hc.expanded = !hc.expanded;
    $('houseCalc').classList.toggle('open', hc.expanded);
    saveState();
  });

  ['hcIncome', 'hcTaxIns', 'hcHomePrice'].forEach(id => {
    const el = $(id);
    el.addEventListener('input', () => {
      const before = el.value;
      const n = parseNum(before);
      const formatted = n ? n.toLocaleString('en-US') : '';
      if (formatted !== before && before !== '') {
        const cursor = el.selectionStart;
        el.value = formatted;
        const diff = formatted.length - before.length;
        el.setSelectionRange(Math.max(0, (cursor || 0) + diff), Math.max(0, (cursor || 0) + diff));
      }
      computeHouse();
      saveState();
    });
  });
  ['hcTaxRate', 'hcRate', 'hcTerm', 'hcDti'].forEach(id => {
    $(id).addEventListener('input', () => { computeHouse(); saveState(); });
  });

  $('addDebtBtn').addEventListener('click', () => {
    const hc = ensureHouseCalc();
    hc.debts.push({ id: 'd' + Date.now().toString(36), name: '', amount: 0 });
    saveState();
    renderDebts();
    computeHouse();
  });

  // Balance input formatting
  $('acctBalance').addEventListener('blur', () => {
    const n = parseNum($('acctBalance').value);
    if (n) $('acctBalance').value = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });

  // Enter key in modals
  $('accountModal').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'SELECT') {
      e.preventDefault();
      saveAccount();
    }
  });
  $('memberModal').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveMember(); }
  });
}

// ===== Boot =====
wireEvents();
renderAll();
initFirebase();
