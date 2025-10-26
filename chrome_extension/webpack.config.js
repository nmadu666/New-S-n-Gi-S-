const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? false : 'inline-source-map',
    entry: {
      sidebar: './src/sidebar.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true, // Xóa thư mục dist trước mỗi lần build
    },
    optimization: {
      minimize: isProduction,
      minimizer: [
        `...`, // Giữ lại trình nén JavaScript mặc định của Webpack
        new CssMinimizerPlugin(),
      ],
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
        {
          test: /\.(sa|sc|c)ss$/i, // Hỗ trợ cả .sass, .scss và .css
          use: [isProduction ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader', 'sass-loader'],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new HtmlWebpackPlugin({
        template: './sidebar.html',
        filename: 'sidebar.html',
        chunks: ['sidebar'], // Chỉ chèn script của sidebar
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'manifest.json' },
          { from: 'service-worker.js' },
          { from: 'images', to: 'images', noErrorOnMissing: true }, // Sửa 'icons' thành 'images'
        ],
      }),
    ],
  };
};