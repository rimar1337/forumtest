import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/providers/OAuthProvider';
interface AuthButtonProps {
  compact?: boolean;
}

export default function Login({ compact = false }: AuthButtonProps) {
  // 1. Get state and functions from the new OAuth context
  const { status, startLogin, logout } = useAuth();
  
  // State for the handle input and the dropdown visibility
  const [handle, setHandle] = useState('');
  const [showLoginForm, setShowLoginForm] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // This logic for closing the dropdown on outside click is still useful
    function handleClickOutside(event: MouseEvent) {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        setShowLoginForm(false);
      }
    }
    if (showLoginForm) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLoginForm]);

  // Handle the form submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) {
      alert('Please enter your handle (e.g., name.example.com)');
      return;
    }
    // This will redirect the user, so no need to manage loading states here
    await startLogin(handle);
  };

  // Render loading state if the provider is initializing
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center p-6 text-gray-500 dark:text-gray-400">
        Loading...
      </div>
    );
  }

  // If logged in, show a logout button
  if (status === 'signedIn') {
    const buttonClass = compact
      ? "text-sm bg-gray-600 hover:bg-gray-700 text-white rounded px-3 py-1 font-medium transition-colors"
      : "bg-gray-600 hover:bg-gray-700 text-white rounded px-6 py-2 font-semibold text-base transition-colors";

    const loggedInContent = (
      <button onClick={logout} className={buttonClass}>
        Log out
      </button>
    );

    if (compact) {
        return loggedInContent;
    }

    return (
        <div className="p-6 bg-gray-100 dark:bg-gray-900 rounded-xl shadow border border-gray-200 dark:border-gray-800 mt-6 mx-4">
            <div className="flex flex-col items-center justify-center text-center">
                <p className="text-lg font-semibold mb-6 text-gray-800 dark:text-gray-100">You are logged in!</p>
                {loggedInContent}
            </div>
        </div>
    );
  }

  // If logged out, show a login button/form
  const loginButtonClass = compact
    ? "text-sm bg-gray-600 hover:bg-gray-700 text-white rounded px-3 py-1 font-medium transition-colors"
    : "bg-gray-600 hover:bg-gray-700 text-white rounded px-6 py-2 font-semibold text-base transition-colors mt-2";
  
  const loginForm = (
    <form onSubmit={handleLogin} className={`flex flex-col gap-${compact ? '3' : '4'}`}>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Login with your AT Protocol (Bluesky) handle
        </p>
        <input
            type="text"
            placeholder="name.example.com"
            value={handle}
            onChange={e => setHandle(e.target.value)}
            className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="webauthn" // Hint for password managers
        />
        <button type="submit" className={loginButtonClass}>
            Sign In
        </button>
    </form>
  );

  if (compact) {
    return (
      <div className="relative" ref={formRef}>
        <button
          onClick={() => setShowLoginForm(!showLoginForm)}
          className={loginButtonClass}
        >
          Log in
        </button>
        {showLoginForm && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50">
            {loginForm}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900 rounded-xl shadow border border-gray-200 dark:border-gray-800 mt-6 mx-4">
        {loginForm}
    </div>
  );
}