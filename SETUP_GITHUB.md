# Setting Up GitHub Repository for TrendAnalyzer

## Step 1: Create Repository on GitHub

1. Go to [GitHub](https://github.com) and sign in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Fill in:
   - **Repository name:** `TrendAnalyzer` (or `trend-analyzer`)
   - **Description:** (optional) "Trend analysis and visualization application"
   - **Visibility:** Choose Public or Private
   - **⚠️ IMPORTANT:** Do NOT check:
     - ❌ Add a README file
     - ❌ Add .gitignore
     - ❌ Choose a license
   - (We already have these files)
4. Click **"Create repository"**

## Step 2: Copy Repository URL

After creating the repository, GitHub will show you the repository URL. It will look like:
- `https://github.com/YOUR_USERNAME/TrendAnalyzer.git` (HTTPS)
- `git@github.com:YOUR_USERNAME/TrendAnalyzer.git` (SSH)

Copy this URL - you'll need it in the next step.

## Step 3: Connect Local Repository to GitHub

Run these commands in your terminal:

```bash
cd /Users/juliocasalmartin/Library/CloudStorage/Dropbox/Julio/TrendAnalyzer

# Add the remote (replace with your actual repository URL)
git remote add origin https://github.com/YOUR_USERNAME/TrendAnalyzer.git

# Or if using SSH:
# git remote add origin git@github.com:YOUR_USERNAME/TrendAnalyzer.git

# Verify the remote was added
git remote -v

# Stage all files
git add .

# Create initial commit
git commit -m "Initial commit: TrendAnalyzer project"

# Push to GitHub
git push -u origin main
```

If your default branch is `master` instead of `main`, use:
```bash
git branch -M main
git push -u origin main
```

## Step 4: Verify

Go back to your GitHub repository page and refresh. You should now see all your files!

## Troubleshooting

### If you get "repository not found" error:
- Check that the repository URL is correct
- Make sure you have access to the repository
- Try using HTTPS instead of SSH (or vice versa)

### If you get authentication errors:
- For HTTPS: You may need a Personal Access Token instead of password
- For SSH: Make sure your SSH key is added to GitHub

### If you get "branch main does not exist":
- Use: `git push -u origin main --force` (only if repository is empty)
- Or rename your branch: `git branch -M main` then push
