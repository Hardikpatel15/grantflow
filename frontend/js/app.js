/**
 * GrantFlow — Client-side SPA Application Logic
 * Premium Graphite & Copper Design System
 */

let state = {
  token: null,
  currentUser: null,
  activeTab: 'dashboard',
  grants: [],
  expenses: [],
  categoryChart: null,
  burnRateChart: null,
  graphView: 'all',
  lastCategoryData: [],
  lastTimelineData: []
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  const savedToken = localStorage.getItem('grantflow_token');
  if (savedToken) {
    state.token = savedToken;
    try {
      await fetchUserProfile();
    } catch {
      await quickLogin('scholar@university.edu', 'scholar123');
    }
  } else {
    await quickLogin('scholar@university.edu', 'scholar123');
  }

  // Set Power BI URL display
  const pbiDisplay = document.getElementById('powerbi-url-display');
  if (pbiDisplay) {
    pbiDisplay.innerText = `${window.location.origin}/api/analytics/powerbi-export`;
  }
});

// --- Authentication & Role Switcher ---
async function quickLogin(email, password) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      await fetch('/api/auth/seed-demo-data', { method: 'POST' });
      const retryRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!retryRes.ok) throw new Error("Authentication failed");
      const data = await retryRes.json();
      applyAuthSession(data);
      return;
    }

    const data = await res.json();
    applyAuthSession(data);
  } catch (err) {
    showToast(`Login failed: ${err.message}`, 'error');
  }
}

function applyAuthSession(data) {
  state.token = data.access_token;
  state.currentUser = data.user;
  localStorage.setItem('grantflow_token', data.access_token);

  updateRoleUI();
  refreshAllData();
  showToast(`Active role switched: ${state.currentUser.role}`, 'success');
}

async function fetchUserProfile() {
  const res = await fetch('/api/auth/me', {
    headers: { 'Authorization': `Bearer ${state.token}` }
  });
  if (!res.ok) throw new Error("Session expired");
  state.currentUser = await res.json();
  updateRoleUI();
  refreshAllData();
}

function updateRoleUI() {
  if (!state.currentUser) return;
  const u = state.currentUser;

  // Header display
  document.getElementById('user-name').innerText = u.full_name;
  const isDean = u.email === 'dean@university.edu' || u.role === 'DEAN';
  const roleDisplay = isDean ? 'Dean' : u.role.replace(/_/g, ' ');
  document.getElementById('user-role-text').innerText = `${roleDisplay} · ${u.department.split('&')[0]}`;
  document.getElementById('user-initials').innerText = u.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  // Update quick buttons active state in header
  ['scholar', 'pi', 'auditor', 'dean'].forEach(r => {
    const btn = document.getElementById(`btn-role-${r}`);
    if (btn) {
      btn.className = "role-btn px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-[#1F2937] hover:text-[#2563EB] hover:bg-[#EFF6FF]";
    }
  });

  const activeBtnId = isDean ? 'btn-role-dean' :
                      u.role === 'SCHOLAR' ? 'btn-role-scholar' :
                      u.role === 'PI' ? 'btn-role-pi' :
                      u.role === 'FINANCE_AUDITOR' ? 'btn-role-auditor' : null;
  const activeBtn = activeBtnId ? document.getElementById(activeBtnId) : null;
  if (activeBtn) {
    activeBtn.className = "role-btn role-btn-active-glow px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-[#1351AA] text-white shadow-sm";
  }

  // Update floating dock active state
  const dockRoleName = document.getElementById('dock-role-name');
  if (dockRoleName) {
    dockRoleName.innerText = isDean ? 'Dean' : (u.role === 'SCHOLAR' ? 'Scholar' : (u.role === 'PI' ? 'PI' : (u.role === 'FINANCE_AUDITOR' ? 'Auditor' : roleDisplay)));
  }
  ['scholar', 'pi', 'auditor', 'dean'].forEach(r => {
    const dockBtn = document.getElementById(`dock-btn-${r}`);
    if (dockBtn) {
      dockBtn.className = "role-btn px-2.5 py-1 rounded-full text-xs font-medium text-[#1F2937] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition";
    }
  });
  const activeDockBtnId = isDean ? 'dock-btn-dean' :
                          u.role === 'SCHOLAR' ? 'dock-btn-scholar' :
                          u.role === 'PI' ? 'dock-btn-pi' :
                          u.role === 'FINANCE_AUDITOR' ? 'dock-btn-auditor' : null;
  const activeDockBtn = activeDockBtnId ? document.getElementById(activeDockBtnId) : null;
  if (activeDockBtn) {
    activeDockBtn.className = "role-btn px-2.5 py-1 rounded-full text-xs font-bold bg-[#1351AA] text-white shadow-xs transition";
  }

  // Role banner text
  const banner = document.getElementById('role-description-banner');
  const createGrantBtn = document.getElementById('btn-open-create-grant');

  if (isDean) {
    banner.innerText = `Active Role: ${u.full_name} (University Dean) — Executive research grant governance, institutional budget monitoring & finance audit.`;
    if (createGrantBtn) createGrantBtn.classList.remove('hidden');
  } else if (u.role === 'SCHOLAR') {
    banner.innerText = `Active Role: ${u.full_name} (Student / Research Scholar) — Submit purchase claims and upload digital invoice receipts.`;
    if (createGrantBtn) createGrantBtn.classList.add('hidden');
  } else if (u.role === 'PI') {
    banner.innerText = `Active Role: ${u.full_name} (Principal Investigator) — Initialize grants, allocate budget heads, and approve claims.`;
    if (createGrantBtn) createGrantBtn.classList.remove('hidden');
  } else if (u.role === 'FINANCE_AUDITOR') {
    banner.innerText = `Active Role: ${u.full_name} (Finance Auditor) — Final audit review, enforce ceiling caps, and inspect security audit trail.`;
    if (createGrantBtn) createGrantBtn.classList.remove('hidden');
  } else {
    banner.innerText = `Active Role: ${u.full_name} (${roleDisplay}) — View research grants, track allocations, and submit expense claims.`;
    if (createGrantBtn) createGrantBtn.classList.add('hidden');
  }
}

