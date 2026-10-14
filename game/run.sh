#!/usr/bin/env bash
# Jalankan CropFarm dengan mudah.
#   ./run.sh           mode dev (http://localhost:5173)
#   ./run.sh hp        mode dev, bisa dibuka dari HP di Wi-Fi yang sama
#   ./run.sh build     build produksi ke dist/
#   ./run.sh preview   build lalu jalankan hasil build
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm tidak ditemukan. Install Node.js dulu: https://nodejs.org" >&2
  exit 1
fi

if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
  echo "Menginstall dependensi..."
  npm install
fi

case "${1:-dev}" in
  dev) npm run dev ;;
  hp) npm run dev -- --host ;;
  build) npm run build ;;
  preview) npm run build && npm run preview ;;
  *)
    echo "Pilihan tidak dikenal: $1"
    echo "Pakai: ./run.sh [dev|hp|build|preview]"
    exit 1
    ;;
esac
