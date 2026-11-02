# Chrome Web Store 首次上架

目前準備的是 0.4.4；本文件不是已上架或已通過審查的證明。

## 檔案

- 執行 `npm test`、`npm run package`。
- 上傳 `dist/facebook-threads-quick-block-0.4.4.zip`，不要上傳整個 repo。
- 商店圖示：`extension/icons/icon-128.png`。圖示為本專案原創幾何圖形，使用 `node scripts/icons.cjs` 可重新產生。
- 尚須至少一張實際功能截圖（1280×800 或 640×400），請遮蔽個人資料。不要用其他產品畫面或圖示代替實際截圖。

## 商店文案

名稱：Facebook / Threads 快速封鎖

簡短說明：在 Facebook 與 Threads 作者旁加入快速封鎖按鈕，依序處理佇列。

詳細說明：

在 Facebook 與 Threads 網頁上的作者旁加入「封鎖此人」按鈕，減少重複開啟選單的操作。

- 點選作者旁的按鈕，將帳號加入封鎖佇列，依序執行。
- 可暫停處理或取消尚未執行的項目；失敗時會暫停，避免持續送出操作。
- 佇列面板可收合，也可以拖曳位置。
- 無廣告、分析追蹤或開發者資料接收伺服器。

按下封鎖按鈕會執行真正的帳號封鎖。Threads 的確認視窗會在核對帳號後自動確認。取消等待項目或移除擴充功能不會解除已完成的封鎖，請使用網站原生設定解除。

需要在 Chrome 登入對應網站。佇列僅在當前分頁記憶體中保留，重新整理或關閉分頁會清除等待項目。Facebook／Threads 網站介面與內部功能更新可能造成相容性問題。

本工具為獨立開源專案，與 Meta、Facebook、Threads 無隸屬或背書關係。

## 隱私與權限欄位草稿

單一用途：讓使用者在 Facebook 與 Threads 作者旁點選按鈕，將指定帳號加入佇列並執行封鎖。

網站存取理由：內容腳本僅在 manifest 指定的 Facebook 與 Threads 網址執行，用於辨識作者、插入按鈕、確認登入身分與執行使用者選定的封鎖。Facebook 必要時讀取同源個人檔案以解析使用者 ID；Threads 操作原生選單與確認視窗。

遠端程式碼：未載入遠端可執行程式碼。擴充功能程式隨安裝包提供；Facebook 回應僅以資料解析，不作程式執行。

隱私政策網址：https://github.com/FantasyQ/facebook-threads-quick-block/blob/main/PRIVACY.md

資料處理揭露：工具會在分頁記憶體處理作者名稱、帳號網址、使用者 ID、登入身分、頁面內容及封鎖結果。Facebook 流程會使用當前頁面的請求驗證值，把必要請求送回 Facebook；Threads 使用網站原生流程。開發者不接收、不出售、不持久保存這些資料。不能將此描述簡化成「不存取任何個資或驗證資料」。請依後台當下的資料類型定義填寫，並核對 PRIVACY.md；相關政策聲明應由發布者確認。

## 首次 Unlisted 發布

1. 開發者後台建立新項目並上傳 ZIP。
2. 填寫商店文案、圖示、實際截圖與隱私欄位。
3. 不需要設定 Trusted testers；任何持有商店連結的人都能安裝，不限自己的 Google 帳號。
4. Distribution 選 **不公開（Unlisted）**：不列在商店搜尋結果，但不是存取限制。
5. 核對後提交審查；Unlisted 也須審查。通過並發布後，用商店連結安裝商店版本。停用原先解壓縮載入的版本，以免同頁執行兩份。

Google 帳號、OAuth 憑證與 Token 不得寫進 repo 或商店公開文案。

## 後續自動發布

商店項目 ID：`cjjbobacehmaoflfllilepgjkkhmiifi`。

已準備 GitHub Release 後續的商店發布 job，預設停用，尚未以真實憑證驗證。啟用後會下載該 Release 的 ZIP 與 SHA-256 檔，核對校驗碼、版本與商店目前狀態後上傳並送審。使用 DEFAULT_PUBLISH，核准後由商店發布，不跳過審查。商店流程失敗不會撤銷已發布的 GitHub Release。

首次建立項目、填寫資料並完成 Unlisted 發布後，依官方 using-api 文件啟用 Google Cloud 的 Chrome Web Store API，設定 OAuth 客戶端並授權 `https://www.googleapis.com/auth/chromewebstore`。授權應使用此商店發布者帳號。敏感值直接填進 GitHub repo 的 Settings → Secrets and variables → Actions，不貼入聊天或提交檔案。

Repository Secrets：
- `CWS_CLIENT_ID`
- `CWS_CLIENT_SECRET`
- `CWS_REFRESH_TOKEN`

Repository Variables：
- `CWS_PUBLISHER_ID`：可覆寫發布者 ID；未設定時使用發布者提供的 `09396b88-be7b-4af3-8d74-849c328baad0`。
- `CWS_UNLISTED_READY`：首次 Unlisted 發布完成並核對後台可見性為 Unlisted 後才設為 `true`；未設定時不呼叫商店 API。

OAuth refresh token 可能因測試模式、撤銷授權等因素失效，請依 Google 官方 OAuth 設定及錯誤訊息處理，不要把臨時 access token 當成 refresh token。

第一次啟用前，在 Actions 執行 `Check Chrome Web Store connection`。此流程只更新 Access token 並讀取商店項目狀態，不上傳或發布；不輸出憑證值。若 Google 回傳 Refresh token 剩餘效期在七天內，檢查會失敗，正式發布也會拒絕上傳。先在 OAuth 正式模式重新授權，再更新 GitHub Secret。

下一版本必須高於商店已發布版本。送出新的 `v*` tag 會先發布 GitHub Release 再處理商店；API 拒絕僅限測試者或尚未發布的狀態、警告、尚待處理的送審及相同／更舊版本。網路錯誤不自動重送上傳或發布請求，請先查看後台結果。只重跑失敗的商店 job，不重跑已完成的 GitHub Release job。

商店 API 沿用項目已發布的可見性；流程要求既有發布狀態為 PUBLISHED；該狀態不能區分 Public 與 Unlisted，API 不提供可見性設定，因此仍需在後台維持 Unlisted，不要在其他操作同時改動可見性或上傳。不能以 GitHub Release 的可見性推論商店的 Unlisted 設定，也不能把 API 送審成功當作通過審查或已上架。

官方參考：
- https://developer.chrome.com/docs/webstore/cws-dashboard-distribution
- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/using-api