// --- Edit Role Display Name Modal Handlers ---
const roleCache = {
  'scholar@university.edu': { name: 'Aarav Sharma', department: 'Department of Computer Science & Engineering' },
  'pi@university.edu': { name: 'Dr. Meera Iyer', department: 'Department of Computer Science & Engineering' },
  'auditor@university.edu': { name: 'Rajesh K. Verma', department: 'Internal Finance & Audit Cell' },
  'dean@university.edu': { name: 'Prof. Vikram Sengupta', department: 'Dean of Research & Development' }
};

function openEditNameModal() {
  const modal = document.getElementById('modal-edit-name');
  if (!modal) return;
  const select = document.getElementById('edit-role-select');
  const nameInput = document.getElementById('edit-full-name');
  const deptInput = document.getElementById('edit-department');

  // Match current active user email if available
  if (state.currentUser && select) {
    select.value = state.currentUser.email;
    nameInput.value = state.currentUser.full_name;
    deptInput.value = state.currentUser.department || '';
    roleCache[state.currentUser.email] = {
      name: state.currentUser.full_name,
      department: state.currentUser.department || ''
    };
  } else if (select) {
    onEditRoleSelectChange();
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeEditNameModal() {
  const modal = document.getElementById('modal-edit-name');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function onEditRoleSelectChange() {
  const select = document.getElementById('edit-role-select');
  const nameInput = document.getElementById('edit-full-name');
  const deptInput = document.getElementById('edit-department');
  if (!select || !nameInput || !deptInput) return;

  const email = select.value;
  if (state.currentUser && state.currentUser.email === email) {
    nameInput.value = state.currentUser.full_name;
    deptInput.value = state.currentUser.department || '';
  } else if (roleCache[email]) {
    nameInput.value = roleCache[email].name;
    deptInput.value = roleCache[email].department;
  }
}

async function handleEditNameSubmit(event) {
  if (event) event.preventDefault();
  const select = document.getElementById('edit-role-select');
  const nameInput = document.getElementById('edit-full-name');
  const deptInput = document.getElementById('edit-department');
  const btn = document.getElementById('btn-save-edit-name');
  if (!select || !nameInput) return;

  const roleEmail = select.value;
  const newName = nameInput.value.trim();
  const department = deptInput ? deptInput.value.trim() : '';

  if (!newName) {
    showToast("Please enter a valid display name.", "error");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i> Saving...`;
  }

  try {
    const res = await fetch('/api/auth/update-role-name', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({
        role_email: roleEmail,
        new_name: newName,
        department: department || undefined
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Failed to update role name.");
    }

    roleCache[roleEmail] = {
      name: data.full_name,
      department: data.department
    };

    if (state.currentUser && state.currentUser.email === roleEmail) {
      state.currentUser.full_name = data.full_name;
      state.currentUser.department = data.department;
      updateRoleUI();
    }

    closeEditNameModal();
    showToast(`Role name successfully updated to "${data.full_name}"!`, "success");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `Save Changes`;
    }
  }
}

// --- Login Modal Controls ---
function openLoginModal() {
  const modal = document.getElementById('modal-login');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeLoginModal() {
  const modal = document.getElementById('modal-login');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleLoginSubmit(event) {
  if (event) event.preventDefault();
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  const btn = document.getElementById('btn-submit-login');
  if (!emailInput || !passInput) return;

  const email = emailInput.value.trim();
  const password = passInput.value;
  if (!email || !password) {
    showToast("Please enter both email and password.", "error");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Signing In...`;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Invalid login credentials.");
    }

    applyAuthSession(data);
    closeLoginModal();
    showToast(`Signed in successfully as ${data.user.full_name}!`, "success");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `Sign In <i class="fa-solid fa-arrow-right ml-2 text-xs"></i>`;
    }
  }
}

// --- Register / List Yourself Handlers ---
function switchAuthTab(tab) {
  const signinPanel = document.getElementById('auth-panel-signin');
  const regPanel = document.getElementById('auth-panel-register');
  const signinTab = document.getElementById('auth-tab-signin');
  const regTab = document.getElementById('auth-tab-register');
  if (!signinPanel || !regPanel) return;

  if (tab === 'register') {
    signinPanel.classList.add('hidden');
    regPanel.classList.remove('hidden');
    if (regTab) regTab.className = "py-2 rounded-lg text-xs font-bold bg-[#1351AA] text-white transition-all duration-200";
    if (signinTab) signinTab.className = "py-2 rounded-lg text-xs font-bold text-[#374151] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-all duration-200";
  } else {
    regPanel.classList.add('hidden');
    signinPanel.classList.remove('hidden');
    if (signinTab) signinTab.className = "py-2 rounded-lg text-xs font-bold bg-[#1351AA] text-white transition-all duration-200";
    if (regTab) regTab.className = "py-2 rounded-lg text-xs font-bold text-[#374151] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-all duration-200";
  }
}

function onRegisterRoleChange() {
  const roleSel = document.getElementById('reg-role');
  const wrap = document.getElementById('reg-custom-role-wrap');
  const customInput = document.getElementById('reg-custom-role');
  if (!roleSel || !wrap) return;

  if (roleSel.value === 'CUSTOM') {
    wrap.classList.remove('hidden');
    if (customInput) customInput.required = true;
  } else {
    wrap.classList.add('hidden');
    if (customInput) customInput.required = false;
  }
}

async function handleRegisterSubmit(event) {
  if (event) event.preventDefault();
  const nameInput = document.getElementById('reg-name');
  const roleSel = document.getElementById('reg-role');
  const customRoleInput = document.getElementById('reg-custom-role');
  const deptInput = document.getElementById('reg-department');
  const emailInput = document.getElementById('reg-email');
  const passInput = document.getElementById('reg-password');
  const btn = document.getElementById('btn-submit-register');

  if (!nameInput || !roleSel || !emailInput || !passInput) return;

  let chosenRole = roleSel.value;
  if (chosenRole === 'CUSTOM') {
    chosenRole = (customRoleInput?.value || '').trim();
    if (!chosenRole) {
      showToast("Please specify your role title.", "error");
      return;
    }
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Creating Account...`;
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passInput.value,
        role: chosenRole,
        department: deptInput?.value.trim() || 'General Research'
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Registration failed.");
    }

    applyAuthSession(data);
    closeLoginModal();
    showToast(`Welcome, ${data.user.full_name}! Listed as ${data.user.role}.`, "success");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `Create Account &amp; Sign In <i class="fa-solid fa-user-check ml-2 text-xs"></i>`;
    }
  }
}

// --- Section Smooth Scroll Navigation ---
function switchTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active', 'text-[#1351AA]', 'border-[#1351AA]', 'bg-[#1351AA]/10');
    btn.classList.add('text-[#374151]', 'border-transparent');
  });

  const activeBtn = document.getElementById(`tab-${tabId}`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'text-[#1351AA]', 'border-[#1351AA]', 'bg-[#1351AA]/10');
    activeBtn.classList.remove('text-[#374151]', 'border-transparent');
  }

  // Smooth scroll to the corresponding vertical section
  const section = document.getElementById(`section-${tabId}`);
  if (section) {
    const yOffset = -128; // offset for sticky header + sticky nav bar
    const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
}

function scrollPageDown() {
  const sections = ['dashboard', 'grants', 'expenses', 'audit', 'powerbi'];
  const yOffset = -128;
  for (const secId of sections) {
    const el = document.getElementById(`section-${secId}`);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.top > 160) {
        const y = rect.top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
        return;
      }
    }
  }
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
}

function refreshAllData() {
  loadDashboardAnalytics();
  loadGrants();
  loadExpenses();
  loadAuditTrail();
}

// --- Dashboard & Graphite-Copper Financial Charts ---
async function loadDashboardAnalytics() {
  try {
    const res = await fetch('/api/analytics/summary', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('kpi-sanctioned').innerText = `₹${data.total_sanctioned.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    document.getElementById('kpi-spent').innerText = `₹${data.total_spent.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    document.getElementById('kpi-remaining').innerText = `₹${data.total_remaining.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    document.getElementById('kpi-grant-count').innerText = data.total_grants;
    document.getElementById('kpi-utilization-rate').innerText = `${data.overall_utilization_rate}%`;
    document.getElementById('kpi-pending-count').innerText = `${data.pending_claims_count} Claim${data.pending_claims_count === 1 ? '' : 's'}`;
    document.getElementById('kpi-pending-amount').innerText = `₹${data.pending_claims_amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

    state.lastCategoryData = data.category_breakdown || [];
    state.lastTimelineData = data.burn_rate_timeline || [];

    renderCategoryChart(state.lastCategoryData, state.graphView === 'doughnut' ? 'doughnut' : 'bar');
    renderBurnRateChart(state.lastTimelineData);
  } catch (err) {
    console.error("Failed to load dashboard KPIs:", err);
  }
}

function selectGraphView(viewMode) {
  state.graphView = viewMode;

  // Update active selector button
  ['all', 'bar', 'doughnut', 'line'].forEach(mode => {
    const btn = document.getElementById(`graph-btn-${mode}`);
    if (!btn) return;
    if (mode === viewMode) {
      btn.className = "graph-view-btn px-3 py-1.5 rounded-lg bg-[#1351AA] text-white transition-all duration-300 shadow-xs";
    } else {
      btn.className = "graph-view-btn px-3 py-1.5 rounded-lg text-[#1F2937] bg-white border border-[#E5E7EB] hover:text-[#2563EB] hover:bg-[#EFF6FF] hover:border-[#60A5FA] transition-all duration-300";
    }
  });

  const grid = document.getElementById('charts-grid');
  const catCard = document.getElementById('chart-card-category');
  const burnCard = document.getElementById('chart-card-burnrate');
  const catTitle = document.getElementById('category-chart-title');
  const catSub = document.getElementById('category-chart-subtitle');

  if (!grid || !catCard || !burnCard) return;

  // Smooth fade-out before switching
  catCard.classList.add('chart-switching');
  burnCard.classList.add('chart-switching');

  setTimeout(() => {
    if (viewMode === 'all') {
      grid.className = "grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-500";
      catCard.classList.remove('hidden');
      burnCard.classList.remove('hidden');
      if (catTitle) catTitle.innerHTML = `<i class="fa-solid fa-chart-column text-[#1351AA] mr-2"></i> Category Fund Allocation vs Spend`;
      if (catSub) catSub.innerText = "Cobalt (Allocated) vs. Light Blue (Spent)";
      renderCategoryChart(state.lastCategoryData, 'bar');
      renderBurnRateChart(state.lastTimelineData);
    } else if (viewMode === 'bar') {
      grid.className = "grid grid-cols-1 gap-6 transition-all duration-500";
      catCard.classList.remove('hidden');
      burnCard.classList.add('hidden');
      if (catTitle) catTitle.innerHTML = `<i class="fa-solid fa-chart-column text-[#1351AA] mr-2"></i> Category Fund Allocation vs Spend (Bar View)`;
      if (catSub) catSub.innerText = "Cobalt (Allocated) vs. Light Blue (Spent)";
      renderCategoryChart(state.lastCategoryData, 'bar');
    } else if (viewMode === 'doughnut') {
      grid.className = "grid grid-cols-1 gap-6 transition-all duration-500";
      catCard.classList.remove('hidden');
      burnCard.classList.add('hidden');
      if (catTitle) catTitle.innerHTML = `<i class="fa-solid fa-chart-pie text-[#1351AA] mr-2"></i> Category Spend Share (Doughnut View)`;
      if (catSub) catSub.innerText = "Proportional Expenditure Across Budget Heads";
      renderCategoryChart(state.lastCategoryData, 'doughnut');
    } else if (viewMode === 'line') {
      grid.className = "grid grid-cols-1 gap-6 transition-all duration-500";
      catCard.classList.add('hidden');
      burnCard.classList.remove('hidden');
      renderBurnRateChart(state.lastTimelineData);
    }

    requestAnimationFrame(() => {
      catCard.classList.remove('chart-switching');
      burnCard.classList.remove('chart-switching');
    });
  }, 160);
}

function renderCategoryChart(categories, chartType = 'bar') {
  const ctx = document.getElementById('categoryChart')?.getContext('2d');
  if (!ctx) return;

  const labels = categories.map(c => c.category);
  const allocated = categories.map(c => c.allocated);
  const spent = categories.map(c => c.spent);

  if (state.categoryChart) state.categoryChart.destroy();

  if (chartType === 'doughnut') {
    const doughnutPalette = ['#1351AA', '#3B82F6', '#60A5FA', '#93C5FD', '#1D4ED8', '#BFDBFE'];
    state.categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          label: 'Allocated Funds (₹)',
          data: allocated,
          backgroundColor: labels.map((_, i) => doughnutPalette[i % doughnutPalette.length]),
          borderColor: '#FFFFFF',
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        animation: {
          duration: 850,
          easing: 'easeOutQuart',
          animateRotate: true,
          animateScale: true
        },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#1F2937',
              padding: 14,
              font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 }
            }
          },
          tooltip: {
            backgroundColor: '#FFFFFF',
            borderColor: '#60A5FA',
            borderWidth: 1,
            titleColor: '#111827',
            bodyColor: '#374151',
            padding: 10
          }
        }
      }
    });
    return;
  }

  state.categoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Allocated Funds (₹)',
          data: allocated,
          backgroundColor: '#1351AA', // Primary Cobalt
          borderColor: '#0D3B7D',
          borderWidth: 1,
          borderRadius: 6
        },
        {
          label: 'Actual Spending (₹)',
          data: spent,
          backgroundColor: '#60A5FA', // Light Blue
          borderColor: '#3B82F6',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 850,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: {
          labels: {
            color: '#1F2937',
            font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 }
          }
        },
        tooltip: {
          backgroundColor: '#FFFFFF',
          borderColor: '#60A5FA',
          borderWidth: 1,
          titleColor: '#111827',
          bodyColor: '#374151',
          padding: 10,
          boxPadding: 4
        }
      },
      scales: {
        x: {
          ticks: { color: '#1F2937', font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 } },
          grid: { display: false }
        },
        y: {
          ticks: { color: '#374151', font: { family: 'JetBrains Mono', size: 10 } },
          grid: { color: '#E5E7EB' }
        }
      }
    }
  });
}

function renderBurnRateChart(timeline) {
  const ctx = document.getElementById('burnRateChart')?.getContext('2d');
  if (!ctx) return;

  const labels = timeline.length > 0 ? timeline.map(t => t.date) : ['No claims yet'];
  const values = timeline.length > 0 ? timeline.map(t => t.cumulative_spent) : [0];

  if (state.burnRateChart) state.burnRateChart.destroy();

  state.burnRateChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Cumulative Expenditure (₹)',
        data: values,
        borderColor: '#2563EB', // Crisp Blue Line
        backgroundColor: 'rgba(96, 165, 250, 0.14)', // Soft Light Blue fill
        fill: true,
        tension: 0.3,
        borderWidth: 2.5,
        pointBackgroundColor: '#60A5FA',
        pointBorderColor: '#1351AA',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 850,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: {
          labels: {
            color: '#1F2937',
            font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 }
          }
        },
        tooltip: {
          backgroundColor: '#FFFFFF',
          borderColor: '#60A5FA',
          borderWidth: 1,
          titleColor: '#111827',
          bodyColor: '#374151',
          padding: 10
        }
      },
      scales: {
        x: {
          ticks: { color: '#1F2937', font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 } },
          grid: { display: false }
        },
        y: {
          ticks: { color: '#374151', font: { family: 'JetBrains Mono', size: 10 } },
          grid: { color: '#E5E7EB' }
        }
      }
    }
  });
}

// --- Grants View ---
async function loadGrants() {
  try {
    const res = await fetch('/api/grants', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) return;
    state.grants = await res.json();

    const container = document.getElementById('grants-list-container');
    if (!container) return;
    container.innerHTML = '';

    const headSelect = document.getElementById('expense-budget-head-id');
    if (headSelect) headSelect.innerHTML = '';

    state.grants.forEach(g => {
      g.budget_heads.forEach(bh => {
        if (headSelect) {
          const opt = document.createElement('option');
          opt.value = bh.budget_head_id;
          opt.innerText = `${g.grant_code} — ${bh.category_name} (Remaining: ₹${bh.remaining_balance.toLocaleString('en-IN')})`;
          headSelect.appendChild(opt);
        }
      });

      const card = document.createElement('div');
      card.className = "gf-card p-6 space-y-5";

      let headsHtml = '';
      g.budget_heads.forEach(bh => {
        const pct = Math.min(100, bh.utilization_percentage);
        const barColor = pct > 85 ? 'bg-[#C97A16]' : pct > 60 ? 'bg-[#3B82F6]' : 'bg-[#1F8A4C]';

        headsHtml += `
          <div class="space-y-1.5 bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#60A5FA] hover:bg-[#EFF6FF]/60 transition-colors p-3 rounded-xl">
            <div class="flex justify-between items-center text-xs">
              <span class="font-bold text-[#111827]">${bh.category_name}</span>
              <span class="text-[#374151] font-['JetBrains_Mono'] text-[11px] font-medium">
                ₹${bh.spent_amount.toLocaleString('en-IN')} / ₹${bh.allocated_amount.toLocaleString('en-IN')} 
                <span class="text-[#1F2937] font-bold">(${bh.utilization_percentage}%)</span>
              </span>
            </div>
            <div class="w-full bg-[#E2E8F0] rounded-full h-2 overflow-hidden">
              <div class="${barColor} gf-progress-liquid h-2 rounded-full transition-all duration-700" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#E5E7EB] pb-4">
          <div>
            <div class="flex items-center space-x-2">
              <span class="bg-[#1351AA]/10 text-[#1351AA] font-['JetBrains_Mono'] text-xs font-bold px-2.5 py-0.5 rounded-md border border-[#1351AA]/25">${g.grant_code}</span>
              <span class="text-[11px] px-2.5 py-0.5 rounded-full ${g.status === 'ACTIVE' ? 'bg-[#1F8A4C]/10 text-[#1F8A4C] border border-[#1F8A4C]/25 font-semibold' : 'bg-[#F3F4F6] text-[#374151]'}">${g.status}</span>
            </div>
            <h3 class="text-base font-bold text-[#111827] mt-2 tracking-tight">${g.title}</h3>
            <p class="text-xs text-[#374151] mt-0.5">Agency: <span class="text-[#111827] font-semibold">${g.funding_agency}</span> · PI: <span class="text-[#111827] font-semibold">${g.pi_name}</span></p>
          </div>
          <div class="text-left sm:text-right">
            <span class="text-[11px] text-[#374151] uppercase tracking-wider font-bold">Sanctioned</span>
            <p class="text-xl font-bold text-[#111827] font-['JetBrains_Mono'] tracking-tight">₹${g.total_sanctioned_amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
            <p class="text-[11px] text-[#374151] font-['JetBrains_Mono'] font-medium">${g.start_date} to ${g.end_date}</p>
          </div>
        </div>

        <div>
          <p class="text-[11px] font-bold text-[#374151] uppercase tracking-wider mb-3">3NF Budget Heads Breakdown</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${headsHtml}
          </div>
        </div>
      `;

      container.appendChild(card);
    });

  } catch (err) {
    console.error("Failed to load grants:", err);
  }
}

// --- Expenses View ---
async function loadExpenses() {
  try {
    const filter = document.getElementById('expense-status-filter')?.value || '';
    const url = filter ? `/api/expenses?status_filter=${filter}` : '/api/expenses';

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) return;
    state.expenses = await res.json();

    const tbody = document.getElementById('expenses-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (state.expenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-xs text-[#374151] font-medium">No expense claims found matching filter.</td></tr>`;
      return;
    }

    state.expenses.forEach(exp => {
      const tr = document.createElement('tr');
      tr.className = "hover:bg-[#EFF6FF] transition-colors";

      const statusBadge = exp.status === 'APPROVED' ? 
        '<span class="bg-[#1F8A4C]/10 text-[#1F8A4C] border border-[#1F8A4C]/25 text-[11px] px-2.5 py-1 rounded-full font-semibold">Approved</span>' :
        exp.status === 'REJECTED' ?
        '<span class="bg-[#C92A2A]/10 text-[#C92A2A] border border-[#C92A2A]/25 text-[11px] px-2.5 py-1 rounded-full font-semibold">Rejected</span>' :
        '<span class="bg-[#C97A16]/10 text-[#C97A16] border border-[#C97A16]/25 text-[11px] px-2.5 py-1 rounded-full font-semibold">Pending</span>';

      const invoiceLink = exp.invoice_blob_url ? 
        `<a href="${exp.invoice_blob_url}" target="_blank" class="inline-flex items-center text-xs text-[#1351AA] hover:text-[#2563EB] font-semibold">
          <i class="fa-solid fa-file-arrow-down mr-1.5 text-[#1351AA]"></i> View Bill
        </a>` : '<span class="text-xs text-[#374151]">None</span>';

      let actionsHtml = '<span class="text-xs text-[#374151] font-medium">Reviewed</span>';
      if (exp.status === 'PENDING') {
        if (state.currentUser.role === 'PI' || state.currentUser.role === 'FINANCE_AUDITOR') {
          actionsHtml = `
            <div class="flex items-center justify-end space-x-2">
              <button onclick="takeExpenseAction(${exp.expense_id}, 'APPROVE')" class="bg-[#1F8A4C] hover:bg-[#166534] text-white text-xs px-3 py-1.5 rounded-lg transition font-bold">
                Approve
              </button>
              <button onclick="takeExpenseAction(${exp.expense_id}, 'REJECT')" class="btn-secondary text-xs px-3 py-1.5 rounded-lg transition text-[#374151] hover:text-[#C92A2A] font-semibold">
                Reject
              </button>
            </div>
          `;
        } else {
          actionsHtml = '<span class="text-xs text-[#374151] italic">Awaiting PI Review</span>';
        }
      }

      const formattedDate = new Date(exp.created_at).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      tr.innerHTML = `
        <td class="px-6 py-4">
          <span class="font-['JetBrains_Mono'] text-xs font-bold text-[#111827]">#EXP-${exp.expense_id}</span>
          <p class="text-[11px] text-[#374151] mt-0.5">${formattedDate}</p>
        </td>
        <td class="px-6 py-4">
          <span class="text-xs font-bold text-[#111827]">${exp.grant_code}</span>
          <p class="text-[11px] text-[#1351AA] font-mono font-semibold mt-0.5">${exp.category_name}</p>
        </td>
        <td class="px-6 py-4">
          <p class="text-xs font-semibold text-[#111827]">${exp.vendor_name}</p>
          <p class="text-[11px] text-[#374151] truncate max-w-xs mt-0.5">${exp.description}</p>
          <p class="text-[10px] text-[#374151] mt-0.5">Requester: <span class="font-semibold text-[#111827]">${exp.requester_name}</span></p>
        </td>
        <td class="px-6 py-4 font-['JetBrains_Mono'] font-bold text-[#111827] text-sm">
          ₹${exp.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}
        </td>
        <td class="px-6 py-4">
          ${invoiceLink}
        </td>
        <td class="px-6 py-4">
          ${statusBadge}
        </td>
        <td class="px-6 py-4 text-right">
          ${actionsHtml}
        </td>
      `;

      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("Failed to load expenses:", err);
  }
}

// --- Audit Trail View ---
async function loadAuditTrail() {
  try {
    const res = await fetch('/api/analytics/audit-logs', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) return;
    const logs = await res.json();

    const tbody = document.getElementById('audit-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    logs.forEach(l => {
      const tr = document.createElement('tr');
      tr.className = "hover:bg-[#EFF6FF] text-xs transition-colors";

      const timeStr = new Date(l.timestamp).toLocaleString('en-IN');

      tr.innerHTML = `
        <td class="px-6 py-3.5 font-['JetBrains_Mono'] text-[#374151] text-[11px]">${timeStr}</td>
        <td class="px-6 py-3.5 font-bold text-[#111827]">${l.actor_name}</td>
        <td class="px-6 py-3.5">
          <span class="font-['JetBrains_Mono'] text-[10px] bg-[#1351AA]/10 border border-[#1351AA]/25 px-2 py-0.5 rounded text-[#1351AA] font-semibold">${l.action_type}</span>
        </td>
        <td class="px-6 py-3.5 text-[#374151] font-medium">${l.target_entity} #${l.target_id}</td>
        <td class="px-6 py-3.5 text-[#111827] max-w-md truncate font-medium">${l.details || '—'}</td>
        <td class="px-6 py-3.5 font-['JetBrains_Mono'] text-[#374151] text-[11px]">${l.ip_address}</td>
      `;

      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load audit trail:", err);
  }
}

// --- Actions (Approve / Reject Claim with Ceiling Check) ---
async function takeExpenseAction(expenseId, action) {
  let reason = null;
  if (action === 'REJECT') {
    reason = prompt("Provide reason for rejecting this claim:", "Invoice unverified or expense outside approved scope");
    if (reason === null) return;
  }

  try {
    const res = await fetch(`/api/expenses/${expenseId}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ action, rejection_reason: reason })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(`⚠️ RDBMS CEILING RULE ENFORCED:\n\n${data.detail}`);
      return;
    }

    showToast(`Claim #${expenseId} ${action.toLowerCase()}ed successfully.`, 'success');
    refreshAllData();
  } catch (err) {
    alert(`Action error: ${err.message}`);
  }
}

// --- Submit New Claim Handler ---
async function handleExpenseSubmit(event) {
  event.preventDefault();

  const budgetHeadId = document.getElementById('expense-budget-head-id').value;
  const amount = document.getElementById('expense-amount').value;
  const vendor = document.getElementById('expense-vendor').value;
  const description = document.getElementById('expense-description').value;
  const fileInput = document.getElementById('expense-file');

  const formData = new FormData();
  formData.append('budget_head_id', budgetHeadId);
  formData.append('amount', amount);
  formData.append('vendor_name', vendor);
  formData.append('description', description);

  if (fileInput.files.length > 0) {
    formData.append('invoice_file', fileInput.files[0]);
  }

  const btn = document.getElementById('btn-submit-expense');
  btn.disabled = true;
  btn.innerText = "Processing...";

  try {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Submission failed");

    showToast("Expense claim registered & invoice stored!", 'success');
    closeExpenseModal();
    document.getElementById('form-expense').reset();
    refreshAllData();
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerText = "Submit Claim";
  }
}

// --- Submit New Grant Handler (PI/Auditor) ---
async function handleGrantSubmit(event) {
  event.preventDefault();

  const title = document.getElementById('grant-title').value;
  const code = document.getElementById('grant-code').value;
  const agency = document.getElementById('grant-agency').value;
  const total = parseFloat(document.getElementById('grant-total').value);
  const start = document.getElementById('grant-start').value;
  const end = document.getElementById('grant-end').value;

  const equip = parseFloat(document.getElementById('alloc-equipment').value) || 0;
  const consum = parseFloat(document.getElementById('alloc-consumables').value) || 0;
  const travel = parseFloat(document.getElementById('alloc-travel').value) || 0;
  const manpower = parseFloat(document.getElementById('alloc-manpower').value) || 0;

  if ((equip + consum + travel + manpower) > total) {
    alert("Category allocations exceed total sanctioned grant amount!");
    return;
  }

  const payload = {
    title, grant_code: code, funding_agency: agency,
    total_sanctioned_amount: total, start_date: start, end_date: end,
    equipment_amount: equip, consumables_amount: consum,
    travel_amount: travel, manpower_amount: manpower
  };

  try {
    const res = await fetch('/api/grants', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to create grant");

    showToast(`Grant ${code} initialized with 4 budget categories!`, 'success');
    closeGrantModal();
    document.getElementById('form-grant').reset();
    refreshAllData();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// --- Modals (animated versions at bottom of file) ---

// --- Notifications / Toast ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const icon = type === 'success' ? 'fa-circle-check text-[#65A878]' : type === 'error' ? 'fa-triangle-exclamation text-[#E57373]' : 'fa-circle-info text-[#D97736]';

  toast.className = `bg-[#242424] border border-[#383838] text-[#F5F5F4] text-xs font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2.5 toast-anim`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

function copyPowerBiUrl() {
  const url = `${window.location.origin}/api/analytics/powerbi-export`;
  navigator.clipboard.writeText(url).then(() => {
    showToast("Power BI feed URL copied to clipboard!", "success");
  });
}

/* ====================================================================
   PREMIUM ANIMATIONS ENGINE — GrantFlow
   Pure CSS + Vanilla JS (no external libraries)
   ==================================================================== */

// --- Reduced Motion Detection ---
const gfPrefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- 2. Scroll-Triggered Fade-In (Intersection Observer) ---
function gfInitScrollAnimations() {
  if (gfPrefersReducedMotion) {
    // Immediately show all elements
    document.querySelectorAll('.gf-animate-in, .gf-animate-slide-left, .gf-animate-slide-right, .gf-animate-scale, .gf-scroll-reveal').forEach(el => {
      el.classList.add('gf-visible');
      el.classList.add('gf-revealed');
    });
    return;
  }

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -40px 0px',
    threshold: 0.08
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const delay = el.dataset.gfDelay || 0;
        setTimeout(() => {
          el.classList.add('gf-visible');
          el.classList.add('gf-revealed');
        }, parseInt(delay));
        observer.unobserve(el);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.gf-animate-in, .gf-animate-slide-left, .gf-animate-slide-right, .gf-animate-scale, .gf-scroll-reveal').forEach(el => {
    observer.observe(el);
  });
}

// Apply stagger delays to KPI cards
function gfApplyKPIStagger() {
  const kpiGrid = document.getElementById('kpi-cards-grid');
  if (!kpiGrid) return;
  const cards = kpiGrid.querySelectorAll('.gf-animate-in');
  cards.forEach((card, i) => {
    card.dataset.gfDelay = String(i * 100);
  });
}

// Re-observe dynamically added elements (grants, expenses, audit rows)
function gfObserveDynamic(container) {
  if (gfPrefersReducedMotion || !container) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const delay = el.dataset.gfDelay || 0;
        setTimeout(() => {
          el.classList.add('gf-visible');
        }, parseInt(delay));
        observer.unobserve(el);
      }
    });
  }, { root: null, rootMargin: '0px 0px -20px 0px', threshold: 0.05 });

  container.querySelectorAll('.gf-animate-in, .gf-animate-slide-left, .gf-animate-slide-right, .gf-animate-scale').forEach(el => {
    observer.observe(el);
  });
}

// --- 3. Animated Number Counters ---
function gfAnimateCounter(el, targetValue, duration) {
  if (gfPrefersReducedMotion || !el) return;
  
  // Parse the target text for prefix (₹) and suffix
  const text = el.innerText;
  const prefix = text.match(/^[^\d]*/)?.[0] || '';

  const startTime = performance.now();
  const startValue = 0;

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = startValue + (targetValue - startValue) * eased;

    el.innerText = prefix + currentValue.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

// Patch the dashboard loader to add counter animation
const _originalLoadDashboard = loadDashboardAnalytics;
loadDashboardAnalytics = async function() {
  try {
    const res = await fetch('/api/analytics/summary', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) return;
    const data = await res.json();

    // Counter animation targets
    const kpiSanctioned = document.getElementById('kpi-sanctioned');
    const kpiSpent = document.getElementById('kpi-spent');
    const kpiRemaining = document.getElementById('kpi-remaining');
    const kpiPendingAmount = document.getElementById('kpi-pending-amount');

    if (!gfPrefersReducedMotion) {
      gfAnimateCounter(kpiSanctioned, data.total_sanctioned, 1000);
      gfAnimateCounter(kpiSpent, data.total_spent, 1000);
      gfAnimateCounter(kpiRemaining, data.total_remaining, 1000);
      gfAnimateCounter(kpiPendingAmount, data.pending_claims_amount, 1000);
    } else {
      kpiSanctioned.innerText = `₹${data.total_sanctioned.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
      kpiSpent.innerText = `₹${data.total_spent.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
      kpiRemaining.innerText = `₹${data.total_remaining.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
      kpiPendingAmount.innerText = `₹${data.pending_claims_amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    }

    // Non-currency KPIs set directly
    document.getElementById('kpi-grant-count').innerText = data.total_grants;
    document.getElementById('kpi-utilization-rate').innerText = `${data.overall_utilization_rate}%`;
    document.getElementById('kpi-pending-count').innerText = `${data.pending_claims_count} Claim${data.pending_claims_count === 1 ? '' : 's'}`;

    renderCategoryChart(data.category_breakdown);
    renderBurnRateChart(data.burn_rate_timeline);
  } catch (err) {
    console.error("Failed to load dashboard KPIs:", err);
  }
};

// --- 6. Modal Entrance & Exit Animations ---
function openExpenseModal() {
  const m = document.getElementById('modal-expense');
  m.classList.remove('hidden');
  m.classList.add('flex');
  // Trigger entrance animation on next frame
  requestAnimationFrame(() => {
    m.classList.add('gf-modal-active');
  });
}

function closeExpenseModal() {
  const m = document.getElementById('modal-expense');
  m.classList.remove('gf-modal-active');
  // Wait for exit animation to complete
  if (!gfPrefersReducedMotion) {
    setTimeout(() => {
      m.classList.add('hidden');
      m.classList.remove('flex');
    }, 300);
  } else {
    m.classList.add('hidden');
    m.classList.remove('flex');
  }
}

function openGrantModal() {
  const m = document.getElementById('modal-grant');
  m.classList.remove('hidden');
  m.classList.add('flex');
  requestAnimationFrame(() => {
    m.classList.add('gf-modal-active');
  });
}

function closeGrantModal() {
  const m = document.getElementById('modal-grant');
  m.classList.remove('gf-modal-active');
  if (!gfPrefersReducedMotion) {
    setTimeout(() => {
      m.classList.add('hidden');
      m.classList.remove('flex');
    }, 300);
  } else {
    m.classList.add('hidden');
    m.classList.remove('flex');
  }
}

// --- 7. Section Scroll Navigation (Uses primary switchTab smooth scroll) ---

// --- 8. Button Ripple Effect ---
function gfInitRipple() {
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-primary');
    if (!btn || gfPrefersReducedMotion) return;

    const ripple = document.createElement('span');
    ripple.className = 'gf-ripple';
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';

    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
}

// --- 9. Progress Bar Animations ---
function gfAnimateProgressBars() {
  if (gfPrefersReducedMotion) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const bar = entry.target;
        const targetWidth = bar.dataset.gfWidth || bar.style.width;
        // Store final width then set to 0
        bar.style.width = '0%';
        bar.classList.add('gf-progress-bar');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            bar.style.width = targetWidth;
          });
        });
        observer.unobserve(bar);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.gf-progress-animate').forEach(bar => {
    observer.observe(bar);
  });
}

