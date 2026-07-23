import { describe, expect, it } from "vitest";
import { getThemeConfig, themes, type ThemeId } from "./themeConfig";

describe("Theme Configuration Unit Tests", () => {
  it("should contain definitions for all available themes", () => {
    expect(themes.glassmorphism).toBeDefined();
    expect(themes.neobrutalism).toBeDefined();
    expect(themes.material).toBeDefined();
    expect(themes.default).toBeDefined();
    expect(themes.cyberpunk).toBeDefined();
    expect(themes.nordic).toBeDefined();
    expect(themes.emerald).toBeDefined();
    expect(themes.sunset).toBeDefined();
    expect(themes.dracula).toBeDefined();
    expect(themes.retro).toBeDefined();
    expect(themes.terminal).toBeDefined();
    expect(themes.synthwave).toBeDefined();
    expect(themes.claymorphism).toBeDefined();
    expect(themes.parchment).toBeDefined();
    expect(themes.oled).toBeDefined();
    expect(themes.win95).toBeDefined();
  });

  it("should retrieve proper theme by ID using getThemeConfig", () => {
    const neo = getThemeConfig("neobrutalism");
    expect(neo.id).toBe("neobrutalism");
    expect(neo.name).toBe("Neobrutalism");
    expect(neo.primaryBtn).toContain("bg-[#4ade80]");

    const mat = getThemeConfig("material");
    expect(mat.id).toBe("material");
    expect(mat.name).toBe("Material Theme");

    const cyberpunk = getThemeConfig("cyberpunk");
    expect(cyberpunk.id).toBe("cyberpunk");
    expect(cyberpunk.name).toBe("Cyberpunk Neon");

    const terminal = getThemeConfig("terminal");
    expect(terminal.id).toBe("terminal");
    expect(terminal.name).toBe("Hacker Terminal CLI");
    expect(terminal.container).toContain("font-mono");

    const win95 = getThemeConfig("win95");
    expect(win95.id).toBe("win95");
    expect(win95.name).toBe("Classic Retro Windows 95");
  });

  it("should fallback gracefully to glassmorphism if theme ID is invalid or undefined", () => {
    const fallback1 = getThemeConfig(undefined);
    expect(fallback1.id).toBe("glassmorphism");

    const fallback2 = getThemeConfig("non_existent_theme");
    expect(fallback2.id).toBe("glassmorphism");
  });

  it("should ensure all theme configurations have mandatory style fields", () => {
    const themeKeys: ThemeId[] = [
      "glassmorphism",
      "neobrutalism",
      "material",
      "default",
      "cyberpunk",
      "nordic",
      "emerald",
      "sunset",
      "dracula",
      "retro",
      "terminal",
      "synthwave",
      "claymorphism",
      "parchment",
      "oled",
      "win95"
    ];
    themeKeys.forEach((key) => {
      const theme = themes[key];
      expect(theme.container).toBeTruthy();
      expect(theme.card).toBeTruthy();
      expect(theme.input).toBeTruthy();
      expect(theme.navContainer).toBeTruthy();
      expect(theme.navTabActive).toBeTruthy();
      expect(theme.primaryBtn).toBeTruthy();
      expect(theme.secondaryBtn).toBeTruthy();
      expect(theme.dangerBtn).toBeTruthy();
    });
  });
});
