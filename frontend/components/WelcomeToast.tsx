'use client';
import { useEffect } from 'react';
import { useAuth } from './Providers';

/**
 * Shown once right after a successful sign-in (the name comes from the account the backend verified).
 * It lives in memory only, so refreshing the page or opening another tab never repeats it.
 */
export default function WelcomeToast() {
  const { welcome, dismissWelcome } = useAuth();
  useEffect(() => {
    if (!welcome) return;
    const id = setTimeout(dismissWelcome, 6000);
    return () => clearTimeout(id);
  }, [welcome, dismissWelcome]);
  if (!welcome) return null;
  return (
    <div className="welcome-toast" role="status" aria-live="polite">
      <strong>Welcome, {welcome}!</strong>
      Welcome to Mylapore Restaurant.
      <button type="button" onClick={dismissWelcome} aria-label="Dismiss">&times;</button>
    </div>
  );
}
