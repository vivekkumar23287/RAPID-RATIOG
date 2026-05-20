# 5-Candle Mother Range Setup Scanner - Python Backend

This is a Python FastAPI implementation of the **5-Candle Mother Range Setup** stock scanner. It fetches live 15-minute candlestick data from Yahoo Finance and identifies setups in real-time.

## Prerequisites
Ensure you have Python 3 installed. You'll need to install the following dependencies:

```bash
pip install fastapi uvicorn yfinance pandas pytz
```

## How to Run

1. Navigate to the backend folder in your terminal:
   ```bash
   cd backend
   ```
2. Run the FastAPI development server:
   ```bash
   python scanner_api.py
   ```
3. The backend will be live at `http://127.0.0.1:8000`. You can visit the interactive Swagger API documentation at:
   - `http://127.0.0.1:8000/docs`

## Endpoint

- **Scan all stocks**: `GET http://127.0.0.1:8000/api/scanner-5c`
- **Scan single stock**: `GET http://127.0.0.1:8000/api/scanner-5c?symbol=RELIANCE`
