import "../styles/Specialties.css";
import { Link } from "react-router-dom";

const specialties = [
  {
    id: "cardiology",
    name: "Кардиология",
    description:
      "Кардиологията се занимава с диагностика и лечение на заболявания на сърцето и кръвоносната система.",
    doctorsCount: 18,
    icon: "❤️",
  },
  {
    id: "dermatology",
    name: "Дерматология",
    description:
      "Дерматологията обхваща заболяванията на кожата, косата и ноктите, както и естетични консултации.",
    doctorsCount: 24,
    icon: "🧴",
  },
  {
    id: "pediatrics",
    name: "Педиатрия",
    description:
      "Педиатрията се грижи за здравето и развитието на деца от раждането до юношеска възраст.",
    doctorsCount: 15,
    icon: "🧒",
  },
  {
    id: "orthopedics",
    name: "Ортопедия",
    description:
      "Ортопедията диагностицира и лекува заболявания на опорно-двигателния апарат.",
    doctorsCount: 12,
    icon: "🦴",
  },
  {
    id: "gynecology",
    name: "Гинекология",
    description:
      "Гинекологията се занимава със здравето на женската репродуктивна система.",
    doctorsCount: 20,
    icon: "👩‍⚕️",
  },
  {
    id: "neurology",
    name: "Неврология",
    description:
      "Неврологията лекува заболявания на нервната система – мозък, гръбначен мозък и нерви.",
    doctorsCount: 10,
    icon: "🧠",
  },
];

export default function Specialties() {
  return (
    <div className="specialties-page">
      <div className="container">
        {/* HEADER */}
        <div className="specialties-header">
          <h1>Медицински специалности</h1>
          <p>
            Разгледайте всички медицински специалности и намерете подходящ
            лекар за вашите нужди.
          </p>
        </div>

        {/* GRID */}
        <div className="specialties-grid">
          {specialties.map((spec) => (
            <div key={spec.id} className="specialty-card">
              <div className="specialty-icon">{spec.icon}</div>

              <h3>{spec.name}</h3>

              <p className="specialty-description">
                {spec.description}
              </p>

              <div className="specialty-footer">
                <span className="doctors-count">
                  {spec.doctorsCount} лекари
                </span>

                <Link
                  to={`/doctors`}
                  className="view-doctors-btn"
                >
                  Виж лекари
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
