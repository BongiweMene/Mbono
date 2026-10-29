'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SupportTickets from '@/components/dashboards/Support';

const roles = ['candidate', 'recruiter', 'hiring_manager', 'interviewer', 'support', 'admin'];

async function request(url, method = 'GET', body) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Unable to connect. Check your connection and try again.');
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The server returned an invalid response. Please try again.');
  }
  if (!response.ok) throw new Error(data.error || 'The request could not be completed. Please try again.');
  return data;
}

function BarChart({ title, items, labelKey, valueKey = 'count', unit = '' }) {
  const maxValue = Math.max(...items.map((item) => item[valueKey]), 1);
  return (
    <section className="card admin-chart">
      <h3>{title}</h3>
      {items.length === 0
        ? <p className="admin-empty">No report data yet.</p>
        : <div className="admin-bars" role="list">
          {items.map((item) => (
            <div className="admin-bar-row" role="listitem" key={item[labelKey]}>
              <span className="admin-bar-label">{item[labelKey]}</span>
              <span className="admin-bar-track" aria-label={`${item[valueKey]} ${unit}`}>
                <span className="admin-bar-fill" style={{ width: `${Math.max(3, (item[valueKey] / maxValue) * 100)}%` }} />
              </span>
              <strong>{item[valueKey]}{unit}</strong>
            </div>
          ))}
        </div>}
    </section>
  );
}

