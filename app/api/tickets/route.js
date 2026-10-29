import { db } from '@/lib/db';
import { User } from '@/lib/models';
import { Ticket } from '@/lib/extra';
import { me, log, json, deny } from '@/lib/auth';
const STATUSES = ['Open', 'Assigned', 'In Progress', 'Awaiting User Response', 'Resolved'];
export async function GET() {
  await db(); const u = await me(); if (!u || !['admin', 'support'].includes(u.role)) return deny();
  const q = u.role === 'admin' ? {} : { $or: [{ assignee: u._id }, { assignee: null }] };
  const tickets = await Ticket.find(q).populate('assignee', 'name').sort('-createdAt').limit(300).lean();
  const base = { tickets, role: u.role, me: String(u._id) };
  if (u.role !== 'admin') return json(base);
  const open = tickets.filter((t) => t.status !== 'Resolved'), resp = tickets.filter((t) => t.firstResponseAt);
  const work = {}; open.forEach((t) => { const n = t.assignee?.name || 'Unassigned'; work[n] = (work[n] || 0) + 1; });
  const avg = resp.length ? resp.reduce((a, t) => a + (new Date(t.firstResponseAt) - new Date(t.createdAt)), 0) / resp.length / 3600000 : null;
  const oldest = open.length ? Math.max(...open.map((t) => Date.now() - new Date(t.createdAt))) / 86400000 : 0;
  const week = Date.now() - 7 * 864e5;
  return json({ ...base, agents: await User.find({ role: 'support' }).select('name'), stats: { unresolved: open.length, unassigned: open.filter((t) => !t.assignee).length, resolvedThisWeek: tickets.filter((t) => t.resolvedAt && new Date(t.resolvedAt) > week).length, avgFirstResponseHours: avg && +avg.toFixed(1), oldestDays: +oldest.toFixed(1), workload: work } });
}
export async function PATCH(req) {
  await db(); const u = await me(); if (!u || !['admin', 'support'].includes(u.role)) return deny();
  const { id, assignee, status, note, claim } = await req.json(); const t = await Ticket.findById(id); if (!t) return json({ error: 'Ticket not found.' }, 404);
  if (claim) {
    if (t.assignee) return json({ error: 'This ticket is already assigned.' }, 400);
    t.assignee = u._id; if (t.status === 'Open') t.status = 'Assigned';
  } else if (u.role === 'support' && String(t.assignee) !== String(u._id)) return deny();
  if (assignee !== undefined) { if (u.role !== 'admin') return deny(); t.assignee = assignee || null; if (assignee && t.status === 'Open') t.status = 'Assigned'; }
  if (status && STATUSES.includes(status)) {
    if (status === 'Resolved' && !note && !t.notes.length) return json({ error: 'Add a short resolution note before resolving.' }, 400);
    t.status = status; if (status === 'Resolved') t.resolvedAt = new Date();
  }
  if (note) t.notes.push({ by: u.name, text: String(note).slice(0, 1000), at: new Date() });
  if (!t.firstResponseAt && (note || ['In Progress', 'Awaiting User Response', 'Resolved'].includes(t.status))) t.firstResponseAt = new Date();
  await t.save(); await log(u.email, `ticket ${t.number} updated (${t.status})`); return json(t);
}
