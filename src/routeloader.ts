import { Router } from 'express';
import { glob } from 'fast-glob';
import { statSync } from 'fs';
import path from 'path';

export default async function RouteLoader(globPattern: string) {
  let router = Router();
  let files: string[] = [];
  try {
    files = await glob(globPattern);
  } catch (e) {
    console.error(e);
  }

  for (const file of files) {
    if (statSync(file).isFile() && path.extname(file).toLowerCase() === '.ts') {
      try {
        const routeModule = await import(path.resolve(file));
        router = (routeModule.default || routeModule)(router);
      } catch (e) {
        throw new Error(`Error when loading route file: ${file} [ ${e} ]`);
      }
    }
  }

  return router;
}
