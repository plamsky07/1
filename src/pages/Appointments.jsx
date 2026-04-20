import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteAppointment, fetchMyAppointments } from "../services/appointmentsService";
import { useToast } from "../context/ToastState";

function formatBgDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function Appointments({ authUser, onAppointmentsChanged }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    let cancelled = false;

    async function loadAppointments() {
      if (!authUser?.id) {
        setItems([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const data = await fetchMyAppointments(authUser.id);
        if (!cancelled) {
          setItems(data);
          await onAppointmentsChanged?.();
        }
      } catch (err) {
        if (!cancelled) {
          const text = err?.message || "Неуспешно зареждане на известията.";
          setError(text);
          showError(text);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadAppointments();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id, onAppointmentsChanged, showError]);

  const handleDelete = async (itemId) => {
    if (!authUser?.id) return;
    setActionError("");
    setDeletingId(String(itemId));

    try {
      await deleteAppointment(itemId, authUser.id);
      setItems((prev) => prev.filter((item) => String(item.id) !== String(itemId)));
      await onAppointmentsChanged?.();
      showSuccess("Часът беше премахнат.", { title: "Резервацията е обновена" });
    } catch (err) {
      const text = err?.message || "Неуспешно премахване на часа.";
      setActionError(text);
      showError(text);
    } finally {
      setDeletingId("");
    }
  };

  if (!authUser) {
    return (
      <div className="container" style={{ padding: "24px 0" }}>
        <h1>Известия</h1>
        <p style={{ color: "#555", marginTop: 10 }}>
          За да виждаш запазените си часове, <Link to="/auth" style={{ color: "#1d4ed8" }}>влез в профила си</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "24px 0" }}>
      <h1>Известия и запазени часове</h1>
      <p style={{ color: "#555", marginTop: 8 }}>
        Тук виждаш всички твои резервации, за кой лекар са, кога са и какви бележки си добавил.
      </p>

      {isLoading && <div style={{ marginTop: 16, color: "#666" }}>Зареждане...</div>}
      {!isLoading && error && <div style={{ marginTop: 16, color: "#b91c1c" }}>{error}</div>}

      {!isLoading && !error && items.length === 0 && (
        <div style={{ marginTop: 16, color: "#666" }}>
          Все още нямаш запазени часове.
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {actionError && <div style={{ color: "#b91c1c" }}>{actionError}</div>}
          {items.map((item) => (
            <article
              key={item.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 16,
                background: "#fff",
              }}
            >
              <h3 style={{ margin: 0, marginBottom: 8 }}>{item.doctorName}</h3>
              <p style={{ margin: 0, color: "#4b5563" }}>
                {item.specialty} • {item.clinicName}
              </p>
              <p style={{ marginTop: 8, marginBottom: 0, fontWeight: 600 }}>
                Час: {formatBgDate(item.appointmentDate)} • {item.appointmentTime}
              </p>
              <p style={{ marginTop: 6, marginBottom: 0 }}>
                За: <strong>{item.service}</strong>
              </p>
              <p style={{ marginTop: 6, marginBottom: 0, color: "#374151" }}>
                Бележка: {item.notes?.trim() ? item.notes : "Няма бележка"}
              </p>

              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === String(item.id)}
                  style={{
                    border: "1px solid #fecaca",
                    background: "#fff",
                    color: "#b91c1c",
                    borderRadius: 10,
                    padding: "8px 12px",
                    cursor: deletingId === String(item.id) ? "not-allowed" : "pointer",
                    opacity: deletingId === String(item.id) ? 0.7 : 1,
                  }}
                >
                  {deletingId === String(item.id) ? "Премахване..." : "Премахни"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
