import SiteHeader from '@/components/SiteHeader';
const P = {
  privacy: ['Privacy Policy', ['We collect the details you give us: your name, contact details, profile, skills, application answers, any CV, and messages you send to our support chat.', 'We use them only to run recruitment and to support you. Mbono recruiters, hiring managers, interviewers and platform administrators can see your application for the vacancy you applied to. Support staff see your chat and ticket details.', 'Under POPIA you may ask to see, correct or delete your information. Contact info@mbono.co.za.', 'DRAFT: Mbono must confirm the retention period, any other recipients and the information officer details before launch.']],
  terms: ['Terms and Conditions', ['By using this platform you confirm that the information you submit is true and your own.', 'Submitting an application does not guarantee an interview or employment.', 'DRAFT: Mbono must have these terms reviewed by a legal adviser before launch.']],
  cookies: ['Cookie Policy', ['This platform uses one essential cookie to keep you signed in. We do not currently use advertising or tracking cookies.', 'If this changes, we will update this page and ask for your consent first.']],
};
export default function Legal({ params }) {
  const p = P[params.slug]; if (!p) return <p className="wrap">Page not found.</p>;
  return (<><SiteHeader /><main className="wrap sec"><h1>{p[0]}</h1>{p[1].map((t, i) => <p key={i}>{t}</p>)}</main></>);
}