// Patch grant loader to add animation classes to progress bars and grant cards
const _originalLoadGrants = loadGrants;
loadGrants = async function() {
  await _originalLoadGrants();
  
  // Add animation classes to dynamically created grant cards
  const container = document.getElementById('grants-list-container');
  if (container) {
    container.querySelectorAll('.gf-card').forEach((card, i) => {
      card.classList.add('gf-animate-in');
      card.dataset.gfDelay = String(i * 120);
    });
    
    // Add progress bar animation classes
    container.querySelectorAll('[class*="h-1.5"][class*="rounded-full"][style*="width"]').forEach(bar => {
      if (!bar.classList.contains('overflow-hidden')) {
        bar.dataset.gfWidth = bar.style.width;
        bar.classList.add('gf-progress-animate');
      }
    });
    
    gfObserveDynamic(container);
    gfAnimateProgressBars();
    if (window.gfBindTilt) window.gfBindTilt(container);
  }
};

// Patch expense loader to add animation to table rows
const _originalLoadExpenses = loadExpenses;
loadExpenses = async function() {
  await _originalLoadExpenses();
  
  const tbody = document.getElementById('expenses-table-body');
  if (tbody) {
    tbody.querySelectorAll('tr').forEach((tr, i) => {
      tr.classList.add('gf-animate-in');
      tr.dataset.gfDelay = String(i * 60);
    });
    gfObserveDynamic(tbody);
  }
};

