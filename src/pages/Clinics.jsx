import "../styles/Clinics.css";
import { Link, useSearchParams } from "react-router-dom";

const clinics = [
  {
    id: "mc-heart-plus",
    name: "МЦ Сърце+",
    city: "София",
    address: "ул. Александър Стамболийски 45",
    specialties: ["Кардиология", "Неврология"],
    doctorsCount: 12,
  },
  {
    id: "derma-care",
    name: "DermaCare Clinic",
    city: "Пловдив",
    address: "бул. Руски 120",
    specialties: ["Дерматология"],
    doctorsCount: 7,
  },
  {
    id: "child-health",
    name: "Детско здраве",
    city: "Варна",
    address: "ул. Сливница 18",
    specialties: ["Педиатрия"],
    doctorsCount: 9,
  },
  {
    id: "ortho-move",
    name: "OrthoMove",
    city: "София",
    address: "бул. България 88",
    specialties: ["Ортопедия"],
    doctorsCount: 6,
  },
  {
    id: "women-care",
    name: "WomenCare Center",
    city: "Бургас",
    address: "ул. Демокрация 32",
    specialties: ["Гинекология"],
    doctorsCount: 8,
  },
  {
    id: "neuro-med",
    name: "NeuroMed",
    city: "Русе",
    address: "ул. Борисова 14",
    specialties: ["Неврология"],
    doctorsCount: 5,
  },

  // 🔽 НОВИ КЛИНИКИ 🔽

  {
    id: "vita-med",
    name: "VitaMed",
    city: "София",
    address: "ул. Позитано 22",
    specialties: ["Обща медицина"],
    doctorsCount: 10,
  },
  {
    id: "plovdiv-med",
    name: "Пловдив Мед",
    city: "Пловдив",
    address: "бул. Копривщица 15",
    specialties: ["Кардиология", "Ендокринология"],
    doctorsCount: 11,
  },
  {
    id: "city-clinic-varna",
    name: "City Clinic Varna",
    city: "Варна",
    address: "бул. Владислав Варненчик 102",
    specialties: ["Ортопедия", "Физиотерапия"],
    doctorsCount: 9,
  },
  {
    id: "alpha-med",
    name: "AlphaMed",
    city: "Стара Загора",
    address: "ул. Ген. Гурко 9",
    specialties: ["Неврология"],
    doctorsCount: 6,
  },
  {
    id: "medline",
    name: "MedLine Center",
    city: "Плевен",
    address: "ул. Васил Левски 34",
    specialties: ["Кардиология"],
    doctorsCount: 7,
  },
  {
    id: "nova-clinic",
    name: "Nova Clinic",
    city: "София",
    address: "бул. Черни връх 61",
    specialties: ["Дерматология", "Естетична медицина"],
    doctorsCount: 8,
  },
  {
    id: "st-george",
    name: "Св. Георги Медикал",
    city: "Пловдив",
    address: "ул. Цар Асен 48",
    specialties: ["Педиатрия"],
    doctorsCount: 6,
  },
  {
    id: "health-plus",
    name: "Health+ Center",
    city: "Благоевград",
    address: "ул. Иван Михайлов 12",
    specialties: ["Обща медицина"],
    doctorsCount: 5,
  },
  {
    id: "diagnostica",
    name: "Диагностика 2000",
    city: "София",
    address: "бул. Дондуков 55",
    specialties: ["Образна диагностика"],
    doctorsCount: 9,
  },
  {
    id: "care-med",
    name: "CareMed",
    city: "Велико Търново",
    address: "ул. Никола Габровски 7",
    specialties: ["Кардиология", "Неврология"],
    doctorsCount: 8,
  },
  {
    id: "family-health",
    name: "Family Health",
    city: "Габрово",
    address: "ул. Орловска 19",
    specialties: ["Обща медицина"],
    doctorsCount: 4,
  },
  {
    id: "st-maria",
    name: "Св. Мария",
    city: "Хасково",
    address: "ул. Родопи 11",
    specialties: ["Гинекология"],
    doctorsCount: 6,
  },
  {
    id: "medicus",
    name: "Medicus Plus",
    city: "София",
    address: "ул. Шипка 27",
    specialties: ["Вътрешни болести"],
    doctorsCount: 10,
  },
  {
    id: "euro-health",
    name: "EuroHealth",
    city: "Бургас",
    address: "бул. Сан Стефано 44",
    specialties: ["Кардиология"],
    doctorsCount: 7,
  },
  {
    id: "vita-clinic",
    name: "Vita Clinic",
    city: "Видин",
    address: "ул. Бдинци 3",
    specialties: ["Обща медицина"],
    doctorsCount: 4,
  },
  {
    id: "harmonia",
    name: "Harmonia Medical",
    city: "Добрич",
    address: "бул. 25-ти Септември 18",
    specialties: ["Неврология"],
    doctorsCount: 5,
  },
  {
    id: "med-vision",
    name: "MedVision",
    city: "София",
    address: "бул. Цариградско шосе 115",
    specialties: ["Офталмология"],
    doctorsCount: 9,
  },
  {
    id: "sanus",
    name: "Sanus Clinic",
    city: "Казанлък",
    address: "ул. Розова долина 21",
    specialties: ["Ортопедия"],
    doctorsCount: 5,
  },
  {
    id: "zenith-med",
    name: "Zenith Med",
    city: "Перник",
    address: "ул. Юрий Гагарин 6",
    specialties: ["Кардиология"],
    doctorsCount: 6,
  },
  {
    id: "prima-care",
    name: "PrimaCare",
    city: "София",
    address: "ул. Оборище 92",
    specialties: ["Ендокринология"],
    doctorsCount: 7,
  },
];

