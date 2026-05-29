"use client";

import React, { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import { useParams } from "next/navigation";
import { createChart, ColorType, CandlestickSeries, LineSeries, type UTCTimestamp } from "lightweight-charts";
import { ChartLineUp } from "@phosphor-icons/react";


// Display name mapping
const DISPLAY_NAMES: Record<string, string> = {
  NIFTY50: "Nifty 50",
  RELIANCE: "Reliance Industries",
  TCS: "TCS",
  HDFCBANK: "HDFC Bank",
  ICICIBANK: "ICICI Bank",
  INFY: "Infosys",
  POLYCAB: "Polycab India",
  IFORGE: "iForge Limited",
  IEX: "Indian Energy Exchange",
  DEEPAKNTR: "Deepak Nitrite",
  INDIAVIX: "India VIX",
  ETERNAL: "Zomato",
  TMCV: "Tata Motors CV",
  "BTC-USD": "Bitcoin",
  "ETH-USD": "Ethereum",
  "USDT-USD": "Tether USDt",
};

const CRYPTO_SYMBOLS = ["BTC-USD", "ETH-USD", "USDT-USD"];

type StockData = {
  symbol: string;
  name: string;
  currency: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  candles: { time: UTCTimestamp; open: number; high: number; low: number; close: number }[];
};

export default function StockChartPage() {
  const params = useParams();
  const rawSymbol = (params.symbol as string) || "RELIANCE";
  const displayName = DISPLAY_NAMES[rawSymbol.toUpperCase()] || rawSymbol.toUpperCase();
  const isCrypto = CRYPTO_SYMBOLS.includes(rawSymbol.toUpperCase()) || rawSymbol.toUpperCase().endsWith("-USD");
  const currencySymbol = isCrypto ? "$" : "₹";

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const liveCandleRef = useRef<any>(null);

  const [stockData, setStockData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState({ interval: "1d", range: "1y", label: "1D" });
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Drawing Tools & Layout State
  type ChartText = { id: string; time: number; price: number; text: string; offsetX?: number; offsetY?: number };
  type ChartLine = { id: string; price: number; color?: string; width?: number };
  type ChartLayout = { id: string; name: string; lines: ChartLine[]; texts?: ChartText[] };

  const [layouts, setLayouts] = useState<ChartLayout[]>([{ id: "default", name: "Default Layout", lines: [], texts: [] }]);
  const [activeLayoutId, setActiveLayoutId] = useState<string>("default");
  const [drawingMode, setDrawingMode] = useState<'line' | 'text' | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [rsiChartReady, setRsiChartReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const [hoveredCandle, setHoveredCandle] = useState<any>(null);
  const linesRef = useRef<Record<string, any>>({});
  const textDivsRef = useRef<Record<string, HTMLDivElement>>({});
  const svgRef = useRef<SVGSVGElement>(null);

  // Indicator Series Refs
  const ema1SeriesRef = useRef<any>(null);
  const ema2SeriesRef = useRef<any>(null);
  const bbUpperSeriesRef = useRef<any>(null);
  const bbLowerSeriesRef = useRef<any>(null);
  const bbMiddleSeriesRef = useRef<any>(null);
  const rsiChartRef = useRef<any>(null);
  const rsiSeriesRef = useRef<any>(null);

  // Indicator Settings
  const [indicatorSettings, setIndicatorSettings] = useState({
    rsi: {
      enabled: false,
      period: 14,
      smoothingLength: 20,
      color: "#9c27b0",
      maColor: "#FFB000",
      upperLimit: 70,
      middleLimit: 50,
      lowerLimit: 30,
      limitColor: "rgba(100, 116, 139, 0.5)",
      backgroundColor: "rgba(156, 39, 176, 0.05)"
    },
    ema1: { enabled: false, period: 9, color: "#2196f3" },
    ema2: { enabled: false, period: 21, color: "#ff9800" },
    bb: { enabled: false, period: 20, stdDev: 2, color: "rgba(33, 150, 243, 0.2)" },
  });
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);
  const [activeSettingsGroup, setActiveSettingsGroup] = useState<string | null>(null);
  const [rsiTab, setRsiTab] = useState<'inputs' | 'style'>('inputs');

  // Drag state for Callouts
  const draggingRef = useRef<{ id: string, startX: number, startY: number, initialOffsetX: number, initialOffsetY: number, offsetX: number, offsetY: number } | null>(null);

  useEffect(() => {
    // Load saved timeframe from localStorage on component mount
    const savedTf = localStorage.getItem("preferredTimeframe");
    if (savedTf) {
      try { setTimeframe(JSON.parse(savedTf)); } catch (e) { }
    }
  }, [rawSymbol]);

  // --- PERSISTENCE LOGIC (LOCAL + DB) ---
  const saveLayoutToDb = async (layout: ChartLayout) => {
    try {
      setIsSyncing(true);
      await fetch('/api/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: layout.id,
          symbol: rawSymbol.toUpperCase(),
          name: layout.name,
          data: layout
        })
      });
      setIsSyncing(false);
    } catch (error) {
      console.error('Failed to sync layout to DB:', error);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const loadLayouts = async () => {
      setLoading(true);

      // 1. Load from localStorage immediately (Fastest)
      const localData = localStorage.getItem(`layouts_${rawSymbol.toUpperCase()}`);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          setLayouts(parsed.layouts || []);
          setActiveLayoutId(parsed.activeId || "default");
        } catch (e) { console.error("Local storage parse error", e); }
      }

      // 2. Fetch from DB with 5s timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(`/api/layouts?symbol=${rawSymbol.toUpperCase()}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        let mergedLayouts = localData ? JSON.parse(localData).layouts : layouts;

        if (response.ok) {
          const { layouts: dbLayouts } = await response.json();
          if (dbLayouts && dbLayouts.length > 0) {
            mergedLayouts = dbLayouts.map((l: any) => l.data);
          }
        }

        // MIGRATION: Convert old number[] lines to ChartLine[] objects
        const migrated = mergedLayouts.map((l: any) => ({
          ...l,
          lines: (l.lines || []).map((line: any) => 
            typeof line === 'number' ? { id: `migrated-${line}-${Math.random()}`, price: line, color: '#0F2044', width: 2 } : line
          ),
          texts: l.texts || []
        }));

        if (migrated.length > 0) {
          setLayouts(migrated);
          // Set active layout to the first one if current active is not in the list
          if (!migrated.find((l: any) => l.id === activeLayoutId)) {
            setActiveLayoutId(migrated[0].id);
          }
        }
      } catch (error) {
        console.warn('DB Fetch failed or timed out, using local data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLayouts();
  }, [rawSymbol]);

  // Persist to local storage whenever layouts change
  useEffect(() => {
    if (layouts.length > 0) {
      localStorage.setItem(`layouts_${rawSymbol.toUpperCase()}`, JSON.stringify({
        layouts,
        activeId: activeLayoutId
      }));
    }
  }, [layouts, activeLayoutId, rawSymbol]);

  // Redraw lines when chart is ready OR layout switches OR settings change
  useEffect(() => {
    if (!chartReady || !candleSeriesRef.current) return;

    // Clear current lines
    Object.values(linesRef.current).forEach(item => {
      try { candleSeriesRef.current.removePriceLine(item); } catch (e) { }
    });
    linesRef.current = {};

    // Draw active layout lines
    const activeLayout = layouts.find(l => l.id === activeLayoutId);
    if (activeLayout) {
      activeLayout.lines.forEach(line => {
        const price = line.price;
        const isSelected = line.id === selectedLineId;
        const color = isSelected ? '#E01F2E' : (line.color || '#0F2044');
        const width = isSelected ? (line.width || 2) + 1 : (line.width || 2);
        const id = line.id;

        const lineObj = candleSeriesRef.current.createPriceLine({
          price: price,
          color: color,
          lineWidth: width,
          lineStyle: 0, // 0 is Solid
          axisLabelVisible: true,
          title: isSelected ? 'Selected' : 'H-Line',
        });
        linesRef.current[id] = lineObj;
      });
    }
  }, [activeLayoutId, chartReady, layouts, selectedLineId]);

  // Sync Note Texts Overlay positions
  useEffect(() => {
    let animationFrameId: number;
    const updatePositions = () => {
      if (chartReady && chartRef.current && candleSeriesRef.current) {
        const activeLayout = layouts.find(l => l.id === activeLayoutId);
        if (activeLayout?.texts) {
          activeLayout.texts.forEach(t => {
            const div = textDivsRef.current[t.id];
            const line = document.getElementById(`svg-line-${t.id}`);
            const circle = document.getElementById(`svg-circle-${t.id}`);

            let currentOffsetX = t.offsetX ?? 0;
            let currentOffsetY = t.offsetY ?? -60;

            // Override with live drag coordinates if this item is currently being dragged
            if (draggingRef.current?.id === t.id) {
              currentOffsetX = draggingRef.current.offsetX;
              currentOffsetY = draggingRef.current.offsetY;
            }

            if (div) {
              const ax = chartRef.current.timeScale().timeToCoordinate(t.time as any);
              const ay = candleSeriesRef.current.priceToCoordinate(t.price);

              if (ax !== null && ay !== null) {
                const bx = ax + currentOffsetX;
                const by = ay + currentOffsetY;

                // Move HTML Box
                div.style.left = `${bx}px`;
                div.style.top = `${by}px`;
                div.style.display = 'block';

                // Move SVG Line and Circle
                if (line && circle) {
                  line.setAttribute("x1", ax.toString());
                  line.setAttribute("y1", ay.toString());
                  line.setAttribute("x2", bx.toString());
                  line.setAttribute("y2", by.toString());
                  line.style.display = 'block';

                  circle.setAttribute("cx", ax.toString());
                  circle.setAttribute("cy", ay.toString());
                  circle.style.display = 'block';
                }
              } else {
                div.style.display = 'none';
                if (line) line.style.display = 'none';
                if (circle) circle.style.display = 'none';
              }
            }
          });
        }
      }
      animationFrameId = requestAnimationFrame(updatePositions);
    };
    updatePositions();
    return () => cancelAnimationFrame(animationFrameId);
  }, [layouts, activeLayoutId, chartReady]);

  // Global Drag Listeners for Callouts
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current) {
        const dx = e.clientX - draggingRef.current.startX;
        const dy = e.clientY - draggingRef.current.startY;
        draggingRef.current.offsetX = draggingRef.current.initialOffsetX + dx;
        draggingRef.current.offsetY = draggingRef.current.initialOffsetY + dy;
      }
    };

    const handleMouseUp = () => {
      if (draggingRef.current) {
        const { id, offsetX, offsetY } = draggingRef.current;
        setLayouts(prev => prev.map(l => {
          if (l.id === activeLayoutId && l.texts) {
            return {
              ...l,
              texts: l.texts.map(textItem => textItem.id === id ? { ...textItem, offsetX, offsetY } : textItem)
            };
          }
          return l;
        }));
        draggingRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeLayoutId]);

  // Indicator Math
  const calculateEMA = (data: any[], period: number) => {
    if (data.length < period) return [];
    const k = 2 / (period + 1);
    let ema = data[0].close;
    const result = [];
    for (let i = 0; i < data.length; i++) {
      ema = data[i].close * k + ema * (1 - k);
      result.push({ time: data[i].time, value: ema });
    }
    return result;
  };

  const calculateBB = (data: any[], period: number, stdDev: number) => {
    if (data.length < period) return [];
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const sma = slice.reduce((a, b) => a + b.close, 0) / period;
      const variance = slice.reduce((a, b) => a + Math.pow(b.close - sma, 2), 0) / period;
      const sd = Math.sqrt(variance);
      result.push({
        time: data[i].time,
        middle: sma,
        upper: sma + stdDev * sd,
        lower: sma - stdDev * sd
      });
    }
    return result;
  };

  const calculateRSI = (data: any[], period: number) => {
    if (data.length <= period) return [];
    const result = [];
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = data[i].close - data[i - 1].close;
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i].close - data[i - 1].close;
      avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push({ time: data[i].time, value: 100 - 100 / (1 + rs) });
    }
    return result;
  };

  const handleTimeframeChange = (tf: typeof timeframe) => {
    setTimeframe(tf);
    localStorage.setItem("preferredTimeframe", JSON.stringify(tf));
  };

  // 1. Chart Initialization
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    container.innerHTML = "";

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "#FFFFFF" },
        textColor: "#475569",
        fontFamily: "Satoshi, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#F1F5F9" },
        horzLines: { color: "#F1F5F9" },
      },
      width: container.clientWidth,
      height: container.clientHeight,
      localization: {
        timeFormatter: (t: number) => {
          const d = new Date(t * 1000);
          if (["1m", "5m", "15m", "30m", "60m"].includes(timeframe.interval)) {
            return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
          }
          return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        },
      },
      crosshair: {
        mode: 0,
        vertLine: { labelBackgroundColor: '#E01F2E' },
        horzLine: { labelBackgroundColor: '#E01F2E' },
      },
      rightPriceScale: {
        borderColor: "#E2E8F0",
        autoScale: true,
        alignLabels: true,
      },
      timeScale: {
        borderColor: "#E2E8F0",
        timeVisible: ["1m", "5m", "15m", "30m", "60m"].includes(timeframe.interval),
        rightOffset: 15,
        barSpacing: 10,
        minBarSpacing: 1,
        shiftVisibleRangeOnNewBar: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderDownColor: "#ef5350",
      borderUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      wickUpColor: "#26a69a",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    setChartReady(true);

    // Handle resize
    const handleResize = () => {
      if (container) {
        chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      ema1SeriesRef.current = null;
      ema2SeriesRef.current = null;
      bbUpperSeriesRef.current = null;
      bbLowerSeriesRef.current = null;
      bbMiddleSeriesRef.current = null;
      if (rsiChartRef.current) rsiChartRef.current.remove();
      rsiChartRef.current = null;
    };
  }, [timeframe.interval, indicatorSettings.rsi.enabled]);

  // 1.5 Handle Indicator Series Updates
  useEffect(() => {
    if (!chartReady || !chartRef.current || !stockData || !stockData.candles) return;

    const data = stockData.candles;

    // EMA 1
    if (indicatorSettings.ema1.enabled) {
      if (!ema1SeriesRef.current) {
        ema1SeriesRef.current = chartRef.current.addSeries(LineSeries, {
          color: indicatorSettings.ema1.color,
          lineWidth: 2,
          title: `EMA ${indicatorSettings.ema1.period}`,
        });
      } else {
        ema1SeriesRef.current.applyOptions({ color: indicatorSettings.ema1.color, title: `EMA ${indicatorSettings.ema1.period}` });
      }
      ema1SeriesRef.current.setData(calculateEMA(data, indicatorSettings.ema1.period));
    } else if (ema1SeriesRef.current) {
      chartRef.current.removeSeries(ema1SeriesRef.current);
      ema1SeriesRef.current = null;
    }

    // EMA 2
    if (indicatorSettings.ema2.enabled) {
      if (!ema2SeriesRef.current) {
        ema2SeriesRef.current = chartRef.current.addSeries(LineSeries, {
          color: indicatorSettings.ema2.color,
          lineWidth: 2,
          title: `EMA ${indicatorSettings.ema2.period}`,
        });
      } else {
        ema2SeriesRef.current.applyOptions({ color: indicatorSettings.ema2.color, title: `EMA ${indicatorSettings.ema2.period}` });
      }
      ema2SeriesRef.current.setData(calculateEMA(data, indicatorSettings.ema2.period));
    } else if (ema2SeriesRef.current) {
      chartRef.current.removeSeries(ema2SeriesRef.current);
      ema2SeriesRef.current = null;
    }

    // Bollinger Bands
    if (indicatorSettings.bb.enabled) {
      const bbData = calculateBB(data, indicatorSettings.bb.period, indicatorSettings.bb.stdDev);

      if (!bbMiddleSeriesRef.current) {
        bbMiddleSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: "rgba(33, 150, 243, 0.4)", lineWidth: 1, lineStyle: 2 });
        bbUpperSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: "rgba(33, 150, 243, 0.4)", lineWidth: 1 });
        bbLowerSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: "rgba(33, 150, 243, 0.4)", lineWidth: 1 });
      }

      bbMiddleSeriesRef.current.setData(bbData.map(d => ({ time: d.time, value: d.middle })));
      bbUpperSeriesRef.current.setData(bbData.map(d => ({ time: d.time, value: d.upper })));
      bbLowerSeriesRef.current.setData(bbData.map(d => ({ time: d.time, value: d.lower })));
    } else if (bbMiddleSeriesRef.current) {
      chartRef.current.removeSeries(bbMiddleSeriesRef.current);
      chartRef.current.removeSeries(bbUpperSeriesRef.current);
      chartRef.current.removeSeries(bbLowerSeriesRef.current);
      bbMiddleSeriesRef.current = null;
      bbUpperSeriesRef.current = null;
      bbLowerSeriesRef.current = null;
    }

    // RSI Handling
    if (indicatorSettings.rsi.enabled) {
      const rsiData = calculateRSI(data, indicatorSettings.rsi.period);

      // Calculate Smoothed MA of RSI
      const smoothedMAData: any[] = [];
      const smoothLen = indicatorSettings.rsi.smoothingLength;
      for (let i = smoothLen; i < rsiData.length; i++) {
        const slice = rsiData.slice(i - smoothLen, i);
        const sum = slice.reduce((acc, val) => acc + val.value, 0);
        smoothedMAData.push({
          time: rsiData[i].time,
          value: sum / smoothLen
        });
      }

      if (!rsiChartRef.current && rsiContainerRef.current) {
        // Create RSI Chart
        const rsiChart = createChart(rsiContainerRef.current, {
          width: rsiContainerRef.current.clientWidth,
          height: rsiContainerRef.current.clientHeight,
          layout: { background: { type: ColorType.Solid, color: "#FFFFFF" }, textColor: "#475569", fontFamily: "Satoshi, sans-serif" },
          grid: { vertLines: { visible: false }, horzLines: { color: "#F1F5F9" } },
          timeScale: { 
            visible: false,
            rightOffset: 15,
            barSpacing: 10,
            minBarSpacing: 1,
            shiftVisibleRangeOnNewBar: true,
          },
          rightPriceScale: { borderColor: "#E2E8F0", scaleMargins: { top: 0.1, bottom: 0.1 }, autoScale: true },
        });

        const rsiSeries = rsiChart.addSeries(LineSeries, {
          color: indicatorSettings.rsi.color,
          lineWidth: 2,
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
        });

        const rsiMASeries = rsiChart.addSeries(LineSeries, {
          color: indicatorSettings.rsi.maColor,
          lineWidth: 2,
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
        });

        rsiChartRef.current = rsiChart;
        rsiSeriesRef.current = rsiSeries;
        (rsiChartRef.current as any).maSeries = rsiMASeries;
        setRsiChartReady(true);
      }


      if (rsiSeriesRef.current) {
        rsiSeriesRef.current.setData(rsiData);
        rsiSeriesRef.current.applyOptions({ color: indicatorSettings.rsi.color });

        // Update MA
        const maSeries = (rsiChartRef.current as any).maSeries;
        if (maSeries) {
          maSeries.setData(smoothedMAData);
          maSeries.applyOptions({ color: indicatorSettings.rsi.maColor });
        }


      }
    } else if (rsiChartRef.current) {
      rsiChartRef.current.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
      setRsiChartReady(false);
    }
  }, [chartReady, stockData, indicatorSettings]);

  // 1.6 Sync Main Chart and RSI Chart Time Scales
  useEffect(() => {
    if (!chartRef.current || !rsiChartRef.current) return;

    const mainTimeScale = chartRef.current.timeScale();
    const rsiTimeScale = rsiChartRef.current.timeScale();
    let isSyncing = false;

    const syncRsi = () => {
      if (isSyncing || !chartRef.current || !rsiChartRef.current) return;
      isSyncing = true;
      try {
        const logicalRange = mainTimeScale.getLogicalRange();
        if (logicalRange) rsiChartRef.current.timeScale().setLogicalRange(logicalRange);
      } catch (e) {}
      isSyncing = false;
    };

    const syncMain = () => {
      if (isSyncing || !chartRef.current || !rsiChartRef.current) return;
      isSyncing = true;
      try {
        const logicalRange = rsiTimeScale.getLogicalRange();
        if (logicalRange) chartRef.current.timeScale().setLogicalRange(logicalRange);
      } catch (e) {}
      isSyncing = false;
    };

    // Crosshair Sync
    const syncCrosshairRsi = (param: any) => {
      if (!rsiChartRef.current || !param.point) {
        rsiChartRef.current?.clearCrosshairPosition();
        return;
      }
      rsiChartRef.current.setCrosshairPosition(param.price, param.time, rsiSeriesRef.current);
    };

    const syncCrosshairMain = (param: any) => {
      if (!chartRef.current || !param.point) {
        chartRef.current?.clearCrosshairPosition();
        return;
      }
      chartRef.current.setCrosshairPosition(param.price, param.time, candleSeriesRef.current);
    };

    mainTimeScale.subscribeVisibleLogicalRangeChange(syncRsi);
    rsiTimeScale.subscribeVisibleLogicalRangeChange(syncMain);
    
    chartRef.current.subscribeCrosshairMove(syncCrosshairRsi);
    rsiChartRef.current.subscribeCrosshairMove(syncCrosshairMain);

    return () => {
      try { mainTimeScale.unsubscribeVisibleLogicalRangeChange(syncRsi); } catch (e) {}
      try { rsiTimeScale.unsubscribeVisibleLogicalRangeChange(syncMain); } catch (e) {}
      try { chartRef.current?.unsubscribeCrosshairMove(syncCrosshairRsi); } catch (e) {}
      try { rsiChartRef.current?.unsubscribeCrosshairMove(syncCrosshairMain); } catch (e) {}
    };
  }, [chartReady, rsiChartReady]); // Only re-sync when charts are ready or RSI is created

  // 2. Data Fetching & Live Polling (10s)
  useEffect(() => {
    let isMounted = true;
    let isFirstLoad = true;

    setLoading(true);
    setError(null);

    const fetchData = () => {
      const dateParam = selectedDate ? `&date=${selectedDate}` : "";
      // Use cache: 'no-store' to ensure we always get the live data from the API
      fetch(`/api/stock-data?symbol=${encodeURIComponent(rawSymbol)}&range=${timeframe.range}&interval=${timeframe.interval}${dateParam}`, { cache: "no-store" })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch data");
          return res.json();
        })
        .then((data) => {
          if (!isMounted) return;
          if (data.error) throw new Error(data.error);

          setStockData(data);

          if (candleSeriesRef.current && data.candles && data.candles.length > 0) {
            const candles = data.candles as { time: UTCTimestamp; open: number; high: number; low: number; close: number }[];
            const lastCandle = candles[candles.length - 1];

            // If we are still in the same minute, accumulate the high and low
            if (liveCandleRef.current && liveCandleRef.current.time === lastCandle.time) {
              lastCandle.high = Math.max(liveCandleRef.current.high, lastCandle.high);
              lastCandle.low = Math.min(liveCandleRef.current.low, lastCandle.low);
            }

            // Save the state for the next poll
            liveCandleRef.current = { ...lastCandle };

            candleSeriesRef.current.setData(candles);
            if (isFirstLoad) {
              // Ensure exactly 55 candles are visible on first load
              const totalCandles = candles.length;
              chartRef.current?.timeScale().setVisibleLogicalRange({
                from: Math.max(0, totalCandles - 55),
                to: totalCandles - 1,
              });
              isFirstLoad = false;
            }
          }
          setLoading(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          setError(err.message);
          setLoading(false);
        });
    };

    // Initial fetch
    fetchData();

    let intervalId: NodeJS.Timeout;
    let ws: WebSocket;

    if (!selectedDate && isCrypto) {
      // Real-time WebSocket for Crypto via Binance
      const binanceIntervalMap: Record<string, string> = {
        "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
        "60m": "1h", "1d": "1d", "1mo": "1M"
      };

      const binanceInterval = binanceIntervalMap[timeframe.interval] || "1d";
      const binanceSymbol = rawSymbol.toLowerCase().replace("-usd", "usdt");

      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${binanceSymbol}@kline_${binanceInterval}`);

      ws.onmessage = (event) => {
        if (!isMounted) return;
        const message = JSON.parse(event.data);

        if (message.e === "kline") {
          const k = message.k;
          const currentPrice = parseFloat(k.c);
          const isClosed = k.x; // true if the candle has completed

          if (candleSeriesRef.current) {
            let updateTime = Math.floor(k.t / 1000);

            // Fix lightweight-charts "Cannot update oldest data" error
            // Binance timestamp might be slightly older than Yahoo's latest candle
            if (liveCandleRef.current && updateTime < liveCandleRef.current.time) {
              updateTime = liveCandleRef.current.time;
            }

            candleSeriesRef.current.update({
              time: updateTime as UTCTimestamp,
              open: parseFloat(k.o),
              high: Math.max(parseFloat(k.h), liveCandleRef.current?.high || 0),
              low: liveCandleRef.current?.low ? Math.min(parseFloat(k.l), liveCandleRef.current.low) : parseFloat(k.l),
              close: currentPrice
            });

            if (liveCandleRef.current) {
              liveCandleRef.current.time = updateTime;
            }
          }

          setStockData(prev => {
            if (!prev) return prev;
            if (prev.currentPrice === currentPrice && !isClosed) return prev; // Avoid unnecessary re-renders

            const change = currentPrice - prev.previousClose;
            const changePercent = prev.previousClose ? (change / prev.previousClose) * 100 : 0;

            return {
              ...prev,
              currentPrice,
              change,
              changePercent
            };
          });

          // CANDLE COMPLETION VERIFIER SYSTEM:
          // As soon as the real-time websocket completes/closes a candle (isClosed === true),
          // we trigger an immediate background API sync to fetch the official completed historical candle 
          // direct from Yahoo Finance. This guarantees 100% exact alignment with authoritative charts!
          if (isClosed) {
            fetchData();
          }
        }
      };
    } else if (!selectedDate) {
      // 5-second polling for live updates on NSE stocks (already direct sync with Yahoo Finance)
      intervalId = setInterval(fetchData, 5000);
    }

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
      if (ws) ws.close();
    };
  }, [rawSymbol, timeframe.interval, timeframe.range, selectedDate]);

  const [lineToolbarPos, setLineToolbarPos] = useState<{ x: number, y: number, price: number } | null>(null);

  // 2. Drawing Tools Handler
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !chartContainerRef.current) return;

    const clickHandler = (param: any) => {
      if (!param.point) return;

      const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
      let time = param.time;
      if (!time) {
        // If clicked on empty space, try to find time from x coordinate
        time = chartRef.current.timeScale().coordinateToTime(param.point.x);
      }
      if (price === null) return;

      // Check if we clicked on an existing line
      const activeLayout = layouts.find(l => l.id === activeLayoutId);
      if (activeLayout) {
        const clickedLine = activeLayout.lines.find(line => {
          const lineY = candleSeriesRef.current.priceToCoordinate(line.price);
          return lineY !== null && Math.abs(param.point.y - lineY) < 10;
        });

        if (clickedLine) {
          setSelectedLineId(clickedLine.id);
          setLineToolbarPos({ x: param.point.x, y: param.point.y, price: clickedLine.price });
          setDrawingMode(null);
          return;
        } else {
          setSelectedLineId(null);
          setLineToolbarPos(null);
        }
      }

      if (drawingMode === 'line') {
        const newLine: ChartLine = {
          id: Date.now().toString(),
          price: price,
          color: '#0F2044',
          width: 2
        };

        setLayouts(prev => {
          const updated = prev.map(l =>
            l.id === activeLayoutId ? { ...l, lines: [...l.lines, newLine] } : l
          );
          const current = updated.find(l => l.id === activeLayoutId);
          if (current) saveLayoutToDb(current);
          return updated;
        });
        setDrawingMode(null);
      } else if (drawingMode === 'text') {
        const note = prompt("Enter your note:");
        if (note && note.trim() !== "") {
          const newText: ChartText = {
            id: Date.now().toString(),
            time: time as number,
            price: price,
            text: note.trim(),
            offsetX: 0,
            offsetY: -60
          };
          setLayouts(prev => {
            const updated = prev.map(l =>
              l.id === activeLayoutId ? { ...l, texts: [...(l.texts || []), newText] } : l
            );
            const current = updated.find(l => l.id === activeLayoutId);
            if (current) saveLayoutToDb(current);
            return updated;
          });
        }
        setDrawingMode(null);
      }
    };

    const crosshairMoveHandler = (param: any) => {
      if (!chartContainerRef.current) return;
      
      if (!param.point) {
        setHoveredCandle(null);
        chartContainerRef.current.style.cursor = 'default';
        return;
      }

      let candle = null;
      if (param.time && candleSeriesRef.current) {
        try {
          candle = param.seriesData.get(candleSeriesRef.current);
        } catch (e) {}
      }
      if (!candle && param.time && stockData?.candles) {
        candle = stockData.candles.find((c: any) => c.time === param.time);
      }
      setHoveredCandle(candle || null);

      if (drawingMode) {
        chartContainerRef.current.style.cursor = 'crosshair';
        return;
      }

      // Check if near any line for pointer cursor
      const activeLayout = layouts.find(l => l.id === activeLayoutId);
      if (activeLayout) {
        const isNearLine = activeLayout.lines.some(line => {
          const lPrice = typeof line === 'number' ? line : line.price;
          const lineY = candleSeriesRef.current.priceToCoordinate(lPrice);
          return lineY !== null && Math.abs(param.point.y - lineY) < 10;
        });

        chartContainerRef.current.style.cursor = isNearLine ? 'pointer' : 'default';
      }
    };

    chartRef.current.subscribeCrosshairMove(crosshairMoveHandler);
    chartRef.current.subscribeClick(clickHandler);

    return () => {
      if (chartRef.current) {
        chartRef.current.unsubscribeClick(clickHandler);
        chartRef.current.unsubscribeCrosshairMove(crosshairMoveHandler);
      }
    };
  }, [drawingMode, activeLayoutId, layouts, chartReady, stockData]);

  const isPositive = stockData ? stockData.change >= 0 : true;

  const timeframes = [
    { label: "1m", interval: "1m", range: "1d" },
    { label: "5m", interval: "5m", range: "5d" },
    { label: "15m", interval: "15m", range: "10d" },
    { label: "30m", interval: "30m", range: "15d" },
    { label: "1H", interval: "60m", range: "30d" },
    { label: "1D", interval: "1d", range: "1y" },
    { label: "1M", interval: "1mo", range: "max" },
  ]; const updateSelectedLine = (updates: Partial<ChartLine>) => {
    if (!selectedLineId) return;
    setLayouts(prev => {
      const updated = prev.map(l =>
        l.id === activeLayoutId ? {
          ...l,
          lines: l.lines.map(line => line.id === selectedLineId ? { ...line, ...updates } : line)
        } : l
      );
      const current = updated.find(l => l.id === activeLayoutId);
      if (current) saveLayoutToDb(current);
      return updated;
    });
  };

  const deleteSelectedLine = () => {
    if (!selectedLineId) return;
    setLayouts(prev => {
      const updated = prev.map(l =>
        l.id === activeLayoutId ? {
          ...l,
          lines: l.lines.filter(line => line.id !== selectedLineId)
        } : l
      );
      const current = updated.find(l => l.id === activeLayoutId);
      if (current) saveLayoutToDb(current);
      return updated;
    });
    setSelectedLineId(null);
    setLineToolbarPos(null);
  };

  return (
    <main style={{ height: "100vh", maxHeight: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", background: "#FFFFFF", position: "relative" }}>
      {/* Unified Top Controls Bar */}
      <div
        style={{
          maxWidth: "100%",
          margin: "0 auto",
          width: "100%",
          padding: "12px 24px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
          position: "relative",
          zIndex: 10,
          borderBottom: "1px solid #E2E8F0",
          background: "#FFFFFF"
        }}
      >
        {/* Left Section: Stock Title Details */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h1
            style={{
              fontFamily: "Satoshi, sans-serif",
              fontWeight: 900,
              fontSize: "20px",
              color: "#0F2044",
              margin: 0,
              letterSpacing: "-0.5px",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "baseline",
              gap: "6px"
            }}
          >
            {displayName}{" "}
            <span style={{ color: "#94A3B8", fontWeight: 700, fontSize: "13px" }}>
              {rawSymbol.toUpperCase()}
            </span>
          </h1>
          {isSyncing && (
            <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 500, animation: "pulse 2s infinite", whiteSpace: "nowrap" }}>Syncing...</span>
          )}
        </div>

        {/* Center Section: Controls (Date, Interval, Indicators, Layouts) */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", flex: 1, justifyContent: "flex-start", marginLeft: "12px" }}>
          
          {/* Date Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', fontFamily: 'Satoshi, sans-serif' }}>Date:</span>
            <input
              type="date"
              value={selectedDate}
              max={new Date().toISOString().split("T")[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1.5px solid #E2E8F0',
                background: '#F8FAFC',
                fontFamily: 'Satoshi, sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                color: '#0F2044',
                outline: 'none',
                transition: 'all 0.2s',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "#0F2044"}
              onBlur={(e) => e.currentTarget.style.borderColor = "#E2E8F0"}
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate("")}
                style={{
                  background: '#E01F2E',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  boxShadow: "0 2px 8px rgba(224, 31, 46, 0.25)"
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "none"}
              >
                Live
              </button>
            )}
          </div>

          <div style={{ width: "1px", height: "20px", background: "#E2E8F0" }} />

          {/* Timeframe Selectors */}
          <div style={{ display: "flex", gap: "4px" }}>
            {timeframes.map((tf) => {
              const isActive = timeframe.interval === tf.interval;
              return (
                <button
                  key={tf.interval}
                  onClick={() => handleTimeframeChange(tf)}
                  style={{
                    fontFamily: "Satoshi, sans-serif",
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                    background: isActive ? "#0F2044" : "#F1F5F9",
                    color: isActive ? "#FFFFFF" : "#475569",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "#E2E8F0";
                      e.currentTarget.style.color = "#0F2044";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "#F1F5F9";
                      e.currentTarget.style.color = "#475569";
                    }
                  }}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>

          <div style={{ width: "1px", height: "20px", background: "#E2E8F0" }} />

          {/* Indicator Settings Toggle Menu */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowIndicatorMenu(!showIndicatorMenu)}
              style={{
                fontFamily: "Satoshi, sans-serif",
                fontSize: "12px",
                fontWeight: 700,
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                background: showIndicatorMenu ? "#E01F2E" : "#0F2044",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: showIndicatorMenu ? "0 4px 12px rgba(224, 31, 46, 0.2)" : "0 4px 12px rgba(15, 32, 68, 0.1)"
              }}
            >
              <ChartLineUp size={14} weight="bold" />
              Indicators
            </button>

            {showIndicatorMenu && (
              <div style={{
                position: "absolute",
                top: "40px",
                left: "0",
                width: "280px",
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(24px)",
                borderRadius: "14px",
                boxShadow: "0 24px 80px rgba(15, 32, 68, 0.12)",
                border: "1px solid #E2E8F0",
                zIndex: 1000,
                padding: "0",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden"
              }}>
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  padding: "12px 16px", 
                  borderBottom: "1px solid #E2E8F0", 
                  background: "#F8FAFC" 
                }}>
                  <span style={{ fontWeight: 800, fontSize: "12px", color: "#0F2044", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "Satoshi, sans-serif" }}>Indicator Options</span>
                  <button 
                    onClick={() => setShowIndicatorMenu(false)} 
                    style={{ 
                      background: "none", 
                      border: "none", 
                      cursor: "pointer", 
                      color: "rgba(15, 32, 68, 0.4)", 
                      fontSize: "14px",
                      transition: "color 0.2s" 
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = "#0F2044"}
                    onMouseLeave={(e) => e.currentTarget.style.color = "rgba(15, 32, 68, 0.4)"}
                  >✕</button>
                </div>

                <div style={{ maxHeight: "380px", overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {/* EMA Section */}
                  <div style={{ border: "1px solid #E2E8F0", borderRadius: "10px", background: "#F8FAFC", overflow: "hidden" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: (indicatorSettings.ema1.enabled || indicatorSettings.ema2.enabled) ? "#F1F5F9" : "transparent",
                        borderBottom: (indicatorSettings.ema1.enabled || indicatorSettings.ema2.enabled) ? "1px solid #E2E8F0" : "none"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input
                          id="ema-toggle"
                          type="checkbox"
                          checked={indicatorSettings.ema1.enabled || indicatorSettings.ema2.enabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setIndicatorSettings({ ...indicatorSettings, ema1: { ...indicatorSettings.ema1, enabled: val }, ema2: { ...indicatorSettings.ema2, enabled: val } });
                          }}
                          style={{ cursor: "pointer", accentColor: "#E01F2E" }}
                        />
                        <label htmlFor="ema-toggle" style={{ fontWeight: 700, fontSize: "12px", color: "#0F2044", cursor: "pointer", fontFamily: "Satoshi, sans-serif" }}>EMA Ribbon (Cross)</label>
                      </div>
                    </div>

                    {(indicatorSettings.ema1.enabled || indicatorSettings.ema2.enabled) && (
                      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", fontFamily: "Satoshi, sans-serif" }}>SHORT EMA</span>
                            <input type="color" value={indicatorSettings.ema1.color} onChange={(e) => setIndicatorSettings({ ...indicatorSettings, ema1: { ...indicatorSettings.ema1, color: e.target.value } })} style={{ width: "20px", height: "20px", border: "none", padding: 0, background: "none", cursor: "pointer" }} />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "10px", color: "#475569", width: "35px", fontFamily: "Satoshi, sans-serif" }}>Period</span>
                            <input type="number" value={indicatorSettings.ema1.period} onChange={(e) => setIndicatorSettings({ ...indicatorSettings, ema1: { ...indicatorSettings.ema1, period: parseInt(e.target.value) || 1 } })} style={{ flex: 1, padding: "4px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F2044", fontSize: "11px", outline: "none" }} />
                          </div>
                        </div>
                        <div style={{ paddingTop: "10px", borderTop: "1px solid #E2E8F0" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", fontFamily: "Satoshi, sans-serif" }}>LONG EMA</span>
                            <input type="color" value={indicatorSettings.ema2.color} onChange={(e) => setIndicatorSettings({ ...indicatorSettings, ema2: { ...indicatorSettings.ema2, color: e.target.value } })} style={{ width: "20px", height: "20px", border: "none", padding: 0, background: "none", cursor: "pointer" }} />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "10px", color: "#475569", width: "35px", fontFamily: "Satoshi, sans-serif" }}>Period</span>
                            <input type="number" value={indicatorSettings.ema2.period} onChange={(e) => setIndicatorSettings({ ...indicatorSettings, ema2: { ...indicatorSettings.ema2, period: parseInt(e.target.value) || 1 } })} style={{ flex: 1, padding: "4px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F2044", fontSize: "11px", outline: "none" }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bollinger Bands Section */}
                  <div style={{ border: "1px solid #E2E8F0", borderRadius: "10px", background: "#F8FAFC", overflow: "hidden" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: indicatorSettings.bb.enabled ? "#F1F5F9" : "transparent",
                        borderBottom: indicatorSettings.bb.enabled ? "1px solid #E2E8F0" : "none"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input
                          id="bb-toggle"
                          type="checkbox"
                          checked={indicatorSettings.bb.enabled}
                          onChange={(e) => setIndicatorSettings({ ...indicatorSettings, bb: { ...indicatorSettings.bb, enabled: e.target.checked } })}
                          style={{ cursor: "pointer", accentColor: "#E01F2E" }}
                        />
                        <label htmlFor="bb-toggle" style={{ fontWeight: 700, fontSize: "12px", color: "#0F2044", cursor: "pointer", fontFamily: "Satoshi, sans-serif" }}>Bollinger Bands</label>
                      </div>
                    </div>
                    {indicatorSettings.bb.enabled && (
                      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "10px", color: "#475569", width: "45px", fontFamily: "Satoshi, sans-serif" }}>Length</span>
                          <input type="number" value={indicatorSettings.bb.period} onChange={(e) => setIndicatorSettings({ ...indicatorSettings, bb: { ...indicatorSettings.bb, period: parseInt(e.target.value) || 1 } })} style={{ flex: 1, padding: "4px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F2044", fontSize: "11px", outline: "none" }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "10px", color: "#475569", width: "45px", fontFamily: "Satoshi, sans-serif" }}>StdDev</span>
                          <input type="number" step="0.1" value={indicatorSettings.bb.stdDev} onChange={(e) => setIndicatorSettings({ ...indicatorSettings, bb: { ...indicatorSettings.bb, stdDev: parseFloat(e.target.value) || 0.1 } })} style={{ flex: 1, padding: "4px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F2044", fontSize: "11px", outline: "none" }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RSI Section */}
                  <div style={{ border: "1px solid #E2E8F0", borderRadius: "10px", background: "#F8FAFC", overflow: "hidden" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: indicatorSettings.rsi.enabled ? "#F1F5F9" : "transparent",
                        borderBottom: indicatorSettings.rsi.enabled ? "1px solid #E2E8F0" : "none"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input
                          id="rsi-toggle"
                          type="checkbox"
                          checked={indicatorSettings.rsi.enabled}
                          onChange={(e) => setIndicatorSettings({ ...indicatorSettings, rsi: { ...indicatorSettings.rsi, enabled: e.target.checked } })}
                          style={{ cursor: "pointer", accentColor: "#E01F2E" }}
                        />
                        <label htmlFor="rsi-toggle" style={{ fontWeight: 700, fontSize: "12px", color: "#0F2044", cursor: "pointer", fontFamily: "Satoshi, sans-serif" }}>RSI Oscillator</label>
                      </div>
                    </div>

                    {indicatorSettings.rsi.enabled && (
                      <div style={{ padding: "0 12px 12px 12px" }}>
                        <div style={{ display: "flex", gap: "10px", borderBottom: "1px solid #E2E8F0", marginBottom: "10px" }}>
                          <button onClick={() => setRsiTab('inputs')} style={{ padding: "6px 0", fontSize: "11px", fontWeight: 700, border: "none", background: "none", borderBottom: rsiTab === 'inputs' ? "2px solid #E01F2E" : "2px solid transparent", color: rsiTab === 'inputs' ? "#0F2044" : "rgba(15, 32, 68, 0.4)", cursor: "pointer", transition: "all 0.2s" }}>Inputs</button>
                          <button onClick={() => setRsiTab('style')} style={{ padding: "6px 0", fontSize: "11px", fontWeight: 700, border: "none", background: "none", borderBottom: rsiTab === 'style' ? "2px solid #E01F2E" : "2px solid transparent", color: rsiTab === 'style' ? "#0F2044" : "rgba(15, 32, 68, 0.4)", cursor: "pointer", transition: "all 0.2s" }}>Style</button>
                        </div>

                        {rsiTab === 'inputs' ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: "10px", color: "#64748B", fontFamily: "Satoshi, sans-serif" }}>RSI Length</span>
                              <input type="number" value={indicatorSettings.rsi.period} onChange={(e) => setIndicatorSettings({ ...indicatorSettings, rsi: { ...indicatorSettings.rsi, period: parseInt(e.target.value) || 1 } })} style={{ width: "55px", padding: "4px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F2044", fontSize: "11px", outline: "none" }} />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: "10px", color: "#64748B", fontFamily: "Satoshi, sans-serif" }}>MA Smooth</span>
                              <input type="number" value={indicatorSettings.rsi.smoothingLength} onChange={(e) => setIndicatorSettings({ ...indicatorSettings, rsi: { ...indicatorSettings.rsi, smoothingLength: parseInt(e.target.value) || 1 } })} style={{ width: "55px", padding: "4px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F2044", fontSize: "11px", outline: "none" }} />
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: "10px", color: "#64748B", fontFamily: "Satoshi, sans-serif" }}>RSI Line</span>
                              <input type="color" value={indicatorSettings.rsi.color} onChange={(e) => setIndicatorSettings({ ...indicatorSettings, rsi: { ...indicatorSettings.rsi, color: e.target.value } })} style={{ width: "20px", height: "20px", border: "none", background: "none", cursor: "pointer" }} />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: "10px", color: "#64748B", fontFamily: "Satoshi, sans-serif" }}>Signal MA</span>
                              <input type="color" value={indicatorSettings.rsi.maColor} onChange={(e) => setIndicatorSettings({ ...indicatorSettings, rsi: { ...indicatorSettings.rsi, maColor: e.target.value } })} style={{ width: "20px", height: "20px", border: "none", background: "none", cursor: "pointer" }} />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "6px", borderTop: "1px dashed #E2E8F0" }}>
                              <span style={{ fontSize: "9px", color: "#64748B", fontWeight: 700, fontFamily: "Satoshi, sans-serif" }}>UPPER LIMIT</span>
                              <input type="number" value={indicatorSettings.rsi.upperLimit} onChange={(e) => setIndicatorSettings({ ...indicatorSettings, rsi: { ...indicatorSettings.rsi, upperLimit: parseInt(e.target.value) || 0 } })} style={{ width: "45px", padding: "3px 6px", borderRadius: "4px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F2044", fontSize: "10px", outline: "none" }} />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: "9px", color: "#64748B", fontWeight: 700, fontFamily: "Satoshi, sans-serif" }}>LOWER LIMIT</span>
                              <input type="number" value={indicatorSettings.rsi.lowerLimit} onChange={(e) => setIndicatorSettings({ ...indicatorSettings, rsi: { ...indicatorSettings.rsi, lowerLimit: parseInt(e.target.value) || 0 } })} style={{ width: "45px", padding: "3px 6px", borderRadius: "4px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F2044", fontSize: "10px", outline: "none" }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ width: "1px", height: "20px", background: "#E2E8F0" }} />

          {/* Layout Manager */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <select
              value={activeLayoutId}
              onChange={(e) => setActiveLayoutId(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1.5px solid #E2E8F0",
                background: "#F8FAFC",
                fontFamily: "Satoshi, sans-serif",
                fontSize: "12px",
                fontWeight: 700,
                color: "#0F2044",
                cursor: "pointer",
                outline: "none"
              }}
            >
              {layouts.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <button
              onClick={() => {
                const name = prompt("Enter a name for the new chart layout:");
                if (name && name.trim() !== "") {
                  const newId = Date.now().toString();
                  setLayouts(prev => [...prev, { id: newId, name: name.trim(), lines: [], texts: [] }]);
                  setActiveLayoutId(newId);
                }
              }}
              style={{
                background: "#0F2044",
                border: "none",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 700,
                color: "white",
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                boxShadow: "0 2px 8px rgba(15, 32, 68, 0.15)"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "none"}
            >
              + New Layout
            </button>
            {layouts.length > 1 && (
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to delete this layout?")) {
                    const newLayouts = layouts.filter(l => l.id !== activeLayoutId);
                    setLayouts(newLayouts);
                    setActiveLayoutId(newLayouts[0].id);
                  }
                }}
                title="Delete Layout"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#EF4444",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}
              >
                ✕ Delete
              </button>
            )}
          </div>
        </div>

        {/* Right Section: Back to Prices Action */}
        <div>
          <a
            href="/prices"
            style={{
              fontFamily: "Satoshi, sans-serif",
              fontSize: "12px",
              fontWeight: 700,
              color: "#0F2044",
              textDecoration: "none",
              border: "1.5px solid #E2E8F0",
              borderRadius: "8px",
              padding: "8px 16px",
              background: "#F8FAFC",
              transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              display: "inline-block",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#E01F2E";
              e.currentTarget.style.borderColor = "#E01F2E";
              e.currentTarget.style.color = "#FFFFFF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#F8FAFC";
              e.currentTarget.style.borderColor = "#E2E8F0";
              e.currentTarget.style.color = "#0F2044";
            }}
          >
            ← Back to Prices
          </a>
        </div>
      </div>

      {/* Workspace */}
      <div
        style={{
          maxWidth: "100%",
          margin: "0 auto",
          width: "100%",
          padding: "0 24px 24px",
          flex: 1,
          display: "flex",
          gap: "16px",
          minHeight: 0
        }}
      >
        {/* Left Toolbar */}
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "10px", 
          width: "56px", 
          padding: "12px 6px",
          background: "#FFFFFF",
          borderRadius: "16px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 4px 20px rgba(15,32,68,0.05)",
          alignItems: "center"
        }}>
          <button
            onClick={() => setDrawingMode(drawingMode === 'line' ? null : 'line')}
            title="Horizontal Line"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              border: "none",
              background: drawingMode === 'line' ? "#E01F2E" : "transparent",
              color: drawingMode === 'line' ? "white" : "#64748B",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              fontSize: "18px",
              fontWeight: "bold"
            }}
            onMouseEnter={(e) => {
              if (drawingMode !== 'line') {
                e.currentTarget.style.background = "#F1F5F9";
                e.currentTarget.style.color = "#0F2044";
              }
            }}
            onMouseLeave={(e) => {
              if (drawingMode !== 'line') {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#64748B";
              }
            }}
          >
            —
          </button>

          <button
            onClick={() => setDrawingMode(drawingMode === 'text' ? null : 'text')}
            title="Note Text"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              border: "none",
              background: drawingMode === 'text' ? "#E01F2E" : "transparent",
              color: drawingMode === 'text' ? "white" : "#64748B",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              fontSize: "18px",
              fontWeight: 800,
              fontFamily: "serif"
            }}
            onMouseEnter={(e) => {
              if (drawingMode !== 'text') {
                e.currentTarget.style.background = "#F1F5F9";
                e.currentTarget.style.color = "#0F2044";
              }
            }}
            onMouseLeave={(e) => {
              if (drawingMode !== 'text') {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#64748B";
              }
            }}
          >
            T
          </button>

          <button
            onClick={() => {
              if (confirm("Clear all drawings and annotations?")) {
                if (candleSeriesRef.current) {
                  Object.values(linesRef.current).forEach(item => {
                    try { candleSeriesRef.current.removePriceLine(item); } catch (e) { }
                  });
                  linesRef.current = {};
                }
                setLayouts(prev => {
                  const updated = prev.map(l =>
                    l.id === activeLayoutId ? { ...l, lines: [], texts: [] } : l
                  );
                  const current = updated.find(l => l.id === activeLayoutId);
                  if (current) saveLayoutToDb(current);
                  return updated;
                });
              }
            }}
            title="Clear Drawings"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              border: "none",
              background: "transparent",
              color: "#94A3B8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
              fontSize: "16px",
              marginTop: "auto"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
              e.currentTarget.style.color = "#EF4444";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#94A3B8";
            }}
          >
            🗑
          </button>
        </div>

        {/* Chart Area */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            background: "#FFFFFF",
            borderRadius: "24px",
            overflow: "hidden",
            boxShadow: "0 4px 32px rgba(15,32,68,0.06)",
            border: "1px solid #E2E8F0",
            position: "relative",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {loading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255, 255, 255, 0.8)",
                backdropFilter: "blur(12px)",
                zIndex: 1000,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    border: "3px solid rgba(15,32,68,0.05)",
                    borderTop: "3px solid #E01F2E",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 12px",
                  }}
                />
                <p style={{ fontFamily: "Satoshi, sans-serif", color: "#64748B", fontSize: "14px", fontWeight: 500 }}>
                  Loading {displayName} chart...
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255, 255, 255, 0.8)",
                backdropFilter: "blur(12px)",
                zIndex: 1000,
              }}
            >
              <div style={{ textAlign: "center", padding: "40px" }}>
                <p style={{ fontFamily: "Satoshi, sans-serif", color: "#FF5B6A", fontSize: "16px", fontWeight: 700 }}>
                  Failed to load chart
                </p>
                <p style={{ fontFamily: "Satoshi, sans-serif", color: "#64748B", fontSize: "13px", marginTop: "8px" }}>
                  {error}
                </p>
                <button
                  onClick={() => handleTimeframeChange({ ...timeframe })}
                  style={{
                    marginTop: "16px",
                    fontFamily: "Satoshi, sans-serif",
                    fontSize: "13px",
                    fontWeight: 700,
                    padding: "8px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#E01F2E",
                    color: "white",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Floating OHLC Legend (TradingView Style) */}
          {(() => {
            const activeCandle = hoveredCandle || (stockData?.candles && stockData.candles.length > 0 ? stockData.candles[stockData.candles.length - 1] : null);
            if (!activeCandle) return null;

            const openVal = activeCandle.open;
            const highVal = activeCandle.high;
            const lowVal = activeCandle.low;
            const closeVal = activeCandle.close;
            const changeVal = closeVal - openVal;
            const changePercentVal = openVal ? (changeVal / openVal) * 100 : 0;
            
            const isUp = closeVal >= openVal;
            const valColor = isUp ? "#26a69a" : "#ef5350";
            
            const formatNum = (num: number) => {
              return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            };

            return (
              <div style={{
                position: "absolute",
                top: "16px",
                left: "16px",
                zIndex: 100,
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                background: "rgba(255, 255, 255, 0.85)",
                backdropFilter: "blur(12px)",
                padding: "6px 14px",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                fontFamily: "Satoshi, sans-serif",
                fontSize: "12px",
                fontWeight: 600,
                boxShadow: "0 4px 20px rgba(15,32,68,0.05)",
                color: "#1E293B"
              }}>
                <span style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ color: "#64748B", fontWeight: 700, marginRight: "4px" }}>O</span>
                  <span style={{ color: valColor, marginRight: "8px" }}>{formatNum(openVal)}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ color: "#64748B", fontWeight: 700, marginRight: "4px" }}>H</span>
                  <span style={{ color: valColor, marginRight: "8px" }}>{formatNum(highVal)}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ color: "#64748B", fontWeight: 700, marginRight: "4px" }}>L</span>
                  <span style={{ color: valColor, marginRight: "8px" }}>{formatNum(lowVal)}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ color: "#64748B", fontWeight: 700, marginRight: "4px" }}>C</span>
                  <span style={{ color: valColor, marginRight: "8px" }}>{formatNum(closeVal)}</span>
                </span>
                <span style={{ color: valColor, fontWeight: 800, marginLeft: "4px" }}>
                  {changeVal >= 0 ? "+" : ""}{formatNum(changeVal)} ({changeVal >= 0 ? "+" : ""}{changePercentVal.toFixed(2)}%)
                </span>
              </div>
            );
          })()}

          {/* Floating Line Toolbar */}
          {lineToolbarPos && selectedLineId && (
            <div style={{
              position: "absolute",
              left: `${Math.min(lineToolbarPos.x, (chartContainerRef.current?.clientWidth || 800) - 340)}px`,
              top: `${Math.max(lineToolbarPos.y - 70, 16)}px`,
              zIndex: 2000,
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              boxShadow: "0 20px 48px rgba(15, 32, 68, 0.12)",
              color: "#0F2044",
              pointerEvents: "auto",
              animation: "fadeIn 0.2s ease-out"
            }}>
              {/* Delete Icon */}
              <button
                onClick={(e) => { e.stopPropagation(); deleteSelectedLine(); }}
                title="Delete Line"
                style={{ 
                  background: "rgba(239,68,68,0.15)", 
                  border: "none", 
                  borderRadius: "6px", 
                  width: "28px", 
                  height: "28px", 
                  cursor: "pointer", 
                  color: "#EF4444", 
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.3)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.15)"}
              >🗑</button>

              <div style={{ width: "1px", height: "20px", background: "#E2E8F0" }} />

              {/* Color Picker */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", position: "relative" }}>
                <input
                  type="color"
                  value={layouts.find(l => l.id === activeLayoutId)?.lines.find(line => line.id === selectedLineId)?.color || "#0F2044"}
                  onChange={(e) => updateSelectedLine({ color: e.target.value })}
                  style={{ width: "24px", height: "24px", border: "1px solid #CBD5E1", borderRadius: "4px", padding: 0, background: "none", cursor: "pointer" }}
                />
              </div>

              {/* Thickness */}
              <select
                value={layouts.find(l => l.id === activeLayoutId)?.lines.find(line => line.id === selectedLineId)?.width || 2}
                onChange={(e) => updateSelectedLine({ width: parseInt(e.target.value) })}
                style={{ 
                  background: "#F8FAFC", 
                  border: "1px solid #E2E8F0", 
                  borderRadius: "6px", 
                  color: "#0F2044", 
                  fontSize: "12px", 
                  padding: "4px 8px",
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                <option value="2" style={{ background: "#FFFFFF", color: "#0F2044" }}>2px</option>
                <option value="3" style={{ background: "#FFFFFF", color: "#0F2044" }}>3px</option>
                <option value="4" style={{ background: "#FFFFFF", color: "#0F2044" }}>4px</option>
                <option value="5" style={{ background: "#FFFFFF", color: "#0F2044" }}>5px</option>
              </select>

              <div style={{ width: "1px", height: "20px", background: "#E2E8F0" }} />

              {/* Price Edit */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "11px", color: "#64748B" }}>Price</span>
                <input
                  type="number"
                  step="0.05"
                  value={lineToolbarPos.price}
                  onChange={(e) => {
                    const newPrice = parseFloat(e.target.value);
                    setLineToolbarPos({ ...lineToolbarPos, price: newPrice });
                    updateSelectedLine({ price: newPrice });
                  }}
                  style={{ 
                    width: "84px", 
                    background: "#F8FAFC", 
                    border: "1px solid #E2E8F0", 
                    borderRadius: "6px", 
                    color: "#0F2044", 
                    fontSize: "12px", 
                    padding: "4px 8px",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ width: "1px", height: "20px", background: "#E2E8F0" }} />

              {/* Close Toolbar */}
              <button
                onClick={() => { setSelectedLineId(null); setLineToolbarPos(null); }}
                style={{ 
                  background: "none", 
                  border: "none", 
                  cursor: "pointer", 
                  color: "rgba(15, 32, 68, 0.4)", 
                  fontSize: "16px",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "color 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#0F2044"}
                onMouseLeave={(e) => e.currentTarget.style.color = "rgba(15, 32, 68, 0.4)"}
              >✕</button>
            </div>
          )}

          <div
            ref={chartContainerRef}
            style={{ width: "100%", flex: indicatorSettings.rsi.enabled ? 8 : 1 }}
          />

          {indicatorSettings.rsi.enabled && (
            <div
              ref={rsiContainerRef}
              style={{ width: "100%", flex: 2, borderTop: "1px solid #E2E8F0" }}
            />
          )}

          {/* Note Texts Overlay */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 5 }}>
            {/* Callout Lines */}
            <svg ref={svgRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
              {layouts.find(l => l.id === activeLayoutId)?.texts?.map(t => (
                <g key={t.id}>
                  <line id={`svg-line-${t.id}`} stroke="rgba(15, 32, 68, 0.35)" strokeWidth="1.5" strokeDasharray="4 2" />
                  <circle id={`svg-circle-${t.id}`} r="4" fill="#E01F2E" />
                </g>
              ))}
            </svg>

            {/* Text Boxes */}
            {layouts.find(l => l.id === activeLayoutId)?.texts?.map(t => (
              <div
                key={t.id}
                id={`text-box-${t.id}`}
                ref={el => { if (el) textDivsRef.current[t.id] = el; }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  draggingRef.current = {
                    id: t.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialOffsetX: t.offsetX ?? 0,
                    initialOffsetY: t.offsetY ?? -60,
                    offsetX: t.offsetX ?? 0,
                    offsetY: t.offsetY ?? -60,
                  };
                }}
                style={{
                  position: "absolute",
                  background: "rgba(255, 255, 255, 0.95)",
                  border: "1.5px solid #0F2044",
                  color: "#0F2044",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 600,
                  transform: "translate(-50%, -50%)",
                  boxShadow: "0 10px 24px rgba(15, 32, 68, 0.12)",
                  display: "none",
                  whiteSpace: "pre-wrap",
                  fontFamily: "Satoshi, sans-serif",
                  pointerEvents: "auto",
                  userSelect: "none",
                  cursor: "grab",
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 12px 32px rgba(15, 32, 68, 0.18)"}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 10px 24px rgba(15, 32, 68, 0.12)"}
              >
                {t.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        div[id^="text-box-"]:active {
          cursor: grabbing !important;
          transform: translate(-50%, -50%) scale(1.05) !important;
        }
      `}</style>
    </main>
  );
}