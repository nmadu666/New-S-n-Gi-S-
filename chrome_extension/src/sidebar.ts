/**
 * ===================================================================
 * LOGIC CHÍNH CHO SIDEBAR TRA CỨU MÀU SƠN
 * ===================================================================
 * File này triển khai toàn bộ logic nghiệp vụ đã định nghĩa
 * trong file GEMINI.md.
 */

import { AllData, Color, ColorPricing, ParentProduct, Product, Trademark } from '@shared/types';
import './sidebar.scss';

// !!! QUAN TRỌNG: DÁN URL APP SCRIPT CỦA BẠN VÀO ĐÂY !!!
const API_URL = "https://script.google.com/macros/s/AKfycbyqRroIbU-nYZHqR-0o1oZpCCuNDivVUE06DtBTAPy367IkXzDDVWRcN_MDAXJiRe4Z/exec"; // Thay thế bằng URL của bạn

// --- START CACHING CONFIG ---
const CACHE_KEY = 'paint_app_data_v1'; // Thay đổi version để xóa cache cũ khi có thay đổi lớn
const CACHE_DURATION_MS = 60 * 60 * 1000; // Thời gian cache: 1 giờ (60 phút * 60 giây * 1000 ms)
const FILTER_STATE_KEY = 'paint_app_filters_v1'; // Key để lưu trạng thái bộ lọc
// --- END CACHING CONFIG ---

// Định nghĩa kiểu cho State
interface AppState {
  panel: 'colors' | 'parentProducts' | 'skus';
  selectedColor: Color | null;
  selectedParentProduct: ParentProduct | null;
}

// Biến toàn cục để lưu trữ toàn bộ cơ sở dữ liệu
let DB: AllData = { trademarks: [], colors: [], parentProducts: [], colorPricings: [], products: [] };

// Biến lưu trữ trạng thái của UI
let fullColorList: Color[] = [];

let currentState: AppState = {
  panel: 'colors', // 'colors', 'parentProducts', 'skus'
  selectedColor: null,
  selectedParentProduct: null
};

// Định nghĩa các ID DOM dưới dạng hằng số để dễ quản lý và tránh lỗi chính tả
const DOM_IDS = {
  LOADER: 'loader',
  APP_CONTAINER: 'app-container',
  TRADEMARK_FILTER: 'trademark-filter',
  TONE_FILTER: 'tone-filter',
  SORT_FILTER: 'sort-filter',
  COLOR_SEARCH: 'color-search',
  CLEAR_FILTERS_BUTTON: 'clear-filters-button',
  BACK_BUTTON: 'back-button',
  REFRESH_BUTTON: 'refresh-button',
  PANEL_TITLE: 'panel-title',
  HEADER: 'header',
  COLOR_LIST_PANEL: 'color-list-panel',
  PARENT_PRODUCT_LIST_PANEL: 'parent-product-list-panel',
  SKU_LIST_PANEL: 'sku-list-panel',
  COLOR_LIST_CONTAINER: 'color-list',
  PARENT_PRODUCT_LIST_CONTAINER: 'parent-product-list',
  SKU_LIST_CONTAINER: 'sku-list'
};

// Lấy các phần tử DOM chính sử dụng hằng số
const loader = document.getElementById(DOM_IDS.LOADER) as HTMLElement;
const appContainer = document.getElementById(DOM_IDS.APP_CONTAINER) as HTMLElement;
const trademarkFilter = document.getElementById(DOM_IDS.TRADEMARK_FILTER) as HTMLSelectElement;
const toneFilter = document.getElementById(DOM_IDS.TONE_FILTER) as HTMLSelectElement;
const sortFilter = document.getElementById(DOM_IDS.SORT_FILTER) as HTMLSelectElement;
const colorSearch = document.getElementById(DOM_IDS.COLOR_SEARCH) as HTMLInputElement;
const clearFiltersButton = document.getElementById(DOM_IDS.CLEAR_FILTERS_BUTTON) as HTMLButtonElement;
const backButton = document.getElementById(DOM_IDS.BACK_BUTTON) as HTMLButtonElement;
const refreshButton = document.getElementById(DOM_IDS.REFRESH_BUTTON) as HTMLButtonElement;
const panelTitle = document.getElementById(DOM_IDS.PANEL_TITLE) as HTMLElement;
const headerElement = document.getElementById(DOM_IDS.HEADER) as HTMLElement;
const contentElement = document.getElementById('content') as HTMLElement;

// Các panel (sử dụng hằng số)
const panels = {
  colors: document.getElementById(DOM_IDS.COLOR_LIST_PANEL) as HTMLElement,
  parentProducts: document.getElementById(DOM_IDS.PARENT_PRODUCT_LIST_PANEL) as HTMLElement,
  skus: document.getElementById(DOM_IDS.SKU_LIST_PANEL) as HTMLElement
};

