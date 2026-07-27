/*
 * dotenv 8 non porta con sé i propri tipi, e `@types/dotenv` non è installabile
 * qui (node_modules è di root). Serve solo `config`, quindi lo si dichiara:
 * poche righe invece di una dipendenza, e `strict` può restare acceso.
 */
declare module "dotenv" {
  export function config(options?: {
    path?: string;
    encoding?: string;
    override?: boolean;
  }): { parsed?: Record<string, string>; error?: Error };

  const dotenv: { config: typeof config };
  export default dotenv;
}
