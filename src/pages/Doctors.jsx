import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchDoctors, getCities, getClinicFilters } from "../services/doctorsService";

export default function Doctors() {
  const [searchParams] = useSearchParams();
  const selectedClinicId = searchParams.get("clinic") || "";
  const queryFromUrl = searchParams.get("q") || "";
  const cityFromUrl = searchParams.get("city") || "";
  const specialtyFromUrl = searchParams.get("specialty") || "";
  const onlineFromUrl = searchParams.get("online") === "1" || searchParams.get("online") === "true";
  const hasTodayFromUrl = searchParams.get("hasToday") === "1" || searchParams.get("hasToday") === "true";
  const genderFromUrl = searchParams.get("gender") || "";
  const languageFromUrl = searchParams.get("language") || "";
  const priceMaxFromUrl = searchParams.get("priceMax") || "";

  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [q, setQ] = useState(queryFromUrl);
  const [city, setCity] = useState(cityFromUrl);
  const [specialty, setSpecialty] = useState(specialtyFromUrl);
  const [onlineOnly, setOnlineOnly] = useState(onlineFromUrl);
  const [hasTodayOnly, setHasTodayOnly] = useState(hasTodayFromUrl);
  const [gender, setGender] = useState(genderFromUrl);
  const [language, setLanguage] = useState(languageFromUrl);
  const [priceMax, setPriceMax] = useState(priceMaxFromUrl);

  useEffect(() => {
    let cancelled = false;

    async function loadDoctors() {
      setIsLoading(true);
      setLoadError("");

      try {
        const data = await fetchDoctors();
        if (!cancelled) {
          setDoctors(data);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Възникна проблем при зареждане на лекарите.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadDoctors();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setQ(queryFromUrl);
    setCity(cityFromUrl);
    setSpecialty(specialtyFromUrl);
    setOnlineOnly(onlineFromUrl);
    setHasTodayOnly(hasTodayFromUrl);
    setGender(genderFromUrl);
    setLanguage(languageFromUrl);
    setPriceMax(priceMaxFromUrl);
  }, [
    selectedClinicId,
    queryFromUrl,
    cityFromUrl,
    specialtyFromUrl,
    onlineFromUrl,
    hasTodayFromUrl,
    genderFromUrl,
    languageFromUrl,
    priceMaxFromUrl,
  ]);

  const clinicFilters = useMemo(() => getClinicFilters(doctors), [doctors]);
  const cityOptions = useMemo(() => getCities(doctors), [doctors]);
  const selectedClinic = selectedClinicId ? clinicFilters[selectedClinicId] : null;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return doctors.filter((d) => {
      const matchQ =
        !query ||
        d.name.toLowerCase().includes(query) ||
        d.specialty.toLowerCase().includes(query) ||
        d.clinicName.toLowerCase().includes(query);
      const matchCity = !city || d.city === city;
      const matchSpec = !specialty || d.specialty === specialty;
      const matchOnline = !onlineOnly || d.online === true;
      const matchClinic = !selectedClinicId || d.clinicId === selectedClinicId;
      const matchHasToday = !hasTodayOnly || (Array.isArray(d.slots) && d.slots.length > 0);
      const matchGender = !gender || (d.gender && d.gender === gender);
      const matchLanguage = !language || (Array.isArray(d.languages) && d.languages.includes(language));
      const parsedPriceMax = priceMax ? Number(priceMax) : null;
      const matchPrice =
        !parsedPriceMax ||
        !Number.isFinite(parsedPriceMax) ||
        d.priceBgn === undefined ||
        d.priceBgn === null ||
        Number(d.priceBgn) <= parsedPriceMax;

      return (
        matchQ &&
        matchCity &&
        matchSpec &&
        matchOnline &&
        matchClinic &&
        matchHasToday &&
        matchGender &&
        matchLanguage &&
        matchPrice
      );
    });
  }, [doctors, q, city, specialty, onlineOnly, selectedClinicId, hasTodayOnly, gender, language, priceMax]);

  return (
    <div className="container" style={{ padding: "24px 0" }}>
      <h1 style={{ marginBottom: 12 }}>Лекари</h1>
      {selectedClinic && (
        <p style={{ marginBottom: 12, color: "#4b5563" }}>
          Показани са лекари за клиника: <strong>{selectedClinic.name}</strong>
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Търси по име, специалност или клиника…"
          style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
        >
          <option value="">Всички градове</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
        >
          <option value="">Всички специалности</option>
          <option value="Кардиология">Кардиология</option>
          <option value="Дерматология">Дерматология</option>
          <option value="Педиатрия">Педиатрия</option>
          <option value="Ортопедия">Ортопедия</option>
          <option value="Гинекология">Гинекология</option>
          <option value="Неврология">Неврология</option>
          <option value="Ендокринология">Ендокринология</option>
          <option value="Офталмология">Офталмология</option>
          <option value="Вътрешни болести">Вътрешни болести</option>
          <option value="Обща медицина">Обща медицина</option>
          <option value="Физиотерапия">Физиотерапия</option>
          <option value="Естетична медицина">Естетична медицина</option>
          <option value="Образна диагностика">Образна диагностика</option>
        </select>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={onlineOnly}
              onChange={(e) => setOnlineOnly(e.target.checked)}
            />
            Само онлайн
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={hasTodayOnly}
              onChange={(e) => setHasTodayOnly(e.target.checked)}
            />
            Има час днес
          </label>
        </div>
      </div>

      {isLoading && <div style={{ padding: 16, color: "#666" }}>Зареждане на лекари...</div>}
      {!isLoading && loadError && <div style={{ padding: 16, color: "#b91c1c" }}>{loadError}</div>}

      {!isLoading && !loadError && (
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map((d) => (
            <div
              key={d.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 14,
                padding: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{d.name}</div>
                <div style={{ color: "#555" }}>
                  {d.specialty} • {d.city} • {d.clinicName} {d.online ? "• Онлайн" : ""}
                </div>
              </div>

              <Link
                to={`/doctors/${d.id}`}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "#1d4ed8",
                  color: "white",
                  textDecoration: "none",
                }}
              >
                Виж профил
              </Link>
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: 16, color: "#666" }}>
              Няма резултати по избраните филтри.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
