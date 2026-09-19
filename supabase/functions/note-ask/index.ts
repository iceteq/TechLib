// Supabase Edge Function: note-ask
// Deploy: supabase functions deploy note-ask
// Secret: supabase secrets set OPENAI_API_KEY=sk-...
//
// Body (only): { question: string, typeName: string }
// Auth: Bearer JWT; requires is_library_admin().

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const MAX_QUESTION_LEN = 200;
const MAX_TYPE_LEN = 80;
const MAX_ANSWER_TOKENS = 100;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ error: 'Server misconfigured' }, 500);
    }
    if (!openaiKey) {
      return json({ error: 'OPENAI_API_KEY is not set' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return json({ error: 'Not signed in' }, 401);
    }

    const { data: isAdmin, error: adminError } = await supabase.rpc(
      'is_library_admin',
    );
    if (adminError) {
      return json({ error: adminError.message }, 500);
    }
    if (!isAdmin) {
      return json({ error: 'Only admins can generate AI answers' }, 403);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'Invalid body' }, 400);
    }

    const allowed = new Set(['question', 'typeName']);
    for (const key of Object.keys(body as Record<string, unknown>)) {
      if (!allowed.has(key)) {
        return json({ error: `Unexpected field: ${key}` }, 400);
      }
    }

    const questionRaw = (body as { question?: unknown }).question;
    const typeRaw = (body as { typeName?: unknown }).typeName;
    if (typeof questionRaw !== 'string' || typeof typeRaw !== 'string') {
      return json({ error: 'question and typeName are required strings' }, 400);
    }

    const question = questionRaw.trim().slice(0, MAX_QUESTION_LEN);
    const typeName = typeRaw.trim().slice(0, MAX_TYPE_LEN);
    if (!question) return json({ error: 'Question is empty' }, 400);
    if (!typeName) return json({ error: 'Type is required' }, 400);

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: MAX_ANSWER_TOKENS,
        messages: [
          {
            role: 'system',
            content:
              'You help warehouse staff identify and understand products. Answer in 1–3 short sentences. Be practical: meaning and how to recognize it. No markdown, no bullet lists, no fluff. Use the product type only to disambiguate the term in the question. If the question is too vague, say what detail is missing.',
          },
          {
            role: 'user',
            content: `Type: ${typeName}\nQuestion: ${question}`,
          },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const detail = await openaiRes.text();
      console.error('OpenAI error', openaiRes.status, detail);
      return json({ error: 'OpenAI request failed' }, 502);
    }

    const completion = await openaiRes.json();
    const answer = String(
      completion?.choices?.[0]?.message?.content ?? '',
    ).trim();
    if (!answer) {
      return json({ error: 'Empty answer from model' }, 502);
    }

    return json({ answer });
  } catch (err) {
    console.error(err);
    return json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      500,
    );
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
