import { chromium } from "playwright";

const out = process.argv[2];
const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: Number(process.env.W || 1440), height: Number(process.env.H || 810) },
  reducedMotion: process.argv[3] === "reduce" ? "reduce" : "no-preference",
  // DPR=1 hides any canvas-sizing bug, because a mis-sized buffer and the CSS
  // box happen to coincide there. Run at 1.25 to match a 125% display.
  deviceScaleFactor: Number(process.env.DPR || 1),
});
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
// The canvas must lay out at exactly the window size; anything larger is
// silently clipped at the right and bottom edges.
const fit = await page.evaluate(() => {
  const r = document.querySelector("canvas").getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), winW: innerWidth, winH: innerHeight };
});
if (fit.w !== fit.winW || fit.h !== fit.winH) {
  errors.push(`canvas ${fit.w}x${fit.h} != window ${fit.winW}x${fit.winH}`);
}

await page.screenshot({ path: out });
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no console errors");
await browser.close();
