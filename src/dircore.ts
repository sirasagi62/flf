import { env } from "@huggingface/transformers";
import {
  createParserFactory,
  Point,
  readDirectoryAndChunk,
  type LanguageEnum,
  type Options,
} from "code-chopper";
import * as path from "node:path";
import {
  HFLocalEmbeddingModel,
  VeqliteDB,
  type BaseMetadata
} from "veqlite";
// import { BetterSqlite3Adapter } from "veqlite/better-sqlite3"
//import { NodeSQLiteAdapter } from "veqlite/node";
import { PGLiteAdapter } from "veqlite/pglite";
import { ChunkMeta, IFlfCore, ListItem, OutputType, QueryProps } from "./types.js";
//import { BunSQLiteAdapter } from "veqlite/bun";


// Set environment variables for transformers.js
env.allowRemoteModels = true; // Allow fetching models from Hugging Face Hub if not found locally



export class FlfDirCore implements IFlfCore {
  db?: VeqliteDB<ChunkMeta>;
  public static async init(dbPath: string) {
    const _this = new FlfDirCore()

    // Initialize the embedding pipeline
    const embeddingModel = await HFLocalEmbeddingModel.init(
      //"sirasagi62/granite-embedding-107m-multilingual-ONNX",
      "sirasagi62/ruri-v3-70m-code-v0.1-ONNX",
      384,
      "q8"
    );
    const db = new PGLiteAdapter(dbPath)
    // const db = new BetterSqlite3Adapter(dbPath)
    // const db = new BunSQLiteAdapter(dbPath,"/opt/homebrew/Cellar/sqlite/3.50.4/lib/libsqlite3.dylib")
    _this.db = await VeqliteDB.init<ChunkMeta>(embeddingModel, db);
    return _this
  }
  async indexDirectory(
    dirPath: string,
  ) {

    const db = this.db
    if (!db) throw Error("DB must be initialized before indexing.")
    const factory = createParserFactory();
    const options: Options = {
      filter: (_, node) => {
        if (node.type.includes("import") || node.type.includes("comment")) {
          return false;
        }
        return true;
      },
      excludeDirs: [/node_modules/, /\.git/,/dist/],
    };


    try {
      const chunks = await readDirectoryAndChunk(factory, options, dirPath);

      db.bulkInsertChunks(chunks.map(c => {
        return {
          content: c.content,
          filepath: c.filePath,
          fileName: path.basename(c.filePath),
          inlineDocument: c.boundary.docs ?? "",
          parentInfo: c.boundary.parent?.join(".") ?? "",
          entity: c.boundary.name ?? "",
          language: c.language,
          cursorInfo: {
            start: c.start,
            end: c.end
          }
        }
      })); // Use bulkInsertChunks for efficiency
      return chunks.length
    } finally {
      factory.dispose();
    }
  }
  async search(
    {
      queryText,
      k,
      isJsonOutput,
    }: QueryProps
  ) {
    const db = this.db
    if (!db) throw new Error("DB must be initialized before searching.")
    const results = await db.searchSimilar(queryText, k)
    return results.map((result, index) => ({
      rank: index + 1,
      file: result.filepath,
      fileName: result.fileName,
      contentSnippet: isJsonOutput
        ? result.content
        : result.content.substring(0, 100) + "...",
      entity: result.entity,
      parentInfo: result.parentInfo,
      score: result.distance.toFixed(4),
      language: result.language,
      cursorInfo: result.cursorInfo
    }));

  }
  formatResult(result: ListItem, outputType: OutputType): string {
    let query = JSON.stringify(result)
    if (outputType === "nvim" || outputType === "vim") {
      query = `<cmd>tabf +${result.cursorInfo.start.row + 1} ${result.filePath}<CR>`
    }
    return query
  }

  deinit() {
    if(this.db) this.db.close()
  }
}

export async function buildFlfCodeSearchCore(dbPath: string) {
  const core = await FlfDirCore.init(dbPath)
  return {
    core,
    [Symbol.dispose]() {
      core.deinit()
    }
  };
}

// This unused print UI
export class FlfCodeSearchUI {
  core?: FlfDirCore;
  isJsonOutput: boolean = false
  constructor(isJsonOutput: boolean) {
    this.isJsonOutput = isJsonOutput
  }
  public static async init(dbPath: string, isJsonOutput: boolean) {
    const _this = new FlfCodeSearchUI(isJsonOutput)
    _this.core = await FlfDirCore.init(dbPath)
    return _this
  }
  async executeIndex(
    dirPath: string,
  ) {
    if (!this.core) throw new Error("Core must be initialized before indexing.")
    try {

      const indexedCount = await this.core.indexDirectory(dirPath)
      if (!indexedCount) throw new Error("indexedCount is undefined.")
      if (indexedCount > 0) {
        if (this.isJsonOutput) {
          console.log(
            JSON.stringify({
              status: "success",
              message: `Indexed ${indexedCount} code chunks.`,
              directory: path.resolve(dirPath),
            })
          );
        } else {
          console.log(`Indexed ${indexedCount} code chunks.`);
        }
      } else {
        if (this.isJsonOutput) {
          console.log(
            JSON.stringify({
              status: "success",
              message: "No code chunks found to index.",
              directory: path.resolve(dirPath),
            })
          );
        } else {
          console.log("No code chunks found to index.");
        }
      }
    } catch (error: unknown) {
      if (this.isJsonOutput) {
        if (error instanceof Error)
          console.error(
            JSON.stringify({
              status: "error",
              message: `Error during directory indexing: ${error.message}`,
              directory: path.resolve(dirPath),
            })
          );
      } else {
        console.error(`Error during directory indexing:`, error);
      }
    }
  }
  async executeQuery(
    {
      queryText,
      k,
      isJsonOutput = this.isJsonOutput,
      dbPath = ".flf.db"
    }: QueryProps
  ) {
    if (!this.core) throw Error("Core must be initialized.")
    const output = await this.core.search({
      queryText,
      k,
      isJsonOutput,
      dbPath
    })
    if (output.length > 0) {
      if (isJsonOutput) {
        console.log(
          JSON.stringify({
            status: "success",
            query: queryText,
            k: k,
            results: output,
          })
        );
      } else {
        console.log(`Top ${k} results for query "${queryText}":`);
        output.forEach((res) => {
          console.log(`- File: ${res.file}`);
          console.log(`  Content Snippet: ${res.contentSnippet}`);
          console.log(`  Score: ${res.score}`);
          console.log(`  Entity: ${res.entity}`);
          console.log(`  Parent: ${res.parentInfo}`);
        });
      }
    } else {
      if (isJsonOutput) {
        console.log(
          JSON.stringify({
            status: "success",
            query: queryText,
            k: k,
            results: [],
          })
        );
      } else {
        console.log(`No results found for query "${queryText}".`);
      }
    }
  }
}







