/* eslint-disable */
function buttonBlock(text) {
  return function(target, propertyKey, descriptor) {
    if (!target._blocks) {
      target._blocks = [];
    }
    target._blocks.push({
      opcode: propertyKey,
      text,
      blockType: 'command'
    });
    return descriptor;
  };
}

function extension(config, features) {
  return function(constructor) {
    constructor.prototype.getInfo = function() {
      return {
        ...config,
        blocks: this._blocks || [],
        menus: this._menus || {}
      };
    };
    return constructor;
  };
}

module.exports = {
  buttonBlock,
  extension
};