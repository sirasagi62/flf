

import {
  createParserFactory,
  readDirectoryAndChunk,
  type Options,
} from "code-chopper";
import * as path from "path";
import { env } from "@huggingface/transformers";
import {
  HFLocalEmbeddingModel,
  VeqliteDB,
  type BaseMetadata
} from "veqlite"

// Set environment variables for transformers.js
env.allowRemoteModels = true; // Allow fetching models from Hugging Face Hub if not found locally

type ChunkMeta = {
  fileName: string
  parentInfo: string
  inlineDocument: string
  entity: string
} & BaseMetadata

interface QueryProps {
  queryText: string,
  k: number,
  isJsonOutput: boolean,
  dbPath: string
}

class FlfCodeSearchCore {
  db?: VeqliteDB<ChunkMeta> = undefined;
  public static async init(dbPath: string) {
    const self = new FlfCodeSearchCore()

    // Initialize the embedding pipeline
    const embeddingModel = await HFLocalEmbeddingModel.init(
      "sirasagi62/granite-embedding-107m-multilingual-ONNX",
      384,
      "q8"
    );
    self.db = new VeqliteDB<ChunkMeta>(embeddingModel, {
      // Use in-memory database
      embeddingDim: 384,
      dbPath
    });
    return self
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
      excludeDirs: [/node_modules/, /\.git/],
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
          entity: c.boundary.name ?? ""
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
      parent_info: result.parentInfo,
      score: result.distance.toFixed(4),
    }));

  }
}

class FlfCodeSearchUI {
  core?: FlfCodeSearchCore;
  isJsonOutput: boolean = false
  constructor(isJsonOutput: boolean) {
    this.isJsonOutput = isJsonOutput
  }
  public static async init(dbPath: string, isJsonOutput: boolean) {
    const self = new FlfCodeSearchUI(isJsonOutput)
    self.core = await FlfCodeSearchCore.init(dbPath)
    return self
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
          console.log(`  Parent: ${res.parent_info}`);
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