// Nơi render nội dung (sử dụng hằng số)
const colorListContainer = document.getElementById(DOM_IDS.COLOR_LIST_CONTAINER) as HTMLElement;
const parentProductListContainer = document.getElementById(DOM_IDS.PARENT_PRODUCT_LIST_CONTAINER) as HTMLElement;
const skuListContainer = document.getElementById(DOM_IDS.SKU_LIST_CONTAINER) as HTMLElement;

// Chạy hàm initialize khi DOM đã tải xong
document.addEventListener('DOMContentLoaded', initialize);

// Gắn sự kiện cho các bộ lọc
/**
 * Xử lý sự kiện khi bộ lọc hãng thay đổi.
 * Gọi hàm `applyFilters` để cập nhật danh sách màu.
 * @returns {void}
 */
trademarkFilter.addEventListener('change', handleTrademarkFilter);
toneFilter.addEventListener('change', handleToneFilter);
sortFilter.addEventListener('change', handleSortFilter);
colorSearch.addEventListener('input', handleColorSearch);
clearFiltersButton.addEventListener('click', handleClearFiltersClick);
backButton.addEventListener('click', handleBackClick);
refreshButton.addEventListener('click', handleRefreshClick);

/**
 * ===================================================================
 * BƯỚC 0: KHỞI TẠO (Hàm initialize())
 * ===================================================================
 * Hàm khởi tạo chính của ứng dụng.
 * Thực hiện tải dữ liệu từ API, xử lý lỗi, hiển thị bộ lọc hãng,
 * và render danh sách màu ban đầu.
 * @returns {Promise<void>}
 */
async function initialize() {
  console.log("Bắt đầu khởi tạo ứng dụng...");
  loader.classList.remove('hidden');
  appContainer.classList.add('hidden');

  // --- START CACHING LOGIC ---
  const cachedItem = localStorage.getItem(CACHE_KEY);

  if (cachedItem) {
    try {
      const parsedCache = JSON.parse(cachedItem);
      const cacheAge = Date.now() - parsedCache.timestamp;

      if (cacheAge < CACHE_DURATION_MS) {
        console.log("Cache hợp lệ. Đang sử dụng...");
        setupApplication(parsedCache.data);
        return; // Kết thúc sớm nếu dùng cache thành công
      } else {
        console.log("Cache đã hết hạn. Sẽ tải lại dữ liệu mới.");
        // --- START UX IMPROVEMENT ---
        // Hiển thị thông báo cho người dùng rằng cache đã hết hạn
        loader.innerHTML = `<p>Dữ liệu đã cũ, đang làm mới...</p>`;
        // --- END UX IMPROVEMENT ---
        localStorage.removeItem(CACHE_KEY); // Xóa cache cũ
      }
    } catch (e) {
      console.error("Lỗi parse dữ liệu cache, sẽ tải lại dữ liệu mới.", e);
      localStorage.removeItem(CACHE_KEY); // Xóa cache hỏng
    }
  }
  // --- END CACHING LOGIC ---

  // Nếu không có cache hoặc cache bị lỗi, tải dữ liệu mới
  await fetchAndSetupApplication();
}

/**
 * Tải dữ liệu từ API, lưu vào cache và thiết lập ứng dụng.
 */
async function fetchAndSetupApplication() {
  console.log("Đang tải dữ liệu mới từ API...");
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`API call failed with status: ${response.status}`);
    }
    const data: AllData & { success?: boolean, message?: string } = await response.json();

    if (data.success === false) {
      throw new Error(`API Error: ${data.message}`);
    }

    // --- START CACHING LOGIC ---
    const dataToCache = {
      timestamp: Date.now(),
      data: data,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache));
    console.log("Dữ liệu mới đã được lưu vào cache.");
    // --- END CACHING LOGIC ---

    setupApplication(data);
  } catch (error: any) {
    console.error("Lỗi nghiêm trọng khi tải dữ liệu:", error);
    loader.innerHTML = `
            <p style="color: red;"><strong>Đã xảy ra lỗi khi tải dữ liệu!</strong></p>
            <p style="font-size: 12px; color: #333;">${error.message}</p>
            <p style="font-size: 12px; color: #333;">Hãy thử làm mới hoặc liên hệ quản trị viên.</p>
        `;
  }
}

/**
 * Thiết lập giao diện và logic ứng dụng từ dữ liệu đã có.
 * @param data - Toàn bộ dữ liệu từ API hoặc cache.
 */
