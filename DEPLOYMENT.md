# Deployment Guide - Vercel

## Prerequisites

1. Install Vercel CLI globally:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

## Deployment Steps

### 1. First Time Deployment

```bash
# Navigate to project directory
cd /home/ararya/Documents/samehadaku-be

# Deploy to Vercel (this will create a new project)
vercel
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N**
- Project name? **samehadaku-api** (or your preferred name)
- In which directory is your code located? **./**
- Want to modify settings? **N**

### 2. Deploy to Production

After initial setup, deploy to production:

```bash
vercel --prod
```

### 3. Subsequent Deployments

For future deployments, simply run:

```bash
# Preview deployment
vercel

# Production deployment  
vercel --prod
```

## Configuration Files

The following files are configured for Vercel deployment:

### vercel.json
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "bunVersion": "1.x",
  "buildCommand": "bun install",
  "devCommand": "bun run dev",
  "installCommand": "bun install",
  "framework": null,
  "outputDirectory": "dist"
}
```

### src/index.ts
- Exports `app` as default for Vercel
- Conditionally runs `.listen()` only in development

## Environment Variables (Optional)

If you need environment variables:

1. Create `.env` file locally (already in .gitignore)
2. Add variables to Vercel:

```bash
vercel env add VARIABLE_NAME
```

Or via Vercel Dashboard:
- Go to your project settings
- Navigate to Environment Variables
- Add your variables

## Vercel Dashboard

After deployment, you can manage your project at:
https://vercel.com/dashboard

Features available:
- View deployment logs
- Monitor performance
- Configure domains
- Set environment variables
- View analytics

## Custom Domain (Optional)

To add a custom domain:

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your domain
3. Configure DNS records as instructed

## Troubleshooting

### Build Fails

Check build logs in Vercel dashboard. Common issues:
- Missing dependencies → Check package.json
- TypeScript errors → Fix type issues
- Puppeteer issues → Vercel has Chromium built-in for Puppeteer

### Function Timeout

Vercel has execution time limits:
- Hobby: 10 seconds
- Pro: 60 seconds

If scraping takes too long, consider:
- Caching results
- Using serverless-friendly alternatives
- Upgrading to Pro plan

### Memory Issues

Vercel function memory limits:
- Hobby: 1024 MB
- Pro: 3008 MB

Puppeteer can be memory-intensive. Monitor usage and optimize if needed.

## Performance Tips

1. **Enable Edge Caching**: Add cache headers to responses
2. **Use CDN**: Vercel automatically uses CDN for static assets
3. **Monitor**: Use Vercel Analytics to track performance
4. **Optimize**: Keep scraping logic efficient

## Support

- Vercel Docs: https://vercel.com/docs
- Elysia Docs: https://elysiajs.com/deployment/vercel
- Issues: Check deployment logs in Vercel dashboard
