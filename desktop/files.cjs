const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const FORMATS = new Set('mp4 mov mkv webm avi gif mp3 wav flac aac m4a ogg opus'.split(' '));
const MEDIA = new Set([...FORMATS, ...'wmv flv ts 3gp wma aiff aif hevc m2ts mts mpeg mpg m4v mka oga vob'.split(' ')]);

class MediaFiles {
  constructor() { this.items = new Map(); }
  async collect(paths) {
    if (!Array.isArray(paths) || paths.some(p => typeof p !== 'string')) throw new Error('Invalid file selection.');
    const files = [], warnings = [], seen = new Set();
    const visit = async filename => {
      try {
        const stat = await fs.lstat(filename);
        // Do not follow links or junctions outside the selected directory tree.
        if (stat.isSymbolicLink()) return;
        if (stat.isDirectory()) {
          for (const child of (await fs.readdir(filename)).sort()) await visit(path.join(filename, child));
        } else if (stat.isFile() && MEDIA.has(path.extname(filename).slice(1).toLowerCase())) {
          const resolved = await fs.realpath(filename);
          if (seen.has(resolved)) return;
          seen.add(resolved);
          let id = [...this.items].find(([, value]) => value.path === resolved)?.[0];
          if (!id) { id = randomUUID(); this.items.set(id, { path: resolved }); }
          files.push({ id, name: path.basename(resolved), size: stat.size, folder: path.dirname(resolved), type: /\.(mp3|wav|flac|aac|m4a|ogg|opus|wma|aiff|aif|mka|oga)$/i.test(resolved) ? 'audio/' : 'video/' });
        }
      } catch (error) { warnings.push(`${filename}: ${error.message}`); }
    };
    for (const filename of paths) await visit(path.resolve(filename));
    return { files, warnings };
  }
  item(id) {
    const item = this.items.get(id);
    if (!item) throw new Error('Select this file again.');
    return item;
  }
  async read(id) { return fs.readFile(this.item(id).path); }
  async save(id, ext, bytes) {
    const item = this.item(id);
    if (!FORMATS.has(ext) || !(bytes instanceof Uint8Array) || !bytes.length) throw new Error('Invalid conversion output.');
    const parsed = path.parse(item.path);
    // Exclusive creation protects both the original and previous conversions.
    for (let index = 0; ; index++) {
      const destination = path.join(parsed.dir, `${parsed.name}${index ? ` (${index})` : ''}.${ext}`);
      let handle;
      try { handle = await fs.open(destination, 'wx'); }
      catch (error) { if (error.code === 'EEXIST') continue; throw error; }
      try { await handle.writeFile(bytes); }
      catch (error) { await handle.close(); await fs.unlink(destination).catch(() => {}); throw error; }
      await handle.close();
      item.output = destination;
      return destination;
    }
  }
}
module.exports = { MediaFiles };
