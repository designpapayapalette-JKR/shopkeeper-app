// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // eslint-config-expo/flat references react-native/no-inline-styles,
      // but eslint-plugin-react-native isn't an installed dependency here
      // — every hit is "Definition for rule not found", not a real
      // finding. Off until that plugin is actually added.
      "react-native/no-inline-styles": "off",

      // eslint-plugin-react-hooks 7 added a "React Compiler readiness"
      // rule set that assumes React DOM + the Suspense-oriented data
      // patterns it's built around. Several of these don't hold for this
      // codebase: React Native's Animated API requires interpolating an
      // Animated.Value (a ref) directly in the render body — that's not
      // a bug, it's the API — and `useEffect(() => { loadX() }, [])` /
      // `useEffect(() => { fetchX().then(setY) }, [])` are the standard,
      // safe, pre-Suspense data-fetching pattern used throughout this
      // app (and most React code in the wild). Every single hit for
      // these three rules across ~30 files was one of those two shapes,
      // not an actual bug — turning them off here rather than rewriting
      // dozens of working screens to satisfy an overly strict rule set.
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
]);
