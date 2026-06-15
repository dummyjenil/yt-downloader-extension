import type { CSSProperties } from "react";

export const themeColors = {
  bg: "linear-gradient(145deg, #09090b 0%, #121217 100%)",
  surface: "rgba(255, 255, 255, 0.03)",
  surfaceHover: "rgba(255, 255, 255, 0.06)",
  border: "rgba(255, 255, 255, 0.07)",
  borderFocus: "rgba(139, 92, 246, 0.4)",
  text: "#f4f4f5",
  textMuted: "#a1a1aa",
  accent: "linear-gradient(135deg, #f43f5e 0%, #8b5cf6 100%)",
  accentHover: "linear-gradient(135deg, #fb7185 0%, #a78bfa 100%)",
  success: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  error: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
  errorBg: "rgba(239, 68, 68, 0.06)",
  shadow: "0 12px 40px 0 rgba(0, 0, 0, 0.6)"
};

export const themeStyles: { [key: string]: CSSProperties } = {
  container: {
    width: "380px",
    minHeight: "480px",
    maxHeight: "600px",
    background: themeColors.bg,
    color: themeColors.text,
    fontFamily: "'Outfit', 'Inter', sans-serif",
    padding: "20px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    scrollbarWidth: "none"
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "20px"
  },
  logo: {
    fontSize: "18px",
    fontWeight: 700,
    background: themeColors.accent,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "-0.5px"
  },
  badge: {
    background: "rgba(139, 92, 246, 0.1)",
    color: "#a78bfa",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "10px",
    fontWeight: 600,
    border: "1px solid rgba(139, 92, 246, 0.2)",
    letterSpacing: "0.5px",
    textTransform: "uppercase"
  },
  inputForm: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px"
  },
  input: {
    flex: 1,
    background: "rgba(255, 255, 255, 0.03)",
    border: `1px solid ${themeColors.border}`,
    borderRadius: "12px",
    padding: "10px 14px",
    color: themeColors.text,
    fontSize: "13px",
    outline: "none",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    fontFamily: "'Outfit', 'Inter', sans-serif"
  },
  button: {
    background: themeColors.accent,
    border: "none",
    borderRadius: "12px",
    color: "#ffffff",
    padding: "10px 16px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(139, 92, 246, 0.2)",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
  },
  glassCard: {
    background: themeColors.surface,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: `1px solid ${themeColors.border}`,
    borderRadius: "16px",
    padding: "14px",
    marginBottom: "16px",
    boxShadow: themeColors.shadow
  },
  thumbnailWrapper: {
    position: "relative",
    borderRadius: "12px",
    overflow: "hidden",
    marginBottom: "12px",
    border: `1px solid ${themeColors.border}`
  },
  thumbnail: {
    width: "100%",
    display: "block"
  },
  durationBadge: {
    position: "absolute",
    bottom: "8px",
    right: "8px",
    background: "rgba(0, 0, 0, 0.75)",
    padding: "3px 7px",
    borderRadius: "6px",
    fontSize: "10px",
    fontWeight: 600,
    color: "#ffffff",
    letterSpacing: "0.2px"
  },
  title: {
    fontSize: "14px",
    fontWeight: 600,
    margin: "0 0 6px 0",
    lineHeight: "1.4",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  author: {
    fontSize: "11px",
    color: themeColors.textMuted,
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "4px"
  },
  tabs: {
    display: "flex",
    gap: "6px",
    marginBottom: "14px",
    background: "rgba(255, 255, 255, 0.02)",
    padding: "4px",
    borderRadius: "12px",
    border: `1px solid ${themeColors.border}`
  },
  streamList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  streamRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderRadius: "12px",
    background: "rgba(255, 255, 255, 0.015)",
    border: `1px solid ${themeColors.border}`,
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
  },
  streamInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flex: 1
  },
  streamLabel: {
    fontSize: "12px",
    fontWeight: 600,
    color: themeColors.text
  },
  streamMeta: {
    fontSize: "10px",
    color: themeColors.textMuted
  },
  downloadIcon: {
    background: "rgba(255, 255, 255, 0.03)",
    border: `1px solid ${themeColors.border}`,
    color: themeColors.text,
    borderRadius: "10px",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    padding: 0
  },
  errorText: {
    color: "#ef4444",
    fontSize: "12px",
    lineHeight: "1.5",
    padding: "12px",
    background: themeColors.errorBg,
    border: "1px solid rgba(239, 68, 68, 0.15)",
    borderRadius: "12px",
    marginTop: "10px"
  },
  statusText: {
    color: "#a78bfa",
    fontSize: "11px",
    textAlign: "center",
    margin: "8px 0 0 0",
    background: "rgba(139, 92, 246, 0.06)",
    border: "1px solid rgba(139, 92, 246, 0.1)",
    padding: "6px 12px",
    borderRadius: "8px"
  },
  progressBarContainer: {
    width: "100%",
    background: "rgba(255, 255, 255, 0.05)",
    borderRadius: "100px",
    height: "4px",
    overflow: "hidden",
    marginTop: "8px",
    border: `1px solid ${themeColors.border}`
  },
  progressBarFill: {
    height: "100%",
    background: themeColors.accent,
    borderRadius: "100px",
    transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
  },
  placeholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    padding: "40px 10px",
    textAlign: "center",
    color: themeColors.textMuted
  },
  loader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 0"
  },
  spinner: {
    width: "22px",
    height: "22px",
    border: "2.5px solid rgba(255, 255, 255, 0.05)",
    borderTop: "2.5px solid #a78bfa",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    marginBottom: "12px"
  }
};

export const getTabButtonStyle = (active: boolean): CSSProperties => ({
  flex: 1,
  background: active ? "rgba(255, 255, 255, 0.04)" : "transparent",
  border: active ? `1px solid ${themeColors.border}` : "1px solid transparent",
  borderRadius: "8px",
  color: active ? themeColors.text : themeColors.textMuted,
  padding: "6px 0",
  fontSize: "11px",
  fontWeight: 600,
  cursor: "pointer",
  textAlign: "center",
  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
});
