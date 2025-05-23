// // ttf2js.js
// const fs = require('fs');
// const fontkit = require('fontkit');

// if (process.argv.length < 5) {
//   console.log('Usage: node ttf2js.js <input.ttf> <output.js> <fontName>');
//   process.exit(1);
// }

// const input = process.argv[2];
// const output = process.argv[3];
// const fontName = process.argv[4];

// const fontData = fs.readFileSync(input);
// const font = fontkit.create(fontData);

// const fontFile = fontData.toString('base64');

// fs.writeFileSync(output, js);
// console.log('Font file generated:', output);