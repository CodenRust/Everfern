---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
---



This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.


The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.


## Design Thinking


Before coding, understand the context and commit to a BOLD aesthetic direction:


*  **Purpose** : What problem does this interface solve? Who uses it?
*  **Tone** : Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
*  **Constraints** : Technical requirements (framework, performance, accessibility).
*  **Differentiation** : What makes this UNFORGETTABLE? What's the one thing someone will remember?


 **CRITICAL** : Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.


Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:


* Production-grade and functional
* Visually striking and memorable
* Cohesive with a clear aesthetic point-of-view
* Meticulously refined in every detail


## Frontend Aesthetics Guidelines


Focus on:


*  **Typography** : Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
*  **Color & Theme** : Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
*  **Motion** : Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
*  **Spatial Composition** : Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
*  **Backgrounds & Visual Details** : Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.


NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.


Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.


 **IMPORTANT** : Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.


Remember: Everfernis capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

---

## Chart & Data Visualization Guidelines

Charts are often the weakest part of AI-generated HTML. Follow these guidelines to create professional, stunning visualizations:

### Chart Type Selection

Choose the RIGHT chart for your data:

| Data Pattern | Best Chart Types |
|--------------|-----------------|
| Trends over time | Line chart, Area chart |
| Part-to-whole relationships | Donut chart, Pie chart (max 5 categories) |
| Comparisons between categories | Bar chart (horizontal for many items) |
| Distribution | Histogram, Box plot, Violin plot |
| Correlation | Scatter plot |
| Geographic data | Choropleth map, Bubble map |
| Waterfall/flow | Sankey diagram, Treemap |

### Color Palettes for Charts

**NEVER use Chart.js defaults** — they're ugly. Create cohesive palettes:

```javascript
// Professional palette (works light & dark)
const colors = {
  primary: '#6366f1',    // Indigo
  secondary: '#8b5cf6',  // Violet
  accent: '#f59e0b',     // Amber
  success: '#10b981',    // Emerald
  danger: '#ef4444',     // Red
  muted: '#94a3b8',      // Slate
};

// Categorical palette for multi-series
const categorical = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#84cc16'
];

// Gradient for area charts
const gradient = ctx.createLinearGradient(0, 0, 0, 400);
gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
```

### Chart Styling Rules

1. **Remove gridlines or make them subtle** (light gray, dashed)
2. **No borders around charts** — use shadow or color contrast instead
3. **Hide axis lines** (except for zero baseline when meaningful)
4. **Use nice font sizes** — labels should be readable (12-14px)
5. **Add data labels** only when essential (avoid clutter)
6. **Legend positioning** — inside chart for mobile, outside for desktop
7. **Tooltips** — custom styled to match your theme, not default browser

### Interactive Enhancements

```javascript
// Smooth animations on hover
options: {
  hover: {
    animationDuration: 200,
    intersect: false
  },
  plugins: {
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleFont: { family: 'Inter', size: 13, weight: 600 },
      bodyFont: { family: 'Inter', size: 12 },
      padding: 12,
      cornerRadius: 8,
      displayColors: true,
      boxPadding: 4
    }
  }
}
```

### Common Chart Mistakes to AVOID

- ❌ Using 3D charts (they distort data perception)
- ❌ Pie charts with more than 5 slices
- ❌ Truncated Y-axis (except for clearly outlier data)
- ❌ Rainbow color scales (hard to read, not colorblind-friendly)
- ❌ Excessive decorations, gradients on bars
- ❌ Missing unit labels and data sources
- ❌ Line charts without smooth curves when data is continuous
- ❌ Overlapping labels (use offset or smart positioning)

### Chart.js Configuration Template

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<canvas id="myChart" width="400" height="300"></canvas>
<script>
const ctx = document.getElementById('myChart').getContext('2d');

// Create gradient
const gradient = ctx.createLinearGradient(0, 0, 0, 300);
gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

