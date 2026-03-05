import { NavLink, Link } from "react-router-dom";
import "../styles/Header.css"; 

export default function Header({ authUser, onLogout, notificationCount = 0 }) {
  const navLinkClass = ({ isActive }) =>
    isActive
      ? "nav-link active"
      : "nav-link";

  const fullName = [
    authUser?.user_metadata?.first_name,
    authUser?.user_metadata?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <header className="header">
      <div className="header-container">
        
        {/* ЛОГО */}
        <Link to="/" className="logo">
          MEDLINK
        </Link>

        {/* НАВИГАЦИЯ */}
        <nav className="nav">
          <NavLink to="/doctors" className={navLinkClass}>
            Търси лекар
          </NavLink>

          <NavLink to="/clinics" className={navLinkClass}>
            Клиники
          </NavLink>

          <NavLink to="/specialties" className={navLinkClass}>
            Специалности
          </NavLink>

          <NavLink to="/help" className={navLinkClass}>
            Как работи?
          </NavLink>
        </nav>

        {/* ДЕСЕН БЛОК */}
        <div className="header-actions">
          <Link to="/appointments" className="icon-btn notifications-link" aria-label="Известия">
            <span aria-hidden="true">Часове</span>
            {authUser && notificationCount > 0 && (
              <span className="notifications-badge">
                {notificationCount > 99 ? "99+" : notificationCount}
              </span>
            )}
            <span className="sr-only">Известия</span>
          </Link>

          {authUser ? (
            <>
              <Link to="/profile" style={{ color: "#4b5563", fontSize: 14, textDecoration: "none" }}>
                {fullName || authUser.email}
              </Link>
              <button
                type="button"
                className="btn-primary"
                onClick={onLogout}
                style={{ border: "none", cursor: "pointer" }}
              >
                Изход
              </button>
            </>
          ) : (
            <Link to="/auth" className="btn-primary">
              Вход / Регистрация
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
