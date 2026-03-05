import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchDoctorById } from "../services/doctorsService";
import { createAppointment } from "../services/appointmentsService";

export default function DoctorDetails({ authUser, onAppointmentCreated }) {
  const { id } = useParams();
  const [doctor, setDoctor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDoctor() {
      setIsLoading(true);
      setLoadError("");

      try {
        const data = await fetchDoctorById(id);
        if (!cancelled) {
          setDoctor(data);
          setSelectedSlot(data?.slots?.[0] || "");
          setSelectedService(data?.services?.[0] || "");
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          setAppointmentDate(tomorrow.toISOString().slice(0, 10));
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError("Възникна проблем при зареждане на профила.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadDoctor();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="container" style={{ padding: "24px 0" }}>
        <div style={{ color: "#666" }}>Зареждане на профил...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container" style={{ padding: "24px 0" }}>
        <h1 style={{ marginBottom: 12 }}>Профилът не може да бъде зареден</h1>
        <p style={{ color: "#b91c1c" }}>{loadError}</p>
        <Link to="/doctors" style={{ color: "#1d4ed8", textDecoration: "none", fontWeight: 700 }}>
          Към всички лекари
        </Link>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="container" style={{ padding: "24px 0" }}>
        <h1 style={{ marginBottom: 12 }}>Лекарят не е намерен</h1>
        <p style={{ color: "#555" }}>Възможно е профилът да е премахнат или адресът да е невалиден.</p>
        <Link to="/doctors" style={{ color: "#1d4ed8", textDecoration: "none", fontWeight: 700 }}>
          Към всички лекари
        </Link>
      </div>
    );
  }

  const handleBook = async () => {
    setBookingError("");
    setBookingMessage("");

    if (!authUser?.id) {
      setBookingError("Трябва да влезеш в профила си, за да запишеш час.");
      return;
    }

    if (!appointmentDate || !selectedSlot || !selectedService) {
      setBookingError("Избери дата, час и услуга.");
      return;
    }

    setBookingLoading(true);
    try {
      await createAppointment({
        userId: authUser.id,
        doctorId: String(doctor.id || ""),
        doctorName: doctor.name,
        specialty: doctor.specialty,
        clinicName: doctor.clinicName,
        appointmentDate,
        appointmentTime: selectedSlot,
        service: selectedService,
        notes: notes.trim(),
        patientName:
          authUser.user_metadata?.full_name ||
          [authUser.user_metadata?.first_name, authUser.user_metadata?.last_name]
            .filter(Boolean)
            .join(" ")
            .trim(),
        patientPhone: authUser.user_metadata?.phone || "",
        patientEmail: authUser.email || "",
      });

      setBookingMessage("Часът е запазен успешно.");
      setNotes("");
      await onAppointmentCreated?.();
    } catch (error) {
      setBookingError(error?.message || "Неуспешно записване на час.");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: "24px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
        <section style={{ border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
          <h1 style={{ margin: 0 }}>{doctor.name}</h1>
          <p style={{ marginTop: 8, color: "#555" }}>
            {doctor.specialty} • {doctor.city} • {doctor.clinicName}
          </p>

          <h3 style={{ marginTop: 16 }}>За лекаря</h3>
          <p style={{ color: "#444", lineHeight: 1.6 }}>{doctor.bio}</p>

          <h3 style={{ marginTop: 16 }}>Услуги</h3>
          <ul>
            {doctor.services.map((service) => (
              <li key={service}>{service}</li>
            ))}
          </ul>
        </section>

        <aside style={{ border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Запази час</h3>
          <p style={{ color: "#555", marginBottom: 10 }}>
            Избери удобен час и услуга. Може да добавиш бележка само за теб.
          </p>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", marginBottom: 6, color: "#374151" }}>Дата</label>
            <input
              type="date"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", marginBottom: 6, color: "#374151" }}>Услуга</label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            >
              {doctor.services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>

          <h4 style={{ marginTop: 12, marginBottom: 8 }}>Свободни часове</h4>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            {doctor.slots.map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => setSelectedSlot(time)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: selectedSlot === time ? "1px solid #1d4ed8" : "1px solid #ddd",
                  background: selectedSlot === time ? "#eff6ff" : "white",
                  cursor: "pointer",
                }}
              >
                {time}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", marginBottom: 6, color: "#374151" }}>Бележка (по желание)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Напр. Симптоми, въпроси към лекаря..."
              rows={3}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", resize: "vertical" }}
            />
          </div>

          {!authUser && (
            <p style={{ color: "#92400e", marginBottom: 10 }}>
              За да запишеш час, <Link to="/auth" style={{ color: "#1d4ed8" }}>влез в профила си</Link>.
            </p>
          )}

          <button
            type="button"
            disabled={bookingLoading}
            onClick={handleBook}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "none",
              background: "#1d4ed8",
              color: "#fff",
              cursor: bookingLoading ? "not-allowed" : "pointer",
              opacity: bookingLoading ? 0.75 : 1,
            }}
          >
            {bookingLoading ? "Запазване..." : "Запази час"}
          </button>

          {bookingError && <p style={{ color: "#b91c1c", marginTop: 10 }}>{bookingError}</p>}
          {bookingMessage && <p style={{ color: "#047857", marginTop: 10 }}>{bookingMessage}</p>}
        </aside>
      </div>
    </div>
  );
}