new Chart(ctx, {
  type: 'line',
  data: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [{
      label: 'Revenue',
      data: [30, 45, 35, 50, 60],
      borderColor: '#6366f1',
      backgroundColor: gradient,
      fill: true,
      tension: 0.4,  // Smooth curves
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: '#fff',
      pointBorderWidth: 2,
      pointBorderColor: '#6366f1'
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(99, 102, 241, 0.3)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: false
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 12 } }
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
        ticks: { color: '#64748b', font: { size: 12 } }
      }
    }
  }
});
</script>
```

### Recharts (React) Best Practices

```jsx
<ResponsiveContainer width="100%" height={400}>
  <AreaChart data={data}>
    <defs>
      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
      </linearGradient>
    </defs>
    <XAxis
      dataKey="name"
      axisLine={false}
      tickLine={false}
      tick={{ fill: '#64748b', fontSize: 12 }}
    />
    <YAxis
      axisLine={false}
      tickLine={false}
      tick={{ fill: '#64748b', fontSize: 12 }}
      width={50}
    />
    <CartesianGrid
      strokeDasharray="3 3"
      stroke="rgba(0,0,0,0.06)"
      vertical={false}
    />
    <Tooltip
      contentStyle={{
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        border: 'none',
        borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}
      labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
      itemStyle={{ color: '#94a3b8' }}
    />
    <Area
      type="monotone"
      dataKey="value"
      stroke="#6366f1"
      strokeWidth={2}
      fill="url(#colorValue)"
    />
  </AreaChart>
</ResponsiveContainer>
```

### Dashboard Layout Tips

- Use consistent card styling with subtle shadows
- Create visual hierarchy with size and spacing
- Mix chart types to keep the page interesting
- Add summary KPIs above detailed charts
- Use consistent spacing (8px grid system)
- Include data source attribution
- Mobile: stack charts vertically, simplify interactions

---

## Data Reports & Analysis Workflow

### Critical Rule: Python for Data, Sub-Agent for Display

When generating data reports, dashboards, or any visualization from datasets:

1. **Use Python to process and analyze the data** — pandas, numpy, matplotlib, etc.
2. **Spawn a sub-agent (`spawn_agent`) to write the HTML** — The sub-agent receives the computed data and writes the HTML/CSS/JS code directly.
3. **DO NOT use Python string formatting for HTML** — This leads to KeyError bugs and poor rendering. Use the sub-agent's specialized writing capabilities.

NEVER generate reports as Python scripts that output HTML strings. Always split into:
- `.py` file: processes data, computes statistics, generates data arrays.
- `spawn_agent`: receives data, writes the `.html` file with Tailwind + Chart.js.

### Report Generation Pattern

```python
# analyze.py - Data processing only
import pandas as pd

csv_path = "data.csv"
df = pd.read_csv(csv_path)

# Compute statistics
total = len(df)
avg_value = df['value'].mean()
categories = df['category'].value_counts().to_dict()

# Print data as JSON for HTML to use
import json
data = {
    "total": total,
    "avg_value": round(avg_value, 2),
    "categories": categories,
    "trend": df.groupby('month')['value'].sum().to_dict()
}
print(json.dumps(data))
```

```html
<!-- report.html - Display only, use Python to inject data -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: { fontFamily: { sans: ['Figtree', 'system-ui', 'sans-serif'] } }
      }
    }
  </script>
</head>
<body class="bg-gray-50 font-sans text-gray-900">
  <!-- Data injected by Python -->
  <script>
    const DATA = {{ INJECT_DATA_HERE }};
  </script>
  <!-- Charts and UI here -->
