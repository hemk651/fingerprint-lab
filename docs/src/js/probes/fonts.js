/**
 * Font availability.
 *
 * Measures a long candidate list by glyph width against the three generic
 * font families. A candidate counts as present only when it measures
 * differently from all three baselines, which rules out silent substitution
 * to the default font -- the failure mode that makes naive font detection
 * report everything as installed.
 *
 * The specific *combination* of installed fonts is the signal, not the count:
 * "Segoe UI + Calibri + Noto Color Emoji" and "Helvetica Neue + SF Pro +
 * Apple Color Emoji" are two different machines worth hundreds of thousands
 * of combinations between them.
 */

const CANVAS_FONT = "72px ";
const TEST_STRING = "mmmmmmmmmmlliWwmMWM0OoO";

const FONT_FAMILIES = [
  "Arial", "Arial Black", "Arial Narrow", "Arial Rounded MT Bold",
  "Bahnschrift", "Calibri", "Cambria", "Cambria Math", "Candara", "Century Gothic",
  "Comic Sans MS", "Consolas", "Constantia", "Corbel", "Ebrima", "Franklin Gothic Medium",
  "Gabriola", "Gadugi", "Georgia", "HoloLens MDL2 Assets", "Impact", "Ink Free",
  "Javanese Text", "Leelawadee UI", "Lucida Console", "Lucida Sans Unicode",
  "Malgun Gothic", "Marlett", "Microsoft Himalaya", "Microsoft JhengHei",
  "Microsoft New Tai Lue", "Microsoft PhagsPa", "Microsoft Sans Serif",
  "Microsoft Tai Le", "Microsoft YaHei", "MingLiU-ExtB", "Mongolian Baiti",
  "MS Gothic", "MV Boli", "Myanmar Text", "Nirmala UI", "Palatino Linotype",
  "Segoe MDL2 Assets", "Segoe Print", "Segoe Script", "Segoe UI", "SimSun",
  "Sitka", "Sylfaen", "Symbol", "Tahoma", "Times New Roman", "Trebuchet MS",
  "Verdana", "Webdings", "Wingdings",
  "American Typewriter", "Andale Mono", "Apple Chancery", "Avenir", "Avenir Next",
  "Baskerville", "Big Caslon", "Bodoni 72", "Bradley Hand", "Brush Script MT",
  "Chalkboard", "Chalkduster", "Cochin", "Copperplate", "Courier", "Courier New",
  "Didot", "Futura", "Geneva", "Gill Sans", "Helvetica", "Helvetica Neue",
  "Herculanum", "Hoefler Text", "Iowan Old Style", "Lucida Grande", "Luminari",
  "Marker Felt", "Menlo", "Monaco", "Noteworthy", "Optima", "Papyrus",
  "Rockwell", "San Francisco", "Savoye LET", "Skia", "Snell Roundhand",
  "Trattatello", "Zapfino",
  "Ubuntu", "DejaVu Sans", "DejaVu Serif", "Liberation Sans", "Liberation Serif",
  "Liberation Mono", "Noto Sans", "Noto Serif", "Noto Color Emoji", "Roboto",
  "Droid Sans", "Cantarell", "FreeSans", "FreeSerif", "Nimbus Sans", "URW Gothic",
  "Symbola", "Twemoji Mozilla", "EmojiOne Color",
];

export const probe = {
  id: "fonts",
  label: "Font availability",
  family: "software",
  bits: 9.0,
  async run() {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return { available: false, note: "No 2D context for measurement." };

    const measure = (font) => {
      ctx.font = CANVAS_FONT + font;
      return ctx.measureText(TEST_STRING).width;
    };

    const baselines = Array.from(
      new Set([measure("monospace"), measure("sans-serif"), measure("serif")])
    );

    const present = [];
    const absent = [];
    for (const family of FONT_FAMILIES) {
      const width = measure(family);
      // Present only if distinct from every generic baseline.
      (baselines.includes(width) ? absent : present).push(family);
    }

    let documentFonts = null;
    try {
      documentFonts = {
        count: document.fonts.size,
        loaded: Array.from(document.fonts).map(
          (f) => `${f.family} ${f.weight} ${f.style}`
        ),
      };
    } catch {
      documentFonts = null;
    }

    return {
      available: true,
      candidatesMeasured: FONT_FAMILIES.length,
      detected: present.length,
      fontList: present,
      notDetected: absent.length,
      documentFonts,
      note:
        "Detection is by glyph-width comparison, so a substituted font reads "
        + "as absent. Reported as a list, not only a count, because the "
        + "combination is the signal.",
    };
  },
};
