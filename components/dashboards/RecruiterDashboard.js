'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const stages = [
  { title: 'Applied', status: 'Received' },
  { title: 'Screening', status: 'Under Review' },
  { title: 'Shortlisted', status: 'Shortlisted' },
  { title: 'Assessment', status: 'Assessment' },
  { title: 'Interview', status: 'Interview' },
  { title: 'Offer', status: 'Offer Made' },
  { title: 'Hired', status: 'Hired' },
];
const recruiterMoveStatuses = ['Received', 'Under Review', 'Shortlisted', 'Assessment', 'Interview', 'Offer Made', 'Rejected'];

const emptyVacancy = {
  title: '',
  location: '',
  industry: '',
  department: '',
  type: '',
  salary: '',
  deadline: '',
  skills: '',
  description: '',
};

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

function daysUntil(deadline) {
  if (!deadline) return 'No deadline';
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (days < 0) return `Deadline passed ${Math.abs(days)}d ago`;
  if (days === 0) return 'Deadline today';
  return `${days}d to deadline`;
}

function candidateMatch(application) {
  const required = [...new Set((application.job?.skills || []).map((skill) => skill.trim()).filter(Boolean))];
  const skills = new Set((application.candidate?.skills || []).map((skill) => skill.toLowerCase()));
  const matched = required.filter((skill) => skills.has(skill.toLowerCase()));
  return { matched, missing: required.filter((skill) => !skills.has(skill.toLowerCase())) };
}

