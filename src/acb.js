const fs = require('fs');
const path = require('path');
const util = require('util');
const crypto = require('crypto');

const afs2 = require('./afs2');
const hca = require('./hca');
const utf = require('./utf');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);

async function parseAcb(acbPath) {
  const pathInfo = path.parse(acbPath);
  const buffer = await readFile(acbPath);
  const utfs = utf.parseUtf(buffer);
  if (!utfs) throw new Error(`NOT ACB FILE`);
  if (utfs.length !== 1) debugger;
  const acb = utfs[0];
  acb.buffer = buffer;
  acb.memoryHcas = await afs2.parseAFS2(acb.AwbFile);
  acb.streamHcas = [];
  for (let i = 0; i < acb.StreamAwbHash.length; i++) {
    const StreamAwb = acb.StreamAwbHash[i];
    const awbPath = path.join(pathInfo.dir, StreamAwb.Name + '.awb');
    if (fs.existsSync(awbPath)) {
      const obj = await afs2.parseAFS2(awbPath);
      acb.streamHcas.push(obj);
    }
  }
  for (let i = 0; i < acb.WaveformTable.length; i++) {
    const Waveform = acb.WaveformTable[i];
    const isMemory = Waveform.Streaming === 0;
    if (!isMemory) {
      if (!acb.streamHcas[Waveform.StreamAwbPortNo]) {
        throw new Error(`MISSING ${acb.StreamAwbHash[i].Name}.awb`);
      }
    }
  }
  return acb;
}

async function parseCommand(acb, command, key) {
  let samplingRate = 0, channelCount = 0;
  let k = 0;
  const commands = [];
  while (k < command.length) {
    const cmd = command.readUInt16BE(k); k += 2;
    const len = command.readUInt8(k); k += 1;
    if (len !== 4 && len !== 0) debugger;
    let file, u16;
    switch (cmd) {
      case 0x0000:
        k = command.length;
        break;
      case 0x07d0: // Start Waveform
        u16 = command.readUInt16BE(k); k += 2;
        if (u16 !== 0x0002) debugger;
        const SynthIndex = command.readUInt16BE(k); k += 2;
        const Synth = acb.SynthTable[SynthIndex];
        u16 = Synth.ReferenceItems.readUInt16BE(0);
        if (u16 !== 0x0001) debugger;
        const WaveformIndex = Synth.ReferenceItems.readUInt16BE(2);
        const Waveform = acb.WaveformTable[WaveformIndex];
        const isMemory = Waveform.Streaming === 0;
        if (Waveform.EncodeType === 2) {
          file = isMemory ? acb.memoryHcas[Waveform.MemoryAwbId] : acb.streamHcas[Waveform.StreamAwbPortNo][Waveform.StreamAwbId];
          if (Buffer.isBuffer(file)) {
            const awbKey = isMemory ? acb.memoryHcas.config.key : acb.streamHcas[Waveform.StreamAwbPortNo].config.key;
            file = await hca.decodeHca(file, key, awbKey);
            if (isMemory) acb.memoryHcas[Waveform.MemoryAwbId] = file; else acb.streamHcas[Waveform.StreamAwbPortNo][Waveform.StreamAwbId] = file;
            if (samplingRate === 0) samplingRate = file.samplingRate; else if (samplingRate !== file.samplingRate) throw new Error(`SamplingRate Different`);
            if (channelCount === 0) channelCount = file.channelCount; else if (channelCount !== file.channelCount) throw new Error(`ChannelCount Different`);
          }
        } else {
          throw new Error(`Not HCA File`);
        }
        commands.push({ type: 0, pcmData: file.pcmData });
        break;
      case 0x07d1: // Set Position
        const StartOffset = command.readUInt32BE(k); k += 4;
        if (StartOffset > 3600000) debugger;
        commands.push({ type: 1, offset: StartOffset });
        break;
      default:
        debugger;
        break;
    }
  }
  return { commands, samplingRate, channelCount };
}

