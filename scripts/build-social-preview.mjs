import sharp from 'sharp';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const input=fileURLToPath(new URL('../public/grizzly-social-v2.svg',import.meta.url));
const output=fileURLToPath(new URL('../public/grizzly-social-v2.png',import.meta.url));
const svg=await readFile(input);
await sharp(svg,{density:144})
 .resize(1200,630,{fit:'fill'})
 .png({compressionLevel:9,palette:true,quality:100,effort:10})
 .toFile(output);
const result=await sharp(output).metadata();
if(result.width!==1200||result.height!==630||result.format!=='png')throw new Error('Invalid social preview dimensions/format');
console.log('Built GRIZZLY social preview: '+(await stat(output)).size+' bytes (1200×630 PNG)');
