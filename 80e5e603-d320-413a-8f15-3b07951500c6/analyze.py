import pandas as pd
import json
import os

# Load the data
df = pd.read_csv('customers_analyzed.csv')

# 1. Geographic distribution
country_counts = df['Country'].value_counts().to_dict()
city_counts = df['City'].value_counts().head(10).to_dict()  # top 10 cities

# 2. Subscription date trends
# Ensure Subscription Date is datetime
df['Subscription Date'] = pd.to_datetime(df['Subscription Date'])
# Yearly trends
yearly_counts = df['Subscription Date'].dt.year.value_counts().sort_index().to_dict()
# Monthly trends (year-month)
df['YearMonth'] = df['Subscription Date'].dt.to_period('M')
monthly_counts = df['YearMonth'].value_counts().sort_index()
# Convert Period to string for JSON serialization
monthly_counts_dict = {str(k): int(v) for k, v in monthly_counts.items()}

# 3. Company distribution analysis
company_counts = df['Company'].value_counts().to_dict()
top_companies = df['Company'].value_counts().head(10).to_dict()

# 4. Contact information completeness metrics
total_rows = len(df)
phone1_complete = df['Phone 1'].notna().sum()
phone2_complete = df['Phone 2'].notna().sum()
email_complete = df['Email'].notna().sum()
website_complete = df['Website'].notna().sum()

contact_completeness = {
    'phone1': round(phone1_complete / total_rows * 100, 2),
    'phone2': round(phone2_complete / total_rows * 100, 2),
    'email': round(email_complete / total_rows * 100, 2),
    'website': round(website_complete / total_rows * 100, 2)
}

# 5. Summary statistics
summary_stats = {
    'total_customers': total_rows,
    'unique_countries': df['Country'].nunique(),
    'unique_cities': df['City'].nunique(),
    'unique_companies': df['Company'].nunique(),
    'date_range': {
        'start': df['Subscription Date'].min().strftime('%Y-%m-%d'),
        'end': df['Subscription Date'].max().strftime('%Y-%m-%d')
    }
}

# Prepare output dictionary
output = {
    'geographic_distribution': {
        'country_counts': country_counts,
        'city_counts': city_counts
    },
    'subscription_trends': {
        'yearly_counts': yearly_counts,
        'monthly_counts': monthly_counts_dict
    },
    'company_distribution': {
        'company_counts': company_counts,
        'top_companies': top_companies
    },
    'contact_completeness': contact_completeness,
    'summary_statistics': summary_stats
}

# Write to JSON file
with open('analysis_results.json', 'w') as f:
    json.dump(output, f, indent=2)

print("Analysis complete. Results saved to analysis_results.json")