export default function Clinics() {
  const [searchParams] = useSearchParams();
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const city = searchParams.get("city") || "";
  const specialty = searchParams.get("specialty") || "";

  const filteredClinics = clinics.filter((clinic) => {
    const matchesQ =
      !q ||
      clinic.name.toLowerCase().includes(q) ||
      clinic.city.toLowerCase().includes(q) ||
      clinic.specialties.some((spec) => spec.toLowerCase().includes(q));
    const matchesCity = !city || clinic.city === city;
    const matchesSpecialty = !specialty || clinic.specialties.includes(specialty);
    return matchesQ && matchesCity && matchesSpecialty;
  });

  return (
    <div className="clinics-page">
      <div className="container">
        {/* HEADER */}
        <div className="clinics-header">
          <h1>Клиники и медицински центрове</h1>
          <p>
            Открийте лицензирани клиники и медицински центрове в цялата страна,
            работещи със SuperDoc.
          </p>
        </div>

        {/* GRID */}
        <div className="clinics-grid">
          {filteredClinics.map((clinic) => (
            <div key={clinic.id} className="clinic-card">
              <div className="clinic-top">
                <h3>{clinic.name}</h3>
                <span className="clinic-city">{clinic.city}</span>
              </div>

              <p className="clinic-address">{clinic.address}</p>

              <div className="clinic-specialties">
                {clinic.specialties.map((spec) => (
                  <span key={spec} className="specialty-badge">
                    {spec}
                  </span>
                ))}
              </div>

              <div className="clinic-footer">
                <span className="doctors-count">
                  {clinic.doctorsCount} лекари
                </span>

                <Link
                  to={`/doctors?clinic=${clinic.id}&q=${encodeURIComponent(
                    clinic.name
                  )}`}
                  className="view-doctors-btn"
                >
                  Виж лекари
                </Link>
              </div>
            </div>
          ))}
        </div>
        {filteredClinics.length === 0 && (
          <div style={{ marginTop: 16, color: "#666" }}>
            Няма намерени клиники по избраните критерии.
          </div>
        )}
      </div>
    </div>
  );
}
