Output assets/nvim2.gif
Set Shell "zsh"
Set Theme "TokyoNightStorm"
Set FontFamily "CaskaydiaCove Nerd Font"
Set FontSize 40
Set Width 2000
Set Height 1200
Set Padding 10
Set TypingSpeed 0.2

Hide
Type@0ms "nvim" Enter
Type@0ms ":terminal" Enter
Type@0ms "i"
Show

Sleep 1.0

Type@0ms `nvim --server $NVIM --headless --remote-send "<cmd>lua vim.notify('$(FORCE_COLOR=1 node ./dist/index.js|jq .name)')<CR>"`
Enter

Sleep 2.0

Type "init database"
Sleep 1.0
Down 10
Sleep 1.0
Backspace 20
Type "データベースの後処理"
Sleep 2.0
Enter
Sleep 4.0
