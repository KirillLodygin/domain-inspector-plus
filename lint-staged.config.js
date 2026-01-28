module.exports = {
  '*.{js,jsx,ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.vue': ['eslint --fix', 'prettier --write'],
  '*.{css,scss,sass,less}': ['prettier --write'],
  '*.{html,json,md}': ['prettier --write'],
  '*.{yml,yaml}': ['prettier --write'],
}
