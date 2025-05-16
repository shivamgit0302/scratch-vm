/* eslint-disable */
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const formatMessage = require('format-message');

// Digital Modes
const DIGITAL_INPUT = 1;
const DIGITAL_OUTPUT = 2;
const PWM = 3;
const SERVO = 4;
const SONAR = 5;
const ANALOG_INPUT = 6;

// Common form messages
const FormDigitalWrite = {
    'pt-br': 'Escrever Pino Digital [PIN]como[ON_OFF]',
    'pt': 'Escrever Pino Digital[PIN]como[ON_OFF]',
    'en': 'Write Digital Pin [PIN] [ON_OFF]',
    'fr': 'Mettre la pin numérique[PIN]à[ON_OFF]',
    'zh-tw': '腳位[PIN]數位輸出[ON_OFF]',
    'zh-cn': '引脚[PIN]数字输出[ON_OFF]',
    'pl': 'Ustaw cyfrowy Pin [PIN] na [ON_OFF]',
    'de': 'Setze digitalen Pin [PIN] [ON_OFF]',
    'ja': 'デジタル・ピン [PIN] に [ON_OFF] を出力',
    'nl': 'Schrijf Digitale Pin [PIN] [ON_OFF]',
};

const FormPwmWrite = {
    'pt-br': 'Escrever Pino PWM[PIN]com[VALUE]%',
    'pt': 'Escrever Pino PWM[PIN]com[VALUE]%',
    'en': 'Write PWM Pin [PIN] [VALUE]%',
    'fr': 'Mettre la pin PWM[PIN]à[VALUE]%',
    'zh-tw': '腳位[PIN]類比輸出[VALUE]%',
    'zh-cn': '引脚[PIN]模拟输出[VALUE]%',
    'pl': 'Ustaw PWM Pin [PIN] na [VALUE]%',
    'de': 'Setze PWM-Pin [PIN] [VALUE]%',
    'ja': 'PWM ピン [PIN] に [VALUE]% を出力',
    'nl': 'Schrijf PWM Pin [PIN] [VALUE]%',
};

const FormServo = {
    'pt-br': 'Mover Servo Motor no[PIN]para[ANGLE]°',
    'pt': 'Mover Servo Motor no[PIN]para[ANGLE]°',
    'en': 'Write Servo Pin [PIN] [ANGLE] Deg.',
    'fr': 'Mettre le servo[PIN]à[ANGLE] Deg.',
    'zh-tw': '伺服馬達腳位[PIN]轉動角度到[ANGLE]度',
    'zh-cn': '伺服电机引脚[PIN]转动角度到[ANGLE]度',
    'pl': 'Ustaw silnik servo na Pinie [PIN] na [ANGLE]°',
    'de': 'Setze Servo-Pin [PIN] [ANGLE]°',
    'ja': 'サーボ・ピン [PIN] に [ANGLE] 度を出力',
    'nl': 'Schrijf Servo Pin [PIN] [ANGLE]° graden',
};

const FormAnalogRead = {
    'pt-br': 'Ler Pino Analógico [PIN]',
    'pt': 'Ler Pino Analógico [PIN]',
    'en': 'Read Analog Pin [PIN]',
    'fr': 'Lecture analogique [PIN]',
    'zh-tw': '讀取類比腳位[PIN]',
    'zh-cn': '读取模拟引脚[PIN]',
    'pl': 'Odczytaj analogowy Pin [PIN]',
    'de': 'Lies analogen Pin [PIN]',
    'ja': 'アナログ・ピン [PIN] から入力',
    'nl': 'Lees Analoge Pin [PIN]',
};

const FormDigitalRead = {
    'pt-br': 'Ler Pino Digital [PIN]',
    'pt': 'Ler Pino Digital [PIN]',
    'en': 'Read Digital Pin [PIN]',
    'fr': 'Lecture numérique [PIN]',
    'zh-tw': '讀取數位腳位[PIN]',
    'zh-cn': '读取数字引脚[PIN]',
    'pl': 'Odczytaj cyfrowy Pin [PIN]',
    'de': 'Lies digitalen Pin [PIN]',
    'ja': 'デジタル・ピン [PIN] から入力',
    'nl': 'Lees Digitale Pin [PIN]',
};

