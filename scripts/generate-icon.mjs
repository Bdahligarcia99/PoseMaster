import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'src-tauri', 'icons');

// Ensure icons directory exists
mkdirSync(iconsDir, { recursive: true });

// Create a macOS-style icon with a figure pose and artistic gradient
async function generateIcon(size) {
  // SVG with gradient background, rounded corners, and a stylized figure
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Background gradient - purple to blue -->
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea"/>
          <stop offset="50%" style="stop-color:#764ba2"/>
          <stop offset="100%" style="stop-color:#f093fb"/>
        </linearGradient>
        
        <!-- Glow effect -->
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        <!-- Inner shadow -->
        <filter id="innerShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feOffset dx="0" dy="4"/>
          <feGaussianBlur stdDeviation="6" result="shadow"/>
          <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.3 0"/>
          <feBlend mode="normal" in2="SourceGraphic"/>
        </filter>
      </defs>
      
      <!-- macOS squircle background -->
      <rect x="20" y="20" width="472" height="472" rx="100" ry="100" fill="url(#bgGrad)" filter="url(#innerShadow)"/>
      
      <!-- Subtle inner highlight -->
      <rect x="30" y="30" width="452" height="226" rx="90" ry="90" fill="white" opacity="0.15"/>
      
      <!-- Stylized figure in a dynamic pose -->
      <g transform="translate(256, 256)" filter="url(#glow)">
        <!-- Head -->
        <circle cx="0" cy="-120" r="40" fill="white" opacity="0.95"/>
        
        <!-- Torso -->
        <path d="M 0 -80 Q 30 -20 15 60" stroke="white" stroke-width="28" stroke-linecap="round" fill="none" opacity="0.95"/>
        
        <!-- Left arm raised -->
        <path d="M 0 -60 Q -80 -100 -100 -150" stroke="white" stroke-width="22" stroke-linecap="round" fill="none" opacity="0.95"/>
        
        <!-- Right arm extended -->
        <path d="M 10 -40 Q 70 -10 120 -40" stroke="white" stroke-width="22" stroke-linecap="round" fill="none" opacity="0.95"/>
        
        <!-- Left leg -->
        <path d="M 15 60 Q -20 100 -60 150" stroke="white" stroke-width="24" stroke-linecap="round" fill="none" opacity="0.95"/>
        
        <!-- Right leg -->
        <path d="M 15 60 Q 60 120 100 140" stroke="white" stroke-width="24" stroke-linecap="round" fill="none" opacity="0.95"/>
      </g>
      
      <!-- Timer arc accent -->
      <g transform="translate(256, 256)">
        <circle cx="0" cy="0" r="180" stroke="white" stroke-width="6" fill="none" opacity="0.2" stroke-dasharray="283 1131"/>
      </g>
      
      <!-- Small pencil icon in corner -->
      <g transform="translate(380, 380) rotate(-45)">
        <rect x="0" y="0" width="12" height="60" rx="2" fill="white" opacity="0.8"/>
        <polygon points="6,-10 0,0 12,0" fill="white" opacity="0.8"/>
        <rect x="2" y="50" width="8" height="15" fill="#f8b4c4" opacity="0.9"/>
      </g>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toBuffer();
}

async function main() {
  console.log('Generating PoseMaster icons...');
  
  // Generate main 512x512 icon first
  const icon512 = await generateIcon(512);
  writeFileSync(join(iconsDir, 'icon.png'), icon512);
  console.log('✓ icon.png (512x512)');
  writeFileSync(join(iconsDir, '512x512.png'), icon512);
  console.log('✓ 512x512.png');
  
  // Generate other sizes by resizing the 512x512 (better quality)
  const sizes = [32, 128, 256];
  
  for (const size of sizes) {
    const buffer = await sharp(icon512)
      .resize(size, size, { kernel: 'lanczos3' })
      .png()
      .toBuffer();
    writeFileSync(join(iconsDir, `${size}x${size}.png`), buffer);
    console.log(`✓ ${size}x${size}.png`);
  }
  
  // Generate @2x version for Retina (256px for 128@2x)
  const icon256 = await sharp(icon512)
    .resize(256, 256, { kernel: 'lanczos3' })
    .png()
    .toBuffer();
  writeFileSync(join(iconsDir, '128x128@2x.png'), icon256);
  console.log('✓ 128x128@2x.png');
  
  console.log('\n✅ All icons generated successfully!');
}

main().catch(console.error);
