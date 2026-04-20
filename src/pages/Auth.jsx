import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentUser, signInWithEmail, signUpWithEmail } from "../services/authService";
import { useToast } from "../context/ToastState";

const ACCOUNT_OPTIONS = [
  {
    value: "patient",
    label: "Пациент",
    description: "Стандартен профил за записване на часове, чат и плащания.",
  },
  {
    value: "doctor",
    label: "Лекар",
    description: "Кандидатстваш като лекар и профилът ти минава през admin проверка.",
  },
];

const fieldStyle = {
  padding: 12,
  borderRadius: 10,
  border: "1px solid #ddd",
  width: "100%",
};

export default function Auth({ authUser, onAuthChange }) {
  const [mode, setMode] = useState("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountType, setAccountType] = useState("patient");
  const [doctorSpecialty, setDoctorSpecialty] = useState("");
  const [doctorCity, setDoctorCity] = useState("");
  const [doctorClinicName, setDoctorClinicName] = useState("");
  const [doctorLicenseNumber, setDoctorLicenseNumber] = useState("");
  const [doctorYearsExperience, setDoctorYearsExperience] = useState("");
  const [doctorServices, setDoctorServices] = useState("");
  const [doctorLanguages, setDoctorLanguages] = useState("");
  const [doctorBio, setDoctorBio] = useState("");
  const [doctorOnline, setDoctorOnline] = useState(true);
  const [doctorCertificationConfirmed, setDoctorCertificationConfirmed] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const { showError, showInfo, showSuccess } = useToast();

  const isRegister = mode === "register";
  const registeringDoctor = isRegister && accountType === "doctor";

  const registerHint = useMemo(() => {
    if (!registeringDoctor) {
      return "Създай профил, за да записваш часове онлайн.";
    }

    return "Попълни професионалните си данни. След потвърждение на имейла admin екипът ще прегледа лекарската ти кандидатура.";
  }, [registeringDoctor]);

  if (authUser) {
    return <Navigate to="/" replace />;
  }

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

  const validateDoctorForm = () => {
    if (!doctorSpecialty.trim() || !doctorCity.trim() || !doctorClinicName.trim()) {
      return "Попълни специалност, град и клиника.";
    }

    if (!doctorLicenseNumber.trim()) {
      return "Лиценз/регистрационен номер е задължителен за лекарски профил.";
    }

    if (!doctorYearsExperience || Number(doctorYearsExperience) < 0) {
      return "Годините опит трябва да са валидно число.";
    }

    if (!doctorBio.trim() || doctorBio.trim().length < 40) {
      return "Добави кратко професионално описание от поне 40 символа.";
    }

    if (!doctorCertificationConfirmed) {
      return "Трябва да потвърдиш, че си сертифициран лекар и носиш отговорност за въведените данни.";
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!email || !password) {
      const text = "Попълни имейл и парола.";
      setError(text);
      showError(text);
      return;
    }

    if (!validateEmail(email)) {
      const text = "Въведи валиден имейл.";
      setError(text);
      showError(text);
      return;
    }

    if (!validatePassword(password)) {
      const text = "Паролата трябва да е минимум 8 символа и да съдържа малка, главна буква и цифра.";
      setError(text);
      showError(text);
      return;
    }

    if (isRegister) {
      if (!firstName.trim() || !lastName.trim()) {
        const text = "Попълни име и фамилия.";
        setError(text);
        showError(text);
        return;
      }

      if (!validatePhone(phone.trim())) {
        const text = "Телефонният номер е невалиден.";
        setError(text);
        showError(text);
        return;
      }

      if (password !== confirmPassword) {
        const text = "Паролите не съвпадат.";
        setError(text);
        showError(text);
        return;
      }

      if (!acceptedTerms) {
        const text = "Трябва да приемеш условията за ползване.";
        setError(text);
        showError(text);
        return;
      }

      if (accountType === "doctor") {
        const doctorValidationError = validateDoctorForm();
        if (doctorValidationError) {
          setError(doctorValidationError);
          showError(doctorValidationError);
          return;
        }
      }
    }

    setLoading(true);
    try {
      if (isRegister) {
        const data = await signUpWithEmail(email, password, {
          firstName,
          lastName,
          phone,
          accountType,
          doctorSpecialty,
          doctorCity,
          doctorClinicName,
          doctorLicenseNumber,
          doctorYearsExperience,
          doctorServices,
          doctorLanguages,
          doctorBio,
          doctorOnline,
          doctorCertificationConfirmed,
        });

        if (data?.user && !data?.access_token) {
          const toastText =
            "Изпратихме имейл за потвърждение. Потвърди адреса си, преди да опиташ вход в MedLink.";
          setMessage(toastText);
          showInfo(toastText, {
            title: "Потвърди имейла си",
            persistent: true,
            persistentKey: `confirm-email:${email.trim().toLowerCase()}`,
          });
        } else {
          const currentUser = await getCurrentUser();
          onAuthChange?.(currentUser ?? data?.user ?? null);
          const successText =
            accountType === "doctor"
              ? "Профилът е създаден. Лекарската информация е изпратена за проверка."
              : "Регистрацията е успешна.";
          setMessage(successText);
          showSuccess(successText, { title: "Добре дошъл в MedLink" });
        }
      } else {
        const data = await signInWithEmail(email, password);
        onAuthChange?.(data?.user ?? (await getCurrentUser()) ?? null);
        const successText = "Успешен вход.";
        setMessage(successText);
        showSuccess(successText, { title: "Сесията е активна" });
      }
    } catch (err) {
      const authError = err?.message || "Възникна грешка при автентикация.";
      setError(authError);
      showError(authError);

      if (/confirm|confirmed|verification/i.test(authError)) {
        showInfo(
          "Ако току-що си се регистрирал, отвори имейла си и потвърди профила. Този toast ще остане, докато не го махнеш ръчно.",
          {
            title: "Изчаква се потвърждение",
            persistent: true,
            persistentKey: `confirm-email:${email.trim().toLowerCase()}`,
          }
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: "24px 0" }}>
      <h1>{isRegister ? "Регистрация" : "Вход"}</h1>
      <p style={{ color: "#555" }}>
        {isRegister ? registerHint : "Влез в профила си, за да управляваш записванията."}
      </p>

      <div style={{ maxWidth: 780, marginTop: 20 }}>
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
              <div style={{ display: "grid", gap: 10 }}>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>Тип профил</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  {ACCOUNT_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      style={{
                        border: accountType === option.value ? "1px solid #1d4ed8" : "1px solid #dbe2ea",
                        background: accountType === option.value ? "#eff6ff" : "#ffffff",
                        borderRadius: 16,
                        padding: 14,
                        display: "grid",
                        gap: 6,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="radio"
                          name="accountType"
                          value={option.value}
                          checked={accountType === option.value}
                          onChange={(event) => setAccountType(event.target.value)}
                        />
                        <strong>{option.label}</strong>
                      </div>
                      <span style={{ color: "#475569", fontSize: 14 }}>{option.description}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Име"
                  autoComplete="given-name"
                  style={fieldStyle}
                />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Фамилия"
                  autoComplete="family-name"
                  style={fieldStyle}
                />
              </div>

              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Телефон"
                autoComplete="tel"
                style={fieldStyle}
              />

              {registeringDoctor && (
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    padding: 18,
                    borderRadius: 18,
                    background: "#f8fafc",
                    border: "1px solid #dbe2ea",
                  }}
                >
                  <strong style={{ color: "#0f172a" }}>Професионални данни за лекар</strong>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <input
                      type="text"
                      value={doctorSpecialty}
                      onChange={(event) => setDoctorSpecialty(event.target.value)}
                      placeholder="Специалност"
                      style={fieldStyle}
                    />
                    <input
                      type="text"
                      value={doctorCity}
                      onChange={(event) => setDoctorCity(event.target.value)}
                      placeholder="Град"
                      style={fieldStyle}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <input
                      type="text"
                      value={doctorClinicName}
                      onChange={(event) => setDoctorClinicName(event.target.value)}
                      placeholder="Клиника / медицински център"
                      style={fieldStyle}
                    />
                    <input
                      type="text"
                      value={doctorLicenseNumber}
                      onChange={(event) => setDoctorLicenseNumber(event.target.value)}
                      placeholder="Лиценз / УИН / регистрационен номер"
                      style={fieldStyle}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <input
                      type="number"
                      min="0"
                      value={doctorYearsExperience}
                      onChange={(event) => setDoctorYearsExperience(event.target.value)}
                      placeholder="Години опит"
                      style={fieldStyle}
                    />
                    <input
                      type="text"
                      value={doctorLanguages}
                      onChange={(event) => setDoctorLanguages(event.target.value)}
                      placeholder="Езици, разделени със запетая"
                      style={fieldStyle}
                    />
                  </div>

                  <input
                    type="text"
                    value={doctorServices}
                    onChange={(event) => setDoctorServices(event.target.value)}
                    placeholder="Услуги, разделени със запетая"
                    style={fieldStyle}
                  />

                  <textarea
                    rows={4}
                    value={doctorBio}
                    onChange={(event) => setDoctorBio(event.target.value)}
                    placeholder="Професионално описание, опит, области на практика..."
                    style={{ ...fieldStyle, resize: "vertical" }}
                  />

                  <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#334155" }}>
                    <input
                      type="checkbox"
                      checked={doctorOnline}
                      onChange={(event) => setDoctorOnline(event.target.checked)}
                    />
                    Предлагам и онлайн консултации
                  </label>

                  <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#334155", fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={doctorCertificationConfirmed}
                      onChange={(event) => setDoctorCertificationConfirmed(event.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    Потвърждавам, че съм реално сертифициран лекар и въведените данни, лиценз и квалификация са верни. Разбирам, че профилът ми ще бъде прегледан от администратор преди публикуване.
                  </label>
                </div>
              )}
            </>
          )}

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Имейл"
            autoComplete="email"
            style={fieldStyle}
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Парола"
            autoComplete={isRegister ? "new-password" : "current-password"}
            style={fieldStyle}
          />

          {isRegister && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повтори паролата"
              autoComplete="new-password"
              style={fieldStyle}
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
