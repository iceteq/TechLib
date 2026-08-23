import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, isCloudConfigured } from '../../lib/supabaseClient';
import styles from './AuthGate.module.css';

interface AuthGateProps {
  children: (session: Session | null) => React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const cloud = isCloudConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!cloud);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signupHint, setSignupHint] = useState(false);

  useEffect(() => {
    if (!cloud) return;

    const supabase = getSupabase();
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => sub.subscription.unsubscribe();
  }, [cloud]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!cloud) return;
    setBusy(true);
    setError(null);
    setSignupHint(false);
    const supabase = getSupabase();
    try {
      if (mode === 'signin') {
        const { error: signError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signError) throw signError;
      } else {
        const { data, error: signError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signError) throw signError;
        if (!data.session) {
          setSignupHint(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className={styles.screen}>
        <p className={styles.muted}>Loading…</p>
      </div>
    );
  }

  if (cloud && !session) {
    return (
      <div className={styles.screen}>
        <form className={styles.card} onSubmit={(e) => void submit(e)}>
          <h1 className={styles.title}>TechLib</h1>
          <p className={styles.muted}>
            Sign in to sync notes between your phone and PC.
          </p>
          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className={styles.field}>
            <span>Password</span>
            <input
              type="password"
              autoComplete={
                mode === 'signin' ? 'current-password' : 'new-password'
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          {signupHint && (
            <p className={styles.muted}>
              Check your email to confirm the account, then sign in. (You can
              disable email confirmation in Supabase Auth settings for solo
              use.)
            </p>
          )}
          <button type="submit" className={styles.primary} disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </button>
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
              setError(null);
              setSignupHint(false);
            }}
          >
            {mode === 'signin'
              ? 'Need an account? Sign up once'
              : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    );
  }

  return <>{children(session)}</>;
}

export async function signOutCloud(): Promise<void> {
  if (!isCloudConfigured()) return;
  await getSupabase().auth.signOut();
}
