import mongoose from 'mongoose';
const g = global._mongo || (global._mongo = {});
export async function db() { if (!g.p) g.p = mongoose.connect(process.env.MONGODB_URI); await g.p; }
