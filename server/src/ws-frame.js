'use strict';

const crypto = require('crypto');

const OPCODES = { CONTINUATION: 0x0, TEXT: 0x1, BINARY: 0x2, CLOSE: 0x8, PING: 0x9, PONG: 0xa };

function encodeFrame(payload, options = {}) {
  const opcode = options.opcode == null ? OPCODES.TEXT : options.opcode;
  const mask = !!options.mask;
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload || ''), 'utf8');
  const length = body.length;
  let headerLength = 2;
  if (length >= 126 && length < 65536) headerLength += 2;
  if (length >= 65536) headerLength += 8;
  if (mask) headerLength += 4;
  const frame = Buffer.alloc(headerLength + length);
  frame[0] = (options.fin === false ? 0 : 0x80) | opcode;
  let offset = 2;
  if (length < 126) {
    frame[1] = length | (mask ? 0x80 : 0);
  } else if (length < 65536) {
    frame[1] = 126 | (mask ? 0x80 : 0);
    frame.writeUInt16BE(length, 2);
    offset = 4;
  } else {
    frame[1] = 127 | (mask ? 0x80 : 0);
    frame.writeUInt32BE(0, 2);
    frame.writeUInt32BE(length, 6);
    offset = 10;
  }
  if (mask) {
    const maskKey = options.maskKey || crypto.randomBytes(4);
    maskKey.copy(frame, offset);
    offset += 4;
    for (let index = 0; index < length; index += 1) frame[offset + index] = body[index] ^ maskKey[index % 4];
  } else {
    body.copy(frame, offset);
  }
  return frame;
}

class FrameParser {
  constructor(options = {}) {
    this.buffer = Buffer.alloc(0);
    this.maxPayload = options.maxPayload || 2 * 1024 * 1024;
  }

  push(chunk) {
    if (chunk && chunk.length) this.buffer = Buffer.concat([this.buffer, chunk]);
    const frames = [];
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const fin = !!(first & 0x80);
      const opcode = first & 0x0f;
      const masked = !!(second & 0x80);
      let length = second & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (this.buffer.length < 4) break;
        length = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) break;
        const high = this.buffer.readUInt32BE(2);
        const low = this.buffer.readUInt32BE(6);
        if (high !== 0) throw new Error('WebSocket payload too large');
        length = low;
        offset = 10;
      }
      if (length > this.maxPayload) throw new Error('WebSocket payload exceeds limit');
      if (masked) offset += 4;
      if (this.buffer.length < offset + length) break;
      let payload = Buffer.from(this.buffer.slice(offset, offset + length));
      if (masked) {
        const key = this.buffer.slice(offset - 4, offset);
        for (let index = 0; index < payload.length; index += 1) payload[index] ^= key[index % 4];
      }
      this.buffer = this.buffer.slice(offset + length);
      frames.push({ fin, opcode, payload, masked });
    }
    return frames;
  }
}

function handshakeAccept(key) {
  return crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
}

module.exports = { OPCODES, encodeFrame, FrameParser, handshakeAccept };