const FormSonarRead = {
    'pt-br': 'Ler Distância: Sonar em T[TRIGGER_PIN] E[ECHO_PIN]',
    'pt': 'Ler Distância: Sonar em T[TRIGGER_PIN] E[ECHO_PIN]',
    'en': 'Read SONAR  T [TRIGGER_PIN]  E [ECHO_PIN]',
    'fr': 'Distance de lecture : Sonar T [TRIGGER_PIN] E [ECHO_PIN]',
    'zh-tw': 'HCSR超音波感測器，Echo在腳位[ECHO_PIN] Trig在腳位[TRIGGER_PIN]',
    'zh-cn': 'HCSR超声波传感器，Echo在引脚[ECHO_PIN] Trig在引脚[TRIGGER_PIN]',
    'pl': 'Odczytaj odległość: Sonar T [TRIGGER_PIN]  E [ECHO_PIN]',
    'de': 'Lies Sonar T [TRIGGER_PIN]  E [ECHO_PIN]',
    'ja': '超音波測距器からトリガ [TRIGGER_PIN] とエコー [ECHO_PIN] で入力',
    'nl': 'Lees SONAR T [TRIGGER_PIN] E [ECHO_IPN]',
};

class Scratch3RpiPicoOneGPIO {
    constructor(runtime) {
        this.runtime = runtime;
        this.connected = false;
        this.connection_pending = false;
        this.connect_attempt = false;
        this.alerted = false;
        this.serialPort = null;
        this.writer = null;
        this.reader = null;
        this.readLoopActive = false;
        this.digital_inputs = new Array(30).fill(0); // Pico has pins 0-28
        this.analog_inputs = new Array(4).fill(0);   // Pico has 4 ADC pins
        this.pin_modes = new Array(30).fill(-1);
        this.wait_open = [];
        this.sonar_report_pin = null;
        this.the_locale = null;

        setTimeout(() => {
            if (!this.connected && !this.connection_pending) {
                this.connect();
            }
        }, 1000);
    }

