const path = require('path');
const GasPlugin = require('gas-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  return {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? false : 'inline-source-map',
    context: __dirname,
    entry: './src/Mã.ts', // Điểm bắt đầu của ứng dụng
    output: {
      path: path.resolve(__dirname, 'dist'), // Thư mục chứa file kết quả
      filename: 'Mã.js'
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@shared': path.resolve(__dirname, '../shared'),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    plugins: [
      new GasPlugin(), // Đảm bảo tương thích với Google Apps Script
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'appsscript.json',
            to: '.',
            // Nếu bạn chưa có file appsscript.json, webpack sẽ báo lỗi.
            // Bạn có thể tạo file rỗng hoặc tạm thời comment dòng này.
            noErrorOnMissing: true // Bỏ comment dòng này nếu bạn chưa có appsscript.json
          },
        ],
      }),
    ],
  };
};