function setupApplication(data: AllData) {
  DB = data;
  console.log("Database đã sẵn sàng:", DB);

  // Xác định các hãng có máy pha màu
    const mixingBrandIds = new Set<string | number>();
    if (DB.parentProducts) {
      DB.parentProducts.forEach(pp => {
        // Nếu `color_mixing_product_type` tồn tại và không rỗng
        if (pp.color_mixing_product_type && pp.color_mixing_product_type.trim() !== "") {
          mixingBrandIds.add(pp.trademark_ref);
        }
      });
    }
    console.log("Các hãng có máy pha màu (IDs):", mixingBrandIds);

  renderTrademarks(mixingBrandIds);

  renderToneFilter();

  renderSortFilter();

  restoreFilterState(); // Khôi phục trạng thái bộ lọc đã lưu

  fullColorList = DB.colors || [];
  applyFilters(); // Áp dụng bộ lọc ngay khi khởi động

  loader.classList.add('hidden');
  appContainer.classList.remove('hidden');
  console.log("Ứng dụng đã được thiết lập thành công.");

  // Hiển thị panel màu ban đầu một cách chính xác
  panels.colors.style.opacity = '1';
}

/**
 * Chuyển đổi một mã màu hex thành giá trị độ sáng HSL.
 * @param hex - Chuỗi mã màu hex (ví dụ: "#RRGGBB" hoặc "#RGB").
 * @returns Một giá trị độ sáng từ 0 (tối nhất) đến 1 (sáng nhất). Trả về 0 cho màu không hợp lệ.
 */
function getLightnessFromHex(hex: string): number {
  if (!hex || typeof hex !== 'string') {
    return 0; // Mặc định là màu tối nếu hex không hợp lệ
  }

  // Xóa ký tự '#'
  let cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;

  // Chuyển đổi hex 3 ký tự thành 6 ký tự (ví dụ: "F0C" -> "FF00CC")
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('');
  }

  if (cleanHex.length !== 6) {
    return 0; // Trả về 0 nếu hex không hợp lệ
  }

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  // Công thức tính độ sáng (Lightness) trong mô hình màu HSL
  const lightness = (max + min) / 2;

  return lightness;
}

/**
 * Phân loại một mã màu hex vào một tone màu cụ thể.
 * @param hex - Chuỗi mã màu hex.
 * @returns Tên của tone màu.
 */
function getToneFromHex(hex: string): string {
  if (!hex || typeof hex !== 'string') return 'Khác';

  // Chuyển đổi HEX sang HSL (Hue, Saturation, Lightness)
  let cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('');
  }
  if (cleanHex.length !== 6) return 'Khác';

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  h = Math.round(h * 360); // Chuyển Hue về thang 0-360

  // Phân loại dựa trên H, S, L
  if (l > 0.95) return 'Trắng';
  if (s < 0.1) {
    if (l < 0.2) return 'Xám & Đen'; // Đen
    return 'Xám & Đen'; // Xám
  }
  if (h >= 0 && h < 15) return 'Đỏ & Hồng';
  if (h >= 15 && h < 45) {
    if (s < 0.4) return 'Be & Nâu';
    return 'Cam & Đào';
  }
  if (h >= 45 && h < 65) return 'Vàng';
  if (h >= 65 && h < 160) return 'Xanh lá';
  if (h >= 160 && h < 260) return 'Xanh dương';
  if (h >= 260 && h < 340) return 'Tím';
  if (h >= 340 && h <= 360) return 'Đỏ & Hồng';

  return 'Khác';
}

/**
 * Hiển thị danh sách các tone màu vào bộ lọc.
 */
function renderToneFilter() {
  const tones = [
    'Tất cả tone màu',
    'Trắng',
    'Xám & Đen',
    'Be & Nâu',
    'Vàng',
    'Cam & Đào',
    'Đỏ & Hồng',
    'Tím',
    'Xanh dương',
    'Xanh lá',
    'Khác'
  ];
  toneFilter.innerHTML = tones.map(tone => `<option value="${tone}">${tone}</option>`).join('');
}

/**
 * Hiển thị các tùy chọn sắp xếp vào bộ lọc.
 */
function renderSortFilter() {
  const sortOptions = {
    'lightness-desc': 'Sắp xếp: Sáng tới tối',
    'lightness-asc': 'Sắp xếp: Tối tới sáng',
    'name-asc': 'Sắp xếp: Theo tên A-Z',
    'name-desc': 'Sắp xếp: Theo tên Z-A',
  };

  sortFilter.innerHTML = Object.entries(sortOptions).map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
}

/**
 * Hiển thị danh sách hãng (Trademarks) vào <select>
 * @param mixingBrandIds - Set các ID của hãng có máy pha màu
 * @returns {void}
 */
