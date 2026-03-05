import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdvancedSearch() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    q: "",
    city: "",
    specialty: "",
    gender: "",
    language: "",
    priceMax: "",
    hasToday: false,
    online: false,
  });

  const set = (key, value) => setFilters((p) => ({ ...p, [key]: value }));

  const onSubmit = (e) => {
    e.preventDefault();

    const params = new URLSearchParams();
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.city) params.set("city", filters.city);
    if (filters.specialty) params.set("specialty", filters.specialty);
    if (filters.gender) params.set("gender", filters.gender);
    if (filters.language) params.set("language", filters.language);
    if (filters.priceMax) params.set("priceMax", filters.priceMax);
    if (filters.hasToday) params.set("hasToday", "1");
    if (filters.online) params.set("online", "1");

    navigate(`/doctors?${params.toString()}`);
  };

  return (
    <div className="container" style={{ padding: "24px 0" }}>
      <h1 style={{ marginBottom: 12 }}>Разширено търсене</h1>

      <form
        onSubmit={onSubmit}
        style={{
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <input
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Ключова дума (име, специалност, клиника)…"
          style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <select value={filters.city} onChange={(e) => set("city", e.target.value)} style={fieldStyle}>
            <option value="">Град</option>
            <option value="София">София</option>
            <option value="Пловдив">Пловдив</option>
            <option value="Варна">Варна</option>
          </select>

          <select value={filters.specialty} onChange={(e) => set("specialty", e.target.value)} style={fieldStyle}>
            <option value="">Специалност</option>
            <option value="Кардиология">Кардиология</option>
            <option value="Дерматология">Дерматология</option>
            <option value="Педиатрия">Педиатрия</option>
          </select>

          <select value={filters.gender} onChange={(e) => set("gender", e.target.value)} style={fieldStyle}>
            <option value="">Пол на лекар</option>
            <option value="male">Мъж</option>
            <option value="female">Жена</option>
          </select>

          <select value={filters.language} onChange={(e) => set("language", e.target.value)} style={fieldStyle}>
            <option value="">Език</option>
            <option value="bg">Български</option>
            <option value="en">Английски</option>
            <option value="de">Немски</option>
          </select>

          <input
            value={filters.priceMax}
            onChange={(e) => set("priceMax", e.target.value)}
            placeholder="Макс. цена (лв.)"
            style={fieldStyle}
          />
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <label style={checkStyle}>
            <input
              type="checkbox"
              checked={filters.hasToday}
              onChange={(e) => set("hasToday", e.target.checked)}
            />
            Има час днес
          </label>

          <label style={checkStyle}>
            <input type="checkbox" checked={filters.online} onChange={(e) => set("online", e.target.checked)} />
            Онлайн консултация
          </label>
        </div>

        <button
          type="submit"
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "none",
            background: "#1d4ed8",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
            width: "fit-content",
          }}
        >
          Търси
        </button>
      </form>
    </div>
  );
}

const fieldStyle = { padding: 12, borderRadius: 10, border: "1px solid #ddd" };
const checkStyle = { display: "flex", gap: 8, alignItems: "center" };
