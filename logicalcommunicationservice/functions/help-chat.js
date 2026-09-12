const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const crypto = require('crypto');

if (!getApps().length) initializeApp();
const db = getFirestore();

async function caller(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to E.R.A.S. first.');
  const account = await db.doc(`privateAccounts/${uid}`).get();
  const profileId = String(account.data()?.publicProfileId || '');
  if (!profileId) throw new HttpsError('failed-precondition', 'E.R.A.S. profile is not linked yet.');
  return { uid, profileId };
}
const clean = (value,max=4000) => String(value || '').trim().slice(0,max);

exports.erasHelpRequest = onCall(async request => {
  const actor = await caller(request);
  const message = clean(request.data?.message, 4000);
  if (message.length < 3) throw new HttpsError('invalid-argument', 'Help request is too short.');

  const ref = db.collection('helpRequests').doc();
  await ref.set({
    profileId: actor.profileId,
    uid: actor.uid,
    message,
    page: clean(request.data?.page, 300),
    title: clean(request.data?.title, 300),
    history: Array.isArray(request.data?.history)
      ? request.data.history.slice(-6).map(row => ({
          role: row?.role === 'assistant' ? 'assistant' : 'user',
          content: clean(row?.content, 1500)
        }))
      : [],
    status: 'open',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return { ok: true, requestId: ref.id };
});

exports.erasHelpChat = onCall(
  { secrets: ['OPENAI_API_KEY'], timeoutSeconds: 60, memory: '256MiB' },
  async request => {
    const actor = await caller(request);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new HttpsError('failed-precondition', 'OPENAI_API_KEY is not configured on the Firebase function.');

    const incoming = Array.isArray(request.data?.messages) ? request.data.messages.slice(-10) : [];
    const messages = incoming.map(row => ({
      role: row?.role === 'assistant' ? 'assistant' : 'user',
      content: clean(row?.content, 2500)
    })).filter(row => row.content);

    if (!messages.length) throw new HttpsError('invalid-argument', 'A help question is required.');

    const page = clean(request.data?.page, 300);
    const title = clean(request.data?.title, 300);
    const safetyIdentifier = crypto.createHash('sha256').update(actor.uid).digest('hex').slice(0,64);

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        reasoning: { effort: 'low' },
        max_output_tokens: 900,
        safety_identifier: safetyIdentifier,
        instructions:
          'You are the embedded E.R.A.S. Help assistant. Help users operate Project E.R.A.S., LCS, the browser game, creator tools, accounts, installation, and general UI. Be concise and practical. Do not claim to have performed actions you did not perform. If the request needs a human/admin decision, say so and suggest using Send Request.',
        input: [
          { role: 'developer', content: `Current E.R.A.S. page: ${page || '/'}; page title: ${title || 'unknown'}.` },
          ...messages
        ]
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('OpenAI E.R.A.S. Help', response.status, payload?.error?.message || payload);
      throw new HttpsError('internal', 'The AI help service could not complete the request.');
    }

    const reply =
      clean(payload.output_text, 12000) ||
      clean((payload.output || []).flatMap(item => item?.content || [])
        .filter(part => part?.type === 'output_text')
        .map(part => part?.text || '')
        .join('\n'), 12000);

    if (!reply) throw new HttpsError('internal', 'The AI help service returned an empty response.');
    return { ok: true, reply, model: payload.model || 'gpt-5.6-luna' };
  }
);
