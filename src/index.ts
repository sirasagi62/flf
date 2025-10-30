#!/usr/bin/env node

// Supress warining on iTerm
import os from "node:os";
if (os.type() === "Darwin" && process.env.TERM?.includes("xterm"))
  process.env.TERM = "iTerm.app"

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers'

import blessed from 'blessed';
import { highlight } from 'cli-highlight';
import { FlfCodeSearchCore } from "./core.js";
import { Point } from "code-chopper";
import fs from "node:fs"
import tty from "node:tty"

type OutputType = "nvim" | "vim" | "emacs" | "cmd"
interface UIOptions {
  editor: OutputType
}
const setupTTY = () => {
  if (process.versions.bun && os.type() === "Darwin") {
    console.log(`Due to a bug in Bun on macOS, the pipe functionality is not available in Bun.
See here for details: https://github.com/oven-sh/bun/issues/24158`)
    return { input: process.stdin, output: process.stdout };
  } else {

    const ttyIn = new tty.ReadStream(fs.openSync("/dev/tty", "r"));
    const ttyOut = new tty.WriteStream(fs.openSync("/dev/tty", "w"));
    ttyIn.resume();
    ttyIn.setRawMode(true);
    return {
      input: ttyIn,
      output: ttyOut
    }
  }
}

const { input: ttyIn, output: ttyOut } = setupTTY()
const DEBUG = false
const LOGO = `

 ███████╗ ██╗      ███████╗
 ██╔════╝ ██║      ██╔════╝
 █████╗   ██║      █████╗
 ██╔══╝   ██║      ██╔══╝
 ██║      ███████╗ ██║
 ╚═╝      ╚══════╝ ╚═╝
`
// 検索対象のリスト
interface UnicodeKey {
  ch: string,
  full: string,
  name: null
}
interface AsciiKey {
  sequence: string,
  ctrl: boolean,
  shift: boolean,
  meta: boolean,
  name: string,
  full: string
}
type KeyInput = UnicodeKey | AsciiKey

interface ListItem {
  filePath: string,
  entity: string,
  content: string,
  language: string
  cursorInfo: {
    start: Point,
    end: Point
  }
}

/**
 * Blessed を使用したターミナルベースのファジーファインダーを実装するクラス。
 */
export class FluentFinderUI {
  private core: FlfCodeSearchCore;
  private screen: blessed.Widgets.Screen;
  private input: blessed.Widgets.TextboxElement;
  private list: blessed.Widgets.ListElement;
  private preview: blessed.Widgets.BoxElement;

  private currentResult: ListItem[] = []
  private options


  constructor(core: FlfCodeSearchCore, options: UIOptions) {
    this.screen = this.createScreen();
    this.input = this.createInput();
    this.list = this.createList();
    this.preview = this.createPreview();
    this.core = core

    this.setupLayout();
    this.bindKeys();
    this.bindInputEvents();

    // 初期表示
    this.updateList([]);
    this.options = options
    this.updatePreviewWithTitle(LOGO)
    this.input.focus();
    this.screen.render();
  }


  private createScreen(): blessed.Widgets.Screen {
    const program = blessed.program({
      //@ts-ignore
      input: ttyIn,

      //@ts-ignore
      output: ttyOut
    })
    return blessed.screen({
      program: program,
      smartCSR: true,
      title: 'Blessed Fuzzy Finder',
      fullUnicode: true,
    });
  }

  private createInput(): blessed.Widgets.TextboxElement {
    return blessed.textbox({
      parent: this.screen,
      top: 0,
      left: 0,
      height: 1,
      width: '100%',
      style: {
        bg: 'black',
        fg: 'white'
      },
      content: '',
    });
  }

  private createList(): blessed.Widgets.ListElement {
    return blessed.list({
      parent: this.screen,
      top: 1,
      left: 0,
      height: '100%-1',
      width: '50%',
      keys: true,
      vi: true,
      style: {
        selected: {
          bold: true,
          inverse: true,
          fg: "red"
        },
      },
      items: [], // 初期表示
    });
  }

  private createPreview(): blessed.Widgets.BoxElement {
    const box = blessed.box({
      parent: this.screen,
      top: 1,
      left: '50%',
      height: '100%-1',
      width: '50%',
      border: {
        type: 'line'
      },
      keys: false,
      vi: false,
      style: {
        border: {
          fg: 'white'
        }
      },
    });
    box.content = highlight("", { language: '', ignoreIllegals: true });
    return box;
  }

  private setupLayout(): void {
    this.screen.append(this.input);
    this.screen.append(this.list);
    this.screen.append(this.preview);
  }

  /**
   * プレビューの内容を更新します。
   * @param title プレビューに含めるタイトル文字列
   */
  private updatePreviewWithTitle(content: string, language?: string): void {
    this.preview.content = highlight(content, {
      language: language ?? "",
      ignoreIllegals: true
    });
    this.screen.render();
  }

