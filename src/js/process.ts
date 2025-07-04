import rgbToTerm from './rgbToTerm';

export type processOptions = {
  colours: string;
  maxHeight: number;
  maxWidth: number;
  unicode: boolean;
  wantedChars: string;
};

const canvas: HTMLCanvasElement = document.createElement('canvas'),
  context: CanvasRenderingContext2D = canvas.getContext(
    '2d'
  ) as CanvasRenderingContext2D;

const rgbaToAnsi = (
    rgba: Uint8ClampedArray | [number, number, number, number],
    options: processOptions,
    foreground: boolean = false
  ): string => {
    const [r, g, b] = rgba;

    // if we're mostly transparent (less than 0.05 opacity) return transparent (default)
    if (isTransparent(rgba)) {
      return foreground ? '39' : '49';
    }

    if (options.colours === 'true') {
      return `${foreground ? 38 : 48};2;${r ?? 0};${g ?? 0};${b ?? 0}`;
    }

    return `${foreground ? 38 : 48};5;${rgbToTerm(r ?? 0, g ?? 0, b ?? 0)}`;
  },
  isTransparent = ([, , , a]:
    | Uint8ClampedArray
    | [number, number, number, number]): boolean => (a ?? 0) < 13;

// Helper to escape special characters for use in a Regular Expression
const escapeRegExp = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const process = (
  image: CanvasImageSource,
  options: processOptions
): string => {
  let imageWidth = image.width as number,
    imageHeight = image.height as number,
    content: string = '';

  const [full = ' ', top = '▀', bottom = '▄'] = (
    options.wantedChars || ' ▀▄'
  ).split('');

  if (imageWidth > options.maxWidth) {
    const scale = imageWidth / options.maxWidth;

    imageWidth = options.maxWidth;
    imageHeight = Math.floor(imageHeight / scale);
  }

  if (imageHeight > options.maxHeight) {
    const scale = imageHeight / options.maxHeight;

    imageHeight = options.maxHeight;
    imageWidth = Math.floor(imageWidth / scale);
  }

  canvas.width = imageWidth;
  canvas.height = imageHeight;

  context.drawImage(image, 0, 0, imageWidth, imageHeight);

  const imageData = context.getImageData(0, 0, imageWidth, imageHeight),
    pixelData = imageData.data;

  // Loop over each pixel and invert the color.
  for (let i = 0, n = pixelData.length; i < n; ) {
    const endOfLine = (): boolean => i > 0 && (i / 4) % imageWidth === 0;

    if (options.unicode) {
      const topPixel = pixelData.slice(i, i + 4),
        bottomPixel = pixelData.slice(
          i + imageWidth * 4,
          i + 4 + imageWidth * 4
        );

      if (
        (topPixel[0] === bottomPixel[0] &&
          topPixel[1] === bottomPixel[1] &&
          topPixel[2] === bottomPixel[2] &&
          !isTransparent(topPixel) &&
          !isTransparent(bottomPixel)) ||
        (isTransparent(topPixel) && isTransparent(bottomPixel))
      ) {
        content += `\x1b[${rgbaToAnsi(topPixel, options)}m${full}`;
      } else {
        if (isTransparent(bottomPixel) && !isTransparent(topPixel)) {
          content += `\x1b[${rgbaToAnsi(bottomPixel, options)};${rgbaToAnsi(
            topPixel,
            options,
            true
          )}m${top}`;
        } else {
          content += `\x1b[${rgbaToAnsi(
            bottomPixel,
            options,
            true
          )};${rgbaToAnsi(topPixel, options)}m${bottom}`;
        }
      }

      i += 4;

      if (endOfLine()) {
        i += 4 * imageWidth;

        content += '\x1b[m\n';
      }

      continue;
    }

    content += `\x1b[${rgbaToAnsi(
      pixelData.slice(i, i + 4),
      options
    )}m${full}${full}`;

    i += 4;

    if (endOfLine()) {
      content += '\x1b[m\n';
    }
  }

  // minimise output, replacing contiguous definitions
  const minimisationRegex = new RegExp(
    `(\\x1b\\[[0-9;]+m)([${escapeRegExp(bottom)}${escapeRegExp(
      top
    )}${escapeRegExp(full)}]+)\\1`,
    'g'
  );
  while (content.match(minimisationRegex)) {
    content = content.replace(minimisationRegex, '$1$2');
  }

  return content;
};

export default process;
