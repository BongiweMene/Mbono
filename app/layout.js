import './globals.css';
import Chatbot from '@/components/Chatbot';
import Footer from '@/components/Footer';
export const metadata = { title: 'Mbono Career Goal', description: 'Building skills, unlocking opportunity.', icons: { icon: '/mbono-career-goals.png' } };
export default function L({ children }) {
  return (<html lang="en"><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" /></head><body>{children}<Footer /><Chatbot /></body></html>);
}