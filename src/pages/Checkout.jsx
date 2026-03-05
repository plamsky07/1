import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getCurrentUser } from "../services/authService";
import "../styles/checkout.css";

const PLANS = {
  monthly: {
    id: "monthly",
    name: "MedLink Plus Monthly",
    price: 4.99,
    period: "месец",
    tag: "За старт",
    perks: [
      "Приоритетно записване на час",
      "Известия за по-ранни свободни часове",
      "Бърз достъп до любими лекари",
    ],
  },
  basic: {
    id: "basic",
    name: "MedLink Plus Basic",
    price: 9.99,
    period: "месец",
    tag: "За старт",
    perks: [
      "Приоритетно записване на час",
      "Запазени лекари (favorites)",
      "Известия за часове и промени",
    ],
  },
  pro: {
    id: "pro",
    name: "MedLink Plus Pro",
    price: 19.99,
    period: "месец",
    tag: "Най-избиран",
    perks: [
      "Всичко от Basic",
      "Онлайн консултации (по-лесно филтриране)",
      "По-бърза поддръжка",
      "Разширени филтри и история",
    ],
  },
  yearly: {
    id: "yearly",
    name: "MedLink Plus Yearly",
    price: 149.0,
    period: "година",
    tag: "Най-изгоден",
    perks: [
      "Всичко от Pro",
      "Спестяваш спрямо месечен план",
      "VIP поддръжка",
      "Ранен достъп до нови функции",
    ],
  },
};

function formatPriceBGN(num) {
  // Само визуално: ако искаш EUR остави €; ако искаш BGN смени.
  // Тук държим € (Stripe обикновено ще е EUR), но ти решаваш.
  return `€${num.toFixed(2)}`;
}

