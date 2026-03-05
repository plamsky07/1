import React from 'react';
import '../styles/WhatIsSuperdoc.css';
import { FaUserMd, FaComments, FaCalendarCheck, FaStar } from 'react-icons/fa';

const WhatIsSuperdoc = () => {
  const features = [
    {
      icon: <FaUserMd />,
      title: 'Намерете специалисти',
      description: 'Достъп до над 5000 проверени лекари и специалисти в цяла България.'
    },
    {
      icon: <FaComments />,
      title: 'Прочетете мнения',
      description: 'Реални отзиви и оценки от пациенти, които вече са ползвали услугите.'
    },
    {
      icon: <FaCalendarCheck />,
      title: 'Резервирайте онлайн',
      description: 'Запазете час с няколко кликвания, без чакане на телефона.'
    },
    {
      icon: <FaStar />,
      title: 'Спестете време',
      description: 'Сравнявайте свободни часове, местоположение и цени на едно място.'
    }
  ];

  return (
    <section className="about-section">
      <div className="container">
        <div className="about-header">
          <h2 className="about-title">Какво е МедЛинк?</h2>
          <p className="about-description">
            
            MedLink е водещата платформа за онлайн резервации на лекарски часове в България.
            Ние свързваме пациенти с правия специалист в реално време.
          </p>
        </div>

        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-text">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Статистики */}
        <div className="stats-container">
          <div>
            <div className="stat-number">5,000+</div>
            <div className="stat-label">Лекари</div>
          </div>
          <div>
            <div className="stat-number">120,000+</div>
            <div className="stat-label">Резервации</div>
          </div>
          <div>
            <div className="stat-number">85+</div>
            <div className="stat-label">Града</div>
          </div>
          <div>
            <div className="stat-number">4.8/5</div>
            <div className="stat-label">Средна оценка</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhatIsSuperdoc;