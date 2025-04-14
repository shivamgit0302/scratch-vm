/* eslint-disable */
// scratch-vm/src/extensions/scratch3_teachablemachine/index.js
const formatMessage = require('format-message');
const BlockType = require('../../extension-support/block-type');
const ArgumentType = require('../../extension-support/argument-type');
const Cast = require('../../util/cast');
const Runtime = require('../../engine/runtime');

// Import only the image and pose models
const tmImage = require('@teachablemachine/image');
const tmPose = require('@teachablemachine/pose');

const VideoState = {
  OFF: 'off',
  ON: 'on',
  ON_FLIPPED: 'on-flipped'
};

class TeachableMachine {
  constructor(runtime) {
    this.runtime = runtime;
    
    this.lastUpdate = null;
    this.maxConfidence = null;
    this.modelConfidences = {};
    this.isPredicting = 0;
    this.predictionState = {};
    this.teachableImageModel = null;
    this.latestAudioResults = null;

    // Constants
    this.INTERVAL = 33;
    this.DIMENSIONS = [480, 360];
    
    this.ModelType = {
      POSE: 'pose',
      IMAGE: 'image',
      AUDIO: 'audio'
    };

    // Audio recognition state
    this.audioRecognitionActive = false;
    this.audioWorker = null;
  }

  getInfo() {
    return {
      id: 'teachableMachine',
      name: 'Teachable Machine',
      description: "Use your Teachable Machine models in your Scratch project!",
      iconURL: "teachable-machine-blocks.png",
      insetIconURL: "teachable-machine-blocks-small.svg",
      blocks: [
        {
          opcode: 'useModelBlock',
          blockType: BlockType.COMMAND,
          text: 'use model [URL]',
          arguments: {
            URL: {
              type: ArgumentType.STRING,
              defaultValue: 'URL or ID'
            }
          }
        },
        {
          opcode: 'whenModelMatches',
          blockType: BlockType.HAT,
          text: 'when model matches [CLASS]',
          arguments: {
            CLASS: {
              type: ArgumentType.STRING,
              menu: 'classMenu'
            }
          }
        },
        {
          opcode: 'modelPrediction',
          blockType: BlockType.REPORTER,
          text: 'current prediction'
        },
        {
          opcode: 'modelMatches',
          blockType: BlockType.BOOLEAN,
          text: 'model matches [CLASS]',
          arguments: {
            CLASS: {
              type: ArgumentType.STRING,
              menu: 'classMenu'
            }
          }
        },
        {
          opcode: 'classConfidence',
          blockType: BlockType.REPORTER,
          text: 'confidence for [CLASS]',
          arguments: {
            CLASS: {
              type: ArgumentType.STRING,
              menu: 'classMenu'
            }
          }
        },
        {
          opcode: 'videoToggle',
          blockType: BlockType.COMMAND,
          text: 'turn video [STATE]',
          arguments: {
            STATE: {
              type: ArgumentType.STRING,
              menu: 'videoMenu',
              defaultValue: VideoState.ON
            }
          }
        },
        {
          opcode: 'setVideoTransparency',
          blockType: BlockType.COMMAND,
          text: 'set video transparency to [TRANSPARENCY]',
          arguments: {
            TRANSPARENCY: {
              type: ArgumentType.NUMBER,
              defaultValue: 50
            }
          }
        },
        {
          opcode: 'openTeachableMachine',
          blockType: BlockType.COMMAND,
          text: 'Teachable Machine Site ↗'
        }
      ],
      menus: {
        classMenu: {
          items: 'getClasses'
        },
        videoMenu: {
          items: [
            { text: 'on', value: VideoState.ON },
            { text: 'off', value: VideoState.OFF },
            { text: 'on flipped', value: VideoState.ON_FLIPPED }
          ]
        }
      }
    };
  }

  init() {
    this.lastUpdate = null;
    this.maxConfidence = null;
    this.modelConfidences = {};

    if (this.runtime.ioDevices) {
      this._loop();
    }
  }

