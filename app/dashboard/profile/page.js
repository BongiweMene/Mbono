'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const emptyProfile = {
  name: '',
  email: '',
  phone: '',
  address: '',
  idPassportNumber: '',
  employmentHistory: [],
  educationHistory: [],
  certifications: [],
  references: [],
  skills: [],
  languages: [],
  cvName: '',
};

const sections = [
  {
    key: 'employmentHistory',
    title: 'Employment history',
    fields: [
      ['company', 'Company'],
      ['jobTitle', 'Job title'],
      ['startDate', 'Start date', 'date'],
      ['endDate', 'End date', 'date'],
      ['description', 'Description', 'textarea'],
    ],
  },
  {
    key: 'educationHistory',
    title: 'Education history',
    fields: [['institution', 'Institution'], ['qualification', 'Qualification'], ['year', 'Year', 'number']],
  },
  {
    key: 'certifications',
    title: 'Certifications',
    fields: [['name', 'Certification name'], ['issuer', 'Issuer'], ['year', 'Year', 'number']],
  },
  {
    key: 'references',
    title: 'Professional references',
    fields: [['name', 'Name'], ['company', 'Company'], ['phone', 'Phone', 'tel'], ['email', 'Email', 'email']],
  },
];

function splitTags(value) {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [skillsText, setSkillsText] = useState('');
  const [languagesText, setLanguagesText] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [cvSaving, setCvSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch('/api/profile');
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 403) {
            window.location.assign('/login');
            return;
          }
          throw new Error(data.error || 'Unable to load your profile. Please refresh the page.');
        }
        const nextProfile = { ...emptyProfile, ...data.profile };
        setProfile(nextProfile);
        setSkillsText(nextProfile.skills.join(', '));
        setLanguagesText(nextProfile.languages.join(', '));
      } catch (loadError) {
        setError(loadError.message || 'Unable to load your profile. Please refresh the page.');
      }
    }
    loadProfile();
  }, []);

  function updateField(key, value) {
    setProfile((current) => ({ ...current, [key]: value }));
    setNotice('');
  }

  function updateRow(section, index, field, value) {
    setProfile((current) => ({
      ...current,
      [section]: current[section].map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row),
    }));
    setNotice('');
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          skills: splitTags(skillsText),
          languages: splitTags(languagesText),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save your profile. Please check your details and try again.');
      setProfile({ ...emptyProfile, ...data.profile });
      setSkillsText(data.profile.skills.join(', '));
      setLanguagesText(data.profile.languages.join(', '));
      setNotice(data.message || 'Your profile has been saved.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save your profile. Please check your details and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadCv(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError('');
    setNotice('');
    setCvSaving(true);
    try {
      const response = await fetch('/api/profile/cv', { method: 'PUT', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to upload your CV. Choose a PDF or DOCX file and try again.');
      setProfile((current) => ({ ...current, cvName: data.cvName }));
      form.reset();
      setNotice(data.message || 'Your CV has been uploaded.');
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to upload your CV. Choose a PDF or DOCX file and try again.');
    } finally {
      setCvSaving(false);
    }
  }

  async function removeCv() {
    setError('');
    setNotice('');
    setCvSaving(true);
    try {
      const response = await fetch('/api/profile/cv', { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to remove your CV. Please try again.');
      setProfile((current) => ({ ...current, cvName: '' }));
      setNotice(data.message || 'Your CV has been removed.');
    } catch (removeError) {
      setError(removeError.message || 'Unable to remove your CV. Please try again.');
    } finally {
      setCvSaving(false);
    }
  }

  if (!profile) return <main className="wrap profile-page"><p>{error || 'Loading your profile…'}</p></main>;

  return (
    <main className="wrap profile-page">
      <nav>
        <Link className="mbono-profile-logo" href="/dashboard" aria-label="Mbono Career Goals dashboard"><img className="mbono-logo-lockup" src="/mbono-career-goals.png" alt="Mbono Career Goals — Building skills, unlocking opportunity" /></Link>
        <Link className="btn sm ghost" href="/dashboard">Back to dashboard</Link>
      </nav>
      <div className="profile-heading">
        <h1>Your candidate profile</h1>
        <p>Keep your experience and skills up to date so recruiters can find the right match.</p>
      </div>
      <form className="card profile-form" onSubmit={saveProfile}>
        <section className="profile-section">
          <h2>Personal details</h2>
          <div className="profile-grid">
            <label>Full name<input autoComplete="name" maxLength="120" required value={profile.name} onChange={(event) => updateField('name', event.target.value)} /></label>
            <label>Email<input type="email" value={profile.email} readOnly /></label>
            <label>Phone<input autoComplete="tel" maxLength="40" type="tel" value={profile.phone} onChange={(event) => updateField('phone', event.target.value)} /></label>
            <label>Address<input autoComplete="street-address" maxLength="300" value={profile.address} onChange={(event) => updateField('address', event.target.value)} /></label>
            <label>ID/passport number (optional)<input maxLength="80" autoComplete="off" value={profile.idPassportNumber} onChange={(event) => updateField('idPassportNumber', event.target.value)} /></label>
          </div>
        </section>

        {sections.map((section) => (
          <section className="profile-section" key={section.key}>
            <div className="row profile-section-heading">
              <h2>{section.title}</h2>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => updateField(section.key, [...profile[section.key], Object.fromEntries(section.fields.map(([field]) => [field, '']))])}
              >
                Add {section.title.toLowerCase().replace(/s$/, '')}
              </button>
            </div>
            {profile[section.key].length === 0 && <p className="profile-empty">No entries added yet.</p>}
            {profile[section.key].map((row, index) => (
              <div className="profile-entry" key={`${section.key}-${index}`}>
                <div className="profile-grid">
                  {section.fields.map(([field, label, type]) => (
                    <label className={type === 'textarea' ? 'profile-wide' : ''} key={field}>
                      {label}
                      {type === 'textarea'
                        ? <textarea maxLength="2000" rows="3" value={row[field]} onChange={(event) => updateRow(section.key, index, field, event.target.value)} />
                        : <input type={type || 'text'} maxLength={type === 'number' ? 4 : undefined} value={row[field]} onChange={(event) => updateRow(section.key, index, field, event.target.value)} />}
                    </label>
                  ))}
                </div>
                <button type="button" className="link profile-remove" onClick={() => updateField(section.key, profile[section.key].filter((_, rowIndex) => rowIndex !== index))}>Remove entry</button>
              </div>
            ))}
          </section>
        ))}

        <section className="profile-section">
          <h2>Skills and languages</h2>
          <div className="profile-grid">
            <label>Skills (separate with commas)
              <input value={skillsText} onChange={(event) => { setSkillsText(event.target.value); setNotice(''); }} placeholder="Excel, SQL, reporting" />
              <span className="profile-tags">{splitTags(skillsText).map((skill) => <span className="tag" key={skill}>{skill}</span>)}</span>
            </label>
            <label>Languages spoken (separate with commas)
              <input value={languagesText} onChange={(event) => { setLanguagesText(event.target.value); setNotice(''); }} placeholder="English, isiXhosa, Afrikaans" />
              <span className="profile-tags">{splitTags(languagesText).map((language) => <span className="tag" key={language}>{language}</span>)}</span>
            </label>
          </div>
        </section>

        {error && <p className="err" role="alert">{error}</p>}
        {notice && <p className="profile-success" role="status">{notice}</p>}
        <button className="btn profile-save" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
      </form>
      <section className="card profile-form profile-section" id="cv-upload">
        <h2>Your CV</h2>
        <p className="profile-empty">Upload a PDF or DOCX file up to 4 MB. Only you can access this file from your account.</p>
        {profile.cvName && (
          <div className="profile-cv-current">
            <span>Current CV: <strong>{profile.cvName}</strong></span>
            <div className="row">
              <a className="btn sm ghost" href="/api/profile/cv">Download</a>
              <button className="btn sm ghost" type="button" onClick={removeCv} disabled={cvSaving}>Remove CV</button>
            </div>
          </div>
        )}
        <form className="profile-cv-form" onSubmit={uploadCv}>
          <label htmlFor="candidate-cv">{profile.cvName ? 'Choose a replacement CV' : 'Choose your CV'}</label>
          <input id="candidate-cv" name="cv" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
          <button className="btn sm" type="submit" disabled={cvSaving}>{cvSaving ? 'Uploading…' : profile.cvName ? 'Replace CV' : 'Upload CV'}</button>
        </form>
      </section>
    </main>
  );
}
