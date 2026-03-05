import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Testimonials.css';
import { FaQuoteLeft, FaStar } from 'react-icons/fa';

const Testimonials = () => {
  const testimonials = [
    {
      name: 'Александър Петров',
      role: 'Звуков инженер',
      image: 'https://randomuser.me/api/portraits/men/32.jpg',
      rating: 5,
      text: 'Намерих дерматолог за спешна консултация в същия ден. Резервацията беше за секунди, без чакане на телефона.'
    },
    {
      name: 'Мария Иванова',
      role: 'Майка на две деца',
      image: 'https://randomuser.me/api/portraits/women/44.jpg',
      rating: 5,
      text: 'Чрез платформата открих чудесен педиатър за децата ми. Мненията на другите родители бяха изключително полезни.'
    },
    {
      name: 'Георги Димитров',
      role: 'Спортист',
      image: 'https://randomuser.me/api/portraits/men/67.jpg',
      rating: 4,
      text: 'Травма на коляното, трябваше ортопед спешно. За 10 минути бях запазил час при специалист в моя град.'
    }
  ];

  return (
    <section className="testimonials-section">
      <div className="container">
        <div className="testimonials-header">
          <h2 className="testimonials-title">Какво казват нашите пациенти</h2>
          <p className="testimonials-subtitle">
            Реални отзиви от хора, които са намерили своя лекар чрез Superdoc
          </p>
        </div>

        <div className="testimonials-grid">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="testimonial-card">
              <div className="testimonial-header">
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="testimonial-avatar"
                />
                <div className="testimonial-info">
                  <h4>{testimonial.name}</h4>
                  <p>{testimonial.role}</p>
                </div>
              </div>

              <div className="testimonial-rating">
                {[...Array(5)].map((_, i) => (
                  <FaStar 
                    key={i} 
                    className={`star-icon ${i < testimonial.rating ? '' : 'inactive'}`} 
                  />
                ))}
              </div>

              <div className="testimonial-text">
                <FaQuoteLeft className="quote-icon" />
                {testimonial.text}
              </div>
            </div>
          ))}
        </div>

        {/* Призив към действието */}
        <div className="testimonials-cta">
          <Link to="/reviews" className="cta-button">
            Вижте всички отзиви и оценки &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
