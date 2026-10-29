import { redirect } from 'next/navigation';
import { me } from '@/lib/auth';
import CandidateDashboard from '@/components/dashboards/CandidateDashboard';
import RecruiterDashboard from '@/components/dashboards/RecruiterDashboard';
import InterviewerDashboard from '@/components/dashboards/InterviewerDashboard';
import HiringManagerDashboard from '@/components/dashboards/HiringManagerDashboard';
import AdminDashboard from '@/components/dashboards/AdminDashboard';

export default async function DashboardPage() {
  const user = await me();
  if (!user) redirect('/login');
  const dashboardUser = {
    id: String(user._id),
    name: user.name || '',
    role: user.role,
    ...(user.role === 'hiring_manager' ? { department: user.department || '' } : {}),
  };
  if (user.role === 'candidate') return <CandidateDashboard user={dashboardUser} />;
  if (user.role === 'recruiter') return <RecruiterDashboard user={dashboardUser} />;
  if (user.role === 'interviewer') return <InterviewerDashboard user={dashboardUser} />;
  if (user.role === 'hiring_manager') return <HiringManagerDashboard user={dashboardUser} />;
  if (user.role === 'admin') return <AdminDashboard user={dashboardUser} />;
  redirect('/login');
}
