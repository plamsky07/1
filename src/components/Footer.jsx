import React from 'react';
import '../styles/Footer.css';
import { FaFacebook, FaInstagram, FaLinkedin, FaMapMarkerAlt, FaPhone, FaEnvelope } from 'react-icons/fa';

const Footer = () => {
  const specialties = ['Кардиология', 'Дерматология', 'Стоматология', 'Педиатрия', 'Ортопедия', 'Гинекология'];
  const cities = ['София', 'Пловдив', 'Варна', 'Бургас', 'Русе', 'Стара Загора'];

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          {/* За Superdoc */}
          <div>
            <h3 className="footer-logo">SUPERDOC</h3>
            <p className="footer-description">
              Водещата платформа за онлайн резервации на лекарски часове в България. 
              Свързваме пациенти с правия специалист.
            </p>
            <div className="social-links">
              <a href="#" className="social-link"><FaFacebook /></a>
              <a href="#" className="social-link"><FaInstagram /></a>
              <a href="#" className="social-link"><FaLinkedin /></a>
            </div>
          </div>

          {/* Бързи връзки */}
          <div>
            <h4>За Superdoc</h4>
            <ul className="footer-links">
              <li><a href="#" className="footer-link">За нас</a></li>
              <li><a href="#" className="footer-link">Как работи?</a></li>
              <li><a href="#" className="footer-link">Често задавани въпроси</a></li>
              <li><a href="#" className="footer-link">Общи условия</a></li>
              <li><a href="#" className="footer-link">Политика за защита на данните</a></li>
            </ul>
          </div>

          {/* Специалности */}
          <div>
            <h4>Специалности</h4>
            <ul className="footer-links">
              {specialties.map((spec, index) => (
                <li key={index}><a href="#" className="footer-link">{spec}</a></li>
              ))}
            </ul>
          </div>

          {/* Контакти */}
          <div>
            <h4>Контакти</h4>
            <ul className="footer-links">
              <li className="contact-item">
                <FaMapMarkerAlt className="contact-icon" />
                <span>бул. "България" 123, София</span>
              </li>
              <li className="contact-item">
                <FaPhone className="contact-icon" />
                <span>0700 123 456</span>
              </li>
              <li className="contact-item">
                <FaEnvelope className="contact-icon" />
                <span>info@superdoc.bg</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Градове */}
        <div className="cities-section">
          <h4 className="cities-title">Търси лекар в град</h4>
          <div className="cities-container">
            {cities.map((city, index) => (
              <a key={index} href="#" className="city-link">
                {city}
              </a>
            ))}
          </div>
        </div>

        {/* Авторски права */}
        <div className="copyright">
          <p>&copy; {new Date().getFullYear()} Superdoc.bg — Всички права запазени. Информационна система за медицински резервации.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;