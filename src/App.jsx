import { useCallback, useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";

import Header from "./components/Header";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";

// Pages
import Checkout from "./pages/Checkout";
import Doctors from "./pages/Doctors";
import DoctorDetails from "./pages/DoctorDetails";
import AdvancedSearch from "./pages/AdvancedSearch";
import Specialties from "./pages/Specialties";
import Clinics from "./pages/Clinics";
import Help from "./pages/Help";
import Contact from "./pages/Contact";
import Auth from "./pages/Auth";
import Appointments from "./pages/Appointments";
import NotFound from "./pages/NotFound";
import Home from "./pages/Home";
import Reviews from "./pages/Reviews";
import Profile from "./pages/Profile";

import { getCurrentUser, signOut } from "./services/authService";
import { fetchMyAppointmentsCount } from "./services/appointmentsService";

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);

  const refreshNotificationCount = useCallback(
    async (userId) => {
      const targetUserId = userId || authUser?.id;

      if (!targetUserId) {
        setNotificationCount(0);
        return;
      }

      try {
        const count = await fetchMyAppointmentsCount(targetUserId);
        setNotificationCount(count);
      } catch {
        setNotificationCount(0);
      }
    },
    [authUser?.id]
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      const user = await getCurrentUser();
      if (!cancelled) {
        setAuthUser(user);
        if (user?.id) {
          await refreshNotificationCount(user.id);
        }
      }
    }

    bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, [refreshNotificationCount]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshNotificationCount();
  }, [refreshNotificationCount]);

  const handleLogout = useCallback(async () => {
    await signOut();
    setAuthUser(null);
    setNotificationCount(0);
  }, []);

  return (
    <>
      {/* 🔥 Това оправя scroll-а */}
      <ScrollToTop />

      <Header
        authUser={authUser}
        onLogout={handleLogout}
        notificationCount={notificationCount}
      />

      <main style={{ minHeight: "70vh" }}>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/doctors" element={<Doctors />} />

          <Route
            path="/doctors/:id"
            element={
              <DoctorDetails
                authUser={authUser}
                onAppointmentCreated={refreshNotificationCount}
              />
            }
          />

          <Route path="/checkout" element={<Checkout authUser={authUser} />} />

          <Route path="/search" element={<AdvancedSearch />} />
          <Route path="/specialties" element={<Specialties />} />
          <Route path="/clinics" element={<Clinics />} />

          <Route path="/help" element={<Help />} />
          <Route path="/contact" element={<Contact />} />

          <Route
            path="/auth"
            element={<Auth authUser={authUser} onAuthChange={setAuthUser} />}
          />

          <Route
            path="/appointments"
            element={
              <Appointments
                authUser={authUser}
                onAppointmentsChanged={refreshNotificationCount}
              />
            }
          />

          <Route
            path="/profile"
            element={<Profile authUser={authUser} onAuthChange={setAuthUser} />}
          />

          <Route path="/reviews" element={<Reviews />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer />
    </>
  );
}
