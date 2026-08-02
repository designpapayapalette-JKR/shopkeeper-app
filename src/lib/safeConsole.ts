// Hermes' console.error/warn interceptor (used by LogBox's stack-trace
// parser) has a known bug where a sufficiently large or complex logged
// value overflows its internal regex backtracking stack and throws
// RangeError: "Maximum regex stack depth reached" — see
// https://github.com/facebook/hermes/issues/581 and
// https://github.com/facebook/react-native/issues/29402. That throw happens
// synchronously inside the console.error() call itself, so if it's called
// from inside a catch block, the ORIGINAL error is replaced by this one —
// every caller up the chain ends up seeing "Maximum regex stack depth
// reached" instead of whatever actually went wrong.
//
// Import this once, as early as possible (top of app/_layout.tsx) — it
// wraps the native console methods so a crash inside them degrades to a
// plain, truncated log instead of throwing into application code.
const original = { error: console.error, warn: console.warn };

function safeArg(a: unknown): unknown {
  if (a instanceof Error) return a.message;
  if (typeof a === "string" && a.length > 2000) return a.slice(0, 2000) + "…[truncated]";
  return a;
}

function wrap(name: "error" | "warn") {
  const fn = original[name];
  console[name] = (...args: unknown[]) => {
    try {
      fn(...args.map(safeArg));
    } catch {
      try {
        fn(`[console.${name} suppressed — logging itself threw]`);
      } catch {
        // Nothing left to fall back to.
      }
    }
  };
}

wrap("error");
wrap("warn");
