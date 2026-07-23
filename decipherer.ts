// Fallback signature decipherer for YouTube WEB client streams

interface DecipherStep {
  op: "reverse" | "splice" | "swap"
  arg: number
}

export function decipherSignature(sig: string, jsCode: string): string {
  try {
    // Find the main signature deciphering function
    const match = jsCode.match(
      /([a-zA-Z0-9_$]+)\s*=\s*function\s*\(\s*([a-zA-Z0-9_$]+)\s*\)\s*{\s*\2\s*=\s*\2\.split\(\s*""\s*\)\s*;([\s\S]+?)\s*return\s+\2\.join\(\s*""\s*\)/
    )
    if (!match) {
      console.warn("Could not find signature function in base.js")
      return sig
    }

    const statementsStr = match[3]

    // Find the helper object name (e.g. "w8")
    const helperNameMatch = statementsStr.match(
      /([a-zA-Z0-9_$]+)\.[a-zA-Z0-9_$]+\(/
    )
    if (!helperNameMatch) {
      console.warn("Could not find helper object name")
      return sig
    }
    const helperName = helperNameMatch[1]

    // Find the helper object body
    const helperObjRegex = new RegExp(
      `(?:var\\s+)?${helperName}\\s*=\\s*\\{([\\s\\S]+?)\\};`
    )
    const helperObjMatch = jsCode.match(helperObjRegex)
    if (!helperObjMatch) {
      console.warn("Could not find helper object body")
      return sig
    }
    const helperObjBody = helperObjMatch[1]

    // Parse helper methods
    const methods: { [key: string]: "reverse" | "splice" | "swap" } = {}
    const methodMatches = helperObjBody.matchAll(
      /([a-zA-Z0-9_$]+)\s*:\s*function\s*\(([^)]*)\)\s*\{([^}]+)\}/g
    )

    for (const mm of methodMatches) {
      const name = mm[1]
      const body = mm[3]
      if (body.includes("reverse")) {
        methods[name] = "reverse"
      } else if (body.includes("splice")) {
        methods[name] = "splice"
      } else {
        methods[name] = "swap"
      }
    }

    // Parse statements
    const steps: DecipherStep[] = []
    const stmtMatches = statementsStr.matchAll(
      new RegExp(`${helperName}\\.([a-zA-Z0-9_$]+)\\(\\w+,\\s*(\\d+)\\)`, "g")
    )

    for (const sm of stmtMatches) {
      const methodName = sm[1]
      const arg = parseInt(sm[2], 10)
      const op = methods[methodName]
      if (op) {
        steps.push({ op, arg })
      }
    }

    // Apply steps
    const arr = sig.split("")
    for (const step of steps) {
      if (step.op === "reverse") {
        arr.reverse()
      } else if (step.op === "splice") {
        arr.splice(0, step.arg)
      } else if (step.op === "swap") {
        const temp = arr[0]
        arr[0] = arr[step.arg]
        arr[step.arg] = temp
      }
    }
    return arr.join("")
  } catch (error) {
    console.error("Error during signature deciphering:", error)
    return sig
  }
}
