const fs = require('fs');
const util = require('util');
const path = require('path');
const utf = require('./utf');
const afs2 = require('./afs2');
const acb = require('./acb');
const hca = require('./hca');
const cpk = require('./cpk');

const lstat = util.promisify(fs.lstat);
const readdir = util.promisify(fs.readdir);

function usage() {
  console.log(`Usage: node index.js <Command> <Options> <Path>...`);
  console.log(`Command:`);
  console.log(`\tacb2hcas [-d] [-k <key>] [-t <type>] [-o <outputDir>] [-s] <acbPath>...`);
  console.log(`\tacb2wavs [-k <key>] [-o <outputDir>] [-v <volume>] [-m <mode>] [-s] <acbPath>...`);
  console.log(`\tawb2hcas [-d] [-k <key>] [-t <type>] [-o <outputDir>] [-s] <awbPath>...`);
  console.log(`\tawb2wavs [-k <key>] [-o <outputDir>] [-v <volume>] [-m <mode>] [-s] <awbPath>...`);
  console.log(`\thca2wav [-k <key>] [-w <awbKey>] [-o <outputFile>] [-v <volume>] [-m <mode>] <hcaPath>...`);
  console.log(`\tview_utf [-o <outputFile>] <acbPath/acfPath>...`);
  console.log(`\tdecrypt_acb [-k <key>] [-t <type>] <acbPath>...`);
  console.log(`\tdecrypt_awb [-k <key>] [-t <type>] <awbPath>...`);
  console.log(`\tdecrypt_hca [-k <key>] [-w <awbKey>] [-t <type>] <hcaPath>...`);
  console.log(`\tacb_mix [-k <key>] [-o <outputDir>] [-v <volume>] [-m <mode>] [-s] <acbPath>...`);
  console.log(`\textract_cpk [-o <outputDir>] <cpkPath>...`);
  console.log(`Options:`);
  console.log(`\t-d / --decrypt          Decrypt hca files`);
  console.log(`\t-k / --key <key>        Decrypt key`);
  console.log(`\t-w / --awbKey <awbKey>  Decrypt key In Awb File`);
  console.log(`\t-t / --type <type>      Hca Encrypt Type (1 / 0) (Default: 1)`);
  console.log(`\t-o / --output <output>  Output Directory / File`);
  console.log(`\t-v / --volume <volume>  Wav Volume (Default: 1.0)`);
  console.log(`\t-m / --mode <mode>      Wav Bit Mode (Default: 16)`);
  console.log(`\t-s / --skip             Skip exists files`);
}

async function handlePathes(pathes, ext) {
  let i = 0;
  while (i < pathes.length) {
    const path1 = pathes[i];
    if (fs.existsSync(path1)) {
      const stats1 = await lstat(path1);
      if (stats1.isDirectory()) {
        pathes.splice(i, 1);
        const files = await readdir(path1);
        for (let j = 0; j < files.length; j++) {
          const base = files[j];
          const path2 = path.join(path1, base);
          const stats2 = await lstat(path2);
          if (path.parse(base).ext === ext || stats2.isDirectory()) {
            pathes.push(path2);
          }
        }
      } else if (ext && path.parse(path1).ext !== ext) {
        pathes.splice(i, 1);
      } else {
        i++;
      }
    } else {
      pathes.splice(i, 1);
    }
  }
}

(async () => {
  const argv = process.argv;
  if (argv.length < 3) {
    usage();
    return;
  }
  let decrypt = false, key = undefined, awbKey = undefined, output = undefined, volume = 1, mode = 16, type = 1, skip = false;
  let i = 3;
  const pathes = [];
  while (i < argv.length) {
    const arg = argv.splice(i, 1)[0];
    if (arg === '-d' || arg === '--decrypt') {
      decrypt = true;
    } else if (arg === '-k' || arg === '--key') {
      key = argv.splice(i, 1)[0];
    } else if (arg === '-w' || arg === '--awbKey') {
      awbKey = parseInt(argv.splice(i, 1)[0], 10);
    } else if (arg === '-o' || arg === '--output') {
      output = argv.splice(i, 1)[0];
    } else if (arg === '-v' || arg === '--volume') {
      volume = parseFloat(argv.splice(i, 1)[0], 10);
    } else if (arg === '-m' || arg === '--mode') {
      mode = parseInt(argv.splice(i, 1)[0], 10);
    } else if (arg === '-t' || arg === '--type') {
      type = parseInt(argv.splice(i, 1)[0], 10);
    } else if (arg === '-s' || arg === '--skip') {
      skip = true;
    } else {
      pathes.push(arg);
    }
  }
  if (pathes.length === 0) {
    usage();
    return;
  }
  try {
    switch (argv[2]) {
      case 'acb2hcas':
        if (!decrypt) key = undefined;
        await handlePathes(pathes, '.acb');
        for (let i = 0; i < pathes.length; i++) await acb.acb2hcas(pathes[i], key, output, type, skip);
        break;
      case 'acb2wavs':
        await handlePathes(pathes, '.acb');
        for (let i = 0; i < pathes.length; i++) await acb.acb2wavs(pathes[i], key, output, volume, mode, skip);
        break;
      case 'awb2hcas':
        if (!decrypt) key = undefined;
        await handlePathes(pathes, '.awb');
        for (let i = 0; i < pathes.length; i++) await afs2.awb2hcas(pathes[i], key, output, type, skip);
        break;
      case 'awb2wavs':
        await handlePathes(pathes, '.awb');
        for (let i = 0; i < pathes.length; i++) await afs2.awb2wavs(pathes[i], key, output, volume, mode, skip);
        break;
      case 'hca2wav':
        await handlePathes(pathes, '.hca');
        for (let i = 0; i < pathes.length; i++) await hca.decodeHcaToWav(pathes[i], key, awbKey, output, volume, mode);
        break;
      case 'view_utf':
        await handlePathes(pathes);
        for (let i = 0; i < pathes.length; i++) await utf.viewUtf(pathes[i], output);
        break;
      case 'decrypt_acb':
        await handlePathes(pathes, '.acb');
        for (let i = 0; i < pathes.length; i++) await acb.decryptAcb(pathes[i], key, type);
        break;
      case 'decrypt_awb':
        await handlePathes(pathes, '.awb');
        for (let i = 0; i < pathes.length; i++) await afs2.decryptAwb(pathes[i], key, type);
        break;
      case 'decrypt_hca':
        await handlePathes(pathes, '.hca');
        for (let i = 0; i < pathes.length; i++) await hca.decryptHca(pathes[i], key, awbKey, type, pathes[i]);
        break;
      case 'acb_mix':
        await handlePathes(pathes, '.acb');
        for (let i = 0; i < pathes.length; i++) await acb.mixAcb(pathes[i], key, output, mode, skip);
        break;
      case 'extract_cpk':
        await handlePathes(pathes, '.cpk');
        for (let i = 0; i < pathes.length; i++) await cpk.extractCpk(pathes[i], output);
        break;
      default:
        usage();
        break;
    }
    console.log('FINISH!');
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    debugger;
  }
})();
