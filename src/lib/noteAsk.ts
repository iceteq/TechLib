import { getSupabase, isCloudConfigured } from './supabaseClient';

export type GenerateAskAnswerInput = {
  question: string;
  typeName: string;
};

/**
 * Call the note-ask edge function.
 * Server enforces library admin; body may only include question + typeName.
 */
export async function generateAskAnswer(
  input: GenerateAskAnswerInput,
): Promise<string> {
  if (!isCloudConfigured()) {
    throw new Error('AI asks require cloud login.');
  }
  const question = input.question.trim();
  const typeName = input.typeName.trim();
  if (!question) throw new Error('Enter a question first.');
  if (!typeName) throw new Error('Set a type on the note first.');

  const { data, error } = await getSupabase().functions.invoke('note-ask', {
    body: { question, typeName },
  });

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const serverError =
    payload && typeof payload.error === 'string' ? payload.error : null;

  if (error) {
    throw new Error(serverError || error.message || 'Failed to generate answer.');
  }

  const answer =
    payload && typeof payload.answer === 'string' ? payload.answer.trim() : '';

  if (!answer) {
    throw new Error(serverError || 'Empty answer from AI.');
  }

  return answer;
}
