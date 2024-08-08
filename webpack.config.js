const path = require('path');

module.exports = {
    entry: './src/L.DirectionalFlows.js',
    output: {
        filename: 'L.DirectionalFlows.min.js',
        path: path.resolve(__dirname, 'dist')
    },
    mode: 'development',
    externals: {
        'leaflet': 'L'
    }
}
