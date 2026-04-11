---
name: data-analysis
description: "Use this skill for advanced data manipulation, statistical analysis, and visualization. Use Python with pandas, numpy, and matplotlib/seaborn to perform tasks like: deep data cleaning, trend analysis, statistical testing, creating charts/plots, and generating insights from structured data (CSV, JSON, SQL, etc.). If the user wants to understand patterns, see graphs, or perform complex calculations on data, use this skill. IMPORTANT: After analyzing data with this skill, ALWAYS spawn a sub-agent (`spawn_agent`) and use the 'frontend-design' skill to generate interactive HTML dashboards for presenting results visually. NEVER write Python to generate HTML."
---

# Data Analysis in EverFern

## MANDATORY WORKFLOW

**Step 1**: First, detect the data file type and use the appropriate skill to read and understand the data structure:
- For `.csv` files: use the `csv` skill
- For `.xlsx` files: use the `xlsx` skill
- For `.pdf` files: use the `pdf` skill
- For `.json` files: use the `json` skill
- For `.docx` files: use the `docx` skill
- For plain text: use the `txt` skill

**Step 2**: Then use this data-analysis skill to:
- Perform statistical analysis
- Clean and transform data
- Generate visualizations

**Step 3**: Finally, ALWAYS **spawn a sub-agent (`spawn_agent`)** and use the 'frontend-design' and 'charts' skills to:
- Generate an interactive HTML dashboard directly
- Present results using ApexCharts (as defined in the `charts` skill)
- Create charts that the user can interact with

This 3-step workflow is MANDATORY for any data visualization task.

## Overview

EverFern leverages Python for high-performance data analysis. This allows for complex operations that exceed simple text-based processing.

## Key Libraries

- **pandas**: Primary tool for tabular data manipulation (DataFrames).
- **numpy**: Numerical calculations and array operations.
- **matplotlib/seaborn**: Data visualization and plotting.

## Common Workflows

### 1. Data Loading and Cleaning

```python
import pandas as pd
import numpy as np

# Load data (use absolute R-string paths on Windows)
df = pd.read_csv(r'C:\Users\Username\Downloads\data.csv')

# Handle missing values
df['category'] = df['category'].fillna('Unknown')
df['value'] = df['value'].interpolate()

# Remove outliers
q_low = df["value"].quantile(0.01)
q_hi  = df["value"].quantile(0.99)
df_filtered = df[(df["value"] < q_hi) & (df["value"] > q_low)]
```

### 2. Exploratory Data Analysis (EDA)

```python
# Statistical summaries
summary = df.describe()

# Correlation matrix
corr = df.select_dtypes(include=[np.number]).corr()

# Grouping and aggregation
monthly_stats = df.groupby(pd.Grouper(key='date', freq='M')).agg({
    'sales': ['sum', 'mean', 'count'],
    'customer_id': 'nunique'
})
```

### 3. Data Visualization

```python
import matplotlib.pyplot as plt
import seaborn as sns

plt.figure(figsize=(10, 6))
sns.set_style("whitegrid")

# Create a trend line
sns.lineplot(data=df, x='date', y='value', hue='category')

plt.title('Value Trend Over Time by Category')
plt.xlabel('Date')
plt.ylabel('Value')
plt.xticks(rotation=45)

# Save the plot for the user to see (EverFern can display images saved to specific locations)
plt.savefig(r'C:\Users\Username\Downloads\analysis_plot.png', dpi=300, bbox_inches='tight')
plt.show()
```

## Best Practices

- **Reliability**: Always check for `None` or `NaN` values before performing calculations.
- **Performance**: Use vectorised pandas operations instead of iterating over rows with `for` loops.
- **Privacy**: If handling sensitive files, ensure absolute paths are handled carefully and not leaked in thought blocks if not necessary.
- **Visuals**: When creating plots, use high-DPI (300) settings for professional results.
- **Windows Paths**: Always use absolute paths with `r'...'` (raw strings) to avoid escape character issues.
