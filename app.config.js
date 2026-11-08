const appJson = require('./app.json');

module.exports = ({ config }) => ({
  ...appJson.expo,
  ...config,
  android: {
    ...appJson.expo.android,
    ...config.android,
    config: {
      ...appJson.expo.android?.config,
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
  },
});