function renderTrademarks(mixingBrandIds: Set<string | number>) { // <--- ĐÃ CẬP NHẬT
  if (!DB.trademarks) {
    console.warn("Không tìm thấy DB.trademarks");
    return;
  }
  trademarkFilter.innerHTML = '<option value="all">Tất cả các hãng</option>';

  // --- BẮT ĐẦU CẢI TIẾN ---
  // Sắp xếp lại danh sách: ưu tiên hãng có máy pha màu lên đầu, sau đó sắp xếp theo tên
  const sortedTrademarks: Trademark[] = [...DB.trademarks].sort((a, b) => {
    const aHasMixing = mixingBrandIds.has(a.id);
    const bHasMixing = mixingBrandIds.has(b.id);

    if (aHasMixing && !bHasMixing) return -1; // a lên trước
    if (!aHasMixing && bHasMixing) return 1;  // b lên trước

    // Nếu cả hai đều có hoặc không có, sắp xếp theo tên
    return a.tradeMarkName.localeCompare(b.tradeMarkName);
  });
  // --- KẾT THÚC CẢI TIẾN ---

  sortedTrademarks.forEach(brand => { // <--- ĐÃ CẬP NHẬT (dùng sortedTrademarks)
    const option = document.createElement('option');
    option.value = String(brand.id);

    // --- BẮT ĐẦU CẢI TIẾN ---
    // Thêm dấu hiệu nhận biết
    if (mixingBrandIds.has(brand.id)) {
      option.textContent = `🎨 ${brand.tradeMarkName} (Pha màu)`;
      option.style.fontWeight = '600'; // In đậm
      option.style.color = '#0056b3'; // Đổi màu
    } else {
      option.textContent = `${brand.tradeMarkName}`;
    }
    // --- KẾT THÚC CẢI TIẾN ---

    trademarkFilter.appendChild(option);
  });
}

/**
 * Hiển thị danh sách màu (Colors) ra UI
 * @param colorsToRender - Mảng các đối tượng màu cần hiển thị
 * @returns {void}
 */
function renderColors(colorsToRender: Color[]) {
  colorListContainer.innerHTML = ''; // Xóa nội dung cũ
  if (!colorsToRender || colorsToRender.length === 0) {
    colorListContainer.innerHTML = '<p>Không tìm thấy màu phù hợp.</p>';
    return;
  }

  colorsToRender.forEach((color, index) => {
    const item = document.createElement('div');
    item.className = 'color-item';

    // --- START STAGGERED ANIMATION ---
    // Thêm độ trễ cho mỗi item để tạo hiệu ứng so le
    item.style.animationDelay = `${index * 20}ms`;
    // --- END STAGGERED ANIMATION ---

    // --- START TOOLTIP IMPROVEMENT ---
    // Thêm tooltip để hiển thị tên đầy đủ khi di chuột vào
    item.title = color.name;
    // --- END TOOLTIP IMPROVEMENT ---

    // Truyền ID vào dataset để lấy khi click
    item.dataset.colorId = String(color.id);

    // Tạo các phần tử con để dễ dàng gắn sự kiện
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = color.hexCode || '#eee';

    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.textContent = 'Copy';
    copyButton.title = `Sao chép thông tin màu (mã, tên, NCS)`;

    // Gắn sự kiện sao chép
    copyButton.addEventListener('click', (e) => {
      e.stopPropagation(); // Ngăn không cho sự kiện click của thẻ màu được kích hoạt

      // --- START: Cải tiến nội dung sao chép ---
      const ncsCode = (color as any).ncsCode;
      const textToCopy = [
        color.code || '',
        color.name || '',
        ncsCode ? `NCS: ${ncsCode}` : ''
      ].filter(Boolean).join(' ').trim();
      // --- END: Cải tiến nội dung sao chép ---

      navigator.clipboard.writeText(textToCopy).then(() => {
        copyButton.textContent = 'Đã chép!';
        copyButton.classList.add('copied');
        setTimeout(() => {
          copyButton.textContent = 'Copy';
          copyButton.classList.remove('copied');
        }, 1500);
      }).catch(err => {
        console.error('Không thể sao chép mã màu: ', err);
        copyButton.textContent = 'Lỗi';
      });
    });

    swatch.appendChild(copyButton);

    const info = document.createElement('div');
    info.className = 'color-info';
    info.innerHTML = `<span class="color-code">${color.code || 'N/A'}</span>
      ${(color as any).ncsCode ? `<span class="color-ncs">NCS: ${(color as any).ncsCode}</span>` : ''}
      <span class="color-name">${color.name || '...'}</span>`;

    item.appendChild(swatch);
    item.appendChild(info);

    // Gắn sự kiện click cho toàn bộ thẻ màu
    item.addEventListener('click', () => onColorClick(color));
    colorListContainer.appendChild(item);
  });
}

/**
 * ===================================================================
 * BƯỚC 1: LỌC MÀU (Hãng & Tìm kiếm)
 * ===================================================================
 * Xử lý sự kiện khi bộ lọc hãng thay đổi.
 * @returns {void}
 */
function handleTrademarkFilter() {
  saveFilterState();
  applyFilters();
}

/**
 * Xử lý sự kiện khi bộ lọc tone màu thay đổi.
 */
function handleToneFilter() {
  saveFilterState();
  applyFilters();
}