// Patch audit loader to add animation to table rows
const _originalLoadAuditTrail = loadAuditTrail;
loadAuditTrail = async function() {
  await _originalLoadAuditTrail();
  
  const tbody = document.getElementById('audit-table-body');
  if (tbody) {
    tbody.querySelectorAll('tr').forEach((tr, i) => {
      tr.classList.add('gf-animate-in');
      tr.dataset.gfDelay = String(i * 40);
    });
    gfObserveDynamic(tbody);
  }
};

// ====================================================================
// CLEAN MODERNIST INTERACTION ENGINE (NO JITTER / NO SHUFFLING)
// ====================================================================

// --- 10. Background Canvas (Disabled / Clean White Canvas) ---
function gfInitAscoraCanvas() {
  const canvas = document.getElementById('ascora-canvas');
  if (canvas) {
    canvas.style.display = 'none';
  }
}

// --- 11. Cursor Follower Aura (Disabled for Clean Minimalist Look) ---
function gfInitCursorFollower() {
  const glow = document.getElementById('cursor-glow');
  if (glow) {
    glow.style.display = 'none';
  }
}

// --- 12. Calm Card Elevation (Zero Pitch/Tilt Wobble, No Shuffling) ---
function gfInit3DCardTilt() {
  function bindCards(root = document) {
    const cards = root.querySelectorAll('.gf-card');
    cards.forEach(card => {
      if (card.dataset.tiltBound) return;
      card.dataset.tiltBound = 'true';

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Subtle spotlight coordinates without tilting or shuffling the element
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });

      card.addEventListener('mouseleave', () => {
        card.style.removeProperty('--mouse-x');
        card.style.removeProperty('--mouse-y');
      });
    });
  }

  bindCards();
  window.gfBindTilt = bindCards;
}

