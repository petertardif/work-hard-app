// Mirrors Expo's implicit default (`babel-preset-expo`, which picks up
// `experiments.reactCompiler` from app.json on its own), so Metro behaves
// exactly as it did before this file existed. It is present because jest-expo
// needs a resolvable Babel config to parse React Native's Flow-typed internals.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
