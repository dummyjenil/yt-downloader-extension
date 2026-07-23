import { describe, expect, it } from "vitest"

import { decipherSignature } from "./decipherer"

describe("Decipherer Service", () => {
  it("should decipher signature using reverse, splice, and swap ops", () => {
    // Mock base.js signature function pattern matching Youtube signature deciphering logic
    const mockJsCode = `
      var w8 = {
        aa: function(a) { a.reverse() },
        bb: function(a, b) { a.splice(0, b) },
        cc: function(a, b) { var c = a[0]; a[0] = a[b]; a[b] = c }
      };
      var decipherFunc = function(a) {
        a = a.split("");
        w8.aa(a, 0);
        w8.bb(a, 2);
        w8.cc(a, 3);
        return a.join("");
      };
    `

    const rawSignature = "ABCDEFGHIJ"
    const result = decipherSignature(rawSignature, mockJsCode)
    expect(result).not.toBe(rawSignature)
    expect(typeof result).toBe("string")
  })

  it("should fallback safely to original signature if decipher function is not found", () => {
    const rawSignature = "ABCDEFGHIJ"
    const result = decipherSignature(rawSignature, "invalid js code")
    expect(result).toBe(rawSignature)
  })
})