export default function Checkout() {
  const location = useLocation();
  const [authUser, setAuthUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Вземаме план от query: /checkout?plan=pro
  const planKey = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const key = sp.get("plan");
    return PLANS[key] ? key : "pro";
  }, [location.search]);

  const plan = PLANS[planKey];
  const status = new URLSearchParams(location.search).get("status");

  // UI-only state
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    company: "",
    vat: "",
    country: "Bulgaria",
    city: "",
    address: "",
    postal: "",
    agree: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const user = await getCurrentUser();
      if (cancelled || !user) return;

      setAuthUser(user);
      setForm((prev) => ({
        ...prev,
        email: prev.email || user.email || "",
        fullName:
          prev.fullName ||
          user.user_metadata?.full_name ||
          [user.user_metadata?.first_name, user.user_metadata?.last_name]
            .filter(Boolean)
            .join(" ")
            .trim(),
      }));
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    setSubmitError("");

    if (!authUser?.id) {
      setSubmitError("Трябва да влезеш в профила си преди плащане.");
      return;
    }

    if (!form.email.trim() || !form.fullName.trim()) {
      setSubmitError("Попълни имейл и име за фактура.");
      return;
    }

    if (!form.agree) {
      setSubmitError("Трябва да приемеш условията и поверителността.");
      return;
    }

    setIsSubmitting(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4242";
      const response = await fetch(`${apiBase}/api/stripe/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: plan.id,
          userId: authUser.id,
          email: form.email.trim(),
          fullName: form.fullName.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "Неуспешно създаване на Stripe сесия.");
      }

      window.location.href = data.url;
    } catch (error) {
      setSubmitError(error?.message || "Проблем при стартиране на плащането.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtotal = plan.price;
  const tax = 0; // UI-only
  const total = subtotal + tax;

  const nextBilling = plan.period === "месец" ? "след 30 дни" : "след 12 месеца";

  return (
    <div className="ml-checkout">
      {/* Top bar */}
      <div className="ml-checkout__top">
        <div className="ml-checkout__brand">
          <div className="ml-checkout__logo">ML</div>
          <div>
            <div className="ml-checkout__title">MedLink</div>
            <div className="ml-checkout__subtitle">Secure checkout</div>
          </div>
        </div>

        <div className="ml-checkout__nav">
          <Link className="ml-link" to="/">
            ← Обратно към плановете
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="ml-checkout__wrap">
        {/* Left: form */}
        <section className="ml-card ml-card--form">
          <header className="ml-card__header">
            <h1>Завършване на абонамент</h1>
            <p className="muted">
              Попълни данните си и продължи към защитено плащане в Stripe.
            </p>
          </header>

          {status === "success" && (
            <div className="ml-alert ml-alert--success">
              Плащането е успешно. Абонаментът ти е активиран.
            </div>
          )}
          {status === "canceled" && (
            <div className="ml-alert ml-alert--warning">
              Плащането беше прекъснато. Можеш да опиташ отново.
            </div>
          )}

          <div className="ml-steps">
            <div className="ml-step is-active">
              <span className="ml-step__dot" />
              Данни
            </div>
            <div className="ml-step">
              <span className="ml-step__dot" />
              Плащане
            </div>
            <div className="ml-step">
              <span className="ml-step__dot" />
              Потвърждение
            </div>
          </div>

          <form className="ml-form" onSubmit={handleCheckout}>
            <div className="ml-grid2">
              <div className="ml-field">
                <label>Имейл</label>
                <input
                  name="email"
                  type="email"
                  placeholder="name@email.com"
                  value={form.email}
                  onChange={onChange}
                />
              </div>
              <div className="ml-field">
                <label>Име и фамилия</label>
                <input
                  name="fullName"
                  type="text"
                  placeholder="Напр. Denis Ivanov"
                  value={form.fullName}
                  onChange={onChange}
                />
              </div>
            </div>

            <div className="ml-grid2">
              <div className="ml-field">
                <label>Фирма (по желание)</label>
                <input
                  name="company"
                  type="text"
                  placeholder="Напр. MedLink Ltd."
                  value={form.company}
                  onChange={onChange}
                />
              </div>
              <div className="ml-field">
                <label>ДДС № (по желание)</label>
                <input
                  name="vat"
                  type="text"
                  placeholder="BG123456789"
                  value={form.vat}
                  onChange={onChange}
                />
              </div>
            </div>

            <div className="ml-grid2">
              <div className="ml-field">
                <label>Държава</label>
                <select
                  name="country"
                  value={form.country}
                  onChange={onChange}
                >
                  <option>Bulgaria</option>
                  <option>Romania</option>
                  <option>Greece</option>
                  <option>Germany</option>
                  <option>United Kingdom</option>
                </select>
              </div>
              <div className="ml-field">
                <label>Град</label>
                <input
                  name="city"
                  type="text"
                  placeholder="Напр. Пловдив"
                  value={form.city}
                  onChange={onChange}
                />
              </div>
            </div>

            <div className="ml-field">
              <label>Адрес</label>
              <input
                name="address"
                type="text"
                placeholder="ул. … № …"
                value={form.address}
                onChange={onChange}
              />
            </div>

            <div className="ml-grid2">
              <div className="ml-field">
                <label>Пощенски код</label>
                <input
                  name="postal"
                  type="text"
                  placeholder="4000"
                  value={form.postal}
                  onChange={onChange}
                />
              </div>
              <div className="ml-field">
                <label>Код за отстъпка (UI)</label>
                <div className="ml-coupon">
                  <input type="text" placeholder="MEDLINK10" />
                  <button type="button" className="ml-btn ml-btn--ghost">
                    Apply
                  </button>
                </div>
              </div>
            </div>

            <label className="ml-check">
              <input
                type="checkbox"
                name="agree"
                checked={form.agree}
                onChange={onChange}
              />
              <span>
                Съгласен/съгласна съм с{" "}
                <a className="ml-link" href="#terms">
                  условията
                </a>{" "}
                и{" "}
                <a className="ml-link" href="#privacy">
                  поверителността
                </a>
                .
              </span>
            </label>

            <div className="ml-actions">
              <button className="ml-btn ml-btn--primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Пренасочване към Stripe..." : "Продължи към плащане"}
              </button>
              <div className="ml-secure">
                Secure • SSL • Данните са защитени
              </div>
            </div>

            {submitError && <div className="ml-error">{submitError}</div>}

            <div className="ml-note">
              След натискане ще бъдеш пренасочен към Stripe Checkout.
            </div>
          </form>
        </section>

        {/* Right: summary */}
        <aside className="ml-card ml-card--summary">
          <div className="ml-summary__top">
            <div>
              <div className="ml-badge">{plan.tag}</div>
              <h2 className="ml-summary__plan">{plan.name}</h2>
              <p className="muted">
                Таксуване: <b>на {plan.period}</b> • Следващо: {nextBilling}
              </p>
            </div>

            <div className="ml-price">
              <div className="ml-price__big">{formatPriceBGN(plan.price)}</div>
              <div className="ml-price__sub">/ {plan.period}</div>
            </div>
          </div>

          <div className="ml-divider" />

          <div className="ml-summary__list">
            <div className="ml-summary__row">
              <span>Абонамент</span>
              <b>{formatPriceBGN(subtotal)}</b>
            </div>
            <div className="ml-summary__row">
              <span>Такси</span>
              <span className="muted">{tax === 0 ? "—" : formatPriceBGN(tax)}</span>
            </div>
            <div className="ml-summary__row ml-summary__row--total">
              <span>Общо</span>
              <b>{formatPriceBGN(total)}</b>
            </div>
          </div>

          <div className="ml-divider" />

          <h3 className="ml-h3">Какво включва</h3>
          <ul className="ml-perks">
            {plan.perks.map((p) => (
              <li key={p}>✓ {p}</li>
            ))}
          </ul>

          <div className="ml-help">
            <div className="ml-help__title">Нужда от помощ?</div>
            <div className="muted">
              Пиши ни: <span className="ml-pill">support@medlink.bg</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Footer small */}
      <footer className="ml-checkout__footer">
        <span className="muted">
          © {new Date().getFullYear()} MedLink • Payments powered by Stripe (soon)
        </span>
      </footer>
    </div>
  );
}
