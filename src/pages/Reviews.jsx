import { FaStar } from "react-icons/fa";
import "../styles/Reviews.css";

const reviews = [
  {
    id: 1,
    name: "Елица Стоянова",
    city: "София",
    rating: 5,
    specialty: "Кардиология",
    text: "Запазих час за баща ми за по-малко от 5 минути. Информацията за лекаря беше ясна и точна.",
  },
  {
    id: 2,
    name: "Петър Александров",
    city: "Пловдив",
    rating: 5,
    specialty: "Ортопедия",
    text: "Търсех свободен час за същата седмица и тук го намерих веднага. Много удобно и бързо.",
  },
  {
    id: 3,
    name: "Ралица Иванова",
    city: "Варна",
    rating: 4,
    specialty: "Педиатрия",
    text: "Отзивите на други родители много помогнаха при избора на педиатър. Бих ползвала отново.",
  },
  {
    id: 4,
    name: "Николай Георгиев",
    city: "Бургас",
    rating: 5,
    specialty: "Дерматология",
    text: "Системата е лесна за ползване и потвърждението за часа дойде веднага. Отлично преживяване.",
  },
  {
    id: 5,
    name: "Анна Петрова",
    city: "Русе",
    rating: 5,
    specialty: "Ендокринология",
    text: "Намерих специалист с добри оценки и удобен час в близка клиника. Спести ми много време.",
  },
  {
    id: 6,
    name: "Симеон Димитров",
    city: "Стара Загора",
    rating: 4,
    specialty: "Неврология",
    text: "Добра платформа с реални мнения. Би било полезно да има още филтри, но като цяло е супер.",
  },
];

export default function Reviews() {
  return (
    <section className="reviews-page">
      <div className="container">
        <div className="reviews-header">
          <h1>Отзиви и оценки от пациенти</h1>
          <p>
            Истински впечатления от хора, които са запазили час през MedLink.
          </p>
        </div>

        <div className="reviews-grid">
          {reviews.map((review) => (
            <article key={review.id} className="review-card">
              <div className="review-card-top">
                <div>
                  <h3>{review.name}</h3>
                  <p>
                    {review.city} • {review.specialty}
                  </p>
                </div>

                <div className="review-stars" aria-label={`Оценка ${review.rating} от 5`}>
                  {[...Array(5)].map((_, index) => (
                    <FaStar
                      key={index}
                      className={index < review.rating ? "active" : "inactive"}
                    />
                  ))}
                </div>
              </div>

              <p className="review-text">{review.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
