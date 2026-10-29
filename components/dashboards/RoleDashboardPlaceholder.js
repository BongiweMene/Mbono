'use client';

import { useRouter } from 'next/navigation';

export default function RoleDashboardPlaceholder({ user, roleName }) {
  const router = useRouter();

  async function logout() {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'logout' }),
    });
    if (!response.ok) {
      window.alert('Unable to log out. Please try again.');
      return;
    }
    router.push('/');
  }

  return (
    <main className="wrap">
      <nav>
        <img className="mbono-placeholder-logo" src="/mbono-career-goals.png" alt="Mbono Career Goals — Building skills, unlocking opportunity" />
        <span>{user.name} · <span className="tag">{user.role}</span> <button className="btn sm ghost" onClick={logout}>Log out</button></span>
      </nav>
      <section className="card role-placeholder">
        <h1>{roleName} dashboard</h1>
        <p>Your role-specific dashboard is planned as the next step. This view does not show candidate or other staff data.</p>
      </section>
    </main>
  );
}
