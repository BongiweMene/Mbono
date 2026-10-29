import { db } from '@/lib/db';
import { me, log, json, deny } from '@/lib/auth';

const rowFields = {
  employmentHistory: {
    company: 120,
    jobTitle: 120,
    startDate: 10,
    endDate: 10,
    description: 2000,
  },
  educationHistory: { institution: 160, qualification: 160, year: 4 },
  certifications: { name: 160, issuer: 160, year: 4 },
  references: { name: 120, company: 120, phone: 40, email: 254 },
};

function isValidDate(value) {
  return !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));
}

function normalizeRows(value, key) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30) return null;

  const fields = rowFields[key];
  const rows = [];
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const normalized = {};
    for (const [field, maxLength] of Object.entries(fields)) {
      if (row[field] !== undefined && typeof row[field] !== 'string') return null;
      const fieldValue = (row[field] || '').trim();
      if (fieldValue.length > maxLength) return null;
      normalized[field] = fieldValue;
    }

    if (Object.values(normalized).some(Boolean)) {
      if (key === 'employmentHistory' && (!normalized.company || !normalized.jobTitle || !normalized.startDate)) return null;
      if (key === 'educationHistory' && (!normalized.institution || !normalized.qualification)) return null;
      if (key === 'certifications' && !normalized.name) return null;
      if (key === 'references' && (!normalized.name || !normalized.phone || !normalized.email)) return null;
      if (key === 'employmentHistory' && (!isValidDate(normalized.startDate) || !isValidDate(normalized.endDate))) return null;
      if (['educationHistory', 'certifications'].includes(key) && normalized.year && !/^\d{4}$/.test(normalized.year)) return null;
      if (key === 'references' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) return null;
      rows.push(normalized);
    }
  }
  return rows;
}

function profileFor(user) {
  return {
    _id: user._id,
    email: user.email,
    name: user.name || '',
    phone: user.phone || '',
    address: user.address || '',
    idPassportNumber: user.idPassportNumber || '',
    employmentHistory: user.employmentHistory || [],
    educationHistory: user.educationHistory || [],
    certifications: user.certifications || [],
    references: user.references || [],
    skills: user.skills || [],
    languages: user.languages || [],
    cvName: user.cvName || '',
  };
}

export async function GET() {
  await db();
  const user = await me();
  if (!user) return deny();
  return json({ profile: profileFor(user) });
}

export async function PUT(req) {
  await db();
  const user = await me();
  if (!user) return deny();

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Your profile could not be read. Please submit the form again.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'Your profile data is invalid. Please check the form and try again.' }, 400);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) {
    return json({ error: 'Enter your full name using no more than 120 characters.' }, 400);
  }

  const updates = { name };
  for (const key of ['phone', 'address', 'idPassportNumber']) {
    if (body[key] !== undefined && typeof body[key] !== 'string') {
      return json({ error: 'Check your contact and identification details, then try again.' }, 400);
    }
    const value = (body[key] || '').trim();
    const limit = key === 'address' ? 300 : key === 'idPassportNumber' ? 80 : 40;
    if (value.length > limit) {
      return json({ error: `${key === 'idPassportNumber' ? 'ID/passport number' : key} must be ${limit} characters or fewer.` }, 400);
    }
    updates[key] = value;
  }

  for (const key of Object.keys(rowFields)) {
    const rows = normalizeRows(body[key], key);
    if (!rows) {
      return json({ error: `Check the ${key.replace(/([A-Z])/g, ' $1').toLowerCase()} entries. Complete required fields and use valid dates, years, and email addresses.` }, 400);
    }
    updates[key] = rows;
  }

  for (const key of ['skills', 'languages']) {
    if (body[key] !== undefined && !Array.isArray(body[key])) {
      return json({ error: `Enter ${key} as a list of words separated by commas.` }, 400);
    }
    if ((body[key] || []).length > 50 || (body[key] || []).some((value) => typeof value !== 'string' || value.length > 80)) {
      return json({ error: `Add no more than 50 ${key}, with each item under 80 characters.` }, 400);
    }
    updates[key] = [...new Set((body[key] || []).map((value) => value.trim()).filter(Boolean).map((value) => key === 'skills' ? value.toLowerCase() : value))];
  }

  await user.updateOne({ $set: updates });
  await log(user.email, 'profile updated');
  const savedUser = await me();
  return json({ profile: profileFor(savedUser), message: 'Your profile has been saved.' });
}
