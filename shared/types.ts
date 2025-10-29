/**
 * ===================================================================
 * ĐỊNH NGHĨA CÁC KIỂU DỮ LIỆU (INTERFACES)
 * ===================================================================
 * Tệp này định nghĩa cấu trúc cho các đối tượng dữ liệu chính
 * được sử dụng trong toàn bộ ứng dụng (cả backend và frontend).
 */

export interface Trademark {
  id: string | number;
  tradeMarkName: string;
}

export interface Color {
  id: string | number;
  code: string;
  ncsCode: string; // Đổi tên từ ncs thành ncsCode
  name: string;
  hexCode: string;
  trademark_ref: string | number;
}

export interface ParentProduct {
  id: string;
  name: string;
  category: string;
  color_mixing_product_type: string;
  trademark_ref: string | number; // Thêm thuộc tính này dựa trên logic ở client
  image_url?: string;
}

export interface ColorPricing {
  color_ref: string | number;
  color_mixing_product_type: string;
  base: string;
  pricePerMl: number;
}

export interface Product {
  id: string | number;
  name: string;
  fullName: string; // Tên đầy đủ của SKU để hiển thị
  code: string; // Mã SKU của sản phẩm
  parent_product_ref: string;
  base: string;
  basePrice: number;
  unit_value: number;
  unit: 'Lít' | 'ml' | string; // Có thể giới hạn các đơn vị cụ thể
}

export interface AllData {
  trademarks: Trademark[];
  colors: Color[];
  parentProducts: ParentProduct[];
  colorPricings: ColorPricing[];
  products: Product[];
}