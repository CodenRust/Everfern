---
name: charts
description: "Use this skill when generating interactive charts or data visualizations for frontend dashboards. This skill dictates the use of ApexCharts for all visual representations of data."
---

# Interactive Charts in EverFern

When spawning sub-agents or writing interactive HTML/JS to display data visualizations, **you must use ApexCharts (`apexcharts`)**.

## Requirements
- **Always** use ApexCharts for all graphs, plots, and interactive data visualizations.
- **Do not** use Chart.js, Recharts, D3.js, or other charting libraries unless explicitly requested by the user.
- Include the library via CDN in your HTML files: `<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>`
- Ensure charts are responsive, cleanly animated, and themed to match EverFern's premium aesthetic (modern fonts like Inter, subtle gradients, and custom tooltips).

## Example Integration
```html
<div id="chart"></div>
<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
<script>
  var options = {
    chart: {
      type: 'area',
      height: 350,
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: false }
    },
    series: [{
      name: 'Sales',
      data: [30, 40, 35, 50, 49, 60, 70]
    }],
    xaxis: {
      categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']
    },
    colors: ['#6366f1'],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 90, 100]
      }
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth' }
  };

  var chart = new ApexCharts(document.querySelector("#chart"), options);
  chart.render();
</script>
```
