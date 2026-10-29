'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const finalStatuses = ['Hired', 'Rejected', 'Withdrawn'];

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

function jobMatch(job, profile) {
  const required = (job.skills || []).map((skill) => skill.toLowerCase());
  const candidateSkills = new Set((profile?.skills || []).map((skill) => skill.toLowerCase()));
  const skillScore = required.length
    ? (required.filter((skill) => candidateSkills.has(skill)).length / required.length) * 70
    : 35;
  const locationMatches = Boolean(profile?.address && job.location
    && profile.address.toLowerCase().includes(job.location.toLowerCase()));
  const locationScore = locationMatches ? 15 : 0;
  const qualifications = (profile?.educationHistory || []).map((item) => item.qualification.toLowerCase());
  const jobText = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  const qualificationMatches = qualifications.some((qualification) => qualification && jobText.includes(qualification));
  const qualificationScore = qualificationMatches ? 15 : 0;
  return Math.round(Math.min(100, skillScore + locationScore + qualificationScore));
}

function calendarUrl(application) {
  const start = new Date(application.interviewDate);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const format = (date) => date.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const title = `Mbono interview: ${application.job?.title || 'Career opportunity'}`;
  const details = application.meetingLink || 'Mbono Career Goal interview';
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${format(start)}/${format(end)}&details=${encodeURIComponent(details)}${application.meetingLink ? `&location=${encodeURIComponent(application.meetingLink)}` : ''}`;
}

function JobCard({ job, match, saved, applied, busy, onApply, onSave }) {
  return (
    <article className="card candidate-job">
      <div className="row candidate-job-heading">
        <div>
          <h3>{job.title}</h3>
          <p>{[job.company || 'Mbono', job.department, job.location, job.type].filter(Boolean).join(' · ')}</p>
        </div>
        <span className="tag">Match {match}%</span>
      </div>
      {job.salary && <p className="candidate-salary">{job.salary}</p>}
      {job.deadline && <p className="candidate-deadline">Apply by {new Date(job.deadline).toLocaleDateString()}</p>}
      <div className="row candidate-job-actions">
        <button className="btn sm" type="button" disabled={applied || busy} onClick={() => onApply(job._id)}>
          {applied ? 'Applied' : busy ? 'Applying…' : 'Apply'}
        </button>
        <button className="btn sm ghost" type="button" disabled={busy} onClick={() => onSave(job._id, !saved)}>
          {busy ? 'Saving…' : saved ? 'Saved' : 'Save job'}
        </button>
      </div>
    </article>
  );
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'C';
}

function applicationStage(status) {
  if (status === 'Withdrawn' || status === 'Rejected') return status;
  if (status === 'Hired') return 'Hired';
  const stages = ['Received', 'Under Review', 'Shortlisted', 'Assessment', 'Interview', 'Offer Made'];
  return stages[Math.max(0, stages.indexOf(status))] || 'Received';
}

export default function CandidateDashboard({ user }) {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [savedJobs, setSavedJobs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeView, setActiveView] = useState('dashboard');
  const [filters, setFilters] = useState({ q: '', location: '', industry: '', type: '' });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setError('');
    try {
      const [profileResult, applicationResult, jobResult, savedResult, notificationResult] = await Promise.all([
        request('/api/profile'),
        request('/api/applications'),
        request('/api/jobs'),
        request('/api/saved-jobs'),
        request('/api/notifications'),
      ]);
      setProfile(profileResult.profile);
      setApplications(applicationResult);
      setJobs(jobResult);
      setSavedJobs(savedResult.jobs);
      setNotifications(notificationResult);
    } catch (loadError) {
      if (loadError.message === 'Not allowed') router.push('/login');
      else setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const skills = profile?.skills || [];
  const recommendations = useMemo(
    () => [...jobs].sort((a, b) => jobMatch(b, profile) - jobMatch(a, profile)),
    [jobs, profile],
  );
  const skillSuggestions = useMemo(() => {
    const candidateSkills = new Set((profile?.skills || []).map((skill) => skill.toLowerCase()));
    const demand = new Map();
    jobs.forEach((job) => {
      [...new Set((job.skills || []).map((skill) => skill.trim()).filter(Boolean))].forEach((skill) => {
        const key = skill.toLowerCase();
        if (!candidateSkills.has(key)) {
          const current = demand.get(key) || { name: skill, count: 0 };
          current.count += 1;
          demand.set(key, current);
        }
      });
    });
    return [...demand.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  }, [jobs, profile]);
  const savedIds = useMemo(() => new Set(savedJobs.map((job) => job._id)), [savedJobs]);
  const appliedIds = useMemo(() => new Set(applications.map((application) => application.job?._id)), [applications]);
  const upcomingInterviews = applications
    .filter((application) => application.interviewDate && new Date(application.interviewDate) >= new Date())
    .sort((a, b) => new Date(a.interviewDate) - new Date(b.interviewDate));

  const profileChecks = profile ? [
    [Boolean(profile.name), 'Add your full name'],
    [Boolean(profile.phone), 'Add your phone number'],
    [Boolean(profile.address), 'Add your location'],
    [profile.employmentHistory?.length > 0, 'Add your employment history'],
    [profile.educationHistory?.length > 0, 'Add your education'],
    [profile.skills?.length > 0, 'Add your skills'],
    [profile.languages?.length > 0, 'Add languages you speak'],
    [Boolean(profile.cvName), 'Upload your CV'],
  ] : [];
  const profileStrength = profileChecks.length
    ? Math.round((profileChecks.filter(([complete]) => complete).length / profileChecks.length) * 100)
    : 0;
  const profilePrompt = profileChecks.find(([complete]) => !complete)?.[1];

  async function search(event) {
    event.preventDefault();
    setError('');
    setWorking('search');
    setActiveView('jobs');
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value.trim()));
      setSearchResults(await request(`/api/jobs?${params.toString()}`));
    } catch (searchError) {
      setError(searchError.message);
    } finally {
      setWorking('');
    }
  }

  async function apply(jobId) {
    setError('');
    setNotice('');
    setWorking(jobId);
    try {
      await request('/api/applications', 'POST', { jobId });
      setNotice('Your application has been sent.');
      await load();
    } catch (applyError) {
      setError(applyError.message);
    } finally {
      setWorking('');
    }
  }

  async function saveJob(jobId, saved) {
    setError('');
    setWorking(jobId);
    try {
      await request('/api/saved-jobs', 'POST', { jobId, saved });
      const result = await request('/api/saved-jobs');
      setSavedJobs(result.jobs);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setWorking('');
    }
  }

  async function withdraw(applicationId) {
    setError('');
    setWorking(applicationId);
    try {
      await request('/api/applications', 'PATCH', { id: applicationId, status: 'Withdrawn' });
      await load();
    } catch (withdrawError) {
      setError(withdrawError.message);
    } finally {
      setWorking('');
    }
  }

  async function markRead(notification) {
    if (notification.read) return;
    try {
      const updated = await request('/api/notifications', 'PATCH', { id: notification._id, read: true });
      setNotifications((current) => current.map((item) => item._id === updated._id ? updated : item));
    } catch (notificationError) {
      setError(notificationError.message);
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

  const displayedJobs = searchResults || jobs;
  const displayedTitle = searchResults ? 'Search results' : 'All open vacancies';
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;
  if (loading) return <main className="candidate-loading"><p>Loading your dashboard…</p></main>;

  return (
    <main className="candidate-shell">
      <aside className="candidate-sidebar">
        <Link className="candidate-brand" href="/dashboard" aria-label="Mbono Career Goals dashboard"><img src="/mbono-career-goals.png" alt="Mbono Career Goals — Building skills, unlocking opportunity" /></Link>
        <p className="candidate-sidebar-label">Workspace</p>
        <nav className="candidate-side-nav" aria-label="Candidate dashboard">
          <a className={activeView === 'dashboard' ? 'active' : ''} href="#overview" onClick={(event) => { event.preventDefault(); setActiveView('dashboard'); }} aria-current={activeView === 'dashboard' ? 'page' : undefined}><span aria-hidden="true">▦</span>Dashboard</a>
          <a className={activeView === 'jobs' ? 'active' : ''} href="#job-search" onClick={(event) => { event.preventDefault(); setActiveView('jobs'); }} aria-current={activeView === 'jobs' ? 'page' : undefined}><span aria-hidden="true">⌕</span>Find jobs</a>
          <a className={activeView === 'applications' ? 'active' : ''} href="#applications" onClick={(event) => { event.preventDefault(); setActiveView('applications'); }} aria-current={activeView === 'applications' ? 'page' : undefined}><span aria-hidden="true">▤</span>Applications</a>
          <a className={activeView === 'interviews' ? 'active' : ''} href="#interviews" onClick={(event) => { event.preventDefault(); setActiveView('interviews'); }} aria-current={activeView === 'interviews' ? 'page' : undefined}><span aria-hidden="true">◷</span>Interviews</a>
          <a className={activeView === 'notifications' ? 'active' : ''} href="#notifications" onClick={(event) => { event.preventDefault(); setActiveView('notifications'); }} aria-current={activeView === 'notifications' ? 'page' : undefined}><span aria-hidden="true">♧</span>Notifications{unreadNotifications > 0 && <span className="candidate-nav-count">{unreadNotifications}</span>}</a>
          <Link href="/dashboard/profile"><span aria-hidden="true">◉</span>Career profile</Link>
        </nav>
        <div className="candidate-sidebar-bottom">
          <span className="candidate-sidebar-user">{initials(user.name)}</span>
          <span className="candidate-sidebar-name">{user.name || 'Candidate'}<small>Candidate account</small></span>
          <button type="button" className="candidate-logout" onClick={logout} aria-label="Log out">↪</button>
        </div>
      </aside>

      <div className="candidate-main" id="overview">
        <header className="candidate-topbar">
          <form className="candidate-top-search" onSubmit={search} role="search">
            <span aria-hidden="true">⌕</span>
            <input aria-label="Search jobs" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Search jobs, skills or locations…" />
            <button type="submit" disabled={working === 'search'}>Search</button>
          </form>
          <div className="candidate-top-user">
            <a href="#notifications" className="candidate-bell" onClick={(event) => { event.preventDefault(); setActiveView('notifications'); }} aria-label={`${unreadNotifications} unread notifications`}>♧{unreadNotifications > 0 && <span />}</a>
            <span className="candidate-top-name">{user.name || 'Candidate'}</span>
            <span className="candidate-avatar" aria-hidden="true">{initials(user.name)}</span>
          </div>
        </header>

        <div className="candidate-content">
          {error && <p className="err" role="alert">{error}</p>}
          {notice && <p className="candidate-success" role="status">{notice}</p>}

          {activeView === 'dashboard' && <>
          <div className="candidate-overview-grid">
            <header className="candidate-welcome">
              <p className="candidate-eyebrow">Your career journey</p>
              <h1>Welcome back{user.name ? `, ${user.name.split(' ')[0]}` : ''}!</h1>
              <p>Find opportunities, follow your progress and keep your profile ready for what’s next.</p>
              <div className="candidate-quick-actions">
                <a className="btn alt" href="#job-search" onClick={(event) => { event.preventDefault(); setActiveView('jobs'); }}>Find jobs <span aria-hidden="true">→</span></a>
                <Link className="btn candidate-welcome-secondary" href="/dashboard/profile#cv-upload">Upload CV</Link>
                <Link className="btn candidate-welcome-secondary" href="/dashboard/profile">Update profile</Link>
                <a className="btn candidate-welcome-secondary" href="#applications" onClick={(event) => { event.preventDefault(); setActiveView('applications'); }}>My applications</a>
              </div>
            </header>

            <section className="card candidate-strength">
              <div className="row candidate-strength-heading">
                <div><h2>Profile status</h2><p>{profilePrompt || 'Your profile is looking great.'}</p></div>
                <strong>{profileStrength}%</strong>
              </div>
              <div className="candidate-progress" role="progressbar" aria-label="Profile strength" aria-valuemin="0" aria-valuemax="100" aria-valuenow={profileStrength}>
                <span style={{ width: `${profileStrength}%` }} />
              </div>
              <Link href="/dashboard/profile" className="candidate-profile-link">{profilePrompt ? 'Complete profile' : 'Review profile'} <span aria-hidden="true">→</span></Link>
            </section>
          </div>

          <section className="candidate-stats" aria-label="Your career activity">
            <article className="candidate-stat"><span aria-hidden="true">↗</span><p>Applications submitted</p><strong>{applications.length}</strong><small>All your applications</small></article>
            <article className="candidate-stat"><span aria-hidden="true">◷</span><p>Upcoming interviews</p><strong>{upcomingInterviews.length}</strong><small>{upcomingInterviews[0] ? `Next: ${new Date(upcomingInterviews[0].interviewDate).toLocaleDateString()}` : 'No interviews scheduled'}</small></article>
            <article className="candidate-stat"><span aria-hidden="true">♡</span><p>Saved jobs</p><strong>{savedJobs.length}</strong><small>Vacancies saved for later</small></article>
            <article className="candidate-stat"><span aria-hidden="true">✓</span><p>Profile completion</p><strong>{profileStrength}%</strong><small>{profilePrompt || 'Ready to be discovered'}</small></article>
          </section>

          <div className="candidate-layout">
            <div className="candidate-primary">
              <section className="candidate-section" id="recommended-jobs">
                <div className="row candidate-section-heading"><div><h2>Recommended for you</h2><p>Matched to your skills, education and location</p></div><a className="candidate-view-all" href="#job-search" onClick={(event) => { event.preventDefault(); setActiveView('jobs'); }}>View all jobs →</a></div>
                {recommendations.length
                  ? recommendations.slice(0, 3).map((job) => (
                    <JobCard key={job._id} job={job} match={jobMatch(job, profile)} saved={savedIds.has(job._id)} applied={appliedIds.has(job._id)} busy={working === job._id} onApply={apply} onSave={saveJob} />
                  ))
                  : <p className="card candidate-empty">No open jobs yet. Check back soon for new opportunities.</p>}
              </section>

              <section className="candidate-section" id="job-search">
                <h2>Find your next opportunity</h2>
                <form className="card candidate-search" onSubmit={search}>
                  <label>Job title<input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="e.g. Data Analyst" /></label>
                  <label>Location<input value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })} placeholder="e.g. Gqeberha" /></label>
                  <label>Industry<input value={filters.industry} onChange={(event) => setFilters({ ...filters, industry: event.target.value })} placeholder="e.g. Finance" /></label>
                  <label>Employment type<input value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })} placeholder="e.g. Internship" /></label>
                  <button className="btn" type="submit" disabled={working === 'search'}>{working === 'search' ? 'Searching…' : 'Search jobs'}</button>
                </form>
                <h3 className="candidate-subheading">{displayedTitle}</h3>
                {displayedJobs.length
                  ? displayedJobs.map((job) => (
                    <JobCard key={job._id} job={job} match={jobMatch(job, profile)} saved={savedIds.has(job._id)} applied={appliedIds.has(job._id)} busy={working === job._id} onApply={apply} onSave={saveJob} />
                  ))
                  : <p className="card candidate-empty">No jobs match those filters. Try another title, location or employment type.</p>}
              </section>

              <section className="candidate-section" id="applications">
                <div className="row candidate-section-heading"><div><h2>My applications</h2><p>Track each application from submission to outcome</p></div></div>
                {applications.length === 0
                  ? <p className="card candidate-empty">You have no applications yet. Explore recommended jobs to get started.</p>
                  : applications.map((application) => {
                    const stage = applicationStage(application.status);
                    const stages = ['Received', 'Under Review', 'Shortlisted', 'Assessment', 'Interview', 'Offer Made', 'Hired'];
                    const stageIndex = stages.indexOf(stage);
                    return (
                      <article className="card candidate-application-card" key={application._id}>
                        <div className="row candidate-application">
                          <div>
                            <h3>{application.job?.title || 'Vacancy'}</h3>
                            <p>{[application.job?.company || 'Mbono', application.job?.department, application.job?.location].filter(Boolean).join(' · ')}</p>
                            <small>Applied {new Date(application.createdAt).toLocaleDateString()}</small>
                          </div>
                          <div className="candidate-application-meta">
                            <span className={`candidate-status status-${application.status.toLowerCase().replaceAll(' ', '-')}`}>{application.status}</span>
                            <span className="tag">Match {application.score ?? 0}%</span>
                          </div>
                        </div>
                        {stageIndex >= 0 && <div className="candidate-tracker" aria-label={`Application progress: ${application.status}`}>
                          {['Applied', 'Screening', 'Interview', 'Offer'].map((step, index) => {
                            const active = stageIndex >= [0, 1, 4, 5][index];
                            return <div className={`candidate-tracker-step${active ? ' complete' : ''}`} key={step}><span aria-hidden="true">{active ? '✓' : ''}</span><small>{step}</small></div>;
                          })}
                        </div>}
                        {application.interviewDate && <p className="candidate-application-interview">Interview: {new Date(application.interviewDate).toLocaleString()}{application.interviewer?.name ? ` · ${application.interviewer.name}` : ''}</p>}
                        {!finalStatuses.includes(application.status) && (
                          <button className="btn sm ghost candidate-withdraw" type="button" disabled={working === application._id} onClick={() => withdraw(application._id)}>{working === application._id ? 'Withdrawing…' : 'Withdraw'}</button>
                        )}
                      </article>
                    );
                  })}
              </section>
            </div>

            <aside className="candidate-secondary">
              <section className="candidate-section" id="interviews">
                <div className="row candidate-section-heading"><h2>Upcoming interviews</h2><span className="tag">{upcomingInterviews.length}</span></div>
                {upcomingInterviews.length === 0
                  ? <p className="card candidate-empty">No interviews yet. Interview invitations will appear here.</p>
                  : upcomingInterviews.map((application) => (
                    <article className="card candidate-interview" key={application._id}>
                      <h3>{application.job?.title || 'Interview'}</h3>
                      <p>{new Date(application.interviewDate).toLocaleString()}</p>
                      {application.interviewer?.name && <p>Interviewer: {application.interviewer.name}</p>}
                      {application.meetingLink && <a className="candidate-meeting-link" href={application.meetingLink} target="_blank" rel="noreferrer">Join meeting</a>}
                      <a className="link candidate-calendar" href={calendarUrl(application)} target="_blank" rel="noreferrer">Add to calendar</a>
                    </article>
                  ))}
              </section>

              <section className="candidate-section" id="saved-jobs">
                <div className="row candidate-section-heading"><h2>Saved jobs</h2><span className="tag">{savedJobs.length}</span></div>
                {savedJobs.length === 0
                  ? <p className="card candidate-empty">No saved jobs yet. Save a vacancy to come back to it later.</p>
                  : savedJobs.map((job) => (
                    <article className="card candidate-saved" key={job._id}>
                      <h3>{job.title}</h3>
                      <p>{[job.location, job.type].filter(Boolean).join(' · ')}</p>
                      <div className="row">
                        <button className="btn sm" type="button" disabled={appliedIds.has(job._id) || working === job._id} onClick={() => apply(job._id)}>{appliedIds.has(job._id) ? 'Applied' : 'Apply'}</button>
                        <button className="link" type="button" disabled={working === job._id} onClick={() => saveJob(job._id, false)}>Remove</button>
                      </div>
                    </article>
                  ))}
              </section>

              <section className="candidate-section" id="notifications">
                <div className="row candidate-section-heading"><h2>Notifications</h2>{unreadNotifications > 0 && <span className="tag">{unreadNotifications} new</span>}</div>
                {notifications.length === 0
                  ? <p className="card candidate-empty">No notifications yet. Application updates and interview reminders will appear here.</p>
                  : notifications.map((notification) => (
                    <button className={`card candidate-notification${notification.read ? '' : ' unread'}`} key={notification._id} type="button" onClick={() => markRead(notification)}>
                      <span>{notification.text}</span>
                      <small>{new Date(notification.createdAt).toLocaleDateString()}</small>
                      {!notification.read && <span className="tag">New</span>}
                    </button>
                  ))}
              </section>

              <section className="candidate-section">
                <h2>Career profile</h2>
                <div className="card candidate-career-card">
                  <p>{profile?.cvName ? `CV on file: ${profile.cvName}` : 'Add your CV and profile details to help recruiters find you.'}</p>
                  <Link className="btn sm" href="/dashboard/profile">{profile?.cvName ? 'Manage profile' : 'Complete your profile'}</Link>
                  {!profile?.cvName && <Link className="candidate-upload-link" href="/dashboard/profile#cv-upload">Upload your CV →</Link>}
                </div>
              </section>

              <section className="candidate-section">
                <h2>Skills in demand</h2>
                <div className="card candidate-career-card">
                  <p>Skills appearing in open vacancies that you could explore next.</p>
                  {skillSuggestions.length
                    ? <div className="candidate-skill-tags">{skillSuggestions.map((skill) => <span className="tag" key={skill.name}>{skill.name}</span>)}</div>
                    : <p className="candidate-empty">Add skills to your profile to see what’s in demand.</p>}
                </div>
              </section>
            </aside>
          </div>
          </>}

          {(activeView === 'jobs' || activeView === 'applications') && (
            <section className="candidate-page-view" aria-labelledby="candidate-vacancies-title">
              <header className="candidate-page-heading">
                <p className="candidate-eyebrow">{activeView === 'applications' ? 'Applications · Open vacancies' : 'Find jobs'}</p>
                <h1 id="candidate-vacancies-title">All open vacancies</h1>
                <p>Browse every current opening, save jobs for later, or apply to a role that matches your goals. To track applications you have already sent, return to your dashboard.</p>
              </header>
              <form className="card candidate-search" onSubmit={search}>
                <label>Job title<input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="e.g. Data Analyst" /></label>
                <label>Location<input value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })} placeholder="e.g. Gqeberha" /></label>
                <label>Industry<input value={filters.industry} onChange={(event) => setFilters({ ...filters, industry: event.target.value })} placeholder="e.g. Finance" /></label>
                <label>Employment type<input value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })} placeholder="e.g. Internship" /></label>
                <div className="candidate-vacancy-actions">
                  <button className="btn" type="submit" disabled={working === 'search'}>{working === 'search' ? 'Searching…' : 'Search vacancies'}</button>
                  {searchResults && <button className="btn sm ghost" type="button" onClick={() => { setSearchResults(null); setFilters({ q: '', location: '', industry: '', type: '' }); }}>Clear filters</button>}
                </div>
              </form>
              <div className="row candidate-section-heading">
                <div><h2>{displayedTitle}</h2><p>{displayedJobs.length} {displayedJobs.length === 1 ? 'vacancy' : 'vacancies'} available</p></div>
              </div>
              {displayedJobs.length
                ? displayedJobs.map((job) => (
                  <JobCard key={job._id} job={job} match={jobMatch(job, profile)} saved={savedIds.has(job._id)} applied={appliedIds.has(job._id)} busy={working === job._id} onApply={apply} onSave={saveJob} />
                ))
                : <p className="card candidate-empty">{searchResults ? 'No jobs match those filters. Try another title, location or employment type.' : 'There are no open vacancies right now. Check back soon for new opportunities.'}</p>}
            </section>
          )}

          {activeView === 'notifications' && (
            <section className="candidate-page-view" aria-labelledby="candidate-notifications-title">
              <header className="candidate-page-heading">
                <p className="candidate-eyebrow">Your updates</p>
                <h1 id="candidate-notifications-title">Notifications</h1>
                <p>Application updates, assessment invitations and interview reminders for your account.</p>
              </header>
              {notifications.length === 0
                ? <p className="card candidate-empty">No notifications yet. Application updates and interview reminders will appear here.</p>
                : notifications.map((notification) => (
                  <button className={`card candidate-notification${notification.read ? '' : ' unread'}`} key={notification._id} type="button" onClick={() => markRead(notification)}>
                    <span>{notification.text}</span>
                    <small>{new Date(notification.createdAt).toLocaleDateString()}</small>
                    {!notification.read && <span className="tag">New</span>}
                  </button>
                ))}
            </section>
          )}

          {activeView === 'interviews' && (
            <section className="candidate-page-view" aria-labelledby="candidate-interviews-title">
              <header className="candidate-page-heading">
                <p className="candidate-eyebrow">Your schedule</p>
                <h1 id="candidate-interviews-title">Upcoming interviews</h1>
                <p>Interview invitations and meeting details for your applications.</p>
              </header>
              {upcomingInterviews.length === 0
                ? <p className="card candidate-empty">No interviews yet. Interview invitations will appear here.</p>
                : upcomingInterviews.map((application) => (
                  <article className="card candidate-interview" key={application._id}>
                    <h3>{application.job?.title || 'Interview'}</h3>
                    <p>{new Date(application.interviewDate).toLocaleString()}</p>
                    {application.interviewer?.name && <p>Interviewer: {application.interviewer.name}</p>}
                    {application.meetingLink && <a className="candidate-meeting-link" href={application.meetingLink} target="_blank" rel="noreferrer">Join meeting</a>}
                    <a className="link candidate-calendar" href={calendarUrl(application)} target="_blank" rel="noreferrer">Add to calendar</a>
                  </article>
                ))}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
