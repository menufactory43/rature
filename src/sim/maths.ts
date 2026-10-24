// Des fonctions mathématiques qui donnent le même résultat au bit près sur tous les navigateurs. Math.sin, Math.atan2
// ou Math.hypot peuvent différer d'un moteur à l'autre (Chrome, Safari) sur le dernier chiffre : en coop, chaque
// appareil fait tourner la même partie de son côté, et le moindre écart finirait par la faire diverger. Ici, seulement
// des additions, des multiplications, des divisions et la racine carrée, que la norme IEEE impose exactes.

const PI = 3.141592653589793;
const DEMI_PI = PI / 2;
const DEUX_PI = PI * 2;

export const hypot = (x: number, y: number): number => Math.sqrt(x * x + y * y);

/** Sinus et cosinus sur [-π/4, π/4], par leur développement (erreur sous 1e-15). */
function sinCourt(x: number): number {
  const x2 = x * x;
  return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800 + x2 / 6227020800))))));
}
function cosCourt(x: number): number {
  const x2 = x * x;
  return 1 + x2 * (-1 / 2 + x2 * (1 / 24 + x2 * (-1 / 720 + x2 * (1 / 40320 + x2 * (-1 / 3628800 + x2 * (1 / 479001600 - x2 / 87178291200))))));
}

/** Ramène x à r dans [-π/4, π/4] et au quart de tour q (x = r + q·π/2). */
function reduire(x: number): [number, number] {
  const k = Math.round(x / DEMI_PI);
  const r = x - k * DEMI_PI;
  return [r, ((k % 4) + 4) % 4];
}

export function sin(x: number): number {
  const [r, q] = reduire(x - Math.floor(x / DEUX_PI) * DEUX_PI);
  return q === 0 ? sinCourt(r) : q === 1 ? cosCourt(r) : q === 2 ? -sinCourt(r) : -cosCourt(r);
}

export function cos(x: number): number {
  const [r, q] = reduire(x - Math.floor(x / DEUX_PI) * DEUX_PI);
  return q === 0 ? cosCourt(r) : q === 1 ? -sinCourt(r) : q === 2 ? -cosCourt(r) : sinCourt(r);
}

/** Arc tangente sur [0, +∞[ : ramenée sous tan(π/8), puis la série (erreur sous 1e-12). */
function atanPositif(t: number): number {
  if (t > 1) return DEMI_PI - atanPositif(1 / t);
  if (t > 0.41421356237309503) return PI / 4 + atanPositif((t - 1) / (t + 1));
  if (t < 0) return -atanPositif(-t);
  const t2 = t * t;
  let terme = t;
  let somme = t;
  for (let n = 3; n <= 31; n += 2) {
    terme *= -t2;
    somme += terme / n;
  }
  return somme;
}

export function atan2(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  if (x > 0) return atanPositif(y / x);
  if (x < 0) return y >= 0 ? atanPositif(y / x) + PI : atanPositif(y / x) - PI;
  return y > 0 ? DEMI_PI : -DEMI_PI;
}
