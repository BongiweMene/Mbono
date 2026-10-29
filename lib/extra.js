import mongoose from 'mongoose';
const R = mongoose.Schema.Types.ObjectId;
const m = (n, s) => mongoose.models[n] || mongoose.model(n, new mongoose.Schema(s, { timestamps: true }));
export const Ticket = m('Ticket', { number: String, name: String, phone: String, email: String, issue: String, transcript: [{ from: String, text: String }], status: { type: String, default: 'Open' }, assignee: { type: R, ref: 'User' }, notes: [{ by: String, text: String, at: Date }], queued: Boolean, firstResponseAt: Date, resolvedAt: Date });
export const ChatSession = m('ChatSession', { sid: { type: String, index: true }, messages: [{ from: String, text: String }], quick: Array, topic: String, unknown: { type: Number, default: 0 }, step: { type: String, default: 'chat' }, ticket: String });
export const JobAlert = m('JobAlert', { email: String, keywords: String, location: String });
export const Counter = m('Counter', { _id: String, n: Number });