/**
 * Xử lý sự kiện khi bộ lọc sắp xếp thay đổi.
 */
function handleSortFilter() {
  saveFilterState();
  applyFilters();
}

/**
 * Xử lý sự kiện khi người dùng nhập vào ô tìm kiếm màu.
 * Gọi hàm `applyFilters` để cập nhật danh sách màu.
 * @returns {void}
 */
function handleColorSearch() {
  saveFilterState();
  applyFilters();
}

/**
 * Xử lý sự kiện khi người dùng nhấn nút "Xóa bộ lọc".
 */
function handleClearFiltersClick() {
  // Đặt lại giá trị của các bộ lọc về mặc định
  trademarkFilter.value = 'all';
  toneFilter.value = 'Tất cả tone màu';
  sortFilter.value = 'lightness-desc';
  colorSearch.value = '';

  // Lưu lại trạng thái mặc định và áp dụng bộ lọc
  saveFilterState();
  applyFilters();
}

/**
 * Lưu trạng thái hiện tại của các bộ lọc vào localStorage.
 */
function saveFilterState() {
  const filterState = {
    trademark: trademarkFilter.value,
    tone: toneFilter.value,
    sort: sortFilter.value,
    search: colorSearch.value,
  };
  localStorage.setItem(FILTER_STATE_KEY, JSON.stringify(filterState));
  updateClearFiltersButtonVisibility(); // Cập nhật trạng thái nút xóa
}

/**
 * Khôi phục trạng thái của các bộ lọc từ localStorage.
 */
function restoreFilterState() {
  const savedStateJSON = localStorage.getItem(FILTER_STATE_KEY);
  if (savedStateJSON) {
    try {
      const savedState = JSON.parse(savedStateJSON);
      trademarkFilter.value = savedState.trademark || 'all';
      toneFilter.value = savedState.tone || 'Tất cả tone màu';
      sortFilter.value = savedState.sort || 'lightness-desc';
      colorSearch.value = savedState.search || '';
      console.log("Đã khôi phục trạng thái bộ lọc:", savedState);
    } catch (e) {
      console.error("Lỗi khôi phục trạng thái bộ lọc:", e);
      localStorage.removeItem(FILTER_STATE_KEY);
    }
  }
}

/**
 * Cập nhật trạng thái hiển thị của nút "Xóa bộ lọc".
 * Nút chỉ hiển thị khi có ít nhất một bộ lọc đang được áp dụng.
 */
function updateClearFiltersButtonVisibility() {
  const isDefaultState =
    trademarkFilter.value === 'all' &&
    toneFilter.value === 'Tất cả tone màu' &&
    sortFilter.value === 'lightness-desc' &&
    colorSearch.value === '';

  if (isDefaultState) {
    clearFiltersButton.classList.add('hidden');
  } else {
    clearFiltersButton.classList.remove('hidden');
  }
}

/**
 * Hàm tổng hợp để lọc và hiển thị màu sắc
 * Lọc `fullColorList` dựa trên giá trị của `trademarkFilter` và `colorSearch`.
 * Sau đó gọi `renderColors` để hiển thị kết quả.
 * @returns {void}
 */
function applyFilters() {
  const brandId = trademarkFilter.value;
  const selectedTone = toneFilter.value;
  const searchTerm = colorSearch.value.toLowerCase().trim();

  updateClearFiltersButtonVisibility(); // Cập nhật trạng thái nút xóa mỗi khi lọc

  let filteredColors: Color[] = fullColorList;

  // 1. Lọc theo Hãng
  if (brandId !== 'all') {
    filteredColors = filteredColors.filter(color => color.trademark_ref == brandId);
  }

  // 2. Lọc theo Tone màu
  if (selectedTone !== 'Tất cả tone màu') {
    filteredColors = filteredColors.filter(color => getToneFromHex(color.hexCode) === selectedTone);
  }

  // 3. Lọc theo Từ khóa tìm kiếm (tìm cả tên và mã màu)
  if (searchTerm) {
    filteredColors = filteredColors.filter(color =>
      (color.name && color.name.toLowerCase().includes(searchTerm)) ||
      (color.code && color.code.toLowerCase().includes(searchTerm))
    );
  }

  // 4. Sắp xếp kết quả
  sortAndRenderColors(filteredColors);
}

/**
 * Sắp xếp và render danh sách màu dựa trên tùy chọn của người dùng.
 * @param colors - Mảng màu cần được sắp xếp và render.
 */
function sortAndRenderColors(colors: Color[]) {
  const sortBy = sortFilter.value;
  const sortedColors = [...colors]; // Tạo một bản sao để không thay đổi mảng gốc

  switch (sortBy) {
    case 'lightness-desc':
      sortedColors.sort((a, b) => getLightnessFromHex(b.hexCode) - getLightnessFromHex(a.hexCode));
      break;
    case 'lightness-asc':
      sortedColors.sort((a, b) => getLightnessFromHex(a.hexCode) - getLightnessFromHex(b.hexCode));
      break;
    case 'name-asc':
      sortedColors.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      sortedColors.sort((a, b) => b.name.localeCompare(a.name));
      break;
  }

  renderColors(sortedColors);
}

