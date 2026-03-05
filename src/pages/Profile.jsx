import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { fetchMyProfile, updateMyProfile } from "../services/profileService";
import "../styles/Profile.css";

export default function Profile({ authUser, onAuthChange }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!authUser?.id) return;

      setLoading(true);
      setError("");
      setMessage("");

      try {
        const profile = await fetchMyProfile(authUser);
        if (!cancelled) {
          setForm({
            firstName: profile.firstName || "",
            lastName: profile.lastName || "",
            phone: profile.phone || "",
            email: profile.email || authUser.email || "",
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Неуспешно зареждане на профила.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  if (!authUser) {
    return <Navigate to="/auth" replace />;
  }

  const handleChange = (field) => (event) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const result = await updateMyProfile(authUser, {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
      });

      const updatedUser = result?.user || authUser;
      onAuthChange?.(updatedUser);

      setForm((prev) => ({
        ...prev,
        firstName: result.profile.firstName,
        lastName: result.profile.lastName,
        phone: result.profile.phone,
      }));
      setMessage("Профилът е обновен успешно.");
    } catch (err) {
      setError(err?.message || "Неуспешно обновяване на профила.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="profile-page">
      <div className="container">
        <div className="profile-card">
          <h1>Моят профил</h1>
          <p className="profile-subtitle">
            Редактирай личните си данни. Промените се запазват в Supabase.
          </p>

          {loading ? (
            <p>Зареждане на профила...</p>
          ) : (
            <form className="profile-form" onSubmit={handleSubmit}>
              <label>
                Име
                <input
                  type="text"
                  value={form.firstName}
                  onChange={handleChange("firstName")}
                  autoComplete="given-name"
                  required
                />
              </label>

              <label>
                Фамилия
                <input
                  type="text"
                  value={form.lastName}
                  onChange={handleChange("lastName")}
                  autoComplete="family-name"
                  required
                />
              </label>

              <label>
                Телефон
                <input
                  type="tel"
                  value={form.phone}
                  onChange={handleChange("phone")}
                  autoComplete="tel"
                  placeholder="+359..."
                />
              </label>

              <label>
                Имейл
                <input type="email" value={form.email} readOnly disabled />
              </label>

              <button type="submit" disabled={saving}>
                {saving ? "Запазване..." : "Запази промените"}
              </button>
            </form>
          )}

          {error && <p className="profile-error">{error}</p>}
          {message && <p className="profile-success">{message}</p>}
        </div>
      </div>
    </section>
  );
}
