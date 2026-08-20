let initialized = false;
type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

export function aosInit() {
  if (initialized || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  initialized = true;

  const initializeWhenIdle = () => {
    void import("aos").then(({ default: AOS }) => {
      AOS.init({ duration: 700, once: true });
    });
  };

  const requestIdleCallback = (window as IdleWindow).requestIdleCallback;
  if (requestIdleCallback) {
    requestIdleCallback(initializeWhenIdle, { timeout: 2000 });
  } else {
    globalThis.setTimeout(initializeWhenIdle, 1200);
  }
}
