// Xano Studio's starter page: an empty outline of an app.
// Replace it with your app.

const css = "\n.xs-page {\n  --xs-bg: #f6f7f9;\n  --xs-surface: #ffffff;\n  --xs-outline: #c9ced8;\n  --xs-line: #eef0f3;\n  --xs-block: #eceef2;\n  --xs-card: #f3f4f7;\n  --xs-text: #111318;\n  --xs-muted: #5c6270;\n  --xs-shadow: rgba(17, 19, 24, 0.08);\n  --xs-live: #2fb574;\n  min-height: 100vh;\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n  padding: 24px;\n  box-sizing: border-box;\n  background: var(--xs-bg);\n  color: var(--xs-text);\n  font-family: ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif;\n}\n@media (prefers-color-scheme: dark) {\n  .xs-page {\n    --xs-bg: #0e0f12;\n    --xs-surface: #16181d;\n    --xs-outline: #3a3f4a;\n    --xs-line: #23262d;\n    --xs-block: #262a32;\n    --xs-card: #1d2026;\n    --xs-text: #f2f3f5;\n    --xs-muted: #a0a6b3;\n    --xs-shadow: rgba(0, 0, 0, 0.4);\n    --xs-live: #3ccf8e;\n  }\n}\n.xs-outline {\n  position: relative;\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  border: 2px dashed var(--xs-outline);\n  border-radius: 16px;\n  background: var(--xs-surface);\n}\n.xs-nav, .xs-body { opacity: 0.7; }\n.xs-nav { display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 18px; border-bottom: 1px solid var(--xs-line); }\n.xs-body { flex: 1; display: flex; gap: 20px; padding: 22px; }\n.xs-side { width: 20%; display: flex; flex-direction: column; gap: 12px; }\n.xs-main { flex: 1; display: flex; flex-direction: column; gap: 16px; }\n.xs-cards { display: flex; gap: 16px; }\n.xs-bar { display: block; height: 12px; border-radius: 6px; background: var(--xs-block); }\n.xs-card { flex: 1; height: 88px; border-radius: 12px; background: var(--xs-card); }\n.xs-wide { height: 160px; }\n.xs-center {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 24px;\n}\n.xs-card-text {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 10px;\n  max-width: 28rem;\n  padding: 24px 28px;\n  border: 1px solid var(--xs-line);\n  border-radius: 14px;\n  background: var(--xs-surface);\n  box-shadow: 0 8px 28px var(--xs-shadow);\n  text-align: center;\n}\n.xs-pill {\n  margin: 0;\n  padding: 4px 12px;\n  border: 1px solid var(--xs-outline);\n  border-radius: 999px;\n  background: var(--xs-surface);\n  font-size: 13px;\n  color: var(--xs-muted);\n}\n.xs-title { margin: 0; font-size: clamp(26px, 4vw, 36px); font-weight: 650; letter-spacing: -0.02em; }\n.xs-line { margin: 0; font-size: 16px; line-height: 1.5; color: var(--xs-muted); }\n.xs-status { display: flex; justify-content: space-between; gap: 16px; font-size: 13px; color: var(--xs-muted); }\n.xs-live { display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 50%; background: var(--xs-live); }\n@media (max-width: 640px) {\n  .xs-side { display: none; }\n  .xs-cards .xs-card:nth-child(n + 2) { display: none; }\n  .xs-share { display: none; }\n}\n";

export default function App() {
  return (
    <main className="xs-page">
      <style>{css}</style>
      <div className="xs-outline">
        <div className="xs-nav" aria-hidden="true">
          <span className="xs-bar" style={{ width: 72 }} />
          <span className="xs-bar" style={{ width: 44, marginLeft: "auto" }} />
          <span className="xs-bar" style={{ width: 44 }} />
        </div>
        <div className="xs-body" aria-hidden="true">
          <div className="xs-side">
            <span className="xs-bar" />
            <span className="xs-bar" style={{ width: "70%" }} />
            <span className="xs-bar" style={{ width: "85%" }} />
            <span className="xs-bar" style={{ width: "60%" }} />
          </div>
          <div className="xs-main">
            <span className="xs-bar" style={{ width: "40%", height: 16 }} />
            <div className="xs-cards">
              <span className="xs-card" />
              <span className="xs-card" />
              <span className="xs-card" />
            </div>
            <span className="xs-card xs-wide" />
          </div>
        </div>
        <div className="xs-center">
          <div className="xs-card-text">
            {/* The agent rewrites this pill to say what it is setting up. */}
            <p className="xs-pill">Nothing built yet</p>
            <h1 className="xs-title">{"New app"}</h1>
            <p className="xs-line">
              Your app will appear here as the agent builds it.
            </p>
          </div>
        </div>
      </div>
      <footer className="xs-status">
        <span>
          <span className="xs-live" />
          Running on this computer
        </span>
        <span className="xs-share">Share or Publish to show others</span>
      </footer>
    </main>
  );
}
