import time
from datetime import datetime
import pytz
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import uvicorn

app = FastAPI(
    title="5-Candle Mother Range Setup Stock Scanner",
    description="Python FastAPI backend for scanning NSE stocks using yfinance 15m candles",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCAN_SYMBOLS = [
  {"symbol": "RELIANCE", "name": "Reliance Industries"},
  {"symbol": "TCS", "name": "Tata Consultancy Services"},
  {"symbol": "HDFCBANK", "name": "HDFC Bank"},
  {"symbol": "ICICIBANK", "name": "ICICI Bank"},
  {"symbol": "INFY", "name": "Infosys"},
  {"symbol": "POLYCAB", "name": "Polycab India"},
  {"symbol": "TATAMOTORS", "name": "Tata Motors"},
  {"symbol": "SBIN", "name": "State Bank of India"},
  {"symbol": "BHARTIARTL", "name": "Bharti Airtel"},
  {"symbol": "ITC", "name": "ITC Limited"},
  {"symbol": "LT", "name": "Larsen & Toubro"},
  {"symbol": "AXISBANK", "name": "Axis Bank"},
  {"symbol": "WIPRO", "name": "Wipro"},
  {"symbol": "HCLTECH", "name": "HCL Technologies"},
  {"symbol": "MARUTI", "name": "Maruti Suzuki"},
  {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank"},
  {"symbol": "HINDUNILVR", "name": "Hindustan Unilever"},
  {"symbol": "BAJFINANCE", "name": "Bajaj Finance"},
  {"symbol": "ADANIENT", "name": "Adani Enterprises"},
  {"symbol": "SUNPHARMA", "name": "Sun Pharmaceutical"},
  {"symbol": "TITAN", "name": "Titan Company"},
  {"symbol": "BAJAJFINSV", "name": "Bajaj Finserv"},
  {"symbol": "ULTRACEMCO", "name": "UltraTech Cement"},
  {"symbol": "TATASTEEL", "name": "Tata Steel"},
  {"symbol": "NTPC", "name": "NTPC"},
  {"symbol": "JSWSTEEL", "name": "JSW Steel"},
  {"symbol": "ASIANPAINT", "name": "Asian Paints"},
  {"symbol": "M&M", "name": "Mahindra & Mahindra"},
  {"symbol": "POWERGRID", "name": "Power Grid Corp"},
  {"symbol": "ONGC", "name": "ONGC"},
  {"symbol": "ADANIPORTS", "name": "Adani Ports & SEZ"},
  {"symbol": "COALINDIA", "name": "Coal India"},
  {"symbol": "TECHM", "name": "Tech Mahindra"},
  {"symbol": "INDUSINDBK", "name": "IndusInd Bank"},
  {"symbol": "NESTLEIND", "name": "Nestle India"},
  {"symbol": "LTIM", "name": "LTI Mindtree"},
  {"symbol": "HINDALCO", "name": "Hindalco Industries"},
  {"symbol": "BRITANNIA", "name": "Britannia Industries"},
  {"symbol": "GRASIM", "name": "Grasim Industries"},
  {"symbol": "DRREDDY", "name": "Dr. Reddy's"},
  {"symbol": "APOLLOHOSP", "name": "Apollo Hospitals"},
  {"symbol": "EICHERMOT", "name": "Eicher Motors"},
  {"symbol": "SBILIFE", "name": "SBI Life Insurance"},
  {"symbol": "BPCL", "name": "BPCL"},
  {"symbol": "CIPLA", "name": "Cipla"},
  {"symbol": "BAJAJ-AUTO", "name": "Bajaj Auto"},
  {"symbol": "DIVISLAB", "name": "Divi's Laboratories"},
  {"symbol": "HEROMOTOCO", "name": "Hero MotoCorp"},
  {"symbol": "UPL", "name": "UPL"},
  {"symbol": "TATACONSUM", "name": "Tata Consumer Products"},
  {"symbol": "DLF", "name": "DLF Limited"},
  {"symbol": "BHEL", "name": "BHEL"},
  {"symbol": "CANBK", "name": "Canara Bank"},
  {"symbol": "PNB", "name": "Punjab National Bank"},
  {"symbol": "TATAPOWER", "name": "Tata Power"},
  {"symbol": "IRCTC", "name": "IRCTC"},
  {"symbol": "UNIONBANK", "name": "Union Bank of India"},
  {"symbol": "FEDERALBNK", "name": "Federal Bank"},
  {"symbol": "SAIL", "name": "Steel Authority of India"},
  {"symbol": "GMRINFRA", "name": "GMR Airports Infra"},
  {"symbol": "IDFCFIRSTB", "name": "IDFC First Bank"},
  {"symbol": "IOC", "name": "Indian Oil Corp"}
]

def analyze_stock(symbol: str, name: str) -> Optional[Dict[str, Any]]:
    ticker_symbol = f"{symbol}.NS"
    df = yf.download(tickers=ticker_symbol, period="5d", interval="15m", progress=False)
    
    if df.empty or len(df) < 5:
        return None

    df = df.reset_index()
    
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0] for col in df.columns]

    ist = pytz.timezone('Asia/Kolkata')
    df['Datetime_IST'] = df['Datetime'].dt.tz_convert(ist)
    df['Date_Str'] = df['Datetime_IST'].dt.strftime('%d/%m/%Y')
    
    candles = []
    for _, row in df.iterrows():
        candles.append({
            "open": float(round(row['Open'], 2)),
            "high": float(round(row['High'], 2)),
            "low": float(round(row['Low'], 2)),
            "close": float(round(row['Close'], 2)),
            "volume": int(row['Volume']),
            "timestamp": int(row['Datetime_IST'].timestamp()),
            "date": row['Date_Str']
        })

    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for c in candles:
        d = c['date']
        if d not in grouped:
            grouped[d] = []
        grouped[d].append(c)

    sorted_dates = sorted(list(grouped.keys()), key=lambda x: datetime.strptime(x, '%d/%m/%Y'))

    if len(sorted_dates) < 2:
        return None

    today_index = -1
    for d in range(len(sorted_dates) - 1, 0, -1):
        date_str = sorted_dates[d]
        prev_date_str = sorted_dates[d - 1]
        if len(grouped[date_str]) >= 3 and len(grouped[prev_date_str]) >= 2:
            today_index = d
            break

    if today_index == -1:
        return None

    today_date = sorted_dates[today_index]
    yesterday_date = sorted_dates[today_index - 1]

    today_candles = sorted(grouped[today_date], key=lambda x: x['timestamp'])
    yesterday_candles = sorted(grouped[yesterday_date], key=lambda x: x['timestamp'])

    C1 = yesterday_candles[-2]
    C2 = yesterday_candles[-1]
    C3 = today_candles[0]
    C4 = today_candles[1]
    C5 = today_candles[2]

    is_high_ok = (C1['high'] < C3['high']) and (C2['high'] < C3['high']) and (C4['high'] < C3['high']) and (C5['high'] < C3['high'])
    is_low_ok = (C1['low'] > C3['low']) and (C2['low'] > C3['low']) and (C4['low'] > C3['low']) and (C5['low'] > C3['low'])
    
    is_setup_matched = is_high_ok and is_low_ok
    
    current_price = float(round(today_candles[-1]['close'], 2))
    total_volume = sum([c['volume'] for c in today_candles])

    change_pct = 0.0
    try:
        info = yf.Ticker(ticker_symbol).fast_info
        change_pct = float(round(info.get('regular_market_change_percent', 0.0) * 100, 2))
        current_price = float(round(info.get('last_price', current_price), 2))
    except Exception:
        pass

    return {
        "symbol": symbol,
        "name": name,
        "currentPrice": current_price,
        "changePercent": change_pct,
        "isSetupMatched": is_setup_matched,
        "dateDetected": today_date,
        "timeDetected": "10:00 AM (IST)",
        "totalVolume": total_volume,
        "candles": [C1, C2, C3, C4, C5],
        "motherCandleRange": {
            "high": C3['high'],
            "low": C3['low'],
            "open": C3['open'],
            "close": C3['close']
        }
    }

@app.get("/api/scanner-5c")
def get_scanner(symbol: Optional[str] = None):
    start_time = time.time()
    
    if symbol:
        symbols_to_scan = [s for s in SCAN_SYMBOLS if s['symbol'].upper() == symbol.upper()]
    else:
        symbols_to_scan = SCAN_SYMBOLS

    if not symbols_to_scan:
        return {"success": False, "error": "Symbol not found in predefined list"}

    matches = []
    for s in symbols_to_scan:
        try:
            res = analyze_stock(s['symbol'], s['name'])
            if res and res['isSetupMatched']:
                matches.append(res)
        except Exception as e:
            print(f"Error scanning {s['symbol']}: {e}")

    matches = sorted(matches, key=lambda x: x['totalVolume'], reverse=True)
    time_taken = time.time() - start_time

    return {
        "success": True,
        "matchesCount": len(matches),
        "matches": matches,
        "scannedCount": len(symbols_to_scan),
        "timestamp": datetime.now().isoformat(),
        "timeTakenMs": int(time_taken * 1000)
    }

if __name__ == "__main__":
    uvicorn.run("scanner_api:app", host="127.0.0.1", port=8000, reload=True)
