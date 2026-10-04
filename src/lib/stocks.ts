export interface StockSymbol {
  symbol: string;
  name: string;
  sector?: string;
}

export const NIFTY_50_STOCKS: StockSymbol[] = [
  { symbol: "ADANIENT", name: "Adani Enterprises Ltd.", sector: "Metals & Mining" },
  { symbol: "ADANIPORTS", name: "Adani Ports and Special Economic Zone Ltd.", sector: "Services" },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals Enterprise Ltd.", sector: "Healthcare" },
  { symbol: "ASIANPAINT", name: "Asian Paints Ltd.", sector: "Consumer Durables" },
  { symbol: "AXISBANK", name: "Axis Bank Ltd.", sector: "Financial Services" },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto Ltd.", sector: "Automobile" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd.", sector: "Financial Services" },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv Ltd.", sector: "Financial Services" },
  { symbol: "BEL", name: "Bharat Electronics Ltd.", sector: "Capital Goods" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd.", sector: "Telecom" },
  { symbol: "CIPLA", name: "Cipla Ltd.", sector: "Healthcare" },
  { symbol: "COALINDIA", name: "Coal India Ltd.", sector: "Energy" },
  { symbol: "DRREDDY", name: "Dr. Reddy's Laboratories Ltd.", sector: "Healthcare" },
  { symbol: "EICHERMOT", name: "Eicher Motors Ltd.", sector: "Automobile" },
  { symbol: "ETERNAL", name: "Eternal Ltd.", sector: "Consumer Services" },
  { symbol: "GRASIM", name: "Grasim Industries Ltd.", sector: "Construction Materials" },
  { symbol: "HCLTECH", name: "HCL Technologies Ltd.", sector: "Technology" },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd.", sector: "Financial Services" },
  { symbol: "HDFCLIFE", name: "HDFC Life Insurance Company Ltd.", sector: "Financial Services" },
  { symbol: "HINDALCO", name: "Hindalco Industries Ltd.", sector: "Metals & Mining" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd.", sector: "FMCG" },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd.", sector: "Financial Services" },
  { symbol: "ITC", name: "ITC Ltd.", sector: "FMCG" },
  { symbol: "INFY", name: "Infosys Ltd.", sector: "Technology" },
  { symbol: "INDIGO", name: "InterGlobe Aviation Ltd.", sector: "Services" },
  { symbol: "JSWSTEEL", name: "JSW Steel Ltd.", sector: "Metals & Mining" },
  { symbol: "JIOFIN", name: "Jio Financial Services Ltd.", sector: "Financial Services" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank Ltd.", sector: "Financial Services" },
  { symbol: "LT", name: "Larsen & Toubro Ltd.", sector: "Construction" },
  { symbol: "M&M", name: "Mahindra & Mahindra Ltd.", sector: "Automobile" },
  { symbol: "MARUTI", name: "Maruti Suzuki India Ltd.", sector: "Automobile" },
  { symbol: "MAXHEALTH", name: "Max Healthcare Institute Ltd.", sector: "Healthcare" },
  { symbol: "NTPC", name: "NTPC Ltd.", sector: "Utilities" },
  { symbol: "NESTLEIND", name: "Nestle India Ltd.", sector: "FMCG" },
  { symbol: "ONGC", name: "Oil & Natural Gas Corporation Ltd.", sector: "Energy" },
  { symbol: "POWERGRID", name: "Power Grid Corporation of India Ltd.", sector: "Utilities" },
  { symbol: "RELIANCE", name: "Reliance Industries Ltd.", sector: "Energy" },
  { symbol: "SBILIFE", name: "SBI Life Insurance Company Ltd.", sector: "Financial Services" },
  { symbol: "SHRIRAMFIN", name: "Shriram Finance Ltd.", sector: "Financial Services" },
  { symbol: "SBIN", name: "State Bank of India", sector: "Financial Services" },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Industries Ltd.", sector: "Healthcare" },
  { symbol: "TCS", name: "Tata Consultancy Services Ltd.", sector: "Technology" },
  { symbol: "TATACONSUM", name: "Tata Consumer Products Ltd.", sector: "FMCG" },
  { symbol: "TMPV", name: "Tata Motors Passenger Vehicles Ltd.", sector: "Automobile" },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd.", sector: "Metals & Mining" },
  { symbol: "TECHM", name: "Tech Mahindra Ltd.", sector: "Technology" },
  { symbol: "TITAN", name: "Titan Company Ltd.", sector: "Consumer Durables" },
  { symbol: "TRENT", name: "Trent Ltd.", sector: "Consumer Durables" },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement Ltd.", sector: "Construction Materials" },
  { symbol: "WIPRO", name: "Wipro Ltd.", sector: "Technology" },
];

export const getStockName = (symbol: string): string => {
  const cleanSymbol = symbol.toUpperCase().replace(/\.NS$/, '');
  const stock = NIFTY_50_STOCKS.find(s => s.symbol.toUpperCase() === cleanSymbol);
  return stock ? stock.name : cleanSymbol;
};
