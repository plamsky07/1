import { useState } from "react";
import { Navigate } from "react-router-dom";
import { signInWithEmail, signUpWithEmail } from "../services/authService";

export default function Auth({ authUser, onAuthChange }) {
  const [mode, setMode] = useState("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (authUser) {
    return <Navigate to="/" replace />;
  }

  const isRegister = mode === "register";

  const resetMessages = () => {
    setError("");
    setMessage("");
  };

  const validateEmail = (value) => /\S+@\S+\.\S+/.test(value);
  const validatePassword = (value) =>
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value);
  const validatePhone = (value) => !value || /^\+?[0-9\s-]{7,20}$/.test(value);

  const handleSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!email || !password) {
      setError("Попълни имейл и парола.");
      return;
    }

    if (!validateEmail(email)) {
      setError("Въведи валиден имейл.");
      return;
    }

    if (!validatePassword(password)) {
      setError("Паролата трябва да е минимум 8 символа и да съдържа малка, главна буква и цифра.");
      return;
    }

    if (isRegister) {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Попълни име и фамилия.");
        return;
      }

      if (!validatePhone(phone.trim())) {
        setError("Телефонният номер е невалиден.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Паролите не съвпадат.");
        return;
      }

      if (!acceptedTerms) {
        setError("Трябва да приемеш условията за ползване.");
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegister) {
        const data = await signUpWithEmail(email, password, {
          firstName,
          lastName,
          phone,
        });

        if (data?.user && !data?.access_token) {
          setMessage("Регистрацията е успешна. Провери имейла си за потвърждение.");
        } else {
          setMessage("Регистрацията е успешна.");
          onAuthChange?.(data?.user ?? null);
        }
      } else {
        const data = await signInWithEmail(email, password);
        onAuthChange?.(data?.user ?? null);
        setMessage("Успешен вход.");
      }
    } catch (err) {
      setError(err?.message || "Възникна грешка при автентикация.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: "24px 0" }}>
      <h1>{isRegister ? "Регистрация" : "Вход"}</h1>
      <p style={{ color: "#555" }}>
        {isRegister
          ? "Създай профил, за да записваш часове онлайн."
          : "Влез в профила си, за да управляваш записванията."}
      </p>

      <div style={{ maxWidth: 420, marginTop: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              resetMessages();
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: mode === "login" ? "#1d4ed8" : "white",
              color: mode === "login" ? "white" : "#111827",
              cursor: "pointer",
            }}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              resetMessages();
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: mode === "register" ? "#1d4ed8" : "white",
              color: mode === "register" ? "white" : "#111827",
              cursor: "pointer",
            }}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
          {isRegister && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Име"
                  autoComplete="given-name"
                  style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
                />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Фамилия"
                  autoComplete="family-name"
                  style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </div>

              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Телефон (по избор)"
                autoComplete="tel"
                style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </>
          )}

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Имейл"
            autoComplete="email"
            style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Парола"
            autoComplete={isRegister ? "new-password" : "current-password"}
            style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
          />

          {isRegister && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повтори паролата"
              autoComplete="new-password"
              style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
            />
          )}

          {isRegister && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#374151", fontSize: 14 }}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              Съгласен/а съм с условията за ползване и политиката за поверителност.
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "none",
              background: "#1d4ed8",
              color: "white",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Моля изчакай..." : isRegister ? "Създай профил" : "Влез"}
          </button>

          {error && <div style={{ color: "#b91c1c" }}>{error}</div>}
          {message && <div style={{ color: "#047857" }}>{message}</div>}
        </form>
      </div>
    </div>
  );
}
