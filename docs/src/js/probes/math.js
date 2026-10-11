/**
 * Floating point behaviour.
 *
 * Every browser implements IEEE 754 doubles, but not every engine evaluates
 * transcendental functions identically. The classic probe (from Peter
 * Eckersley's Panopticlick) evaluates a handful of inverse-trigonometric and
 * exponential expressions and reads back the full decimal expansion. JIT
 * paths, rounding routines and vectorisation use all show up here.
 *
 * Called "math" rather than "timing" because the signal is the *value*, not
 * the cost.
 */
const EXPRESSIONS = [
  "Math.acos(0.123)",
  "Math.acosh(1e-300)",
  "Math.asin(0.123)",
  "Math.asinh(1)",
  "Math.atan(1e-300)",
  "Math.atanh(0.5)",
  "Math.cbrt(0.5)",
  "Math.exp(1)",
  "Math.expm1(1)",
  "Math.log(10)",
  "Math.log1p(10)",
  "Math.sinh(1)",
  "Math.tanh(1)",
  "Math.cos(1e-300)",
  "Math.sin(1e-300)",
  "Math.tan(1e-300)",
  "Math.pow(Math.PI, -100)",
];

export const probe = {
  id: "math",
  label: "Floating point evaluation",
  family: "network",
  bits: 1.3,
  async run() {
    const results = {};
    for (const expr of EXPRESSIONS) {
      try {
        // eslint-disable-next-line no-eval
        results[expr] = String(eval(expr));
      } catch {
        results[expr] = "error";
      }
    }
    return results;
  },
};
