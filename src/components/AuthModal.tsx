"use client";
import { useState } from "react";
import { useAuth } from "./AuthProvider";

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const err = mode === "signin"
      ? await signIn(email, password)
      : await signUp(email, password);

    setLoading(false);

    if (err) {
      setError(err);
    } else {
      // Both signin and signup auto-authenticate — close modal
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="bg-neutral-950 border border-neutral-800 sm:rounded-lg rounded-t-xl w-full sm:max-w-sm shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex border-b border-neutral-800">
          <button
            onClick={() => { setMode("signin"); setError(null); setSuccess(false); }}
            className={`flex-1 py-2.5 text-sm font-medium transition border-b-2 ${
              mode === "signin" ? "border-purple-500 text-gray-100" : "border-transparent text-neutral-500"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode("signup"); setError(null); setSuccess(false); }}
            className={`flex-1 py-2.5 text-sm font-medium transition border-b-2 ${
              mode === "signup" ? "border-purple-500 text-gray-100" : "border-transparent text-neutral-500"
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {success ? (
            <div className="text-center py-4">
              <p className="text-green-400 font-medium text-sm mb-1">Account created!</p>
              <p className="text-neutral-400 text-xs">Check your email to confirm, then sign in.</p>
              <button
                type="button"
                onClick={() => { setMode("signin"); setSuccess(false); }}
                className="mt-3 text-purple-400 hover:text-purple-300 text-sm font-medium"
              >
                Go to Sign In
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-neutral-300 text-xs font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                  placeholder="you@email.com"
                />
              </div>
              <div>
                <label className="block text-neutral-300 text-xs font-semibold mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                  placeholder="Min 6 characters"
                />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-2 rounded text-sm transition"
              >
                {loading ? "..." : mode === "signin" ? "Sign In" : "Create Account"}
              </button>
            </>
          )}
        </form>

        <div className="px-5 pb-4">
          <p className="text-neutral-500 text-[10px] text-center">
            {mode === "signin"
              ? "Sign in to sync your saves across devices."
              : "Create an account to save your progress permanently."}
          </p>
        </div>
      </div>
    </div>
  );
}
