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
const API_URL = "https://script.google.com/macros/s/AKfycbxub034UvLNAad2lkELjIkRqsN7yJqFCLBnG8pbqNascU6MiC1vODHpQG_UwPhKnMY/exec"; // Thay thế bằng URL của bạn

// --- START CACHING CONFIG ---
const CACHE_KEY = 'paint_app_data_v1'; // Thay đổi version để xóa cache cũ khi có thay đổi lớn
const CACHE_DURATION_MS = 60 * 60 * 1000; // Thời gian cache: 1 giờ (60 phút * 60 giây * 1000 ms)
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
  COLOR_SEARCH: 'color-search',
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
const colorSearch = document.getElementById(DOM_IDS.COLOR_SEARCH) as HTMLInputElement;
const backButton = document.getElementById(DOM_IDS.BACK_BUTTON) as HTMLButtonElement;
const refreshButton = document.getElementById(DOM_IDS.REFRESH_BUTTON) as HTMLButtonElement;
const panelTitle = document.getElementById(DOM_IDS.PANEL_TITLE) as HTMLElement;
const headerElement = document.getElementById(DOM_IDS.HEADER) as HTMLElement;

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
colorSearch.addEventListener('input', handleColorSearch);
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

  fullColorList = DB.colors || [];
  renderColors(fullColorList);

  loader.classList.add('hidden');
  appContainer.classList.remove('hidden');
  console.log("Ứng dụng đã được thiết lập thành công.");
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

  colorsToRender.forEach(color => {
    const item = document.createElement('div');
    item.className = 'color-item';
    // Truyền ID vào dataset để lấy khi click
    item.dataset.colorId = String(color.id);
    item.innerHTML = `
            <div class="color-swatch" style="background-color: ${color.hexCode || '#eee'}"></div>
            <div class="color-info">
                <span class="color-code">${color.code || 'N/A'}</span>
                <span class="color-name">${color.name || '...'}</span>
            </div>
        `;
    // Gắn sự kiện click
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
  applyFilters();
}

/**
 * Xử lý sự kiện khi người dùng nhập vào ô tìm kiếm màu.
 * Gọi hàm `applyFilters` để cập nhật danh sách màu.
 * @returns {void}
 */
function handleColorSearch() {
  applyFilters();
}

/**
 * Hàm tổng hợp để lọc và hiển thị màu sắc
 * Lọc `fullColorList` dựa trên giá trị của `trademarkFilter` và `colorSearch`.
 * Sau đó gọi `renderColors` để hiển thị kết quả.
 * @returns {void}
 */
function applyFilters() {
  const brandId = trademarkFilter.value;
  const searchTerm = colorSearch.value.toLowerCase().trim();

  let filteredColors: Color[] = fullColorList;

  // 1. Lọc theo Hãng
  if (brandId !== 'all') {
    filteredColors = filteredColors.filter(color => color.trademark_ref == brandId);
  }

  // 2. Lọc theo Từ khóa tìm kiếm (tìm cả tên và mã màu)
  if (searchTerm) {
    filteredColors = filteredColors.filter(color =>
      (color.name && color.name.toLowerCase().includes(searchTerm)) ||
      (color.code && color.code.toLowerCase().includes(searchTerm))
    );
  }

  renderColors(filteredColors);
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

  parentProducts.forEach(pp => {
    const item = document.createElement('div');
    item.className = 'list-item';
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

  // Chuyển đổi dung tích sang mililit để tính giá màu chính xác
  let volumeInMl = 0;
  if (sku.unit === 'Lít') {
    volumeInMl = unitValue * 1000; // 1 Lít = 1000 ml
  } else if (sku.unit === 'ml') {
    volumeInMl = unitValue; // Đã là mililit
  } else {
    // Xử lý các đơn vị khác nếu có, hoặc đưa ra cảnh báo.
    // Hiện tại, giả định các sản phẩm pha màu luôn có đơn vị thể tích.
    console.warn(`Đơn vị không xác định cho SKU ${sku.id}: ${sku.unit}. Giả định unit_value là Lít.`);
    volumeInMl = unitValue * 1000;
  }

  // pricePerMl là giá thêm cho mỗi mililit
  const giaMau = (parseFloat(String(pricingInfo.pricePerMl)) || 0) * volumeInMl;
  const giaThanhPham = giaBase + giaMau;

  return { giaBase, giaMau, giaThanhPham };
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

  skus.forEach(sku => {
    const { giaBase, giaMau, giaThanhPham } = calculatePrice(sku, pricingInfo);

    // Thêm thuộc tính aria-live cho loader
    const loaderElement = document.getElementById(DOM_IDS.LOADER);
    if (loaderElement && !loaderElement.hasAttribute('aria-live')) {
      loaderElement.setAttribute('aria-live', 'polite');
      loaderElement.setAttribute('aria-atomic', 'true');
    }

    const item = createElement('div', { className: 'sku-item' },
      createElement('div', { className: 'sku-name', textContent: sku.name }),
      createElement('div', { className: 'price-row' },
        createElement('span', { textContent: `Giá Base (${sku.base}):` }),
        createElement('span', { textContent: `${giaBase.toLocaleString('vi-VN')} đ` })
      ),
      createElement('div', { className: 'price-row' },
        createElement('span', { textContent: 'Giá Màu (Thêm):' }),
        createElement('span', { textContent: `${giaMau.toLocaleString('vi-VN')} đ` })
      ),
      createElement('div', { className: 'price-row total' },
        createElement('span', { textContent: 'Giá Thành Phẩm:' }),
        createElement('span', { textContent: `${giaThanhPham.toLocaleString('vi-VN')} đ` })
      )
    );
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
  // Ẩn tất cả các panel
  Object.values(panels).forEach(panel => panel?.classList.remove('active'));

  // Hiển thị panel được chọn
  if (panels[panelName]) {
    panels[panelName].classList.add('active');
  }

  // Cập nhật tiêu đề
  panelTitle.textContent = title;
  currentState.panel = panelName;

  // Quản lý nút back
  if (panelName === 'colors') {
    backButton.classList.add('hidden');
    // Khi quay về trang màu, reset bộ lọc
    applyFilters();
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
