const fs = require('fs');
const path = require('path');
const util = require('util');

const hca = require('./hca');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);

async function parseAFS2(buffer) {
  if (typeof(buffer) === 'string') buffer = await readFile(buffer);
  if (!buffer || buffer.length < 4) return null;
  let pos = 0;
  const config = {};
  config.buffer = buffer;
  config.magic = buffer.slice(pos, 4).toString(); pos += 4;
  if (config.magic !== 'AFS2') return null;
  config.unknown1 = buffer.readUInt8(pos); pos += 1;
  config.sizeLen = buffer.readUInt8(pos); pos += 1;
  config.unknown2 = buffer.readUInt8(pos); pos += 1;
  config.unknown3 = buffer.readUInt8(pos); pos += 1;
  config.fileCount = buffer.readUInt32LE(pos); pos += 4;
  config.align = buffer.readUInt16LE(pos); pos += 2;
  config.key = buffer.readUInt16LE(pos); pos += 2;
  config.fileIds = [];
  for (let i = 0; i < config.fileCount; i++) {
    const fileId = buffer.readUInt16LE(pos); pos += 2;
    config.fileIds.push(fileId);
  }
  const files = [];
  let start;
  if (config.sizeLen === 2) {
    start = buffer.readUInt16LE(pos); pos += 2;
  } else if (config.sizeLen === 4) {
    start = buffer.readUInt32LE(pos); pos += 4;
  } else debugger;
  let mod = start % config.align;
  if (mod != 0) start += config.align - mod;
  for (let i = 0; i < config.fileCount; i++) {
    let end;
    if (config.sizeLen === 2) {
      end = buffer.readUInt16LE(pos); pos += 2;
    } else if (config.sizeLen === 4) {
      end = buffer.readUInt32LE(pos); pos += 4;
    } else debugger;
    files.push(buffer.slice(start, end));
    start = end;
    mod = start % config.align;
    if (mod != 0) start += config.align - mod;
  }
  files.config = config;
  return files;
}
exports.parseAFS2 = parseAFS2;

async function awb2hcas(awbPath, key, hcaDir, type, skip) {
  const pathInfo = path.parse(awbPath);
  console.log(`Parsing ${pathInfo.base}...`);
  const list = await parseAFS2(awbPath);
  if (hcaDir === undefined) hcaDir = path.join(pathInfo.dir, pathInfo.name);
  if (!fs.existsSync(hcaDir)) {
    await mkdir(hcaDir, { recursive: true });
  } else if (skip) {
    console.log(`Skipped ${pathInfo.base}...`);
    return;
  }
  const len = ('' + list.length).length;
  console.log(`Extracting ${pathInfo.base}...`);
  for (let i = 0; i < list.length; i++) {
    const hcaBuff = list[i];
    let name = '' + (i + 1);
    while (name.length < len) name = '0' + name;
    if (key !== undefined) {
      console.log(`Decrypting ${name}.hca...`);
      await hca.decryptHca(hcaBuff, key, list.config.key, type);
    }
    console.log(`Writing ${name}.hca...`);
    await writeFile(path.join(hcaDir, name + '.hca'), hcaBuff);
  }
}
exports.awb2hcas = awb2hcas;

async function awb2wavs(awbPath, key, wavDir, volume, mode, skip) {
  const pathInfo = path.parse(awbPath);
  console.log(`Parsing ${pathInfo.base}...`);
  const list = await parseAFS2(awbPath);
  if (wavDir === undefined) wavDir = path.join(pathInfo.dir, pathInfo.name);
  if (!fs.existsSync(wavDir)) {
    await mkdir(wavDir, { recursive: true });
  } else if (skip) {
    console.log(`Skipped ${pathInfo.base}...`);
    return;
  }
  const len = ('' + list.length).length;
  console.log(`Extracting ${pathInfo.base}...`);
  for (let i = 0; i < list.length; i++) {
    const hcaBuff = list[i];
    let name = '' + (i + 1);
    while (name.length < len) name = '0' + name;
    const wavPath = path.join(wavDir, name + '.wav');
    await hca.decodeHcaToWav(hcaBuff, key, list.config.key, wavPath, volume, mode);
  }
}
exports.awb2wavs = awb2wavs;

async function decryptAwb(awbPath, key, type) {
  const pathInfo = path.parse(awbPath);
  console.log(`Parsing ${pathInfo.base}...`);
  const list = await parseAFS2(awbPath);
  console.log(`Decrypting ${pathInfo.base}...`);
  for (let i = 0; i < list.length; i++) {
    await hca.decryptHca(list[i], key, list.config.key, type);
  }
  const buffer = list.config.buffer;
  buffer.writeUInt16BE(0, 0xE);
  console.log(`Writing ${pathInfo.base}...`);
  await writeFile(awbPath, buffer);
}
exports.decryptAwb = decryptAwb;
