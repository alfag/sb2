// Configurazione ESLint 10 (flat config) per SharingBeer 2.0
import js from "@eslint/js";

export default [
  // Regole base raccomandate
  js.configs.recommended,

  // Configurazione globale
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        // Node.js globals
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        setImmediate: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      // Regole base per il progetto
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_|^next$|^req$|^res$" }],
      "no-console": "off",
      "no-undef": "error",
      "no-constant-condition": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "prefer-const": "warn",
      "no-var": "warn",
    },
  },

  // Ignora cartelle non rilevanti
  {
    ignores: [
      "node_modules/**",
      "public/js/libs/**",
      "public/css/libs/**",
      "public/webfonts/**",
      "public/webfonts_backup/**",
      "logs/**",
      "scripts/**",
      "test/**",
      "*.min.js",
    ],
  },
];