</body>
</html>
```

### Report HTML Template (Tailwind + Chart.js)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Data Report</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Figtree', 'system-ui', 'sans-serif'] },
          colors: {
            brand: { 50: '#eef2ff', 100: '#e0e7ff', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' }
          }
        }
      }
    }
  </script>
  <style>
    body { font-family: 'Figtree', system-ui, sans-serif; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div class="max-w-6xl mx-auto px-6 py-10">

    <!-- Header -->
    <div class="bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl p-8 text-white mb-8 shadow-xl">
      <h1 class="text-3xl font-bold mb-2">{{ REPORT_TITLE }}</h1>
      <p class="text-brand-100">{{ GENERATED_DATE }} · {{ RECORD_COUNT }} records</p>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <p class="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Records</p>
        <p class="text-3xl font-bold text-gray-900 mt-1">{{ TOTAL }}</p>
      </div>
      <!-- More KPIs... -->
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

      <!-- Line Chart: Trends -->
      <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 class="font-semibold text-gray-800 mb-4">Trend Over Time</h3>
        <div class="h-64">
          <canvas id="trendChart"></canvas>
        </div>
      </div>

      <!-- Bar Chart: Categories -->
      <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 class="font-semibold text-gray-800 mb-4">Category Breakdown</h3>
        <div class="h-64">
          <canvas id="categoryChart"></canvas>
        </div>
      </div>

    </div>

    <!-- Data Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100">
        <h3 class="font-semibold text-gray-800">Sample Records</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
            <tr>
              {{ TABLE_HEADERS }}
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {{ TABLE_ROWS }}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div class="text-center text-gray-400 text-sm mt-8">
      Generated by EverFern AI Assistant
    </div>

  </div>

  <!-- Charts JS -->
  <script>
    const chartDefaults = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(99, 102, 241, 0.3)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          titleFont: { family: 'Figtree', size: 13, weight: '600' },
          bodyFont: { family: 'Figtree', size: 12 }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'Figtree', size: 11 } } },
        y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Figtree', size: 11 } } }
      }
    };

    // Trend Chart
    new Chart(document.getElementById('trendChart'), {
      type: 'line',
      data: {
        labels: DATA.trend_labels,
        datasets: [{
          label: 'Value',
          data: DATA.trend_values,
          borderColor: '#6366f1',
          backgroundColor: (ctx) => {
            const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 256);
            gradient.addColorStop(0, 'rgba(99,102,241,0.25)');
            gradient.addColorStop(1, 'rgba(99,102,241,0)');
            return gradient;
          },
          fill: true, tension: 0.4,
          pointRadius: 0, pointHoverRadius: 6,
          pointBackgroundColor: '#fff', pointBorderColor: '#6366f1', pointBorderWidth: 2
        }]
      },
      options: chartDefaults
    });

    // Category Chart (Horizontal Bar)
    new Chart(document.getElementById('categoryChart'), {
      type: 'bar',
      data: {
        labels: DATA.category_labels,
        datasets: [{
          data: DATA.category_values,
          backgroundColor: ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#14b8a6'],
          borderRadius: 6, borderSkipped: false
        }]
      },
      options: {
        ...chartDefaults,
        indexAxis: 'y',
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Figtree', size: 11 } } },
          y: { grid: { display: false }, ticks: { color: '#64748b', font: { family: 'Figtree', size: 12 } } }
        }
      }
    });
  </script>
</body>
</html>
```

### Key Guidelines for Data Reports

1. **Always use Tailwind CSS** via CDN — no custom CSS files needed
2. **Always use Figtree** via Google Fonts — clean, modern, excellent readability
3. **Always use Chart.js** with custom styling — NEVER use matplotlib or plain images
4. **Chart colors**: Indigo/purple palette (`#6366f1`, `#8b5cf6`, `#ec4899`, `#f59e0b`, `#10b981`)
5. **Layout**: KPI cards at top, charts in 2-column grid, table at bottom
6. **Responsive**: Use Tailwind's responsive prefixes (`sm:`, `lg:`)
7. **Data injection**: Python formats the HTML string, replacing `{{ PLACEHOLDERS }}` with actual computed values
8. **Include Chart.js gradient fills** for area charts — adds visual depth
9. **Hover effects on chart points** — `pointHoverRadius: 6` minimum
10. **Dark tooltip styling** matching the report theme
