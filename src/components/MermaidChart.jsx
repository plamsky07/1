import { useEffect, useId, useState } from "react";

let isInitialized = false;
let mermaidModule = null;

async function getMermaid() {
  if (!mermaidModule) {
    const imported = await import("mermaid");
    mermaidModule = imported.default;
  }

  if (!isInitialized) {
    mermaidModule.initialize({
      startOnLoad: false,
      theme: "base",
      securityLevel: "loose",
      fontFamily: "Poppins, sans-serif",
      themeVariables: {
        primaryColor: "#d6fff8",
        primaryBorderColor: "#0d9488",
        primaryTextColor: "#0f172a",
        secondaryColor: "#ecfeff",
        tertiaryColor: "#f8fafc",
        lineColor: "#0f766e",
        textColor: "#0f172a",
        pie1: "#0f766e",
        pie2: "#14b8a6",
        pie3: "#38bdf8",
        pie4: "#f59e0b",
        pie5: "#f97316",
        pieStrokeColor: "#ffffff",
        xAxisLabelColor: "#334155",
        yAxisLabelColor: "#334155",
        plotColorPalette:
          "#0f766e,#14b8a6,#38bdf8,#0ea5e9,#f59e0b,#f97316,#fb7185",
      },
    });

    isInitialized = true;
  }

  return mermaidModule;
}

export default function MermaidChart({ chart, title, subtitle }) {
  const uniqueId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function renderChart() {
      if (!chart) {
        setSvg("");
        return;
      }

      try {
        const mermaid = await getMermaid();
        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-${uniqueId}-${Date.now()}`,
          chart
        );

        if (!cancelled) {
          setSvg(renderedSvg);
          setError("");
        }
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError?.message || "Неуспешно визуализиране на диаграмата.");
        }
      }
    }

    renderChart();

    return () => {
      cancelled = true;
    };
  }, [chart, uniqueId]);

  return (
    <section className="mermaid-chart-card">
      <div className="mermaid-chart-card__header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>

      {error ? (
        <div className="mermaid-chart-card__error">{error}</div>
      ) : (
        <div
          className="mermaid-chart-card__body"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </section>
  );
}
