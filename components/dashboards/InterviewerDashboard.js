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

function suggestedQuestions(title = '') {
  const role = title.toLowerCase();
  if (/developer|engineer|software|frontend|backend|data analyst|data scientist|it /.test(role)) {
    return [
      'Tell me about a project where you solved a challenging technical problem.',
      'How do you test your work and respond when something fails?',
      'Which tools or technical skills would you like to develop further?',
    ];
  }
  if (/sales|marketing|customer|service|support|bpo/.test(role)) {
    return [
      'Tell me about a time you helped a customer or colleague resolve a difficult issue.',
      'How do you adapt your communication for different people?',
      'Describe a goal you had to meet and how you tracked your progress.',
    ];
  }
  if (/hr|human resource|recruit/.test(role)) {
    return [
      'How would you help create a fair and consistent candidate experience?',
      'Tell me about a time you handled confidential or sensitive information.',
      'How do you balance people’s needs with a clear process?',
    ];
  }
  return [
    'What interests you most about this role and the work Mbono does?',
    'Tell me about a time you learned something new to complete a task.',
    'How do you approach working with people whose perspectives differ from yours?',
  ];
}

function interviewTime(value) {
  return new Date(value).toLocaleString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function interviewClock(value) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function InterviewCard({ application, userId, onSubmit, saving }) {
  const [ratings, setRatings] = useState({ skills: '', communication: '', cultureFit: '' });
  const [recommendation, setRecommendation] = useState('');
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const candidate = application.candidate || {};
  const job = application.job || {};
  const previousScorecard = application.scorecards?.find((scorecard) => String(scorecard.by) === String(userId));
  const panel = application.panelMembers?.length
    ? application.panelMembers
    : application.interviewer ? [application.interviewer] : [];

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
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <article className="card interviewer-card">
      <header className="interviewer-card-heading">
        <div>
          <h3>{candidate.name || 'Candidate'}</h3>
          <p>{job.title || 'Interview'}{job.location ? ` · ${job.location}` : ''}</p>
        </div>
        <div className="interviewer-card-badges">
          <span className="tag">{interviewTime(application.interviewDate)}</span>
          {new Date(application.interviewDate) < new Date() && <span className="interviewer-overdue">Feedback overdue</span>}
        </div>
      </header>
      <div className="interviewer-summary">
        <strong>Candidate summary</strong>
        {candidate.experience && <p>{candidate.experience}</p>}
        {candidate.education && <p>{candidate.education}</p>}
        {candidate.skills?.length > 0 && <p><b>Skills:</b> {candidate.skills.join(', ')}</p>}
        {candidate.employmentHistory?.length > 0 && (
          <p><b>Recent experience:</b> {candidate.employmentHistory.slice(0, 3).map((item) => [item.jobTitle, item.company].filter(Boolean).join(' at ')).filter(Boolean).join(' · ')}</p>
        )}
        {candidate.educationHistory?.length > 0 && (
          <p><b>Education:</b> {candidate.educationHistory.slice(0, 2).map((item) => [item.qualification, item.institution].filter(Boolean).join(' — ')).filter(Boolean).join(' · ')}</p>
        )}
        {!candidate.experience && !candidate.education && !candidate.skills?.length && !candidate.employmentHistory?.length && !candidate.educationHistory?.length && (
          <p>No candidate summary has been added yet.</p>
        )}
        {candidate.cvName && <a className="btn sm ghost interviewer-cv" href={`/api/profile/cv?applicationId=${application._id}`}>View candidate CV</a>}
      </div>
      {job.description && <details className="interviewer-preparation"><summary>Role preparation</summary><p>{job.description}</p></details>}
      {job.skills?.length > 0 && <div className="interviewer-competencies"><strong>Role competencies</strong><div>{job.skills.map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></div>}
      {application.meetingLink && (
        <a className="btn interviewer-meeting" href={application.meetingLink} target="_blank" rel="noreferrer">Join meeting</a>
      )}
      <div className="interviewer-panel"><strong>Interview panel</strong>
        {panel.length
          ? <ul>{panel.map((member) => <li key={member._id}>{member.name || 'Panel member'}{member.role ? ` · ${member.role.replace('_', ' ')}` : ''}</li>)}</ul>
          : <p>No other panel members are listed.</p>}
      </div>
      <div className="interviewer-questions">
        <h4>Suggested questions</h4>
        <ul>{suggestedQuestions(job.title).map((question) => <li key={question}>{question}</li>)}</ul>
      </div>

      {previousScorecard || submitted ? (
        <div className="interviewer-submitted" role="status">
          <strong>Scorecard submitted</strong>
          {previousScorecard && <p>Recommendation: {previousScorecard.recommendation}. Your feedback has been recorded.</p>}
          {submitted && <p>Your scorecard has been recorded.</p>}
        </div>
      ) : (
        <form className="interviewer-scorecard" onSubmit={submit}>
          <h4>Scorecard</h4>
          <div className="interviewer-rating-grid">
            {[['skills', 'Role-related skills'], ['communication', 'Communication'], ['cultureFit', 'Culture fit']].map(([key, label]) => (
              <label key={key}>{label}
                <select required value={ratings[key]} onChange={(event) => setRatings({ ...ratings, [key]: event.target.value })}>
                  <option value="">Select a rating</option>
                  {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
                </select>
              </label>
            ))}
          </div>
          <label>Recommendation
            <select required value={recommendation} onChange={(event) => setRecommendation(event.target.value)}>
              <option value="">Choose a recommendation</option>
              <option value="hire">Hire</option>
              <option value="maybe">Maybe</option>
              <option value="no hire">No hire</option>
            </select>
          </label>
          <label>Comments<textarea rows="3" maxLength="3000" value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Add interview feedback for the hiring team" /></label>
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn" disabled={saving}>{saving ? 'Submitting…' : 'Submit scorecard'}</button>
        </form>
      )}
    </article>
  );
}

function CompletedInterview({ application }) {
  const scorecard = application.scorecards?.[0];
  if (!scorecard) return null;
  const submittedDate = scorecard.submittedAt
    ? new Date(scorecard.submittedAt).toLocaleDateString()
    : '';
  return (
    <article className="card interviewer-completed">
      <div className="row">
        <div><h3>{application.candidate?.name || 'Candidate'} · {application.job?.title || 'Interview'}</h3>
          <p>{interviewTime(application.interviewDate)}{submittedDate ? ` · Feedback submitted ${submittedDate}` : ''}</p>
        </div>
        <span className="tag">{scorecard.recommendation}</span>
      </div>
      <div className="interviewer-completed-ratings">
        <span>Skills <b>{scorecard.ratings?.skills ?? '—'}/5</b></span>
        <span>Communication <b>{scorecard.ratings?.communication ?? '—'}/5</b></span>
        <span>Culture fit <b>{scorecard.ratings?.cultureFit ?? '—'}/5</b></span>
      </div>
      {scorecard.comments && <p>{scorecard.comments}</p>}
    </article>
  );
}

export default function InterviewerDashboard({ user }) {
  const router = useRouter();
  const [activeView, setActiveView] = useState('overview');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setApplications(await request('/api/applications'));
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

  const scheduledInterviews = useMemo(
    () => applications
      .filter((application) => application.interviewDate)
      .sort((a, b) => new Date(a.interviewDate) - new Date(b.interviewDate)),
    [applications],
  );
  const { today, thisWeek } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const todayInterviews = scheduledInterviews.filter((application) => {
      const date = new Date(application.interviewDate);
      return date >= todayStart && date < tomorrow;
    });
    const weekInterviews = scheduledInterviews.filter((application) => {
      const date = new Date(application.interviewDate);
      return date >= tomorrow && date < weekEnd;
    });
    return { today: todayInterviews, thisWeek: weekInterviews };
  }, [scheduledInterviews]);
  const scorecardsOwed = scheduledInterviews.filter(
    (application) => !application.scorecards?.some((scorecard) => String(scorecard.by) === String(user.id)),
  );
  const completedEvaluations = scheduledInterviews.filter(
    (application) => application.scorecards?.some((scorecard) => String(scorecard.by) === String(user.id)),
  );
  const weekDays = useMemo(() => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return date;
    });
  }, []);

  async function submitScorecard(applicationId, scorecard) {
    setError('');
    setWorking(applicationId);
    try {
      await request('/api/applications', 'PATCH', { id: applicationId, scorecard });
      setNotice('Scorecard submitted successfully.');
      await load();
    } catch (submitError) {
      throw submitError;
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

  function interviewList(title, list, emptyText) {
    return (
      <section className="interviewer-section">
        <div className="interviewer-section-heading"><h2>{title}</h2><span className="tag">{list.length}</span></div>
        {list.length === 0
          ? <p className="card interviewer-empty">{emptyText}</p>
          : list.map((application) => (
            <article className="card interviewer-brief" key={application._id}>
              <div><h3>{application.candidate?.name || 'Candidate'} · {application.job?.title || 'Interview'}</h3><p>{interviewTime(application.interviewDate)} · {application.panelMembers?.length > 1 ? 'Panel interview' : 'Interview'}</p></div>
              <div className="interviewer-brief-actions">
                {application.candidate?.cvName && <a className="btn sm ghost" href={`/api/profile/cv?applicationId=${application._id}`}>View candidate</a>}
                {application.meetingLink && <a className="btn sm" href={application.meetingLink} target="_blank" rel="noreferrer">Join meeting</a>}
              </div>
            </article>
          ))}
      </section>
    );
  }

  if (loading) return <main className="wrap"><p>Loading your interviewer dashboard…</p></main>;

  return (
    <main className="interviewer-shell">
      <aside className="interviewer-sidebar">
        <a className="interviewer-sidebar-brand" href="/dashboard" aria-label="Mbono Career Goals dashboard"><img src="/mbono-career-goals.png" alt="Mbono Career Goals — Building skills, unlocking opportunity" /></a>
        <p className="interviewer-sidebar-label">Interview workspace</p>
        <nav className="interviewer-sidebar-nav" aria-label="Interviewer dashboard">
          {[['overview', 'Overview', '▦'], ['calendar', 'Interview calendar', '◷'], ['scorecards', 'Pending scorecards', '▤'], ['completed', 'Completed evaluations', '✓']].map(([view, label, icon]) => (
            <button key={view} type="button" aria-current={activeView === view ? 'page' : undefined} onClick={() => setActiveView(view)}>
              <span aria-hidden="true">{icon}</span><span>{label}</span>
              {view === 'scorecards' && scorecardsOwed.length > 0 && <small>{scorecardsOwed.length}</small>}
            </button>
          ))}
        </nav>
        <div className="interviewer-sidebar-user">
          <span className="interviewer-sidebar-avatar">{(user.name || 'I').slice(0, 1).toUpperCase()}</span>
          <span className="interviewer-sidebar-identity">{user.name || 'Interviewer'}<small>Interviewer</small></span>
          <button className="btn sm ghost" onClick={logout}>Log out</button>
        </div>
      </aside>
      <div className="interviewer-workspace">
      <div className="wrap interviewer-dashboard">
      <header className="interviewer-welcome">
        <p>Interview workspace</p>
        <h1>Welcome, {user.name || 'interviewer'}</h1>
        <span>Prepare for your assigned interviews and share structured feedback. Candidate details are visible only for interviews assigned to you.</span>
      </header>
      {error && <p className="err" role="alert">{error}</p>}
      {notice && <p className="interviewer-success" role="status">{notice}</p>}
      <section className="interviewer-stats stats" aria-label="Interview statistics" hidden={activeView !== 'overview'}>
        <article className="stat"><span>Assigned interviews</span><b>{scheduledInterviews.length}</b></article>
        <article className="stat"><span>Scorecards outstanding</span><b>{scorecardsOwed.length}</b></article>
        <article className="stat"><span>Completed evaluations</span><b>{completedEvaluations.length}</b></article>
        <article className="stat"><span>Interview today</span><b>{today.length}</b></article>
      </section>
      <section id="interviewer-panel-overview" hidden={activeView !== 'overview'}>
        {interviewList('Today’s interviews', today, 'No interviews today. Your assigned interviews will appear here.')}
        {interviewList('Upcoming this week', thisWeek, 'No more interviews scheduled this week.')}
        <div className="interviewer-section-heading"><h2>Reminders</h2></div>
        {scorecardsOwed.filter((application) => new Date(application.interviewDate) < new Date()).length === 0
          ? <p className="card interviewer-empty">No overdue scorecards. Check upcoming interviews to prepare.</p>
          : scorecardsOwed.filter((application) => new Date(application.interviewDate) < new Date()).map((application) => (
            <div className="card interviewer-reminder" key={application._id}><span>Feedback overdue for {application.candidate?.name || 'your candidate'} · {application.job?.title || 'interview'}</span><button className="btn sm" onClick={() => setActiveView('scorecards')}>Open scorecard</button></div>
          ))}
      </section>
      <section id="interviewer-panel-calendar" className="interviewer-section" hidden={activeView !== 'calendar'}>
        <div className="interviewer-section-heading"><div><h2>This week</h2><p>Assigned interviews by day</p></div></div>
        <div className="interviewer-week-grid">
          {weekDays.map((date) => {
            const dayInterviews = scheduledInterviews.filter((application) => {
              const interviewDate = new Date(application.interviewDate);
              return interviewDate.toDateString() === date.toDateString();
            });
            return <article className="interviewer-week-day" key={date.toISOString()}>
              <h3>{date.toLocaleDateString([], { weekday: 'short' })}<span>{date.getDate()}</span></h3>
              {dayInterviews.length === 0
                ? <p>No interviews</p>
                : dayInterviews.map((application) => <div className="interviewer-calendar-event" key={application._id}>
                  <strong>{interviewClock(application.interviewDate)}</strong>
                  <span>{application.job?.title || 'Interview'}</span>
                  <small>{application.candidate?.name || 'Candidate'}</small>
                  {application.meetingLink && <a href={application.meetingLink} target="_blank" rel="noreferrer">Join meeting</a>}
                </div>)}
            </article>;
          })}
        </div>
      </section>
      <section id="interviewer-panel-scorecards" className="interviewer-section" hidden={activeView !== 'scorecards'}>
        <div className="interviewer-section-heading"><h2>Scorecards to submit</h2><span className="tag">{scorecardsOwed.length}</span></div>
        {scorecardsOwed.length === 0
          ? <p className="card interviewer-empty">No scorecards are waiting for you.</p>
          : scorecardsOwed.map((application) => (
            <InterviewCard
              key={application._id}
              application={application}
              userId={user.id}
              onSubmit={submitScorecard}
              saving={working === application._id}
            />
          ))}
      </section>
      <section id="interviewer-panel-completed" className="interviewer-section" hidden={activeView !== 'completed'}>
        <div className="interviewer-section-heading"><h2>Completed evaluations</h2><span className="tag">{completedEvaluations.length}</span></div>
        {completedEvaluations.length === 0
          ? <p className="card interviewer-empty">No completed evaluations yet. Submitted scorecards will appear here.</p>
          : completedEvaluations.map((application) => <CompletedInterview key={application._id} application={application} />)}
      </section>
      </div>
      </div>
    </main>
  );
}