  /**
   * 現在選択されているリストアイテムに基づいてプレビューを更新します。
   */
  private updatePreview(): void {
    // @ts-ignore
    const idx = this.list.selected;
    const selectedItem = this.currentResult[idx]
    if (!selectedItem) throw Error("selectedItem is undefined")
    this.updatePreviewWithTitle(selectedItem.content, selectedItem.language);
  }

  /**
   * リストの内容をフィルタリングされたアイテムで更新します。
   * @param items 表示するアイテムの配列
   */
  public updateList(items: ListItem[]): void {
    this.currentResult = items
    this.list.clearItems()
    this.list.setItems(items.map(i => this.convertListItemToListTitle(i)));

    // リストのカーソルをリセット
    if (items.length > 0) {
      this.list.select(0);
    }

    // プレビューの初期更新
    const item = items.at(0);
    this.updatePreviewWithTitle(item?.content ?? "", item?.language ?? "")
  }

  /**
   * 検索クエリが変更されたときの処理を行います。
   * **`blessed.textbox` の `change` イベントを使用することで、値が更新された後に検索を実行できます。**
   */
  private async handleQueryChange(key: KeyInput): Promise<void> {
    let query = this.input.value.trim();
    if (key.name) {
      if (key.name === 'backspace') {
        query = [...query].slice(0, -1).join('')
      } else if (key.name === 'enter') {
        try {
          // @ts-ignore
          const listIdx: number = this.list.selected;
          const selectedItem = this.currentResult.at(listIdx)

          if (selectedItem) {
            this.screen.destroy();
            this.showResult(selectedItem, this.options.editor)
            ttyIn.setRawMode(false);
            ttyIn.pause();
            ttyIn.destroy();
            ttyOut.end();
          }
        } finally {

        }
      } else if (key.name === 'up') {
        this.list.up(1);
        this.updatePreview();
        return;
      } else if (key.name === 'down') {
        this.list.down(1);
        this.updatePreview();
        return;
      } else if (!(key.ctrl || key.meta || key.shift) && key.name.length === 1) {
        query += key.name
      } else if (key.ctrl && key.name === "c") {
        this.screen.destroy()
        this.destroyTTY()
      }
    } else {
      query += key.full
    }


    const res = await this.core.search({
      queryText: query,
      isJsonOutput: true,
      k: 20,
      dbPath: ":memory:"
    })

    // リストを更新
    this.updateList(
      res
        .sort((a, b) => a.rank - b.rank)
        .map(r => {
          return {
            filePath: r.file,
            entity: r.entity,
            content: r.contentSnippet,
            language: r.language,
            cursorInfo: r.cursorInfo,
          }
        }));
    //}
    this.screen.render();
  }

  /**
   * UI要素と関連するキーバインドを設定します。
   */
  private bindKeys(): void {
    // プログラム終了処理
    this.screen.key(['escape', 'q', 'C-c'], () => {
      //return process.exit(0);
      this.screen.destroy()
      this.destroyTTY()
    });

  }

  /**
   * 入力ボックスのイベントを設定します。
   */
  private bindInputEvents(): void {
    this.input.on('keypress', (_ch, key) => {
      this.handleQueryChange(key);
    });

  }


  /**
   * アプリケーションを実行します。
   */
  public run(): void {
    this.screen.render();
    this.input.readInput(); // 入力待ちを開始
  }

  private destroyTTY() {
    ttyIn.setRawMode(false);
    ttyIn.pause();
    ttyIn.destroy();
    ttyOut.end();
  }

  private showResult(result: ListItem, outputType: OutputType = "nvim") {
    let query = JSON.stringify(result)
    if (outputType === "nvim" || outputType === "vim") {
      query = `<cmd>tabf +${result.cursorInfo.start.row + 1} ${result.filePath}<CR>`
    }
    console.log(query)
    if (DEBUG) {
      ttyOut.write(query)
      ttyOut.write("\n")
    }
  }
  private convertListItemToListTitle(item: ListItem) {
    return `${item.filePath}#${item.entity}`
  }
}

const argv = yargs(hideBin(process.argv))
  .option('editor', {
    alias: 'e',
    description: 'Editor command to start up new buffer',
    choices: ['nvim', 'vim', 'emacs', 'cmd'],
    default: 'cmd',
    type: 'string'
  })
  .help()
  .parseSync()
const core = await FlfCodeSearchCore.init(":memory:")
ttyOut.write("Indexing...\n")
const interactiveUI = new FluentFinderUI(core, {
  editor: argv.editor as OutputType
})
core.indexDirectory(".").then(async () => {
  const initList = await core.search({
    queryText: " ",
    isJsonOutput: true,
    k: 20,
    dbPath: ":memory:"
  })
  interactiveUI.updateList(initList
    .sort((a, b) => a.rank - b.rank)
    .map(r => {
      return {
        filePath: r.file,
        entity: r.entity,
        content: r.contentSnippet,
        language: r.language,
        cursorInfo: r.cursorInfo,
      }
    }))
})
interactiveUI.run()


