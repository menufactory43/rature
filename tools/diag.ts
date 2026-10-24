import { classer } from "../src/sim/gestures";
import { reconnaitre } from "../src/sim/glyphes";
const raw = "293,429 297,430 300,431 304,433 306,436 308,439 309,443 309,447 309,450 308,454 306,457 303,460 300,462 296,463 293,464 289,463 285,462 282,461 279,458 277,455 275,452 275,448 275,444 276,440 277,437 280,434 282,432 286,430 289,429 293,429";
const pts = raw.split(" ").map((s, i) => { const [x, y] = s.split(",").map(Number); return { x: x / 0.975, y: y / 0.975 - 60, t: i * 22 }; });
console.log(classer(pts), reconnaitre(pts));
