import Link from 'next/link';
import Image from 'next/image';
import SiteHeader from '@/components/SiteHeader';

const steps = [
  ['01', 'Build your profile', 'Add your details, skills and CV once, so every application starts from a complete profile.'],
  ['02', 'Apply in one click', 'Search open roles, see how well you match and apply with your saved profile.'],
  ['03', 'Interview and get hired', 'Follow every stage from received to hired, all in one place.'],
];

const roles = [
  ['Candidates', 'Build a profile, apply for roles and track each application.'],
  ['Recruiters', 'Post vacancies, rank applicants by match score and manage the pipeline.'],
  ['Hiring managers', 'Approve vacancies, review shortlists and give feedback.'],
  ['Interviewers', 'See your assigned interviews and submit scorecards.'],
  ['Admins', 'Manage users and roles, and review audit logs and hiring numbers.'],
];

const feats = [
  'Search open roles by title and location',
  'A match score on every application',
  'Track every stage from received to hired',
  'One profile for every application',
  'Your data protected under POPIA',
  'Chat help, with a person to follow up',
];

export default function Home() {
  return (
    <main>
      <SiteHeader />
      <header className="hero">
        <div className="wrap hero-layout">
          <div className="hero-copy">
            <span className="badge">MBONO CAREER GOALS</span>
            <h1>Connecting talent to <em>opportunity</em></h1>
            <p>The Mbono application platform for young professionals and graduates in the Eastern Cape. Create a profile, apply for roles and follow your application from received to hired.</p>
            <form className="search" action="/login">
              <input aria-label="Job title" placeholder="Job title, e.g. Data Analyst" />
              <input aria-label="Location" placeholder="Location" />
              <button className="btn red">Find jobs</button>
            </form>
            <div className="chips">
              <Link className="btn alt" href="/login?m=register">Create profile</Link>
              <Link className="btn ghost" href="/login">Log in</Link>
            </div>
          </div>
          <Image
            className="hero-image"
            src="/career-team.webp"
            alt="Professionals collaborating in a bright office"
            width={800}
            height={533}
            priority
          />
        </div>
      </header>
      <section className="wrap">
        <div className="grid">
          {steps.map(([number, title, description]) => (
            <article className="role" key={number}>
              <span className="num">{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="wrap sec">
        <span className="badge dark">THE HIRING JOURNEY</span>
        <h2>Built for everyone in the process</h2>
        <p className="lead">From the first application to the final offer, each person sees the tools and information they need.</p>
        <div className="rgrid">
          {roles.map(([title, description]) => (
            <article className="card" key={title}>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="wrap sec two">
        <div>
          <span className="badge dark">WHY APPLY HERE</span>
          <h2>Simple, clear and fair</h2>
          <p className="lead">We want every applicant to know where they stand.</p>
        </div>
        <ul className="ticks">{feats.map((feature) => <li key={feature}>{feature}</li>)}</ul>
      </section>
      <section className="wrap">
        <div className="band">
          <div>
            <h2>Take the next step in your career.</h2>
            <p>Create your free profile in under two minutes.</p>
          </div>
          <div className="chips">
            <Link className="btn alt" href="/login?m=register">Create profile</Link>
            <a className="btn ghost" href="https://www.mbono.co.za/request-talent" target="_blank" rel="noopener noreferrer">Request talent</a>
          </div>
        </div>
      </section>
    </main>
  );
}
