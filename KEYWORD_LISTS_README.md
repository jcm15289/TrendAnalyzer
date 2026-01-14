# 📋 Keyword Lists Organization

## Overview
Your keywords are now organized into 6 categorized lists for easy filtering in the main window.

## 📊 Current Lists

### 1. **All Keywords** (Gray)
- Shows all keywords from all lists
- Cannot be deleted
- Auto-populated with all keywords

### 2. **Politics** (Blue) - 14 keywords
- Democrat vs Republican
- MAGA
- Trump-related: Trump, anti trump, boycott trump, hate trump
- Elections: election fraud, voter suppression
- Politicians: gavin newsom
- Issues: deportation
- Ideologies: Progressive, progressive, liberal vs conservative, anti woke

### 3. **Media** (Red) - 4 keywords
- CNN (Cnn, cnn)
- Fox News
- Cuomo

### 4. **Finance** (Orange) - 6 keywords
- Employment: Unemployment, unemployment benefits, job openings
- Economy: inflation, tariffs
- Social: inequality, Inequality

### 5. **Social Issues** (Purple) - 7 keywords
- antisemitism
- boycott usa
- controversy
- inmigration lawyer
- know your rights
- surrender green card
- Mamdani

### 6. **Technology** (Green) - 0 keywords
- Empty list ready for tech-related keywords

## 🎯 How to Use

### In the Main Window:
1. **Look for the dropdown** at the top of the page (left side of toolbar)
2. **Select a list** to filter - you'll see a colored dot and keyword count
3. **View filtered trends** - only keywords from selected list will display
4. **Switch between lists** anytime to see different trends

### Adding Keywords to Lists:
1. Click the **Config/Settings button** (⚙️)
2. Find the keyword you want to organize
3. Assign it to one or more lists
4. Keywords can belong to multiple lists

### Creating New Lists:
1. Open Config Dialog
2. Click "Create New List"
3. Name it (e.g., "International", "Elections 2024")
4. Add keywords to your new list

## 🔄 How It Works

The filter works by:
- `selectedListId` state tracks which list is active
- `getKeywordsForList()` function filters keywords by list
- When you select "All Keywords", it shows everything
- When you select a specific list, only those keywords display

## 📁 File Location
`/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/src/lib/lists.ts`

## 🎨 List Colors
- All Keywords: Gray (#6B7280)
- Politics: Blue (#3B82F6)
- Media: Red (#EF4444)
- Technology: Green (#10B981)
- Finance: Orange (#F59E0B)
- Social Issues: Purple (#8B5CF6)

## 🚀 Next Steps
1. Start the dev server: `npm run dev`
2. Open the app in your browser
3. Use the list dropdown to filter trends
4. Add more keywords as needed
5. Create custom lists for specific topics

