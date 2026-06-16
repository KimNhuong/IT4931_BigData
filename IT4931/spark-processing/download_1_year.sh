#!/bin/bash
# Script tải 1 năm dữ liệu aggTrades của BTCUSDT (Năm 2023)
SYMBOL="BTCUSDT"
YEAR="2026"
echo "Bắt đầu tải dữ liệu $SYMBOL năm $YEAR..."
for MONTH in {01..12}; do
    FILE_NAME="${SYMBOL}-aggTrades-${YEAR}-${MONTH}.zip"
    URL="https://data.binance.vision/data/spot/monthly/aggTrades/${SYMBOL}/${FILE_NAME}"   
    echo "Đang tải $FILE_NAME..."
    curl -O $URL   
    echo "Đang giải nén $FILE_NAME..."
   unzip -q $FILE_NAME 
    rm $FILE_NAME
    done
    echo "Hoàn tất! Các file CSV đã sẵn sàng."