/**
 * ===================================================================
 * BƯỚC 2: CHỌN MÀU (Hàm onColorClick(color))
 * ===================================================================
 * Xử lý sự kiện khi người dùng click vào một màu.
 * Lọc ra các dòng sản phẩm (ParentProduct) phù hợp với màu đã chọn
 * và chuyển sang panel hiển thị danh sách dòng sản phẩm.
 * @param color - Đối tượng màu đã chọn.
 * ===================================================================
 */
function onColorClick(color: Color) {
  console.log("Đã chọn màu:", color);
  currentState.selectedColor = color; // Lưu màu đã chọn

  // Logic:
  if (!DB.colorPricings || !DB.parentProducts) {
    return;
  }
  // 1. Lọc `DB.colorPricings` để tìm tất cả các dòng có `color_ref`
  const matchingPricings = DB.colorPricings.filter(p => p.color_ref == color.id);

  // 2. Từ kết quả, lấy ra danh sách duy nhất các `color_mixing_product_type`
  const allowedTypes = [...new Set(matchingPricings.map(p => p.color_mixing_product_type))];
  // -> (ví dụ: ['int_1', 'int_2', 'ext_1', 'sd'])

  // 3. Dùng danh sách `type` này, lọc `DB.parentProducts`
  const applicableParentProducts = DB.parentProducts.filter(pp =>
    allowedTypes.includes(pp.color_mixing_product_type)
  );

  console.log("Các dòng sản phẩm phù hợp:", applicableParentProducts);

  // 4. Hiển thị danh sách ParentProduct phù hợp
  renderParentProducts(applicableParentProducts);

  // 5. Chuyển UI sang panel Dòng sản phẩm
  navigateToPanel('parentProducts', `Màu: ${color.code} - ${color.name}`);
}

/**
 * Hiển thị danh sách Dòng sản phẩm (ParentProduct) ra UI.
 * Mỗi dòng sản phẩm sẽ có thể click để xem chi tiết SKU.
 * @param parentProducts - Mảng các đối tượng ParentProduct cần hiển thị.
 * @returns {void}
 */
function renderParentProducts(parentProducts: ParentProduct[]) {
  parentProductListContainer.innerHTML = ''; // Xóa nội dung cũ
  if (!parentProducts || parentProducts.length === 0) {
    parentProductListContainer.innerHTML = '<p>Màu này không pha được cho dòng sản phẩm nào.</p>';
    return;
  }

  parentProducts.forEach((pp, index) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    // Thêm độ trễ animation so le
    item.style.animationDelay = `${index * 30}ms`;
    item.dataset.parentProductId = String(pp.id);
    item.innerHTML = `
            <strong>${pp.name || 'N/A'}</strong>
            <span>(Loại: ${pp.color_mixing_product_type || 'N/A'})</span>
        `;
    // Gắn sự kiện click
    item.addEventListener('click', () => onParentProductClick(pp));
    parentProductListContainer.appendChild(item);
  });
}

/**
 * ===================================================================
 * BƯỚC 3: CHỌN DÒNG SẢN PHẨM (Hàm onParentProductClick(pp))
 * ===================================================================
 * Xử lý sự kiện khi người dùng click vào một dòng sản phẩm (ParentProduct).
 * Tìm kiếm thông tin giá (pricingInfo) và các SKU (lon) phù hợp,
 * sau đó chuyển sang panel hiển thị danh sách SKU. *
 * @param parentProduct - Đối tượng ParentProduct đã chọn.
 * ===================================================================
 */
function onParentProductClick(parentProduct: ParentProduct) {
  console.log("Đã chọn Dòng SP:", parentProduct);
  currentState.selectedParentProduct = parentProduct; // Lưu dòng SP đã chọn

  // 2. Logic (phức tạp):
  if (!currentState.selectedColor || !DB.colorPricings || !DB.products) {
    return;
  }
  const colorId = currentState.selectedColor.id;
  const productType = parentProduct.color_mixing_product_type;

  // Tìm MỘT (1) dòng trong `DB.colorPricings` khớp CẢ HAI
  const pricingInfo: ColorPricing | undefined = DB.colorPricings.find(p =>
    p.color_ref == colorId && p.color_mixing_product_type == productType
  );

  if (!pricingInfo) {
    console.error("Lỗi nghiêm trọng: Không tìm thấy pricingInfo cho:", colorId, productType);
    skuListContainer.innerHTML = '<p>Lỗi: Không tìm thấy thông tin giá cho sản phẩm này.</p>';
    navigateToPanel('skus', parentProduct.name);
    return;
  }

  console.log("Thông tin giá:", pricingInfo); // (ví dụ: { base: 'A', pricePerMl: 1 })

  // Dùng `pricingInfo.base` và `parentProduct.id` để lọc `DB.products`
  const applicableSKUs = DB.products.filter(sku =>
    sku.parent_product_ref == parentProduct.id && sku.base == pricingInfo.base
  );

  console.log("Các SKU (lon) phù hợp:", applicableSKUs);

  // 3. Hiển thị danh sách SKU (lon) phù hợp và tính giá
  renderSKUs(applicableSKUs, pricingInfo);

  // 4. Chuyển UI sang panel SKU
  navigateToPanel('skus', parentProduct.name);
}

