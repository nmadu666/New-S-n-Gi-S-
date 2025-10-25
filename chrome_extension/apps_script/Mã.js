/**
 * ===================================================================
 * API CHÍNH CHO CHROME EXTENSION TRA MÀU SƠN
 * ===================================================================
 * Script này đọc dữ liệu từ 5 sheet chính và trả về dưới dạng JSON.
 */

/**
 * Hàm API chính, được gọi khi truy cập URL Web App.
 * @param {object} e - Đối tượng sự kiện (không dùng ở đây).
 * @returns {ContentService.TextOutput} - Dữ liệu JSON.
 */
function doGet(e) {
  try {
    // 1. Đọc dữ liệu từ 5 sheet quan trọng
    // QUAN TRỌNG: Đảm bảo tên sheet (ví dụ "Colors", "Products")
    // khớp 100% với tên các tab trong Google Sheet của bạn.
    const trademarks = sheetToJSON("Trademarks");
    const colors = sheetToJSON("Colors");
    const parentProducts = sheetToJSON("ParentProducts");
    const colorPricings = sheetToJSON("ColorPricings");
    const products = sheetToJSON("Products");

    // 2. Gói tất cả vào một đối tượng JSON lớn
    const allData = {
      trademarks: trademarks,
      colors: colors,
      parentProducts: parentProducts,
      colorPricings: colorPricings,
      products: products
    };

    // 3. Trả về cho Chrome Extension
    return ContentService
      .createTextOutput(JSON.stringify(allData))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // 4. Xử lý lỗi nếu có sự cố
    const errorResponse = {
      success: false,
      message: error.message,
      stack: error.stack
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
 * @param {string} sheetName - Tên chính xác của tab trong Google Sheet.
 * @returns {Array<Object>} - Mảng các đối tượng.
 */
function sheetToJSON(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`Không tìm thấy sheet với tên: "${sheetName}"`);
  }

  const data = sheet.getDataRange().getValues();

  // Nếu sheet rỗng hoặc chỉ có 1 hàng (header)
  if (data.length < 2) {
    return []; // Trả về mảng rỗng
  }

  // Lấy hàng đầu tiên (index 0) làm "header" (tiêu đề cột)
  // Các tiêu đề này sẽ trở thành "key" của JSON
  const header = data.shift(); // Lấy và xóa hàng đầu tiên

  // Chuyển đổi các hàng dữ liệu còn lại
  return data.map((row, rowIndex) => {
    let obj = {};
    
    // Lặp qua từng cột trong header
    header.forEach((colName, index) => {
      // Bỏ qua nếu tên cột rỗng
      if (colName && colName.trim() !== "") {
        // Gán giá trị của ô (row[index]) cho key (colName)
        obj[colName] = row[index];
      }
    });
    
    // Thêm một id hàng để tham khảo nếu cần (tùy chọn)
    // obj._row_index = rowIndex + 2; // +2 vì index bắt đầu từ 0 và đã shift() header

    return obj;
  });
}
