const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const path = require('path');

module.exports = {
    entry: {
        content: './src/app/content.ts',
        popup: './src/ui/popup.tsx'
    },

    plugins: [new CleanWebpackPlugin()],

    output: {
        path: path.resolve(__dirname, 'dist/js'),
        filename: '[name].js'
    },

    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },

    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader'
            },
            {
                test: /\.css$/,
                use: [
                    {
                        loader: 'style-loader',
                        options: { injectType: 'linkTag' }
                    },
                    {
                        loader: 'file-loader',
                        options: {
                            outputPath: '../css/',
                            name: '[name].css',
                            publicPath: 'css/'
                        }
                    }
                ]
            }
        ]
    }
};
