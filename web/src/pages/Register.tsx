import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ access_token: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });
      localStorage.setItem("timetable_token", res.access_token);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 400, marginTop: "3rem" }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Create Account</h1>
        <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
          Sign up to start building your school timetable.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: "1rem", color: "#64748b" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#3b82f6" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
