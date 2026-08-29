const state = { token: sessionStorage.getItem('portalToken') || '', type: sessionStorage.getItem('portalType') || '', user: null, currentPage: 'dashboard' };
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate = v => v ? new Date(v).toLocaleString() : '-';
const showLoader = v => $('loader').classList.toggle('hidden', !v);

function showMsg(text, type = 'error', target = 'loginMessage') { 
  $(target).innerHTML = `<div class="message ${type}">${esc(text)}</div>`; 
}

function clearMsg(target = 'loginMessage') { 
  $(target).innerHTML = ''; 
}

const API_URL = '/api/server';

async function callServer(fn, ...args) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fn, args })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Unknown error');
    return result.data;
  } catch (e) {
    throw new Error(e.message || 'Network error');
  }
}

const server = callServer;

function switchLogin(t) {
  const isStudent = t === 'student';
  $('studentTab').classList.toggle('active', isStudent);
  $('authorityTab').classList.toggle('active', !isStudent);
  $('studentLoginForm').classList.toggle('hidden', !isStudent);
  $('authorityLoginForm').classList.toggle('hidden', isStudent);
  clearMsg();
}

async function loginStudentUI(e) {
  e.preventDefault();
  const reg = $('studentReg').value.trim();
  const pass = $('studentPass').value;
  if (!reg || !pass) { showMsg('Please enter both fields'); return; }
  showLoader(true);
  try {
    const result = await server('loginStudent', reg, pass);
    state.token = result.sessionToken;
    state.type = 'STUDENT';
    state.user = result.student;
    sessionStorage.setItem('portalToken', state.token);
    sessionStorage.setItem('portalType', state.type);
    await renderStudentDashboard();
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

async function loginAuthorityUI(e) {
  e.preventDefault();
  const user = $('authorityUser').value.trim();
  const pass = $('authorityPass').value;
  if (!user || !pass) { showMsg('Please enter both fields'); return; }
  showLoader(true);
  try {
    const result = await server('loginAuthority', user, pass);
    state.token = result.sessionToken;
    state.type = 'AUTHORITY';
    state.user = { username: result.username, name: result.name, role: result.role };
    sessionStorage.setItem('portalToken', state.token);
    sessionStorage.setItem('portalType', state.type);
    await renderAuthorityDashboard();
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

function openApp() {
  $('authView').classList.add('hidden');
  $('appView').classList.remove('hidden');
}

function forceLogin(msg) {
  state.token = '';
  state.type = '';
  state.user = null;
  sessionStorage.removeItem('portalToken');
  sessionStorage.removeItem('portalType');
  $('authView').classList.remove('hidden');
  $('appView').classList.add('hidden');
  if (msg) showMsg(msg, 'info');
}

async function renderStudentDashboard() {
  showLoader(true);
  try {
    const dash = await server('getStudentDashboard', state.token);
    state.user = dash.student;
    openApp();
    $('avatar').textContent = dash.student.name.charAt(0).toUpperCase();
    $('userName').textContent = dash.student.name;
    
    const sidebar = `
      <button class="navbtn active" onclick="state.currentPage='dashboard'; renderStudentDashboard()">📊 Dashboard</button>
      <button class="navbtn" onclick="state.currentPage='contests'; renderStudentContests()">🏆 Contests</button>
      <button class="navbtn" onclick="state.currentPage='requests'; renderStudentRequests()">📋 Requests</button>
      <button class="navbtn" onclick="state.currentPage='profile'; renderStudentProfile()">👤 Profile</button>
    `;
    $('sidebar').innerHTML = sidebar;

    const welcomeCard = `
      <div class="welcome-card">
        <div>
          <h2>Welcome back, ${esc(dash.student.name)}!</h2>
          <p>Your contest registration status and requests</p>
        </div>
      </div>
    `;

    const stats = `
      <div class="grid stats">
        <div class="stat acc-green"><div class="label">REGISTERED</div><div class="value">${dash.registeredCount}</div></div>
        <div class="stat acc-red"><div class="label">NOT REGISTERED</div><div class="value">${dash.notRegisteredCount}</div></div>
        <div class="stat acc-orange"><div class="label">NO RESPONSE</div><div class="value">${dash.noResponseCount}</div></div>
        <div class="stat"><div class="label">TOTAL CONTESTS</div><div class="value">${dash.contests.length}</div></div>
      </div>
    `;

    const contests = dash.contests.map(c => {
      const status = c.status === 'ACTIVE' ? 'active' : 'inactive';
      return `
        <div class="card">
          <h3>${esc(c.contestName)}</h3>
          <p class="muted">${esc(c.description || 'No description')}</p>
          <div style="margin:10px 0"><span class="status ${status}">${c.status}</span> <strong>${c.registeredCount}</strong> registered</div>
          <p class="muted" style="font-size:11px">Created by ${esc(c.createdBy)} on ${fmtDate(c.createdAt)}</p>
          ${c.studentResponse !== 'NO_RESPONSE' 
            ? `<div class="locked">✓ Your response: ${c.studentResponse}</div>`
            : c.status === 'ACTIVE'
            ? `<div class="response"><div class="response-row"><button class="btn btn-success btn-small" onclick="submitResponseUI('${c.contestId}', 'YES')">Register</button><button class="btn btn-danger btn-small" onclick="submitResponseUI('${c.contestId}', 'NO')">Not Interested</button></div></div>`
            : `<div class="contest-closed">This contest is no longer accepting registrations</div>`
          }
        </div>
      `;
    }).join('');

    $('mainContent').innerHTML = welcomeCard + stats + `<div class="grid cards">${contests}</div>`;
  } catch (err) {
    showMsg(err.message);
    forceLogin();
  } finally {
    showLoader(false);
  }
}

async function renderStudentContests() {
  showLoader(true);
  try {
    const contests = await server('getContests', state.token);
    const sidebar = `
      <button class="navbtn" onclick="state.currentPage='dashboard'; renderStudentDashboard()">📊 Dashboard</button>
      <button class="navbtn active" onclick="state.currentPage='contests'; renderStudentContests()">🏆 Contests</button>
      <button class="navbtn" onclick="state.currentPage='requests'; renderStudentRequests()">📋 Requests</button>
      <button class="navbtn" onclick="state.currentPage='profile'; renderStudentProfile()">👤 Profile</button>
    `;
    $('sidebar').innerHTML = sidebar;

    const content = `
      <div class="page-title"><h2>All Contests</h2></div>
      <div class="grid cards">${contests.map(c => `
        <div class="card">
          <h3>${esc(c.contestName)}</h3>
          <p class="muted">${esc(c.description || 'No description')}</p>
          <p class="muted" style="font-size:12px">🔗 <a href="${esc(c.contestLink)}" target="_blank">View Contest</a></p>
          <p class="muted" style="font-size:11px">${c.registeredCount} students registered</p>
          <span class="status ${c.status === 'ACTIVE' ? 'active' : 'inactive'}">${c.status}</span>
        </div>
      `).join('')}</div>
    `;
    $('mainContent').innerHTML = content;
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

async function renderStudentRequests() {
  showLoader(true);
  try {
    const requests = await server('getMyRequests', state.token);
    const sidebar = `
      <button class="navbtn" onclick="state.currentPage='dashboard'; renderStudentDashboard()">📊 Dashboard</button>
      <button class="navbtn" onclick="state.currentPage='contests'; renderStudentContests()">🏆 Contests</button>
      <button class="navbtn active" onclick="state.currentPage='requests'; renderStudentRequests()">📋 Requests</button>
      <button class="navbtn" onclick="state.currentPage='profile'; renderStudentProfile()">👤 Profile</button>
    `;
    $('sidebar').innerHTML = sidebar;

    const content = `
      <div class="page-title">
        <div><h2>My Requests</h2><p>Track your correction requests</p></div>
        <button class="btn btn-primary" onclick="openCreateRequestModal()">+ New Request</button>
      </div>
      ${requests.length === 0 ? '<div class="empty">No requests yet</div>' : `
        <div class="panel">
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Type</th><th>Request</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>${requests.map(r => `
                <tr>
                  <td>${esc(r.type)}</td>
                  <td>${esc(r.requestedChange)}</td>
                  <td>${fmtDate(r.date)}</td>
                  <td><span class="status ${r.status === 'pending' ? 'inactive' : r.status === 'approved' ? 'active' : 'inactive'}">${r.status}</span></td>
                </tr>
              `).join('')}</tbody>
            </table>
          </div>
        </div>
      `}
    `;
    $('mainContent').innerHTML = content;
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

async function renderStudentProfile() {
  showLoader(true);
  try {
    const profile = await server('getMyProfile', state.token);
    const sidebar = `
      <button class="navbtn" onclick="state.currentPage='dashboard'; renderStudentDashboard()">📊 Dashboard</button>
      <button class="navbtn" onclick="state.currentPage='contests'; renderStudentContests()">🏆 Contests</button>
      <button class="navbtn" onclick="state.currentPage='requests'; renderStudentRequests()">📋 Requests</button>
      <button class="navbtn active" onclick="state.currentPage='profile'; renderStudentProfile()">👤 Profile</button>
    `;
    $('sidebar').innerHTML = sidebar;

    const content = `
      <div class="page-title"><h2>My Profile</h2></div>
      <div class="panel">
        <div class="form-grid">
          <div class="field"><label>Roll Number</label><input type="text" value="${esc(profile.rollNo)}" disabled></div>
          <div class="field"><label>Year</label><input type="text" value="${esc(profile.year)}" disabled></div>
          <div class="field"><label>Class/Section</label><input type="text" value="${esc(profile.classSec)}" disabled></div>
          <div class="field"><label>Register Number</label><input type="text" value="${esc(profile.regNo)}" disabled></div>
          <div class="field full-span"><label>Name</label><input type="text" value="${esc(profile.name)}" disabled></div>
        </div>
      </div>
    `;
    $('mainContent').innerHTML = content;
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

async function submitResponseUI(contestId, response) {
  showLoader(true);
  try {
    await server('submitContestResponse', state.token, contestId, response);
    showMsg('Response saved successfully!', 'success', 'mainContent');
    await renderStudentDashboard();
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

function openCreateRequestModal() {
  const modal = `
    <form onsubmit="submitRequestUI(event)">
      <div class="field"><label>Request Type</label><input id="reqType" placeholder="e.g., Name Correction" required></div>
      <div class="field"><label>What do you want changed?</label><textarea id="reqChange" placeholder="Describe the change" required></textarea></div>
      <div class="field"><label>Reason</label><textarea id="reqReason" placeholder="Why do you need this change?" required></textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Submit Request</button>
      </div>
    </form>
  `;
  $('modalTitle').textContent = 'Create New Request';
  $('modalBody').innerHTML = modal;
  $('modal').classList.remove('hidden');
}

async function submitRequestUI(e) {
  e.preventDefault();
  const type = $('reqType').value.trim();
  const change = $('reqChange').value.trim();
  const reason = $('reqReason').value.trim();
  if (!type || !change || !reason) { showMsg('All fields required'); return; }
  showLoader(true);
  try {
    await server('createCorrectionRequest', state.token, type, change, reason);
    closeModal();
    showMsg('Request submitted successfully!', 'success', 'mainContent');
    await renderStudentRequests();
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

async function renderAuthorityDashboard() {
  showLoader(true);
  try {
    const dash = await server('getAuthorityDashboard', state.token);
    state.user = dash.authority;
    openApp();
    $('avatar').textContent = dash.authority.name.charAt(0).toUpperCase();
    $('userName').textContent = dash.authority.name;

    const sidebar = `
      <button class="navbtn active" onclick="state.currentPage='dashboard'; renderAuthorityDashboard()">📊 Dashboard</button>
      <button class="navbtn" onclick="state.currentPage='students'; renderAuthorityStudents()">👥 Students</button>
      <button class="navbtn" onclick="state.currentPage='contests'; renderAuthorityContests()">🏆 Contests</button>
      <button class="navbtn" onclick="state.currentPage='requests'; renderAuthorityRequests()">📋 Requests</button>
    `;
    $('sidebar').innerHTML = sidebar;

    const stats = `
      <div class="grid stats">
        <div class="stat"><div class="label">TOTAL STUDENTS</div><div class="value">${dash.totalStudents}</div></div>
        <div class="stat acc-green"><div class="label">TOTAL CONTESTS</div><div class="value">${dash.totalContests}</div></div>
        <div class="stat acc-orange"><div class="label">TOTAL RESPONSES</div><div class="value">${dash.totalResponses}</div></div>
        <div class="stat acc-red"><div class="label">PENDING REQUESTS</div><div class="value">${dash.pendingRequests}</div></div>
      </div>
    `;

    const contests = dash.contestSummary.map(c => `
      <div class="activity-item">
        <div class="who">${esc(c.contestName)}</div>
        <span class="status ${c.status === 'ACTIVE' ? 'active' : 'inactive'}">${c.registeredCount}</span>
      </div>
    `).join('');

    const content = `
      <div class="page-title"><h2>Dashboard</h2><p>Welcome, ${esc(dash.authority.name)} (${esc(dash.authority.role)})</p></div>
      ${stats}
      <div class="dash-cols">
        <div class="panel">
          <h3>Top Contests</h3>
          <div>${contests || '<p class="empty">No contests</p>'}</div>
        </div>
        <div class="panel">
          <h3>Recent Requests</h3>
          ${dash.recentRequests.length === 0 ? '<p class="empty">No requests</p>' : dash.recentRequests.map(r => `
            <div class="activity-item">
              <div><strong>${esc(r.studentName)}</strong><br><span class="muted" style="font-size:11px">${r.type}</span></div>
              <span class="status ${r.status === 'pending' ? 'inactive' : 'active'}">${r.status}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    $('mainContent').innerHTML = content;
  } catch (err) {
    showMsg(err.message);
    forceLogin();
  } finally {
    showLoader(false);
  }
}

async function renderAuthorityStudents() {
  showLoader(true);
  try {
    const students = await server('getStudents', state.token);
    const sidebar = `
      <button class="navbtn" onclick="state.currentPage='dashboard'; renderAuthorityDashboard()">📊 Dashboard</button>
      <button class="navbtn active" onclick="state.currentPage='students'; renderAuthorityStudents()">👥 Students</button>
      <button class="navbtn" onclick="state.currentPage='contests'; renderAuthorityContests()">🏆 Contests</button>
      <button class="navbtn" onclick="state.currentPage='requests'; renderAuthorityRequests()">📋 Requests</button>
    `;
    $('sidebar').innerHTML = sidebar;

    const content = `
      <div class="page-title">
        <div><h2>Students</h2><p>Manage student records</p></div>
        <button class="btn btn-primary" onclick="openAddStudentModal()">+ Add Student</button>
      </div>
      <div class="panel">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Roll No</th><th>Name</th><th>Reg No</th><th>Year</th><th>Class</th><th>Actions</th></tr></thead>
            <tbody>${students.map(s => `
              <tr>
                <td>${esc(s.rollNo)}</td>
                <td>${esc(s.name)}</td>
                <td>${esc(s.regNo)}</td>
                <td>${esc(s.year)}</td>
                <td>${esc(s.classSec)}</td>
                <td><div class="actions"><button class="btn btn-secondary btn-small" onclick="openEditStudentModal('${s.regNo}')">Edit</button><button class="btn btn-danger btn-small" onclick="deleteStudentUI('${s.regNo}')">Delete</button></div></td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>
      </div>
    `;
    $('mainContent').innerHTML = content;
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

async function renderAuthorityContests() {
  showLoader(true);
  try {
    const contests = await server('getContests', state.token);
    const sidebar = `
      <button class="navbtn" onclick="state.currentPage='dashboard'; renderAuthorityDashboard()">📊 Dashboard</button>
      <button class="navbtn" onclick="state.currentPage='students'; renderAuthorityStudents()">👥 Students</button>
      <button class="navbtn active" onclick="state.currentPage='contests'; renderAuthorityContests()">🏆 Contests</button>
      <button class="navbtn" onclick="state.currentPage='requests'; renderAuthorityRequests()">📋 Requests</button>
    `;
    $('sidebar').innerHTML = sidebar;

    const content = `
      <div class="page-title">
        <div><h2>Contests</h2><p>Create and manage contests</p></div>
        <button class="btn btn-primary" onclick="openCreateContestModal()">+ Create Contest</button>
      </div>
      <div class="panel">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Name</th><th>Link</th><th>Status</th><th>Registered</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>${contests.map(c => `
              <tr>
                <td>${esc(c.contestName)}</td>
                <td><a href="${esc(c.contestLink)}" target="_blank">View</a></td>
                <td><span class="status ${c.status === 'ACTIVE' ? 'active' : 'inactive'}">${c.status}</span></td>
                <td>${c.registeredCount}</td>
                <td>${fmtDate(c.createdAt)}</td>
                <td><div class="actions"><button class="btn btn-secondary btn-small" onclick="openContestReportModal('${c.contestId}')">Report</button><button class="btn btn-danger btn-small" onclick="deleteContestUI('${c.contestId}')">Delete</button></div></td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>
      </div>
    `;
    $('mainContent').innerHTML = content;
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

async function renderAuthorityRequests() {
  showLoader(true);
  try {
    const requests = await server('getAllRequests', state.token);
    const sidebar = `
      <button class="navbtn" onclick="state.currentPage='dashboard'; renderAuthorityDashboard()">📊 Dashboard</button>
      <button class="navbtn" onclick="state.currentPage='students'; renderAuthorityStudents()">👥 Students</button>
      <button class="navbtn" onclick="state.currentPage='contests'; renderAuthorityContests()">🏆 Contests</button>
      <button class="navbtn active" onclick="state.currentPage='requests'; renderAuthorityRequests()">📋 Requests</button>
    `;
    $('sidebar').innerHTML = sidebar;

    const content = `
      <div class="page-title"><h2>Correction Requests</h2></div>
      <div class="panel">
        ${requests.length === 0 ? '<div class="empty">No requests</div>' : `
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Student</th><th>Type</th><th>Request</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>${requests.map(r => `
                <tr>
                  <td>${esc(r.studentName)}</td>
                  <td>${esc(r.type)}</td>
                  <td>${esc(r.requestedChange)}</td>
                  <td><span class="status ${r.status === 'pending' ? 'inactive' : r.status === 'approved' ? 'active' : 'inactive'}">${r.status}</span></td>
                  <td>${fmtDate(r.date)}</td>
                  <td><div class="actions"><button class="btn btn-primary btn-small" onclick="openRequestReview('${r.requestId}')">Review</button></div></td>
                </tr>
              `).join('')}</tbody>
            </table>
          </div>
        `}
      </div>
    `;
    $('mainContent').innerHTML = content;
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

function openAddStudentModal() {
  const modal = `
    <form onsubmit="submitAddStudentUI(event)">
      <div class="form-grid">
        <div class="field"><label>Roll Number</label><input id="rollNo" required></div>
        <div class="field"><label>Year</label><input id="year" required></div>
        <div class="field"><label>Class/Section</label><input id="classSec" required></div>
        <div class="field"><label>Register Number</label><input id="regNo" required></div>
      </div>
      <div class="field full-span"><label>Name</label><input id="name" required></div>
      <div class="field full-span"><label>Password</label><input id="password" type="password" required></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Student</button>
      </div>
    </form>
  `;
  $('modalTitle').textContent = 'Add New Student';
  $('modalBody').innerHTML = modal;
  $('modal').classList.remove('hidden');
}

async function submitAddStudentUI(e) {
  e.preventDefault();
  const data = {
    rollNo: $('rollNo').value.trim(),
    year: $('year').value.trim(),
    classSec: $('classSec').value.trim(),
    regNo: $('regNo').value.trim(),
    name: $('name').value.trim(),
    password: $('password').value
  };
  if (!data.rollNo || !data.year || !data.classSec || !data.regNo || !data.name || !data.password) {
    showMsg('All fields required');
    return;
  }
  showLoader(true);
  try {
    await server('addStudent', state.token, data);
    closeModal();
    showMsg('Student added successfully!', 'success', 'mainContent');
    await renderAuthorityStudents();
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

async function deleteStudentUI(regNo) {
  if (!confirm('Are you sure you want to delete this student?')) return;
  showLoader(true);
  try {
    await server('deleteStudent', state.token, regNo);
    showMsg('Student deleted successfully!', 'success', 'mainContent');
    await renderAuthorityStudents();
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

function openEditStudentModal(regNo) {
  // Implementation for edit modal - you can expand this
  showMsg('Edit functionality can be added here');
}

function openCreateContestModal() {
  const modal = `
    <form onsubmit="submitCreateContestUI(event)">
      <div class="field"><label>Contest Name</label><input id="contestName" required></div>
      <div class="field"><label>Contest Link</label><input id="contestLink" type="url" required></div>
      <div class="field"><label>Description</label><textarea id="contestDesc"></textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Contest</button>
      </div>
    </form>
  `;
  $('modalTitle').textContent = 'Create New Contest';
  $('modalBody').innerHTML = modal;
  $('modal').classList.remove('hidden');
}

async function submitCreateContestUI(e) {
  e.preventDefault();
  const data = {
    contestName: $('contestName').value.trim(),
    contestLink: $('contestLink').value.trim(),
    description: $('contestDesc').value.trim()
  };
  if (!data.contestName || !data.contestLink) { showMsg('Contest name and link required'); return; }
  showLoader(true);
  try {
    await server('createContest', state.token, data);
    closeModal();
    showMsg('Contest created successfully!', 'success', 'mainContent');
    await renderAuthorityContests();
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

async function deleteContestUI(contestId) {
  if (!confirm('Are you sure you want to deactivate this contest?')) return;
  showLoader(true);
  try {
    await server('deleteContest', state.token, contestId);
    showMsg('Contest deactivated successfully!', 'success', 'mainContent');
    await renderAuthorityContests();
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

async function openContestReportModal(contestId) {
  showLoader(true);
  try {
    const report = await server('getContestRegistrationList', state.token, contestId);
    const students = report.students.map(s => `
      <tr>
        <td>${esc(s.rollNo)}</td>
        <td>${esc(s.name)}</td>
        <td>${esc(s.regNo)}</td>
        <td><span class="status ${s.status === 'REGISTERED' ? 'active' : s.status === 'NOT REGISTERED' ? 'inactive' : ''}">${s.statusLabel}</span></td>
      </tr>
    `).join('');

    const modal = `
      <div class="report-summary">
        <div class="report-chip registered">✓ Registered: ${report.registeredCount}</div>
        <div class="report-chip not-registered">✗ Not Registered: ${report.notRegisteredCount}</div>
        <div class="report-chip no-response">? No Response: ${report.noResponseCount}</div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Roll No</th><th>Name</th><th>Reg No</th><th>Status</th></tr></thead>
          <tbody>${students}</tbody>
        </table>
      </div>
    `;
    $('modalTitle').textContent = `Contest Report: ${esc(report.contest.contestName)}`;
    $('modalBody').innerHTML = modal;
    $('modal').classList.remove('hidden');
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

async function openRequestReview(requestId) {
  showLoader(true);
  try {
    const details = await server('getAuthorityRequestDetails', state.token, requestId);
    const modal = `
      <div style="display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start">
        <form onsubmit="submitRequestReviewUI(event, '${requestId}')">
          <div class="panel">
            <h3>Student Details</h3>
            <div class="form-grid">
              <div class="field"><label>Roll Number</label><input id="rollNo" value="${esc(details.student.rollNo)}" required></div>
              <div class="field"><label>Year</label><input id="year" value="${esc(details.student.year)}" required></div>
              <div class="field"><label>Class/Section</label><input id="classSec" value="${esc(details.student.classSec)}" required></div>
              <div class="field"><label>Register Number</label><input id="regNo" value="${esc(details.student.regNo)}" required></div>
              <div class="field full-span"><label>Name</label><input id="name" value="${esc(details.student.name)}" required></div>
            </div>
          </div>
          <div class="panel">
            <h3>Authority Response</h3>
            <div class="field"><label>Your Response</label><textarea id="requestAuthorityResponse" placeholder="Enter your response or decision..." required></textarea></div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button type="button" class="btn btn-danger" onclick="rejectRequestFromReview('${requestId}')">Reject</button>
            <button type="submit" class="btn btn-success">Approve & Save</button>
          </div>
        </form>
        <div style="background:#eef4ff;border:1px solid #cfe0ff;border-radius:14px;padding:14px;position:sticky;top:0">
          <div style="font-size:11px;text-transform:uppercase;color:#526581;font-weight:800;margin-bottom:6px">Request Details</div>
          <div style="font-size:17px;font-weight:800;color:#1d4ed8;word-break:break-word">${esc(details.request.requestedChange)}</div>
          <div style="margin-top:10px;font-size:12px;color:#667085;line-height:1.5">
            <strong>Type:</strong> ${esc(details.request.type)}<br>
            <strong>Reason:</strong> ${esc(details.request.reason)}<br>
            <strong>Status:</strong> ${details.request.status}
          </div>
        </div>
      </div>
    `;
    $('modalTitle').textContent = 'Review Correction Request';
    $('modalBody').innerHTML = modal;
    $('modal').classList.remove('hidden');
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

async function submitRequestReviewUI(e, requestId) {
  e.preventDefault();
  const updates = {
    rollNo: $('rollNo').value.trim(),
    year: $('year').value.trim(),
    classSec: $('classSec').value.trim(),
    regNo: $('regNo').value.trim(),
    name: $('name').value.trim()
  };
  const response = $('requestAuthorityResponse').value.trim();
  if (!response) { showMsg('Response required'); return; }
  showLoader(true);
  try {
    await server('applyCorrectionRequest', state.token, requestId, state.user?.username || state.user?.regNo, updates, response);
    closeModal();
    showMsg('Request approved successfully!', 'success', 'mainContent');
    await renderAuthorityRequests();
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

async function rejectRequestFromReview(requestId) {
  const response = $('requestAuthorityResponse')?.value?.trim() || prompt('Enter rejection message:');
  if (!response) return;
  showLoader(true);
  try {
    await server('rejectRequest', state.token, requestId, response);
    closeModal();
    showMsg('Request rejected successfully!', 'success', 'mainContent');
    await renderAuthorityRequests();
  } catch (err) {
    showMsg(err.message);
  } finally {
    showLoader(false);
  }
}

function closeModal() {
  $('modal').classList.add('hidden');
}

async function logoutUI() {
  showLoader(true);
  try {
    await server('logout', state.token);
  } catch (err) {
    console.error('Logout error:', err);
  }
  forceLogin('Logged out successfully');
  showLoader(false);
}

window.addEventListener('load', async () => {
  if (state.token && state.type) {
    showLoader(true);
    try {
      if (state.type === 'STUDENT') {
        await renderStudentDashboard();
      } else {
        await renderAuthorityDashboard();
      }
    } catch (err) {
      console.error('Auto-login failed:', err);
      forceLogin('Session expired. Please login again.');
    } finally {
      showLoader(false);
    }
  }
});
