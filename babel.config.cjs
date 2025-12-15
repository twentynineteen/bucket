module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current'
        },
        modules: 'auto'
      }
    ],
    [
      '@babel/preset-react',
      {
        runtime: 'automatic'
      }
    ],
    [
      '@babel/preset-typescript',
      {
        allowNamespaces: true
      }
    ]
  ],
  plugins: ['@babel/plugin-syntax-jsx'],
  env: {
    test: {
      plugins: [
        [
          'babel-plugin-transform-import-meta',
          {
            target: 'CommonJS',
            replacement: {
              'import.meta.env': JSON.stringify({
                DEV: false,
                PROD: true,
                NODE_ENV: 'test'
              })
            }
          }
        ]
      ]
    }
  }
}
