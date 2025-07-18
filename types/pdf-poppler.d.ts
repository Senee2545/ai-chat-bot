declare module "pdf-poppler" {
    export function convert(
      inputFile: string,
      options?: {
        format?: string;
        out_dir?: string;
        out_prefix?: string;
        page?: number | null;
      }
    ): Promise<void>;
  }
  