// Supress warining on iTerm
import os from "os"
if (os.type() === "Darwin" && process.env.TERM?.includes("xterm"))
  process.env.TERM = "iTerm.app"

import blessed from 'blessed';
import { highlight } from 'cli-highlight'

const PLACEHOLDER = `
def func1():
  comp = comp()
  if comp > 0:
      return `
import { FlfCodeSearchCore } from "./core.js";
import { exit } from "process";
// 検索対象のリスト
const allItems: string[] = [
  '日本語',
  'Apple',
  'Banana',
  'Cherry',
  'Date',
  'Elderberry',
  'Fig',
  'Grape',
  'Honeydew',
  'Kiwi',
  'Lemon',
  'Mango',
  'Nectarine',
];
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
/**
 * Blessed を使用したターミナルベースのファジーファインダーを実装するクラス。
 */
export class FluentFinderUI {
  private core: FlfCodeSearchCore;
  private screen: blessed.Widgets.Screen;
  private input: blessed.Widgets.TextboxElement;
  private list: blessed.Widgets.ListElement;
  private preview: blessed.Widgets.BoxElement;
  private allItems: string[];
  private deinitCallback: () => void

  /**
   * 簡易ファジーマッチング関数 (Subsequence Match)。
   * クエリの文字がアイテムに同じ順序で出現するかをチェックします。
   * @param query 検索クエリ
   * @param item 検索対象の文字列
   * @returns マッチした場合は true
   */
  private static fuzzyMatch(query: string, item: string): boolean {
    if (!query) return true; // クエリが空なら常にマッチ

    const lowerQuery = query.toLowerCase();
    const lowerItem = item.toLowerCase();

    let queryIndex = 0;

    for (let itemIndex = 0; itemIndex < lowerItem.length; itemIndex++) {
      // クエリの現在の文字とアイテムの現在の文字が一致するかチェック
      if (lowerItem[itemIndex] === lowerQuery[queryIndex]) {
        queryIndex++; // クエリの次の文字へ進む
      }

      // クエリの全文字が見つかったらマッチ
      if (queryIndex === lowerQuery.length) {
        return true;
      }
    }

    // アイテムを最後までチェックしてもクエリの全文字が見つからなかった
    return false;
  }

  constructor(items: string[], core: FlfCodeSearchCore, deinitCallback: () => void) {
    this.allItems = items;
    this.deinitCallback = deinitCallback;
    this.screen = this.createScreen();
    this.input = this.createInput();
    this.list = this.createList();
    this.preview = this.createPreview();
    this.core = core

    this.setupLayout();
    this.bindKeys();
    this.bindInputEvents();

    // 初期表示
    this.updateList(this.allItems);
    this.input.focus();
    this.screen.render();
  }

  private createScreen(): blessed.Widgets.Screen {
    return blessed.screen({
      smartCSR: false,
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
        bg: 'blue',
        fg: 'white'
      },
      content: '',
      //inputOnFocus: true, // `readInput` の代わりにこれを使用
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
          bg: 'green',
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
      keys: false,
      vi: false,
      style: {},
    });
    box.content = highlight(PLACEHOLDER, { language: 'python', ignoreIllegals: true });
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
  private updatePreviewWithTitle(title: string): void {
    this.preview.content = highlight(PLACEHOLDER + title, { language: "python", ignoreIllegals: true });
    this.screen.render();
  }

  /**
   * 現在選択されているリストアイテムに基づいてプレビューを更新します。
   */
  private updatePreview(): void {
    // @ts-ignore
    const idx = this.list.selected;
    const selectedItem = this.list.getItem(idx);
    const title = selectedItem ? selectedItem.content : "";
    this.updatePreviewWithTitle(title);
  }

  /**
   * リストの内容をフィルタリングされたアイテムで更新します。
   * @param items 表示するアイテムの配列
   */
  private updateList(items: string[]): void {
    this.list.clearItems()
    this.list.setItems(items);

    // リストのカーソルをリセット
    if (items.length > 0) {
      this.list.select(0);
    }

    // プレビューの初期更新
    const title = items[0] ?? "";
    this.updatePreviewWithTitle(title);
  }

  /**
   * 検索クエリが変更されたときの処理を行います。
   * **`blessed.textbox` の `change` イベントを使用することで、値が更新された後に検索を実行できます。**
   */
  private handleQueryChange(key: KeyInput): void {
    let query = this.input.value.trim();
    if (key.name) {
      if (key.name === 'backspace') {
        query = [...query].slice(0, -1).join('')
      } else if (key.name === 'enter') {
        try {
          // @ts-ignore
          const listIdx: number = this.list.selected;
          const selectedItem = this.list.getItem(listIdx);

          if (selectedItem) {
            const content = selectedItem.content;
            this.screen.destroy();
            console.log(content);
          }
        } finally {

          this.deinitCallback()
          setTimeout(()=>process.exit(0),1000)

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
      }
    } else {
      query += key.full
    }


    if (query === '') {
      // クエリがない場合は全リストを表示
      this.updateList(this.allItems);
    } else {
      // ファジーマッチングでフィルタリング
      const filteredItems = this.allItems.filter(item =>
        FluentFinderUI.fuzzyMatch(query, item)
      );

      // リストを更新
      this.updateList(filteredItems);
    }
    this.screen.render();
  }

  /**
   * UI要素と関連するキーバインドを設定します。
   */
  private bindKeys(): void {
    // プログラム終了処理
    this.screen.key(['escape', 'q', 'C-c'], () => {
      return process.exit(0);
    });

  }

  /**
   * 入力ボックスのイベントを設定します。
   */
  private bindInputEvents(): void {
    this.input.on('keypress', (ch, key) => {
      this.handleQueryChange(key);
    });

  }

  /**
   * アプリケーションを実行します。
   */
  public run(): void {
    //this.screen.render();
    this.input.readInput(); // 入力待ちを開始
  }
}

const core = await FlfCodeSearchCore.init(":memory:")
console.log("Indexing...")
core.indexDirectory(".")
const interactiveUI = new FluentFinderUI(allItems, () => core.deinit())
interactiveUI.run()

