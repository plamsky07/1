import React from 'react';
import { Link } from "react-router-dom";
import '../styles/SearchSection.css';

const SearchSection = () => {
  const specialties = ['Кардиология', 'Дерматология', 'Педиатрия', 'Стоматология', 'Ортопедия', 'Неврология', 'Офталмология', 'Гастроентерология'];
  const cities = ['София', 'Пловдив', 'Варна', 'Бургас', 'Русе', 'Стара Загора', 'Плевен', 'Велико Търново'];

  return (
    <section className="search-section">
      <div className="container">
        <h2 className="section-heading">Търси лекар / медицинско заведение</h2>

        <div className="search-grid-container">
          {/* Специалности */}
          <div>
            <h3 className="category-title">👨‍⚕️ Популярни специалности</h3>
            <div className="specialties-grid">
              {specialties.map((spec, index) => (
                <Link
                  key={index}
                  to={`/doctors?specialty=${encodeURIComponent(spec)}&q=${encodeURIComponent(spec)}`}
                  className="specialty-item"
                >
                  {spec}
                </Link>
              ))}
            </div>
          </div>

          {/* Градове */}
          <div>
            <h3 className="category-title">📍 Търси по град</h3>
            <div className="cities-grid">
              {cities.map((city, index) => (
                <Link
                  key={index}
                  to={`/doctors?city=${encodeURIComponent(city)}`}
                  className="city-item"
                >
                  {city}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Препоръки */}
        <div className="tip-box">
          <h3 className="tip-title">💡 Съвет</h3>
          <p className="tip-text">
            Използвайте разширеното търсене, за да филтрирате лекари по <strong>застрахователна компания</strong>, 
            <strong> език</strong>, който говорят, или <strong>пол</strong>. Можете също да видите кои лекари приемат <strong>онлайн консултации</strong>.
          </p>
        </div>
      </div>
    </section>
  );
};

export default SearchSection;
