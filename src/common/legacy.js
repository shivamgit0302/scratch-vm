/* eslint-disable */
// scratch-vm/src/common/legacy.js
function legacy(info, options = {}) {
  const incrementalDevelopment = options.incrementalDevelopment || false;
  
  return {
    for: function() {
      return {
        legacyBlock: createLegacyBlocks(info),
        legacyExtension: () => config => config
      };
    }
  };
}

function createLegacyBlocks(info) {
  return {
    useModelBlock: () => ({
      opcode: 'useModelBlock',
      blockType: 'command',
      text: 'use model [URL]',
      arguments: {
        URL: {
          type: 'string',
          defaultValue: 'Paste URL here!'
        }
      }
    }),
    
    whenModelMatches: (menuConfig) => ({
      opcode: 'whenModelMatches',
      blockType: 'hat',
      text: 'when model matches [CLASS]',
      arguments: {
        CLASS: {
          type: 'string',
          menu: 'classMenu'
        }
      },
      ...menuConfig
    }),
    
    modelPrediction: () => ({
      opcode: 'modelPrediction',
      blockType: 'reporter',
      text: 'current prediction'
    }),
    
    modelMatches: (menuConfig) => ({
      opcode: 'modelMatches',
      blockType: 'Boolean',
      text: 'model matches [CLASS]',
      arguments: {
        CLASS: {
          type: 'string',
          menu: 'classMenu'
        }
      },
      ...menuConfig
    }),
    
    classConfidence: (menuConfig) => ({
      opcode: 'classConfidence',
      blockType: 'reporter',
      text: 'confidence for [CLASS]',
      arguments: {
        CLASS: {
          type: 'string',
          menu: 'classMenu'
        }
      },
      ...menuConfig
    }),
    
    videoToggle: (config) => ({
      opcode: 'videoToggle',
      blockType: 'command',
      text: 'turn video [STATE]',
      arguments: {
        STATE: {
          type: 'string',
          menu: 'videoMenu',
          defaultValue: 'on'
        }
      },
      ...config
    }),
    
    setVideoTransparency: () => ({
      opcode: 'setVideoTransparency',
      blockType: 'command',
      text: 'set video transparency to [TRANSPARENCY]',
      arguments: {
        TRANSPARENCY: {
          type: 'number',
          defaultValue: 50
        }
      }
    })
  };
}

module.exports = {
  legacy
};