  _loop() {
    setTimeout(this._loop.bind(this), Math.max(this.runtime.currentStepTime, this.INTERVAL));

    const time = Date.now();
    if (this.lastUpdate === null) {
      this.lastUpdate = time;
    }
    if (!this.isPredicting) {
      this.isPredicting = 0;
    }
    const offset = time - this.lastUpdate;

    if (offset > this.INTERVAL && this.isPredicting === 0) {
      const frame = this.runtime.ioDevices.video.getFrame({
        format: 'image-data',
        dimensions: this.DIMENSIONS
      });

      this.lastUpdate = time;
      this.isPredicting = 0;
      this.predictAllBlocks(frame);
    }
  }

  async predictAllBlocks(frame) {
    for (let modelUrl in this.predictionState) {
      if (!this.predictionState[modelUrl].model) {
        continue;
      }
      if (this.teachableImageModel !== modelUrl) {
        continue;
      }
      ++this.isPredicting;
      const prediction = await this.predictModel(modelUrl, frame);
      this.predictionState[modelUrl].topClass = prediction;
      --this.isPredicting;
    }
  }

  async predictModel(modelUrl, frame) {
    const predictions = await this.getPredictionFromModel(modelUrl, frame);
    if (!predictions) {
      return;
    }
    let maxProbability = 0;
    let maxClassName = "";
    for (let i = 0; i < predictions.length; i++) {
      const probability = predictions[i].probability.toFixed(2);
      const className = predictions[i].className;
      this.modelConfidences[className] = probability; // update for reporter block
      if (probability > maxProbability) {
        maxClassName = className;
        maxProbability = probability;
      }
    }
    this.maxConfidence = maxProbability; // update for reporter block
    return maxClassName;
  }

  async getPredictionFromModel(modelUrl, frame) {
    const { model, modelType } = this.predictionState[modelUrl];
    switch (modelType) {
      case this.ModelType.IMAGE:
        if (!frame) return null;
        const imageBitmap = await createImageBitmap(frame);
        return await model.predict(imageBitmap);
      case this.ModelType.POSE:
        if (!frame) return null;
        const { pose, posenetOutput } = await model.estimatePose(frame);
        return await model.predict(posenetOutput);
      case this.ModelType.AUDIO:
        if (this.latestAudioResults) {
          return model.wordLabels().map((label, i) => {
            return { className: label, probability: this.latestAudioResults.scores[i] }
          });
        } else {
          return null;
        }
    }
  }

  async startPredicting(modelDataUrl) {
    const alreadyLoaded = Boolean(this.predictionState[modelDataUrl]);
    try {
      console.log(alreadyLoaded ? "Updating model" : "Loading model");
      this.predictionState[modelDataUrl] = {};
      const { model, type } = await this.initModel(modelDataUrl);
      this.predictionState[modelDataUrl].modelType = type;
      this.predictionState[modelDataUrl].model = model;
      this.runtime.requestToolboxExtensionsUpdate();
      console.log("Model loaded");
    } catch (e) {
      this.predictionState[modelDataUrl] = {};
      console.log("Model initialization failure!", e);
      console.log("Unable to load model.");
    }
  }

  getModelPrediction() {
    const modelUrl = this.teachableImageModel;
    const predictionState = this.getPredictionStateOrStartPredicting(modelUrl);
    if (!predictionState) {
      return '';
    }
    return predictionState.topClass;
  }

  async initModel(modelUrl) {
    const avoidCache = `?x=${Date.now()}`;
    const modelURL = modelUrl + "model.json" + avoidCache;
    const metadataURL = modelUrl + "metadata.json" + avoidCache;
    
    try {
      const customMobileNet = await tmImage.load(modelURL, metadataURL);
      
      // Check if it's a speech model by examining metadata
      if (customMobileNet._metadata.hasOwnProperty('tfjsSpeechCommandsVersion')) {
        // This is a speech model - we'll handle it in a simplified way
        // Store basic model info and create a placeholder
        const wordLabels = customMobileNet._metadata.wordLabels || [];
        
        // Create a simulated speech model with the necessary interface
        const simulatedSpeechModel = {
          wordLabels: () => wordLabels,
          // Other methods as needed
        };
        
        // Set up simulated audio recognition results
        this.latestAudioResults = { scores: Array(wordLabels.length).fill(0) };
        
        // Just inform the user audio models aren't fully supported
        console.log("Audio model detected. Note: Audio recognition has limited support.");
        
        return { model: simulatedSpeechModel, type: this.ModelType.AUDIO };
      } else if (customMobileNet._metadata.packageName === "@teachablemachine/pose") {
        const customPoseNet = await tmPose.load(modelURL, metadataURL);
        return { model: customPoseNet, type: this.ModelType.POSE };
      } else {
        console.log(customMobileNet.getMetadata(), customMobileNet.getTotalClasses(), customMobileNet.getClassLabels());
        return { model: customMobileNet, type: this.ModelType.IMAGE };
      }
    } catch (e) {
      console.error('Error loading model:', e);
      throw e;
    }
  }

