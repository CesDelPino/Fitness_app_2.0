// CDC 2000 Growth Chart Data for Pediatric BMI Percentile Calculation
// Uses LMS (Lambda-Mu-Sigma) method for ages 2-20 years (24-240 months)
// Format: Age in months -> [L, M, S]

type GrowthChartData = Record<number, [number, number, number]>;

const BOYS_DATA: GrowthChartData = {
  24: [-2.0632, 16.5753, 0.08236],
  36: [-1.8226, 15.9875, 0.08022],
  48: [-1.5263, 15.6393, 0.08123],
  60: [-1.2545, 15.4768, 0.08476],
  72: [-1.0354, 15.4884, 0.09023],
  84: [-0.8886, 15.6432, 0.09723],
  96: [-0.8202, 15.9296, 0.10547],
  108: [-0.8184, 16.3411, 0.11444],
  120: [-0.8806, 16.8727, 0.12358],
  132: [-1.0017, 17.5167, 0.13225],
  144: [-1.1671, 18.2586, 0.13997],
  156: [-1.3533, 19.0729, 0.14641],
  168: [-1.5335, 19.9221, 0.15153],
  180: [-1.6897, 20.7677, 0.15546],
  192: [-1.8134, 21.5824, 0.15846],
  204: [-1.9052, 22.3503, 0.16083],
  216: [-1.9705, 23.0666, 0.16281],
  228: [-2.0162, 23.7323, 0.16458],
};

const GIRLS_DATA: GrowthChartData = {
  24: [-1.3381, 16.2193, 0.08616],
  36: [-1.3703, 15.7403, 0.08733],
  48: [-1.3149, 15.5063, 0.09167],
  60: [-1.2145, 15.4516, 0.09846],
  72: [-1.0987, 15.5525, 0.10694],
  84: [-0.9916, 15.8047, 0.11636],
  96: [-0.9108, 16.2034, 0.12592],
  108: [-0.8676, 16.7434, 0.13498],
  120: [-0.8668, 17.4084, 0.14309],
  132: [-0.9035, 18.1738, 0.14996],
  144: [-0.9753, 19.0077, 0.15551],
  156: [-1.0738, 19.8728, 0.15987],
  168: [-1.1879, 20.7316, 0.16332],
  180: [-1.3059, 21.5526, 0.16616],
  192: [-1.4179, 22.3132, 0.16862],
  204: [-1.5176, 23.0027, 0.17086],
  216: [-1.6021, 23.6183, 0.17297],
  228: [-1.6719, 24.1631, 0.17501],
};

function interpolate(ageMonths: number, data: GrowthChartData): [number, number, number] {
  const ages = Object.keys(data).map(Number).sort((a, b) => a - b);

  let lowerAge = ages[0];
  let upperAge = ages[ages.length - 1];

  for (let i = 0; i < ages.length - 1; i++) {
    if (ageMonths >= ages[i] && ageMonths <= ages[i + 1]) {
      lowerAge = ages[i];
      upperAge = ages[i + 1];
      break;
    }
  }

  if (lowerAge === upperAge) return data[lowerAge];

  const ratio = (ageMonths - lowerAge) / (upperAge - lowerAge);
  const [L1, M1, S1] = data[lowerAge];
  const [L2, M2, S2] = data[upperAge];

  const L = L1 + (L2 - L1) * ratio;
  const M = M1 + (M2 - M1) * ratio;
  const S = S1 + (S2 - S1) * ratio;

  return [L, M, S];
}

function calculateZScore(bmi: number, L: number, M: number, S: number): number {
  if (L === 0) {
    return Math.log(bmi / M) / S;
  }
  return (Math.pow(bmi / M, L) - 1) / (L * S);
}

function zScoreToPercentile(z: number): number {
  if (z < -6.5) return 0.0;
  if (z > 6.5) return 1.0;

  const factK = 1 / Math.sqrt(2 * Math.PI);
  const term = 1 / (1 + 0.2316419 * Math.abs(z));
  const k = factK * Math.exp(-0.5 * z * z);

  const a1 = 0.319381530;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;

  const sum = term * (a1 + term * (a2 + term * (a3 + term * (a4 + term * a5))));

  if (z >= 0) return 1 - k * sum;
  return k * sum;
}

export type PediatricBMICategory = "Underweight" | "Healthy Weight" | "Overweight" | "Obese";

export interface PediatricBMIResult {
  bmi: number;
  percentile: number;
  category: PediatricBMICategory;
  zScore: number;
  isSupportedAge: boolean;
  ageMonths: number;
}

export function calculateAgeInMonths(birthdate: string, measurementDate?: Date): number {
  const birth = new Date(birthdate);
  const measure = measurementDate || new Date();

  const years = measure.getFullYear() - birth.getFullYear();
  const months = measure.getMonth() - birth.getMonth();
  const days = measure.getDate() - birth.getDate();

  let totalMonths = years * 12 + months;
  if (days < 0) {
    totalMonths -= 1;
  }

  return totalMonths;
}

export function calculateAgeInYears(birthdate: string, measurementDate?: Date): number {
  const birth = new Date(birthdate);
  const measure = measurementDate || new Date();

  let age = measure.getFullYear() - birth.getFullYear();
  const monthDiff = measure.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && measure.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

export function calculatePediatricBMI(
  weightKg: number,
  heightCm: number,
  birthdate: string,
  gender: string | null | undefined,
  measurementDate?: Date
): PediatricBMIResult | null {
  // Require valid gender to calculate percentile
  if (gender !== "M" && gender !== "F") {
    return null;
  }
  
  // Require valid height and weight
  if (heightCm <= 0 || weightKg <= 0) {
    return null;
  }
  
  const isMale = gender === "M";
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  const ageMonths = calculateAgeInMonths(birthdate, measurementDate);

  const MIN_AGE_MONTHS = 24;
  const MAX_AGE_MONTHS = 228;

  if (ageMonths < MIN_AGE_MONTHS || ageMonths > MAX_AGE_MONTHS) {
    return {
      bmi: parseFloat(bmi.toFixed(1)),
      percentile: 0,
      category: "Healthy Weight",
      zScore: 0,
      isSupportedAge: false,
      ageMonths,
    };
  }

  const chartData = isMale ? BOYS_DATA : GIRLS_DATA;
  const [L, M, S] = interpolate(ageMonths, chartData);

  const zScore = calculateZScore(bmi, L, M, S);
  const percentileRaw = zScoreToPercentile(zScore);
  const percentile = percentileRaw * 100;

  let category: PediatricBMICategory = "Healthy Weight";
  if (percentile < 5) {
    category = "Underweight";
  } else if (percentile >= 85 && percentile < 95) {
    category = "Overweight";
  } else if (percentile >= 95) {
    category = "Obese";
  }

  return {
    bmi: parseFloat(bmi.toFixed(1)),
    percentile: parseFloat(percentile.toFixed(1)),
    category,
    zScore: parseFloat(zScore.toFixed(2)),
    isSupportedAge: true,
    ageMonths,
  };
}

export function shouldUsePediatricBMI(birthdate: string, measurementDate?: Date): boolean {
  const ageYears = calculateAgeInYears(birthdate, measurementDate);
  return ageYears >= 2 && ageYears < 19;
}

export function shouldShowBMIGauge(birthdate: string, measurementDate?: Date): boolean {
  const ageYears = calculateAgeInYears(birthdate, measurementDate);
  return ageYears >= 2;
}
