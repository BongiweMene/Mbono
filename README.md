# Mbono Career Goal
Next.js 14 + MongoDB (Mongoose) for Vercel.
1. `npm install`  2. copy `.env.example` to `.env.local` and fill it in  3. `npm run dev`
Deploy: push to GitHub, import in Vercel, add the three env vars (MongoDB Atlas must allow Vercel IPs: 0.0.0.0/0).
The user whose email equals ADMIN_EMAIL becomes admin on sign-up; admins then promote other users on the Users tab.
The Mbono Career Goals logo is stored at `public/mbono-career-goals.png`. Tune colours in `app/globals.css` (:root variables).