export default function AdminDashboard({ user }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filters, setFilters] = useState({ search: '', role: '', auditUser: '', auditAction: '' });
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'candidate', department: '' });
  const [activeSection, setActiveSection] = useState('admin-overview');

  const load = useCallback(async (queryFilters = {}) => {
    setError('');
    try {
      const params = new URLSearchParams(Object.entries(queryFilters).filter(([, value]) => value));
      setData(await request(`/api/admin?${params.toString()}`));
    } catch (loadError) {
      if (loadError.message === 'Not allowed') router.push('/login');
      else setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action, id, fields = {}) {
    setError('');
    setNotice('');
    setWorking(id);
    try {
      await request('/api/admin', 'PATCH', { action, id, ...fields });
      setNotice(action === 'deletion_request'
        ? fields.decision === 'approve' ? 'Data-deletion request approved and data removed.' : 'Data-deletion request declined.'
        : action === 'set_active'
          ? `Account ${fields.active ? 'activated' : 'deactivated'}.`
          : action === 'set_department' ? 'Hiring manager department assignment updated.' : 'User role updated.');
      await load(filters);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setWorking('');
    }
  }

  async function createUser(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setWorking('create-user');
    try {
      await request('/api/admin', 'PATCH', { action: 'create_user', ...newUser });
      setNewUser({ name: '', email: '', password: '', role: 'candidate', department: '' });
      setNotice('Account created. Share its temporary password with the user securely.');
      await load(filters);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setWorking('');
    }
  }

  function showSection(id) {
    setActiveSection(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function processDeletionRequest(target, decision) {
    const actionText = decision === 'approve'
      ? `Permanently delete the account and associated personal data for ${target.email}?`
      : `Decline the data-deletion request from ${target.email}?`;
    if (!window.confirm(actionText)) return;
    await act('deletion_request', target._id, { decision });
  }

  async function logout() {
    setError('');
    try {
      await request('/api/auth', 'POST', { mode: 'logout' });
      router.push('/');
    } catch (logoutError) {
      setError(logoutError.message);
    }
  }

  if (loading) return <main className="wrap"><p>Loading your admin dashboard…</p></main>;
  if (!data) return <main className="wrap"><p className="err" role="alert">{error || 'Unable to load admin data. Refresh the page to try again.'}</p></main>;

  const stats = data.stats || {};
  const reports = data.reports || {};

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-sidebar-brand" href="/dashboard" aria-label="Mbono Career Goals dashboard"><img src="/mbono-career-goals.png" alt="Mbono Career Goals — Building skills, unlocking opportunity" /></a>
        <p className="admin-sidebar-label">Platform administration</p>
        <nav className="admin-sidebar-nav" aria-label="Administrator dashboard">
          {[['admin-overview', 'Dashboard', '▦'], ['admin-users', 'User management', '♙'], ['admin-access', 'Roles and access', '⚿'], ['admin-reports', 'System reports', '▥'], ['admin-security', 'Security monitoring', '◈'], ['admin-audit', 'Audit logs', '▤'], ['admin-settings', 'System settings', '⚙'], ['admin-integrations', 'Integrations', '↗'], ['admin-compliance', 'Compliance', '✓'], ['admin-deletion', 'Data requests', '⌫'], ['admin-support', 'Support tickets', '☎'], ['admin-contacts', 'Contact messages', '✉']].map(([id, label, icon]) => (
            <button key={id} type="button" aria-current={activeSection === id ? 'page' : undefined} onClick={() => showSection(id)}>
              <span aria-hidden="true">{icon}</span><span>{label}</span>
              {id === 'admin-deletion' && data.deletionRequests?.length > 0 && <small>{data.deletionRequests.length}</small>}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-user">
          <span className="admin-sidebar-avatar">{(user.name || 'A').slice(0, 1).toUpperCase()}</span>
          <span className="admin-sidebar-identity">{user.name || 'Administrator'}<small>Administrator</small></span>
          <button className="btn sm ghost" onClick={logout}>Log out</button>
        </div>
      </aside>
      <div className="admin-workspace">
      <div className="wrap admin-dashboard">
      <header className="admin-welcome" hidden={activeSection !== 'admin-overview'}>
        <p>Platform workspace</p>
        <h1>Welcome, {user.name || 'admin'}</h1>
        <span>Manage platform access, review compliance activity and monitor recruitment operations.</span>
        <div className="admin-quick-actions">
          <button className="btn" onClick={() => showSection('admin-users')}>Manage users</button>
          <button className="btn ghost" onClick={() => showSection('admin-access')}>Manage roles</button>
          <button className="btn ghost" onClick={() => showSection('admin-audit')}>View audit logs</button>
          <button className="btn ghost" onClick={() => showSection('admin-settings')}>System settings</button>
          <button className="btn ghost" onClick={() => showSection('admin-integrations')}>Integration status</button>
        </div>
      </header>
      {error && <p className="err" role="alert">{error}</p>}
      {notice && <p className="admin-success" role="status">{notice}</p>}

      <section className="admin-section" id="admin-overview" hidden={activeSection !== 'admin-overview'}>
        <div className="admin-section-heading"><div><h2>Platform overview</h2><p>Live totals from platform records. Monitoring figures are shown as unavailable unless instrumented.</p></div></div>
        <div className="stats admin-stats">
          {[
            ['Registered users', stats.totalUsers],
            ['Active accounts', stats.activeUsers],
            ['Inactive accounts', stats.inactiveUsers],
            ['Security alerts · 7 days', stats.failedLoginAttempts],
            ['Total vacancies', stats.vacancies],
            ['Open vacancies', stats.open],
            ['Awaiting approval', stats.pending],
            ['Applications', stats.applications],
            ['Active candidates', stats.activeCandidates],
            ['New this week', stats.newApplicants],
            ['Interviews', stats.interviews],
            ['Hires', stats.hires],
            ['Hires this month', stats.hiresThisMonth],
          ].map(([label, value]) => <article className="stat" key={label}><b>{value ?? 0}</b>{label}</article>)}
        </div>
        <div className="admin-role-counts">
          {roles.map((role) => <span className="tag" key={role}>{role.replace('_', ' ')}: {stats.usersByRole?.[role] || 0}</span>)}
        </div>
        <div className="admin-health-grid">
          <article className="card admin-health-card"><span className="admin-health-icon">✓</span><div><h3>Database</h3><p>Connected — dashboard data loaded successfully.</p></div><span className="admin-health-status">Connected</span></article>
          <article className="card admin-health-card"><span className="admin-health-icon">✓</span><div><h3>Application API</h3><p>Online — admin data request completed.</p></div><span className="admin-health-status">Online</span></article>
          <article className="card admin-health-card admin-health-unavailable"><span className="admin-health-icon">—</span><div><h3>Service availability</h3><p>No uptime monitoring is configured; availability percentage is unavailable.</p></div><span className="admin-health-status">Not monitored</span></article>
        </div>
      </section>

      <section className="admin-section" id="admin-reports" hidden={activeSection !== 'admin-reports'}>
        <div className="admin-section-heading"><h2>Reports</h2><p>Hiring activity across the platform.</p></div>
        <div className="admin-report-grid">
          <BarChart title="Applications by month" items={reports.applicationsByMonth || []} labelKey="label" />
          <BarChart title="Hires by month" items={reports.hiresByMonth || []} labelKey="label" />
          <BarChart title="Source of hire" items={reports.sourceOfHire || []} labelKey="source" />
          <BarChart title="Top skills in demand" items={reports.topSkills || []} labelKey="skill" />
          <section className="card admin-chart admin-time-hire">
            <h3>Time to hire</h3>
            <strong>{reports.timeToHire === null || reports.timeToHire === undefined ? '—' : `${reports.timeToHire} days`}</strong>
            <p>Average days from application to the latest hired status update.</p>
          </section>
          <section className="card admin-chart admin-aging">
            <h3>Vacancy aging</h3>
            {(reports.vacancyAging || []).length === 0
              ? <p className="admin-empty">No open vacancies to report.</p>
              : reports.vacancyAging.map((vacancy) => (
                <div className="row admin-aging-row" key={`${vacancy.title}-${vacancy.status}`}>
                  <span>{vacancy.title} <small className="tag">{vacancy.status}</small></span><strong>{vacancy.days}d</strong>
                </div>
              ))}
          </section>
        </div>
      </section>

      <section className="admin-section" id="admin-users" hidden={activeSection !== 'admin-users'}>
        <div className="admin-section-heading"><h2>User management</h2><p>Change roles or deactivate access. Passwords and private profile details are not shown.</p></div>
        <form className="card admin-create-user" onSubmit={createUser}>
          <h3>Create account</h3>
          <p>Use a temporary password and share it with the user through a secure channel.</p>
          <div className="admin-create-user-grid">
            <label>Full name<input required maxLength="120" value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} /></label>
            <label>Email<input required type="email" maxLength="254" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} /></label>
            <label>Temporary password<input required type="password" minLength="8" maxLength="128" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} /></label>
            <label>Role<select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value, department: '' })}>{roles.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}</select></label>
            {newUser.role === 'hiring_manager' && <label>Department<select value={newUser.department} onChange={(event) => setNewUser({ ...newUser, department: event.target.value })}><option value="">Unassigned — no department access</option>{(data.departments || []).map((department) => <option key={department} value={department}>{department}</option>)}</select></label>}
          </div>
          <button className="btn" disabled={working === 'create-user'}>{working === 'create-user' ? 'Creating account…' : 'Create account'}</button>
        </form>
        <form className="card admin-filter-form" onSubmit={(event) => { event.preventDefault(); load(filters); }}>
          <label>Search users<input maxLength="100" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Name or email" /></label>
          <label>Filter by role
            <select value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}>
              <option value="">All roles</option>{roles.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
            </select>
          </label>
          <button className="btn sm" type="submit">Filter users</button>
        </form>
        {(data.users || []).length === 0
          ? <p className="card admin-empty">No users match these filters.</p>
          : (data.users || []).map((target) => (
            <article className="card admin-user" key={target._id}>
              <div className="admin-user-identity">
                <strong>{target.name || 'Unnamed user'}</strong>
                <span>{target.email}</span>
                <small>Joined {new Date(target.createdAt).toLocaleDateString()} · {target.active ? 'Active' : 'Deactivated'}</small>
              </div>
              <div className="row admin-user-actions">
                <label className="admin-role-select">Role
                  <select value={target.role} disabled={working === target._id || !target.active} onChange={(event) => act('change_role', target._id, { role: event.target.value })}>
                    {roles.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
                  </select>
                </label>
                {target.role === 'hiring_manager' && <label className="admin-role-select">Department
                  <select value={target.department || ''} disabled={working === target._id || !target.active} onChange={(event) => act('set_department', target._id, { department: event.target.value })}>
                    <option value="">Unassigned — no department access</option>
                    {[...new Set([...(data.departments || []), ...(target.department ? [target.department] : [])])].sort().map((department) => <option key={department} value={department}>{department}</option>)}
                  </select>
                </label>}
                {String(target._id) !== String(user.id) && (
                  <button className={`btn sm ${target.active ? 'ghost' : ''}`} disabled={working === target._id} onClick={() => act('set_active', target._id, { active: !target.active })}>
                    {target.active ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </div>
            </article>
          ))}
      </section>

      <section className="admin-section" id="admin-security" hidden={activeSection !== 'admin-security'}>
        <div className="admin-section-heading"><div><h2>Security monitoring</h2><p>Failed sign-in attempts recorded during the last 30 days. A failed attempt can include an unknown email or inactive account.</p></div><span className="tag">{stats.failedLoginAttempts || 0} in the last 7 days</span></div>
        {(data.securityEvents || []).length === 0
          ? <p className="card admin-empty">No failed sign-in attempts have been recorded in the last 30 days.</p>
          : <div className="admin-audit-list">{data.securityEvents.map((entry) => <article className="card admin-audit-entry" key={entry._id}><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time><span className="tag">{entry.user}</span><p>Failed sign-in attempt</p></article>)}</div>}
        <p className="admin-monitoring-note">Automatic anomaly detection, incident response, and service-availability monitoring are not configured in this application.</p>
      </section>

      <section className="admin-section" id="admin-access" hidden={activeSection !== 'admin-access'}>
        <div className="admin-section-heading"><h2>Role and permissions</h2><p>Role assignment controls application access. Recruitment outcomes remain subject to the existing recruitment authorization rules.</p></div>
        <div className="admin-permission-grid">
          {[
            ['Candidate', 'Manage own profile and CV, apply to open vacancies, and track own applications.'],
            ['Recruiter', 'Manage owned vacancies and recruitment pipeline, and schedule interviews.'],
            ['Hiring manager', 'Review assigned department records, approve vacancies and offers, and submit panel feedback.'],
            ['Interviewer', 'View assigned interviews and submit scorecards; cannot change application status.'],
            ['Admin', 'Manage accounts, platform data, audit records, and privacy requests.'],
          ].map(([title, description]) => <article className="card admin-permission-card" key={title}><span className="tag">{title}</span><p>{description}</p></article>)}
        </div>
        <p className="admin-monitoring-note">Permission policies are enforced in server-side API routes and are not editable from this dashboard.</p>
      </section>

      <section className="admin-section" id="admin-settings" hidden={activeSection !== 'admin-settings'}>
        <div className="admin-section-heading"><h2>System configuration</h2><p>Options below reflect existing vacancy records and application workflow; this is not a separate settings store.</p></div>
        <div className="admin-config-grid">
          <article className="card"><h3>Departments</h3>{(data.departments || []).length ? <div className="admin-config-tags">{data.departments.map((item) => <span className="tag" key={item}>{item}</span>)}</div> : <p className="admin-empty">Departments appear when vacancies are added.</p>}</article>
          <article className="card"><h3>Vacancy categories</h3>{(data.industries || []).length ? <div className="admin-config-tags">{data.industries.map((item) => <span className="tag" key={item}>{item}</span>)}</div> : <p className="admin-empty">No vacancy industries have been recorded.</p>}</article>
          <article className="card"><h3>Employment types</h3>{(data.jobTypes || []).length ? <div className="admin-config-tags">{data.jobTypes.map((item) => <span className="tag" key={item}>{item}</span>)}</div> : <p className="admin-empty">No employment types have been recorded.</p>}</article>
          <article className="card"><h3>Recruitment stages</h3><div className="admin-config-tags">{['Received', 'Under Review', 'Shortlisted', 'Assessment', 'Interview', 'Offer Made', 'Hired', 'Rejected'].map((stage) => <span className="tag" key={stage}>{stage}</span>)}</div><p>Workflow stages are defined by the application and are not editable here.</p></article>
        </div>
      </section>

      <section className="admin-section" id="admin-integrations" hidden={activeSection !== 'admin-integrations'}>
        <div className="admin-section-heading"><h2>Integration status</h2><p>Integration health is unavailable unless a dedicated connection check is configured.</p></div>
        <div className="admin-integration-grid">
          {['Microsoft Entra ID', 'Outlook Calendar', 'Microsoft Teams', 'Email delivery', 'AI services'].map((integration) => <article className="card admin-integration" key={integration}><span className="admin-integration-dot" /><div><h3>{integration}</h3><p>No integration health check is configured.</p></div><span className="tag">Unverified</span></article>)}
        </div>
      </section>

      <section className="admin-section" id="admin-compliance" hidden={activeSection !== 'admin-compliance'}>
        <div className="admin-section-heading"><h2>Compliance overview</h2><p>Consent and data-deletion records currently available in user accounts.</p></div>
        <div className="stats admin-compliance-stats">
          <article className="stat"><b>{stats.consentGranted || 0}</b>Consent recorded</article>
          <article className="stat"><b>{stats.consentMissing || 0}</b>Consent not recorded</article>
          <article className="stat"><b>{data.deletionRequests?.length || 0}</b>Deletion requests pending</article>
        </div>
        <p className="admin-monitoring-note">No configurable data-retention schedule or data-access request workflow is currently available.</p>
      </section>

      <section className="admin-section" id="admin-deletion" hidden={activeSection !== 'admin-deletion'}>
        <div className="admin-section-heading"><h2>POPIA data-deletion requests</h2><span className="tag">{data.deletionRequests?.length || 0} pending</span></div>
        {(data.deletionRequests || []).length === 0
          ? <p className="card admin-empty">No data-deletion requests are waiting for review.</p>
          : data.deletionRequests.map((target) => (
            <article className="card admin-user" key={target._id}>
              <div className="admin-user-identity"><strong>{target.name || 'User'}</strong><span>{target.email}</span><small>{target.role} · Requested {new Date(target.createdAt).toLocaleDateString()}</small></div>
              <div className="row admin-user-actions">
                <button className="btn sm red" disabled={working === target._id} onClick={() => processDeletionRequest(target, 'approve')}>Approve deletion</button>
                <button className="btn sm ghost" disabled={working === target._id} onClick={() => processDeletionRequest(target, 'decline')}>Decline</button>
              </div>
            </article>
          ))}
      </section>

      <section className="admin-section" id="admin-audit" hidden={activeSection !== 'admin-audit'}>
        <div className="admin-section-heading"><h2>Audit log</h2><p>Review sign-ins, profile changes, hiring actions, and feedback events.</p></div>
        <form className="card admin-filter-form" onSubmit={(event) => { event.preventDefault(); load(filters); }}>
          <label>Filter by user<input maxLength="100" value={filters.auditUser} onChange={(event) => setFilters({ ...filters, auditUser: event.target.value })} placeholder="Email or deleted user" /></label>
          <label>Filter by action<input maxLength="100" value={filters.auditAction} onChange={(event) => setFilters({ ...filters, auditAction: event.target.value })} placeholder="e.g. profile updated" /></label>
          <button className="btn sm" type="submit">Filter audit log</button>
        </form>
        {(data.audit || []).length === 0
          ? <p className="card admin-empty">No audit entries match these filters.</p>
          : <div className="admin-audit-list">
            {(data.audit || []).map((entry) => (
              <article className="card admin-audit-entry" key={entry._id}>
                <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
                <span className="tag">{entry.user}</span>
                <p>{entry.action}</p>
              </article>
            ))}
          </div>}
      </section>
            <section className="admin-section" id="admin-support" hidden={activeSection !== 'admin-support'}>
        <div className="admin-section-heading"><div><h2>Support tickets</h2><p>Escalated chatbot conversations and messages left for the support team.</p></div></div>
        {activeSection === 'admin-support' && <SupportTickets />}
      </section>
      <section className="admin-section" id="admin-contacts" hidden={activeSection !== 'admin-contacts'}>
        <div className="admin-section-heading"><h2>Public contact messages</h2><span className="tag">{data.contacts?.length || 0}</span></div>
        {(data.contacts || []).length === 0
          ? <p className="card admin-empty">No public contact messages yet.</p>
          : data.contacts.map((contact) => (
            <article className="card admin-contact" key={contact._id}>
              <div className="row"><div><h3>{contact.subject || 'General enquiry'}</h3><p>{contact.name} · <a href={`mailto:${contact.email}`}>{contact.email}</a>{contact.phone && ` · ${contact.phone}`}</p></div><time dateTime={contact.createdAt}>{new Date(contact.createdAt).toLocaleDateString()}</time></div>
              <p>{contact.message}</p>
            </article>
          ))}
      </section>
      </div>
      </div>
    </main>
  );
}
