import React from 'react';
import '../styles/SuperdocPlus.css';
import { FaCheck, FaBell, FaHeart, FaClock, FaCrown } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const SuperdocPlus = () => {
  const navigate = useNavigate();

  const benefits = [
    { icon: <FaBell />, text: 'Известия за по-ранни часове' },
    { icon: <FaHeart />, text: 'Любими лекари и бърз достъп' },
    { icon: <FaClock />, text: 'Приоритетна поддръжка' },
    { icon: <FaCrown />, text: 'Ексклузивни промоции' }
  ];

  const plans = [
    {
      key: 'monthly', // ✅ добавено
      name: 'Месечен',
      price: '4.99',
      period: 'месец',
      popular: false,
      features: ['Всички Plus ползи', 'Лесно анулиране', 'Плащане месечно']
    },
    {
      key: 'yearly', // ✅ добавено
      name: 'Годишен',
      price: '49.99',
      period: 'година',
      popular: true,
      features: ['Всички Plus ползи', '2 месеца безплатно', 'Спестявате 17%', 'Най-изгоден избор']
    }
  ];

  const handleChoosePlan = (planKey) => {
    navigate(`/checkout?plan=${planKey}`);
  };

  return (
    <section className="plus-section">
      <div className="container">
        <div className="plus-header">
          <h2 className="plus-title">Абонирай се за MedLink Plus</h2>
          <p className="plus-subtitle">
            Получи допълнителни предимства и резервирай часове от най-търсените специалисти преди всички останали.
          </p>
        </div>

        <div className="plus-content">
          {/* Ползи */}
          <div className="benefits-card">
            <h3 className="benefits-title">Вашите ползи:</h3>
            <ul className="benefits-list">
              {benefits.map((benefit, index) => (
                <li key={index} className="benefit-item">
                  <div className="benefit-icon">{benefit.icon}</div>
                  <span className="benefit-text">{benefit.text}</span>
                </li>
              ))}
            </ul>
            <div className="benefit-note">
              <p>
                <strong>Plus членовете</strong> резервират с <strong>40% по-бързо</strong> и имат
                <strong> 3 пъти по-голям шанс</strong> да получат час при търсен специалист.
              </p>
            </div>
          </div>

          {/* Планове */}
          <div className="plans-container">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`plan-card ${plan.popular ? 'popular' : ''}`}
              >
                {plan.popular && (
                  <div className="popular-badge">НАЙ-ИЗГОДЕН</div>
                )}
                <h3 className="plan-name">{plan.name} план</h3>
                <div className="plan-price-container">
                  <span className="plan-price">{plan.price} лв</span>
                  <span className="plan-period"> / {plan.period}</span>
                </div>
                <ul className="plan-features">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="plan-feature">
                      <FaCheck className="feature-icon-check" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* ✅ бутонът вече отваря checkout */}
                <button
                  className={`plan-button ${plan.popular ? 'popular' : 'standard'}`}
                  onClick={() => handleChoosePlan(plan.key)}
                >
                  Избери този план
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SuperdocPlus;
