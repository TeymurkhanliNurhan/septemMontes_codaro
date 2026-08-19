const fs = require('fs');
const path = require('path');

function walk(dir) {
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!file.endsWith('.controller.ts')) continue;

    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(
      /import type \{ AuthenticatedRequest \} from '\.\.\/common\/types\/authenticated-request';\n?/g,
      '',
    );
    content = content.replace(
      /import \{ AuthenticatedRequest \} from '\.\.\/common\/types\/authenticated-request';\n?/g,
      '',
    );
    content = content.replace(/req: AuthenticatedRequest/g, 'req: any');
    fs.writeFileSync(fullPath, content);
  }
}

walk('src');
console.log('Simplified req typing');
