import React, { useState } from "react";
import { themeColors, themeStyles } from "../styles/theme";

interface UrlFormProps {
  urlInput: string;
  setUrlInput: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}

export const UrlForm: React.FC<UrlFormProps> = ({
  urlInput,
  setUrlInput,
  onSubmit,
  loading
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const inputStyle: React.CSSProperties = {
    ...themeStyles.input,
    borderColor: isFocused 
      ? "rgba(139, 92, 246, 0.5)" 
      : isHovered 
        ? "rgba(255, 255, 255, 0.15)" 
        : themeColors.border,
    boxShadow: isFocused ? "0 0 0 2px rgba(139, 92, 246, 0.15)" : "none"
  };

  const buttonStyle: React.CSSProperties = {
    ...themeStyles.button,
    opacity: loading ? 0.7 : 1,
    cursor: loading ? "not-allowed" : "pointer"
  };

  return (
    <form onSubmit={onSubmit} style={themeStyles.inputForm}>
      <input
        type="text"
        placeholder="Paste YouTube Link..."
        value={urlInput}
        onChange={(e) => setUrlInput(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={inputStyle}
        disabled={loading}
      />
      <button 
        type="submit" 
        style={buttonStyle}
        disabled={loading}
      >
        {loading ? "..." : "Fetch"}
      </button>
    </form>
  );
};