async function mixAcb(acbPath, key, wavDir, mode, skip) {
  const pathInfo = path.parse(acbPath);
  console.log(`Parsing ${pathInfo.base}...`);
  const acb = await parseAcb(acbPath);
  if (wavDir === undefined) wavDir = path.join(pathInfo.dir, acb.Name);
  if (!fs.existsSync(wavDir)) {
    await mkdir(wavDir, { recursive: true });
  } else if (skip) {
    console.log(`Skipped ${pathInfo.base}...`);
    return;
  }
  console.log(`Mixing ${pathInfo.base}...`);
  const cueNameMap = {};
  for (let i = 0; i < acb.CueNameTable.length; i++) {
    const cueName = acb.CueNameTable[i];
    cueNameMap[cueName.CueIndex] = cueName.CueName;
  }
  for (let i = 0; i < acb.CueTable.length; i++) {
    const Cue = acb.CueTable[i];
    let samplingRate = 0, channelCount = 0;
    if (Cue.ReferenceType !== 3) debugger;
    const Sequence = acb.SequenceTable[Cue.ReferenceIndex];
    // Sequence.Type: 0 - Polyphonic, 1 - Sequential, Random, Random No Repeat, Switch, Shuffle Cue, Combo Sequential, Track Transition by Selector
    const timeline = [];
    let size = 0;
    for (let j = 0; j < Sequence.NumTracks; j++) {
      const index = Sequence.TrackIndex.readUInt16BE(j * 2);
      const Track = acb.TrackTable[index];
      const TrackEvent = acb.TrackEventTable[Track.EventIndex];
      const track = await parseCommand(acb, TrackEvent.Command, key);
      if (track.samplingRate) {
        if (samplingRate === 0) samplingRate = track.samplingRate; else if (track.samplingRate !== samplingRate) throw new Error(`SamplingRate Different`);
      }
      if (track.channelCount) {
        if (channelCount === 0) channelCount = track.channelCount; else if (track.channelCount !== channelCount) throw new Error(`ChannelCount Different`);
      }
      let time = 0;
      for (let k = 0; k < track.commands.length; k++) {
        const command = track.commands[k];
        switch (command.type) {
          case 0:
            let m = 0;
            while (m < timeline.length && time > timeline[m].time) m++;
            let offset = Math.round(time * samplingRate * channelCount / 1000);
            if (offset % channelCount !== 0) offset += channelCount - offset % channelCount;
            if (m == timeline.length) timeline.push({ time, offset, pcmDatas: [] });
            const last = timeline[m].offset + command.pcmData.length;
            if (last > size) size = last;
            timeline[m].pcmDatas.push(command.pcmData);
            break;
          case 1:
            time += command.offset;
            break;
        }
      }
    }
    if (size === 0) continue;
    const pcmData = new Float32Array(size);
    if (timeline.length === 0) continue;
    timeline.push({ offset: 0xFFFFFFFF, pcmDatas: [] });
    const runnings = [];
    let now = timeline[0].offset;
    for (let i = 0; i < timeline.length; i++) {
      const wave = timeline[i];
      const len = wave.offset - now;
      const pcmDatas = [];
      let k = 0;
      while (k < runnings.length) {
        const running = runnings[k];
        let end = running.offset + len;
        if (end >= running.pcmData.length) {
          pcmDatas.push(running.pcmData.slice(running.offset));
          runnings.splice(k, 1);
        } else {
          pcmDatas.push(running.pcmData.slice(running.offset, end));
          running.offset = end;
          k++;
        }
      }
      for (let j = 0; j < wave.pcmDatas.length; j++) {
        runnings.push({
          pcmData: wave.pcmDatas[j],
          offset: 0
        });
      }
      k = now;
      if (pcmDatas.length > 0) {
        let max = 0;
        for (let j = 1; j < pcmDatas.length; j++) if (pcmDatas[j].length > max) max = j;
        for (let j = 0; j < pcmDatas[max].length; j++) {
          let f = 0;
          for (let m = 0; m < pcmDatas.length; m++) {
            if (j < pcmDatas[m].length) f += pcmDatas[m][j];
          }
          if (f > 1.0) f = 1.0;
          if (f < -1.0) f = -1.0;
          pcmData[k++] = f;
        }
      }
      now = wave.offset;
    }
    const wavPath = path.join(wavDir, cueNameMap[i] + '.wav');
    console.log(`Writing ${cueNameMap[i] + '.wav'}...`);
    await hca.writeWavFile(wavPath, mode, channelCount, samplingRate, pcmData);
  }
}
exports.mixAcb = mixAcb;

