'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(searchParams.get('m') === 'register');
  const [form, setForm] = useState({ name: '', email: '', password: '', consent: false });
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setWorking(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, mode: isRegistering ? 'register' : 'login' }),
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error('The server returned an invalid response. Please try again.');
      }
      if (!response.ok) throw new Error(result.error || 'Unable to sign in. Check your details and try again.');
    router.push(result.role === 'support' ? '/support' : '/dashboard');
    } catch (submitError) {
      setError(submitError.message || 'Unable to connect. Check your connection and try again.');
    } finally {
      setWorking(false);
    }
  }

  function switchMode() {
    setError('');
    setIsRegistering((current) => !current);
  }

  return (
    <main>
      <SiteHeader />
      <form className="card auth login-form" onSubmit={submit}>
        <img className="mbono-login-logo" src="/mbono-career-goals.png" alt="Mbono Career Goals — Building skills, unlocking opportunity" />
        <h1>{isRegistering ? 'Create your profile' : 'Welcome back'}</h1>
        {isRegistering && (
          <label>Full name
            <input name="name" autoComplete="name" maxLength="120" required value={form.name} onChange={updateField} />
          </label>
        )}
        <label>Email
          <input name="email" type="email" autoComplete="email" maxLength="254" required value={form.email} onChange={updateField} />
        </label>
        <label>Password
          <input name="password" type="password" autoComplete={isRegistering ? 'new-password' : 'current-password'} minLength="8" maxLength="128" required value={form.password} onChange={updateField} />
        </label>
        {isRegistering && (
          <label className="login-consent">
            <input name="consent" type="checkbox" required checked={form.consent} onChange={updateField} />
            <span>I accept the privacy policy and consent to my data being processed under POPIA.</span>
          </label>
        )}
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn login-submit" type="submit" disabled={working}>
          {working ? 'Please wait…' : isRegistering ? 'Create profile' : 'Log in'}
        </button>
        <p className="login-switch">
          <button className="link" type="button" onClick={switchMode}>
            {isRegistering ? 'Already have an account? Log in' : 'New here? Create a profile'}
          </button>
        </p>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<main className="wrap"><p>Loading sign-in…</p></main>}><LoginForm /></Suspense>;
}
