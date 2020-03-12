# CriTools

JavaScript tools for extract audio from game file

## Requirements

Node.js LTS

## Usage
```shell
node index.js <Command> <Options> <Path>...
```

## Command
```shell
acb2hcas [-d] [-k <key>] [-t <type>] [-o <outputDir>] [-s] <acbPath>...
acb2wavs [-k <key>] [-o <outputDir>] [-v <volume>] [-m <mode>] [-s] <acbPath>...
acb_mix [-k <key>] [-o <outputDir>] [-v <volume>] [-m <mode>] [-s] <acbPath>...
awb2hcas [-d] [-k <key>] [-w <awbKey>] [-t <type>] [-o <outputDir>] [-s] <awbPath>...
awb2wavs [-k <key>] [-o <outputDir>] [-v <volume>] [-m <mode>] [-s] <awbPath>...
hca2wav [-k <key>] [-o <outputFile>] [-v <volume>] [-m <mode>] <hcaPath>...
view_utf [-o <outputFile>] <acbPath/acfPath>...
decrypt_acb [-k <key>] [-t <type>] <acbPath>...
decrypt_awb [-k <key>] [-t <type>] <awbPath>...
decrypt_hca [-k <key>] [-w <awbKey>] [-t <type>] <hcaPath>...
extract_cpk [-o <outputDir>] <cpkPath>...
```

## Options
```shell
-d / --decrypt          Decrypt hca files
-k / --key <key>        Decrypt key
-w / --awbKey <awbKey>  Decrypt key In Awb File (Default: 0)
-t / --type <type>      Hca Encrypt Type (1 / 0) (Default: 1)
-o / --output <output>  Output Directory / File
-v / --volume <volume>  Wav Volume (Default: 1.0)
-m / --mode <mode>      Wav Bit Mode (Default: 16)
-s / --skip             Skip exists files
```

## Features

acb2hcas - Extract acb file to hca files (with/without decrypt)

acb2wavs - Extract acb file and convert hca files To wav files

acb_mix - Experimental. Convert acb file (and awb files) to mixed wav files

awb2hcas - Extract awb file to hca files (with/without decrypt)

awb2wavs - Extract awb file and convert hca files To wav files

hca2wav - Convert hca file To wav file

view_utf - Export data in utf format file to json file (acb/acf file)

decrypt_acb - Decrypt acb file (and awb files) (Warning: will overwrite orignal file)

decrypt_awb - Decrypt awb file (Warning: will overwrite orignal file)

decrypt_hca - Decrypt hca file (Warning: will overwrite orignal file)

extract_cpk - Extract cpk file

## Tips

Drop acb/awb/hca files to win_*.bat is easy to use in Windows.

"CriAtomViewer" In "CRI ADX2 LE" can play acb/awb/hca files with encrypt type 1 (encrypt type 0 / 56 is not supported).

Some awb files in pc/web game is encrypted and not supported.

An easy way to find key: [esterTion - 有关于criware的一点最终解决方案](https://estertion.win/2019/10/%e6%9c%89%e5%85%b3%e4%ba%8ecriware%e7%9a%84%e4%b8%80%e7%82%b9%e6%9c%80%e7%bb%88%e8%a7%a3%e5%86%b3%e6%96%b9%e6%a1%88/)

## License
MIT

## Credits
* [Nyagamon/HCADecoder: HCA Decoder](https://github.com/Nyagamon/HCADecoder)
* [头蟹床(Headcrabbed) - The "New" Encryption of HCA Audio](https://blog.mottomo.moe/categories/Tech/RE/en/2018-10-12-New-HCA-Encryption/)