/**
 * ===================================================================
 * BƯỚC 4: TÍNH GIÁ (Hàm calculatePrice)
 * =================================================================== *
 * Tính toán giá base, giá màu thêm và giá thành phẩm cho một SKU cụ thể.
 * @param sku - Đối tượng SKU từ DB.products
 * @param pricingInfo - Đối tượng pricingInfo từ DB.colorPricings
 * @returns {{giaBase: number, giaMau: number, giaThanhPham: number}} Các thành phần giá
 */
function calculatePrice(sku: Product, pricingInfo: ColorPricing) {
  const giaBase = parseFloat(String(sku.basePrice)) || 0;
  const unitValue = parseFloat(String(sku.unit_value)) || 0;

  // 1. Tính giá màu thô
  const rawGiaMau = (parseFloat(String(pricingInfo.pricePerMl)) || 0) * unitValue * 1000;

  // 2. Áp dụng hệ số nhân theo quy định của cửa hàng
  let calculatedGiaMau: number;
  if (rawGiaMau > 500000) {
    calculatedGiaMau = rawGiaMau * 1.15;
  } else {
    calculatedGiaMau = rawGiaMau * 1.2;
  }

  // 3. Áp dụng giá màu tối thiểu (giá sàn) dựa trên dung tích (unit_value)
  let finalGiaMau: number;
  if (unitValue < 2) {
    finalGiaMau = Math.max(calculatedGiaMau, 10000);
  } else if (unitValue < 10) {
    finalGiaMau = Math.max(calculatedGiaMau, 20000);
  } else { // unitValue >= 10
    finalGiaMau = Math.max(calculatedGiaMau, 30000);
  }

  const giaThanhPham = giaBase + finalGiaMau;

  return { giaBase, giaMau: finalGiaMau, giaThanhPham };
}

/**
 * ===================================================================
 * BƯỚC 4: HIỂN THỊ SKU VÀ GIÁ (Hàm renderSKUs)
 * =================================================================== *
 * Hiển thị danh sách các SKU (lon) phù hợp cùng với thông tin giá đã tính toán.
 * @param skus - Mảng các đối tượng SKU cần hiển thị.
 * @param pricingInfo - Thông tin giá pha màu cho màu và loại sản phẩm hiện tại.
 * @returns {void}
 */
function renderSKUs(skus: Product[], pricingInfo: ColorPricing) {
  skuListContainer.innerHTML = ''; // Xóa nội dung cũ
  if (!skus || skus.length === 0) {
    skuListContainer.innerHTML = '<p>Không tìm thấy lon (SKU) phù hợp cho loại base này.</p>';
    return;
  }

  skus.forEach((sku, index) => {
    const { giaBase, giaMau, giaThanhPham } = calculatePrice(sku, pricingInfo);

    // Thêm thuộc tính aria-live cho loader
    const loaderElement = document.getElementById(DOM_IDS.LOADER);
    if (loaderElement && !loaderElement.hasAttribute('aria-live')) {
      loaderElement.setAttribute('aria-live', 'polite');
      loaderElement.setAttribute('aria-atomic', 'true');
    }

    const copySkuButton = createElement('button', {
      className: 'sku-copy-button',
      textContent: 'Chép mã',
      title: `Sao chép mã SKU: ${sku.code}`,
    });

    copySkuButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!sku.code) return;
      navigator.clipboard.writeText(sku.code).then(() => {
        copySkuButton.textContent = 'Đã chép!';
        copySkuButton.classList.add('copied');
        setTimeout(() => {
          copySkuButton.textContent = 'Chép mã';
          copySkuButton.classList.remove('copied');
        }, 1500);
      }).catch(err => {
        console.error('Không thể sao chép mã SKU: ', err);
      });
    });

    // --- START: Cải tiến hiển thị tên màu ---
    const selectedColor = currentState.selectedColor;
    let colorLabel = 'Giá Màu (Thêm):'; // Mặc định
    if (selectedColor) {
      const ncsCode = (selectedColor as any).ncsCode || '';
      const colorInfo = [selectedColor.code, selectedColor.name, ncsCode]
        .filter(Boolean).join(' ').trim();
      colorLabel = `Giá Màu (${colorInfo}):`;
    }
    // --- END: Cải tiến hiển thị tên màu ---

    const item = createElement('div', { className: 'sku-item' },
      createElement('div', { className: 'sku-name' }, createElement('span', { textContent: sku.fullName }), copySkuButton),
      createElement('div', { className: 'price-row' },
        createElement('span', { textContent: `Giá Base (${sku.base}):` }),
        createElement('span', { textContent: `${giaBase.toLocaleString('vi-VN')} đ` })
      ),
      createElement('div', { className: 'price-row' },
        createElement('span', { textContent: colorLabel }),
        createElement('span', { textContent: `${giaMau.toLocaleString('vi-VN')} đ` })
      ),
      createElement('div', { className: 'price-row total' },
        createElement('span', { textContent: 'Giá Thành Phẩm:' }),
        createElement('span', { textContent: `${giaThanhPham.toLocaleString('vi-VN')} đ` })
      )
    );
    // Thêm độ trễ animation so le
    item.style.animationDelay = `${index * 40}ms`;
    skuListContainer.appendChild(item);
  });
}


