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
    } else if (mode === "signup") {
      setSuccess(true);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="bg-white border border-gray-200 sm:rounded-lg rounded-t-xl w-full sm:max-w-sm shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setMode("signin"); setError(null); setSuccess(false); }}
            className={`flex-1 py-2.5 text-sm font-medium transition border-b-2 ${
              mode === "signin" ? "border-blue-600 text-gray-900" : "border-transparent text-gray-400"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode("signup"); setError(null); setSuccess(false); }}
            className={`flex-1 py-2.5 text-sm font-medium transition border-b-2 ${
              mode === "signup" ? "border-blue-600 text-gray-900" : "border-transparent text-gray-400"
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {success ? (
            <div className="text-center py-4">
              <p className="text-green-600 font-medium text-sm mb-1">Account created!</p>
              <p className="text-gray-500 text-xs">Check your email to confirm, then sign in.</p>
              <button
                type="button"
                onClick={() => { setMode("signin"); setSuccess(false); }}
                className="mt-3 text-blue-600 hover:text-blue-500 text-sm font-medium"
              >
                Go to Sign In
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-gray-700 text-xs font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  placeholder="you@email.com"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-xs font-semibold mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  placeholder="Min 6 characters"
                />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded text-sm transition"
              >
                {loading ? "..." : mode === "signin" ? "Sign In" : "Create Account"}
              </button>
            </>
          )}
        </form>

        <div className="px-5 pb-4">
          <p className="text-gray-400 text-[10px] text-center">
            {mode === "signin"
              ? "Sign in to sync your saves across devices."
              : "Create an account to save your progress permanently."}
          </p>
        </div>
      </div>
    </div>
  );
}
