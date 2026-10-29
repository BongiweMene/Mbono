import mongoose from 'mongoose';
import { db } from '@/lib/db';
import { Notification } from '@/lib/models';
import { me, log, json, deny } from '@/lib/auth';

export async function GET() {
  await db();
  const user = await me();
  if (!user) return deny();
  return json(await Notification.find({ user: user._id }).sort('-createdAt').limit(50));
}

export async function PATCH(req) {
  await db();
  const user = await me();
  if (!user) return deny();

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Your notification update could not be read. Please try again.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || typeof body.id !== 'string' || !mongoose.isValidObjectId(body.id) || typeof body.read !== 'boolean') {
    return json({ error: 'Choose a valid notification and read status.' }, 400);
  }
  const notification = await Notification.findOneAndUpdate(
    { _id: body.id, user: user._id },
    { read: body.read },
    { new: true },
  );
  if (!notification) return json({ error: 'That notification could not be found.' }, 404);
  await log(user.email, `notification ${notification._id} marked ${body.read ? 'read' : 'unread'}`);
  return json(notification);
}