/**
 * ===================================================================
 * HÀM TIỆN ÍCH (Điều hướng UI)
 * ===================================================================
 */

/**
 * Hàm trợ giúp để tạo phần tử DOM một cách an toàn và có cấu trúc.
 * @param tag Tên thẻ HTML (ví dụ: 'div', 'span').
 * @param props Các thuộc tính để gán cho phần tử (ví dụ: className, textContent).
 * @param children Các phần tử con để nối vào.
 * @returns Phần tử HTMLElement đã được tạo.
 */
function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Omit<HTMLElementTagNameMap[K], 'style'>> & { style?: Partial<CSSStyleDeclaration> },
  ...children: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  Object.assign(element, props);
  children.forEach(child => element.append(child));
  return element;
}

/**
 * Hàm điều hướng chung
 * @param panelName - Tên panel
 * @param title - Tiêu đề mới
 */
function navigateToPanel(panelName: AppState['panel'], title: string) {
  // --- START UX IMPROVEMENT: SCROLL TO TOP ---
  window.scrollTo(0, 0);
  // --- END UX IMPROVEMENT: SCROLL TO TOP ---
  const panelOrder = ['colors', 'parentProducts', 'skus'];
  const panelIndex = panelOrder.indexOf(panelName);
  const oldPanelIndex = panelOrder.indexOf(currentState.panel);

  if (contentElement && panelIndex > -1) {
    const offset = panelIndex * -100; // Dịch chuyển sang trái theo %
    contentElement.style.transform = `translateX(${offset}%)`;

    // --- START FADE + SLIDE IMPROVEMENT ---
    // Làm mờ tất cả các panel
    Object.values(panels).forEach(panel => (panel.style.opacity = '0'));

    // Hiển thị panel mới sau một khoảng trễ nhỏ để hiệu ứng được mượt mà
    setTimeout(() => {
      panels[panelName].style.opacity = '1';
    }, 150); // 150ms là một giá trị tốt, có thể điều chỉnh
    // --- END FADE + SLIDE IMPROVEMENT ---
  }

  // Cập nhật tiêu đề
  panelTitle.textContent = title;
  currentState.panel = panelName;

  // Quản lý nút back
  if (panelName === 'colors') {
    backButton.classList.add('hidden');
  } else {
    backButton.classList.remove('hidden');
  }

  // Quản lý bộ lọc
  if (panelName === 'colors') {
    headerElement.classList.remove('hidden');
  } else {
    // Ẩn bộ lọc khi xem chi tiết
    headerElement.classList.add('hidden');
  }
}

/**
 * Xử lý sự kiện khi người dùng nhấn nút "Làm mới".
 * Xóa cache và tải lại toàn bộ ứng dụng.
 */
async function handleRefreshClick() {
  console.log("Yêu cầu làm mới dữ liệu...");
  localStorage.removeItem(CACHE_KEY);
  console.log("Cache đã được xóa.");
  await fetchAndSetupApplication();
}

/**
 * Xử lý sự kiện khi người dùng nhấn nút "Back".
 * Điều hướng người dùng quay lại panel trước đó dựa trên `currentState.panel`.
 * @returns {void}
 */
function handleBackClick() {
  if (currentState.panel === 'skus') {
    // Từ SKU quay về Dòng SP (ParentProduct)
    if (!currentState.selectedColor) return;
    // Cần gọi lại onColorClick để render lại danh sách ParentProduct
    onColorClick(currentState.selectedColor);
  } else if (currentState.panel === 'parentProducts') {
    // Từ Dòng SP quay về Danh sách màu
    navigateToPanel('colors', 'Tất Cả Màu');
  }
}
