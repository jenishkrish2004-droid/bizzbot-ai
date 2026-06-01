import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { Bot, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "../components/ui/button";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { useAuth } from "../contexts/AuthContext";

export function Signup() {
  const { isAuthenticated, signup } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signup({ fullName, email, password });
      navigate("/", { replace: true });
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message ?? "Could not create account"
          : "Could not create account";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-surface flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
        className="glass-panel-strong w-full max-w-md rounded-lg p-6"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow">
            <Bot size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">BizzBot AI</p>
            <p className="text-xs text-muted-foreground">RAG Lead Platform</p>
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-normal">Create workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">Start with a secure account for document intelligence.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium">
            Full name
            <input
              className="field-control mt-2"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Email
            <input
              className="field-control mt-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              className="field-control mt-2"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {error ? <p className="error-alert rounded-md px-3 py-2 text-sm">{error}</p> : null}

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 animate-spin" size={18} aria-hidden="true" /> : null}
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="font-medium text-primary hover:underline" to="/login">
            Sign in
          </Link>
        </p>
      </motion.section>
    </main>
  );
}
