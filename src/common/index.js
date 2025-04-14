/* eslint-disable */
// scratch-vm/src/common/index.js
const environment = require('./environment');
const block = require('./block');
const legacy = require('./legacy');

module.exports = {
  ...environment,
  ...block,
  ...legacy
};