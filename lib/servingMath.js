/** @type {Array<keyof Nutrition>} */
const NUTRITION_FIELDS = ["calories", "protein", "carbs", "fat"];

const COMMON_FRACTIONS = Object.freeze([
  { value: 1 / 8, label: "1/8" },
  { value: 1 / 6, label: "1/6" },
  { value: 1 / 4, label: "1/4" },
  { value: 1 / 3, label: "1/3" },
  { value: 1 / 2, label: "1/2" },
  { value: 2 / 3, label: "2/3" },
  { value: 3 / 4, label: "3/4" },
]);

const FRACTION_SNAP_TOLERANCE = 0.01;

/**
 * @typedef {object} Nutrition
 * @property {number} calories
 * @property {number} protein
 * @property {number} carbs
 * @property {number} fat
 */

/**
 * @param {number} value
 */
export const roundNutritionValue = (value) => Math.round(value * 10) / 10;

/**
 * @param {Nutrition} nutrition
 * @returns {Nutrition}
 */
export function roundNutrition(nutrition) {
  return {
    calories: roundNutritionValue(nutrition.calories),
    protein: roundNutritionValue(nutrition.protein),
    carbs: roundNutritionValue(nutrition.carbs),
    fat: roundNutritionValue(nutrition.fat),
  };
}

/**
 * @param {unknown} nutrition
 * @param {keyof Nutrition} field
 */
const getNutritionValue = (nutrition, field) => {
  if (!nutrition || typeof nutrition !== "object") {
    return 0;
  }

  const value = /** @type {Partial<Nutrition>} */ (nutrition)[field];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

/**
 * @param {unknown} servings
 */
export function toValidServings(servings) {
  const value = Number(servings);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * @param {unknown} originalServings
 * @param {unknown} targetServings
 */
export function getServingMultiplier(originalServings, targetServings) {
  const original = toValidServings(originalServings);
  const target = toValidServings(targetServings);

  if (original === null || target === null) {
    return null;
  }

  return target / original;
}

/**
 * @param {Nutrition} nutrition
 * @param {number} multiplier
 * @returns {Nutrition}
 */
export function multiplyNutrition(nutrition, multiplier) {
  /** @type {Nutrition} */
  const scaledNutrition = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };

  for (const field of NUTRITION_FIELDS) {
    scaledNutrition[field] = getNutritionValue(nutrition, field) * multiplier;
  }

  return roundNutrition(scaledNutrition);
}

/**
 * @param {Nutrition} nutrition
 * @param {number} servings
 * @returns {Nutrition}
 */
export function divideNutrition(nutrition, servings) {
  const validServings = toValidServings(servings);

  if (validServings === null) {
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
  }

  return roundNutrition({
    calories: getNutritionValue(nutrition, "calories") / validServings,
    protein: getNutritionValue(nutrition, "protein") / validServings,
    carbs: getNutritionValue(nutrition, "carbs") / validServings,
    fat: getNutritionValue(nutrition, "fat") / validServings,
  });
}

/**
 * @param {Nutrition} totalNutrition
 * @param {unknown} originalServings
 * @param {unknown} targetServings
 */
export function scaleNutritionForServings(
  totalNutrition,
  originalServings,
  targetServings,
) {
  const multiplier = getServingMultiplier(originalServings, targetServings);
  const target = toValidServings(targetServings);

  if (multiplier === null || target === null) {
    const total = roundNutrition(totalNutrition);
    return {
      total,
      perServing: divideNutrition(
        total,
        toValidServings(originalServings) ?? 0,
      ),
    };
  }

  const total = multiplyNutrition(totalNutrition, multiplier);

  return {
    total,
    perServing: divideNutrition(total, target),
  };
}

/**
 * @param {unknown} amount
 * @returns {{ parsed: true, value: number } | { parsed: false, value: null }}
 */
export function parseScalableAmount(amount) {
  if (typeof amount === "number") {
    return Number.isFinite(amount)
      ? { parsed: true, value: amount }
      : { parsed: false, value: null };
  }

  if (typeof amount !== "string") {
    return { parsed: false, value: null };
  }

  const normalizedAmount = amount.trim();

  if (!normalizedAmount) {
    return { parsed: false, value: null };
  }

  if (/^\d+(?:\.\d+)?$/.test(normalizedAmount)) {
    return { parsed: true, value: Number(normalizedAmount) };
  }

  const fractionMatch = normalizedAmount.match(/^(\d+)\/(\d+)$/);

  if (!fractionMatch) {
    return { parsed: false, value: null };
  }

  const numerator = Number(fractionMatch[1]);
  const denominator = Number(fractionMatch[2]);

  if (denominator === 0) {
    return { parsed: false, value: null };
  }

  return { parsed: true, value: numerator / denominator };
}

/**
 * @param {number} value
 */
function formatDecimalAmount(value) {
  if (value !== 0 && Math.abs(value) < 0.01) {
    return Number(value.toPrecision(2)).toString();
  }

  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

/**
 * @param {number} value
 */
export function formatScaledAmount(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  const whole = Math.trunc(value);
  const remainder = Math.abs(value - whole);
  const nearestFraction = COMMON_FRACTIONS.find(
    (fraction) =>
      Math.abs(remainder - fraction.value) <= FRACTION_SNAP_TOLERANCE,
  );

  if (!nearestFraction) {
    return formatDecimalAmount(value);
  }

  if (whole === 0) {
    return nearestFraction.label;
  }

  return `${whole} ${nearestFraction.label}`;
}

/**
 * @param {unknown} amount
 * @param {number} multiplier
 */
export function scaleIngredientAmount(amount, multiplier) {
  const parsedAmount = parseScalableAmount(amount);

  if (!parsedAmount.parsed || !Number.isFinite(multiplier)) {
    return typeof amount === "number" ? String(amount) : String(amount ?? "");
  }

  return formatScaledAmount(parsedAmount.value * multiplier);
}