    getInfo() {
        this.the_locale = this._setLocale();

        return {
            id: 'onegpioRpiPico',
            color1: '#0C5986',
            color2: '#34B0F7',
            name: 'OneGpio Raspberry Pi Pico',
            blockIconURI: 'data:image/png;base64,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',
            blocks: [
                {
                    opcode: 'digital_write',
                    blockType: BlockType.COMMAND,
                    text: FormDigitalWrite[this.the_locale],
                    arguments: {
                        PIN: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '2',
                            menu: 'digital_pins'
                        },
                        ON_OFF: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0',
                            menu: 'on_off'
                        }
                    }
                },
                {
                    opcode: 'pwm_write',
                    blockType: BlockType.COMMAND,
                    text: FormPwmWrite[this.the_locale],
                    arguments: {
                        PIN: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '3',
                            menu: 'pwm_pins'
                        },
                        VALUE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '50',
                        }
                    }
                },
                '---',
                {
                    opcode: 'servo',
                    blockType: BlockType.COMMAND,
                    text: FormServo[this.the_locale],
                    arguments: {
                        PIN: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '2',
                            menu: 'digital_pins'
                        },
                        ANGLE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 90,
                        },
                    }
                },
                '---',
                {
                    opcode: 'analog_read',
                    blockType: BlockType.REPORTER,
                    text: FormAnalogRead[this.the_locale],
                    arguments: {
                        PIN: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0',
                            menu: 'analog_pins'
                        },
                    }
                },
                '---',
                {
                    opcode: 'digital_read',
                    blockType: BlockType.REPORTER,
                    text: FormDigitalRead[this.the_locale],
                    arguments: {
                        PIN: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '2',
                            menu: 'digital_pins'
                        },
                        PULL:{
                            type: ArgumentType.STRING,
                            defaultValue: '^',
                            menu: 'pull'
                        },
                    }
                },
                '---',
                {
                    opcode: 'sonar_read',
                    blockType: BlockType.REPORTER,
                    text: FormSonarRead[this.the_locale],
                    arguments: {
                        TRIGGER_PIN: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '7',
                            menu: 'digital_pins'
                        },
                        ECHO_PIN: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '8',
                            menu: 'digital_pins'
                        }
                    }
                },
            ],
            menus: {
                digital_pins: {
                    acceptReporters: true,
                    items: ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11',
                        '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '25',
                        '26', '27', '28']
                },
                pwm_pins: {
                    acceptReporters: true,
                    items: ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11',
                        '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '25',
                        '26', '27', '28']
                },
                analog_pins: {
                    acceptReporters: true,
                    items: ['0', '1', '2', '3']
                },
                mode: {
                    acceptReporters: true,
                    items: [{text: "Input", value: '1'}, {text: "Output", value: '2'}]
                },
                on_off: {
                    acceptReporters: true,
                    items: ['0', '1']
                },
                pull: {
                    acceptReporters: true,
                    items:['^', '-']
                }
            }
        };
    }

    // Block handlers
    async digital_write(args) {
        if (!this.connected && !this.connection_pending) {
            await this.connect();
        }

        if (!this.connected) {
            let callbackEntry = [this.digital_write.bind(this), args];
            this.wait_open.push(callbackEntry);
            return;
        }

        let pin = parseInt(args['PIN'], 10);
        let value = parseInt(args['ON_OFF'], 10);

        await this.sendSerial(
            JSON.stringify({ command: 'digital_write', pin, value })
        );
    }

    async pwm_write(args) {
        if (!this.connected && !this.connection_pending) {
            await this.connect();
        }

        if (!this.connected) {
            let callbackEntry = [this.pwm_write.bind(this), args];
            this.wait_open.push(callbackEntry);
            return;
        }

        let pin = parseInt(args['PIN'], 10);
        let value = parseInt(args['VALUE'], 10);
        
        if (value >= 100) {
            value = 99;
        }

        await this.sendSerial(
            JSON.stringify({ command: 'pwm_write', pin, value })
        );
    }

    async servo(args) {
        if (!this.connected && !this.connection_pending) {
            await this.connect();
        }

        if (!this.connected) {
            let callbackEntry = [this.servo.bind(this), args];
            this.wait_open.push(callbackEntry);
            return;
        }

        let pin = parseInt(args['PIN'], 10);
        let angle = parseInt(args['ANGLE'], 10);

        await this.sendSerial(
            JSON.stringify({ command: 'servo_position', pin, position: angle })
        );
    }

    async analog_read(args) {
        if (!this.connected && !this.connection_pending) {
            await this.connect();
        }

        if (!this.connected) {
            let callbackEntry = [this.analog_read.bind(this), args];
            this.wait_open.push(callbackEntry);
            return;
        }

        let pin = parseInt(args['PIN'], 10);
        return this.analog_inputs[pin];
    }

    async digital_read(args) {
        if (!this.connected && !this.connection_pending) {
            await this.connect();
        }

        if (!this.connected) {
            let callbackEntry = [this.digital_read.bind(this), args];
            this.wait_open.push(callbackEntry);
            return;
        }

        let pin = parseInt(args['PIN'], 10);
        let pull = args['PULL'];

        await this.sendSerial(
            JSON.stringify({ command: 'set_mode_digital_input', pin, pull })
        );

        return this.digital_inputs[pin];
    }

    async sonar_read(args) {
        if (!this.connected && !this.connection_pending) {
            await this.connect();
        }

        if (!this.connected) {
            let callbackEntry = [this.sonar_read.bind(this), args];
            this.wait_open.push(callbackEntry);
            return;
        }

        let trigger_pin = parseInt(args['TRIGGER_PIN'], 10);
        let echo_pin = parseInt(args['ECHO_PIN'], 10);
        this.sonar_report_pin = trigger_pin;

        await this.sendSerial(
            JSON.stringify({ command: 'set_mode_sonar', trigger_pin, echo_pin })
        );

        return this.digital_inputs[this.sonar_report_pin];
    }

    _setLocale() {
        let now_locale = '';
        switch (formatMessage.setup().locale) {
            case 'pt-br':
            case 'pt':
                now_locale = 'pt-br';
                break;
            case 'en':
                now_locale = 'en';
                break;
            case 'fr':
                now_locale = 'fr';
                break;
            case 'zh-tw':
                now_locale = 'zh-tw';
                break;
            case 'zh-cn':
                now_locale = 'zh-cn';
                break;
            case 'pl':
                now_locale = 'pl';
                break;
            case 'ja':
                now_locale = 'ja';
                break;
            case 'de':
                now_locale = 'de';
                break;
            case 'nl':
                now_locale = 'nl';
                break;
            default:
                now_locale = 'en';
                break;
        }
        return now_locale;
    }

    async connect() {
        if (this.connected || this.connection_pending) {
            return;
        }

        this.connection_pending = true;

        try {
            this.serialPort = await navigator.serial.requestPort();
            await this.serialPort.open({ baudRate: 57600 });

            this.writer = this.serialPort.writable.getWriter();
            this.connected = true;
            this.connect_attempt = true;
            this.alerted = false;

            this.startReadLoop();

            for (let index = 0; index < this.wait_open.length; index++) {
                let data = this.wait_open[index];
                await data[0](data[1]);
            }
            this.wait_open = [];
        } catch (error) {
            console.error('Error connecting to Pico:', error);
            if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
                if (!this.alerted) {
                    this.alerted = true;
                    alert('Could not connect to Raspberry Pi Pico. Make sure it\'s plugged in and the correct port is selected.');
                }
            }
        } finally {
            this.connection_pending = false;
        }
    }

    async sendSerial(data) {
        if (!this.writer) {
            console.error('Writer is not available, cannot send data!');
            return;
        }

        try {
            const encoder = new TextEncoder();
            const dataArrayBuffer = encoder.encode(data + '\n');
            await this.writer.write(dataArrayBuffer);
        } catch (error) {
            console.error('Error sending data:', error);
            this.handleDisconnect();
        }
    }

    async startReadLoop() {
        if (this.readLoopActive) return;
        this.readLoopActive = true;

        this.reader = this.serialPort.readable.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (this.readLoopActive) {
                const { value, done } = await this.reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value);

                let endIndex;
                while ((endIndex = buffer.indexOf('\n')) !== -1) {
                    const message = buffer.slice(0, endIndex);
                    buffer = buffer.slice(endIndex + 1);

                    if (message.trim()) {
                        this.processSerialMessage(message);
                    }
                }
            }
        } catch (error) {
            console.error('Error reading data:', error);
        } finally {
            this.reader.releaseLock();
            this.readLoopActive = false;
        }
    }

    processSerialMessage(messageText) {
        try {
            const msg = JSON.parse(messageText);
            let report_type = msg['report'];
            let pin = null;
            let value = null;

            if (report_type === 'digital_input') {
                pin = parseInt(msg['pin'], 10);
                value = msg['value'];
                this.digital_inputs[pin] = value;
            } else if (report_type === 'analog_input') {
                pin = parseInt(msg['pin'], 10);
                value = msg['value'];
                this.analog_inputs[pin] = value;
            } else if (report_type === 'sonar_data') {
                value = msg['value'];
                this.digital_inputs[this.sonar_report_pin] = value;
            }
        } catch (error) {
            console.error('Error processing message:', error, messageText);
        }
    }

    async handleDisconnect() {
        if (!this.connected) return;

        try {
            if (this.reader) {
                this.readLoopActive = false;
                await this.reader.cancel();
                this.reader = null;
            }

            if (this.writer) {
                this.writer.releaseLock();
                this.writer = null;
            }

            if (this.serialPort && this.serialPort.readable) {
                await this.serialPort.close();
            }

            this.serialPort = null;
        } catch (error) {
            console.error('Error during disconnect:', error);
        } finally {
            this.digital_inputs.fill(0);
            this.analog_inputs.fill(0);
            this.pin_modes.fill(-1);
            this.connected = false;
        }
    }
}

module.exports = Scratch3RpiPicoOneGPIO;