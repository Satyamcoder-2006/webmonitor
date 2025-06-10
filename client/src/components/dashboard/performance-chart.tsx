import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { PerformanceData } from "@/lib/types";

export default function PerformanceChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  const { data: performanceData = [], isLoading } = useQuery<PerformanceData[]>({
    queryKey: ["/api/performance"],
  });

  useEffect(() => {
    const loadChart = async () => {
      if (!canvasRef.current || isLoading || performanceData.length === 0) return;

      // Dynamically import Chart.js to avoid SSR issues
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      // Destroy existing chart
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: performanceData.map(d => d.hour),
          datasets: [{
            label: 'Response Time (ms)',
            data: performanceData.map(d => d.averageResponseTime),
            borderColor: 'hsl(207, 90%, 54%)',
            backgroundColor: 'hsla(207, 90%, 54%, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: 'hsl(207, 90%, 54%)',
            pointBorderColor: 'white',
            pointBorderWidth: 2,
            pointRadius: 4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return value + 'ms';
                }
              },
              grid: {
                color: 'hsl(0, 0%, 90%)',
              }
            },
            x: {
              grid: {
                color: 'hsl(0, 0%, 90%)',
              }
            }
          },
          elements: {
            point: {
              hoverRadius: 6,
            }
          }
        }
      });
    };

    loadChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [performanceData, isLoading]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>24h Response Time</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-gray-500">Loading chart...</div>
          </div>
        ) : performanceData.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p>No performance data available</p>
              <p className="text-sm">Data will appear after monitoring begins</p>
            </div>
          </div>
        ) : (
          <div className="h-64">
            <canvas ref={canvasRef} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
