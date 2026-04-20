import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { fetchMyProfile, updateMyProfile } from "../services/profileService";
import {
  createBillingPortalSession,
  fetchMySubscription,
} from "../services/subscriptionsService";
import { useToast } from "../context/ToastState";
import { isAdminUser, isDoctorUser } from "../utils/userRole";
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
  const [subscription, setSubscription] = useState(null);
  const [subscriptionError, setSubscriptionError] = useState("");
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState(false);
  const [profileMeta, setProfileMeta] = useState(null);

  const canAccessAdmin = useMemo(() => isAdminUser(authUser), [authUser]);
  const isDoctor = useMemo(() => isDoctorUser(authUser), [authUser]);
  const { showError, showInfo, showSuccess } = useToast();

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!authUser?.id) return;

      setLoading(true);
      setSubscriptionLoading(true);
      setError("");
      setMessage("");
      setSubscriptionError("");

      try {
        const [profile, subscriptionResult] = await Promise.all([
          fetchMyProfile(authUser),
          fetchMySubscription().catch((err) => {
            if (!cancelled) {
              setSubscriptionError(
                err?.message || "Неуспешно зареждане на Stripe абонамента."
              );
            }
            return { subscription: null };
          }),
        ]);

        if (!cancelled) {
          setForm({
            firstName: profile.firstName || "",
            lastName: profile.lastName || "",
            phone: profile.phone || "",
            email: profile.email || authUser.email || "",
          });
          setProfileMeta(profile);
          setSubscription(subscriptionResult?.subscription || null);
        }
      } catch (err) {
        if (!cancelled) {
          const text = err?.message || "Неуспешно зареждане на профила.";
          setError(text);
          showError(text);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSubscriptionLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [authUser, showError]);

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
      setProfileMeta((prev) => ({
        ...(prev || {}),
        ...result.profile,
      }));
      const text = "Профилът е обновен успешно.";
      setMessage(text);
      showSuccess(text, { title: "Профил" });
    } catch (err) {
      const text = err?.message || "Неуспешно обновяване на профила.";
      setError(text);
      showError(text);
    } finally {
      setSaving(false);
    }
  };

  const handleBillingPortal = async () => {
    setBillingLoading(true);
    setSubscriptionError("");

    try {
      const data = await createBillingPortalSession();
      if (!data?.url) {
        throw new Error("Stripe не върна billing portal URL.");
      }

      showInfo("Отваряме Stripe Billing Portal в защитен режим.", {
        title: "Stripe Billing",
      });
      window.location.href = data.url;
    } catch (err) {
      const text = err?.message || "Неуспешно стартиране на Stripe portal.";
      setSubscriptionError(text);
      showError(text);
    } finally {
      setBillingLoading(false);
    }
  };

  return (
    <section className="profile-page">
      <div className="container">
        <div className="profile-layout">
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

            {profileMeta && (
              <div className="profile-subscription-box" style={{ marginTop: 18 }}>
                <div className="profile-subscription-row">
                  <span>Тип акаунт</span>
                  <strong>{profileMeta.accountType === "doctor" ? "Лекар" : "Пациент"}</strong>
                </div>
                <div className="profile-subscription-row">
                  <span>Статус</span>
                  <strong>{profileMeta.accountStatus || "active"}</strong>
                </div>
                <div className="profile-subscription-row">
                  <span>Верификация</span>
                  <strong>{profileMeta.verificationStatus || "active"}</strong>
                </div>
              </div>
            )}

            {isDoctor && profileMeta?.doctorProfile && (
              <div className="profile-subscription-box" style={{ marginTop: 18 }}>
                <div className="profile-subscription-row">
                  <span>Специалност</span>
                  <strong>{profileMeta.doctorProfile.specialty || "—"}</strong>
                </div>
                <div className="profile-subscription-row">
                  <span>Клиника</span>
                  <strong>{profileMeta.doctorProfile.clinicName || "—"}</strong>
                </div>
                <div className="profile-subscription-row">
                  <span>Лиценз</span>
                  <strong>{profileMeta.doctorProfile.licenseNumber || "—"}</strong>
                </div>
                <div className="profile-subscription-row">
                  <span>Публикуван профил</span>
                  <strong>{profileMeta.doctorProfile.isListed ? "Да" : "Не"}</strong>
                </div>
              </div>
            )}
          </div>

          <aside className="profile-side-card">
            <div className="profile-plan-badge">Stripe Billing</div>
            <h2>MedLink Plus</h2>
            <p className="profile-side-copy">
              Следи статуса на абонамента си и отвори Stripe portal за карти, планове и фактури.
            </p>

            {subscriptionLoading ? (
              <p className="profile-side-muted">Зареждане на абонамента...</p>
            ) : subscription ? (
              <div className="profile-subscription-box">
                <div className="profile-subscription-row">
                  <span>План</span>
                  <strong>{subscription.plan?.toUpperCase() || "PLUS"}</strong>
                </div>
                <div className="profile-subscription-row">
                  <span>Статус</span>
                  <strong>{subscription.status || "active"}</strong>
                </div>
                <div className="profile-subscription-row">
                  <span>Период до</span>
                  <strong>
                    {subscription.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString("bg-BG")
                      : "—"}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="profile-subscription-box profile-subscription-box--empty">
                <strong>Все още нямаш активен Plus план.</strong>
                <span>Можеш да стартираш плащане през Stripe Checkout за секунди.</span>
              </div>
            )}

            <div className="profile-side-actions">
              <Link className="profile-cta" to="/checkout?plan=pro">
                {subscription ? "Смени или обнови плана" : "Активирай Plus"}
              </Link>
              {subscription && (
                <button
                  type="button"
                  className="profile-secondary-btn"
                  onClick={handleBillingPortal}
                  disabled={billingLoading}
                >
                  {billingLoading ? "Отваряне..." : "Управлявай в Stripe"}
                </button>
              )}
              <Link className="profile-secondary-link" to="/chat">
                Отвори secure чат
              </Link>
              {canAccessAdmin && (
                <Link className="profile-secondary-link" to="/admin">
                  Отвори admin dashboard
                </Link>
              )}
            </div>

            {subscriptionError && <p className="profile-error">{subscriptionError}</p>}
          </aside>
        </div>
      </div>
    </section>
  );
}
