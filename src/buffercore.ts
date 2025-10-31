import { env } from "@huggingface/transformers";
import {
  BoundaryChunk,
  createParserFactory,
  parseCodeWithFilePath,
  type Options,
} from "code-chopper";
import * as path from "node:path";
import {
  HFLocalEmbeddingModel,
  VeqliteDB
} from "veqlite";
import { PGLiteAdapter } from "veqlite/pglite";
import { BufferInfo, loadBufferInfoAsync } from "./buffer-loader.js";
import { ChunkMeta, QueryProps, IFlfCore, SearchResult, ListItem, OutputType } from "./types.js";


// Set environment variables for transformers.js
env.allowRemoteModels = true; // Allow fetching models from Hugging Face Hub if not found locally


// TODO: Except for the `index` function, the implementation is the same as `FlfDirCore`, so I'll combine them later.
export class FlfBufferCore implements IFlfCore {
  db?: VeqliteDB<ChunkMeta>;
  public static async init(dbPath: string) {
    const _this = new FlfBufferCore()

    // Initialize the embedding pipeline
    const embeddingModel = await HFLocalEmbeddingModel.init(
      //"sirasagi62/granite-embedding-107m-multilingual-ONNX",
      "sirasagi62/ruri-v3-70m-code-v0.1-ONNX",
      384,
      "q8"
    );
    const db = new PGLiteAdapter(dbPath)
    _this.db = await VeqliteDB.init<ChunkMeta>(embeddingModel, db);
    return _this
  }

  async index(
    bufferInfoPath: string,
  ) {
    const db = this.db
    if (!db) throw Error("DB must be initialized before indexing.")
    const bufferInfo: BufferInfo[] = await loadBufferInfoAsync(bufferInfoPath)
    const factory = createParserFactory();
    const options: Options = {
      filter: (_, node) => {
        if (node.type.includes("import") || node.type.includes("comment")) {
          return false;
        }
        return true;
      },
      excludeDirs: [/node_modules/, /\.git/, /dist/],
    };


    try {
      let chunks: BoundaryChunk[] = []
      for (const bi of bufferInfo) {
        const i = await parseCodeWithFilePath(bi.content, bi.buffername, factory, options)
        chunks = [...chunks, ...i]
      }
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
  ): Promise<SearchResult[]> {
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
      //query = `<cmd>b +${result.cursorInfo.start.row + 1} ${result.filePath}<CR>`
      query = `<cmd>call FlfJumpToBufWithLine("${result.filePath}","${result.cursorInfo.start.row + 1}")<CR>`
      // query = `<cmd>tabf +${result.cursorInfo.start.row + 1} ${result.filePath}<CR>`
    }
    return query
  }

  deinit() {
    if (this.db) this.db.close()
  }
}

export async function buildFlfCodeSearchCore(dbPath: string) {
  const core = await FlfBufferCore.init(dbPath)
  return {
    core,
    [Symbol.dispose]() {
      core.deinit()
    }
  };
}