  useModelBlock(args) {
    try {
      const url = args.URL;
      const modelUrl = this.modelArgumentToURL(url);
      this.getPredictionStateOrStartPredicting(modelUrl, true);
      this.updateStageModel(modelUrl);
    } catch (e) {
      this.teachableImageModel = null;
    }
  }

  modelArgumentToURL(modelArg) {
    const endpointProvidedFromInterface = "https://teachablemachine.withgoogle.com/models/";
    // NOTE: It's possible Google will change this endpoint in the future, and that will break this extension.
    // TODO: https://github.com/mitmedialab/prg-extension-boilerplate/issues/343
    const redirectEndpoint = "https://storage.googleapis.com/tm-model/";
    return modelArg.startsWith(endpointProvidedFromInterface)
      ? modelArg.replace(endpointProvidedFromInterface, redirectEndpoint)
      : redirectEndpoint + modelArg + "/";
  }

  updateStageModel(modelUrl) {
    const stage = this.runtime.getTargetForStage();
    this.teachableImageModel = modelUrl;
    if (stage) {
      stage.teachableImageModel = modelUrl;
    }
  }

  getPredictionStateOrStartPredicting(modelUrl, override = false) {
    const hasPredictionState = this.predictionState.hasOwnProperty(modelUrl);
    if (!hasPredictionState || override) {
      this.startPredicting(modelUrl);
      return null;
    }
    return this.predictionState[modelUrl];
  }

  getClasses() {
    if (
      !this.teachableImageModel ||
      !this.predictionState ||
      !this.predictionState[this.teachableImageModel] ||
      !this.predictionState[this.teachableImageModel].hasOwnProperty('model')
    ) {
      return ["Select a class"];
    }

    if (this.predictionState[this.teachableImageModel].modelType === this.ModelType.AUDIO) {
      return this.predictionState[this.teachableImageModel].model.wordLabels();
    }

    return this.predictionState[this.teachableImageModel].model.getClassLabels();
  }

  model_match(args) {
    const modelUrl = this.teachableImageModel;
    const className = args.CLASS;

    const predictionState = this.getPredictionStateOrStartPredicting(modelUrl);
    if (!predictionState) {
      return false;
    }

    const currentMaxClass = predictionState.topClass;
    return (currentMaxClass === String(className));
  }

  getClassConfidence(args) {
    return this.modelConfidences[args.CLASS];
  }

  videoToggle(args) {
    const state = args.STATE;
    if (state === VideoState.OFF) return this.runtime.ioDevices.video.disableVideo();

    this.runtime.ioDevices.video.enableVideo();
    // Mirror if state is ON. Do not mirror if state is ON_FLIPPED.
    this.runtime.ioDevices.video.mirror = (state === VideoState.ON);
  }

  setVideoTransparency(args) {
    const transparency = args.TRANSPARENCY;
    const trans = Math.max(Math.min(transparency, 100), 0);
    this.runtime.ioDevices.video.setPreviewGhost(trans);
  }

  openTeachableMachine() {
    window.open('https://teachablemachine.withgoogle.com/train', '_blank');
  }

  whenModelMatches(args) {
    return this.model_match(args);
  }

  modelMatches(args) {
    return this.model_match(args);
  }

  modelPrediction() {
    return this.getModelPrediction();
  }

  classConfidence(args) {
    return this.getClassConfidence(args);
  }
}

module.exports = TeachableMachine;