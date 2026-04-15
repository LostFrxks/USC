module.exports = function (api) {
  const isTest = api.env("test");
  api.cache.using(() => isTest);

  const plugins = [
    [
      "module-resolver",
      {
        alias: {
          "@": "./src",
        },
      },
    ],
  ];

  return {
    presets: isTest ? ["babel-preset-expo"] : ["babel-preset-expo", "nativewind/babel"],
    plugins,
  };
};