export default function RecruiterDashboard({ user }) {
  const router = useRouter();
  const [activeView, setActiveView] = useState('dashboard');
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState(null);
  const [chats, setChats] = useState([]);
  const [vacancy, setVacancy] = useState(emptyVacancy);
  const [editingJob, setEditingJob] = useState('');
  const [notes, setNotes] = useState({});
  const [interviews, setInterviews] = useState({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [draggedId, setDraggedId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [jobResult, applicationResult, adminResult, chatResult] = await Promise.all([
        request('/api/jobs'),
        request('/api/applications'),
        request('/api/admin'),
        request('/api/chat'),
      ]);
      setJobs(jobResult);
      setApplications(applicationResult);
      setStats(adminResult.stats);
      setChats(chatResult);
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

  const applicationCounts = useMemo(() => {
    const counts = {};
    for (const application of applications) {
      const jobId = application.job?._id;
      if (jobId) counts[jobId] = (counts[jobId] || 0) + 1;
    }
    return counts;
  }, [applications]);

  const topMatches = useMemo(
    () => applications
      .filter((application) => application.status === 'Received')
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5),
    [applications],
  );
  const toScreen = applications.filter((application) => application.status === 'Received');
  const overdueFeedback = applications.filter((application) =>
    application.status === 'Interview'
    && application.interviewDate
    && new Date(application.interviewDate) < new Date()
    && !(application.scorecards || []).length);
  const scheduledInterviews = applications
    .filter((application) => application.status === 'Interview' && application.interviewDate && new Date(application.interviewDate) >= new Date())
    .sort((a, b) => new Date(a.interviewDate) - new Date(b.interviewDate));
  const upcomingInterviewConflicts = scheduledInterviews.filter((application, index) => {
    const assignment = application.interviewer?._id || application.panelMembers?.[0]?._id;
    return assignment && scheduledInterviews.some((other, otherIndex) => otherIndex !== index
      && new Date(other.interviewDate).getTime() === new Date(application.interviewDate).getTime()
      && String(other.interviewer?._id || other.panelMembers?.[0]?._id) === String(assignment));
  });
  const expiringVacancies = jobs.filter((job) => job.status === 'open' && job.deadline
    && new Date(job.deadline) >= new Date()
    && new Date(job.deadline) <= new Date(Date.now() + 7 * 86400000));
  const pipelineSummary = stages.map((stage) => ({
    ...stage,
    count: applications.filter((application) => application.status === stage.status).length,
  }));
  const applicationSources = applications.reduce((counts, application) => {
    const source = application.source || 'Not recorded';
    counts[source] = (counts[source] || 0) + 1;
    return counts;
  }, {});
  const hires = applications.filter((application) => application.status === 'Hired');
  const averageTimeToHire = hires.length
    ? Math.round(hires.reduce((sum, application) => {
      const hiredDate = new Date(application.hiredAt || application.updatedAt);
      return sum + Math.max(0, (hiredDate - new Date(application.createdAt)) / 86400000);
    }, 0) / hires.length)
    : null;
  const recentActivity = [...applications].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 6);

  async function submitVacancy(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setWorking('vacancy');
    try {
      const body = { ...vacancy, skills: vacancy.skills };
      if (editingJob) {
        await request('/api/jobs', 'PATCH', { id: editingJob, ...body });
        setNotice('Vacancy updated. Its approval status has not changed.');
      } else {
        await request('/api/jobs', 'POST', body);
        setNotice('Vacancy submitted for approval.');
      }
      setVacancy(emptyVacancy);
      setEditingJob('');
      await load();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setWorking('');
    }
  }

  function editJob(job) {
    setEditingJob(job._id);
    setVacancy({
      title: job.title || '',
      location: job.location || '',
      industry: job.industry || '',
      department: job.department || '',
      type: job.type || '',
      salary: job.salary || '',
      deadline: job.deadline ? new Date(job.deadline).toISOString().slice(0, 10) : '',
      skills: (job.skills || []).join(', '),
      description: job.description || '',
    });
    document.getElementById('post-vacancy')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function duplicateJob(jobId) {
    setError('');
    setWorking(jobId);
    try {
      await request('/api/jobs', 'POST', { duplicateId: jobId });
      setNotice('Vacancy duplicated and submitted as a new pending vacancy.');
      await load();
    } catch (duplicateError) {
      setError(duplicateError.message);
    } finally {
      setWorking('');
    }
  }

  async function closeJob(jobId) {
    setError('');
    setWorking(jobId);
    try {
      await request('/api/jobs', 'PATCH', { id: jobId, status: 'closed' });
      setNotice('Vacancy closed.');
      await load();
    } catch (closeError) {
      setError(closeError.message);
    } finally {
      setWorking('');
    }
  }

  async function changeStage(applicationId, status) {
    setError('');
    setNotice('');
    setWorking(applicationId);
    try {
      await request('/api/applications', 'PATCH', { id: applicationId, status });
      setNotice(`Application moved to ${stages.find((stage) => stage.status === status)?.title || status}.`);
      await load();
    } catch (stageError) {
      setError(stageError.message);
      await load();
    } finally {
      setWorking('');
      setDraggedId('');
    }
  }

  async function saveNote(applicationId) {
    const note = (notes[applicationId] || '').trim();
    if (!note) {
      setError('Write a note before saving it.');
      return;
    }
    setError('');
    setWorking(applicationId);
    try {
      await request('/api/applications', 'PATCH', { id: applicationId, note });
      setNotes((current) => ({ ...current, [applicationId]: '' }));
      setNotice('Screening note saved.');
      await load();
    } catch (noteError) {
      setError(noteError.message);
    } finally {
      setWorking('');
    }
  }

  async function scheduleInterview(event, applicationId) {
    event.preventDefault();
    const values = interviews[applicationId] || {};
    if (!values.date || !values.link || !values.interviewerEmail) {
      setError('Add an interview date, meeting link and interviewer email before scheduling.');
      return;
    }
    setError('');
    setWorking(applicationId);
    try {
      await request('/api/applications', 'PATCH', {
        id: applicationId,
        status: 'Interview',
        interviewDate: new Date(values.date).toISOString(),
        meetingLink: values.link,
        interviewerEmail: values.interviewerEmail,
      });
      setNotice('Interview scheduled and the candidate and interviewer have been notified.');
      setInterviews((current) => ({ ...current, [applicationId]: {} }));
      await load();
    } catch (scheduleError) {
      setError(scheduleError.message);
    } finally {
      setWorking('');
    }
  }

  async function resolveChat(chatId) {
    setError('');
    setWorking(chatId);
    try {
      await request('/api/chat', 'PATCH', { id: chatId });
      setNotice('Human chat request marked as handled.');
      await load();
    } catch (chatError) {
      setError(chatError.message);
    } finally {
      setWorking('');
    }
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

  if (loading) return <main className="candidate-loading"><p>Loading your recruiter dashboard…</p></main>;

  return (
    <main className="recruiter-shell">
      <aside className="recruiter-sidebar">
        <a className="recruiter-brand" href="/dashboard" aria-label="Mbono Career Goals dashboard"><img src="/mbono-career-goals.png" alt="Mbono Career Goals — Building skills, unlocking opportunity" /></a>
        <p className="recruiter-sidebar-label">Recruitment workspace</p>
        <nav className="recruiter-side-nav" aria-label="Recruiter dashboard">
          {[
            ['dashboard', '▦', 'Dashboard'],
            ['vacancies', '▤', 'Vacancies'],
            ['candidates', '♙', 'Candidates'],
            ['interviews', '◷', 'Interviews'],
            ['tasks', '✓', 'Tasks'],
            ['reports', '▥', 'Reports'],
          ].map(([view, icon, label]) => (
            <button type="button" className={activeView === view ? 'active' : ''} key={view} onClick={() => setActiveView(view)} aria-current={activeView === view ? 'page' : undefined}>
              <span aria-hidden="true">{icon}</span>{label}
              {view === 'tasks' && (toScreen.length + overdueFeedback.length + expiringVacancies.length > 0)
                && <span className="recruiter-nav-count">{toScreen.length + overdueFeedback.length + expiringVacancies.length}</span>}
            </button>
          ))}
        </nav>
        <div className="recruiter-sidebar-bottom">
          <span className="recruiter-sidebar-avatar">{(user.name || 'R').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
          <span className="recruiter-sidebar-user">{user.name || 'Recruiter'}<small>Recruiter account</small></span>
          <button type="button" className="recruiter-logout" onClick={logout} aria-label="Log out">↪</button>
        </div>
      </aside>
      <div className="recruiter-main">
        <header className="recruiter-topbar">
          <span className="recruiter-top-title">{activeView === 'dashboard' ? 'Overview' : activeView[0].toUpperCase() + activeView.slice(1)}</span>
          <div className="recruiter-top-actions">
            <button className="btn sm ghost" type="button" onClick={() => setActiveView('tasks')}>Tasks <span className="tag">{toScreen.length + overdueFeedback.length}</span></button>
            <span className="recruiter-top-name">{user.name}</span>
          </div>
        </header>
        <div className="recruiter-content">
      {error && <p className="err" role="alert">{error}</p>}
      {notice && <p className="recruiter-success" role="status">{notice}</p>}

      <header className="recruiter-welcome" hidden={activeView !== 'dashboard'}>
        <p>Recruitment workspace</p>
        <h1>Welcome back, {user.name || 'recruiter'}</h1>
        <span>Manage vacancies, review applicants and move great candidates forward.</span>
        <div className="recruiter-quick-actions">
          <button className="btn alt" onClick={() => setActiveView('vacancies')}>Create vacancy</button>
          <button className="btn recruiter-action-secondary" onClick={() => setActiveView('candidates')}>View candidates</button>
          <button className="btn recruiter-action-secondary" onClick={() => setActiveView('candidates')}>Review applications</button>
          <button className="btn recruiter-action-secondary" onClick={() => setActiveView('interviews')}>Schedule interview</button>
          <button className="btn recruiter-action-secondary" onClick={() => setActiveView('reports')}>Generate report</button>
        </div>
      </header>

      <section className="stats recruiter-stats" aria-label="Recruitment statistics" hidden={activeView !== 'dashboard'}>
        {[
          ['Active vacancies', stats?.activeVacancies],
          ['Applications received', stats?.applications],
          ['Candidates to review', toScreen.length],
          ['Interviews scheduled', stats?.interviewsScheduled],
          ['Hires this month', stats?.hiresThisMonth],
        ].map(([label, value]) => <div className="stat" key={label}><b>{value ?? 0}</b>{label}</div>)}
      </section>

      <section className="recruiter-overview-grid" hidden={activeView !== 'dashboard'}>
        <article className="card recruiter-overview-card recruiter-pipeline-health">
          <div className="recruiter-section-heading"><h2>Pipeline health</h2><p>{applications.length} applications in your current recruiter view</p></div>
          <div className="recruiter-health-bar" aria-label="Application pipeline distribution">
            {pipelineSummary.filter((stage) => stage.count > 0).map((stage) => (
              <span key={stage.status} title={`${stage.title}: ${stage.count}`} style={{ flexGrow: stage.count }} />
            ))}
          </div>
          <div className="recruiter-health-grid">
            {pipelineSummary.map((stage) => <div key={stage.status}><span>{stage.title}</span><strong>{stage.count}</strong></div>)}
          </div>
          <button type="button" className="link" onClick={() => setActiveView('candidates')}>Open candidate pipeline →</button>
        </article>
        <article className="card recruiter-overview-card">
          <div className="recruiter-section-heading"><h2>Upcoming interviews</h2><p>Next appointments for your vacancies</p></div>
          {scheduledInterviews.slice(0, 3).map((application) => (
            <div className="recruiter-interview-row" key={application._id}>
              <strong>{application.candidate?.name || 'Candidate'}</strong>
              <span>{application.job?.title || 'Vacancy'}</span>
              <small>{new Date(application.interviewDate).toLocaleString()}</small>
            </div>
          ))}
          {scheduledInterviews.length === 0 && <p className="recruiter-empty">No interviews scheduled yet.</p>}
          <button type="button" className="link" onClick={() => setActiveView('interviews')}>View interview schedule →</button>
        </article>
      </section>

      <section className="recruiter-section" hidden={!['dashboard', 'candidates'].includes(activeView)}>
        <div className="row recruiter-section-heading"><div><h2>Applicant pipeline</h2><p>Drag a candidate card to update its stage. Offers and hires require approval.</p></div></div>
        <div className="recruiter-pipeline">
          {stages.map((stage) => {
            const stageApplications = applications.filter((application) => application.status === stage.status);
            return (
              <section
                className={`recruiter-lane${draggedId ? ' can-drop' : ''}`}
                key={stage.status}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedId) changeStage(draggedId, stage.status);
                }}
              >
                <header><h3>{stage.title}</h3><span className="tag">{stageApplications.length}</span></header>
                {stageApplications.length === 0 && <p className="recruiter-lane-empty">No candidates</p>}
                {stageApplications.map((application) => (
                  <article
                    className={`card recruiter-pipeline-card${working === application._id ? ' is-working' : ''}`}
                    key={application._id}
                    draggable={working !== application._id}
                    onDragStart={(event) => {
                      setDraggedId(application._id);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', application._id);
                    }}
                    onDragEnd={() => setDraggedId('')}
                  >
                    <strong>{application.candidate?.name || 'Candidate'}</strong>
                    <span>{application.job?.title || 'Vacancy'}</span>
                    <span className="tag">Match {application.score || 0}%</span>
                    <label className="recruiter-stage-control">Move stage
                      <select value={application.status} onChange={(event) => changeStage(application._id, event.target.value)}>
                        {[...recruiterMoveStatuses, ...(recruiterMoveStatuses.includes(application.status) ? [] : [application.status])].map((status) => (
                          <option key={status} value={status}>{stages.find((stageOption) => stageOption.status === status)?.title || status}</option>
                        ))}
                      </select>
                    </label>
                    <form className="recruiter-pipeline-note" onSubmit={(event) => { event.preventDefault(); saveNote(application._id); }} onDragStart={(event) => event.stopPropagation()}>
                      <label>Screening note<textarea rows="2" maxLength="2000" value={notes[application._id] || ''} onChange={(event) => setNotes({ ...notes, [application._id]: event.target.value })} /></label>
                      <button className="btn sm ghost" disabled={working === application._id}>Save note</button>
                    </form>
                    {['Shortlisted', 'Assessment'].includes(application.status) && (
                      <form className="recruiter-schedule" onSubmit={(event) => scheduleInterview(event, application._id)} onDragStart={(event) => event.stopPropagation()}>
                        <label>Date and time<input required type="datetime-local" value={interviews[application._id]?.date || ''} onChange={(event) => setInterviews({ ...interviews, [application._id]: { ...interviews[application._id], date: event.target.value } })} /></label>
                        <label>Meeting link<input required type="url" placeholder="https://" value={interviews[application._id]?.link || ''} onChange={(event) => setInterviews({ ...interviews, [application._id]: { ...interviews[application._id], link: event.target.value } })} /></label>
                        <label>Interviewer email<input required type="email" placeholder="interviewer@mbono.co.za" value={interviews[application._id]?.interviewerEmail || ''} onChange={(event) => setInterviews({ ...interviews, [application._id]: { ...interviews[application._id], interviewerEmail: event.target.value } })} /></label>
                        <button className="btn sm" disabled={working === application._id}>{working === application._id ? 'Scheduling…' : 'Schedule interview'}</button>
                      </form>
                    )}
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      </section>

      <div className="recruiter-columns" hidden={!['dashboard', 'candidates', 'vacancies'].includes(activeView)}>
        <section className="recruiter-section" hidden={!['dashboard', 'candidates'].includes(activeView)}>
          <div className="recruiter-section-heading"><h2>Top matches</h2><p>Highest scoring new applicants awaiting review.</p></div>
          {topMatches.length === 0
            ? <p className="card recruiter-empty">No new applicants to review right now.</p>
            : topMatches.map((application) => (
              <article className="card recruiter-match" key={application._id}>
                <div className="row"><div><strong>{application.candidate?.name || 'Candidate'}</strong><p>{application.job?.title || 'Vacancy'}</p></div><span className="tag">Match {application.score || 0}%</span></div>
                <p className="recruiter-match-explanation">{candidateMatch(application).matched.length
                  ? `Matches ${candidateMatch(application).matched.join(', ')}.`
                  : 'No required skills matched from the available profile details.'}</p>
                {candidateMatch(application).missing.length > 0 && <p className="recruiter-missing-skills">Missing required skills: {candidateMatch(application).missing.join(', ')}</p>}
                <small className="recruiter-human-review">Matching is a screening aid only. Review each candidate’s full application.</small>
                <label>Add a screening note<textarea rows="2" maxLength="2000" value={notes[application._id] || ''} onChange={(event) => setNotes({ ...notes, [application._id]: event.target.value })} /></label>
                <div className="row recruiter-match-actions">
                  <button className="btn sm ghost" disabled={working === application._id} onClick={() => saveNote(application._id)}>Save note</button>
                  <button className="btn sm" disabled={working === application._id} onClick={() => changeStage(application._id, 'Under Review')}>Start screening</button>
                </div>
              </article>
            ))}
        </section>

        <section className="recruiter-section" id="post-vacancy" hidden={!['dashboard', 'vacancies'].includes(activeView)}>
          <div className="recruiter-section-heading"><h2>{editingJob ? 'Edit vacancy' : 'Post a vacancy'}</h2><p>{editingJob ? 'Edits do not change the vacancy approval status.' : 'New vacancies are submitted for approval.'}</p></div>
          <form className="card recruiter-vacancy-form" onSubmit={submitVacancy}>
            <label>Job title<input required maxLength="160" value={vacancy.title} onChange={(event) => setVacancy({ ...vacancy, title: event.target.value })} /></label>
            <label>Location<input required maxLength="160" value={vacancy.location} onChange={(event) => setVacancy({ ...vacancy, location: event.target.value })} /></label>
            <div className="recruiter-form-grid">
              <label>Industry<input maxLength="120" value={vacancy.industry} onChange={(event) => setVacancy({ ...vacancy, industry: event.target.value })} /></label>
              <label>Department<input maxLength="120" value={vacancy.department} onChange={(event) => setVacancy({ ...vacancy, department: event.target.value })} /></label>
              <label>Employment type<input required maxLength="80" placeholder="Full-time, Internship…" value={vacancy.type} onChange={(event) => setVacancy({ ...vacancy, type: event.target.value })} /></label>
              <label>Salary<input maxLength="100" value={vacancy.salary} onChange={(event) => setVacancy({ ...vacancy, salary: event.target.value })} /></label>
              <label>Application deadline<input type="date" value={vacancy.deadline} onChange={(event) => setVacancy({ ...vacancy, deadline: event.target.value })} /></label>
              <label>Skills (comma separated)<input value={vacancy.skills} onChange={(event) => setVacancy({ ...vacancy, skills: event.target.value })} /></label>
            </div>
            <label>Description<textarea required rows="5" maxLength="5000" value={vacancy.description} onChange={(event) => setVacancy({ ...vacancy, description: event.target.value })} /></label>
            <div className="row recruiter-form-actions">
              <button className="btn" disabled={working === 'vacancy'}>{working === 'vacancy' ? 'Saving…' : editingJob ? 'Save changes' : 'Submit for approval'}</button>
              {editingJob && <button className="btn ghost" type="button" onClick={() => { setEditingJob(''); setVacancy(emptyVacancy); }}>Cancel edit</button>}
            </div>
          </form>
        </section>
      </div>

      <section className="recruiter-section" hidden={!['dashboard', 'vacancies'].includes(activeView)}>
        <div className="recruiter-section-heading"><h2>My vacancies</h2><p>Track status, applications and closing dates for your roles.</p></div>
        {jobs.length === 0
          ? <p className="card recruiter-empty">You have no vacancies yet. Post your first vacancy above.</p>
          : jobs.map((job) => (
            <article className="card recruiter-vacancy" key={job._id}>
              <div className="recruiter-vacancy-summary">
                <h3>{job.title}</h3>
                <p>{[job.location, job.department, job.type].filter(Boolean).join(' · ')}</p>
                <div className="row recruiter-vacancy-meta"><span className="tag">{job.status}</span><span>{applicationCounts[job._id] || 0} applicants</span><span>{daysUntil(job.deadline)}</span></div>
              </div>
              <div className="row recruiter-vacancy-actions">
                <button className="btn sm ghost" disabled={working === job._id} onClick={() => editJob(job)}>Edit</button>
                <button className="btn sm ghost" disabled={working === job._id} onClick={() => duplicateJob(job._id)}>Duplicate</button>
                {job.status !== 'closed' && <button className="btn sm red" disabled={working === job._id} onClick={() => closeJob(job._id)}>Close</button>}
              </div>
            </article>
          ))}
      </section>

      <div className="recruiter-columns" hidden={!['dashboard', 'tasks'].includes(activeView)}>
        <section className="recruiter-section" hidden={!['dashboard', 'tasks'].includes(activeView)}>
          <div className="recruiter-section-heading"><h2>Tasks</h2><p>Keep screening and interview feedback moving.</p></div>
          <article className="card recruiter-task">
            <strong>Applicants to screen</strong>
            {toScreen.length ? <span>{toScreen.length} new applicant{toScreen.length === 1 ? '' : 's'} awaiting review</span> : <span>All caught up. No applicants to screen.</span>}
          </article>
          <article className="card recruiter-task">
            <strong>Overdue interview feedback</strong>
            {overdueFeedback.length
              ? <><span>{overdueFeedback.length} interview{overdueFeedback.length === 1 ? '' : 's'} need feedback</span>{overdueFeedback.slice(0, 5).map((application) => <span key={application._id}>{application.candidate?.name || 'Candidate'} · {application.job?.title || 'Vacancy'}</span>)}</>
              : <span>No overdue interview feedback.</span>}
          </article>
          <article className="card recruiter-task">
            <strong>Vacancies closing soon</strong>
            {expiringVacancies.length
              ? expiringVacancies.map((job) => <span key={job._id}>{job.title} · {daysUntil(job.deadline)}</span>)
              : <span>No open vacancies are due within seven days.</span>}
          </article>
        </section>

        <section className="recruiter-section" hidden={!['dashboard', 'tasks'].includes(activeView)}>
          <div className="recruiter-section-heading"><h2>Waiting chats</h2><p>Candidates who asked to speak with a person.</p></div>
          {!Array.isArray(chats) || chats.length === 0
            ? <p className="card recruiter-empty">No waiting chats.</p>
            : chats.map((chat) => (
              <article className="card recruiter-chat" key={chat._id}>
                <div><strong>{chat.user === 'anonymous' ? 'Guest candidate' : chat.user}</strong><p>{chat.text}</p><small>{new Date(chat.createdAt).toLocaleString()}</small></div>
                <button className="btn sm ghost" disabled={working === chat._id} onClick={() => resolveChat(chat._id)}>Mark handled</button>
              </article>
            ))}
        </section>
      </div>
      <section className="recruiter-section recruiter-focus-view" hidden={activeView !== 'interviews'}>
        <div className="recruiter-focus-heading">
          <p>Recruitment schedule</p>
          <h1>Upcoming interviews</h1>
          <span>See upcoming appointments and quickly identify scheduling conflicts.</span>
        </div>
        {upcomingInterviewConflicts.length > 0 && (
          <div className="card recruiter-conflict-warning" role="status">
            <strong>Scheduling conflicts detected</strong>
            <p>{upcomingInterviewConflicts.length} interview(s) share an interviewer and scheduled start time. Review them before confirming changes.</p>
          </div>
        )}
        {scheduledInterviews.length === 0
          ? <p className="card recruiter-empty">No upcoming interviews are scheduled for your vacancies.</p>
          : scheduledInterviews.map((application) => {
            const conflict = upcomingInterviewConflicts.some((item) => item._id === application._id);
            return (
              <article className={`card recruiter-interview-card${conflict ? ' has-conflict' : ''}`} key={application._id}>
                <div>
                  <strong>{application.candidate?.name || 'Candidate'}</strong>
                  <p>{application.job?.title || 'Vacancy'} · {application.job?.department || 'Department not listed'}</p>
                  <span>{new Date(application.interviewDate).toLocaleString()}</span>
                  <small>{application.interviewer?.name || application.panelMembers?.map((member) => member.name).filter(Boolean).join(', ') || 'Interviewer not listed'}</small>
                </div>
                <div className="recruiter-interview-actions">
                  {conflict && <span className="tag recruiter-conflict-tag">Potential conflict</span>}
                  {application.meetingLink && <a className="btn sm ghost" href={application.meetingLink} target="_blank" rel="noreferrer">Meeting link</a>}
                  {!(application.scorecards || []).length && new Date(application.interviewDate) < new Date() && <span className="tag">Feedback overdue</span>}
                </div>
              </article>
            );
          })}
        <div className="card recruiter-schedule-callout">
          <strong>Need to schedule an interview?</strong>
          <p>Move an applicant to Shortlisted or Assessment in the candidate pipeline to open the scheduling form.</p>
          <button type="button" className="btn sm" onClick={() => setActiveView('candidates')}>Go to candidate pipeline</button>
        </div>
      </section>

      <section className="recruiter-section recruiter-focus-view" hidden={activeView !== 'reports'}>
        <div className="recruiter-focus-heading">
          <p>Recruitment analytics</p>
          <h1>Recruitment reports</h1>
          <span>Metrics below reflect the applications and vacancies currently loaded for your recruiter account.</span>
        </div>
        <div className="recruiter-report-grid">
          <article className="card recruiter-report-card">
            <h2>Pipeline conversion</h2>
            {pipelineSummary.map((stage) => <div className="recruiter-report-row" key={stage.status}>
              <span>{stage.title}</span><strong>{stage.count}</strong>
              <div className="recruiter-report-track"><span style={{ width: `${applications.length ? (stage.count / applications.length) * 100 : 0}%` }} /></div>
            </div>)}
          </article>
          <article className="card recruiter-report-card">
            <h2>Hiring outcomes</h2>
            <div className="recruiter-report-highlight"><strong>{averageTimeToHire === null ? '—' : `${averageTimeToHire} days`}</strong><span>Average time to hire{hires.length ? ` · ${hires.length} hires` : ''}</span></div>
            <div className="recruiter-report-highlight"><strong>{applications.length ? `${Math.round((hires.length / applications.length) * 100)}%` : '—'}</strong><span>Applications resulting in a hire</span></div>
            <div className="recruiter-report-highlight"><strong>{stats?.activeVacancies ?? 0}</strong><span>Open vacancies</span></div>
          </article>
          <article className="card recruiter-report-card">
            <h2>Vacancy ageing</h2>
            {jobs.filter((job) => job.status === 'open').length
              ? jobs.filter((job) => job.status === 'open').map((job) => <div className="recruiter-age-row" key={job._id}>
                <span>{job.title}</span><strong>{Math.max(0, Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 86400000))} days</strong>
              </div>)
              : <p className="recruiter-empty">No open vacancies to report.</p>}
          </article>
          <article className="card recruiter-report-card">
            <h2>Application sources</h2>
            {Object.keys(applicationSources).length
              ? Object.entries(applicationSources).sort((a, b) => b[1] - a[1]).map(([source, count]) => <div className="recruiter-age-row" key={source}><span>{source}</span><strong>{count}</strong></div>)
              : <p className="recruiter-empty">No application source data available yet.</p>}
          </article>
        </div>
      </section>

      <section className="recruiter-section recruiter-activity" hidden={!['dashboard', 'tasks'].includes(activeView)}>
        <div className="recruiter-section-heading"><h2>Recent application activity</h2><p>Latest updates on applications linked to your vacancies.</p></div>
        {recentActivity.length
          ? recentActivity.map((application) => <article className="card recruiter-activity-row" key={application._id}>
            <span className="recruiter-activity-dot" aria-hidden="true" />
            <div><strong>{application.candidate?.name || 'Candidate'}</strong><p>{application.job?.title || 'Vacancy'} · Status: {application.status}</p></div>
            <time dateTime={application.updatedAt}>{new Date(application.updatedAt).toLocaleDateString()}</time>
          </article>)
          : <p className="card recruiter-empty">No application activity to show yet.</p>}
      </section>
        </div>
      </div>
    </main>
  );
}
