/**
 * ===================================================================
 * API CHÍNH CHO CHROME EXTENSION TRA MÀU SƠN
 * ===================================================================
 * Script này đọc dữ liệu từ 5 sheet chính và trả về dưới dạng JSON.
 * Phiên bản này được viết bằng TypeScript.
 */

import {
  AllData,
  Color,
  ColorPricing,
  ParentProduct,
  Product,
  Trademark,
} from '@shared/types';

/**
 * Hàm API chính, được gọi khi truy cập URL Web App.
 * @param {object} e - Đối tượng sự kiện (không dùng ở đây).
 * @returns {ContentService.TextOutput} - Dữ liệu JSON.
 */
function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput {
  try {
    // --- START CACHING LOGIC ---
    const cache = CacheService.getScriptCache();
    const CACHE_KEY = 'ALL_DATA_V1'; // Thay đổi version này (V2, V3...) để xóa cache cũ khi có thay đổi lớn
    const cachedData = cache.get(CACHE_KEY);

    if (cachedData) {
      Logger.log("Serving data from cache.");
      return ContentService.createTextOutput(cachedData).setMimeType(
        ContentService.MimeType.JSON
      );
    }
    Logger.log("Cache miss. Fetching fresh data from Sheets.");
    // --- END CACHING LOGIC ---

    // 1. Đọc dữ liệu từ 5 sheet quan trọng
    // QUAN TRỌNG: Đảm bảo tên sheet (ví dụ "Colors", "Products")
    // khớp 100% với tên các tab trong Google Sheet của bạn.
    const trademarks = sheetToJSON<Trademark>("Trademarks");
    const colors = sheetToJSON<Color>("Colors");
    const parentProducts = sheetToJSON<ParentProduct>("ParentProducts");
    const colorPricings = sheetToJSON<ColorPricing>("ColorPricings");
    const products = sheetToJSON<Product>("Products");

    // 2. Gói tất cả vào một đối tượng JSON lớn
    const allData: AllData = {
      trademarks,
      colors,
      parentProducts,
      colorPricings,
      products,
    };

    const dataToCache = JSON.stringify(allData);

    // --- START CACHING LOGIC ---
    // Lưu vào cache trong 1 giờ (3600 giây). Bạn có thể điều chỉnh thời gian này.
    cache.put(CACHE_KEY, dataToCache, 3600); 
    Logger.log("Data has been stored in cache.");
    // --- END CACHING LOGIC ---

    // 3. Trả về cho Chrome Extension
    return ContentService
      .createTextOutput(dataToCache)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error: any) {
    // 4. Xử lý lỗi nếu có sự cố
    const errorResponse = {
      success: false,
      message: error.message,
      stack: error.stack,
    };

    Logger.log(error); // Ghi log lỗi để bạn kiểm tra

    return ContentService
      .createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Hàm trợ giúp (helper) để chuyển đổi dữ liệu của một sheet
 * thành một mảng các đối tượng JSON (Array of Objects).
 * @template T - Kiểu dữ liệu của đối tượng trong mảng trả về.
 * @param {string} sheetName - Tên chính xác của tab trong Google Sheet.
 * @returns {T[]} - Mảng các đối tượng với kiểu T.
 */
function sheetToJSON<T>(sheetName: string): T[] {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Không tìm thấy sheet với tên: "${sheetName}"`);
  }

  const data = sheet.getDataRange().getValues();

  // Nếu sheet rỗng hoặc chỉ có 1 hàng (header), trả về mảng rỗng.
  if (data.length < 2) {
    return [];
  }

  // Lấy hàng đầu tiên làm "header" (tiêu đề cột).
  // Các tiêu đề này sẽ trở thành "key" của JSON.
  const header = data.shift();

  if (!header) {
    // Trường hợp này gần như không xảy ra nếu data.length >= 2,
    // nhưng TypeScript cần để đảm bảo header không phải là undefined.
    return [];
  }

  // Chuyển đổi các hàng dữ liệu còn lại
  return data.map((row): T => {
    const obj: { [key: string]: string | number | boolean | Date } = {};

    // Lặp qua từng cột trong header
    header.forEach((colName, index) => {
      // Đảm bảo colName là một string và không rỗng
      const key = String(colName || '').trim();

      // Bỏ qua nếu tên cột rỗng
      if (key) {
        // Gán giá trị của ô (row[index]) cho key (colName)
        obj[key] = row[index];
      }
    });

    return obj as T;
  });
}
