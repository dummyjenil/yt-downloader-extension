import React from "react";

interface HeaderProps {
  activeTab: "downloads" | "settings" | "history";
  setActiveTab: (tab: "downloads" | "settings" | "history") => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 40px",
        background: "rgba(255, 255, 255, 0.02)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.07)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 100
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: "#f43f5e",
            boxShadow: "0 0 12px #f43f5e"
          }}
        ></div>
        <span
          style={{
            fontSize: "20px",
            fontWeight: 800,
            background: "linear-gradient(135deg, #f43f5e 0%, #a78bfa 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.5px"
          }}
        >
          YTD Premium Dashboard
        </span>
      </div>

      <nav style={{ display: "flex", gap: "8px" }}>
        {[
          { id: "downloads", label: "Active Downloads" },
          { id: "settings", label: "Settings" },
          { id: "history", label: "History" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              background: activeTab === tab.id ? "rgba(139, 92, 246, 0.15)" : "transparent",
              border: activeTab === tab.id ? "1px solid rgba(139, 92, 246, 0.3)" : "1px solid transparent",
              color: activeTab === tab.id ? "#c084fc" : "#a1a1aa",
              padding: "8px 16px",
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
};
