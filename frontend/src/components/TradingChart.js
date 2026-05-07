import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

const TradingChart = forwardRef(({ data, supertrendData, symbol, height = 450 }, ref) => {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const initialLoadRef = useRef(true);
  const lastSymbolRef = useRef(symbol);

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (chartRef.current?.chart) {
        const timeScale = chartRef.current.chart.timeScale();
        const currentSpacing = timeScale.options().barSpacing;
        timeScale.applyOptions({ barSpacing: currentSpacing * 1.2 });
      }
    },
    zoomOut: () => {
      if (chartRef.current?.chart) {
        const timeScale = chartRef.current.chart.timeScale();
        const currentSpacing = timeScale.options().barSpacing;
        timeScale.applyOptions({ barSpacing: Math.max(1, currentSpacing / 1.2) });
      }
    },
    resetZoom: () => {
      if (chartRef.current?.chart) {
        chartRef.current.chart.timeScale().fitContent();
      }
    }
  }));

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isLight = document.body.classList.contains('dark-mode');

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: isLight ? '#ffffff' : '#131722' },
        textColor: isLight ? '#444444' : '#d1d4dc',
        fontSize: 12,
        fontFamily: "'Golos Text', sans-serif",
      },
      grid: {
        vertLines: { color: isLight ? '#f0f3fa' : 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: isLight ? '#f0f3fa' : 'rgba(42, 46, 57, 0.5)' },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          width: 1,
          color: isLight ? '#758696' : '#758696',
          style: 3,
        },
        horzLine: {
          width: 1,
          color: isLight ? '#758696' : '#758696',
          style: 3,
        },
      },
      rightPriceScale: {
        borderColor: isLight ? '#e1ecf2' : 'rgba(197, 203, 206, 0.8)',
      },
      timeScale: {
        borderColor: isLight ? '#e1ecf2' : 'rgba(197, 203, 206, 0.8)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
      width: chartContainerRef.current.clientWidth,
      height: typeof height === 'string' ? chartContainerRef.current.clientHeight : height,
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const stSeries = chart.addLineSeries({
      lineWidth: 3,
      lineStyle: 0,
    });

    chartRef.current = { chart, candlestickSeries, stSeries };

    // Watch for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isNowLight = document.body.classList.contains('dark-mode');
          chart.applyOptions({
            layout: {
              background: { type: ColorType.Solid, color: isNowLight ? '#ffffff' : '#131722' },
              textColor: isNowLight ? '#444444' : '#d1d4dc',
            },
            grid: {
              vertLines: { color: isNowLight ? '#f0f3fa' : 'rgba(42, 46, 57, 0.5)' },
              horzLines: { color: isNowLight ? '#f0f3fa' : 'rgba(42, 46, 57, 0.5)' },
            },
            rightPriceScale: { borderColor: isNowLight ? '#e1ecf2' : 'rgba(197, 203, 206, 0.8)' },
            timeScale: { borderColor: isNowLight ? '#e1ecf2' : 'rgba(197, 203, 206, 0.8)' },
          });
        }
      });
    });

    observer.observe(document.body, { attributes: true });

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (chartRef.current?.chart && height) {
      const parent = chartContainerRef.current;
      if (parent) {
        chartRef.current.chart.resize(parent.clientWidth, parent.clientHeight || 450);
      }
    }
  }, [height]);

  useEffect(() => {
    if (chartRef.current) {
      if (data && data.length > 0) {
        // Lightweight charts expects Unix timestamps to be UTC, and displays them as UTC.
        // To display local time, we adjust the timestamp by the local timezone offset.
        const tzOffset = new Date().getTimezoneOffset() * 60; // in seconds

        const formattedData = data.map(d => {
          const localTimeMs = new Date(d.time.replace(' ', 'T')).getTime();
          return {
            time: Math.floor(localTimeMs / 1000) - tzOffset,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
          };
        })
        .sort((a, b) => a.time - b.time)
        .filter((item, index, self) => index === 0 || item.time > self[index - 1].time);

        chartRef.current.candlestickSeries.setData(formattedData);

        if (supertrendData && supertrendData.length > 0) {
          const formattedSt = supertrendData.map(d => {
            const localTimeMs = new Date(d.time.replace(' ', 'T')).getTime();
            return {
              time: Math.floor(localTimeMs / 1000) - tzOffset,
              value: d.supertrend,
              color: d.trend === 'UP' ? '#4CAF50' : '#F44336'
            };
          })
          .filter(d => d.value !== null)
          .sort((a, b) => a.time - b.time)
          .filter((item, index, self) => index === 0 || item.time > self[index - 1].time);

          chartRef.current.stSeries.setData(formattedSt);
        }
        
        if (initialLoadRef.current || lastSymbolRef.current !== symbol) {
          chartRef.current.chart.timeScale().fitContent();
          initialLoadRef.current = false;
          lastSymbolRef.current = symbol;
        }
      } else {
        // Clear data if empty array passed
        chartRef.current.candlestickSeries.setData([]);
        chartRef.current.stSeries.setData([]);
      }
    }
  }, [data, supertrendData]);

  return (
    <div className="w-100 h-100">
      <div ref={chartContainerRef} className="w-100 h-100" />
    </div>
  );
});

export default TradingChart;
