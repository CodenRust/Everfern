# Visualize Tool - Chart.js and Plotly Examples

This document provides comprehensive examples for using the `visualize` tool with Chart.js and Plotly libraries to create 12+ chart types with interactivity and export capabilities.

## Chart.js Examples

### 1. Line Chart (with zoom and pan)

```javascript
{
  html: `
    <canvas id="lineChart"></canvas>
  `,
  js: `
    const ctx = document.getElementById('lineChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
          label: 'Sales',
          data: [12, 19, 3, 5, 2, 3],
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          zoom: {
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: 'xy'
            },
            pan: {
              enabled: true,
              mode: 'xy'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.y.toFixed(2);
              }
            }
          }
        }
      }
    });
  `,
  title: 'Monthly Sales Trend',
  height: 400
}
```

**CDN Required**:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js"></script>
```

### 2. Bar Chart (with hover tooltips)

```javascript
{
  html: `
    <canvas id="barChart"></canvas>
  `,
  js: `
    const ctx = document.getElementById('barChart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Product A', 'Product B', 'Product C', 'Product D'],
        datasets: [{
          label: 'Revenue',
          data: [65, 59, 80, 81],
          backgroundColor: [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            enabled: true,
            callbacks: {
              title: function(items) {
                return items[0].label + ' Details';
              },
              label: function(context) {
                return 'Revenue: $' + context.parsed.y.toLocaleString();
              }
            }
          }
        }
      }
    });
  `,
  title: 'Product Revenue Comparison',
  height: 350
}
```

### 3. Scatter Plot

```javascript
{
  html: `
    <canvas id="scatterChart"></canvas>
  `,
  js: `
    const ctx = document.getElementById('scatterChart').getContext('2d');
    new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Dataset 1',
          data: [{x: 10, y: 20}, {x: 15, y: 25}, {x: 20, y: 30}, {x: 25, y: 22}],
          backgroundColor: 'rgba(255, 99, 132, 0.6)'
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { type: 'linear', position: 'bottom' }
        }
      }
    });
  `,
  title: 'Scatter Plot Analysis',
  height: 400
}
```

### 4. Pie Chart

```javascript
{
  html: `
    <canvas id="pieChart"></canvas>
  `,
  js: `
    const ctx = document.getElementById('pieChart').getContext('2d');
    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Red', 'Blue', 'Yellow', 'Green'],
        datasets: [{
          data: [300, 50, 100, 80],
          backgroundColor: [
            'rgb(255, 99, 132)',
            'rgb(54, 162, 235)',
            'rgb(255, 205, 86)',
            'rgb(75, 192, 192)'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' }
        }
      }
    });
  `,
  title: 'Market Share Distribution',
  height: 350
}
```

### 5. Radar Chart

```javascript
{
  html: `
    <canvas id="radarChart"></canvas>
  `,
  js: `
    const ctx = document.getElementById('radarChart').getContext('2d');
    new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Speed', 'Reliability', 'Comfort', 'Safety', 'Efficiency'],
        datasets: [{
          label: 'Product A',
          data: [65, 59, 90, 81, 56],
          fill: true,
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          borderColor: 'rgb(255, 99, 132)'
        }]
      },
      options: {
        responsive: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  `,
  title: 'Product Performance Metrics',
  height: 400
}
```

### 6. Area Chart

```javascript
{
  html: `
    <canvas id="areaChart"></canvas>
  `,
  js: `
    const ctx = document.getElementById('areaChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
          label: 'Revenue',
          data: [12, 19, 3, 5, 2, 3],
          fill: true,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgb(75, 192, 192)'
        }]
      },
      options: {
        responsive: true
      }
    });
  `,
  title: 'Revenue Over Time',
  height: 350
}
```

## Plotly Examples

### 7. Histogram (with interactivity)

```javascript
{
  html: `
    <div id="histogramPlot"></div>
  `,
  js: `
    const data = [{
      x: [1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 5],
      type: 'histogram',
      marker: {
        color: 'rgba(100, 200, 102, 0.7)',
        line: {
          color: 'rgba(100, 200, 102, 1)',
          width: 1
        }
      }
    }];

    const layout = {
      title: 'Distribution Analysis',
      xaxis: { title: 'Value' },
      yaxis: { title: 'Frequency' },
      hovermode: 'closest'
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToAdd: ['downloadSvg'],
      toImageButtonOptions: {
        format: 'png',
        filename: 'histogram',
        height: 500,
        width: 700
      }
    };

    Plotly.newPlot('histogramPlot', data, layout, config);
  `,
  title: 'Data Distribution',
  height: 450
}
```

**CDN Required**:
```html
<script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
```

### 8. Box Plot

```javascript
{
  html: `
    <div id="boxPlot"></div>
  `,
  js: `
    const trace1 = {
      y: [1, 2, 3, 4, 4, 4, 8, 9, 10],
      type: 'box',
      name: 'Group A',
      marker: { color: 'rgb(107, 174, 214)' }
    };

    const trace2 = {
      y: [2, 3, 3, 3, 3, 5, 6, 6, 7],
      type: 'box',
      name: 'Group B',
      marker: { color: 'rgb(255, 127, 14)' }
    };

    const layout = {
      title: 'Box Plot Comparison',
      yaxis: { title: 'Values' }
    };

    Plotly.newPlot('boxPlot', [trace1, trace2], layout, {responsive: true});
  `,
  title: 'Statistical Comparison',
  height: 400
}
```

### 9. Heatmap

```javascript
{
  html: `
    <div id="heatmapPlot"></div>
  `,
  js: `
    const data = [{
      z: [[1, 20, 30], [20, 1, 60], [30, 60, 1]],
      x: ['Monday', 'Tuesday', 'Wednesday'],
      y: ['Morning', 'Afternoon', 'Evening'],
      type: 'heatmap',
      colorscale: 'Viridis',
      hoverongaps: false
    }];

    const layout = {
      title: 'Activity Heatmap',
      annotations: [],
      xaxis: { ticks: '', side: 'bottom' },
      yaxis: { ticks: '', ticksuffix: ' ' }
    };

    Plotly.newPlot('heatmapPlot', data, layout, {responsive: true});
  `,
  title: 'Activity Patterns',
  height: 450
}
```

### 10. Violin Plot

```javascript
{
  html: `
    <div id="violinPlot"></div>
  `,
  js: `
    const trace1 = {
      type: 'violin',
      y: [1, 2, 3, 4, 5, 5, 5, 6, 7, 8, 9],
      name: 'Dataset A',
      box: { visible: true },
      meanline: { visible: true }
    };

    const layout = {
      title: 'Violin Plot Distribution',
      yaxis: { zeroline: false }
    };

    Plotly.newPlot('violinPlot', [trace1], layout, {responsive: true});
  `,
  title: 'Distribution Analysis',
  height: 400
}
```

### 11. Treemap

```javascript
{
  html: `
    <div id="treemapPlot"></div>
  `,
  js: `
    const data = [{
      type: 'treemap',
      labels: ['A', 'B', 'C', 'D', 'E', 'F'],
      parents: ['', 'A', 'A', 'B', 'B', 'C'],
      values: [10, 14, 12, 10, 2, 6],
      textinfo: 'label+value+percent parent',
      marker: { colorscale: 'Blues' }
    }];

    const layout = {
      title: 'Hierarchical Data Visualization',
      margin: { l: 0, r: 0, b: 0, t: 30 }
    };

    Plotly.newPlot('treemapPlot', data, layout, {responsive: true});
  `,
  title: 'Hierarchical Structure',
  height: 450
}
```

### 12. Sunburst Chart

```javascript
{
  html: `
    <div id="sunburstPlot"></div>
  `,
  js: `
    const data = [{
      type: 'sunburst',
      labels: ['Root', 'A', 'B', 'C', 'A1', 'A2', 'B1', 'B2'],
      parents: ['', 'Root', 'Root', 'Root', 'A', 'A', 'B', 'B'],
      values: [10, 14, 12, 10, 2, 6, 3, 4],
      branchvalues: 'total',
      marker: { colorscale: 'RdBu' }
    }];

    const layout = {
      title: 'Sunburst Hierarchy',
      margin: { l: 0, r: 0, b: 0, t: 30 }
    };

    Plotly.newPlot('sunburstPlot', data, layout, {responsive: true});
  `,
  title: 'Hierarchical Sunburst',
  height: 450
}
```

### 13. 3D Scatter Plot

```javascript
{
  html: `
    <div id="scatter3dPlot"></div>
  `,
  js: `
    const trace = {
      x: [1, 2, 3, 4, 5],
      y: [1, 2, 3, 4, 5],
      z: [1, 4, 9, 16, 25],
      mode: 'markers',
      type: 'scatter3d',
      marker: {
        size: 12,
        color: [1, 2, 3, 4, 5],
        colorscale: 'Viridis'
      }
    };

    const layout = {
      title: '3D Scatter Plot',
      scene: {
        xaxis: { title: 'X Axis' },
        yaxis: { title: 'Y Axis' },
        zaxis: { title: 'Z Axis' }
      }
    };

    Plotly.newPlot('scatter3dPlot', [trace], layout, {responsive: true});
  `,
  title: '3D Data Visualization',
  height: 500
}
```

## Interactivity Features

### Hover Tooltips

All charts support hover tooltips by default. Customize with:

**Chart.js:**
```javascript
options: {
  plugins: {
    tooltip: {
      enabled: true,
      callbacks: {
        label: function(context) {
          return 'Custom: ' + context.parsed.y;
        }
      }
    }
  }
}
```

**Plotly:**
```javascript
layout: {
  hovermode: 'closest' // or 'x', 'y', 'x unified', 'y unified'
}
```

### Zoom and Pan

**Chart.js (requires chartjs-plugin-zoom):**
```javascript
options: {
  plugins: {
    zoom: {
      zoom: {
        wheel: { enabled: true },
        pinch: { enabled: true },
        mode: 'xy'
      },
      pan: {
        enabled: true,
        mode: 'xy'
      }
    }
  }
}
```

**Plotly (built-in):**
```javascript
const config = {
  scrollZoom: true,
  displayModeBar: true
};
Plotly.newPlot('myDiv', data, layout, config);
```

### Filter Controls

**Example with dropdown filter:**
```javascript
{
  html: `
    <select id="filterSelect" onchange="updateChart()">
      <option value="all">All Data</option>
      <option value="category1">Category 1</option>
      <option value="category2">Category 2</option>
    </select>
    <canvas id="filteredChart"></canvas>
  `,
  js: `
    let chart;
    const allData = {
      labels: ['A', 'B', 'C', 'D'],
      datasets: [{
        label: 'All',
        data: [12, 19, 3, 5]
      }]
    };

    function updateChart() {
      const filter = document.getElementById('filterSelect').value;
      // Filter logic here
      if (chart) chart.destroy();
      const ctx = document.getElementById('filteredChart').getContext('2d');
      chart = new Chart(ctx, {
        type: 'bar',
        data: allData,
        options: { responsive: true }
      });
    }

    updateChart();
  `,
  title: 'Filtered Data View',
  height: 400
}
```

## Export Functionality

### PNG Export

**Chart.js:**
```javascript
// Add export button
const exportBtn = document.createElement('button');
exportBtn.textContent = 'Export PNG';
exportBtn.onclick = function() {
  const canvas = document.getElementById('myChart');
  const url = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = 'chart.png';
  link.href = url;
  link.click();
};
document.body.appendChild(exportBtn);
```

**Plotly:**
```javascript
const config = {
  toImageButtonOptions: {
    format: 'png',
    filename: 'custom_chart',
    height: 500,
    width: 700,
    scale: 1
  }
};
Plotly.newPlot('myDiv', data, layout, config);
```

### SVG Export

**Plotly:**
```javascript
const config = {
  modeBarButtonsToAdd: ['downloadSvg'],
  toImageButtonOptions: {
    format: 'svg',
    filename: 'chart'
  }
};
```

## Responsive Grid Layout

### Multiple Charts in Grid

```javascript
{
  html: `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
      <div>
        <canvas id="chart1"></canvas>
      </div>
      <div>
        <canvas id="chart2"></canvas>
      </div>
      <div>
        <canvas id="chart3"></canvas>
      </div>
      <div>
        <canvas id="chart4"></canvas>
      </div>
    </div>
  `,
  css: `
    @media (max-width: 768px) {
      div[style*="grid"] {
        grid-template-columns: 1fr !important;
      }
    }
  `,
  js: `
    // Initialize all charts
    ['chart1', 'chart2', 'chart3', 'chart4'].forEach((id, idx) => {
      const ctx = document.getElementById(id).getContext('2d');
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['A', 'B', 'C'],
          datasets: [{
            label: 'Dataset ' + (idx + 1),
            data: [Math.random() * 10, Math.random() * 10, Math.random() * 10]
          }]
        },
        options: { responsive: true, maintainAspectRatio: true }
      });
    });
  `,
  title: 'Multi-Chart Dashboard',
  height: 800
}
```

### Responsive Breakpoints

```css
/* Desktop: 3 columns */
@media (min-width: 1200px) {
  .chart-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Tablet: 2 columns */
@media (min-width: 768px) and (max-width: 1199px) {
  .chart-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Mobile: 1 column */
@media (max-width: 767px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
```

## Best Practices

1. **Always include CDN links** in the HTML when using Chart.js or Plotly
2. **Use unique IDs** for each chart element to avoid conflicts
3. **Set responsive: true** in options for mobile compatibility
4. **Include hover tooltips** for better data exploration
5. **Add export buttons** for user convenience
6. **Use appropriate chart types** for your data (time series → line, categories → bar, distributions → histogram/box)
7. **Limit data points** for performance (downsample if >1000 points)
8. **Use color schemes** that are accessible (avoid red-green for colorblind users)
9. **Add titles and axis labels** for clarity
10. **Test on mobile devices** to ensure responsive behavior

## Performance Tips

- For large datasets (>10,000 points), use downsampling
- Use `decimation` plugin in Chart.js for time series
- Use `scattergl` instead of `scatter` in Plotly for >10k points
- Lazy load charts that are off-screen
- Debounce resize events for responsive charts
- Cache chart instances to avoid recreation
