import { LanguageEnum, Point } from "code-chopper"
import { BaseMetadata } from "veqlite"


export type OutputType = "nvim" | "vim" | "emacs" | "cmd"

export type ChunkMeta = {
  fileName: string
  parentInfo: string
  inlineDocument: string
  entity: string
  language: LanguageEnum
  cursorInfo: {
    start: Point
    end: Point
  }
} & BaseMetadata

export interface QueryProps {
  queryText: string,
  k: number,
  isJsonOutput: boolean,
  dbPath: string
}

export interface SearchResult {
  rank: number;
  file: string;
  fileName: string;
  contentSnippet: string;
  entity: string;
  parentInfo: string;
  score: string;
  language: string;
  cursorInfo: {
    start: Point,
    end: Point
  };
}

export interface ListItem {
  filePath: string,
  entity: string,
  content: string,
  language: string
  cursorInfo: {
    start: Point,
    end: Point
  }
}


export interface IFlfCore {
  /**
   * Searches for similar content chunks based on a query string.
   * @param props The query properties, including the query text, number of results (k), and output format flag.
   * @returns A promise that resolves to an array of search results.
   */
  search(
    props: QueryProps
  ): Promise<SearchResult[]>;


  formatResult(result: ListItem, outputType: OutputType): string

  /**
   * Performs cleanup, such as closing the database connection.
   */
  deinit(): void;
}
