'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

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

function PanelScorecard({ application, onSubmit, saving }) {
  const [ratings, setRatings] = useState({ skills: '', communication: '', cultureFit: '' });
  const [recommendation, setRecommendation] = useState('');
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const submitted = application.scorecards?.some((scorecard) => String(scorecard.by?._id || scorecard.by) === String(application.currentManagerId));

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (['skills', 'communication', 'cultureFit'].some((key) => !ratings[key])) {
      setError('Rate all three criteria from 1 to 5 before submitting.');
      return;
    }
    if (!recommendation) {
      setError('Choose a hire, maybe, or no hire recommendation.');
      return;
    }
    try {
      await onSubmit(application._id, {
        ratings: {
          skills: Number(ratings.skills),
          communication: Number(ratings.communication),
          cultureFit: Number(ratings.cultureFit),
        },
        recommendation,
        comments,
      });
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  if (submitted) return <p className="manager-scorecard-done">Your scorecard is submitted.</p>;

  return (
    <form className="manager-scorecard" onSubmit={submit}>
      <h4>My interview scorecard</h4>
      <div className="manager-scorecard-grid">
        {[['skills', 'Skills'], ['communication', 'Communication'], ['cultureFit', 'Culture fit']].map(([key, label]) => (
          <label key={key}>{label}
            <select required value={ratings[key]} onChange={(event) => setRatings({ ...ratings, [key]: event.target.value })}>
              <option value="">Rate 1–5</option>
              {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
            </select>
          </label>
        ))}
      </div>
      <label>Recommendation
        <select required value={recommendation} onChange={(event) => setRecommendation(event.target.value)}>
          <option value="">Choose one</option><option value="hire">Hire</option><option value="maybe">Maybe</option><option value="no hire">No hire</option>
        </select>
      </label>
      <label>Comments<textarea rows="2" maxLength="3000" value={comments} onChange={(event) => setComments(event.target.value)} /></label>
      {error && <p className="err" role="alert">{error}</p>}
      <button className="btn sm" disabled={saving}>{saving ? 'Submitting…' : 'Submit scorecard'}</button>
    </form>
  );
}

export default function HiringManagerDashboard({ user }) {
  const router = useRouter();
  const [activeView, setActiveView] = useState('dashboard');
  const [compareIds, setCompareIds] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [comments, setComments] = useState({});
  const [feedback, setFeedback] = useState({});
  const [panelForms, setPanelForms] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [jobResult, applicationResult] = await Promise.all([
        request('/api/jobs'),
        request('/api/applications'),
      ]);
      setJobs(jobResult);
      setApplications(applicationResult);
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

  const pendingJobs = jobs.filter((job) => ['pending', 'changes_requested'].includes(job.status));
  const offers = applications.filter((application) => application.status === 'Offer Made');
  const shortlisted = applications.filter((application) => application.status === 'Shortlisted');
  const interviews = useMemo(
    () => applications
      .filter((application) => application.status === 'Interview' && application.interviewDate)
      .sort((a, b) => new Date(a.interviewDate) - new Date(b.interviewDate)),
    [applications],
  );
  const scorecardsOwed = interviews.filter(
    (application) => application.panelMembers?.some((member) => String(member._id) === String(user.id))
      && !application.scorecards?.some((scorecard) => String(scorecard.by) === String(user.id)),
  );
  const filled = applications.filter((application) => application.status === 'Hired').length;
  const inProgress = applications.filter((application) => !['Hired', 'Rejected', 'Withdrawn'].includes(application.status)).length;
  const pendingOffers = offers.filter((application) => !application.offerApproved);
  const openJobs = jobs.filter((job) => job.status === 'open');
  const comparisonCandidates = compareIds.map((id) => shortlisted.find((application) => application._id === id)).filter(Boolean);
  const averageTimeToHire = applications.filter((application) => application.status === 'Hired').length
    ? Math.round(applications.filter((application) => application.status === 'Hired').reduce((total, application) => {
      const hiredAt = new Date(application.hiredAt || application.updatedAt);
      return total + Math.max(0, (hiredAt - new Date(application.createdAt)) / 86400000);
    }, 0) / applications.filter((application) => application.status === 'Hired').length)
    : null;
  const pendingCount = pendingJobs.length + pendingOffers.length;

  function toggleCompare(applicationId) {
    setCompareIds((current) => current.includes(applicationId)
      ? current.filter((id) => id !== applicationId)
      : current.length < 2 ? [...current, applicationId] : [current[1], applicationId]);
  }

  async function updateJob(jobId, status) {
    const comment = (comments[jobId] || '').trim();
    if (status === 'changes_requested' && !comment) {
      setError('Add a comment describing what the recruiter needs to change.');
      return;
    }
    setError('');
    setWorking(jobId);
    try {
      await request('/api/jobs', 'PATCH', { id: jobId, status, ...(comment ? { comment } : {}) });
      setNotice(status === 'open' ? 'Vacancy approved and opened.' : 'Changes requested. The recruiter has been notified.');
      setComments((current) => ({ ...current, [jobId]: '' }));
      await load();
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setWorking('');
    }
  }

  async function reviewOffer(applicationId, approved) {
    const comment = (comments[applicationId] || '').trim();
    if (!approved && !comment) {
      setError('Add a comment describing what needs to change before returning this offer.');
      return;
    }
    setError('');
    setWorking(applicationId);
    try {
      await request('/api/applications', 'PATCH', {
        id: applicationId,
        offerApproved: approved,
        ...(comment ? { offerReviewComment: comment } : {}),
      });
      setNotice(approved ? 'Offer approved.' : 'Offer returned for changes and candidate notified.');
      setComments((current) => ({ ...current, [applicationId]: '' }));
      await load();
    } catch (reviewError) {
      setError(reviewError.message);
    } finally {
      setWorking('');
    }
  }

  async function saveFeedback(applicationId) {
    const entry = feedback[applicationId] || {};
    if (!entry.rating || !entry.comment?.trim()) {
      setError('Choose a rating and add feedback before saving.');
      return;
    }
    setError('');
    setWorking(applicationId);
    try {
      await request('/api/applications', 'PATCH', {
        id: applicationId,
        note: `Hiring manager rating ${entry.rating}/5: ${entry.comment.trim()}`,
      });
      setFeedback((current) => ({ ...current, [applicationId]: { rating: '', comment: '' } }));
      setNotice('Candidate feedback saved.');
    } catch (feedbackError) {
      setError(feedbackError.message);
    } finally {
      setWorking('');
    }
  }

  async function assignPanel(event, applicationId) {
    event.preventDefault();
    const form = panelForms[applicationId] || {};
    const interviewerEmails = (form.emails || '').split(',').map((email) => email.trim()).filter(Boolean);
    if (!form.date || !form.link || !interviewerEmails.length) {
      setError('Enter an interview date, meeting link and at least one interviewer email.');
      return;
    }
    setError('');
    setWorking(applicationId);
    try {
      await request('/api/applications', 'PATCH', {
        id: applicationId,
        status: 'Interview',
        interviewDate: new Date(form.date).toISOString(),
        meetingLink: form.link,
        interviewerEmails,
      });
      setNotice('Interview scheduled and panel members have been notified.');
      setPanelForms((current) => ({ ...current, [applicationId]: {} }));
      await load();
    } catch (panelError) {
      setError(panelError.message);
    } finally {
      setWorking('');
    }
  }

  async function submitScorecard(applicationId, scorecard) {
    setError('');
    setWorking(applicationId);
    try {
      await request('/api/applications', 'PATCH', { id: applicationId, scorecard });
      setNotice('Your interview scorecard has been submitted.');
      await load();
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

  if (loading) return <main className="candidate-loading"><p>Loading your hiring manager dashboard…</p></main>;

  return (
    <main className="manager-shell">
      <aside className="manager-sidebar">
        <a className="manager-brand" href="/dashboard" aria-label="Mbono Career Goals dashboard"><img src="/mbono-career-goals.png" alt="Mbono Career Goals — Building skills, unlocking opportunity" /></a>
        <p className="manager-sidebar-label">Hiring workspace</p>
        <nav className="manager-side-nav" aria-label="Hiring manager dashboard">
          {[
            ['dashboard', '▦', 'Dashboard'],
            ['approvals', '✓', 'Approvals'],
            ['vacancies', '▤', 'Vacancies'],
            ['candidates', '♙', 'Candidates'],
            ['interviews', '◷', 'Interviews'],
            ['feedback', '▧', 'Feedback'],
            ['reports', '▥', 'Reports'],
          ].map(([view, icon, label]) => (
            <button type="button" className={activeView === view ? 'active' : ''} key={view} onClick={() => setActiveView(view)} aria-current={activeView === view ? 'page' : undefined}>
              <span aria-hidden="true">{icon}</span>{label}
              {view === 'approvals' && pendingCount > 0 && <span className="manager-nav-count">{pendingCount}</span>}
              {view === 'feedback' && scorecardsOwed.length > 0 && <span className="manager-nav-count">{scorecardsOwed.length}</span>}
            </button>
          ))}
        </nav>
        <div className="manager-sidebar-bottom">
          <span className="manager-sidebar-avatar">{(user.name || 'M').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
          <span className="manager-sidebar-user">{user.name || 'Hiring Manager'}<small>Hiring manager</small></span>
          <button type="button" className="manager-logout" onClick={logout} aria-label="Log out">↪</button>
        </div>
      </aside>
      <div className="manager-main">
        <header className="manager-topbar">
          <span>{activeView === 'dashboard' ? 'Overview' : activeView[0].toUpperCase() + activeView.slice(1)}</span>
          <button type="button" className="btn sm ghost" onClick={() => setActiveView('approvals')}>Pending approvals <span className="tag">{pendingCount}</span></button>
        </header>
        <div className="manager-content">
      {error && <p className="err" role="alert">{error}</p>}
      {notice && <p className="manager-success" role="status">{notice}</p>}

      <header className="manager-welcome" hidden={activeView !== 'dashboard'}>
        <p>Hiring workspace</p>
        <h1>Welcome back, {user.name || 'hiring manager'}</h1>
        <span>{user.department ? `${user.department} · Review approvals, support interview panels and keep hiring moving.` : 'No department is assigned to your account yet. Ask an administrator to assign your department before reviewing vacancies or candidates.'}</span>
        <div className="manager-quick-actions">
          {pendingJobs.length > 0 && <button className="btn alt" onClick={() => setActiveView('approvals')}>Approve vacancy</button>}
          {shortlisted.length > 0 && <button className="btn manager-action-secondary" onClick={() => setActiveView('candidates')}>Review candidates</button>}
          {scorecardsOwed.length > 0 && <button className="btn manager-action-secondary" onClick={() => setActiveView('feedback')}>Submit feedback</button>}
          {pendingOffers.length > 0 && <button className="btn manager-action-secondary" onClick={() => setActiveView('approvals')}>Approve offer</button>}
        </div>
      </header>

      <section className="manager-progress-stats" aria-label="Hiring manager statistics" hidden={activeView !== 'dashboard'}>
        <article className="manager-stat"><span>Vacancy approvals pending</span><b>{pendingJobs.length}</b></article>
        <article className="manager-stat"><span>Candidates to review</span><b>{shortlisted.length}</b></article>
        <article className="manager-stat"><span>Feedback outstanding</span><b>{scorecardsOwed.length}</b></article>
        <article className="manager-stat"><span>Offers awaiting decision</span><b>{pendingOffers.length}</b></article>
      </section>

      <section className="manager-section manager-approval-section" hidden={!['dashboard', 'approvals'].includes(activeView)}>
        <div className="manager-section-heading"><div><h2>Waiting for my approval</h2><p>Only vacancies and offers awaiting your decision are shown.</p></div><span className="tag">{pendingCount}</span></div>
        <h3 className="manager-subheading">Vacancies</h3>
        {pendingJobs.length === 0
          ? <p className="card manager-empty">No vacancies are waiting for approval.</p>
          : pendingJobs.map((job) => (
            <article className="card manager-approval" key={job._id}>
              <div className="manager-approval-content">
                <div className="row"><div><h3>{job.title}</h3><p>{[job.location, job.department, job.type].filter(Boolean).join(' · ')}</p></div><span className="tag">{job.status === 'changes_requested' ? 'Changes requested' : 'Pending'}</span></div>
                <p className="manager-job-description">{job.description}</p>
                {job.status === 'changes_requested' && job.approvalComment && <p className="manager-request-comment"><b>Previous feedback:</b> {job.approvalComment}</p>}
                <label>Request changes comment<textarea rows="2" maxLength="2000" value={comments[job._id] || ''} onChange={(event) => setComments({ ...comments, [job._id]: event.target.value })} placeholder="Tell the recruiter what to update" /></label>
                <div className="row manager-actions">
                  {['pending', 'changes_requested'].includes(job.status) && <>
                    <button className="btn" disabled={working === job._id} onClick={() => updateJob(job._id, 'open')}>Approve vacancy</button>
                    <button className="btn ghost" disabled={working === job._id} onClick={() => updateJob(job._id, 'changes_requested')}>Request changes</button>
                  </>}
                </div>
              </div>
            </article>
          ))}
        <h3 className="manager-subheading">Offers</h3>
        {offers.filter((application) => !application.offerApproved).length === 0
          ? <p className="card manager-empty">No offers are waiting for approval.</p>
          : offers.filter((application) => !application.offerApproved).map((application) => (
            <article className="card manager-approval" key={application._id}>
              <div className="manager-approval-content">
                <div className="row"><div><h3>{application.candidate?.name || 'Candidate'} · {application.job?.title || 'Vacancy'}</h3><p>Match score {application.score || 0}%</p></div><span className="tag">Offer approval</span></div>
                {application.offerReviewComment && <p className="manager-request-comment"><b>Previous feedback:</b> {application.offerReviewComment}</p>}
                <label>Request changes comment<textarea rows="2" maxLength="2000" value={comments[application._id] || ''} onChange={(event) => setComments({ ...comments, [application._id]: event.target.value })} placeholder="Explain what needs to change in the offer" /></label>
                <div className="row manager-actions">
                  {application.status === 'Offer Made' && !application.offerApproved && <>
                    <button className="btn" disabled={working === application._id} onClick={() => reviewOffer(application._id, true)}>Approve offer</button>
                    <button className="btn ghost" disabled={working === application._id} onClick={() => reviewOffer(application._id, false)}>Request changes</button>
                  </>}
                </div>
              </div>
            </article>
          ))}
      </section>

      <section className="manager-section manager-vacancy-section" hidden={activeView !== 'vacancies'}>
        <div className="manager-section-heading"><div><h2>Department vacancies</h2><p>Open roles and current approval status for the vacancies available to your manager account.</p></div></div>
        {jobs.length === 0
          ? <p className="card manager-empty">No vacancies are available to review yet.</p>
          : jobs.map((job) => {
            const jobApplications = applications.filter((application) => String(application.job?._id) === String(job._id));
            const daysOpen = Math.max(0, Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 86400000));
            return <article className="card manager-vacancy-row" key={job._id}>
              <div><h3>{job.title}</h3><p>{[job.department, job.location, job.type].filter(Boolean).join(' · ')}</p></div>
              <span className={`tag manager-vacancy-status status-${job.status}`}>{job.status.replaceAll('_', ' ')}</span>
              <span>{jobApplications.length} candidates</span>
              <span>{daysOpen} days open</span>
              {['pending', 'changes_requested'].includes(job.status) && <button className="btn sm" type="button" onClick={() => setActiveView('approvals')}>Review approval</button>}
            </article>;
          })}
      </section>

      <section className="manager-section manager-candidates-section" hidden={!['dashboard', 'candidates'].includes(activeView)}>
        <div className="manager-section-heading"><div><h2>Shortlisted candidates</h2><p>Candidate details and match scores support your review; final decisions remain human-led.</p></div><span className="tag">{shortlisted.length}</span></div>
        {shortlisted.length > 1 && <p className="manager-compare-hint">Select up to two candidates to compare their skills, experience, qualifications and interview scorecards.</p>}
        {shortlisted.length === 0
          ? <p className="card manager-empty">No candidates have been shortlisted yet.</p>
          : shortlisted.map((application) => (
            <article className="card manager-candidate" key={application._id}>
              <div className="row manager-candidate-heading">
                <div><h3>{application.candidate?.name || 'Candidate'}</h3><p>{application.job?.title || 'Vacancy'}</p></div>
                <div className="manager-candidate-actions">
                  <span className="tag">Match {application.score || 0}%</span>
                  <button className="btn sm ghost" type="button" onClick={() => toggleCompare(application._id)} aria-pressed={compareIds.includes(application._id)}>{compareIds.includes(application._id) ? 'Selected to compare' : 'Compare'}</button>
                </div>
              </div>
              <div className="manager-candidate-summary">
                {application.candidate?.experience && <p>{application.candidate.experience}</p>}
                {application.candidate?.education && <p>{application.candidate.education}</p>}
                {application.candidate?.skills?.length > 0 && <p><b>Skills:</b> {application.candidate.skills.join(', ')}</p>}
                {application.candidate?.employmentHistory?.length > 0 && <p><b>Experience:</b> {application.candidate.employmentHistory.map((item) => [item.jobTitle, item.company].filter(Boolean).join(' at ')).join(' · ')}</p>}
                {application.candidate?.educationHistory?.length > 0 && <p><b>Education:</b> {application.candidate.educationHistory.map((item) => [item.qualification, item.institution].filter(Boolean).join(' — ')).join(' · ')}</p>}
                {application.candidate?.cvName
                  ? <a className="manager-cv-link" href={`/api/profile/cv?applicationId=${encodeURIComponent(application._id)}`}>Download candidate CV ({application.candidate.cvName})</a>
                  : <p className="manager-cv-unavailable">No CV has been uploaded for this candidate.</p>}
                {application.scorecards?.length > 0 && <div className="manager-existing-scorecards">
                  <strong>Interview feedback</strong>
                  {application.scorecards.map((scorecard) => <p key={String(scorecard._id || scorecard.by?._id)}>
                    {scorecard.by?.name || 'Panel member'} · Skills {scorecard.ratings?.skills ?? '—'}/5, communication {scorecard.ratings?.communication ?? '—'}/5, culture fit {scorecard.ratings?.cultureFit ?? '—'}/5 · Recommendation: {scorecard.recommendation || 'Not recorded'}
                    {scorecard.comments ? ` · ${scorecard.comments}` : ''}
                  </p>)}
                </div>}
              </div>
              <div className="manager-feedback">
                <label>Rating
                  <select value={feedback[application._id]?.rating || ''} onChange={(event) => setFeedback({ ...feedback, [application._id]: { ...feedback[application._id], rating: event.target.value } })}>
                    <option value="">Rate 1–5</option>{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
                  </select>
                </label>
                <label>Feedback<textarea rows="2" maxLength="2000" value={feedback[application._id]?.comment || ''} onChange={(event) => setFeedback({ ...feedback, [application._id]: { ...feedback[application._id], comment: event.target.value } })} placeholder="Share your feedback with the recruitment team" /></label>
                <div className="row manager-actions">
                  <button className="btn sm" disabled={working === application._id} onClick={() => saveFeedback(application._id)}>Save feedback</button>
                </div>
              </div>
              <form className="manager-panel-form" onSubmit={(event) => assignPanel(event, application._id)}>
                <h4>Assign interview panel</h4>
                <div className="manager-panel-grid">
                  <label>Date and time<input required type="datetime-local" value={panelForms[application._id]?.date || ''} onChange={(event) => setPanelForms({ ...panelForms, [application._id]: { ...panelForms[application._id], date: event.target.value } })} /></label>
                  <label>Interviewer emails (comma separated)<input required type="text" placeholder="interviewer@mbono.co.za" value={panelForms[application._id]?.emails || ''} onChange={(event) => setPanelForms({ ...panelForms, [application._id]: { ...panelForms[application._id], emails: event.target.value } })} /></label>
                  <label className="manager-panel-link">Meeting link<input required type="url" placeholder="https://" value={panelForms[application._id]?.link || ''} onChange={(event) => setPanelForms({ ...panelForms, [application._id]: { ...panelForms[application._id], link: event.target.value } })} /></label>
                </div>
                <button className="btn sm" disabled={working === application._id}>{working === application._id ? 'Scheduling…' : 'Schedule interview'}</button>
              </form>
            </article>
          ))}
        {comparisonCandidates.length > 0 && <section className="manager-compare">
          <div className="manager-section-heading">
            <div><h2>Candidate comparison</h2><p>Compare job-related details side by side.</p></div>
            <button type="button" className="link" onClick={() => setCompareIds([])}>Clear comparison</button>
          </div>
          <div className="manager-compare-grid">
            <div className="manager-compare-labels"><strong>Comparison</strong><span>Role</span><span>Match score</span><span>Skills</span><span>Qualifications</span><span>Experience</span><span>Interview recommendation</span></div>
            {comparisonCandidates.map((application) => <div className="manager-compare-person" key={application._id}>
              <strong>{application.candidate?.name || 'Candidate'}</strong>
              <span>{application.job?.title || 'Vacancy'}</span>
              <span>{application.score ?? 0}%</span>
              <span>{application.candidate?.skills?.join(', ') || 'Not provided'}</span>
              <span>{application.candidate?.educationHistory?.map((item) => item.qualification).filter(Boolean).join(', ') || application.candidate?.education || 'Not provided'}</span>
              <span>{application.candidate?.employmentHistory?.map((item) => [item.jobTitle, item.company].filter(Boolean).join(' at ')).filter(Boolean).join('; ') || application.candidate?.experience || 'Not provided'}</span>
              <span>{application.scorecards?.map((scorecard) => scorecard.recommendation).filter(Boolean).join(', ') || 'No scorecard yet'}</span>
            </div>)}
          </div>
        </section>}
      </section>

      <div className="manager-interview-columns" hidden={!['dashboard', 'interviews'].includes(activeView)}>
        <section className="manager-section">
          <div className="manager-section-heading"><h2>Interview schedule</h2><span className="tag">{interviews.length}</span></div>
          {interviews.length === 0
            ? <p className="card manager-empty">No panel interviews scheduled.</p>
            : interviews.map((application) => (
              <article className="card manager-interview" key={application._id}>
                <h3>{application.candidate?.name || 'Candidate'} · {application.job?.title || 'Interview'}</h3>
                <p>{new Date(application.interviewDate).toLocaleString()}</p>
                <p><b>Panel:</b> {application.panelMembers?.map((member) => member.name).filter(Boolean).join(', ') || 'No panel listed'}</p>
                {application.meetingLink && <a className="btn sm" href={application.meetingLink} target="_blank" rel="noreferrer">Join meeting</a>}
              </article>
            ))}
        </section>
        <section className="manager-section">
          <div className="manager-section-heading"><h2>Hiring progress</h2></div>
          {jobs.length === 0
            ? <p className="card manager-empty">No vacancies to report yet.</p>
            : <div className="card manager-progress-list">
              {[
                ['Pending approval', jobs.filter((job) => ['pending', 'changes_requested'].includes(job.status)).length],
                ['Open vacancies', jobs.filter((job) => job.status === 'open').length],
                ['Closed vacancies', jobs.filter((job) => job.status === 'closed').length],
                ['Vacancies filled', filled],
                ['Candidates in progress', inProgress],
              ].map(([label, count]) => (
                <div className="row" key={label}><span>{label}</span><strong>{count}</strong></div>
              ))}
            </div>}
        </section>
      </div>

      <section className="manager-section manager-feedback-section" hidden={!['dashboard', 'feedback'].includes(activeView)}>
        <div className="manager-section-heading"><div><h2>Feedback and scorecards</h2><p>Submit your assigned panel scorecards and review recommendations received so far.</p></div><span className="tag">{scorecardsOwed.length} outstanding</span></div>
        {scorecardsOwed.length === 0
          ? <p className="card manager-empty">You have no outstanding panel scorecards.</p>
          : scorecardsOwed.map((application) => <article className="card manager-interview" key={application._id}>
            <h3>{application.candidate?.name || 'Candidate'} · {application.job?.title || 'Interview'}</h3>
            <p>{new Date(application.interviewDate).toLocaleString()}</p>
            <p><b>Panel:</b> {application.panelMembers?.map((member) => member.name).filter(Boolean).join(', ') || 'No panel listed'}</p>
            <PanelScorecard
              application={{ ...application, currentManagerId: user.id }}
              onSubmit={submitScorecard}
              saving={working === application._id}
            />
          </article>)}
      </section>

      <section className="manager-section manager-report-section" hidden={activeView !== 'reports'}>
        <div className="manager-focus-heading">
          <p>Department hiring analytics</p>
          <h1>Hiring progress</h1>
          <span>Summary of vacancies and applications currently available to your manager account.</span>
        </div>
        <div className="manager-report-grid">
          <article className="card manager-report-card">
            <h2>Vacancy status</h2>
            {[
              ['Pending approval', pendingJobs.length],
              ['Open vacancies', openJobs.length],
              ['Closed vacancies', jobs.filter((job) => job.status === 'closed').length],
              ['Vacancies filled', filled],
              ['Candidates in progress', inProgress],
            ].map(([label, count]) => <div className="manager-report-line" key={label}><span>{label}</span><strong>{count}</strong></div>)}
          </article>
          <article className="card manager-report-card">
            <h2>Hiring outcomes</h2>
            <div className="manager-report-highlight"><strong>{averageTimeToHire === null ? '—' : `${averageTimeToHire} days`}</strong><span>Average time to hire</span></div>
            <div className="manager-report-highlight"><strong>{applications.length ? `${Math.round((filled / applications.length) * 100)}%` : '—'}</strong><span>Applications resulting in a hire</span></div>
            <div className="manager-report-highlight"><strong>{scorecardsOwed.length}</strong><span>Outstanding panel scorecards</span></div>
          </article>
          <article className="card manager-report-card">
            <h2>Open vacancy age</h2>
            {openJobs.length
              ? openJobs.map((job) => <div className="manager-report-line" key={job._id}>
                <span>{job.title}{job.department ? ` · ${job.department}` : ''}</span>
                <strong>{Math.max(0, Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 86400000))} days</strong>
              </div>)
              : <p className="manager-empty">No open vacancies to report.</p>}
          </article>
          <article className="card manager-report-card">
            <h2>Outstanding decisions</h2>
            <div className="manager-report-line"><span>Vacancy approvals</span><strong>{pendingJobs.length}</strong></div>
            <div className="manager-report-line"><span>Offer decisions</span><strong>{pendingOffers.length}</strong></div>
            <div className="manager-report-line"><span>Scorecards owed</span><strong>{scorecardsOwed.length}</strong></div>
          </article>
        </div>
      </section>
        </div>
      </div>
    </main>
  );
}
