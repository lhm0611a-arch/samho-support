declare module 'hangul-js' {
  export function search(a: string, b: string): number;
  export class Searcher {
    constructor(searchString: string);
    search(targetString: string): number;
  }
}
