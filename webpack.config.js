module.exports = {
    webpack: (config, options) => {
    config.resolve.fallback = {
      fs: false,
    }

    return config
  },
}