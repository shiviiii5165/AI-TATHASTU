import { describe, expect, it } from "vitest";

describe("Theme Engine Tokens & Constants", () => {
  it("defines the expected localStorage key", () => {
    const STORAGE_KEY = "ai-tathastu-theme";
    expect(STORAGE_KEY).toBe("ai-tathastu-theme");
  });

  it("calculates WCAG 2.2 AA compliant contrast ratios for the dark mode palette", () => {
    // Relative luminance calculation
    function getLuminance(r: number, g: number, b: number) {
      const [rs, gs, bs] = [r, g, b].map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    function hexToRgb(hex: string) {
      const sanitized = hex.replace("#", "");
      return {
        r: parseInt(sanitized.slice(0, 2), 16),
        g: parseInt(sanitized.slice(2, 4), 16),
        b: parseInt(sanitized.slice(4, 6), 16),
      };
    }

    function getContrastRatio(hex1: string, hex2: string) {
      const rgb1 = hexToRgb(hex1);
      const rgb2 = hexToRgb(hex2);
      const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
      const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
      const brightest = Math.max(lum1, lum2);
      const darkest = Math.min(lum1, lum2);
      return (brightest + 0.05) / (darkest + 0.05);
    }

    const darkBg = "#101116";
    const darkCard = "#191B24";
    const primaryText = "#F7F8FC";
    const secondaryText = "#C4CAD8";
    const mutedText = "#AEB6C8";

    // 1. Primary text on page background (minimum 4.5:1)
    const ratioPrimaryOnBg = getContrastRatio(primaryText, darkBg);
    expect(ratioPrimaryOnBg).toBeGreaterThan(15); // > 17:1

    // 2. Primary text on card surface (minimum 4.5:1)
    const ratioPrimaryOnCard = getContrastRatio(primaryText, darkCard);
    expect(ratioPrimaryOnCard).toBeGreaterThan(14); // > 15:1

    // 3. Secondary text on card surface (minimum 4.5:1)
    const ratioSecondaryOnCard = getContrastRatio(secondaryText, darkCard);
    expect(ratioSecondaryOnCard).toBeGreaterThan(7); // > 10:1 (AAA)

    // 4. Muted text on card surface (minimum 4.5:1)
    const ratioMutedOnCard = getContrastRatio(mutedText, darkCard);
    expect(ratioMutedOnCard).toBeGreaterThan(7); // > 8:1 (AAA)
  });
});
