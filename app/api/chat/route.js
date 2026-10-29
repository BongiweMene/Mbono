import { db } from '@/lib/db';
import { User } from '@/lib/models';
import { ChatSession, Ticket, Counter } from '@/lib/extra';
import { json } from '@/lib/auth';
const TOPICS = {
  status: [/status|progress|outcome/, 'Open your dashboard and look at your applications. Statuses are Received, Under Review, Shortlisted, Interview, Offer Made, Hired or Rejected.', 'Recruiters update the status as they review. If it has not changed for a while, your application is usually still being reviewed.'],
  apply: [/apply|application|submit/, 'Open a vacancy and press Apply Now. You will review your profile and answers before you submit. You may not be able to edit after submitting.', 'If something is wrong, use Go back or Edit profile first. After submitting you get a reference number and can track progress on your dashboard.'],
  jobs: [/job|vacanc|search|role|position/, 'Search open roles on your dashboard, then open a vacancy to read the responsibilities, requirements, skills and working hours.', 'Each vacancy page shows location, work mode, salary and closing date. You can also subscribe to job alerts there.'],
  cv: [/cv|resume|résumé|upload|profile/, 'Your profile holds your details and skills. CV upload is being rolled out, and until then your profile is shared with applications.', 'Keep your skills up to date, because they are used to calculate your match score.'],
  account: [/password|login|log in|sign|account|register/, 'Use Log in at the top of any page. New here? Choose Create profile and accept the privacy notice.', 'Online password reset is not available yet. If you are locked out I can pass this to our support team.'],
  employer: [/employer|talent|partner|hire/, 'Employers can request talent through the Request Talent page on mbono.co.za.', 'Our team will reply about your hiring needs. I can also pass a message to support.'],
  data: [/data|popia|privacy|delete|consent/, 'We use your information only for recruitment and support, under POPIA. The Privacy Policy is linked in the footer.', 'To correct or delete your information, email info@mbono.co.za or ask for a person.'],
};
const MENU = [['Find a job', 'job search'], ['Apply for a job', 'how to apply'], ['Application status', 'application status'], ['CV and profile', 'cv profile'], ['Account help', 'account login'], ['Employers', 'employer talent'], ['My data', 'data privacy']].map(([l, t]) => ({ l, t }));
const AFTER = [{ l: 'Yes, thanks', a: 'yes' }, { l: 'Tell me more', t: 'tell me more' }, { l: 'No, I need a person', a: 'no' }];
const inHours = () => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Johannesburg', weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
  const d = p.find((x) => x.type === 'weekday').value, h = +p.find((x) => x.type === 'hour').value;
  return !['Sat', 'Sun'].includes(d) && h >= 8 && h < 17;
};
const st = (s) => ({ messages: s.messages, quick: s.quick, collect: s.step === 'collect', ticket: s.ticket });
export async function GET(req) {
  await db(); const s = await ChatSession.findOne({ sid: new URL(req.url).searchParams.get('sid') });
  return json(s ? st(s) : { messages: [] });
}
export async function POST(req) {
  await db(); const { sid, text, action, contact } = await req.json();
  if (!sid) return json({ error: 'Missing session' }, 400);
  const s = (await ChatSession.findOne({ sid })) || new ChatSession({ sid });
  const out = [], say = (from, t) => { s.messages.push({ from, text: t }); out.push({ from, text: t }); };
  if (text) s.messages.push({ from: 'user', text: String(text).slice(0, 500) });
  const human = () => { say('bot', 'Sorry I could not fully help. I can connect you with our support team. I only need your name, phone number, email and a short description.'); s.step = 'collect'; s.quick = []; };
  if (action === 'escalate') {
    const c = contact || {};
    if (!c.name || !c.phone || !/^\S+@\S+\.\S+$/.test(c.email || '') || !c.issue) return json({ error: 'Please fill in your name, phone, a valid email and a short description.' }, 400);
    say('system', 'Transferring your request to the support team…');
    const n = await Counter.findOneAndUpdate({ _id: 'ticket' }, { $inc: { n: 1 } }, { upsert: true, new: true });
    const number = 'MB-' + String(n.n).padStart(5, '0');
    const agents = await User.countDocuments({ role: 'support' }), live = agents > 0 && inHours();
    await Ticket.create({ number, name: String(c.name).slice(0, 100), phone: String(c.phone).slice(0, 30), email: String(c.email).slice(0, 120), issue: String(c.issue).slice(0, 1500), transcript: s.messages.map((m) => ({ from: m.from, text: m.text })), queued: !live });
    s.ticket = number; s.step = 'done'; s.quick = [];
    say('system', live ? 'A support representative will review this chat and contact you.' : 'No agent is available right now (support hours are Monday to Friday, 08:00 to 17:00). Your message is in the queue and we will follow up.');
    say('bot', `Your ticket number is ${number}. Keep it for reference. Everything you told me, including this chat, is visible to the support team.`);
  } else if (action === 'no' || (text && /human|agent|person|someone|speak to|call me/i.test(text))) human();
  else if (action === 'yes') { say('bot', 'Great, glad that helped. Anything else?'); s.quick = MENU; }
  else if (text) {
    const hit = Object.entries(TOPICS).find(([, t]) => t[0].test(text.toLowerCase()));
    if (hit) { s.topic = hit[0]; s.unknown = 0; say('bot', hit[1][1]); say('bot', 'Did that answer your question?'); s.quick = AFTER; }
    else if (s.topic && /more|detail|explain|why|how long|then|what next|that|it\b/i.test(text)) { say('bot', TOPICS[s.topic][2]); say('bot', 'Has that solved it?'); s.quick = AFTER.filter((q) => q.t !== 'tell me more'); }
    else if (++s.unknown === 1) { say('bot', 'I am not sure I understood. Which of these is closest to what you need?'); s.quick = MENU; }
    else { say('bot', 'I cannot resolve this one. Would you like to speak to a person?'); s.quick = [{ l: 'Connect me to support', a: 'no' }, ...MENU.slice(0, 3)]; }
  } else if (!s.messages.length) { say('bot', "Hi, I'm Mbo, the automated assistant for Mbono Career Goals. How can I help you today?"); s.quick = MENU; }
  await s.save(); return json({ ...st(s), messages: out });
}
