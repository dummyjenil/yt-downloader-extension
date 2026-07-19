import { describe, expect, it } from "vitest";
import { getThemeConfig, themes, type ThemeId } from "./themeConfig";

describe("Theme Configuration Unit Tests", () => {
  it("should contain definitions for glassmorphism, neobrutalism, material, and default themes", () => {
    expect(themes.glassmorphism).toBeDefined();
    expect(themes.neobrutalism).toBeDefined();
    expect(themes.material).toBeDefined();
    expect(themes.default).toBeDefined();
  });

  it("should retrieve proper theme by ID using getThemeConfig", () => {
    const neo = getThemeConfig("neobrutalism");
    expect(neo.id).toBe("neobrutalism");
    expect(neo.name).toBe("Neobrutalism");
    expect(neo.primaryBtn).toContain("bg-[#4ade80]");

    const mat = getThemeConfig("material");
    expect(mat.id).toBe("material");
    expect(mat.name).toBe("Material Theme");
  });

  it("should fallback gracefully to glassmorphism if theme ID is invalid or undefined", () => {
    const fallback1 = getThemeConfig(undefined);
    expect(fallback1.id).toBe("glassmorphism");

    const fallback2 = getThemeConfig("non_existent_theme");
    expect(fallback2.id).toBe("glassmorphism");
  });

  it("should ensure all theme configurations have mandatory style fields", () => {
    const themeKeys: ThemeId[] = ["glassmorphism", "neobrutalism", "material", "default"];
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