// --- 13. Interactive Click Celestial Sparks (Light Blue & Cobalt) ---
function gfInitClickSparks() {
  if (gfPrefersReducedMotion) return;

  const sparkColors = ['#60A5FA', '#3B82F6', '#93C5FD', '#1351AA', '#2563EB'];

  document.addEventListener('click', (e) => {
    // Avoid creating sparks when clicking inputs
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

    const count = 6;
    for (let i = 0; i < count; i++) {
      const spark = document.createElement('div');
      spark.className = 'gf-spark';

      const size = 3 + Math.random() * 3.5;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const dist = 24 + Math.random() * 36;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      const color = sparkColors[Math.floor(Math.random() * sparkColors.length)];

      spark.style.width = `${size}px`;
      spark.style.height = `${size}px`;
      spark.style.left = `${e.clientX - size / 2}px`;
      spark.style.top = `${e.clientY - size / 2}px`;
      spark.style.backgroundColor = color;
      spark.style.boxShadow = `0 0 8px ${color}`;
      spark.style.setProperty('--tx', `${tx}px`);
      spark.style.setProperty('--ty', `${ty}px`);

      document.body.appendChild(spark);
      setTimeout(() => spark.remove(), 600);
    }
  });
}

// --- 14. Scrollspy & Floating Persistent Role Dock Visibility ---
function gfInitScrollSpyAndDock() {
  const dock = document.getElementById('floating-role-dock');
  const sections = ['dashboard', 'grants', 'expenses', 'audit', 'powerbi'];
  
  window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY || document.documentElement.scrollTop;

    // Toggle Floating Dock (visible when user scrolls down past 150px)
    if (dock) {
      if (scrollPos > 150) {
        dock.classList.remove('dock-hidden');
      } else {
        dock.classList.add('dock-hidden');
      }
    }

    // Determine current section in viewport for active tab highlight
    let currentSection = 'dashboard';
    for (const secId of sections) {
      const el = document.getElementById(`section-${secId}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 140) {
          currentSection = secId;
        }
      }
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active', 'text-[#1351AA]', 'border-[#1351AA]', 'bg-[#1351AA]/10');
      btn.classList.add('text-[#374151]', 'border-transparent');
    });

    const activeBtn = document.getElementById(`tab-${currentSection}`);
    if (activeBtn) {
      activeBtn.classList.add('active', 'text-[#1351AA]', 'border-[#1351AA]', 'bg-[#1351AA]/10');
      activeBtn.classList.remove('text-[#374151]', 'border-transparent');
    }
  }, { passive: true });
}

// --- Boot up all Ascora & GrantFlow animation systems ---
document.addEventListener('DOMContentLoaded', () => {
  gfApplyKPIStagger();
  gfInitScrollAnimations();
  gfInitScrollSpyAndDock();
  gfInitRipple();
  gfInitAscoraCanvas();
  gfInitCursorFollower();
  gfInit3DCardTilt();
  gfInitClickSparks();
});
