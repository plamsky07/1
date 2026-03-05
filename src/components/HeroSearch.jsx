import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/HeroSearch.css';
import { FaSearch, FaStethoscope, FaMapMarkerAlt, FaHospital } from 'react-icons/fa';

const HeroSearch = () => {
  const navigate = useNavigate();
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [searchClinics, setSearchClinics] = useState(false);

  const onSearch = () => {
    const params = new URLSearchParams();
    if (specialty) {
      params.set("specialty", specialty);
      params.set("q", specialty);
    }
    if (city) {
      params.set("city", city);
    }

    const target = searchClinics ? "/clinics" : "/doctors";
    const query = params.toString();
    navigate(query ? `${target}?${query}` : target);
  };

  return (
    <section className="hero">
      <div className="container">
        <h1 className="hero-title">Намерете перфектния лекар за Вас</h1>
        <p className="hero-subtitle">
          Резервирайте час онлайн за секунди. Разгледайте отзиви, местоположение и налични часове.
        </p>

        {/* Основен търсачки панел */}
        <div className="search-container">
          <div className="search-grid">
            {/* Поле за специалност */}
            <div className="search-field">
              <label className="search-label">
                <FaStethoscope /> Специалност
              </label>
              <select
                className="search-select"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
              >
                <option value="">Изберете специалност</option>
                <option value="Обща медицина">Обща медицина</option>
                <option value="Кардиология">Кардиология</option>
                <option value="Дерматология">Дерматология</option>
                <option value="Педиатрия">Педиатрия</option>
                <option value="Ортопедия">Ортопедия</option>
                <option value="Неврология">Неврология</option>
              </select>
            </div>

            {/* Поле за местоположение */}
            <div className="search-field-small">
              <label className="search-label">
                <FaMapMarkerAlt /> Населено място
              </label>
              <select
                className="search-select"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="">Изберете град</option>
                <option value="София">София</option>
                <option value="Пловдив">Пловдив</option>
                <option value="Варна">Варна</option>
                <option value="Бургас">Бургас</option>
                <option value="Русе">Русе</option>
              </select>
            </div>

            {/* Бутон за търсене */}
            <div className="search-btn-container">
              <button className="search-btn" type="button" onClick={onSearch}>
                <FaSearch /> Търси
              </button>
            </div>
          </div>

          {/* Допълнителни филтри */}
          <div className="search-filters">
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={searchClinics}
                onChange={(e) => setSearchClinics(e.target.checked)}
              />
              <FaHospital /> Търси и клиники
            </label>
            <Link to="/search" className="advanced-search">
              Разширено търсене &raquo;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSearch;
