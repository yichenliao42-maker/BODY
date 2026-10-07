V4.6｜管理員更新 LINE 狀態版

這版是針對以下情況：
- 學員第一次報名時 LINE 已綁定，但還不是官方帳號好友
- 後來才加入官方帳號好友
- 舊報名仍顯示「好友：否」
- 不希望學員重新下單

新增功能：

1. 每筆報名新增「更新 LINE 狀態」
   管理員按下後，Apps Script 會直接用既有 LINE User ID
   呼叫 Messaging API Get profile 檢查。

2. 管理後台新增「更新全部 LINE 狀態」
   一次重新檢查所有已有 LINE User ID、且未取消的報名。

3. 「確認並通知」升級
   在真正發 LINE 前，會先自動刷新一次 LINE 狀態。
   所以學員報名後才加好友，也有機會直接正常收到通知。

判斷方式：
- Messaging API Get profile 回 HTTP 200：
  後台更新為「好友：是」「已綁定／可通知」
- 取不到 profile：
  顯示目前不可通知

注意：
LINE push API 就算對方封鎖或不是好友，也可能回 HTTP 200，
所以 V4.6 不用「發送結果 200」判斷好友，
而是先用 Get profile 做刷新。

更新方式：
A. Apps Script
1. 備份目前 V4 Code.gs
2. 換成 V4.6 Code.gs
3. 儲存
4. 部署 → 管理部署 → 編輯 → 新版本 → 部署

B. GitHub
1. 備份 V4 index.html
2. 換成 V4.6 index.html
3. Commit
4. 重新整理管理員後台

V3 不受影響。