async function acb2hcas(acbPath, key, hcaDir, type, skip) {
  const pathInfo = path.parse(acbPath);
  console.log(`Parsing ${pathInfo.base}...`);
  const acb = await parseAcb(acbPath);
  if (hcaDir === undefined) hcaDir = path.join(pathInfo.dir, acb.Name);
  if (!fs.existsSync(hcaDir)) {
    await mkdir(hcaDir, { recursive: true });
  } else if (skip) {
    console.log(`Skipped ${pathInfo.base}...`);
    return;
  }
  console.log(`Extracting ${pathInfo.base}...`);
  let memory = 0, stream = 0;
  for (let i = 0; i < acb.WaveformTable.length; i++) {
    const Waveform = acb.WaveformTable[i];
    const isMemory = Waveform.Streaming === 0;
    const hcaBuffer = isMemory ? acb.memoryHcas[Waveform.MemoryAwbId] : acb.streamHcas[Waveform.StreamAwbPortNo][Waveform.StreamAwbId];
    const awbKey = isMemory ? acb.memoryHcas.config.key : acb.streamHcas[Waveform.StreamAwbPortNo].config.key;
    const name = isMemory ? `memory_${++memory}.hca` : `stream_${++stream}.hca`;
    const hcaPath = path.join(hcaDir, name);
    if (key !== undefined) {
      console.log(`Decrypting ${name}...`);
      await hca.decryptHca(hcaBuffer, key, awbKey, type);
    }
    console.log(`Writing ${name}...`);
    await writeFile(hcaPath, hcaBuffer);
  }
}
exports.acb2hcas = acb2hcas;

async function acb2wavs(acbPath, key, wavDir, volume, mode, skip) {
  const pathInfo = path.parse(acbPath);
  console.log(`Parsing ${pathInfo.base}...`);
  const acb = await parseAcb(acbPath);
  if (wavDir === undefined) wavDir = path.join(pathInfo.dir, acb.Name);
  if (!fs.existsSync(wavDir)) {
    await mkdir(wavDir, { recursive: true });
  } else if (skip) {
    console.log(`Skipped ${pathInfo.base}...`);
    return;
  }
  console.log(`Extracting ${pathInfo.base}...`);
  let memory = 0, stream = 0;
  for (let i = 0; i < acb.WaveformTable.length; i++) {
    const Waveform = acb.WaveformTable[i];
    const isMemory = Waveform.Streaming === 0;
    const hcaBuffer = isMemory ? acb.memoryHcas[Waveform.MemoryAwbId] : acb.streamHcas[Waveform.StreamAwbPortNo][Waveform.StreamAwbId];
    const awbKey = isMemory ? acb.memoryHcas.config.key : acb.streamHcas[Waveform.StreamAwbPortNo].config.key;
    const name = isMemory ? `memory_${++memory}.wav` : `stream_${++stream}.wav`;
    const wavPath = path.join(wavDir, name);
    await hca.decodeHcaToWav(hcaBuffer, key, awbKey, wavPath, volume, mode);
  }
}
exports.acb2wavs = acb2wavs;

async function decryptAcb(acbPath, key, type) {
  const pathInfo = path.parse(acbPath);
  console.log(`Parsing ${pathInfo.base}...`);
  const acb = await parseAcb(acbPath);
  console.log(`Decrypting ${pathInfo.base}...`);
  if (acb.memoryHcas) {
    for (let i = 0; i < acb.memoryHcas.length; i++) {
      await hca.decryptHca(acb.memoryHcas[i], key, acb.memoryHcas.config.key, type);
    }
    acb.memoryHcas.config.buffer.writeUInt16BE(0, 0xE);
  }
  for (let i = 0; i < acb.StreamAwbHash.length; i++) {
    for (let j = 0; j < acb.streamHcas[i].length; j++) {
      await hca.decryptHca(acb.streamHcas[i][j], key, acb.streamHcas[i].config.key, type);
    }
    const buffer = acb.streamHcas[i].config.buffer;
    buffer.writeUInt16BE(0, 0xE);
    const md5 = crypto.createHash('md5');
    md5.update(buffer);
    const hash = md5.digest();
    const awb = acb.StreamAwbHash[i];
    hash.copy(awb.Hash);
    await writeFile(path.join(pathInfo.dir, awb.Name + '.awb'), buffer);
    if (acb.StreamAwbAfs2Header) {
      const Header = acb.StreamAwbAfs2Header[i].Header;
      buffer.copy(Header, 0, 0, Header.length);
    }
  }
  await writeFile(acbPath, acb.buffer);
}
exports.decryptAcb = decryptAcb;
