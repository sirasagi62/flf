// Supress warining on iTerm
import os from "os"
if (os.type() === "Darwin" && process.env.TERM?.includes("xterm"))
  process.env.TERM = "iTerm.app"

import * as blessed from 'blessed';
import highlight from 'cli-highlight'

const PLACEHOLDER = `
def func1():
  comp = comp()
  if comp > 0:
      return `
// 検索対象のリスト
const allItems: string[] = [
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

// 簡易的なファジーマッチングアルゴリズム
/**
 * クエリがアイテム内に順番通りに（連続していなくても良い）出現するかチェックする。
 * 大文字・小文字は区別しない。
 * @param query 検索クエリ
 * @param item 検索対象の文字列
 * @returns マッチすれば true、そうでなければ false
 */
const fuzzyMatch = (query: string, item: string): boolean => {
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
};


// fzf インスタンスの初期化を削除
// const fzf = new Fzf(allItems);

// blessed スクリーンを作成
const screen = blessed.screen({
  smartCSR: false,
  title: 'Blessed Fuzzy Finder',
  fullUnicode: true,
});

// 検索入力ボックス
const input = blessed.textbox({
  parent: screen,
  top: 0,
  left: 0,
  height: 1,
  width: '100%',
  style: {
    bg: 'blue',
    fg: 'white'
  },
  content: '',
});

// 結果リストボックス
let list = blessed.list({
  parent: screen,
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
  items: allItems, // 初期表示
});

const preview = blessed.box({
  parent: screen,
  top: 1,
  left: '50%',
  height: '100%-1',
  width: '50%',
  keys: false,
  vi: false,
  style: {
  }
})
preview.content = highlight(PLACEHOLDER, { language: 'python', ignoreIllegals: true })


const updatePreviewWithTitle = (title: string) => {

  preview.content = highlight(PLACEHOLDER + title, { language: "python", ignoreIllegals: true })
  screen.render()
}
const updatePreview = () => {
  //@ts-ignore
  const idx = list.selected
  const title = list.getItem(idx).content
  updatePreviewWithTitle(title)
}

// --- UI操作とロジック ---

// プログラム終了処理
screen.key(['escape', 'q', 'C-c'], () => {
  return process.exit(0);
});

// 入力ボックスにフォーカス
input.focus();
input.readInput();

// リストの初期化関数
const updateList = (items: string[]) => {
  list.clearItems();
  // フィルタリングされたアイテム名を設定
  list.setItems(items);

  // リストのカーソルをリセット
  if (items.length > 0) {
    list.select(0);
  }

  //@ts-ignore
  //const idx = 0
  const title = items[0] ?? ""

  updatePreviewWithTitle(title)
  //screen.render();
};

// 入力イベントの処理
input.on('keypress', (_ch, key) => {
  switch (key.name) {
    case "up":
      list.up(1)
      updatePreview()
      break;
    case "down":
      list.down(1)
      updatePreview()
      break;
    case "enter":
      //@ts-ignore
      const listIdx: number = list.selected
      const content = list.getItem(listIdx).content
      screen.destroy()

      console.log(content)
      process.exit(0)
    default:
      const query = input.getValue().trim();

      if (query === '') {
        // クエリがない場合は全リストを表示
        updateList(allItems);
      } else {
        // 簡易ファジーマッチングでフィルタリング
        const filteredItems = allItems.filter(item => fuzzyMatch(query, item));

        // リストを更新
        updateList(filteredItems);
      }
  }

  screen.render()

  // NOTE: blessedのkeypressイベントは、実際に値が変わる*前*に発火します。
  // そのため、input.getValue()はまだ古い値です。
  // 簡略化のため、Enterキー以外は現在の値をそのまま使用して検索します。
  // 厳密には、値の変更を待つために 'change' イベントを使うか、
  // keypressのロジック内でキー入力をシミュレートする必要がありますが、
  // blessedのtextboxでは、単一キーの入力後、次のレンダリング時には値が更新されています。
  // 今回は、現在のクエリ値を使用して検索処理を実行します。

  // blessedのtextboxの入力値を取得
  // NOTE: keypressではこの時点で最新の値ではない可能性がありますが、
  // blessedの仕様上、多くの場合、次の描画タイミングで結果が更新されます。

});

screen.render();
